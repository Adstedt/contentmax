# TASK-012: Bulk Processing Pipeline

## Overview

**Priority**: P1 - Critical  
**Estimate**: 3 hours  
**Owner**: Backend Developer  
**Dependencies**: TASK-010 (Opportunity Scoring), TASK-011 (Revenue Calculator)  
**Status**: Not Started

## Problem Statement

We need a robust bulk processing pipeline that can handle scoring and revenue calculations for 3000+ nodes efficiently. The system must support queue-based processing, progress tracking, and graceful error handling to ensure all nodes are processed even during failures.

## Technical Requirements

### 1. Queue-Based Processing System

#### File: `lib/processing/queue-processor.ts`

```typescript
import { createClient } from '@/lib/supabase/server';
import { OpportunityScorer } from '@/lib/scoring/opportunity-scorer';
import { RevenueCalculator } from '@/lib/revenue/revenue-calculator';

export interface ProcessingJob {
  id: string;
  type: 'scoring' | 'revenue' | 'full_analysis';
  projectId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  totalItems: number;
  processedItems: number;
  errors: ProcessingError[];
  result?: any;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

export interface ProcessingError {
  nodeId: string;
  error: string;
  timestamp: Date;
  retryCount: number;
}

export interface QueueOptions {
  batchSize: number;
  maxRetries: number;
  retryDelay: number;
  concurrency: number;
  timeout: number;
}

/**
 * QueueProcessor - Manages bulk processing jobs
 */
export class QueueProcessor {
  private readonly defaultOptions: QueueOptions = {
    batchSize: 100,
    maxRetries: 3,
    retryDelay: 1000,
    concurrency: 5,
    timeout: 300000, // 5 minutes
  };

  private scorer: OpportunityScorer;
  private calculator: RevenueCalculator;
  private activeJobs: Map<string, ProcessingJob> = new Map();

  constructor() {
    this.scorer = new OpportunityScorer();
    this.calculator = new RevenueCalculator();
  }

  /**
   * Create and queue a new processing job
   */
  async createJob(
    type: ProcessingJob['type'],
    projectId: string,
    options?: Partial<QueueOptions>
  ): Promise<ProcessingJob> {
    const job: ProcessingJob = {
      id: crypto.randomUUID(),
      type,
      projectId,
      status: 'pending',
      progress: 0,
      totalItems: 0,
      processedItems: 0,
      errors: [],
      createdAt: new Date(),
    };

    // Store job in database
    await this.storeJob(job);

    // Add to active jobs
    this.activeJobs.set(job.id, job);

    // Start processing asynchronously
    this.processJob(job, { ...this.defaultOptions, ...options });

    return job;
  }

  /**
   * Process a job asynchronously
   */
  private async processJob(job: ProcessingJob, options: QueueOptions): Promise<void> {
    try {
      // Update job status
      job.status = 'processing';
      job.startedAt = new Date();
      await this.updateJob(job);

      // Fetch nodes to process
      const nodes = await this.fetchProjectNodes(job.projectId);
      job.totalItems = nodes.length;

      // Create batches
      const batches = this.createBatches(nodes, options.batchSize);

      // Process batches with concurrency control
      const results = await this.processBatches(batches, job, options);

      // Update job with results
      job.status = 'completed';
      job.completedAt = new Date();
      job.progress = 100;
      job.result = this.aggregateResults(results);

      await this.updateJob(job);
    } catch (error) {
      job.status = 'failed';
      job.errors.push({
        nodeId: 'job',
        error: error.message,
        timestamp: new Date(),
        retryCount: 0,
      });

      await this.updateJob(job);
    } finally {
      this.activeJobs.delete(job.id);
    }
  }

  /**
   * Process batches with concurrency control
   */
  private async processBatches(
    batches: any[][],
    job: ProcessingJob,
    options: QueueOptions
  ): Promise<any[]> {
    const results = [];
    const semaphore = new Semaphore(options.concurrency);

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];

      await semaphore.acquire();

      const batchPromise = this.processBatch(batch, job, options)
        .then((result) => {
          results.push(result);
          job.processedItems += batch.length;
          job.progress = Math.round((job.processedItems / job.totalItems) * 100);

          // Update progress in real-time
          this.updateJobProgress(job);
        })
        .catch((error) => {
          // Log batch error but continue processing
          console.error(`Batch ${i} failed:`, error);

          // Record errors for individual items
          batch.forEach((node) => {
            job.errors.push({
              nodeId: node.id,
              error: error.message,
              timestamp: new Date(),
              retryCount: 0,
            });
          });
        })
        .finally(() => {
          semaphore.release();
        });

      // Don't await here to allow concurrent processing
      if ((i + 1) % options.concurrency === 0) {
        await Promise.race([batchPromise]);
      }
    }

    // Wait for all remaining batches
    await semaphore.drain();

    return results;
  }

  /**
   * Process a single batch
   */
  private async processBatch(
    nodes: any[],
    job: ProcessingJob,
    options: QueueOptions
  ): Promise<any> {
    const timeout = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Batch timeout')), options.timeout);
    });

    const processing = (async () => {
      switch (job.type) {
        case 'scoring':
          return await this.processScoringBatch(nodes);

        case 'revenue':
          return await this.processRevenueBatch(nodes);

        case 'full_analysis':
          return await this.processFullAnalysisBatch(nodes);

        default:
          throw new Error(`Unknown job type: ${job.type}`);
      }
    })();

    return Promise.race([processing, timeout]);
  }

  /**
   * Process scoring batch
   */
  private async processScoringBatch(nodes: any[]): Promise<any> {
    const scores = await Promise.allSettled(nodes.map((node) => this.scorer.calculateScore(node)));

    return scores.map((result, index) => ({
      nodeId: nodes[index].id,
      status: result.status,
      data: result.status === 'fulfilled' ? result.value : null,
      error: result.status === 'rejected' ? result.reason : null,
    }));
  }

  /**
   * Process revenue batch
   */
  private async processRevenueBatch(nodes: any[]): Promise<any> {
    const projections = await Promise.allSettled(
      nodes.map((node) => this.calculator.calculateProjection(node))
    );

    return projections.map((result, index) => ({
      nodeId: nodes[index].id,
      status: result.status,
      data: result.status === 'fulfilled' ? result.value : null,
      error: result.status === 'rejected' ? result.reason : null,
    }));
  }

  /**
   * Process full analysis batch (scoring + revenue)
   */
  private async processFullAnalysisBatch(nodes: any[]): Promise<any> {
    const analyses = await Promise.allSettled(
      nodes.map(async (node) => {
        const score = await this.scorer.calculateScore(node);
        const projection = await this.calculator.calculateProjection(node);

        return {
          nodeId: node.id,
          score,
          projection,
          combinedValue: this.calculateCombinedValue(score, projection),
        };
      })
    );

    return analyses.map((result, index) => ({
      nodeId: nodes[index].id,
      status: result.status,
      data: result.status === 'fulfilled' ? result.value : null,
      error: result.status === 'rejected' ? result.reason : null,
    }));
  }

  /**
   * Calculate combined opportunity value
   */
  private calculateCombinedValue(score: any, projection: any): number {
    const scoreValue = score.score / 100;
    const revenueValue = Math.min(1, projection.projectedLift / 100000);
    const confidence = (score.confidence + projection.confidence) / 2;

    return (scoreValue * 0.4 + revenueValue * 0.6) * confidence * 100;
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string): Promise<ProcessingJob | null> {
    // Check active jobs first
    if (this.activeJobs.has(jobId)) {
      return this.activeJobs.get(jobId);
    }

    // Otherwise fetch from database
    return await this.fetchJob(jobId);
  }

  /**
   * Cancel a running job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    const job = this.activeJobs.get(jobId);

    if (!job || job.status !== 'processing') {
      return false;
    }

    job.status = 'failed';
    job.errors.push({
      nodeId: 'job',
      error: 'Job cancelled by user',
      timestamp: new Date(),
      retryCount: 0,
    });

    await this.updateJob(job);
    this.activeJobs.delete(jobId);

    return true;
  }

  /**
   * Retry failed items in a job
   */
  async retryFailedItems(jobId: string): Promise<ProcessingJob> {
    const originalJob = await this.fetchJob(jobId);

    if (!originalJob || originalJob.errors.length === 0) {
      throw new Error('No failed items to retry');
    }

    // Get unique failed node IDs
    const failedNodeIds = [...new Set(originalJob.errors.map((e) => e.nodeId))];

    // Create new job for failed items only
    const retryJob = await this.createJob(originalJob.type, originalJob.projectId, {
      batchSize: 50, // Smaller batches for retries
      maxRetries: 5, // More retry attempts
    });

    // Override nodes to process
    retryJob.result = { retryForJob: jobId, nodeIds: failedNodeIds };

    return retryJob;
  }

  /**
   * Helper methods
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];

    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }

    return batches;
  }

  private async fetchProjectNodes(projectId: string): Promise<any[]> {
    const supabase = await createClient();

    const { data } = await supabase
      .from('taxonomy_nodes')
      .select('*')
      .eq('project_id', projectId)
      .order('depth', { ascending: true });

    return data || [];
  }

  private async storeJob(job: ProcessingJob): Promise<void> {
    const supabase = await createClient();

    await supabase.from('processing_jobs').insert(job);
  }

  private async updateJob(job: ProcessingJob): Promise<void> {
    const supabase = await createClient();

    await supabase.from('processing_jobs').update(job).eq('id', job.id);
  }

  private async updateJobProgress(job: ProcessingJob): Promise<void> {
    const supabase = await createClient();

    await supabase
      .from('processing_jobs')
      .update({
        progress: job.progress,
        processedItems: job.processedItems,
      })
      .eq('id', job.id);
  }

  private async fetchJob(jobId: string): Promise<ProcessingJob | null> {
    const supabase = await createClient();

    const { data } = await supabase.from('processing_jobs').select('*').eq('id', jobId).single();

    return data;
  }

  private aggregateResults(results: any[]): any {
    const successful = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    return {
      total: results.length,
      successful,
      failed,
      successRate: (successful / results.length) * 100,
      data: results,
    };
  }
}

/**
 * Semaphore for concurrency control
 */
class Semaphore {
  private tasks: (() => void)[] = [];
  private count: number;

  constructor(private max: number) {
    this.count = 0;
  }

  async acquire(): Promise<void> {
    if (this.count >= this.max) {
      await new Promise<void>((resolve) => {
        this.tasks.push(resolve);
      });
    }
    this.count++;
  }

  release(): void {
    this.count--;
    const task = this.tasks.shift();
    if (task) {
      task();
    }
  }

  async drain(): Promise<void> {
    while (this.count > 0) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
}
```

