import { SupabaseClient } from '@supabase/supabase-js';
import { GA4Client } from '@/lib/external/analytics';
import { URLMatcher } from '@/lib/core/analysis/url-matcher';
import { MetricsSyncTracker, SyncConfig, syncJobManager } from './sync-tracker';
import { GA4Config, GA4BatchRequest } from '@/types/ga4.types';

interface NodeWithUrl {
  id: string;
  url: string;
  project_id: string;
}

interface MetricData {
  nodeId: string;
  url: string;
  source: 'ga4' | 'gsc';
  data: Record<string, any>;
  metricDate: string;
}

export class MetricsSyncJob {
  private supabase: SupabaseClient;
  private ga4Client?: GA4Client;
  private urlMatcher: URLMatcher;
  private tracker: MetricsSyncTracker;
  private config: SyncConfig;

  constructor(
    supabase: SupabaseClient,
    config: SyncConfig,
    tracker: MetricsSyncTracker
  ) {
    this.supabase = supabase;
    this.config = config;
    this.tracker = tracker;
    this.urlMatcher = new URLMatcher({
      fuzzyThreshold: config.matchThreshold || 0.7,
    });
  }

  /**
   * Execute the metrics sync job
   */
  async execute(): Promise<void> {
    try {
      this.tracker.start(0);
      
      // Step 1: Fetch all taxonomy nodes for the project
      const nodes = await this.fetchTaxonomyNodes();
      this.tracker.start(nodes.length);

      if (nodes.length === 0) {
        this.tracker.complete('completed');
        return;
      }

      // Step 2: Initialize GA4 client if needed
      if (this.config.sources.includes('ga4')) {
        await this.initializeGA4Client();
      }

      // Step 3: Fetch metrics from configured sources
      const metricsToStore: MetricData[] = [];

      if (this.config.sources.includes('ga4') && this.ga4Client) {
        const ga4Metrics = await this.fetchGA4Metrics(nodes);
        metricsToStore.push(...ga4Metrics);
      }

      if (this.config.sources.includes('gsc')) {
        const gscMetrics = await this.fetchGSCMetrics(nodes);
        metricsToStore.push(...gscMetrics);
      }

      // Step 4: Store metrics in database (unless dry run)
      if (!this.config.dryRun && metricsToStore.length > 0) {
        await this.storeMetrics(metricsToStore);
      }

      // Step 5: Record sync history
      await this.recordSyncHistory();

      this.tracker.complete('completed');
    } catch (error) {
      console.error('Metrics sync job failed:', error);
      this.tracker.addError('job', error instanceof Error ? error.message : 'Unknown error');
      this.tracker.complete('failed');
      throw error;
    }
  }

