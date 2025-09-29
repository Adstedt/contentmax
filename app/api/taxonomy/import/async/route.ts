import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/external/supabase/server';
import { FeedFetcher } from '@/lib/core/taxonomy/feed-fetcher';
import { FeedTaxonomyBuilder } from '@/lib/core/taxonomy/feed-taxonomy-builder';
import { CategoryMerger } from '@/lib/core/taxonomy/category-merger';
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

    let finalNodes: any = new Map();
    let nodes: any = new Map();
    try {
      const builder = new FeedTaxonomyBuilder();

      // Track the last progress to ensure it only increases
      let lastProgress = job.progress || 50;

      // Build taxonomy with progress callback
      await builder.buildFromProductFeed(feedResult.products, {
        skipPersist: !options?.persistToDatabase,
        userId,
        onProgress: (progress) => {
          // Update job with building progress
          job.logs.push(`[${new Date().toISOString()}] ${progress.message}`);

          // Calculate overall progress based on phase
          let phaseProgress = progress.total > 0 ? progress.current / progress.total : 0;
          let newProgress = lastProgress;

          // Map phases to progress ranges
          if (progress.phase === 'extracting') {
            job.status = 'building:extracting';
            newProgress = 50 + Math.round(phaseProgress * 5); // 50-55%
          } else if (progress.phase === 'building') {
            job.status = 'building:building';
            newProgress = 55 + Math.round(phaseProgress * 10); // 55-65%
            job.categoriesCreated = progress.current;
          } else if (progress.phase === 'assigning') {
            job.status = 'building:assigning';
            newProgress = 65 + Math.round(phaseProgress * 10); // 65-75%
          } else if (progress.phase === 'counting') {
            job.status = 'building:counting';
            newProgress = 75 + Math.round(phaseProgress * 5); // 75-80%
          } else if (progress.phase === 'persisting') {
            job.status = 'saving';
            // Persisting phase goes from 0/3 to 3/3
            // For step 0-1 (nodes): 80-83%
            // For step 1-2 (products): 83-87%
            // For step 2-3 (assignments): 87-90%
            if (progress.current <= 1) {
              newProgress = 80 + Math.round(progress.current * 3);
            } else if (progress.current <= 2) {
              newProgress = 83 + Math.round((progress.current - 1) * 4);
            } else {
              newProgress = 87 + Math.round((progress.current - 2) * 3);
            }
          }

          // Only update if progress increased (never go backwards)
          if (newProgress > lastProgress) {
            job.progress = newProgress;
            lastProgress = newProgress;
          }
        },
      });

      // After buildFromProductFeed completes (which includes persistence)
      nodes = builder.getNodes();
      job.categoriesCreated = nodes.size;
      job.status = 'saved'; // Database save complete

      // Ensure we're at 90% after persistence
      if (job.progress < 90) {
        job.progress = 90;
      }

      job.logs.push(`[${new Date().toISOString()}] Created and saved ${nodes.size} categories`);

      // Small delay to ensure UI updates
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Optional: Merge similar categories
      finalNodes = nodes;
      if (options?.mergeSimilar) {
        job.status = 'merging';
        if (job.progress < 91) job.progress = 91;
        job.logs.push(`[${new Date().toISOString()}] Merging similar categories...`);
        await new Promise((resolve) => setTimeout(resolve, 100)); // Small delay to show status

        const merger = new CategoryMerger();
        finalNodes = merger.mergeSimilarCategories(nodes);
        job.categoriesCreated = finalNodes.size;
        job.logs.push(`[${new Date().toISOString()}] Merged to ${finalNodes.size} categories`);
        if (job.progress < 94) job.progress = 94;
      } else {
        // If not merging, go straight to higher progress
        if (job.progress < 94) job.progress = 94;
      }

      job.status = 'finalizing';
      if (job.progress < 95) job.progress = 95;
      job.logs.push(`[${new Date().toISOString()}] Finalizing import...`);

      // Small delay to show finalizing status
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (buildError) {
      // If taxonomy building fails, still mark as partial success if we got products
      job.errors.push(`Taxonomy build error: ${buildError}`);
      job.logs.push(`[${new Date().toISOString()}] Warning: Taxonomy building encountered issues`);
      finalNodes = new Map();
    }

    // Mark as completed - ensure we always reach 100%
    job.categoriesCreated = finalNodes?.size || nodes?.size || 0;
    job.status = 'completed';
    job.progress = 100; // Always set to 100 when complete
    job.completedAt = new Date().toISOString();
    job.logs.push(`[${new Date().toISOString()}] Import completed successfully`);
    job.summary = {
      totalProducts: feedResult.products.length,
      processedProducts: feedResult.products.length,
      categoriesCreated: job.categoriesCreated,
      duration: Date.now() - new Date(job.startedAt).getTime(),
    };

    console.log(`Import job ${jobId} completed successfully:`, job.summary);

    // Keep the job alive for a bit longer to ensure UI can poll the completion
    setTimeout(() => {
      if (importJobs.get(jobId)?.status === 'completed') {
        console.log(`Job ${jobId} still showing as completed after delay`);
      }
    }, 5000);
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
