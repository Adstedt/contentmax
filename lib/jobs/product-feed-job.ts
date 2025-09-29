import { createClient } from '@/lib/external/supabase/server';
import { GoogleMerchantClient, MerchantConfig } from '@/lib/external/google-merchant';
import { ProductFeedParser } from '@/lib/data/import/product-feed-parser';
import { ProductSyncServiceImpl } from '@/lib/services/product-sync-service';

export interface FeedConfig {
  feedId: string;
  feedName: string;
  merchantId?: string;
  accountId?: string;
  format: 'xml' | 'json' | 'api';
  feedUrl?: string;
  authCredentials?: any;
  deltaSync: boolean;
  updateFrequency: 'hourly' | 'daily' | 'weekly';
}

export interface FeedStatus {
  isRunning: boolean;
  lastSync: Date | null;
  nextSync: Date | null;
  lastSyncStatus: 'success' | 'failed' | 'partial' | null;
  lastError: string | null;
}

export interface FeedScheduler {
  schedule(feedId: string, frequency: string): void;
  pause(feedId: string): void;
  resume(feedId: string): void;
  getStatus(feedId: string): FeedStatus;
  runNow(feedId: string): Promise<void>;
}

export class ProductFeedJob {
  private isRunning = false;
  private lastSync: Date | null = null;
  private lastError: string | null = null;
  private abortController: AbortController | null = null;

  async run(config: FeedConfig): Promise<void> {
    if (this.isRunning) {
      console.log('Feed sync already in progress');
      return;
    }

    this.isRunning = true;
    this.abortController = new AbortController();
    const supabase = createClient();

    try {
      // Record sync start
      await this.recordSyncStart(config.feedId, supabase);

      // Fetch feed data
      const feedData = await this.fetchFeedData(config);
      
      if (this.abortController.signal.aborted) {
        throw new Error('Sync aborted');
      }

      // Parse feed
      const parser = new ProductFeedParser();
      const parsed = await parser.parseFeed(feedData, config.format);

      console.log(`Parsed ${parsed.totalCount} products from feed`);

      // Check for changes if delta sync is enabled
      if (config.deltaSync && this.lastSync) {
        const changes = await this.detectChanges(parsed, supabase);
        if (!changes.hasChanges) {
          console.log('No changes detected, skipping sync');
          await this.recordSyncSuccess(config.feedId, parsed, supabase, 'skipped');
          return;
        }
      }

      // Sync products to database
      const syncService = new ProductSyncServiceImpl(supabase);
      const syncResult = await syncService.syncProducts(parsed);

      // Update taxonomy metrics
      await this.updateTaxonomyMetrics(supabase);

      // Record successful sync
      await this.recordSyncSuccess(config.feedId, parsed, supabase, 'success', syncResult.syncId);

      this.lastSync = new Date();
      this.lastError = null;

      console.log(`Feed sync completed: ${syncResult.inserted} inserted, ${syncResult.updated} updated, ${syncResult.deleted} deleted`);
    } catch (error) {
      console.error('Product feed sync failed:', error);
      this.lastError = error instanceof Error ? error.message : 'Unknown error';
      await this.recordSyncError(config.feedId, error, supabase);
      throw error;
    } finally {
      this.isRunning = false;
      this.abortController = null;
    }
  }

