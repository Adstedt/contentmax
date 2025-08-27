# Story 5.3: Parallel Generation System

## User Story

As a content manager processing bulk requests,
I want parallel content generation capabilities,
So that I can generate multiple pieces of content simultaneously and reduce wait times.

## Size & Priority

- **Size**: L (8 hours)
- **Priority**: P0 - Critical
- **Sprint**: 5
- **Dependencies**: Tasks 4.3, 4.4

## Description

Build a robust parallel generation system with queue management, rate limiting, progress tracking, and error handling for processing multiple content generation requests concurrently.

## Implementation Steps

1. **Queue management system**

   ```typescript
   interface QueueItem {
     id: string;
     type: 'product' | 'category' | 'brand' | 'inspire' | 'engage';
     priority: number;
     data: ContentGenerationRequest;
     status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
     retryCount: number;
     createdAt: Date;
     startedAt?: Date;
     completedAt?: Date;
     error?: string;
     result?: GeneratedContent;
   }

   class GenerationQueue {
     private queue: PriorityQueue<QueueItem>;
     private processing = new Map<string, QueueItem>();
     private completed = new Map<string, QueueItem>();
     private workers: Worker[] = [];
     private maxConcurrent: number;
     private rateLimiter: RateLimiter;

     constructor(config: QueueConfig) {
       this.maxConcurrent = config.maxConcurrent || 5;
       this.queue = new PriorityQueue((a, b) => b.priority - a.priority);
       this.rateLimiter = new RateLimiter({
         maxRequests: config.maxRequestsPerMinute || 20,
         windowMs: 60000,
       });

       this.initializeWorkers();
     }

     private initializeWorkers() {
       for (let i = 0; i < this.maxConcurrent; i++) {
         const worker = new GenerationWorker(i);
         worker.on('complete', this.handleWorkerComplete.bind(this));
         worker.on('error', this.handleWorkerError.bind(this));
         this.workers.push(worker);
       }
     }

     async addToQueue(request: ContentGenerationRequest, priority = 5): Promise<string> {
       const item: QueueItem = {
         id: generateId(),
         type: request.pageType,
         priority,
         data: request,
         status: 'pending',
         retryCount: 0,
         createdAt: new Date(),
       };

       this.queue.enqueue(item);
       this.emit('itemAdded', item);

       // Process queue if workers available
       this.processQueue();

       return item.id;
     }

     async addBatch(requests: ContentGenerationRequest[], priority = 5): Promise<string[]> {
       const ids = await Promise.all(requests.map((req) => this.addToQueue(req, priority)));

       this.emit('batchAdded', { count: requests.length, ids });
       return ids;
     }

     private async processQueue() {
       // Check for available workers
       const availableWorkers = this.workers.filter((w) => !w.isBusy());

       while (availableWorkers.length > 0 && this.queue.size() > 0) {
         // Check rate limit
         if (!(await this.rateLimiter.canProceed())) {
           setTimeout(() => this.processQueue(), 1000);
           return;
         }

         const worker = availableWorkers.pop()!;
         const item = this.queue.dequeue()!;

         item.status = 'processing';
         item.startedAt = new Date();
         this.processing.set(item.id, item);

         this.emit('itemStarted', item);
         worker.process(item);
       }
     }

     private handleWorkerComplete(workerId: number, itemId: string, result: GeneratedContent) {
       const item = this.processing.get(itemId);
       if (!item) return;

       item.status = 'completed';
       item.completedAt = new Date();
       item.result = result;

       this.processing.delete(itemId);
       this.completed.set(itemId, item);

       this.emit('itemCompleted', item);

       // Store result
       this.storeResult(item);

       // Process next item
       this.processQueue();
     }

     private handleWorkerError(workerId: number, itemId: string, error: Error) {
       const item = this.processing.get(itemId);
       if (!item) return;

       item.retryCount++;

       if (item.retryCount < 3) {
         // Retry with exponential backoff
         item.status = 'pending';
         item.priority -= 1; // Slightly lower priority on retry
         this.processing.delete(itemId);

         setTimeout(
           () => {
             this.queue.enqueue(item);
             this.processQueue();
           },
           Math.pow(2, item.retryCount) * 1000
         );

         this.emit('itemRetrying', item);
       } else {
         // Mark as failed after max retries
         item.status = 'failed';
         item.error = error.message;
         item.completedAt = new Date();

         this.processing.delete(itemId);
         this.completed.set(itemId, item);

         this.emit('itemFailed', item);
       }

       // Process next item
       this.processQueue();
     }

     cancelItem(itemId: string): boolean {
       // Check if in queue
       const queueIndex = this.queue.findIndex((item) => item.id === itemId);
       if (queueIndex !== -1) {
         const item = this.queue.removeAt(queueIndex);
         item.status = 'cancelled';
         this.emit('itemCancelled', item);
         return true;
       }

       // Check if processing
       const processingItem = this.processing.get(itemId);
       if (processingItem) {
         // Signal worker to cancel
         const worker = this.workers.find((w) => w.getCurrentItemId() === itemId);
         if (worker) {
           worker.cancel();
           return true;
         }
       }

       return false;
     }

     getStatus(): QueueStatus {
       return {
         pending: this.queue.size(),
         processing: this.processing.size,
         completed: this.completed.size,
         workers: this.workers.map((w) => ({
           id: w.id,
           busy: w.isBusy(),
           currentItem: w.getCurrentItemId(),
         })),
         throughput: this.calculateThroughput(),
       };
     }

     private calculateThroughput(): number {
       const recentCompleted = Array.from(this.completed.values()).filter((item) => {
         const age = Date.now() - item.completedAt!.getTime();
         return age < 60000; // Last minute
       });

       return recentCompleted.length;
     }
   }
   ```

