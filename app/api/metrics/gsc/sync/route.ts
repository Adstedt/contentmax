import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { GSCService } from '@/lib/services/gsc-service';
import { URLMatcher } from '@/lib/integration/url-matcher';
import { MetricsAggregator } from '@/lib/integration/metrics-aggregator';

export const runtime = 'nodejs';
export const maxDuration = 60; // 60 seconds for API routes

/**
 * POST /api/metrics/gsc/sync
 * Sync Google Search Console data for the current user
 */
export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get request body
    const body = await request.json();
    const {
      dateRange = 30,
      siteUrl,
      forceRefresh = false
    } = body;

    // Check if user has Google OAuth connected
    const { data: googleAuth, error: googleAuthError } = await supabase
      .from('google_auth')
      .select('access_token, refresh_token')
      .eq('user_id', user.id)
      .single();

    if (googleAuthError || !googleAuth) {
      return NextResponse.json(
        { error: 'Please connect your Google account first' },
        { status: 400 }
      );
    }

    // Check last sync time to prevent too frequent syncs
    if (!forceRefresh) {
      const { data: syncStatus } = await supabase
        .from('gsc_sync_status')
        .select('last_sync_at')
        .eq('user_id', user.id)
        .single();

      if (syncStatus?.last_sync_at) {
        const lastSync = new Date(syncStatus.last_sync_at);
        const hoursSinceLastSync = (Date.now() - lastSync.getTime()) / (1000 * 60 * 60);

        if (hoursSinceLastSync < 1) {
          return NextResponse.json(
            {
              error: 'Please wait at least 1 hour between syncs',
              lastSyncAt: syncStatus.last_sync_at
            },
            { status: 429 }
          );
        }
      }
    }

    // Update sync status to running
    await supabase
      .from('gsc_sync_status')
      .upsert({
        user_id: user.id,
        sync_status: 'running',
        sync_message: 'Fetching data from Google Search Console...',
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id'
      });

    // Initialize GSC service
    const gscService = new GSCService();
    await gscService.initialize(googleAuth.access_token, googleAuth.refresh_token);

    // Set site URL if provided, otherwise use environment default
    if (siteUrl) {
      gscService.setSiteUrl(siteUrl);
    }

    // Fetch search metrics
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - dateRange * 24 * 60 * 60 * 1000)
      .toISOString().split('T')[0];

    const metrics = await gscService.fetchSearchMetrics({
      startDate,
      endDate,
    });

    // Store metrics in database
    await gscService.storeMetrics(metrics, user.id);

    // Get taxonomy nodes and products for matching
    const { data: nodes, error: nodesError } = await supabase
      .from('taxonomy_nodes')
      .select('id, url, path, title, parentId')
      .eq('user_id', user.id);

    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, link, title, gtin, node_id')
      .eq('user_id', user.id);

    if (nodesError || productsError) {
      throw new Error('Failed to fetch taxonomy data');
    }

    // Match URLs to nodes
    const urlMatcher = new URLMatcher();
    const matchResults = new Map<string, string>();

    for (const metric of metrics) {
      const match = urlMatcher.matchUrl(
        metric.url,
        nodes || [],
        products || []
      );

      if (match) {
        const nodeId = match.type === 'node'
          ? match.id
          : products?.find(p => p.id === match.id)?.node_id;

        if (nodeId) {
          matchResults.set(metric.url, nodeId);
        }
      }
    }

    // Update search_metrics with node_id mappings
    for (const [url, nodeId] of matchResults) {
      await supabase
        .from('search_metrics')
        .update({ node_id: nodeId })
        .eq('url', url)
        .eq('user_id', user.id);
    }

    // Aggregate metrics by category
    const aggregator = new MetricsAggregator();
    const aggregatedMetrics = aggregator.aggregateSearchMetrics(
      nodes || [],
      metrics,
      matchResults
    );

    // Get statistics
    const stats = aggregator.getAggregateStatistics(aggregatedMetrics);

    // Update sync status to completed
    await supabase
      .from('gsc_sync_status')
      .upsert({
        user_id: user.id,
        last_sync_at: new Date().toISOString(),
        sync_status: 'completed',
        sync_message: `Successfully synced ${metrics.length} metrics`,
        metrics_synced: metrics.length,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id'
      });

    return NextResponse.json({
      success: true,
      metricsCount: metrics.length,
      matchedUrls: matchResults.size,
      matchRate: matchResults.size / Math.max(metrics.length, 1),
      statistics: stats,
      syncedAt: new Date().toISOString(),
    });

  } catch (error) {
    console.error('GSC sync error:', error);

    // Update sync status to failed
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      await supabase
        .from('gsc_sync_status')
        .upsert({
          user_id: user.id,
          sync_status: 'failed',
          sync_message: error instanceof Error ? error.message : 'Unknown error occurred',
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id'
        });
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to sync GSC data',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/metrics/gsc/sync
 * Get sync status for the current user
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get sync status
    const { data: syncStatus, error } = await supabase
      .from('gsc_sync_status')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      throw error;
    }

    // Get metrics summary
    const { data: metricsSummary } = await supabase
      .from('search_metrics')
      .select('date, clicks, impressions')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .limit(30);

    // Calculate totals
    let totalClicks = 0;
    let totalImpressions = 0;

    if (metricsSummary) {
      for (const metric of metricsSummary) {
        totalClicks += metric.clicks || 0;
        totalImpressions += metric.impressions || 0;
      }
    }

    return NextResponse.json({
      syncStatus: syncStatus || {
        last_sync_at: null,
        sync_status: 'never',
        sync_message: 'No sync performed yet',
        metrics_synced: 0,
      },
      summary: {
        totalClicks,
        totalImpressions,
        avgCtr: totalImpressions > 0 ? totalClicks / totalImpressions : 0,
        daysOfData: metricsSummary?.length || 0,
      },
    });

  } catch (error) {
    console.error('Error fetching sync status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sync status' },
      { status: 500 }
    );
  }
}