  abort(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  private async fetchFeedData(config: FeedConfig): Promise<any> {
    if (config.format === 'api' && config.merchantId) {
      // Fetch from Google Merchant Center API
      const merchantClient = new GoogleMerchantClient({
        merchantId: config.merchantId,
        accountId: config.accountId || config.merchantId,
        credentials: config.authCredentials,
        feedSettings: {
          primaryFeedId: config.feedId,
          updateFrequency: config.updateFrequency,
          deltaSync: config.deltaSync,
        },
      });

      if (config.authCredentials?.refreshToken) {
        await merchantClient.authenticate(config.authCredentials.refreshToken);
      }

      return await merchantClient.getAllProducts(config.feedId);
    } else if (config.feedUrl) {
      // Fetch from URL
      const response = await fetch(config.feedUrl, {
        signal: this.abortController?.signal,
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch feed: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type');
      if (contentType?.includes('json')) {
        return await response.json();
      } else {
        return await response.text();
      }
    } else {
      throw new Error('No feed source configured');
    }
  }

  private async detectChanges(parsed: any, supabase: any): Promise<{ hasChanges: boolean }> {
    // Get product IDs from last successful sync
    const { data: lastSync } = await supabase
      .from('feed_sync_history')
      .select('products_processed, created_at')
      .eq('status', 'success')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!lastSync) {
      return { hasChanges: true };
    }

    // Simple check: if product count changed significantly
    const countDiff = Math.abs(parsed.totalCount - (lastSync.products_processed || 0));
    const percentChange = (countDiff / (lastSync.products_processed || 1)) * 100;

    // Consider changed if > 1% difference in product count
    return { hasChanges: percentChange > 1 };
  }

  private async updateTaxonomyMetrics(supabase: any): Promise<void> {
    const { error } = await supabase.rpc('recalculate_taxonomy_metrics', {
      include_sku_counts: true,
      include_revenue: true,
      include_availability: true,
    });

    if (error) {
      console.error('Failed to update taxonomy metrics:', error);
    }
  }

  private async recordSyncStart(feedId: string, supabase: any): Promise<void> {
    await supabase
      .from('feed_sync_history')
      .insert({
        feed_id: feedId,
        sync_type: 'full',
        status: 'running',
        started_at: new Date().toISOString(),
      });
  }

  private async recordSyncSuccess(
    feedId: string,
    parsed: any,
    supabase: any,
    status: string = 'success',
    syncId?: string
  ): Promise<void> {
    const updateData: any = {
      status,
      products_processed: parsed.totalCount,
      completed_at: new Date().toISOString(),
    };

    if (syncId) {
      await supabase
        .from('feed_sync_history')
        .update(updateData)
        .eq('id', syncId);
    } else {
      await supabase
        .from('feed_sync_history')
        .update(updateData)
        .eq('feed_id', feedId)
        .eq('status', 'running')
        .order('created_at', { ascending: false })
        .limit(1);
    }
  }

  private async recordSyncError(feedId: string, error: any, supabase: any): Promise<void> {
    await supabase
      .from('feed_sync_history')
      .update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        completed_at: new Date().toISOString(),
      })
      .eq('feed_id', feedId)
      .eq('status', 'running')
      .order('created_at', { ascending: false })
      .limit(1);
  }

  getStatus(): FeedStatus {
    return {
      isRunning: this.isRunning,
      lastSync: this.lastSync,
      nextSync: this.calculateNextSync(),
      lastSyncStatus: this.lastError ? 'failed' : (this.lastSync ? 'success' : null),
      lastError: this.lastError,
    };
  }

  private calculateNextSync(): Date | null {
    if (!this.lastSync) return null;
    
    // Default to daily sync
    const nextSync = new Date(this.lastSync);
    nextSync.setDate(nextSync.getDate() + 1);
    return nextSync;
  }
}

// Scheduler implementation
export class ProductFeedScheduler implements FeedScheduler {
  private jobs: Map<string, NodeJS.Timeout> = new Map();
  private feedJobs: Map<string, ProductFeedJob> = new Map();
  private feedConfigs: Map<string, FeedConfig> = new Map();

  schedule(feedId: string, frequency: string): void {
    this.pause(feedId);

    const intervalMs = this.getIntervalMs(frequency);
    const job = new ProductFeedJob();
    this.feedJobs.set(feedId, job);

    const interval = setInterval(async () => {
      const config = this.feedConfigs.get(feedId);
      if (config) {
        try {
          await job.run(config);
        } catch (error) {
          console.error(`Scheduled sync failed for feed ${feedId}:`, error);
        }
      }
    }, intervalMs);

    this.jobs.set(feedId, interval);
  }

  pause(feedId: string): void {
    const interval = this.jobs.get(feedId);
    if (interval) {
      clearInterval(interval);
      this.jobs.delete(feedId);
    }
  }

  resume(feedId: string): void {
    const config = this.feedConfigs.get(feedId);
    if (config) {
      this.schedule(feedId, config.updateFrequency);
    }
  }

  getStatus(feedId: string): FeedStatus {
    const job = this.feedJobs.get(feedId);
    if (job) {
      return job.getStatus();
    }

    return {
      isRunning: false,
      lastSync: null,
      nextSync: null,
      lastSyncStatus: null,
      lastError: null,
    };
  }

  async runNow(feedId: string): Promise<void> {
    const config = this.feedConfigs.get(feedId);
    if (!config) {
      throw new Error(`No configuration found for feed ${feedId}`);
    }

    let job = this.feedJobs.get(feedId);
    if (!job) {
      job = new ProductFeedJob();
      this.feedJobs.set(feedId, job);
    }

    await job.run(config);
  }

  registerFeed(config: FeedConfig): void {
    this.feedConfigs.set(config.feedId, config);
  }

  private getIntervalMs(frequency: string): number {
    switch (frequency) {
      case 'hourly':
        return 60 * 60 * 1000; // 1 hour
      case 'daily':
        return 24 * 60 * 60 * 1000; // 24 hours
      case 'weekly':
        return 7 * 24 * 60 * 60 * 1000; // 7 days
      default:
        return 24 * 60 * 60 * 1000; // Default to daily
    }
  }
}

// Singleton scheduler instance
export const feedScheduler = new ProductFeedScheduler();