### 2. Job Status API

#### File: `app/api/jobs/[jobId]/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { QueueProcessor } from '@/lib/processing/queue-processor';

const processor = new QueueProcessor();

export async function GET(request: NextRequest, { params }: { params: { jobId: string } }) {
  try {
    const job = await processor.getJobStatus(params.jobId);

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    return NextResponse.json(job);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch job status' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { jobId: string } }) {
  try {
    const cancelled = await processor.cancelJob(params.jobId);

    if (!cancelled) {
      return NextResponse.json({ error: 'Job cannot be cancelled' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to cancel job' }, { status: 500 });
  }
}
```

### 3. Progress Tracking Hook

#### File: `hooks/use-job-progress.ts`

```typescript
import { useState, useEffect } from 'react';

export function useJobProgress(jobId: string | null) {
  const [job, setJob] = useState<ProcessingJob | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId) return;

    let intervalId: NodeJS.Timeout;

    const fetchStatus = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/jobs/${jobId}`);
        const data = await response.json();

        setJob(data);

        // Stop polling if job is complete
        if (data.status === 'completed' || data.status === 'failed') {
          clearInterval(intervalId);
        }
      } catch (err) {
        setError(err.message);
        clearInterval(intervalId);
      } finally {
        setLoading(false);
      }
    };

    // Initial fetch
    fetchStatus();

    // Poll every 2 seconds
    intervalId = setInterval(fetchStatus, 2000);

    return () => clearInterval(intervalId);
  }, [jobId]);

  return { job, loading, error };
}
```

## Acceptance Criteria

- [ ] Queue-based processing with configurable batch sizes
- [ ] Concurrent processing with semaphore control
- [ ] Real-time progress tracking
- [ ] Graceful error handling with retry logic
- [ ] Job cancellation support
- [ ] Failed item retry functionality
- [ ] Processing completes in <60s for 3000 nodes
- [ ] Memory usage stays below 512MB
- [ ] Progress updates every 2 seconds
- [ ] 95% success rate on normal operations

## Implementation Steps

1. **Hour 1**: Core queue processor implementation
2. **Hour 2**: Batch processing and concurrency control
3. **Hour 3**: API endpoints and progress tracking

## Testing

```typescript
describe('QueueProcessor', () => {
  it('should process 3000 nodes in under 60 seconds', async () => {
    const processor = new QueueProcessor();
    const job = await processor.createJob('scoring', 'test-project');

    // Wait for completion
    const result = await waitForJob(job.id, 60000);

    expect(result.status).toBe('completed');
    expect(result.processedItems).toBe(3000);
  });

  it('should handle concurrent jobs', async () => {
    const processor = new QueueProcessor();

    const jobs = await Promise.all([
      processor.createJob('scoring', 'project-1'),
      processor.createJob('revenue', 'project-2'),
      processor.createJob('full_analysis', 'project-3'),
    ]);

    expect(jobs).toHaveLength(3);
  });

  it('should retry failed items', async () => {
    const processor = new QueueProcessor();
    const job = await processor.createJob('scoring', 'test-project');

    // Wait for some failures
    await waitForJob(job.id);

    if (job.errors.length > 0) {
      const retryJob = await processor.retryFailedItems(job.id);
      expect(retryJob).toBeDefined();
    }
  });
});
```

## Notes

- Consider using BullMQ or similar for production queue management
- May need to implement job persistence for server restarts
- Could add priority queues for premium users
- Monitor memory usage with large datasets
