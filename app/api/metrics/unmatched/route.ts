import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/external/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const source = searchParams.get('source');
    const resolved = searchParams.get('resolved');
    const limit = parseInt(searchParams.get('limit') || '100');

    // Build query
    let query = supabase.from('unmatched_metrics').select('*').eq('user_id', user.id);

    if (source) {
      query = query.eq('source', source);
    }

    if (resolved !== null) {
      query = query.eq('resolved', resolved === 'true');
    }

    query = query
      .order('match_attempts', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit);

    const { data, error } = await query;

    if (error) throw error;

    // Get summary stats
    const { data: stats } = await supabase
      .from('unmatched_metrics')
      .select('source, resolved')
      .eq('user_id', user.id);

    const summary = {
      total: stats?.length || 0,
      bySource: {
        gsc: stats?.filter((s) => s.source === 'gsc').length || 0,
        ga4: stats?.filter((s) => s.source === 'ga4').length || 0,
        market: stats?.filter((s) => s.source === 'market').length || 0,
      },
      resolved: stats?.filter((s) => s.resolved).length || 0,
      unresolved: stats?.filter((s) => !s.resolved).length || 0,
    };

    return NextResponse.json({
      items: data,
      summary,
    });
  } catch (error) {
    console.error('Unmatched metrics API error:', error);
    return NextResponse.json({ error: 'Failed to fetch unmatched metrics' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { unmatchedId, entityType, entityId } = body;

    if (!unmatchedId || !entityType || !entityId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get the unmatched metric
    const { data: unmatched, error: fetchError } = await supabase
      .from('unmatched_metrics')
      .select('*')
      .eq('id', unmatchedId)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !unmatched) {
      return NextResponse.json({ error: 'Unmatched metric not found' }, { status: 404 });
    }

    // Create manual mapping
    const { error: mappingError } = await supabase.from('metric_mappings').insert({
      source_identifier: unmatched.identifier,
      source_type: unmatched.identifier_type,
      entity_type: entityType,
      entity_id: entityId,
      confidence: 0.95, // High confidence for manual mappings
      created_by: user.id,
    });

    if (mappingError) throw mappingError;

    // Mark unmatched as resolved
    const { error: updateError } = await supabase
      .from('unmatched_metrics')
      .update({
        resolved: true,
        resolved_entity_type: entityType,
        resolved_entity_id: entityId,
      })
      .eq('id', unmatchedId);

    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      message: 'Manual mapping created successfully',
    });
  } catch (error) {
    console.error('Manual mapping API error:', error);
    return NextResponse.json({ error: 'Failed to create manual mapping' }, { status: 500 });
  }
}