2. **Generation worker implementation**

   ```typescript
   class GenerationWorker extends EventEmitter {
     private id: number;
     private busy = false;
     private currentItem: QueueItem | null = null;
     private abortController: AbortController | null = null;
     private openAIClient: OpenAIClient;
     private contentGenerator: ContentGenerator;

     constructor(id: number) {
       super();
       this.id = id;
       this.openAIClient = new OpenAIClient(getOpenAIConfig());
       this.contentGenerator = new ContentGenerator(this.openAIClient);
     }

     async process(item: QueueItem) {
       this.busy = true;
       this.currentItem = item;
       this.abortController = new AbortController();

       try {
         // Generate content with abort signal
         const result = await this.contentGenerator.generate(item.data, {
           signal: this.abortController.signal,
         });

         // Check if cancelled
         if (this.abortController.signal.aborted) {
           throw new Error('Generation cancelled');
         }

         this.emit('complete', this.id, item.id, result);
       } catch (error) {
         this.emit('error', this.id, item.id, error);
       } finally {
         this.busy = false;
         this.currentItem = null;
         this.abortController = null;
       }
     }

     cancel() {
       if (this.abortController) {
         this.abortController.abort();
       }
     }

     isBusy(): boolean {
       return this.busy;
     }

     getCurrentItemId(): string | null {
       return this.currentItem?.id || null;
     }
   }
   ```

3. **Rate limiting and throttling**

   ```typescript
   class RateLimiter {
     private requests: number[] = [];
     private maxRequests: number;
     private windowMs: number;

     constructor(config: RateLimiterConfig) {
       this.maxRequests = config.maxRequests;
       this.windowMs = config.windowMs;
     }

     async canProceed(): Promise<boolean> {
       this.cleanup();

       if (this.requests.length >= this.maxRequests) {
         return false;
       }

       this.requests.push(Date.now());
       return true;
     }

     private cleanup() {
       const cutoff = Date.now() - this.windowMs;
       this.requests = this.requests.filter((time) => time > cutoff);
     }

     getUtilization(): number {
       this.cleanup();
       return this.requests.length / this.maxRequests;
     }

     getTimeUntilNext(): number {
       this.cleanup();

       if (this.requests.length < this.maxRequests) {
         return 0;
       }

       const oldest = Math.min(...this.requests);
       return Math.max(0, oldest + this.windowMs - Date.now());
     }
   }

   class AdaptiveRateLimiter extends RateLimiter {
     private errorRate = 0;
     private successRate = 1;
     private adjustmentFactor = 0.1;

     async canProceed(): Promise<boolean> {
       // Adjust rate based on error rate
       const adjustedMax = Math.floor(
         this.maxRequests * (1 - this.errorRate * this.adjustmentFactor)
       );

       this.maxRequests = Math.max(1, adjustedMax);
       return super.canProceed();
     }

     recordSuccess() {
       this.successRate = this.successRate * 0.9 + 0.1;
       this.errorRate = this.errorRate * 0.9;
     }

     recordError() {
       this.errorRate = this.errorRate * 0.9 + 0.1;
       this.successRate = this.successRate * 0.9;
     }
   }
   ```

