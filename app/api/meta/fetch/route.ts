import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
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

    const { type, ids, autoFetch } = await request.json();

    if (!type || !['products', 'taxonomy'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid type. Must be "products" or "taxonomy"' },
        { status: 400 }
      );
    }

    const fetcher = new MetaTagFetcher();
    let itemsProcessed = 0;

    if (type === 'products') {
      if (ids && ids.length > 0) {
        // Fetch for specific products
        await fetcher.updateProductMetaTags(ids);
        itemsProcessed = ids.length;
      } else if (autoFetch) {
        // Fetch for all products without meta tags
        const { data: products, error } = await supabase
          .from('products')
          .select('id')
          .eq('user_id', user.id)
          .is('meta_title', null)
          .not('link', 'is', null)
          .limit(100); // Process max 100 at a time

        if (products && products.length > 0) {
          const productIds = products.map(p => p.id);
          await fetcher.updateProductMetaTags(productIds);
          itemsProcessed = productIds.length;
        }
      }
    } else if (type === 'taxonomy') {
      if (ids && ids.length > 0) {
        // Fetch for specific nodes
        await fetcher.updateTaxonomyMetaTags(ids);
        itemsProcessed = ids.length;
      } else if (autoFetch) {
        // Fetch for all nodes without meta tags
        const { data: nodes, error } = await supabase
          .from('taxonomy_nodes')
          .select('id')
          .eq('user_id', user.id)
          .is('meta_title', null)
          .not('url', 'is', null)
          .limit(100); // Process max 100 at a time

        if (nodes && nodes.length > 0) {
          const nodeIds = nodes.map(n => n.id);
          await fetcher.updateTaxonomyMetaTags(nodeIds);
          itemsProcessed = nodeIds.length;
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Meta tags fetched for ${itemsProcessed} ${type}`,
      itemsProcessed,
    });
  } catch (error) {
    console.error('Meta tag fetch failed:', error);
    return NextResponse.json(
      { error: 'Failed to fetch meta tags' },
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

    // Get stats on items needing meta tags
    const [productsResult, nodesResult] = await Promise.all([
      supabase
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .is('meta_title', null)
        .not('link', 'is', null),
      supabase
        .from('taxonomy_nodes')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .is('meta_title', null)
        .not('url', 'is', null),
    ]);

    return NextResponse.json({
      products: {
        needingMetaTags: productsResult.count || 0,
      },
      taxonomyNodes: {
        needingMetaTags: nodesResult.count || 0,
      },
    });
  } catch (error) {
    console.error('Failed to get meta tag stats:', error);
    return NextResponse.json(
      { error: 'Failed to get meta tag statistics' },
      { status: 500 }
    );
  }
}