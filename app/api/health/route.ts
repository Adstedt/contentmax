import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/external/supabase/server';
import { AlertManager } from '@/lib/monitoring/alerting';

export async function GET(request: NextRequest) {
  try {
    const checks: Record<string, any> = {
      timestamp: new Date().toISOString(),
      status: 'healthy',
      checks: {},
    };

    // Check database connectivity
    try {
      const supabase = await createServerSupabaseClient();
      const { error } = await supabase.from('import_jobs').select('count').limit(1).single();

      checks.checks.database = {
        status: error ? 'unhealthy' : 'healthy',
        error: error?.message,
      };

      if (error) {
        checks.status = 'degraded';
      }
    } catch (dbError) {
      checks.checks.database = {
        status: 'unhealthy',
        error: 'Database connection failed',
      };
      checks.status = 'critical';
    }

    // Check alert system
    try {
      const alertManager = new AlertManager();
      const systemHealth = await alertManager.checkSystemHealth();

      checks.checks.alerting = {
        status: systemHealth.status,
        metrics: systemHealth.metrics,
      };

      if (systemHealth.status === 'critical') {
        checks.status = 'critical';
      } else if (systemHealth.status === 'degraded' && checks.status !== 'critical') {
        checks.status = 'degraded';
      }
    } catch (alertError) {
      checks.checks.alerting = {
        status: 'unknown',
        error: 'Could not check alert system',
      };
    }

    // Check memory usage
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const memUsage = process.memoryUsage();
      checks.checks.memory = {
        status: 'healthy',
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + ' MB',
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + ' MB',
        rss: Math.round(memUsage.rss / 1024 / 1024) + ' MB',
      };
    }

    // Return appropriate status code based on health
    const statusCode = checks.status === 'healthy' ? 200 : checks.status === 'degraded' ? 503 : 500;

    return NextResponse.json(checks, { status: statusCode });
  } catch (error) {
    console.error('Health check failed:', error);
    return NextResponse.json(
      {
        timestamp: new Date().toISOString(),
        status: 'critical',
        error: 'Health check failed',
      },
      { status: 500 }
    );
  }
}
