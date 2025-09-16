import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';

/**
 * GET /api/metrics/ga4/products
 * Get product-level analytics metrics
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

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const nodeId = searchParams.get('nodeId');
    const productId = searchParams.get('productId');
    const dateRange = parseInt(searchParams.get('dateRange') || '30');
    const limit = parseInt(searchParams.get('limit') || '100');

    // Calculate date range
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - dateRange * 24 * 60 * 60 * 1000)
      .toISOString().split('T')[0];

    // Build query
    let query = supabase
      .from('product_analytics')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('item_revenue', { ascending: false })
      .limit(limit);

    if (productId) {
      query = query.eq('product_id', productId);
    }

    if (nodeId) {
      // Get products for this node
      const { data: products } = await supabase
        .from('products')
        .select('id')
        .eq('node_id', nodeId)
        .eq('user_id', user.id);

      if (products && products.length > 0) {
        const productIds = products.map(p => p.id);
        query = query.in('product_id', productIds);
      }
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    // Aggregate by product
    const productMetrics = new Map<string, any>();

    if (data) {
      for (const metric of data) {
        const existing = productMetrics.get(metric.product_id) || {
          product_id: metric.product_id,
          item_name: metric.item_name,
          item_category: metric.item_category,
          total_revenue: 0,
          total_purchases: 0,
          total_views: 0,
          total_cart_additions: 0,
          total_cart_removals: 0,
          avg_purchase_to_view_rate: 0,
          days_with_data: 0,
        };

        existing.total_revenue += metric.item_revenue || 0;
        existing.total_purchases += metric.items_purchased || 0;
        existing.total_views += metric.items_viewed || 0;
        existing.total_cart_additions += metric.cart_additions || 0;
        existing.total_cart_removals += metric.cart_removals || 0;
        existing.days_with_data += 1;

        productMetrics.set(metric.product_id, existing);
      }
    }

    // Calculate rates
    const results = Array.from(productMetrics.values()).map(metric => ({
      ...metric,
      avg_purchase_to_view_rate: metric.total_views > 0
        ? metric.total_purchases / metric.total_views
        : 0,
      cart_abandonment_rate: metric.total_cart_additions > 0
        ? metric.total_cart_removals / metric.total_cart_additions
        : 0,
      revenue_per_view: metric.total_views > 0
        ? metric.total_revenue / metric.total_views
        : 0,
    }));

    // Sort by revenue
    results.sort((a, b) => b.total_revenue - a.total_revenue);

    return NextResponse.json({
      products: results,
      summary: {
        total_products: results.length,
        total_revenue: results.reduce((sum, p) => sum + p.total_revenue, 0),
        total_purchases: results.reduce((sum, p) => sum + p.total_purchases, 0),
        total_views: results.reduce((sum, p) => sum + p.total_views, 0),
        date_range: {
          start: startDate,
          end: endDate,
        },
      },
    });

  } catch (error) {
    console.error('Error fetching product analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch product analytics' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/metrics/ga4/products/sync
 * Sync product-level metrics from GA4
 */
export async function POST(request: NextRequest) {
  try {
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
    const { dateRange = 30, forceRefresh = false } = body;

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

    // Get GA4 property ID from user settings
    const { data: settings } = await supabase
      .from('user_settings')
      .select('integration_config')
      .eq('user_id', user.id)
      .single();

    const propertyId = settings?.integration_config?.ga4_property_id;

    if (!propertyId) {
      return NextResponse.json(
        { error: 'GA4 Property ID not configured' },
        { status: 400 }
      );
    }

    // Import GA4 service dynamically to avoid server-side issues
    const { GA4Service } = await import('@/lib/services/ga4-service');
    const { GA4Mapper } = await import('@/lib/integration/ga4-mapper');

    // Initialize GA4 service
    const ga4Service = new GA4Service(propertyId);
    await ga4Service.initialize(googleAuth.access_token, googleAuth.refresh_token);

    // Fetch product metrics
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - dateRange * 24 * 60 * 60 * 1000)
      .toISOString().split('T')[0];

    const productMetrics = await ga4Service.fetchProductMetrics({
      startDate,
      endDate,
    });

    if (productMetrics.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No product metrics available',
        metricsCount: 0,
      });
    }

    // Get products for mapping
    const { data: products } = await supabase
      .from('products')
      .select('id, link, title, gtin, node_id')
      .eq('user_id', user.id);

    const { data: nodes } = await supabase
      .from('taxonomy_nodes')
      .select('id, url, path, title')
      .eq('user_id', user.id);

    // Map product metrics
    const mapper = new GA4Mapper();
    const mappedMetrics = await mapper.mapProductMetrics(
      productMetrics,
      products || [],
      nodes || []
    );

    // Store product metrics
    await ga4Service.storeProductMetrics(productMetrics, user.id);

    // Update product analytics with mapped node IDs
    for (const metric of mappedMetrics) {
      if (metric.productId && metric.nodeId) {
        // Update product with node_id if not already set
        await supabase
          .from('products')
          .update({ node_id: metric.nodeId })
          .eq('id', metric.productId)
          .eq('user_id', user.id)
          .is('node_id', null);
      }
    }

    return NextResponse.json({
      success: true,
      metricsCount: productMetrics.length,
      mappedCount: mappedMetrics.filter(m => m.productId).length,
      syncedAt: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Product sync error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to sync product data',
      },
      { status: 500 }
    );
  }
}