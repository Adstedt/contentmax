import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { google } from 'googleapis';
import { refreshAccessToken } from '@/lib/integrations/google/oauth-config';

/**
 * GET /api/integrations/google/merchant/performance
 * 
 * Fetches performance metrics from Google Merchant Center
 * Enriches taxonomy nodes with real performance data
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get stored Google tokens
    const { data: integration, error: integrationError } = await supabase
      .from('google_integrations')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (integrationError || !integration) {
      return NextResponse.json(
        { error: 'Google account not connected. Please connect your Google Merchant account first.' },
        { status: 400 }
      );
    }

    // Check if token needs refresh
    let accessToken = integration.access_token;
    if (new Date(integration.expires_at) <= new Date()) {
      const refreshedTokens = await refreshAccessToken(integration.refresh_token);
      accessToken = refreshedTokens.access_token;
      
      // Update stored tokens
      await supabase
        .from('google_integrations')
        .update({
          access_token: refreshedTokens.access_token,
          expires_at: new Date(Date.now() + refreshedTokens.expires_in * 1000).toISOString(),
        })
        .eq('id', integration.id);
    }

    // Initialize Google Content API client
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });
    
    const content = google.content({ version: 'v2.1', auth: oauth2Client });
    
    // Get merchant ID from integration or config
    const merchantId = integration.merchant_id || process.env.GOOGLE_MERCHANT_ID;
    if (!merchantId) {
      return NextResponse.json(
        { error: 'Merchant ID not configured' },
        { status: 400 }
      );
    }

    // Fetch product performance report
    const reportResponse = await content.reports.search({
      merchantId: merchantId.toString(),
      requestBody: {
        query: `
          SELECT 
            offerId,
            title,
            googleProductCategory,
            productTypeL1,
            productTypeL2,
            productTypeL3,
            impressions,
            clicks,
            clickThroughRate,
            conversions,
            conversionRate,
            conversionValue
          FROM MerchantPerformanceView
          WHERE date DURING LAST_30_DAYS
        `
      }
    });

    const performanceData = reportResponse.data.results || [];

    // Get all products from database
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, external_id, title, category_path')
      .eq('user_id', user.id);

    if (productsError) {
      console.error('Error fetching products:', productsError);
      return NextResponse.json(
        { error: 'Failed to fetch products' },
        { status: 500 }
      );
    }

    // Match performance data with products
    const enrichedProducts = products?.map(product => {
      const performance = performanceData.find(
        p => p.productView?.offerId === product.external_id
      );
      
      if (performance) {
        return {
          ...product,
          performance: {
            impressions: performance.metrics?.impressions || 0,
            clicks: performance.metrics?.clicks || 0,
            ctr: performance.metrics?.clickThroughRate || 0,
            conversions: performance.metrics?.conversions || 0,
            conversionRate: performance.metrics?.conversionRate || 0,
            revenue: performance.metrics?.conversionValue?.value || 0,
            currency: performance.metrics?.conversionValue?.currency || 'USD',
          }
        };
      }
      
      return product;
    });

    // Update products with performance data
    for (const product of enrichedProducts || []) {
      if (product.performance) {
        await supabase
          .from('products')
          .update({
            impressions: product.performance.impressions,
            clicks: product.performance.clicks,
            ctr: product.performance.ctr,
            conversions: product.performance.conversions,
            conversion_rate: product.performance.conversionRate,
            revenue: product.performance.revenue,
            updated_at: new Date().toISOString(),
          })
          .eq('id', product.id);
      }
    }

    // CORRECT AGGREGATION: Build from bottom-up
    // First, organize products by their direct category
    const productsByCategory = new Map();
    
    for (const product of enrichedProducts || []) {
      if (product.performance && product.category_path) {
        const categories = product.category_path.split(' > ');
        const directCategory = categories.join(' > '); // Full path is the direct category
        
        if (!productsByCategory.has(directCategory)) {
          productsByCategory.set(directCategory, []);
        }
        productsByCategory.get(directCategory).push(product);
      }
    }
    
    // Now aggregate performance data bottom-up
    const categoryPerformance = new Map();
    
    // Process each category path
    for (const [categoryPath, products] of productsByCategory.entries()) {
      const pathParts = categoryPath.split(' > ');
      
      // For each level in the path, aggregate the data
      for (let level = 0; level < pathParts.length; level++) {
        const currentPath = pathParts.slice(0, level + 1).join(' > ');
        
        if (!categoryPerformance.has(currentPath)) {
          categoryPerformance.set(currentPath, {
            impressions: 0,
            clicks: 0,
            conversions: 0,
            revenue: 0,
            productCount: 0,
            directProductCount: 0, // Products directly in this category
          });
        }
        
        const perf = categoryPerformance.get(currentPath);
        
        // Only add each product's metrics once per category level
        // Check if this is the direct category for these products
        if (currentPath === categoryPath) {
          for (const product of products) {
            perf.impressions += product.performance.impressions;
            perf.clicks += product.performance.clicks;
            perf.conversions += product.performance.conversions;
            perf.revenue += product.performance.revenue;
            perf.directProductCount += 1;
          }
          perf.productCount = perf.directProductCount;
        } else {
          // For parent categories, just increment total product count
          perf.productCount += products.length;
        }
      }
    }

    // Update taxonomy nodes with CORRECTLY aggregated performance
    for (const [categoryPath, performance] of categoryPerformance.entries()) {
      // CRITICAL: Calculate CTR from totals, not average!
      const ctr = performance.impressions > 0 
        ? (performance.clicks / performance.impressions) * 100 
        : 0;
      
      // CRITICAL: Calculate conversion rate from totals, not average!
      const conversionRate = performance.clicks > 0
        ? (performance.conversions / performance.clicks) * 100
        : 0;
      
      await supabase
        .from('taxonomy_nodes')
        .update({
          impressions: performance.impressions,
          clicks: performance.clicks,
          ctr: ctr,
          conversions: performance.conversions,
          conversion_rate: conversionRate,
          revenue: performance.revenue,
          updated_at: new Date().toISOString(),
        })
        .eq('path', categoryPath)
        .eq('user_id', user.id);
    }

    return NextResponse.json({
      success: true,
      message: 'Performance data synced successfully',
      stats: {
        productsEnriched: enrichedProducts?.filter(p => p.performance).length || 0,
        categoriesUpdated: categoryPerformance.size,
        totalImpressions: Array.from(categoryPerformance.values())
          .reduce((sum, p) => sum + p.impressions, 0),
        totalRevenue: Array.from(categoryPerformance.values())
          .reduce((sum, p) => sum + p.revenue, 0),
      }
    });

  } catch (error) {
    console.error('Error fetching Merchant Center performance:', error);
    return NextResponse.json(
      { error: 'Failed to fetch performance data', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/integrations/google/merchant/performance
 * 
 * Triggers a manual sync of performance data
 */
export async function POST(request: NextRequest) {
  // Just call the GET handler to trigger a sync
  return GET(request);
}