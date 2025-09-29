import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/external/supabase/server';
import { ImportJobManager } from '@/lib/jobs/import-job-manager';
import { AlertManager } from '@/lib/monitoring/alerting';

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

    // Get time window from query params (default 24 hours)
    const searchParams = request.nextUrl.searchParams;
    const hours = parseInt(searchParams.get('hours') || '24');
    const timeWindowMs = hours * 60 * 60 * 1000;

    // Get job statistics
    const jobManager = new ImportJobManager();
    const stats = await jobManager.getJobStats(timeWindowMs);

    // Get recent failures
    const since = new Date(Date.now() - timeWindowMs).toISOString();
    const { data: recentFailures } = await supabase
      .from('import_jobs')
      .select('*')
      .eq('status', 'failed')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(10);

    // Get system health
    const alertManager = new AlertManager();
    const health = await alertManager.checkSystemHealth();

    // Calculate additional metrics
    const metrics = {
      ...stats,
      averageProcessingTime: 0, // Would calculate from job timestamps
      queueDepth: stats.pending + stats.retrying,
      healthStatus: health.status,
      systemMetrics: health.metrics,
    };

    return NextResponse.json({
      metrics,
      recentFailures: recentFailures || [],
      health:
        metrics.successRate > 90 ? 'healthy' : metrics.successRate > 70 ? 'degraded' : 'critical',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to fetch monitoring data:', error);
    return NextResponse.json({ error: 'Failed to fetch monitoring data' }, { status: 500 });
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
    const { action, jobId } = body;

    const jobManager = new ImportJobManager();

    switch (action) {
      case 'retry':
        if (!jobId) {
          return NextResponse.json({ error: 'Job ID required for retry' }, { status: 400 });
        }
        await jobManager.retryJob(jobId);
        return NextResponse.json({ success: true, message: `Job ${jobId} queued for retry` });

      case 'check-health': {
        const alertManager = new AlertManager();
        const health = await alertManager.checkSystemHealth();
        return NextResponse.json(health);
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Monitoring action failed:', error);
    return NextResponse.json({ error: 'Action failed' }, { status: 500 });
  }
}
