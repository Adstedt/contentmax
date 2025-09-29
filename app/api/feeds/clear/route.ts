import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/external/supabase/server';

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { feedId } = await request.json();

    // Start transaction-like behavior by deleting in correct order
    const deletionSteps = [
      {
        name: 'category products',
        query: supabase.from('category_products').delete().eq('user_id', user.id),
      },
      { name: 'products', query: supabase.from('products').delete().eq('user_id', user.id) },
      {
        name: 'taxonomy nodes',
        query: supabase.from('taxonomy_nodes').delete().eq('user_id', user.id),
      },
    ];

    const results = [];
    let hasError = false;

    for (const step of deletionSteps) {
      const { error, count } = await step.query;

      if (error && error.code !== 'PGRST116') {
        // Ignore "no rows deleted" error
        console.error(`Error deleting ${step.name}:`, error);
        hasError = true;
        results.push({
          step: step.name,
          success: false,
          error: error.message,
        });
      } else {
        results.push({
          step: step.name,
          success: true,
          deleted: count || 0,
        });
      }
    }

    // If a specific feed ID was provided, also remove the connection
    if (feedId) {
      const { error: feedError } = await supabase
        .from('feed_config')
        .delete()
        .eq('id', feedId)
        .eq('user_id', user.id); // Additional safety check

      if (feedError) {
        console.error('Error removing feed connection:', feedError);
        results.push({
          step: 'feed connection',
          success: false,
          error: feedError.message,
        });
      } else {
        results.push({
          step: 'feed connection',
          success: true,
        });
      }
    }

    if (hasError) {
      return NextResponse.json(
        {
          error: 'Some data could not be cleared',
          details: results,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'All feed data cleared successfully',
      details: results,
    });
  } catch (error) {
    console.error('Failed to clear feed data:', error);
    return NextResponse.json({ error: 'Failed to clear feed data' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Get counts of data that would be deleted
    const [products, taxonomyNodes, searchMetrics] = await Promise.all([
      supabase.from('products').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase
        .from('taxonomy_nodes')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id),
    ]);

    return NextResponse.json({
      dataToDelete: {
        products: products.count || 0,
        taxonomyNodes: taxonomyNodes.count || 0,
        searchMetrics: searchMetrics.count || 0,
        total: (products.count || 0) + (taxonomyNodes.count || 0) + (searchMetrics.count || 0),
      },
    });
  } catch (error) {
    console.error('Failed to get deletion statistics:', error);
    return NextResponse.json({ error: 'Failed to get deletion statistics' }, { status: 500 });
  }
}
