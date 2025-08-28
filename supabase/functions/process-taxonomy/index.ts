import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProcessRequest {
  projectId: string;
  urls: Array<{
    url: string;
    title?: string;
    metadata?: Record<string, unknown>;
  }>;
  options?: {
    batchSize?: number;
    refreshViews?: boolean;
  };
}

interface ProcessResponse {
  success: boolean;
  jobId?: string;
  message?: string;
  error?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { projectId, urls, options } = await req.json() as ProcessRequest;

    if (!projectId || !urls || urls.length === 0) {
      throw new Error('Missing required parameters');
    }

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, user_id')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single();

    if (projectError || !project) {
      throw new Error('Project not found or unauthorized');
    }

    const jobId = crypto.randomUUID();
    const batchSize = options?.batchSize || 100;
    
    const { error: jobError } = await supabase
      .from('processing_jobs')
      .insert({
        id: jobId,
        project_id: projectId,
        type: 'taxonomy_processing',
        status: 'pending',
        total_items: urls.length,
        processed_items: 0,
        metadata: { urls, options },
        created_by: user.id,
      });

    if (jobError) {
      throw new Error(`Failed to create job: ${jobError.message}`);
    }

    processUrlsAsync(supabase, jobId, projectId, urls, batchSize, options?.refreshViews);

    const response: ProcessResponse = {
      success: true,
      jobId,
      message: `Processing ${urls.length} URLs. Job ID: ${jobId}`,
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    const response: ProcessResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});

async function processUrlsAsync(
  supabase: any,
  jobId: string,
  projectId: string,
  urls: Array<{ url: string; title?: string; metadata?: Record<string, unknown> }>,
  batchSize: number,
  refreshViews = true
) {
  try {
    await supabase
      .from('processing_jobs')
      .update({ 
        status: 'processing',
        started_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    let processedCount = 0;
    
    for (let i = 0; i < urls.length; i += batchSize) {
      const batch = urls.slice(i, i + batchSize);
      
      const nodes = batch.map(urlData => ({
        project_id: projectId,
        url: urlData.url,
        title: urlData.title || extractTitleFromUrl(urlData.url),
        parent_id: null,
        depth: calculateDepth(urlData.url),
        content_status: 'pending',
        has_content: false,
        sku_count: 0,
        metadata: urlData.metadata || {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      const { error: insertError } = await supabase
        .from('taxonomy_nodes')
        .upsert(nodes, { onConflict: 'project_id,url' });

      if (insertError) {
        console.error(`Batch insert error: ${insertError.message}`);
      } else {
        processedCount += batch.length;
      }

      await supabase
        .from('processing_jobs')
        .update({
          processed_items: processedCount,
          progress: Math.round((processedCount / urls.length) * 100),
        })
        .eq('id', jobId);
    }

    await buildHierarchy(supabase, projectId);

    if (refreshViews) {
      await supabase.rpc('refresh_taxonomy_views');
    }

    await supabase
      .from('processing_jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        processed_items: processedCount,
        progress: 100,
      })
      .eq('id', jobId);

  } catch (error) {
    console.error('Processing error:', error);
    
    await supabase
      .from('processing_jobs')
      .update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        completed_at: new Date().toISOString(),
      })
      .eq('id', jobId);
  }
}

async function buildHierarchy(supabase: any, projectId: string) {
  const { data: nodes, error } = await supabase
    .from('taxonomy_nodes')
    .select('id, url')
    .eq('project_id', projectId)
    .order('url');

  if (error || !nodes) {
    console.error('Failed to fetch nodes:', error);
    return;
  }

  const urlToId = new Map<string, string>();
  nodes.forEach((node: any) => {
    urlToId.set(node.url, node.id);
  });

  const updates: any[] = [];

  for (const node of nodes) {
    const parentUrl = getParentUrl(node.url);
    const parentId = parentUrl ? urlToId.get(parentUrl) : null;

    if (parentId && parentId !== node.id) {
      updates.push({
        id: node.id,
        parent_id: parentId,
        depth: calculateDepth(node.url),
      });
    }
  }

  if (updates.length > 0) {
    for (let i = 0; i < updates.length; i += 100) {
      const batch = updates.slice(i, i + 100);
      
      for (const update of batch) {
        const { error: updateError } = await supabase
          .from('taxonomy_nodes')
          .update({
            parent_id: update.parent_id,
            depth: update.depth,
          })
          .eq('id', update.id);

        if (updateError) {
          console.error(`Update error for node ${update.id}:`, updateError);
        }
      }
    }
  }
}

function extractTitleFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathSegments = urlObj.pathname.split('/').filter(Boolean);
    
    if (pathSegments.length === 0) {
      return urlObj.hostname;
    }

    const lastSegment = pathSegments[pathSegments.length - 1];
    return lastSegment
      .replace(/[-_]/g, ' ')
      .replace(/\.\w+$/, '')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  } catch {
    return 'Unknown';
  }
}

function calculateDepth(url: string): number {
  try {
    const urlObj = new URL(url);
    return urlObj.pathname.split('/').filter(Boolean).length;
  } catch {
    return 0;
  }
}

function getParentUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const segments = urlObj.pathname.split('/').filter(Boolean);
    
    if (segments.length <= 1) {
      return null;
    }

    const parentPath = '/' + segments.slice(0, -1).join('/');
    return `${urlObj.protocol}//${urlObj.host}${parentPath}`;
  } catch {
    return null;
  }
}