4. **Progress tracking system**

   ```typescript
   class ProgressTracker {
     private items = new Map<string, ProgressItem>();
     private listeners = new Map<string, ProgressListener[]>();

     startTracking(itemId: string, totalSteps: number) {
       this.items.set(itemId, {
         id: itemId,
         totalSteps,
         completedSteps: 0,
         currentStep: '',
         startTime: Date.now(),
         estimatedTimeRemaining: null,
         status: 'in-progress',
         details: {},
       });

       this.notifyListeners(itemId);
     }

     updateProgress(itemId: string, completedSteps: number, currentStep: string, details?: any) {
       const item = this.items.get(itemId);
       if (!item) return;

       item.completedSteps = completedSteps;
       item.currentStep = currentStep;
       item.details = { ...item.details, ...details };

       // Calculate estimated time remaining
       const elapsed = Date.now() - item.startTime;
       const percentComplete = completedSteps / item.totalSteps;
       if (percentComplete > 0) {
         const totalEstimated = elapsed / percentComplete;
         item.estimatedTimeRemaining = totalEstimated - elapsed;
       }

       this.notifyListeners(itemId);
     }

     completeItem(itemId: string, result?: any) {
       const item = this.items.get(itemId);
       if (!item) return;

       item.status = 'completed';
       item.completedSteps = item.totalSteps;
       item.estimatedTimeRemaining = 0;
       item.completionTime = Date.now();
       item.result = result;

       this.notifyListeners(itemId);

       // Clean up after delay
       setTimeout(() => this.items.delete(itemId), 60000);
     }

     failItem(itemId: string, error: string) {
       const item = this.items.get(itemId);
       if (!item) return;

       item.status = 'failed';
       item.error = error;
       item.completionTime = Date.now();

       this.notifyListeners(itemId);
     }

     subscribe(itemId: string, listener: ProgressListener) {
       if (!this.listeners.has(itemId)) {
         this.listeners.set(itemId, []);
       }
       this.listeners.get(itemId)!.push(listener);

       // Send current state
       const item = this.items.get(itemId);
       if (item) {
         listener(item);
       }
     }

     unsubscribe(itemId: string, listener: ProgressListener) {
       const listeners = this.listeners.get(itemId);
       if (listeners) {
         const index = listeners.indexOf(listener);
         if (index !== -1) {
           listeners.splice(index, 1);
         }
       }
     }

     private notifyListeners(itemId: string) {
       const item = this.items.get(itemId);
       const listeners = this.listeners.get(itemId);

       if (item && listeners) {
         listeners.forEach((listener) => listener(item));
       }
     }

     getBatchProgress(itemIds: string[]): BatchProgress {
       const items = itemIds.map((id) => this.items.get(id)).filter(Boolean) as ProgressItem[];

       const completed = items.filter((i) => i.status === 'completed').length;
       const failed = items.filter((i) => i.status === 'failed').length;
       const inProgress = items.filter((i) => i.status === 'in-progress').length;

       const totalSteps = items.reduce((sum, i) => sum + i.totalSteps, 0);
       const completedSteps = items.reduce((sum, i) => sum + i.completedSteps, 0);

       return {
         total: itemIds.length,
         completed,
         failed,
         inProgress,
         percentComplete: totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0,
         estimatedTimeRemaining: this.estimateBatchTimeRemaining(items),
       };
     }

     private estimateBatchTimeRemaining(items: ProgressItem[]): number {
       const inProgressItems = items.filter((i) => i.status === 'in-progress');
       if (inProgressItems.length === 0) return 0;

       const estimates = inProgressItems
         .map((i) => i.estimatedTimeRemaining)
         .filter((e) => e !== null) as number[];

       if (estimates.length === 0) return -1;

       // Return max estimate (pessimistic)
       return Math.max(...estimates);
     }
   }
   ```

