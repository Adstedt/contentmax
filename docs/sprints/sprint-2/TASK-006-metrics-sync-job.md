# TASK-006: Metrics Sync Job

## Overview

**Priority**: P0 - Blocker  
**Estimate**: 4 hours  
**Owner**: Backend Developer  
**Dependencies**: TASK-004 (GA4 Client), TASK-005 (URL Matcher)  
**Status**: Not Started

## Problem Statement

We need an automated job to sync metrics from GSC and GA4 daily, match them to taxonomy nodes, and store them for opportunity scoring. The job should handle failures gracefully, provide progress tracking, and maintain high match rates.

## Technical Requirements

### 1. Sync Job Implementation

#### File: `lib/jobs/metrics-sync.ts`

```typescript
import { createClient } from '@/lib/supabase/server';
import { SearchConsoleClient } from '@/lib/integrations/search-console';
import { GA4Client } from '@/lib/integrations/analytics';
import { URLMatcher } from '@/lib/matching/url-matcher';
import { MetricsSyncTracker } from './sync-tracker';

export interface SyncConfig {
  projectId: string;
  userId: string;
  dateRange?: {
    startDate: string;
    endDate: string;
  };
  sources?: ('gsc' | 'ga4')[];
  forceUpdate?: boolean;
  dryRun?: boolean;
}

export interface SyncResult {
  success: boolean;
  projectId: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  stats: {
    nodesProcessed: number;
    gscMetricsFound: number;
    ga4MetricsFound: number;
    matchRate: number;
    errors: number;
    warnings: number;
  };
  unmatched: {
    gsc: string[];
    ga4: string[];
  };
  errors: SyncError[];
}

interface SyncError {
  source: string;
  message: string;
  url?: string;
  timestamp: Date;
}

export class MetricsSyncJob {
  private supabase: any;
  private gscClient: SearchConsoleClient;
  private ga4Client: GA4Client;
  private urlMatcher: URLMatcher;
  private tracker: MetricsSyncTracker;

  constructor() {
    this.urlMatcher = new URLMatcher();
    this.tracker = new MetricsSyncTracker();
  }

  /**
   * Main sync entry point
   */
  async sync(config: SyncConfig): Promise<SyncResult> {
    const startTime = new Date();
    const syncId = crypto.randomUUID();

    // Initialize result
    const result: SyncResult = {
      success: false,
      projectId: config.projectId,
      startTime,
      endTime: new Date(),
      duration: 0,
      stats: {
        nodesProcessed: 0,
        gscMetricsFound: 0,
        ga4MetricsFound: 0,
        matchRate: 0,
        errors: 0,
        warnings: 0,
      },
      unmatched: {
        gsc: [],
        ga4: [],
      },
      errors: [],
    };

    try {
      // Initialize tracking
      await this.tracker.init(syncId, config);

      // Initialize Supabase
      this.supabase = await createClient();

      // Verify project access
      const project = await this.verifyProjectAccess(config.projectId, config.userId);
      if (!project) {
        throw new Error('Project not found or access denied');
      }

      // Initialize API clients
      await this.initializeClients(project);

      // Get date range (default: last 7 days)
      const dateRange = config.dateRange || this.getDefaultDateRange();

      // Fetch all taxonomy nodes
      const nodes = await this.fetchNodes(config.projectId);
      result.stats.nodesProcessed = nodes.length;

      if (nodes.length === 0) {
        throw new Error('No taxonomy nodes found. Import sitemap first.');
      }

      await this.tracker.updatePhase('fetching_metrics');

      // Fetch metrics from sources
      const sources = config.sources || ['gsc', 'ga4'];
      const metricsData = await this.fetchAllMetrics(nodes, dateRange, sources, result);

      await this.tracker.updatePhase('matching_urls');

      // Match metrics to nodes
      const matched = await this.matchMetricsToNodes(nodes, metricsData, result);

      await this.tracker.updatePhase('storing_data');

      // Store metrics in database
      if (!config.dryRun) {
        await this.storeMetrics(matched, dateRange.endDate);
      }

      // Update node metadata
      if (!config.dryRun) {
        await this.updateNodeMetadata(config.projectId);
      }

      // Calculate final statistics
      result.stats.matchRate = this.calculateMatchRate(nodes, matched);

      // Record sync history
      await this.recordSyncHistory(syncId, config, result);

      result.success = true;
    } catch (error) {
      result.errors.push({
        source: 'sync',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
      });
      result.stats.errors++;

      await this.tracker.setError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      result.endTime = new Date();
      result.duration = result.endTime.getTime() - startTime.getTime();

      await this.tracker.complete(result);
    }

    return result;
  }

  /**
   * Initialize API clients
   */
  private async initializeClients(project: any): Promise<void> {
    // Get stored credentials
    const { data: integrations } = await this.supabase
      .from('integrations')
      .select('*')
      .eq('project_id', project.id);

    // Initialize GSC
    const gscIntegration = integrations?.find((i: any) => i.type === 'gsc');
    if (gscIntegration) {
      this.gscClient = new SearchConsoleClient();
      await this.gscClient.initialize(project.user_id);
    }

    // Initialize GA4
    const ga4Integration = integrations?.find((i: any) => i.type === 'ga4');
    if (ga4Integration) {
      this.ga4Client = new GA4Client(ga4Integration.property_id);
      if (ga4Integration.refresh_token) {
        await this.ga4Client.initializeWithOAuth(ga4Integration.refresh_token);
      }
    }
  }

  /**
   * Fetch all metrics from configured sources
   */
  private async fetchAllMetrics(
    nodes: any[],
    dateRange: any,
    sources: string[],
    result: SyncResult
  ): Promise<{
    gsc: Map<string, any> | null;
    ga4: Map<string, any> | null;
  }> {
    const urls = nodes.map((n) => n.url);
    const metrics: any = {
      gsc: null,
      ga4: null,
    };

    // Fetch GSC metrics
    if (sources.includes('gsc') && this.gscClient) {
      try {
        await this.tracker.updateProgress({
          message: 'Fetching GSC metrics',
          percentage: 25,
        });

        const gscData = await this.gscClient.fetchBatchMetrics(urls, {
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
          dimensions: ['page'],
        });

        metrics.gsc = gscData;
        result.stats.gscMetricsFound = gscData.size;
      } catch (error) {
        result.errors.push({
          source: 'gsc',
          message: error instanceof Error ? error.message : 'GSC fetch failed',
          timestamp: new Date(),
        });
        result.stats.errors++;
      }
    }

    // Fetch GA4 metrics
    if (sources.includes('ga4') && this.ga4Client) {
      try {
        await this.tracker.updateProgress({
          message: 'Fetching GA4 metrics',
          percentage: 50,
        });

        const ga4Data = await this.ga4Client.fetchBatchMetrics(urls, dateRange);

        metrics.ga4 = ga4Data;
        result.stats.ga4MetricsFound = ga4Data.size;
      } catch (error) {
        result.errors.push({
          source: 'ga4',
          message: error instanceof Error ? error.message : 'GA4 fetch failed',
          timestamp: new Date(),
        });
        result.stats.errors++;
      }
    }

    return metrics;
  }

  /**
   * Match metrics to nodes using URL matcher
   */
  private async matchMetricsToNodes(
    nodes: any[],
    metricsData: any,
    result: SyncResult
  ): Promise<Map<string, any>> {
    const matched = new Map<string, any>();

    // Build URL index
    this.urlMatcher.buildIndex(nodes.map((n) => n.url));

    // Match GSC data
    if (metricsData.gsc) {
      const gscUrls = Array.from(metricsData.gsc.keys());
      const gscMatches = await this.urlMatcher.matchBatch(
        gscUrls.map((url) => ({ url })),
        nodes.map((n) => n.url),
        { minConfidence: 0.8 }
      );

      // Store unmatched
      gscUrls.forEach((url) => {
        if (!gscMatches.has(url)) {
          result.unmatched.gsc.push(url);
        }
      });

      // Combine matched data
      gscMatches.forEach((match, sourceUrl) => {
        const node = nodes.find((n) => n.url === match.targetUrl);
        if (node) {
          const existing = matched.get(node.id) || { nodeId: node.id };
          existing.gsc = metricsData.gsc.get(sourceUrl);
          matched.set(node.id, existing);
        }
      });
    }

    // Match GA4 data
    if (metricsData.ga4) {
      const ga4Urls = Array.from(metricsData.ga4.keys());
      const ga4Matches = await this.urlMatcher.matchBatch(
        ga4Urls.map((url) => ({ url })),
        nodes.map((n) => n.url),
        { minConfidence: 0.8 }
      );

      // Store unmatched
      ga4Urls.forEach((url) => {
        if (!ga4Matches.has(url)) {
          result.unmatched.ga4.push(url);
        }
      });

      // Combine matched data
      ga4Matches.forEach((match, sourceUrl) => {
        const node = nodes.find((n) => n.url === match.targetUrl);
        if (node) {
          const existing = matched.get(node.id) || { nodeId: node.id };
          existing.ga4 = metricsData.ga4.get(sourceUrl);
          matched.set(node.id, existing);
        }
      });
    }

    return matched;
  }

  /**
   * Store metrics in database
   */
  private async storeMetrics(matched: Map<string, any>, date: string): Promise<void> {
    const records = [];

    matched.forEach((data, nodeId) => {
      // Store GSC metrics
      if (data.gsc) {
        records.push({
          node_id: nodeId,
          date,
          source: 'gsc',
          impressions: data.gsc.impressions || 0,
          clicks: data.gsc.clicks || 0,
          ctr: data.gsc.ctr || 0,
          position: data.gsc.position || 0,
        });
      }

      // Store GA4 metrics
      if (data.ga4) {
        records.push({
          node_id: nodeId,
          date,
          source: 'ga4',
          sessions: data.ga4.sessions || 0,
          revenue: data.ga4.revenue || 0,
          transactions: data.ga4.transactions || 0,
          conversion_rate: data.ga4.conversionRate || 0,
          bounce_rate: data.ga4.bounceRate || 0,
          avg_session_duration: data.ga4.avgSessionDuration || 0,
        });
      }
    });

    // Batch upsert
    if (records.length > 0) {
      const { error } = await this.supabase.from('node_metrics').upsert(records, {
        onConflict: 'node_id,date,source',
      });

      if (error) {
        throw new Error(`Failed to store metrics: ${error.message}`);
      }
    }
  }

  /**
   * Update node metadata with sync timestamp
   */
  private async updateNodeMetadata(projectId: string): Promise<void> {
    await this.supabase
      .from('taxonomy_nodes')
      .update({ metrics_updated_at: new Date().toISOString() })
      .eq('project_id', projectId);
  }

  /**
   * Helper methods
   */
  private async verifyProjectAccess(projectId: string, userId: string): Promise<any> {
    const { data } = await this.supabase.from('projects').select('*').eq('id', projectId).single();

    return data;
  }

  private async fetchNodes(projectId: string): Promise<any[]> {
    const { data } = await this.supabase
      .from('taxonomy_nodes')
      .select('id, url, title')
      .eq('project_id', projectId);

    return data || [];
  }

  private getDefaultDateRange() {
    const end = new Date();
    end.setDate(end.getDate() - 1); // Yesterday
    const start = new Date();
    start.setDate(start.getDate() - 7); // 7 days ago

    return {
      startDate: this.formatDate(start),
      endDate: this.formatDate(end),
    };
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  private calculateMatchRate(nodes: any[], matched: Map<string, any>): number {
    if (nodes.length === 0) return 0;
    return Math.round((matched.size / nodes.length) * 100);
  }

  private async recordSyncHistory(
    syncId: string,
    config: SyncConfig,
    result: SyncResult
  ): Promise<void> {
    await this.supabase.from('sync_history').insert({
      id: syncId,
      project_id: config.projectId,
      user_id: config.userId,
      status: result.success ? 'success' : 'failed',
      stats: result.stats,
      unmatched: result.unmatched,
      errors: result.errors,
      duration: result.duration,
      created_at: result.startTime,
    });
  }
}
```

