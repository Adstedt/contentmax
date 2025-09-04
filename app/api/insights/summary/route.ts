import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServerSession } from '@/lib/auth/session';
import { z } from 'zod';

const QuerySchema = z.object({
  projectId: z.string().uuid(),
});

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse query parameters
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const query = QuerySchema.parse(searchParams);

    const supabase = createClient();

    // Fetch summary statistics
    const [opportunitiesResult, nodesResult, metricsResult] = await Promise.all([
      // Opportunity scores summary
      supabase
        .from('opportunities')
        .select('score, priority, revenue_potential')
        .match({ 'node.project_id': query.projectId }),

      // Nodes summary
      supabase
        .from('taxonomy_nodes')
        .select('content_status, optimization_status')
        .eq('project_id', query.projectId),

      // Metrics summary
      supabase
        .from('node_metrics')
        .select('revenue, transactions')
        .eq('node.project_id', query.projectId),
    ]);

    // Calculate aggregations
    const opportunities = opportunitiesResult.data || [];
    const nodes = nodesResult.data || [];

    const summary = {
      projectId: query.projectId,
      opportunities: {
        total: opportunities.length,
        averageScore:
          opportunities.length > 0
            ? opportunities.reduce((sum, o) => sum + o.score, 0) / opportunities.length
            : 0,
        priorityDistribution: {
          critical: opportunities.filter((o) => o.priority === 1).length,
          high: opportunities.filter((o) => o.priority === 2).length,
          medium: opportunities.filter((o) => o.priority === 3).length,
          low: opportunities.filter((o) => o.priority === 4).length,
          veryLow: opportunities.filter((o) => o.priority === 5).length,
        },
        totalRevenuePotential: opportunities.reduce(
          (sum, o) => sum + (o.revenue_potential || 0),
          0
        ),
      },
      nodes: {
        total: nodes.length,
        contentStatus: {
          optimized: nodes.filter((n) => n.content_status === 'optimized').length,
          outdated: nodes.filter((n) => n.content_status === 'outdated').length,
          missing: nodes.filter((n) => n.content_status === 'missing').length,
          noContent: nodes.filter((n) => !n.content_status).length,
        },
        optimizationStatus: {
          completed: nodes.filter((n) => n.optimization_status === 'completed').length,
          inProgress: nodes.filter((n) => n.optimization_status === 'in_progress').length,
          pending: nodes.filter((n) => n.optimization_status === 'pending').length,
          notStarted: nodes.filter((n) => !n.optimization_status).length,
        },
      },
      topOpportunities: opportunities
        .sort((a, b) => b.score - a.score)
        .slice(0, 10)
        .map((o) => ({
          nodeId: o.node_id,
          score: o.score,
          priority: o.priority,
          revenuePotential: o.revenue_potential,
        })),
    };

    return NextResponse.json(summary, {
      headers: {
        'Cache-Control': 'private, max-age=300', // 5 minutes
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Project ID is required', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Summary API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
