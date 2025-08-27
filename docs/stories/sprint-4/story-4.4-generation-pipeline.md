# Story 4.4: Generation Pipeline & Queue Management

## User Story

As a content manager,
I want to generate content for multiple pages with proper queue management,
So that bulk operations are handled efficiently without overwhelming the system.

## Size & Priority

- **Size**: M (6 hours)
- **Priority**: P0 - Critical
- **Sprint**: 4
- **Dependencies**: Tasks 4.1-4.3

## Description

Build content generation pipeline orchestration with queue management, progress tracking, and job prioritization for both single and bulk generation.

## Implementation Steps

1. **Generation pipeline orchestrator**

   ```typescript
   interface PipelineStage {
     name: string;
     execute: (context: StageContext) => Promise<StageResult>;
     onError?: (error: Error, context: StageContext) => Promise<void>;
     canSkip?: (context: StageContext) => boolean;
   }

   class GenerationPipeline {
     private stages: PipelineStage[] = [];
     private hooks: PipelineHooks = {};

     constructor() {
       this.initializeStages();
     }

     private initializeStages() {
       this.stages = [
         {
           name: 'validation',
           execute: async (ctx) => this.validateInput(ctx),
           onError: async (err, ctx) => {
             await this.logError('Validation failed', err, ctx);
             throw err;
           },
         },
         {
           name: 'context-building',
           execute: async (ctx) => this.buildContext(ctx),
         },
         {
           name: 'component-generation',
           execute: async (ctx) => this.generateComponents(ctx),
         },
         {
           name: 'template-assembly',
           execute: async (ctx) => this.assembleTemplate(ctx),
         },
         {
           name: 'quality-validation',
           execute: async (ctx) => this.validateQuality(ctx),
           canSkip: (ctx) => ctx.options?.skipQualityCheck === true,
         },
         {
           name: 'post-processing',
           execute: async (ctx) => this.postProcess(ctx),
         },
         {
           name: 'storage',
           execute: async (ctx) => this.storeContent(ctx),
         },
       ];
     }

     async execute(job: GenerationJob): Promise<GenerationResult> {
       const context: PipelineContext = {
         job,
         stages: {},
         startTime: Date.now(),
         currentStage: null,
       };

       try {
         // Execute before hook
         if (this.hooks.beforePipeline) {
           await this.hooks.beforePipeline(context);
         }

         // Execute stages
         for (const stage of this.stages) {
           context.currentStage = stage.name;

           // Check if stage can be skipped
           if (stage.canSkip && stage.canSkip(context)) {
             context.stages[stage.name] = { skipped: true };
             continue;
           }

           // Execute stage with timing
           const stageStart = Date.now();

           try {
             const result = await stage.execute(context);
             context.stages[stage.name] = {
               result,
               duration: Date.now() - stageStart,
               success: true,
             };

             // Update progress
             await this.updateProgress(job.id, stage.name, 'completed');
           } catch (error) {
             context.stages[stage.name] = {
               error: error.message,
               duration: Date.now() - stageStart,
               success: false,
             };

             if (stage.onError) {
               await stage.onError(error as Error, context);
             } else {
               throw error;
             }
           }
         }

         // Execute after hook
         if (this.hooks.afterPipeline) {
           await this.hooks.afterPipeline(context);
         }

         return this.buildResult(context);
       } catch (error) {
         // Handle pipeline failure
         await this.handlePipelineError(error as Error, context);
         throw error;
       }
     }

     private async validateInput(context: StageContext): Promise<StageResult> {
       const { job } = context;

       // Validate required fields
       if (!job.pageType || !job.targetUrl) {
         throw new ValidationError('Missing required fields');
       }

       // Validate language
       if (!SUPPORTED_LANGUAGES.includes(job.language || 'en')) {
         throw new ValidationError(`Unsupported language: ${job.language}`);
       }

       return { valid: true };
     }

     private async buildContext(context: StageContext): Promise<StageResult> {
       const { job } = context;

       // Gather all necessary data
       const [competitorData, productData, seoData] = await Promise.all([
         this.fetchCompetitorData(job),
         this.fetchProductData(job),
         this.fetchSEOData(job),
       ]);

       return {
         context: {
           pageType: job.pageType,
           targetKeywords: job.keywords || [],
           brandVoice: job.brandVoice || DEFAULT_BRAND_VOICE,
           competitorData,
           productData,
           seoRequirements: seoData,
           language: job.language || 'en',
         },
       };
     }
   }
   ```

