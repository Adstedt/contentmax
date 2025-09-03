import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { GA4Client } from '@/lib/integrations/analytics';
import { GA4Config } from '@/types/ga4.types';

const GA4MetricsRequestSchema = z.object({
  urls: z.array(z.string().url()).min(1).max(200),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  projectId: z.string().uuid(),
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
    const validated = GA4MetricsRequestSchema.parse(body);

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

    // Get GA4 property ID from environment for now
    // TODO: Store per-project GA4 property ID in database
    const ga4PropertyId = process.env.GA4_PROPERTY_ID;
    
    if (!ga4PropertyId) {
      return NextResponse.json({ 
        error: 'GA4 not configured' 
      }, { status: 400 });
    }

    // Get GA4 credentials from environment or database
    const ga4Config: GA4Config = {
      propertyId: ga4PropertyId,
      serviceAccountKey: process.env.GA4_SERVICE_ACCOUNT_KEY,
      cacheEnabled: true,
      cacheTTL: 3600000, // 1 hour
      rateLimit: {
        maxConcurrent: 10,
        interval: 1000,
      },
    };

    // Initialize GA4 client
    const ga4Client = new GA4Client(ga4Config);

    // Fetch metrics for all URLs
    const metrics = await ga4Client.fetchBatchMetrics({
      urls: validated.urls,
      startDate: validated.startDate,
      endDate: validated.endDate,
    });

    // Store metrics in database
    const metricsToStore = metrics.map((metric) => ({
      project_id: validated.projectId,
      url: metric.url,
      source: 'ga4',
      metric_date: validated.endDate,
      data: {
        revenue: metric.revenue,
        transactions: metric.transactions,
        conversionRate: metric.conversionRate,
        averageOrderValue: metric.averageOrderValue,
        sessions: metric.sessions,
        bounceRate: metric.bounceRate,
        engagementRate: metric.engagementRate,
        averageEngagementTime: metric.averageEngagementTime,
        eventsPerSession: metric.eventsPerSession,
        newUsers: metric.newUsers,
        totalUsers: metric.totalUsers,
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    // Upsert metrics (update if exists, insert if not)
    const { error: upsertError } = await supabase
      .from('node_metrics')
      .upsert(metricsToStore, {
        onConflict: 'project_id,url,source,metric_date',
        returning: 'minimal',
      });

    if (upsertError) {
      console.error('Error storing metrics:', upsertError);
      return NextResponse.json({ 
        error: 'Failed to store metrics',
        details: upsertError 
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      metricsCount: metrics.length,
      dateRange: {
        startDate: validated.startDate,
        endDate: validated.endDate,
      },
      data: metrics,
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: 'Invalid request', 
        details: error.errors 
      }, { status: 400 });
    }

    console.error('GA4 metrics error:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const projectId = searchParams.get('projectId');
    const url = searchParams.get('url');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!projectId) {
      return NextResponse.json({ 
        error: 'Project ID required' 
      }, { status: 400 });
    }

    // Build query
    let query = supabase
      .from('node_metrics')
      .select('*')
      .eq('project_id', projectId)
      .eq('source', 'ga4');

    if (url) {
      query = query.eq('url', url);
    }

    if (startDate && endDate) {
      query = query
        .gte('metric_date', startDate)
        .lte('metric_date', endDate);
    }

    const { data, error } = await query
      .order('metric_date', { ascending: false })
      .limit(1000);

    if (error) {
      return NextResponse.json({ 
        error: 'Failed to fetch metrics',
        details: error 
      }, { status: 500 });
    }

    return NextResponse.json({ data });

  } catch (error) {
    console.error('Fetch GA4 metrics error:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}