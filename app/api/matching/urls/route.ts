import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { URLMatcher } from '@/lib/matching/url-matcher';
import { createClient } from '@/lib/supabase/server';

const URLMatchRequestSchema = z.object({
  sourceUrls: z.array(z.string()).min(1).max(10000),
  targetUrls: z.array(z.string()).min(1).max(10000),
  options: z.object({
    ignoreProtocol: z.boolean().optional(),
    ignoreWww: z.boolean().optional(),
    ignoreTrailingSlash: z.boolean().optional(),
    ignoreCase: z.boolean().optional(),
    ignoreQueryParams: z.boolean().optional(),
    ignoreFragment: z.boolean().optional(),
    fuzzyThreshold: z.number().min(0).max(1).optional(),
    patternMatching: z.boolean().optional(),
  }).optional(),
  projectId: z.string().uuid().optional(),
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
    const validated = URLMatchRequestSchema.parse(body);

    // If projectId provided, verify access
    if (validated.projectId) {
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('id')
        .eq('id', validated.projectId)
        .eq('user_id', user.id)
        .single();

      if (projectError || !project) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }
    }

    // Initialize URL matcher
    const matcher = new URLMatcher(validated.options);

    // Perform batch matching
    const startTime = Date.now();
    const result = matcher.batchMatch({
      sourceUrls: validated.sourceUrls,
      targetUrls: validated.targetUrls,
      options: validated.options,
    });
    const duration = Date.now() - startTime;

    // Generate report for unmatched URLs if any
    let unmatchedReport = null;
    if (result.unmatched.length > 0) {
      unmatchedReport = matcher.generateUnmatchedReport(result.unmatched);
    }

    return NextResponse.json({
      success: true,
      result,
      unmatchedReport,
      performance: {
        duration: `${duration}ms`,
        urlsPerSecond: Math.round((validated.sourceUrls.length / duration) * 1000),
      },
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: 'Invalid request', 
        details: error.errors 
      }, { status: 400 });
    }

    console.error('URL matching error:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

// GET endpoint to match project URLs with external sources
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
    const sourceUrl = searchParams.get('sourceUrl');

    if (!projectId) {
      return NextResponse.json({ 
        error: 'Project ID required' 
      }, { status: 400 });
    }

    // Verify project access
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get all taxonomy URLs for the project
    const { data: nodes, error: nodesError } = await supabase
      .from('taxonomy_nodes')
      .select('url')
      .eq('project_id', projectId);

    if (nodesError) {
      return NextResponse.json({ 
        error: 'Failed to fetch taxonomy nodes',
        details: nodesError 
      }, { status: 500 });
    }

    const targetUrls = nodes?.map(n => n.url) || [];

    if (sourceUrl) {
      // Match single URL
      const matcher = new URLMatcher();
      let bestMatch = null;
      let bestConfidence = 0;

      for (const targetUrl of targetUrls) {
        const result = matcher.matchURL(sourceUrl, targetUrl);
        if (result && result.confidence > bestConfidence) {
          bestMatch = result;
          bestConfidence = result.confidence;
        }
      }

      return NextResponse.json({ 
        sourceUrl,
        match: bestMatch,
        totalNodes: targetUrls.length,
      });
    }

    // Return all project URLs for bulk matching
    return NextResponse.json({ 
      projectId,
      urls: targetUrls,
      count: targetUrls.length,
    });

  } catch (error) {
    console.error('URL fetch error:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}