5. **Parallel generation UI**
   ```tsx
   const ParallelGenerationPanel: React.FC = () => {
     const [queueStatus, setQueueStatus] = useState<QueueStatus>();
     const [activeItems, setActiveItems] = useState<ProgressItem[]>([]);
     const [completedItems, setCompletedItems] = useState<QueueItem[]>([]);
     const queue = useRef<GenerationQueue>();
     const tracker = useRef<ProgressTracker>();

     useEffect(() => {
       queue.current = new GenerationQueue({
         maxConcurrent: 5,
         maxRequestsPerMinute: 20,
       });

       tracker.current = new ProgressTracker();

       // Set up event listeners
       queue.current.on('itemStarted', (item: QueueItem) => {
         tracker.current?.startTracking(item.id, 10);
       });

       queue.current.on('itemCompleted', (item: QueueItem) => {
         tracker.current?.completeItem(item.id, item.result);
         setCompletedItems((prev) => [...prev, item].slice(-50));
       });

       // Poll status
       const interval = setInterval(() => {
         setQueueStatus(queue.current?.getStatus());
       }, 1000);

       return () => clearInterval(interval);
     }, []);

     const handleBulkGenerate = async (items: ContentItem[]) => {
       const requests = items.map((item) => ({
         pageType: item.type,
         targetKeywords: item.keywords,
         components: getDefaultComponents(item.type),
         brandVoice: getBrandVoice(),
         language: 'en',
       }));

       const ids = await queue.current!.addBatch(requests);

       // Subscribe to progress updates
       ids.forEach((id) => {
         tracker.current!.subscribe(id, (progress) => {
           setActiveItems((prev) => {
             const updated = [...prev];
             const index = updated.findIndex((p) => p.id === id);
             if (index !== -1) {
               updated[index] = progress;
             } else {
               updated.push(progress);
             }
             return updated.filter((p) => p.status === 'in-progress');
           });
         });
       });
     };

     return (
       <div className="parallel-generation-panel">
         <div className="queue-overview">
           <h3>Generation Queue</h3>
           <div className="queue-stats">
             <div className="stat">
               <span className="label">Pending:</span>
               <span className="value">{queueStatus?.pending || 0}</span>
             </div>
             <div className="stat">
               <span className="label">Processing:</span>
               <span className="value">{queueStatus?.processing || 0}</span>
             </div>
             <div className="stat">
               <span className="label">Completed:</span>
               <span className="value">{queueStatus?.completed || 0}</span>
             </div>
             <div className="stat">
               <span className="label">Throughput:</span>
               <span className="value">{queueStatus?.throughput || 0}/min</span>
             </div>
           </div>
         </div>

         <div className="worker-status">
           <h4>Workers</h4>
           <div className="worker-grid">
             {queueStatus?.workers.map((worker) => (
               <div key={worker.id} className={`worker ${worker.busy ? 'busy' : 'idle'}`}>
                 <span className="worker-id">Worker {worker.id}</span>
                 <span className="worker-status">{worker.busy ? 'Processing' : 'Idle'}</span>
               </div>
             ))}
           </div>
         </div>

         <div className="active-generations">
           <h4>Active Generations</h4>
           {activeItems.map((item) => (
             <div key={item.id} className="progress-item">
               <div className="progress-header">
                 <span className="item-id">{item.id.substring(0, 8)}</span>
                 <span className="current-step">{item.currentStep}</span>
               </div>
               <div className="progress-bar">
                 <div
                   className="progress-fill"
                   style={{ width: `${(item.completedSteps / item.totalSteps) * 100}%` }}
                 />
               </div>
               <div className="progress-footer">
                 <span className="progress-percent">
                   {Math.round((item.completedSteps / item.totalSteps) * 100)}%
                 </span>
                 <span className="time-remaining">
                   {item.estimatedTimeRemaining
                     ? `${Math.ceil(item.estimatedTimeRemaining / 1000)}s remaining`
                     : 'Calculating...'}
                 </span>
               </div>
             </div>
           ))}
         </div>

         <div className="completed-items">
           <h4>Recently Completed</h4>
           <div className="completed-list">
             {completedItems
               .slice(-10)
               .reverse()
               .map((item) => (
                 <div key={item.id} className={`completed-item ${item.status}`}>
                   <span className="item-type">{item.type}</span>
                   <span className="item-time">
                     {formatDuration(item.completedAt!.getTime() - item.startedAt!.getTime())}
                   </span>
                   <span className={`item-status ${item.status}`}>{item.status}</span>
                 </div>
               ))}
           </div>
         </div>
       </div>
     );
   };
   ```

## Files to Create

- `lib/generation/queue/GenerationQueue.ts` - Main queue manager
- `lib/generation/queue/GenerationWorker.ts` - Worker implementation
- `lib/generation/queue/RateLimiter.ts` - Rate limiting logic
- `lib/generation/queue/ProgressTracker.ts` - Progress tracking
- `lib/generation/queue/PriorityQueue.ts` - Priority queue data structure
- `components/generation/ParallelGenerationPanel.tsx` - UI component
- `components/generation/QueueStatus.tsx` - Queue status display
- `components/generation/ProgressIndicator.tsx` - Progress UI
- `types/queue.types.ts` - Queue TypeScript types

## Acceptance Criteria

- [ ] Queue processes items by priority
- [ ] Parallel processing with configurable workers
- [ ] Rate limiting prevents API overload
- [ ] Progress tracking for each item
- [ ] Retry logic for failed items
- [ ] Cancellation support
- [ ] Real-time status updates
- [ ] Batch operations supported

## Performance Targets

- Support 100+ items in queue
- 5 concurrent generations
- < 100ms queue operation latency
- Progress updates every second
- Automatic retry with backoff

## Testing Requirements

- [ ] Test queue priority ordering
- [ ] Test concurrent processing limits
- [ ] Test rate limiting enforcement
- [ ] Test retry logic
- [ ] Test cancellation handling
- [ ] Test progress tracking accuracy
- [ ] Test error handling
- [ ] Load test with 1000 items

## Definition of Done

- [ ] Code complete and committed
- [ ] Queue system operational
- [ ] Workers processing in parallel
- [ ] Rate limiting functional
- [ ] Progress tracking accurate
- [ ] UI showing real-time updates
- [ ] Tests written and passing
- [ ] Documentation complete
- [ ] Peer review completed