2. **Queue management system**

   ```typescript
   class GenerationQueue {
     private queues = new Map<Priority, Queue<GenerationJob>>();
     private processing = new Map<string, GenerationJob>();
     private workers: Worker[] = [];
     private maxConcurrency = 5;

     constructor(config: QueueConfig) {
       // Initialize priority queues
       this.queues.set(Priority.HIGH, new Queue());
       this.queues.set(Priority.NORMAL, new Queue());
       this.queues.set(Priority.LOW, new Queue());

       // Start workers
       for (let i = 0; i < config.workers; i++) {
         this.workers.push(new Worker(this));
       }
     }

     async enqueue(job: GenerationJob): Promise<string> {
       // Validate job
       this.validateJob(job);

       // Assign ID if not present
       if (!job.id) {
         job.id = generateId();
       }

       // Store in database
       await supabase.from('generation_queue').insert({
         id: job.id,
         project_id: job.projectId,
         status: 'pending',
         priority: job.priority || Priority.NORMAL,
         config: job,
         created_at: new Date(),
       });

       // Add to appropriate queue
       const queue = this.queues.get(job.priority || Priority.NORMAL)!;
       queue.enqueue(job);

       // Notify workers
       this.notifyWorkers();

       return job.id;
     }

     async enqueueBatch(jobs: GenerationJob[]): Promise<BatchResult> {
       const batchId = generateId();
       const results: string[] = [];

       // Create batch record
       await supabase.from('generation_batches').insert({
         id: batchId,
         total_jobs: jobs.length,
         status: 'processing',
         created_at: new Date(),
       });

       // Enqueue all jobs
       for (const job of jobs) {
         job.batchId = batchId;
         const jobId = await this.enqueue(job);
         results.push(jobId);
       }

       return {
         batchId,
         jobIds: results,
         total: jobs.length,
       };
     }

     private async processNext(): Promise<void> {
       // Check concurrency limit
       if (this.processing.size >= this.maxConcurrency) {
         return;
       }

       // Get next job from highest priority queue
       const job = this.getNextJob();
       if (!job) return;

       // Mark as processing
       this.processing.set(job.id, job);

       try {
         // Update status
         await this.updateJobStatus(job.id, 'processing');

         // Execute pipeline
         const pipeline = new GenerationPipeline();
         const result = await pipeline.execute(job);

         // Store result
         await this.storeResult(job.id, result);

         // Update status
         await this.updateJobStatus(job.id, 'completed');
       } catch (error) {
         // Handle failure
         await this.handleJobError(job, error as Error);
       } finally {
         // Remove from processing
         this.processing.delete(job.id);

         // Process next
         this.processNext();
       }
     }

     private getNextJob(): GenerationJob | null {
       // Check queues in priority order
       for (const priority of [Priority.HIGH, Priority.NORMAL, Priority.LOW]) {
         const queue = this.queues.get(priority)!;
         if (!queue.isEmpty()) {
           return queue.dequeue();
         }
       }
       return null;
     }

     async getJobStatus(jobId: string): Promise<JobStatus> {
       const { data } = await supabase
         .from('generation_queue')
         .select('*')
         .eq('id', jobId)
         .single();

       if (!data) {
         throw new Error(`Job ${jobId} not found`);
       }

       return {
         id: data.id,
         status: data.status,
         progress: data.progress,
         result: data.result,
         error: data.error,
         createdAt: data.created_at,
         startedAt: data.started_at,
         completedAt: data.completed_at,
       };
     }

     async getQueueStatus(): Promise<QueueStatus> {
       const stats = {
         pending: 0,
         processing: this.processing.size,
         high: this.queues.get(Priority.HIGH)!.size(),
         normal: this.queues.get(Priority.NORMAL)!.size(),
         low: this.queues.get(Priority.LOW)!.size(),
       };

       return {
         ...stats,
         total: stats.high + stats.normal + stats.low + stats.processing,
         workers: this.workers.length,
         maxConcurrency: this.maxConcurrency,
       };
     }
   }
   ```

