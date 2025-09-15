import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { CategoryUrlDiscovery } from '@/lib/services/category-url-discovery';
import { MetaTagFetcher } from '@/lib/services/meta-tag-fetcher';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { projectId, sitemapUrl, fetchMeta } = await request.json();

    // Get products with URLs
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('link')
      .eq('user_id', user.id)
      .not('link', 'is', null)
      .limit(500);

    if (productsError || !products || products.length === 0) {
      return NextResponse.json(
        { error: 'No products with URLs found. Please import products first.' },
        { status: 400 }
      );
    }

    const productUrls = products.map(p => p.link).filter(Boolean);

    // Discover category URLs
    const discovery = new CategoryUrlDiscovery();
    const discoveredCategories = await discovery.discoverCategoryUrls(productUrls, sitemapUrl);

    // Update taxonomy nodes with discovered URLs
    const updatedCount = await discovery.updateTaxonomyWithDiscoveredUrls();

    // Optionally fetch meta tags for discovered URLs
    let metaFetchCount = 0;
    if (fetchMeta) {
      const metaFetcher = new MetaTagFetcher();

      // Get nodes that now have URLs but no meta tags
      const { data: nodes } = await supabase
        .from('taxonomy_nodes')
        .select('id, url')
        .eq('user_id', user.id)
        .not('url', 'is', null)
        .is('meta_title', null)
        .limit(50);

      if (nodes && nodes.length > 0) {
        // Fetch meta tags for each URL
        for (const node of nodes) {
          const metaTags = await metaFetcher.fetchMetaTags(node.url);

          if (metaTags.title || metaTags.description) {
            await supabase
              .from('taxonomy_nodes')
              .update({
                meta_title: metaTags.title || metaTags.ogTitle,
                meta_description: metaTags.description || metaTags.ogDescription
              })
              .eq('id', node.id);

            metaFetchCount++;
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      discovered: discoveredCategories.size,
      updated: updatedCount,
      metaFetched: metaFetchCount,
      categories: Array.from(discoveredCategories.values()).map(cat => ({
        path: cat.categoryPath,
        url: cat.url,
        confidence: cat.confidence
      }))
    });
  } catch (error) {
    console.error('URL discovery failed:', error);
    return NextResponse.json(
      { error: 'Failed to discover category URLs' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get statistics about URLs
    const [nodesWithUrls, nodesWithoutUrls, productsWithUrls] = await Promise.all([
      supabase
        .from('taxonomy_nodes')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .not('url', 'is', null),
      supabase
        .from('taxonomy_nodes')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .is('url', null),
      supabase
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .not('link', 'is', null),
    ]);

    return NextResponse.json({
      taxonomyNodes: {
        withUrls: nodesWithUrls.count || 0,
        withoutUrls: nodesWithoutUrls.count || 0,
        total: (nodesWithUrls.count || 0) + (nodesWithoutUrls.count || 0)
      },
      products: {
        withUrls: productsWithUrls.count || 0
      }
    });
  } catch (error) {
    console.error('Failed to get URL stats:', error);
    return NextResponse.json(
      { error: 'Failed to get URL statistics' },
      { status: 500 }
    );
  }
}