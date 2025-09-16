import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { FeedFetcher } from '@/lib/taxonomy/feed-fetcher';
import { FeedTaxonomyBuilder } from '@/lib/taxonomy/feed-taxonomy-builder';
import { CategoryMerger } from '@/lib/taxonomy/category-merger';
import { z } from 'zod';

// Store import jobs in memory (in production, use Redis or database)
const importJobs = new Map<string, any>();

// Schema for import request
const ImportRequestSchema = z.object({
  url: z.string().url(),
  options: z
    .object({
      mergeSimilar: z.boolean().default(true),
      persistToDatabase: z.boolean().default(true),
      fetchMetaTags: z.boolean().default(false),
    })
    .optional(),
});

// POST - Start an import job
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = ImportRequestSchema.parse(body);

    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Generate job ID
    const jobId = `import_${user.id}_${Date.now()}`;

    // Initialize job status
    const job = {
      id: jobId,
      status: 'pending',
      progress: 0,
      totalProducts: 0,
      processedProducts: 0,
      categoriesCreated: 0,
      errors: [],
      logs: [],
      startedAt: new Date().toISOString(),
      url: validated.url,
    };

    importJobs.set(jobId, job);

    // Start the import in the background
    processImportAsync(jobId, validated.url, validated.options, user.id);

    // Return immediately with job ID
    return NextResponse.json({
      jobId,
      status: 'started',
      message: 'Import job started',
    });
  } catch (error) {
    console.error('Failed to start import:', error);
    return NextResponse.json(
      {
        error: 'Failed to start import',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// GET - Check import job status
export async function GET(request: NextRequest) {
  const jobId = request.nextUrl.searchParams.get('jobId');

  if (!jobId) {
    return NextResponse.json({ error: 'Job ID required' }, { status: 400 });
  }

  const job = importJobs.get(jobId);

  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  // Calculate progress percentage
  const progressPercent =
    job.totalProducts > 0 ? Math.round((job.processedProducts / job.totalProducts) * 100) : 0;

  return NextResponse.json({
    ...job,
    progressPercent,
  });
}

// Background processing function
async function processImportAsync(jobId: string, url: string, options: any, userId: string) {
  const job = importJobs.get(jobId);
  if (!job) return;

  try {
    // Update status to processing
    job.status = 'fetching';
    job.logs.push(`[${new Date().toISOString()}] Fetching feed from ${url}`);

    // Fetch the feed
    const fetcher = new FeedFetcher();
    const feedResult = await fetcher.fetchFromUrl(url);

    job.totalProducts = feedResult.products.length;
    job.logs.push(`[${new Date().toISOString()}] Found ${feedResult.products.length} products`);
    job.status = 'processing';

    // Quick initial processing for UI
    job.processedProducts = feedResult.products.length;
    job.progress = 50; // 50% after fetching
    job.logs.push(`[${new Date().toISOString()}] Products ready for taxonomy building`);

    // Now build and persist taxonomy - with progress tracking
    job.status = 'building';
    job.logs.push(`[${new Date().toISOString()}] Building taxonomy structure...`);

    let finalNodes: any;
    try {
      const builder = new FeedTaxonomyBuilder();

      // Build taxonomy with progress callback
      await builder.buildFromProductFeed(feedResult.products, {
        skipPersist: !options?.persistToDatabase,
        userId,
        onProgress: (progress) => {
          // Update job with building progress
          job.status = `building:${progress.phase}`;
          job.logs.push(`[${new Date().toISOString()}] ${progress.message}`);

          // Calculate overall progress based on phase
          let phaseProgress = progress.total > 0 ? progress.current / progress.total : 0;

          // Map phases to progress ranges
          if (progress.phase === 'extracting') {
            job.progress = 50 + Math.round(phaseProgress * 10); // 50-60%
          } else if (progress.phase === 'building') {
            job.progress = 60 + Math.round(phaseProgress * 15); // 60-75%
            job.categoriesCreated = progress.current;
          } else if (progress.phase === 'assigning') {
            job.progress = 75 + Math.round(phaseProgress * 10); // 75-85%
          } else if (progress.phase === 'counting') {
            job.progress = 85 + Math.round(phaseProgress * 5); // 85-90%
          }
        },
      });

      const nodes = builder.getNodes();
      job.categoriesCreated = nodes.size;
      job.status = 'building'; // Reset status from building:counting
      job.progress = 90; // Ensure we're at 90% after counting
      job.logs.push(`[${new Date().toISOString()}] Created ${nodes.size} categories`);

      // Optional: Merge similar categories
      finalNodes = nodes;
      if (options?.mergeSimilar) {
        job.status = 'merging';
        job.progress = 91;
        job.logs.push(`[${new Date().toISOString()}] Merging similar categories...`);
        const merger = new CategoryMerger();
        finalNodes = merger.mergeSimilarCategories(nodes);
        job.categoriesCreated = finalNodes.size;
        job.logs.push(`[${new Date().toISOString()}] Merged to ${finalNodes.size} categories`);
        job.progress = 93;
      } else {
        // If not merging, go straight to higher progress
        job.progress = 93;
      }

      job.status = 'finalizing';
      job.progress = 95;
      job.logs.push(`[${new Date().toISOString()}] Finalizing import...`);

      // Small delay to show finalizing status
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (buildError) {
      // If taxonomy building fails, still mark as partial success if we got products
      job.errors.push(`Taxonomy build error: ${buildError}`);
      job.logs.push(`[${new Date().toISOString()}] Warning: Taxonomy building encountered issues`);
      finalNodes = new Map();
    }

    job.categoriesCreated = finalNodes.size || 0;
    job.status = 'completed';
    job.progress = 100;
    job.completedAt = new Date().toISOString();
    job.logs.push(`[${new Date().toISOString()}] Import completed successfully`);
    job.summary = {
      totalProducts: feedResult.products.length,
      categoriesCreated: finalNodes.size || 0,
      duration: Date.now() - new Date(job.startedAt).getTime(),
    };
  } catch (error) {
    console.error('Import job failed:', error);
    job.status = 'failed';
    job.errors.push(error instanceof Error ? error.message : 'Unknown error');
    job.logs.push(`[${new Date().toISOString()}] Import failed: ${error}`);
    job.failedAt = new Date().toISOString();
  }

  // Clean up old jobs after 2 hours (give plenty of time for UI to poll)
  setTimeout(
    () => {
      console.log(`Cleaning up import job ${jobId}`);
      importJobs.delete(jobId);
    },
    2 * 60 * 60 * 1000
  );
}
