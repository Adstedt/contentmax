import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { runMetricsSync } from '@/lib/jobs/metrics-sync';
import { syncJobManager } from '@/lib/jobs/sync-tracker';

const MetricsSyncRequestSchema = z.object({
  projectId: z.string().uuid(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sources: z.array(z.enum(['ga4', 'gsc'])).min(1),
  dryRun: z.boolean().optional().default(false),
  forceUpdate: z.boolean().optional().default(false),
  matchThreshold: z.number().min(0).max(1).optional().default(0.7),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validate request body
    const body = await request.json();
    const validated = MetricsSyncRequestSchema.parse(body);

    // Verify user has access to the project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', validated.projectId)
      .eq('user_id', user.id)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check if a sync is already running for this project
    const existingJobs = syncJobManager.getAllJobs();
    for (const [jobId, tracker] of existingJobs.entries()) {
      const progress = tracker.getProgress();
      const config = tracker.getConfig();
      if (
        config.projectId === validated.projectId &&
        progress.status === 'running'
      ) {
        return NextResponse.json({
          error: 'Sync already in progress for this project',
          jobId,
          status: progress.status,
        }, { status: 409 });
      }
    }

    // Start the sync job
    const { jobId, tracker } = await runMetricsSync(supabase, {
      projectId: validated.projectId,
      startDate: validated.startDate,
      endDate: validated.endDate,
      sources: validated.sources,
      dryRun: validated.dryRun,
      forceUpdate: validated.forceUpdate,
      matchThreshold: validated.matchThreshold,
    });

    return NextResponse.json({
      success: true,
      jobId,
      message: 'Metrics sync job started',
      statusUrl: `/api/jobs/metrics-sync/status?jobId=${jobId}`,
    }, { status: 202 });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: 'Invalid request', 
        details: error.errors 
      }, { status: 400 });
    }

    console.error('Metrics sync error:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

// GET endpoint to check sync status
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const jobId = searchParams.get('jobId');
    const projectId = searchParams.get('projectId');

    if (jobId) {
      // Get specific job status
      const tracker = syncJobManager.getJob(jobId);
      
      if (!tracker) {
        return NextResponse.json({ 
          error: 'Job not found' 
        }, { status: 404 });
      }

      const progress = tracker.getProgress();
      const config = tracker.getConfig();

      // Verify user has access to this job's project
      const { data: project } = await supabase
        .from('projects')
        .select('id')
        .eq('id', config.projectId)
        .eq('user_id', user.id)
        .single();

      if (!project) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }

      return NextResponse.json({
        jobId,
        progress,
        config,
        summary: tracker.getSummary(),
      });
    }

    if (projectId) {
      // Get all jobs for a project
      const jobs = [];
      for (const [jobId, tracker] of syncJobManager.getAllJobs().entries()) {
        const config = tracker.getConfig();
        if (config.projectId === projectId) {
          const progress = tracker.getProgress();
          jobs.push({
            jobId,
            progress,
            config,
          });
        }
      }

      return NextResponse.json({ jobs });
    }

    // Get sync history from database
    const { data: history, error } = await supabase
      .from('sync_history')
      .select('*')
      .eq('sync_type', 'metrics')
      .order('started_at', { ascending: false })
      .limit(50);

    if (error) {
      // Table might not exist yet
      return NextResponse.json({ 
        jobs: [],
        history: [] 
      });
    }

    // Get active jobs
    const activeJobs = [];
    for (const [jobId, tracker] of syncJobManager.getAllJobs().entries()) {
      const progress = tracker.getProgress();
      const config = tracker.getConfig();
      
      // Only show jobs for user's projects
      const { data: project } = await supabase
        .from('projects')
        .select('id')
        .eq('id', config.projectId)
        .eq('user_id', user.id)
        .single();

      if (project) {
        activeJobs.push({
          jobId,
          progress,
          config,
        });
      }
    }

    return NextResponse.json({
      activeJobs,
      history: history || [],
    });

  } catch (error) {
    console.error('Fetch sync status error:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}