### 2. Sync API Endpoints

#### File: `app/api/sync/metrics/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { MetricsSyncJob } from '@/lib/jobs/metrics-sync';
import { createClient } from '@/lib/supabase/server';

// Manual trigger endpoint
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, dateRange, sources, forceUpdate, dryRun } = body;

    // Get user
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Run sync
    const syncJob = new MetricsSyncJob();
    const result = await syncJob.sync({
      projectId,
      userId: user.id,
      dateRange,
      sources,
      forceUpdate,
      dryRun,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    );
  }
}

// Get sync status
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');

  if (!projectId) {
    return NextResponse.json({ error: 'Project ID required' }, { status: 400 });
  }

  const supabase = await createClient();

  // Get latest sync
  const { data } = await supabase
    .from('sync_history')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  return NextResponse.json(data || { status: 'never_synced' });
}
```

### 3. Vercel Cron Configuration

#### File: `app/api/cron/sync/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { MetricsSyncJob } from '@/lib/jobs/metrics-sync';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = await createClient();

    // Get all active projects
    const { data: projects } = await supabase
      .from('projects')
      .select('id, user_id')
      .eq('sync_enabled', true);

    if (!projects || projects.length === 0) {
      return NextResponse.json({ message: 'No projects to sync' });
    }

    const syncJob = new MetricsSyncJob();
    const results = [];

    // Sync each project
    for (const project of projects) {
      try {
        const result = await syncJob.sync({
          projectId: project.id,
          userId: project.user_id,
        });
        results.push({
          projectId: project.id,
          success: result.success,
          stats: result.stats,
        });
      } catch (error) {
        results.push({
          projectId: project.id,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      message: 'Sync completed',
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Cron job failed', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
```

#### File: `vercel.json` (addition)

```json
{
  "crons": [
    {
      "path": "/api/cron/sync",
      "schedule": "0 2 * * *"
    }
  ]
}
```

### 4. Progress Tracker

#### File: `lib/jobs/sync-tracker.ts`

```typescript
export class MetricsSyncTracker {
  private progress: any = {};

  async init(syncId: string, config: any): Promise<void> {
    this.progress = {
      syncId,
      status: 'initializing',
      projectId: config.projectId,
      startTime: new Date(),
      currentPhase: 'starting',
      percentage: 0,
      message: 'Initializing sync...',
    };

    await this.save();
  }

  async updatePhase(phase: string): Promise<void> {
    this.progress.currentPhase = phase;
    this.progress.message = this.getPhaseMessage(phase);
    await this.save();
  }

  async updateProgress(update: any): Promise<void> {
    this.progress = { ...this.progress, ...update };
    await this.save();
  }

  async setError(message: string): Promise<void> {
    this.progress.status = 'failed';
    this.progress.error = message;
    await this.save();
  }

  async complete(result: any): Promise<void> {
    this.progress.status = 'completed';
    this.progress.result = result;
    this.progress.endTime = new Date();
    await this.save();
  }

  private getPhaseMessage(phase: string): string {
    const messages: Record<string, string> = {
      fetching_metrics: 'Fetching metrics from external sources...',
      matching_urls: 'Matching URLs to taxonomy nodes...',
      storing_data: 'Storing metrics in database...',
      completed: 'Sync completed successfully',
    };
    return messages[phase] || 'Processing...';
  }

  private async save(): Promise<void> {
    // Save to Redis or database
    // For now, using in-memory storage
  }
}
```

## Acceptance Criteria

- [ ] Daily automatic sync at 2 AM UTC
- [ ] Manual sync trigger available
- [ ] Fetches metrics from both GSC and GA4
- [ ] Match rate >80% using URL matcher
- [ ] Handles API failures gracefully
- [ ] Progress tracking for long-running syncs
- [ ] Stores metrics with proper date attribution
- [ ] Sync history recorded
- [ ] Completes in <5 minutes for 3000 nodes
- [ ] Dry run mode for testing

## Implementation Steps

1. **Hour 1**: Core sync job logic
2. **Hour 2**: API endpoints and cron setup
3. **Hour 3**: Progress tracking and error handling
4. **Hour 4**: Testing and optimization

## Notes

- Consider using queue (Bull) for large projects
- May need to implement incremental sync for efficiency
- Add alerting for failed syncs
- Monitor API quota usage
