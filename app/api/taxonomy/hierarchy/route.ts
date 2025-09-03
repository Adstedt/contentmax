import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { HierarchyBuilder } from '@/lib/processing/hierarchy-builder';
import { HierarchyAnalyzer } from '@/lib/processing/hierarchy-analyzer';

// GET /api/taxonomy/hierarchy?project_id=xxx
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('project_id');

  if (!projectId) {
    return NextResponse.json({ error: 'Project ID required' }, { status: 400 });
  }

  const supabase = await createClient();

  // Check authentication
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Fetch all nodes for project
  const { data: nodes, error } = await supabase
    .from('taxonomy_nodes')
    .select('*')
    .eq('project_id', projectId)
    .order('depth', { ascending: true })
    .order('position', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Analyze hierarchy health
  const analyzer = new HierarchyAnalyzer();
  const analysis = analyzer.analyzeHierarchy(nodes || []);

  return NextResponse.json({
    nodes: nodes || [],
    analysis,
    stats: {
      total: nodes?.length || 0,
      maxDepth: Math.max(...(nodes?.map((n) => n.depth || 0) || [0])),
      orphaned: analysis.orphanNodes.length,
      duplicates: analysis.duplicateUrls.length,
    },
  });
}

// POST /api/taxonomy/hierarchy/build
export async function POST(request: NextRequest) {
  const body = await request.json();

  const schema = z.object({
    projectId: z.string().uuid(),
    urls: z.array(
      z.object({
        url: z.string().url(),
        title: z.string().optional(),
        metadata: z.record(z.any()).optional(),
      })
    ),
    options: z
      .object({
        autoDetectRelationships: z.boolean().default(true),
        validateIntegrity: z.boolean().default(true),
        preserveExisting: z.boolean().default(false),
      })
      .optional(),
  });

  let validated;
  try {
    validated = schema.parse(body);
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Invalid request body',
        details: error instanceof z.ZodError ? error.errors : undefined,
      },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  // Check authentication
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check project ownership
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id')
    .eq('id', validated.projectId)
    .eq('user_id', user.id)
    .single();

  if (projectError || !project) {
    return NextResponse.json({ error: 'Project not found or access denied' }, { status: 403 });
  }

  // Build hierarchy
  const builder = new HierarchyBuilder();
  const hierarchy = builder.buildFromUrls(validated.urls, {
    projectId: validated.projectId,
    ...validated.options,
  });

  // Validate if requested
  if (validated.options?.validateIntegrity) {
    const analyzer = new HierarchyAnalyzer();
    const validation = analyzer.validateHierarchy(hierarchy.nodes);

    if (!validation.isValid) {
      return NextResponse.json(
        {
          error: 'Hierarchy validation failed',
          issues: validation.issues,
          warnings: hierarchy.warnings,
        },
        { status: 400 }
      );
    }
  }

  // Prepare nodes for database insertion
  const dbNodes = hierarchy.nodes.map((node) => ({
    id: node.id,
    project_id: validated.projectId,
    url: node.url,
    path: node.path,
    title: node.title,
    parent_id: node.parent_id,
    depth: node.depth,
    position: node.position || 0,
    metadata: {
      slug: node.slug,
      breadcrumb: node.breadcrumb,
      children: node.children,
      ...node.metadata,
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));

  // Batch upsert nodes
  const { error: upsertError } = await supabase.from('taxonomy_nodes').upsert(dbNodes, {
    onConflict: validated.options?.preserveExisting ? 'url,project_id' : undefined,
    ignoreDuplicates: validated.options?.preserveExisting,
  });

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    hierarchy,
    stats: hierarchy.stats,
  });
}

