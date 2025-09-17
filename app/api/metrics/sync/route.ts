import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { MetricsIntegrator } from '@/lib/services/metrics-integrator';

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
    const { startDate, endDate, incremental = true } = body;

    // Validate dates
    const start = startDate ? new Date(startDate) : new Date();
    const end = endDate ? new Date(endDate) : new Date();

    if (start > end) {
      return NextResponse.json({ error: 'Start date must be before end date' }, { status: 400 });
    }

    // Initialize integrator
    const integrator = new MetricsIntegrator();

    // Process each date in range
    const results = [];
    const current = new Date(start);

    while (current <= end) {
      const dateStr = current.toISOString().split('T')[0];

      // Check if we should skip (incremental mode)
      if (incremental) {
        const { data: existing } = await supabase
          .from('integrated_metrics')
          .select('id')
          .eq('user_id', user.id)
          .eq('metrics_date', dateStr)
          .limit(1);

        if (existing && existing.length > 0) {
          console.log(`Skipping ${dateStr} - already processed`);
          current.setDate(current.getDate() + 1);
          continue;
        }
      }

      // Run integration for this date
      console.log(`Processing ${dateStr}`);
      const result = await integrator.integrateAllMetrics(user.id, dateStr);

      results.push({
        date: dateStr,
        ...result,
      });

      current.setDate(current.getDate() + 1);
    }

    // Calculate overall stats
    const overallStats = results.reduce(
      (acc, r) => ({
        totalProcessed: acc.totalProcessed + r.stats.totalProcessed,
        totalMatched: acc.totalMatched + r.stats.matched,
        totalUnmatched: acc.totalUnmatched + r.stats.unmatched,
        totalAggregated: acc.totalAggregated + r.stats.aggregated,
        daysProcessed: acc.daysProcessed + 1,
      }),
      {
        totalProcessed: 0,
        totalMatched: 0,
        totalUnmatched: 0,
        totalAggregated: 0,
        daysProcessed: 0,
      }
    );

    return NextResponse.json({
      success: true,
      stats: overallStats,
      details: results,
    });
  } catch (error) {
    console.error('Sync API error:', error);
    return NextResponse.json(
      { error: 'Sync failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get sync history
    const { data, error } = await supabase
      .from('match_history')
      .select('*')
      .eq('user_id', user.id)
      .eq('source', 'integration')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    // Calculate stats
    const stats = {
      totalSyncs: data?.length || 0,
      successfulSyncs: data?.filter((d) => d.success).length || 0,
      failedSyncs: data?.filter((d) => !d.success).length || 0,
      avgProcessingTime: data?.length
        ? data.reduce((sum, d) => sum + (d.processing_time_ms || 0), 0) / data.length
        : 0,
      lastSync: data?.[0]?.created_at || null,
    };

    return NextResponse.json({
      history: data,
      stats,
    });
  } catch (error) {
    console.error('Sync history API error:', error);
    return NextResponse.json({ error: 'Failed to fetch sync history' }, { status: 500 });
  }
}
