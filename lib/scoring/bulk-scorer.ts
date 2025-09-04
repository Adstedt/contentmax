import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/database.types';
import { OpportunityScorer, OpportunityScore } from './opportunity-scorer';
import { RevenueCalculator, RevenueProjection } from './revenue-calculator';
import EventEmitter from 'events';

export interface BulkScoringConfig {
  batchSize?: number; // Default 50
  concurrency?: number; // Default 5 parallel batches
  retryAttempts?: number; // Default 3
  retryDelay?: number; // Default 1000ms
  saveProgress?: boolean; // Default true
  resumeFromCheckpoint?: boolean; // Default true
}

export interface BulkScoringProgress {
  totalNodes: number;
  processedNodes: number;
  successfulNodes: number;
  failedNodes: number;
  currentBatch: number;
  totalBatches: number;
  startTime: number;
  estimatedTimeRemaining: number;
  errors: Array<{ nodeId: string; error: string; timestamp: number }>;
  checkpoint?: string; // Last successfully processed node ID
}

export interface BulkScoringResult {
  jobId: string;
  totalProcessed: number;
  successful: number;
  failed: number;
  duration: number;
  scores: OpportunityScore[];
  projections: RevenueProjection[];
  errors: Array<{ nodeId: string; error: string }>;
}

export class BulkScorer extends EventEmitter {
  private supabase: SupabaseClient<Database>;
  private opportunityScorer: OpportunityScorer;
  private revenueCalculator: RevenueCalculator;
  private config: Required<BulkScoringConfig>;
  private progress: BulkScoringProgress;
  private abortController: AbortController | null = null;
  private processingQueue: Array<() => Promise<void>> = [];
  private activeWorkers = 0;

  constructor(supabase: SupabaseClient<Database>, config: BulkScoringConfig = {}) {
    super();
    this.supabase = supabase;
    this.opportunityScorer = new OpportunityScorer(supabase);
    this.revenueCalculator = new RevenueCalculator(supabase);

    this.config = {
      batchSize: config.batchSize ?? 50,
      concurrency: config.concurrency ?? 5,
      retryAttempts: config.retryAttempts ?? 3,
      retryDelay: config.retryDelay ?? 1000,
      saveProgress: config.saveProgress ?? true,
      resumeFromCheckpoint: config.resumeFromCheckpoint ?? true,
    };

    this.progress = this.initializeProgress();
  }

  /**
   * Score all nodes for a project
   */
  async scoreProject(projectId: string): Promise<BulkScoringResult> {
    const jobId = `bulk_${Date.now()}_${projectId}`;
    const startTime = Date.now();

    try {
      // Initialize abort controller for cancellation
      this.abortController = new AbortController();

      // Get all nodes for the project
      const nodes = await this.fetchProjectNodes(projectId);

      // Check for existing checkpoint
      const startIndex = await this.getCheckpoint(projectId);
      const nodesToProcess = startIndex > 0 ? nodes.slice(startIndex) : nodes;

      this.progress = {
        ...this.initializeProgress(),
        totalNodes: nodes.length,
        processedNodes: startIndex,
        startTime,
      };

      // Emit initial progress
      this.emit('progress', this.progress);

      // Process nodes in batches
      const results = await this.processBatches(nodesToProcess, projectId);

      const duration = Date.now() - startTime;

      return {
        jobId,
        totalProcessed: this.progress.processedNodes,
        successful: this.progress.successfulNodes,
        failed: this.progress.failedNodes,
        duration,
        scores: results.scores,
        projections: results.projections,
        errors: this.progress.errors.map((e) => ({
          nodeId: e.nodeId,
          error: e.error,
        })),
      };
    } catch (error) {
      console.error('Bulk scoring failed:', error);
      throw error;
    } finally {
      this.abortController = null;
    }
  }

