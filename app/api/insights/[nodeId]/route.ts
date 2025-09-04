import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServerSession } from '@/lib/auth/session';
import { z } from 'zod';

// Path parameter validation
const ParamsSchema = z.object({
  nodeId: z.string().uuid(),
});

export async function GET(request: NextRequest, { params }: { params: { nodeId: string } }) {
  try {
    // Check authentication
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validate nodeId
    const { nodeId } = ParamsSchema.parse(params);
    const supabase = createClient();

    // Fetch opportunity with related data
    const { data: opportunity, error } = await supabase
      .from('opportunities')
      .select(
        `
        *,
        node:taxonomy_nodes (
          id,
          url,
          path,
          title,
          sku_count,
          content_status,
          optimization_status,
          parent_id,
          project_id,
          metrics:node_metrics (
            source,
            date,
            impressions,
            clicks,
            ctr,
            position,
            revenue,
            transactions,
            conversion_rate
          )
        )
      `
      )
      .eq('node_id', nodeId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Insight not found' }, { status: 404 });
      }

      console.error('Error fetching opportunity:', error);
      return NextResponse.json({ error: 'Failed to fetch insight' }, { status: 500 });
    }

    return NextResponse.json(opportunity);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid node ID' }, { status: 400 });
    }

    console.error('Insight API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
