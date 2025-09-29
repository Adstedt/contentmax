import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { GA4Service } from '@/lib/services/ga4-service';
import { GA4Mapper } from '@/lib/external/ga4-mapper';
import { MetricsAggregator } from '@/lib/external/metrics-aggregator';

export const runtime = 'nodejs';
export const maxDuration = 60; // 60 seconds for API routes

/**
 * POST /api/metrics/ga4/sync
 * Sync Google Analytics 4 data for the current user
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
      forceRefresh = false,
      propertyId: requestPropertyId,
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

    // Get GA4 property ID from user settings or request
    let propertyId = requestPropertyId;
    if (!propertyId) {
      const { data: settings } = await supabase
        .from('user_settings')
        .select('integration_config')
        .eq('user_id', user.id)
        .single();

      if (settings?.integration_config) {
        propertyId = (settings.integration_config as any).ga4_property_id;
      }
    }

    if (!propertyId) {
      return NextResponse.json(
        { error: 'GA4 Property ID not configured. Please configure it in settings.' },
        { status: 400 }
      );
    }

    // Check last sync time to prevent too frequent syncs
    if (!forceRefresh) {
      const { data: syncStatus } = await supabase
        .from('ga4_sync_status')
        .select('last_sync_at')
        .eq('user_id', user.id)
        .eq('property_id', propertyId)
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
      .from('ga4_sync_status')
      .upsert({
        user_id: user.id,
        property_id: propertyId,
        sync_status: 'running',
        sync_message: 'Fetching data from Google Analytics 4...',
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,property_id'
      });

    // Initialize GA4 service
    const ga4Service = new GA4Service(propertyId);
    await ga4Service.initialize(googleAuth.access_token, googleAuth.refresh_token);

    // Verify property access
    const hasAccess = await ga4Service.verifyPropertyAccess();
    if (!hasAccess) {
      await supabase
        .from('ga4_sync_status')
        .upsert({
          user_id: user.id,
          property_id: propertyId,
          sync_status: 'failed',
          sync_message: 'Cannot access GA4 property. Please verify the Property ID and permissions.',
          error_details: { code: 'PROPERTY_ACCESS_DENIED' },
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,property_id'
        });

      return NextResponse.json(
        { error: 'Cannot access GA4 property. Please verify the Property ID and permissions.' },
        { status: 403 }
      );
    }

    // Fetch metrics
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - dateRange * 24 * 60 * 60 * 1000)
      .toISOString().split('T')[0];

    // Fetch page metrics
    const pageMetrics = await ga4Service.fetchPageMetrics({
      startDate,
      endDate,
    });

    // Store page metrics in database
    await ga4Service.storePageMetrics(pageMetrics, user.id);

    // Fetch product metrics if e-commerce tracking is enabled
    let productMetrics = [];
    try {
      productMetrics = await ga4Service.fetchProductMetrics({
        startDate,
        endDate,
      });

      if (productMetrics.length > 0) {
        await ga4Service.storeProductMetrics(productMetrics, user.id);
      }
    } catch (error) {
      console.log('E-commerce metrics not available:', error);
    }

    // Get taxonomy nodes and products for mapping
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

    // Map metrics to nodes
    const ga4Mapper = new GA4Mapper();
    const mappedMetrics = await ga4Mapper.mapPageMetricsToTaxonomy(
      pageMetrics,
      nodes || [],
      products || []
    );

    // Update analytics_metrics with node_id mappings
    for (const metric of mappedMetrics) {
      if (metric.nodeId) {
        await supabase
          .from('analytics_metrics')
          .update({
            node_id: metric.nodeId,
            product_id: metric.productId || null,
          })
          .eq('page_path', metric.pagePath)
          .eq('date', metric.date)
          .eq('user_id', user.id);
      }
    }

    // Aggregate metrics by category
    const aggregator = new MetricsAggregator();
    const aggregatedMetrics = aggregator.aggregateAnalyticsMetrics(
      nodes || [],
      mappedMetrics
    );

    // Get statistics
    const stats = aggregator.getRevenueStatistics(aggregatedMetrics);
    const mappingStats = ga4Mapper.getMappingStatistics(mappedMetrics);

    // Update sync status to completed
    await supabase
      .from('ga4_sync_status')
      .upsert({
        user_id: user.id,
        property_id: propertyId,
        last_sync_at: new Date().toISOString(),
        sync_status: 'completed',
        sync_message: `Successfully synced ${pageMetrics.length} page metrics and ${productMetrics.length} product metrics`,
        metrics_synced: pageMetrics.length + productMetrics.length,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,property_id'
      });

    // Update user settings with last sync time
    await supabase
      .from('user_settings')
      .upsert({
        user_id: user.id,
        integration_config: {
          ga4_property_id: propertyId,
          last_ga4_sync: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id'
      });

    return NextResponse.json({
      success: true,
      pageMetricsCount: pageMetrics.length,
      productMetricsCount: productMetrics.length,
      mappingStats,
      revenueStats: {
        totalRevenue: stats.totalRevenue,
        totalTransactions: stats.totalTransactions,
        avgOrderValue: stats.avgOrderValue,
        topRevenueCategories: stats.topRevenueNodes.slice(0, 5).map(n => ({
          nodeId: n.nodeId,
          revenue: n.revenue,
          transactions: n.transactions,
        })),
      },
      syncedAt: new Date().toISOString(),
    });

  } catch (error) {
    console.error('GA4 sync error:', error);

    // Update sync status to failed
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const propertyId = (await supabase
        .from('user_settings')
        .select('integration_config')
        .eq('user_id', user.id)
        .single())?.data?.integration_config?.ga4_property_id;

      if (propertyId) {
        await supabase
          .from('ga4_sync_status')
          .upsert({
            user_id: user.id,
            property_id: propertyId,
            sync_status: 'failed',
            sync_message: error instanceof Error ? error.message : 'Unknown error occurred',
            error_details: error instanceof Error ? { message: error.message, stack: error.stack } : {},
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'user_id,property_id'
          });
      }
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to sync GA4 data',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/metrics/ga4/sync
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

    // Get GA4 property ID from user settings
    const { data: settings } = await supabase
      .from('user_settings')
      .select('integration_config')
      .eq('user_id', user.id)
      .single();

    const propertyId = settings?.integration_config?.ga4_property_id;

    if (!propertyId) {
      return NextResponse.json({
        configured: false,
        message: 'GA4 Property ID not configured',
      });
    }

    // Get sync status
    const { data: syncStatus, error } = await supabase
      .from('ga4_sync_status')
      .select('*')
      .eq('user_id', user.id)
      .eq('property_id', propertyId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      throw error;
    }

    // Get metrics summary
    const { data: metricsSummary } = await supabase
      .from('analytics_metrics')
      .select('date, revenue, transactions, sessions')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .limit(30);

    // Calculate totals
    let totalRevenue = 0;
    let totalTransactions = 0;
    let totalSessions = 0;

    if (metricsSummary) {
      for (const metric of metricsSummary) {
        totalRevenue += metric.revenue || 0;
        totalTransactions += metric.transactions || 0;
        totalSessions += metric.sessions || 0;
      }
    }

    return NextResponse.json({
      configured: true,
      propertyId,
      syncStatus: syncStatus || {
        last_sync_at: null,
        sync_status: 'never',
        sync_message: 'No sync performed yet',
        metrics_synced: 0,
      },
      summary: {
        totalRevenue,
        totalTransactions,
        totalSessions,
        avgOrderValue: totalTransactions > 0 ? totalRevenue / totalTransactions : 0,
        conversionRate: totalSessions > 0 ? totalTransactions / totalSessions : 0,
        daysOfData: metricsSummary?.length || 0,
      },
    });

  } catch (error) {
    console.error('Error fetching GA4 sync status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sync status' },
      { status: 500 }
    );
  }
}