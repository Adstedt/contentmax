import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { SearchConsoleClient } from '@/lib/external/search-console';
import { createClient } from '@/lib/external/supabase/server';
import { GSCError } from '@/types/google.types';

const FetchDataSchema = z.object({
  projectId: z.string().uuid(),
  siteUrl: z.string().url(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dimensions: z.array(z.enum(['page', 'query', 'country', 'device', 'searchAppearance'])).optional(),
  filters: z.array(z.object({
    dimension: z.enum(['page', 'query', 'country', 'device', 'searchAppearance']),
    operator: z.enum(['equals', 'contains', 'notContains', 'notEquals']).optional(),
    expression: z.string().optional(),
  })).optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validated = FetchDataSchema.parse(body);

    // Check project ownership
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, organization_id')
      .eq('id', validated.projectId)
      .single();

    if (projectError || !project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Check user has access to project's organization
    const { data: userOrg, error: orgError } = await supabase
      .from('users')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    if (orgError || !userOrg || userOrg.organization_id !== project.organization_id) {
      return NextResponse.json(
        { error: 'No access to this project' },
        { status: 403 }
      );
    }

    // Initialize Search Console client
    const gscClient = new SearchConsoleClient();
    await gscClient.initialize(user.id);

    // Fetch data from Google Search Console
    const performanceData = await gscClient.getSearchAnalytics(
      validated.siteUrl,
      {
        startDate: validated.startDate,
        endDate: validated.endDate,
        dimensions: validated.dimensions,
        dimensionFilterGroups: validated.filters ? [{
          filters: validated.filters,
          groupType: 'and',
        }] : undefined,
        dataState: 'final',
      }
    );

    // Store data in database
    await gscClient.storePerformanceData(
      validated.projectId,
      validated.siteUrl,
      performanceData
    );

    // Update last sync timestamp
    // TODO: Create google_integrations table or use existing integrations table
    // await supabase
    //   .from('google_integrations')
    //   .update({ last_sync: new Date().toISOString() })
    //   .eq('user_id', user.id);

    return NextResponse.json({
      success: true,
      data: performanceData,
    });
  } catch (error) {
    console.error('Error fetching GSC data:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    if (error instanceof GSCError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.code === 'QUOTA_EXCEEDED' ? 429 : 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to fetch GSC data' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Initialize Search Console client
    const gscClient = new SearchConsoleClient();
    await gscClient.initialize(user.id);

    // Get list of sites
    const sites = await gscClient.getSites();

    return NextResponse.json({
      success: true,
      sites,
    });
  } catch (error) {
    console.error('Error fetching sites:', error);
    
    if (error instanceof GSCError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to fetch sites' },
      { status: 500 }
    );
  }
}