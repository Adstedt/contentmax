import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { BatchImporter } from '@/lib/import/batch-importer';
import { ImportProgressTracker, progressManager } from '@/lib/import/progress-tracker';

const BatchImportSchema = z.object({
  urls: z.array(z.object({
    url: z.string().url(),
    title: z.string().optional(),
    metadata: z.record(z.any()).optional(),
  })).min(1).max(10000),
  projectId: z.string().uuid(),
  options: z.object({
    chunkSize: z.number().min(10).max(500).default(100),
    handleDuplicates: z.enum(['skip', 'update', 'error']).default('skip'),
    buildRelationships: z.boolean().default(true),
  }).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validated = BatchImportSchema.parse(body);

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', validated.projectId)
      .eq('user_id', user.id)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const importId = crypto.randomUUID();
    const tracker = progressManager.createTracker(importId, validated.urls.length);

    const { data: importRecord, error: importError } = await supabase
      .from('import_history')
      .insert({
        id: importId,
        project_id: validated.projectId,
        user_id: user.id,
        total_nodes: validated.urls.length,
        status: 'processing',
        options: validated.options || {},
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (importError) {
      return NextResponse.json({ 
        error: 'Failed to create import record', 
        details: importError 
      }, { status: 500 });
    }

    const importer = new BatchImporter(supabase, tracker);
    
    importer.import(
      validated.urls,
      validated.projectId,
      validated.options
    ).then(async (result) => {
      await supabase
        .from('import_history')
        .update({
          status: result.success ? 'completed' : 'failed',
          completed_at: new Date().toISOString(),
          successful_nodes: result.successCount,
          failed_nodes: result.failedCount,
          errors: result.errors,
        })
        .eq('id', importId);
      tracker.complete(result.successCount, result.failedCount);
    }).catch(async (error) => {
      await supabase
        .from('import_history')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          errors: [{ message: error.message }],
        })
        .eq('id', importId);
      tracker.error(error.message);
    });

    return NextResponse.json({
      importId,
      message: 'Import started successfully',
      totalNodes: validated.urls.length,
      streamUrl: `/api/import/stream?id=${importId}`,
    }, { status: 202 });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: 'Invalid input', 
        details: error.errors 
      }, { status: 400 });
    }

    console.error('Batch import error:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const projectId = searchParams.get('projectId');
    const importId = searchParams.get('importId');

    if (importId) {
      const { data, error } = await supabase
        .from('import_history')
        .select('*')
        .eq('id', importId)
        .eq('user_id', user.id)
        .single();

      if (error || !data) {
        return NextResponse.json({ error: 'Import not found' }, { status: 404 });
      }

      return NextResponse.json({ data });
    }

    let query = supabase
      .from('import_history')
      .select('*')
      .eq('user_id', user.id)
      .order('started_at', { ascending: false })
      .limit(50);

    if (projectId) {
      query = query.eq('project_id', projectId);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ 
        error: 'Failed to fetch imports', 
        details: error 
      }, { status: 500 });
    }

    return NextResponse.json({ data });

  } catch (error) {
    console.error('Fetch imports error:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}