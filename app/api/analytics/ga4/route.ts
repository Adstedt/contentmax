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

    // First we need to find or create nodes for these URLs
    const { data: nodes } = await supabase
      .from('taxonomy_nodes')
      .select('id, url')
      .eq('project_id', validated.projectId)
      .in('url', validated.urls);
    
    const urlToNodeId = new Map(nodes?.map(n => [n.url, n.id]) || []);
    
    // Store metrics in database - map to correct schema
    const metricsToStore = metrics
      .filter(metric => urlToNodeId.has(metric.url))
      .map((metric) => ({
        node_id: urlToNodeId.get(metric.url)!,
        source: 'ga4',
        date: validated.endDate,
        revenue: metric.revenue,
        transactions: metric.transactions,
        conversion_rate: metric.conversionRate,
        sessions: metric.sessions,
        bounce_rate: metric.bounceRate,
        avg_session_duration: metric.averageEngagementTime,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

    if (metricsToStore.length === 0) {
      return NextResponse.json({ 
        message: 'No matching nodes found for URLs',
        processed: 0 
      });
    }

    // Upsert metrics (update if exists, insert if not)
    const { error: upsertError } = await supabase
      .from('node_metrics')
      .upsert(metricsToStore, {
        onConflict: 'node_id,source,date'
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