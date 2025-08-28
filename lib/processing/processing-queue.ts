import { z } from 'zod';

export enum ProcessingStage {
  URL_PARSING = 'url_parsing',
  HIERARCHY_BUILDING = 'hierarchy_building',
  RELATIONSHIP_DETECTION = 'relationship_detection',
  GAP_ANALYSIS = 'gap_analysis',
  SIMILARITY_CALCULATION = 'similarity_calculation',
  VIEW_REFRESH = 'view_refresh',
  COMPLETE = 'complete',
}

export enum JobStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export interface ProcessingJob {
  id: string;
  projectId: string;
  type: 'full' | 'incremental' | 'single';
  data: unknown;
  status: JobStatus;
  stage: ProcessingStage;
  progress: number;
  totalItems: number;
  processedItems: number;
  startedAt?: Date;
  completedAt?: Date;
  error?: ProcessingError;
  metadata?: Record<string, unknown>;
}

export interface ProcessingError {
  message: string;
  code?: string;
  stage: ProcessingStage;
  timestamp: Date;
  details?: unknown;
}

export interface PipelineProgress {
  jobId: string;
  currentStage: ProcessingStage;
  completedStages: ProcessingStage[];
  itemsProcessed: number;
  totalItems: number;
  errors: ProcessingError[];
  estimatedTimeRemaining: number;
  throughput: number;
}

export interface QueueConfig {
  batchSize?: number;
  parallelWorkers?: number;
  retryAttempts?: number;
  retryDelay?: number;
  timeout?: number;
  enableLogging?: boolean;
}

const ProcessingJobSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  type: z.enum(['full', 'incremental', 'single']),
  data: z.unknown(),
  status: z.nativeEnum(JobStatus),
  stage: z.nativeEnum(ProcessingStage),
  progress: z.number().min(0).max(100),
  totalItems: z.number().min(0),
  processedItems: z.number().min(0),
  startedAt: z.date().optional(),
  completedAt: z.date().optional(),
  error: z.object({
    message: z.string(),
    code: z.string().optional(),
    stage: z.nativeEnum(ProcessingStage),
    timestamp: z.date(),
    details: z.unknown().optional(),
  }).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export class ProcessingQueue {
  private readonly defaultConfig: Required<QueueConfig> = {
    batchSize: 100,
    parallelWorkers: 5,
    retryAttempts: 3,
    retryDelay: 1000,
    timeout: 30000,
    enableLogging: true,
  };

  private config: Required<QueueConfig>;
  private queue: ProcessingJob[] = [];
  private activeJobs: Map<string, ProcessingJob> = new Map();
  private completedJobs: Map<string, ProcessingJob> = new Map();
  private workers: Promise<void>[] = [];
  private isRunning = false;
  private progressCallbacks: Map<string, (progress: PipelineProgress) => void> = new Map();

  constructor(config?: QueueConfig) {
    this.config = { ...this.defaultConfig, ...config };
  }

  async enqueue(job: Omit<ProcessingJob, 'id' | 'status' | 'stage' | 'progress' | 'processedItems'>): Promise<string> {
    const jobId = this.generateJobId();
    const newJob: ProcessingJob = {
      ...job,
      id: jobId,
      status: JobStatus.PENDING,
      stage: ProcessingStage.URL_PARSING,
      progress: 0,
      processedItems: 0,
    };

    try {
      ProcessingJobSchema.parse(newJob);
    } catch (error) {
      throw new Error(`Invalid job configuration: ${error}`);
    }

    this.queue.push(newJob);
    
    if (!this.isRunning) {
      this.start();
    }

    return jobId;
  }

  async processInBatches<T>(
    items: T[],
    processor: (batch: T[]) => Promise<void>,
    jobId: string
  ): Promise<void> {
    const job = this.activeJobs.get(jobId) || this.queue.find(j => j.id === jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    const batches = this.createBatches(items, this.config.batchSize);
    let processedCount = 0;

    for (const batch of batches) {
      const batchPromises = batch.map(async (item, index) => {
        try {
          await processor([item]);
          processedCount++;
          await this.updateJobProgress(jobId, processedCount, items.length);
        } catch (error) {
          await this.handleJobError(jobId, error as Error, job.stage);
        }
      });

      await Promise.all(batchPromises.slice(0, this.config.parallelWorkers));
      
      if (job.status === JobStatus.CANCELLED) {
        break;
      }
    }
  }

  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  private start(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    
    for (let i = 0; i < this.config.parallelWorkers; i++) {
      this.workers.push(this.processWorker());
    }
  }

  private async processWorker(): Promise<void> {
    while (this.isRunning) {
      const job = this.getNextJob();
      
      if (!job) {
        await this.sleep(100);
        continue;
      }

      await this.processJob(job);
    }
  }

  private getNextJob(): ProcessingJob | null {
    const job = this.queue.find(j => j.status === JobStatus.PENDING);
    
    if (job) {
      job.status = JobStatus.IN_PROGRESS;
      job.startedAt = new Date();
      this.activeJobs.set(job.id, job);
      const index = this.queue.indexOf(job);
      this.queue.splice(index, 1);
    }
    
    return job;
  }

  private async processJob(job: ProcessingJob): Promise<void> {
    try {
      this.log(`Starting job ${job.id} - Type: ${job.type}`);

      for (const stage of Object.values(ProcessingStage)) {
        if (stage === ProcessingStage.COMPLETE) continue;
        
        job.stage = stage as ProcessingStage;
        await this.updateProgress(job.id);
        
        await this.executeStage(job, stage as ProcessingStage);
        
        if (job.status === JobStatus.CANCELLED || job.status === JobStatus.FAILED) {
          break;
        }
      }

      if (job.status === JobStatus.IN_PROGRESS) {
        job.status = JobStatus.COMPLETED;
        job.stage = ProcessingStage.COMPLETE;
        job.completedAt = new Date();
        job.progress = 100;
      }

    } catch (error) {
      await this.handleJobError(job.id, error as Error, job.stage);
    } finally {
      this.activeJobs.delete(job.id);
      this.completedJobs.set(job.id, job);
      await this.updateProgress(job.id);
      this.log(`Completed job ${job.id} - Status: ${job.status}`);
    }
  }

  private async executeStage(job: ProcessingJob, stage: ProcessingStage): Promise<void> {
    const timeout = new Promise((_, reject) => 
      setTimeout(() => reject(new Error(`Stage ${stage} timed out`)), this.config.timeout)
    );

    const stageExecution = this.runStage(job, stage);

    try {
      await Promise.race([stageExecution, timeout]);
    } catch (error) {
      throw new Error(`Stage ${stage} failed: ${error}`);
    }
  }

  private async runStage(job: ProcessingJob, stage: ProcessingStage): Promise<void> {
    switch (stage) {
      case ProcessingStage.URL_PARSING:
        await this.sleep(100);
        break;
      
      case ProcessingStage.HIERARCHY_BUILDING:
        await this.sleep(200);
        break;
      
      case ProcessingStage.RELATIONSHIP_DETECTION:
        await this.sleep(150);
        break;
      
      case ProcessingStage.GAP_ANALYSIS:
        await this.sleep(100);
        break;
      
      case ProcessingStage.SIMILARITY_CALCULATION:
        await this.sleep(300);
        break;
      
      case ProcessingStage.VIEW_REFRESH:
        await this.sleep(50);
        break;
    }
  }

  private async updateJobProgress(jobId: string, processed: number, total: number): Promise<void> {
    const job = this.activeJobs.get(jobId) || this.completedJobs.get(jobId);
    if (!job) return;

    job.processedItems = processed;
    job.totalItems = total;
    job.progress = total > 0 ? (processed / total) * 100 : 0;

    await this.updateProgress(jobId);
  }

  private async updateProgress(jobId: string): Promise<void> {
    const job = this.activeJobs.get(jobId) || this.completedJobs.get(jobId);
    if (!job) return;

    const progress = this.calculateProgress(job);
    const callback = this.progressCallbacks.get(jobId);
    
    if (callback) {
      callback(progress);
    }
  }

  private calculateProgress(job: ProcessingJob): PipelineProgress {
    const completedStages = this.getCompletedStages(job.stage);
    const throughput = this.calculateThroughput(job);
    const estimatedTimeRemaining = this.estimateTimeRemaining(job, throughput);

    return {
      jobId: job.id,
      currentStage: job.stage,
      completedStages,
      itemsProcessed: job.processedItems,
      totalItems: job.totalItems,
      errors: job.error ? [job.error] : [],
      estimatedTimeRemaining,
      throughput,
    };
  }

  private getCompletedStages(currentStage: ProcessingStage): ProcessingStage[] {
    const stages = Object.values(ProcessingStage);
    const currentIndex = stages.indexOf(currentStage);
    return stages.slice(0, currentIndex);
  }

  private calculateThroughput(job: ProcessingJob): number {
    if (!job.startedAt || job.processedItems === 0) return 0;
    
    const elapsedMs = Date.now() - job.startedAt.getTime();
    const elapsedSeconds = elapsedMs / 1000;
    
    return job.processedItems / elapsedSeconds;
  }

  private estimateTimeRemaining(job: ProcessingJob, throughput: number): number {
    if (throughput === 0) return 0;
    
    const remainingItems = job.totalItems - job.processedItems;
    return remainingItems / throughput;
  }

  private async handleJobError(jobId: string, error: Error, stage: ProcessingStage): Promise<void> {
    const job = this.activeJobs.get(jobId);
    if (!job) return;

    const processingError: ProcessingError = {
      message: error.message,
      code: 'PROCESSING_ERROR',
      stage,
      timestamp: new Date(),
      details: error.stack,
    };

    job.error = processingError;
    job.status = JobStatus.FAILED;
    
    this.log(`Job ${jobId} failed at stage ${stage}: ${error.message}`);
  }

  async cancelJob(jobId: string): Promise<boolean> {
    const job = this.activeJobs.get(jobId) || this.queue.find(j => j.id === jobId);
    
    if (!job) return false;
    
    job.status = JobStatus.CANCELLED;
    
    if (this.queue.includes(job)) {
      const index = this.queue.indexOf(job);
      this.queue.splice(index, 1);
    }
    
    return true;
  }

  async retryJob(jobId: string): Promise<string> {
    const job = this.completedJobs.get(jobId);
    
    if (!job || job.status !== JobStatus.FAILED) {
      throw new Error(`Cannot retry job ${jobId}`);
    }

    const newJob: ProcessingJob = {
      ...job,
      id: this.generateJobId(),
      status: JobStatus.PENDING,
      stage: ProcessingStage.URL_PARSING,
      progress: 0,
      processedItems: 0,
      startedAt: undefined,
      completedAt: undefined,
      error: undefined,
    };

    this.queue.push(newJob);
    
    if (!this.isRunning) {
      this.start();
    }

    return newJob.id;
  }

  getJobStatus(jobId: string): ProcessingJob | null {
    return this.activeJobs.get(jobId) || 
           this.completedJobs.get(jobId) || 
           this.queue.find(j => j.id === jobId) || 
           null;
  }

  onProgress(jobId: string, callback: (progress: PipelineProgress) => void): void {
    this.progressCallbacks.set(jobId, callback);
  }

  removeProgressCallback(jobId: string): void {
    this.progressCallbacks.delete(jobId);
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    await Promise.all(this.workers);
    this.workers = [];
  }

  getQueueStats(): {
    pending: number;
    active: number;
    completed: number;
    failed: number;
  } {
    const pending = this.queue.filter(j => j.status === JobStatus.PENDING).length;
    const active = this.activeJobs.size;
    const completed = Array.from(this.completedJobs.values())
      .filter(j => j.status === JobStatus.COMPLETED).length;
    const failed = Array.from(this.completedJobs.values())
      .filter(j => j.status === JobStatus.FAILED).length;

    return { pending, active, completed, failed };
  }

  private generateJobId(): string {
    return `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private log(message: string): void {
    if (this.config.enableLogging) {
      console.log(`[ProcessingQueue] ${new Date().toISOString()} - ${message}`);
    }
  }
}