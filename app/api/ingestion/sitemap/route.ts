import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { SitemapFetcher } from '@/lib/ingestion/sitemap-fetcher';
import { createClient } from '@/lib/supabase/server';
import { ContentCategory } from '@/types/sitemap.types';

const SitemapRequestSchema = z.object({
  sitemapUrl: z.string().url('Invalid URL format'),
  projectId: z.string().uuid('Invalid project ID').optional(),
  options: z.object({
    categorizeUrls: z.boolean().optional().default(true),
    fetchChildSitemaps: z.boolean().optional().default(true),
    maxUrls: z.number().min(1).max(100000).optional(),
    streaming: z.boolean().optional().default(false),
  }).optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const body = await request.json();
    const validated = SitemapRequestSchema.parse(body);
    
    // Initialize Supabase client
    const supabase = await createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // If projectId is provided, verify user has access to the project
    if (validated.projectId) {
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('id')
        .eq('id', validated.projectId)
        .eq('user_id', user.id)
        .single();

      if (projectError || !project) {
        return NextResponse.json(
          { error: 'Project not found or access denied' },
          { status: 404 }
        );
      }
    }

    // Initialize sitemap fetcher
    const fetcher = new SitemapFetcher();
    
    // Track progress (could be sent via Server-Sent Events in the future)
    const progressUpdates: Array<{
      timestamp: string;
      totalUrls: number;
      processedUrls: number;
      currentSitemap: string;
      status: string;
      errors: string[];
    }> = [];
    
    // Fetch and parse the sitemap
    const result = await fetcher.fetch(
      validated.sitemapUrl,
      {
        categorizeUrls: validated.options?.categorizeUrls ?? true,
        fetchChildSitemaps: validated.options?.fetchChildSitemaps ?? true,
        maxUrls: validated.options?.maxUrls,
        streaming: validated.options?.streaming ?? false,
      },
      (progress) => {
        progressUpdates.push({
          timestamp: new Date().toISOString(),
          ...progress,
        });
      }
    );

    // If parsing failed completely, return error
    if (!result.success && result.entries.length === 0) {
      return NextResponse.json(
        { 
          error: 'Failed to parse sitemap',
          details: result.errors,
          progress: progressUpdates,
        },
        { status: 400 }
      );
    }

    // Store entries in database if projectId is provided
    let storedCount = 0;
    if (validated.projectId && result.entries.length > 0) {
      // TODO: Implement database storage once sitemap_entries table is created
      // For now, we'll just store the URLs in scraped_content table as a workaround
      
      // Store as scraped content with sitemap metadata
      const batchSize = 100;
      for (let i = 0; i < result.entries.length && i < 1000; i += batchSize) {
        const batch = result.entries.slice(i, i + batchSize);
        
        const scrapedEntries = batch.map(entry => ({
          project_id: validated.projectId,
          url: entry.url,
          content: JSON.stringify({
            type: 'sitemap_entry',
            category: entry.category || ContentCategory.OTHER,
            lastmod: entry.lastmod,
            changefreq: entry.changefreq,
            priority: entry.priority,
          }),
          metadata: {
            source: 'sitemap',
            category: entry.category || ContentCategory.OTHER,
            imported_at: new Date().toISOString(),
          },
          scraped_at: new Date().toISOString(),
        }));

        const { error: insertError } = await supabase
          .from('scraped_content')
          .upsert(scrapedEntries, {
            onConflict: 'project_id,url',
            ignoreDuplicates: true,
          });

        if (insertError) {
          console.error('Error inserting batch:', insertError);
          // Continue with other batches even if one fails
        } else {
          storedCount += batch.length;
        }
      }
    }

    // Prepare response
    const response = {
      success: result.success || result.entries.length > 0,
      summary: {
        totalUrls: result.totalUrls,
        storedUrls: storedCount,
        categoryCounts: result.categoryCounts,
        sitemapUrl: validated.sitemapUrl,
        projectId: validated.projectId,
      },
      entries: validated.options?.maxUrls 
        ? result.entries.slice(0, 100) // Return only first 100 for preview
        : result.entries.slice(0, 100), // Always limit response size
      errors: result.errors,
      progress: progressUpdates,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('Sitemap ingestion error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Invalid request',
          details: error.errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// GET endpoint to discover sitemaps from a domain
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const domain = searchParams.get('domain');

    if (!domain) {
      return NextResponse.json(
        { error: 'Domain parameter is required' },
        { status: 400 }
      );
    }

    // Initialize Supabase client
    const supabase = await createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Initialize sitemap fetcher
    const fetcher = new SitemapFetcher();
    
    // Discover sitemaps from the domain
    const sitemaps = await fetcher.discoverSitemaps(domain);

    return NextResponse.json({
      success: true,
      domain,
      sitemaps,
      count: sitemaps.length,
    });
  } catch (error) {
    console.error('Sitemap discovery error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to discover sitemaps',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}