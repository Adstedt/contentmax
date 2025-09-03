import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { runMetricsSync } from '@/lib/jobs/metrics-sync';

// This endpoint is designed to be called by Vercel Cron
// Configure in vercel.json:
// {
//   "crons": [{
//     "path": "/api/cron/metrics-sync",
//     "schedule": "0 2 * * *"  // Daily at 2 AM UTC
//   }]
// }

export async function GET(request: NextRequest) {
  try {
    // Verify the request is from Vercel Cron
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createServiceRoleClient();

    // Get all active projects
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select('id, settings')
      .eq('status', 'active');

    if (projectsError) {
      console.error('Failed to fetch projects:', projectsError);
      return NextResponse.json({ 
        error: 'Failed to fetch projects' 
      }, { status: 500 });
    }

    const jobs = [];
    const errors = [];

    // Start sync for each active project
    for (const project of projects || []) {
      try {
        // Check if metrics sync is enabled in project settings
        const settings = project.settings as Record<string, any> | null;
        const syncEnabled = settings?.metrics_sync_enabled ?? true;
        if (!syncEnabled) {
          continue;
        }

        // Calculate date range (last 7 days by default)
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 7);

        const { jobId, tracker } = await runMetricsSync(supabase, {
          projectId: project.id,
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          sources: ['ga4', 'gsc'],
          dryRun: false,
          forceUpdate: false,
          matchThreshold: 0.7,
        });

        jobs.push({
          projectId: project.id,
          jobId,
          status: 'started',
        });
      } catch (error) {
        console.error(`Failed to start sync for project ${project.id}:`, error);
        errors.push({
          projectId: project.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Started ${jobs.length} sync jobs`,
      jobs,
      errors,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Cron metrics sync error:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

// Manual trigger with POST (for testing)
export async function POST(request: NextRequest) {
  // Allow manual trigger in development
  if (process.env.NODE_ENV === 'development') {
    return GET(request);
  }
  
  return NextResponse.json({ 
    error: 'Method not allowed' 
  }, { status: 405 });
}