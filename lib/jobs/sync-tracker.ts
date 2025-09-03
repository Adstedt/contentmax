import { EventEmitter } from 'events';

export interface SyncProgress {
  jobId: string;
  projectId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  totalNodes: number;
  processedNodes: number;
  matchedNodes: number;
  unmatchedNodes: number;
  gscMetrics: number;
  ga4Metrics: number;
  errors: Array<{ source: string; message: string; timestamp: string }>;
  startedAt: string;
  completedAt?: string;
  duration?: number;
  percentage: number;
}

export interface SyncConfig {
  projectId: string;
  startDate: string;
  endDate: string;
  sources: ('gsc' | 'ga4')[];
  dryRun?: boolean;
  forceUpdate?: boolean;
  matchThreshold?: number;
}

export class MetricsSyncTracker extends EventEmitter {
  private progress: SyncProgress;
  private config: SyncConfig;

  constructor(jobId: string, config: SyncConfig) {
    super();
    this.config = config;
    this.progress = {
      jobId,
      projectId: config.projectId,
      status: 'pending',
      totalNodes: 0,
      processedNodes: 0,
      matchedNodes: 0,
      unmatchedNodes: 0,
      gscMetrics: 0,
      ga4Metrics: 0,
      errors: [],
      startedAt: new Date().toISOString(),
      percentage: 0,
    };
  }

  start(totalNodes: number): void {
    this.progress.status = 'running';
    this.progress.totalNodes = totalNodes;
    this.emit('start', this.progress);
  }

  updateProgress(updates: Partial<SyncProgress>): void {
    this.progress = {
      ...this.progress,
      ...updates,
    };

    // Calculate percentage
    if (this.progress.totalNodes > 0) {
      this.progress.percentage = Math.round(
        (this.progress.processedNodes / this.progress.totalNodes) * 100
      );
    }

    this.emit('progress', this.progress);
  }

  incrementProcessed(matched: boolean = true): void {
    this.progress.processedNodes++;
    if (matched) {
      this.progress.matchedNodes++;
    } else {
      this.progress.unmatchedNodes++;
    }
    
    this.updateProgress({
      processedNodes: this.progress.processedNodes,
      matchedNodes: this.progress.matchedNodes,
      unmatchedNodes: this.progress.unmatchedNodes,
    });
  }

  incrementGSC(): void {
    this.progress.gscMetrics++;
    this.updateProgress({ gscMetrics: this.progress.gscMetrics });
  }

  incrementGA4(): void {
    this.progress.ga4Metrics++;
    this.updateProgress({ ga4Metrics: this.progress.ga4Metrics });
  }

  addError(source: string, message: string): void {
    this.progress.errors.push({
      source,
      message,
      timestamp: new Date().toISOString(),
    });
    this.emit('error', { source, message });
  }

  complete(status: 'completed' | 'failed' = 'completed'): void {
    const completedAt = new Date().toISOString();
    const startedAt = new Date(this.progress.startedAt);
    const duration = Date.now() - startedAt.getTime();

    this.progress = {
      ...this.progress,
      status,
      completedAt,
      duration,
      percentage: status === 'completed' ? 100 : this.progress.percentage,
    };

    this.emit('complete', this.progress);
  }

  getProgress(): SyncProgress {
    return { ...this.progress };
  }

  getConfig(): SyncConfig {
    return { ...this.config };
  }

  getSummary(): string {
    const { 
      status, 
      totalNodes, 
      processedNodes, 
      matchedNodes, 
      unmatchedNodes,
      gscMetrics,
      ga4Metrics,
      errors,
      duration 
    } = this.progress;

    const lines = [
      `Sync Job ${this.progress.jobId}`,
      `Status: ${status}`,
      `Progress: ${processedNodes}/${totalNodes} nodes (${this.progress.percentage}%)`,
      `Matched: ${matchedNodes}, Unmatched: ${unmatchedNodes}`,
      `GSC Metrics: ${gscMetrics}, GA4 Metrics: ${ga4Metrics}`,
    ];

    if (errors.length > 0) {
      lines.push(`Errors: ${errors.length}`);
    }

    if (duration) {
      lines.push(`Duration: ${Math.round(duration / 1000)}s`);
    }

    return lines.join('\n');
  }
}

// Singleton manager for tracking multiple sync jobs
export class SyncJobManager {
  private static instance: SyncJobManager;
  private jobs: Map<string, MetricsSyncTracker> = new Map();

  static getInstance(): SyncJobManager {
    if (!SyncJobManager.instance) {
      SyncJobManager.instance = new SyncJobManager();
    }
    return SyncJobManager.instance;
  }

  createJob(jobId: string, config: SyncConfig): MetricsSyncTracker {
    const tracker = new MetricsSyncTracker(jobId, config);
    this.jobs.set(jobId, tracker);
    
    // Auto-cleanup after 1 hour
    setTimeout(() => {
      this.jobs.delete(jobId);
    }, 3600000);

    return tracker;
  }

  getJob(jobId: string): MetricsSyncTracker | undefined {
    return this.jobs.get(jobId);
  }

  getAllJobs(): Map<string, MetricsSyncTracker> {
    return new Map(this.jobs);
  }

  clearCompleted(): void {
    for (const [jobId, tracker] of this.jobs.entries()) {
      const progress = tracker.getProgress();
      if (progress.status === 'completed' || progress.status === 'failed') {
        this.jobs.delete(jobId);
      }
    }
  }
}

export const syncJobManager = SyncJobManager.getInstance();