3. **Progress tracking**

   ```typescript
   class ProgressTracker {
     private progress = new Map<string, JobProgress>();
     private subscribers = new Map<string, Set<ProgressSubscriber>>();

     async updateProgress(jobId: string, stage: string, status: StageStatus, metadata?: any) {
       const progress = this.progress.get(jobId) || {
         jobId,
         stages: {},
         currentStage: stage,
         percentage: 0,
       };

       // Update stage status
       progress.stages[stage] = {
         status,
         timestamp: new Date(),
         metadata,
       };

       // Calculate overall percentage
       progress.percentage = this.calculatePercentage(progress);
       progress.currentStage = stage;

       // Store in database
       await supabase
         .from('generation_queue')
         .update({
           progress: progress.percentage,
           current_stage: stage,
           stage_details: progress.stages,
         })
         .eq('id', jobId);

       // Notify subscribers
       this.notifySubscribers(jobId, progress);

       // Update in memory
       this.progress.set(jobId, progress);
     }

     private calculatePercentage(progress: JobProgress): number {
       const totalStages = PIPELINE_STAGES.length;
       const completedStages = Object.values(progress.stages).filter(
         (s) => s.status === 'completed'
       ).length;

       return Math.round((completedStages / totalStages) * 100);
     }

     subscribe(jobId: string, callback: (progress: JobProgress) => void): () => void {
       if (!this.subscribers.has(jobId)) {
         this.subscribers.set(jobId, new Set());
       }

       this.subscribers.get(jobId)!.add(callback);

       // Return unsubscribe function
       return () => {
         this.subscribers.get(jobId)?.delete(callback);
       };
     }

     private notifySubscribers(jobId: string, progress: JobProgress) {
       const subscribers = this.subscribers.get(jobId);
       if (subscribers) {
         subscribers.forEach((callback) => callback(progress));
       }
     }

     // Real-time updates via Supabase
     setupRealtimeUpdates(jobId: string) {
       return supabase
         .channel(`job:${jobId}`)
         .on(
           'postgres_changes',
           {
             event: 'UPDATE',
             schema: 'public',
             table: 'generation_queue',
             filter: `id=eq.${jobId}`,
           },
           (payload) => {
             const progress = {
               jobId,
               percentage: payload.new.progress,
               currentStage: payload.new.current_stage,
               stages: payload.new.stage_details,
             };

             this.notifySubscribers(jobId, progress);
           }
         )
         .subscribe();
     }
   }
   ```

4. **Job prioritization**

   ```typescript
   class JobPrioritizer {
     calculatePriority(job: GenerationJob): Priority {
       let score = 0;

       // User-specified priority
       if (job.priority) {
         return job.priority;
       }

       // Calculate based on factors

       // Page importance
       if (job.metadata?.skuCount > 1000) score += 30;
       else if (job.metadata?.skuCount > 100) score += 20;
       else score += 10;

       // Traffic potential
       if (job.metadata?.monthlySearches > 10000) score += 30;
       else if (job.metadata?.monthlySearches > 1000) score += 20;
       else score += 10;

       // Content status
       if (job.metadata?.contentStatus === 'missing') score += 20;
       else if (job.metadata?.contentStatus === 'outdated') score += 10;

       // Time sensitivity
       if (job.deadline) {
         const hoursUntilDeadline = (job.deadline.getTime() - Date.now()) / (1000 * 60 * 60);

         if (hoursUntilDeadline < 24) score += 30;
         else if (hoursUntilDeadline < 72) score += 20;
       }

       // Map score to priority
       if (score >= 70) return Priority.HIGH;
       if (score >= 40) return Priority.NORMAL;
       return Priority.LOW;
     }

     reorderQueue(jobs: GenerationJob[]): GenerationJob[] {
       return jobs.sort((a, b) => {
         // First by priority
         const priorityDiff = this.getPriorityValue(b.priority) - this.getPriorityValue(a.priority);
         if (priorityDiff !== 0) return priorityDiff;

         // Then by score
         const scoreA = this.calculateScore(a);
         const scoreB = this.calculateScore(b);
         return scoreB - scoreA;
       });
     }

     private getPriorityValue(priority?: Priority): number {
       switch (priority) {
         case Priority.HIGH:
           return 3;
         case Priority.NORMAL:
           return 2;
         case Priority.LOW:
           return 1;
         default:
           return 0;
       }
     }
   }
   ```

