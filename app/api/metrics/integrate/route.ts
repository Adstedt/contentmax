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

    // Get date from request or use today
    const body = await request.json().catch(() => ({}));
    const date = body.date || new Date().toISOString().split('T')[0];

    // Initialize integrator
    const integrator = new MetricsIntegrator();

    // Run integration
    console.log(`Starting metrics integration for user ${user.id} on ${date}`);
    const result = await integrator.integrateAllMetrics(user.id, date);

    // Log integration attempt
    await supabase.from('match_history').insert({
      source: 'integration',
      identifier: date,
      match_strategy: 'full_integration',
      success: result.success,
      error_reason: result.errors.join(', ') || null,
      processing_time_ms: result.processingTimeMs,
      user_id: user.id,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Integration API error:', error);
    return NextResponse.json(
      {
        error: 'Integration failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
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

    // Get integration status
    const integrator = new MetricsIntegrator();
    const status = await integrator.getIntegrationStatus(user.id);

    return NextResponse.json(status);
  } catch (error) {
    console.error('Status API error:', error);
    return NextResponse.json({ error: 'Failed to get status' }, { status: 500 });
  }
}