  /**
   * Cancel ongoing bulk scoring
   */
  cancel(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.emit('cancelled', this.progress);
    }
  }

  /**
   * Process nodes in batches with concurrency control
   */
  private async processBatches(
    nodes: Array<{ id: string; url: string }>,
    projectId: string
  ): Promise<{ scores: OpportunityScore[]; projections: RevenueProjection[] }> {
    const scores: OpportunityScore[] = [];
    const projections: RevenueProjection[] = [];

    // Create batches
    const batches: Array<Array<{ id: string; url: string }>> = [];
    for (let i = 0; i < nodes.length; i += this.config.batchSize) {
      batches.push(nodes.slice(i, i + this.config.batchSize));
    }

    this.progress.totalBatches = batches.length;

    // Process batches with concurrency control
    const batchPromises: Promise<void>[] = [];

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];

      // Check for cancellation
      if (this.abortController?.signal.aborted) {
        break;
      }

      // Wait if we've reached concurrency limit
      while (this.activeWorkers >= this.config.concurrency) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      const batchPromise = this.processBatch(batch, i + 1, projectId)
        .then((results) => {
          scores.push(...results.scores);
          projections.push(...results.projections);
        })
        .finally(() => {
          this.activeWorkers--;
        });

      this.activeWorkers++;
      batchPromises.push(batchPromise);
    }

    // Wait for all batches to complete
    await Promise.all(batchPromises);

    return { scores, projections };
  }

  /**
   * Process a single batch of nodes
   */
  private async processBatch(
    nodes: Array<{ id: string; url: string }>,
    batchNumber: number,
    projectId: string
  ): Promise<{ scores: OpportunityScore[]; projections: RevenueProjection[] }> {
    const scores: OpportunityScore[] = [];
    const projections: RevenueProjection[] = [];

    this.progress.currentBatch = batchNumber;

    for (const node of nodes) {
      if (this.abortController?.signal.aborted) {
        break;
      }

      try {
        // Score the node with retry logic
        const score = await this.scoreNodeWithRetry(node.id);
        if (score) {
          scores.push(score);

          // Calculate revenue projection
          const projection = await this.calculateProjectionWithRetry(node.id);
          if (projection) {
            projections.push(projection);
          }

          this.progress.successfulNodes++;
        } else {
          this.progress.failedNodes++;
        }
      } catch (error) {
        this.progress.failedNodes++;
        this.progress.errors.push({
          nodeId: node.id,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: Date.now(),
        });
      }

      this.progress.processedNodes++;

      // Update checkpoint
      if (this.config.saveProgress) {
        await this.saveCheckpoint(projectId, node.id);
      }

      // Update progress
      this.updateProgress();
      this.emit('progress', this.progress);
    }

    // Store results in database
    if (scores.length > 0) {
      await this.opportunityScorer.storeScores(scores);
    }

    return { scores, projections };
  }

  /**
   * Score a node with retry logic
   */
  private async scoreNodeWithRetry(nodeId: string): Promise<OpportunityScore | null> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        return await this.opportunityScorer.calculateScore(nodeId);
      } catch (error) {
        lastError = error as Error;
        if (attempt < this.config.retryAttempts) {
          await new Promise((resolve) => setTimeout(resolve, this.config.retryDelay * attempt));
        }
      }
    }

    console.error(
      `Failed to score node ${nodeId} after ${this.config.retryAttempts} attempts:`,
      lastError
    );
    return null;
  }

  /**
   * Calculate revenue projection with retry logic
   */
  private async calculateProjectionWithRetry(nodeId: string): Promise<RevenueProjection | null> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        return await this.revenueCalculator.calculateProjection(nodeId);
      } catch (error) {
        lastError = error as Error;
        if (attempt < this.config.retryAttempts) {
          await new Promise((resolve) => setTimeout(resolve, this.config.retryDelay * attempt));
        }
      }
    }

    console.error(
      `Failed to calculate projection for ${nodeId} after ${this.config.retryAttempts} attempts:`,
      lastError
    );
    return null;
  }

  /**
   * Update progress metrics
   */
  private updateProgress(): void {
    const elapsed = Date.now() - this.progress.startTime;
    const nodesPerSecond = this.progress.processedNodes / (elapsed / 1000);
    const remainingNodes = this.progress.totalNodes - this.progress.processedNodes;

    this.progress.estimatedTimeRemaining =
      nodesPerSecond > 0 ? Math.floor((remainingNodes / nodesPerSecond) * 1000) : 0;
  }

  /**
   * Fetch all nodes for a project
   */
  private async fetchProjectNodes(projectId: string): Promise<Array<{ id: string; url: string }>> {
    const { data, error } = await this.supabase
      .from('taxonomy_nodes')
      .select('id, url')
      .eq('project_id', projectId)
      .order('path');

    if (error) {
      throw new Error(`Failed to fetch nodes: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get checkpoint for resuming
   */
  private async getCheckpoint(projectId: string): Promise<number> {
    if (!this.config.resumeFromCheckpoint) {
      return 0;
    }

    const { data, error } = await this.supabase
      .from('bulk_scoring_checkpoints')
      .select('last_processed_index')
      .eq('project_id', projectId)
      .single();

    if (error || !data) {
      return 0;
    }

    return data.last_processed_index || 0;
  }

  /**
   * Save checkpoint for resuming
   */
  private async saveCheckpoint(projectId: string, nodeId: string): Promise<void> {
    // In a real implementation, this would update a checkpoints table
    // For now, we'll just log it
    this.progress.checkpoint = nodeId;
  }

  /**
   * Initialize progress object
   */
  private initializeProgress(): BulkScoringProgress {
    return {
      totalNodes: 0,
      processedNodes: 0,
      successfulNodes: 0,
      failedNodes: 0,
      currentBatch: 0,
      totalBatches: 0,
      startTime: Date.now(),
      estimatedTimeRemaining: 0,
      errors: [],
    };
  }

  /**
   * Get current progress
   */
  getProgress(): BulkScoringProgress {
    return { ...this.progress };
  }

  /**
   * Stream progress updates
   */
  onProgress(callback: (progress: BulkScoringProgress) => void): void {
    this.on('progress', callback);
  }

  /**
   * Handle cancellation
   */
  onCancelled(callback: (progress: BulkScoringProgress) => void): void {
    this.on('cancelled', callback);
  }
}