5. **Generation UI integration**
   ```typescript
   // app/generate/page.tsx
   const GenerationPage: React.FC = () => {
     const [jobs, setJobs] = useState<GenerationJob[]>([]);
     const [queueStatus, setQueueStatus] = useState<QueueStatus>();
     const progressTracker = useRef(new ProgressTracker());

     const submitGeneration = async (config: GenerationConfig) => {
       const job: GenerationJob = {
         pageType: config.pageType,
         targetUrl: config.url,
         keywords: config.keywords,
         language: config.language,
         brandVoice: config.brandVoice,
         priority: config.priority
       };

       const jobId = await generationQueue.enqueue(job);

       // Subscribe to progress updates
       progressTracker.current.setupRealtimeUpdates(jobId);
       progressTracker.current.subscribe(jobId, (progress) => {
         updateJobProgress(jobId, progress);
       });

       // Add to local state
       setJobs([...jobs, { ...job, id: jobId }]);
     };

     const submitBulkGeneration = async (configs: GenerationConfig[]) => {
       const batchJobs = configs.map(config => ({
         pageType: config.pageType,
         targetUrl: config.url,
         keywords: config.keywords,
         language: config.language
       }));

       const result = await generationQueue.enqueueBatch(batchJobs);

       // Subscribe to all job progress
       result.jobIds.forEach(jobId => {
         progressTracker.current.setupRealtimeUpdates(jobId);
       });
     };

     return (
       <div className="generation-page">
         <GenerationForm onSubmit={submitGeneration} />
         <QueueStatusDisplay status={queueStatus} />
         <JobList jobs={jobs} />
       </div>
     );
   };
   ```

## Files to Create

- `lib/generation/pipeline.ts` - Pipeline orchestration
- `lib/generation/queue-manager.ts` - Queue management system
- `lib/generation/progress-tracker.ts` - Progress tracking
- `lib/generation/job-prioritizer.ts` - Priority calculation
- `lib/generation/worker.ts` - Queue worker implementation
- `app/generate/page.tsx` - Generation UI page
- `components/generation/GenerationForm.tsx` - Form component
- `components/generation/QueueStatus.tsx` - Queue status display
- `components/generation/JobProgress.tsx` - Progress visualization
- `types/generation.types.ts` - TypeScript interfaces

## Pipeline Stages

1. **Validation** - Input validation
2. **Context Building** - Gather required data
3. **Component Generation** - Generate each component
4. **Template Assembly** - Combine components
5. **Quality Validation** - Check output quality
6. **Post-processing** - Final formatting
7. **Storage** - Save to database

## Queue Configuration

```typescript
interface QueueConfig {
  workers: number; // Concurrent workers (default: 3)
  maxConcurrency: number; // Max parallel jobs (default: 5)
  retryAttempts: number; // Retry failed jobs (default: 3)
  retryDelay: number; // Delay between retries (default: 5000ms)
  timeout: number; // Job timeout (default: 300000ms)
  priorityBoost: boolean; // Allow priority changes (default: true)
}
```

## Acceptance Criteria

- [ ] Pipeline executes all stages sequentially
- [ ] Queue manages job prioritization
- [ ] Progress tracking updates in real-time
- [ ] Batch generation handles multiple jobs
- [ ] Failed jobs retry appropriately
- [ ] Resource limits enforced
- [ ] UI shows queue status and progress
- [ ] Priority calculation working correctly

## Performance Requirements

- Handle 100+ jobs in queue
- Process 10 jobs concurrently
- Complete single generation in <30 seconds
- Real-time progress updates <1 second delay
- Queue operations <100ms

## Testing Requirements

- [ ] Test pipeline stage execution
- [ ] Test queue prioritization
- [ ] Test concurrent job processing
- [ ] Test failure and retry logic
- [ ] Test progress tracking accuracy
- [ ] Test resource limiting
- [ ] Test real-time updates
- [ ] Load test with 100+ jobs

## Definition of Done

- [ ] Code complete and committed
- [ ] Pipeline orchestration working
- [ ] Queue system functional
- [ ] Progress tracking real-time
- [ ] Priority system implemented
- [ ] UI integrated
- [ ] Tests written and passing
- [ ] Documentation complete
- [ ] Peer review completed