// PATCH /api/taxonomy/hierarchy/node/[id]
export async function PATCH(request: NextRequest) {
  const url = new URL(request.url);
  const pathSegments = url.pathname.split('/');
  const nodeId = pathSegments[pathSegments.length - 1];

  if (!nodeId || nodeId === 'node') {
    return NextResponse.json({ error: 'Node ID required' }, { status: 400 });
  }

  const body = await request.json();

  const schema = z.object({
    parent_id: z.string().uuid().nullable().optional(),
    title: z.string().optional(),
    position: z.number().optional(),
    metadata: z.record(z.any()).optional(),
  });

  let validated;
  try {
    validated = schema.parse(body);
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Invalid request body',
        details: error instanceof z.ZodError ? error.errors : undefined,
      },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  // Check authentication
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check node ownership through project
  const { data: node, error: nodeError } = await supabase
    .from('taxonomy_nodes')
    .select('*, projects!inner(user_id)')
    .eq('id', nodeId)
    .single();

  if (nodeError || !node || node.projects.user_id !== user.id) {
    return NextResponse.json({ error: 'Node not found or access denied' }, { status: 403 });
  }

  // Update node
  const updateData: any = {
    updated_at: new Date().toISOString(),
  };

  if (validated.parent_id !== undefined) updateData.parent_id = validated.parent_id;
  if (validated.title !== undefined) updateData.title = validated.title;
  if (validated.position !== undefined) updateData.position = validated.position;
  if (validated.metadata !== undefined) {
    updateData.metadata = { ...node.metadata, ...validated.metadata };
  }

  const { data: updatedNode, error: updateError } = await supabase
    .from('taxonomy_nodes')
    .update(updateData)
    .eq('id', nodeId)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Recalculate depths if parent changed
  if (validated.parent_id !== undefined && validated.parent_id !== node.parent_id) {
    // Fetch all nodes and recalculate depths
    const { data: allNodes } = await supabase
      .from('taxonomy_nodes')
      .select('*')
      .eq('project_id', node.project_id);

    if (allNodes) {
      const builder = new HierarchyBuilder();
      const hierarchy = builder.buildFromUrls(
        allNodes.map((n) => ({
          url: n.url,
          title: n.title,
          metadata: n.metadata,
        })),
        { projectId: node.project_id }
      );

      // Update depths in database
      const updates = hierarchy.nodes.map((n) => ({
        id: n.id,
        depth: n.depth,
      }));

      for (const update of updates) {
        await supabase.from('taxonomy_nodes').update({ depth: update.depth }).eq('id', update.id);
      }
    }
  }

  return NextResponse.json(updatedNode);
}

// DELETE /api/taxonomy/hierarchy/node/[id]
export async function DELETE(request: NextRequest) {
  const url = new URL(request.url);
  const pathSegments = url.pathname.split('/');
  const nodeId = pathSegments[pathSegments.length - 1];
  const cascade = url.searchParams.get('cascade') === 'true';

  if (!nodeId || nodeId === 'node') {
    return NextResponse.json({ error: 'Node ID required' }, { status: 400 });
  }

  const supabase = await createClient();

  // Check authentication
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check node ownership through project
  const { data: node, error: nodeError } = await supabase
    .from('taxonomy_nodes')
    .select('*, projects!inner(user_id)')
    .eq('id', nodeId)
    .single();

  if (nodeError || !node || node.projects.user_id !== user.id) {
    return NextResponse.json({ error: 'Node not found or access denied' }, { status: 403 });
  }

  if (cascade) {
    // Delete node and all descendants
    // First, find all descendants
    const { data: allNodes } = await supabase
      .from('taxonomy_nodes')
      .select('id, parent_id')
      .eq('project_id', node.project_id);

    const descendants = new Set<string>();
    const findDescendants = (parentId: string) => {
      allNodes?.forEach((n) => {
        if (n.parent_id === parentId) {
          descendants.add(n.id);
          findDescendants(n.id);
        }
      });
    };

    findDescendants(nodeId);
    descendants.add(nodeId);

    // Delete all descendants
    const { error: deleteError } = await supabase
      .from('taxonomy_nodes')
      .delete()
      .in('id', Array.from(descendants));

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }
  } else {
    // Orphan children by setting their parent_id to null
    const { error: orphanError } = await supabase
      .from('taxonomy_nodes')
      .update({ parent_id: null })
      .eq('parent_id', nodeId);

    if (orphanError) {
      return NextResponse.json({ error: orphanError.message }, { status: 500 });
    }

    // Delete the node
    const { error: deleteError } = await supabase.from('taxonomy_nodes').delete().eq('id', nodeId);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true, deleted: cascade ? 'cascade' : 'single' });
}