  /**
   * Fetch all taxonomy nodes for the project
   */
  private async fetchTaxonomyNodes(): Promise<NodeWithUrl[]> {
    const { data, error } = await this.supabase
      .from('taxonomy_nodes')
      .select('id, url, project_id')
      .eq('project_id', this.config.projectId);

    if (error) {
      throw new Error(`Failed to fetch taxonomy nodes: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Initialize GA4 client
   */
  private async initializeGA4Client(): Promise<void> {
    // Get GA4 configuration from environment
    const ga4PropertyId = process.env.GA4_PROPERTY_ID;
    const ga4ServiceAccount = process.env.GA4_SERVICE_ACCOUNT_KEY;

    if (!ga4PropertyId) {
      this.tracker.addError('ga4', 'GA4 property ID not configured');
      return;
    }

    const ga4Config: GA4Config = {
      propertyId: ga4PropertyId,
      serviceAccountKey: ga4ServiceAccount,
      cacheEnabled: true,
      cacheTTL: 3600000,
      rateLimit: {
        maxConcurrent: 10,
        interval: 1000,
      },
    };

    this.ga4Client = new GA4Client(ga4Config);
  }

  /**
   * Fetch GA4 metrics for all nodes
   */
  private async fetchGA4Metrics(nodes: NodeWithUrl[]): Promise<MetricData[]> {
    if (!this.ga4Client) return [];

    const metrics: MetricData[] = [];
    const urls = nodes.map(n => n.url);

    try {
      // Fetch GA4 metrics in batch
      const request: GA4BatchRequest = {
        urls,
        startDate: this.config.startDate,
        endDate: this.config.endDate,
      };

      const ga4Results = await this.ga4Client.fetchBatchMetrics(request);

      // Match GA4 results to nodes
      for (const result of ga4Results) {
        const matchResult = this.matchUrlToNode(result.url, nodes);
        
        if (matchResult) {
          metrics.push({
            nodeId: matchResult.node.id,
            url: matchResult.node.url,
            source: 'ga4',
            data: {
              revenue: result.revenue,
              transactions: result.transactions,
              conversionRate: result.conversionRate,
              averageOrderValue: result.averageOrderValue,
              sessions: result.sessions,
              bounceRate: result.bounceRate,
              engagementRate: result.engagementRate,
              averageEngagementTime: result.averageEngagementTime,
              newUsers: result.newUsers,
              totalUsers: result.totalUsers,
            },
            metricDate: this.config.endDate,
          });
          
          this.tracker.incrementGA4();
          this.tracker.incrementProcessed(true);
        } else {
          this.tracker.incrementProcessed(false);
        }
      }
    } catch (error) {
      this.tracker.addError('ga4', error instanceof Error ? error.message : 'GA4 fetch failed');
    }

    return metrics;
  }

  /**
   * Fetch GSC metrics for all nodes
   */
  private async fetchGSCMetrics(nodes: NodeWithUrl[]): Promise<MetricData[]> {
    const metrics: MetricData[] = [];

    try {
      // Check if GSC data exists in the database
      const { data: gscData, error } = await this.supabase
        .from('node_metrics')
        .select('*')
        .eq('project_id', this.config.projectId)
        .eq('source', 'gsc')
        .gte('metric_date', this.config.startDate)
        .lte('metric_date', this.config.endDate);

      if (error) {
        throw error;
      }

      if (!gscData || gscData.length === 0) {
        // TODO: Implement actual GSC API client when available
        this.tracker.addError('gsc', 'GSC client not yet implemented');
        return metrics;
      }

      // Match existing GSC data to nodes
      for (const gsc of gscData) {
        const matchResult = this.matchUrlToNode(gsc.url, nodes);
        
        if (matchResult) {
          metrics.push({
            nodeId: matchResult.node.id,
            url: matchResult.node.url,
            source: 'gsc',
            data: gsc.data,
            metricDate: gsc.metric_date,
          });
          
          this.tracker.incrementGSC();
        }
      }
    } catch (error) {
      this.tracker.addError('gsc', error instanceof Error ? error.message : 'GSC fetch failed');
    }

    return metrics;
  }

  /**
   * Match a URL to a taxonomy node
   */
  private matchUrlToNode(
    sourceUrl: string,
    nodes: NodeWithUrl[]
  ): { node: NodeWithUrl; confidence: number } | null {
    let bestMatch: { node: NodeWithUrl; confidence: number } | null = null;
    let bestConfidence = this.config.matchThreshold || 0.7;

    for (const node of nodes) {
      const result = this.urlMatcher.matchURL(sourceUrl, node.url);
      
      if (result && result.confidence >= bestConfidence) {
        bestMatch = { node, confidence: result.confidence };
        bestConfidence = result.confidence;
        
        // Perfect match, no need to continue
        if (result.confidence === 1.0) {
          break;
        }
      }
    }

    return bestMatch;
  }

  /**
   * Store metrics in the database
   */
  private async storeMetrics(metrics: MetricData[]): Promise<void> {
    // Prepare batch insert
    const records = metrics.map(metric => ({
      node_id: metric.nodeId,
      project_id: this.config.projectId,
      url: metric.url,
      source: metric.source,
      metric_date: metric.metricDate,
      data: metric.data,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    // Batch upsert to handle duplicates
    const batchSize = 100;
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      
      const { error } = await this.supabase
        .from('node_metrics')
        .upsert(batch, {
          onConflict: 'node_id,source,metric_date',
          returning: 'minimal',
        });

      if (error) {
        this.tracker.addError('database', `Failed to store metrics batch: ${error.message}`);
        throw error;
      }
    }
  }

  /**
   * Record sync history for audit
   */
  private async recordSyncHistory(): Promise<void> {
    const progress = this.tracker.getProgress();
    
    const history = {
      id: progress.jobId,
      project_id: this.config.projectId,
      sync_type: 'metrics',
      sources: this.config.sources,
      date_range: {
        start: this.config.startDate,
        end: this.config.endDate,
      },
      status: progress.status,
      stats: {
        totalNodes: progress.totalNodes,
        processedNodes: progress.processedNodes,
        matchedNodes: progress.matchedNodes,
        unmatchedNodes: progress.unmatchedNodes,
        gscMetrics: progress.gscMetrics,
        ga4Metrics: progress.ga4Metrics,
      },
      errors: progress.errors,
      started_at: progress.startedAt,
      completed_at: progress.completedAt,
      duration_ms: progress.duration,
    };

    // Store in sync_history table if it exists
    const { error } = await this.supabase
      .from('sync_history')
      .insert(history);

    if (error) {
      // Table might not exist yet, log but don't fail
      console.warn('Failed to record sync history:', error);
    }
  }

  /**
   * Get unmatched URLs report
   */
  getUnmatchedReport(): string {
    const progress = this.tracker.getProgress();
    const report = [
      '=== Metrics Sync Report ===',
      '',
      this.tracker.getSummary(),
      '',
    ];

    if (progress.errors.length > 0) {
      report.push('Errors:');
      progress.errors.forEach(err => {
        report.push(`  [${err.source}] ${err.message} (${err.timestamp})`);
      });
      report.push('');
    }

    if (progress.unmatchedNodes > 0) {
      report.push(`Unmatched Nodes: ${progress.unmatchedNodes}`);
      report.push('Consider reviewing URL matching thresholds or patterns.');
    }

    return report.join('\n');
  }
}

/**
 * Factory function to create and execute a metrics sync job
 */
export async function runMetricsSync(
  supabase: SupabaseClient,
  config: SyncConfig
): Promise<{ jobId: string; tracker: MetricsSyncTracker }> {
  const jobId = `sync_${Date.now()}_${config.projectId}`;
  const tracker = syncJobManager.createJob(jobId, config);
  
  const job = new MetricsSyncJob(supabase, config, tracker);
  
  // Execute asynchronously
  job.execute().catch(error => {
    console.error('Metrics sync failed:', error);
  });

  return { jobId, tracker };
}