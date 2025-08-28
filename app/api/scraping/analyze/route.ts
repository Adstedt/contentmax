import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { SitemapDrivenScraper } from '@/lib/scraping/sitemap-driven-scraper';
import { ContentScraper } from '@/lib/scraping/content-scraper';
import { ContentGapAnalyzer } from '@/lib/scraping/gap-analyzer';
import { createClient } from '@/lib/supabase/server';
import { SitemapParseResult } from '@/types/sitemap.types';
import { ScrapedContent } from '@/types/scraper.types';

const ScrapeRequestSchema = z.object({
  projectId: z.string().uuid(),
  mode: z.enum(['sitemap', 'single', 'batch']),
  sitemapResult: z.object({
    entries: z.array(z.any()),
    totalUrls: z.number(),
    categoryCounts: z.record(z.number())
  }).optional(),
  urls: z.array(z.string().url()).optional(),
  options: z.object({
    includePagination: z.boolean().optional(),
    maxPages: z.number().optional(),
    timeout: z.number().optional()
  }).optional()
});

export async function POST(request: NextRequest) {
  try {
    // Authentication check
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
    const validated = ScrapeRequestSchema.parse(body);

    // Check project ownership
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', validated.projectId)
      .eq('user_id', user.id)
      .single();

    if (projectError || !project) {
      return NextResponse.json(
        { error: 'Project not found or unauthorized' },
        { status: 404 }
      );
    }

    let scrapingResults: any[] = [];

    if (validated.mode === 'sitemap' && validated.sitemapResult) {
      // Scrape from sitemap results
      const scraper = new SitemapDrivenScraper(validated.options);
      
      try {
        const results = await scraper.scrapeFromSitemap(
          validated.sitemapResult as SitemapParseResult,
          validated.projectId
        );

        // Store results in database
        for (const result of results) {
          if (result.success && result.content) {
            await storeScrapedContent(
              supabase,
              validated.projectId,
              result.content
            );
          }
        }

        scrapingResults = results;
      } finally {
        await scraper.stop();
      }

    } else if (validated.mode === 'single' && validated.urls?.length === 1) {
      // Scrape single URL
      const scraper = new ContentScraper(validated.options);
      
      try {
        const content = await scraper.scrape(
          validated.urls[0],
          'other', // Default category
          validated.options?.includePagination || false
        );

        await storeScrapedContent(
          supabase,
          validated.projectId,
          content
        );

        scrapingResults = [{
          success: true,
          content,
          url: validated.urls[0]
        }];
      } finally {
        await scraper.cleanup();
      }

    } else if (validated.mode === 'batch' && validated.urls) {
      // Scrape multiple URLs
      const scraper = new ContentScraper(validated.options);
      
      try {
        for (const url of validated.urls) {
          try {
            const content = await scraper.scrape(
              url,
              categorizeUrl(url),
              validated.options?.includePagination || false
            );

            await storeScrapedContent(
              supabase,
              validated.projectId,
              content
            );

            scrapingResults.push({
              success: true,
              content,
              url
            });
          } catch (error) {
            scrapingResults.push({
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
              url
            });
          }
        }
      } finally {
        await scraper.cleanup();
      }
    }

    // Analyze content gaps
    const gapAnalyzer = new ContentGapAnalyzer();
    const analysis = scrapingResults
      .filter(r => r.success && r.content)
      .map(r => {
        const content = r.content as ScrapedContent;
        const gapScore = gapAnalyzer.calculateGapScore(content.gaps);
        const priority = gapAnalyzer.getGapPriority(content.gaps);
        const recommendations = gapAnalyzer.getRecommendations(content.gaps);

        return {
          url: content.url,
          category: content.urlCategory,
          wordCount: content.content.wordCount,
          contentDepth: content.quality.contentDepth,
          gapScore,
          priority,
          gaps: content.gaps,
          recommendations
        };
      });

    return NextResponse.json({
      success: true,
      results: scrapingResults.length,
      successful: scrapingResults.filter(r => r.success).length,
      failed: scrapingResults.filter(r => !r.success).length,
      analysis,
      summary: {
        totalPages: scrapingResults.length,
        averageWordCount: calculateAverage(analysis.map(a => a.wordCount)),
        averageGapScore: calculateAverage(analysis.map(a => a.gapScore)),
        criticalGaps: analysis.filter(a => a.priority === 'critical').length,
        highPriorityGaps: analysis.filter(a => a.priority === 'high').length
      }
    });

  } catch (error) {
    console.error('Scraping error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function storeScrapedContent(
  supabase: any,
  projectId: string,
  content: ScrapedContent | ScrapedContent[]
) {
  const contents = Array.isArray(content) ? content : [content];
  
  for (const item of contents) {
    const gapAnalyzer = new ContentGapAnalyzer();
    const gapScore = gapAnalyzer.calculateGapScore(item.gaps);

    const { error } = await supabase
      .from('scraped_content')
      .upsert({
        project_id: projectId,
        url: item.url,
        url_category: item.urlCategory,
        meta_title: item.seo.title,
        meta_description: item.seo.metaDescription,
        canonical_url: item.seo.canonicalUrl,
        og_data: {
          title: item.seo.ogTitle,
          description: item.seo.ogDescription,
          image: item.seo.ogImage
        },
        schema_markup: item.seo.schemaMarkup,
        content: item.content,
        word_count: item.content.wordCount,
        unique_word_count: item.content.uniqueWordCount,
        content_depth: item.quality.contentDepth,
        product_count: item.categoryData?.productCount,
        subcategories: item.categoryData?.subcategories,
        brand_data: item.brandData,
        has_unique_content: item.quality.hasUniqueContent,
        is_templatized: item.quality.isTemplatized,
        content_to_code_ratio: item.quality.contentToCodeRatio,
        content_gaps: item.gaps,
        gap_score: gapScore,
        page_number: item.pagination?.currentPage || 1,
        total_pages: item.pagination?.totalPages || 1,
        is_paginated: !!item.pagination,
        scraped_at: new Date().toISOString()
      });

    if (error) {
      console.error('Error storing scraped content:', error);
    }
  }
}

function categorizeUrl(url: string): 'category' | 'brand' | 'product' | 'blog' | 'other' {
  const urlLower = url.toLowerCase();
  
  if (urlLower.includes('/category/') || urlLower.includes('/categories/')) {
    return 'category';
  }
  if (urlLower.includes('/brand/') || urlLower.includes('/brands/')) {
    return 'brand';
  }
  if (urlLower.includes('/product/') || urlLower.includes('/products/')) {
    return 'product';
  }
  if (urlLower.includes('/blog/') || urlLower.includes('/article/')) {
    return 'blog';
  }
  
  return 'other';
}

function calculateAverage(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  return numbers.reduce((a, b) => a + b, 0) / numbers.length;
}