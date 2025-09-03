# TASK-013: Insights API

## Overview

**Priority**: P1 - Critical  
**Estimate**: 3 hours  
**Owner**: Full Stack Developer  
**Dependencies**: TASK-010 (Scoring), TASK-011 (Revenue Calculator)  
**Status**: Not Started

## Problem Statement

We need REST API endpoints to expose opportunity scores, revenue projections, and actionable insights to the frontend. The API must support filtering, sorting, pagination, and aggregation to enable the dashboard to display meaningful data efficiently.

## Technical Requirements

### 1. Core Insights API

#### File: `app/api/insights/opportunities/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

// Validation schemas
const OpportunitiesQuerySchema = z.object({
  projectId: z.string().uuid(),
  limit: z.coerce.number().min(1).max(500).default(100),
  offset: z.coerce.number().min(0).default(0),
  sortBy: z.enum(['score', 'revenue', 'volume', 'position', 'ctr_gap']).default('score'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  minScore: z.coerce.number().min(0).max(100).optional(),
  maxPosition: z.coerce.number().min(1).max(100).optional(),
  minVolume: z.coerce.number().min(0).optional(),
  depth: z.coerce.number().min(0).max(5).optional(),
  parentId: z.string().uuid().optional(),
});

export interface OpportunityResponse {
  id: string;
  nodeId: string;
  url: string;
  title: string;
  score: number;
  factors: {
    searchVolume: number;
    ctrGap: number;
    positionPotential: number;
    competition: number;
    revenueImpact: number;
  };
  metrics: {
    impressions: number;
    clicks: number;
    ctr: number;
    position: number;
    sessions: number;
    revenue: number;
    conversionRate: number;
  };
  projections: {
    targetPosition: number;
    projectedTraffic: number;
    projectedRevenue: number;
    projectedLift: number;
    confidence: number;
  };
  recommendations: Array<{
    type: string;
    priority: string;
    action: string;
    impact: string;
    effort: string;
  }>;
  hierarchy: {
    depth: number;
    parentId: string | null;
    childCount: number;
  };
}

/**
 * GET /api/insights/opportunities
 * Fetch top opportunities with filtering and sorting
 */
export async function GET(request: NextRequest) {
  try {
    // Parse and validate query parameters
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const params = OpportunitiesQuerySchema.parse(searchParams);

    const supabase = await createClient();

    // Build query
    let query = supabase
      .from('opportunities')
      .select(
        `
        *,
        taxonomy_nodes!inner (
          id,
          url,
          title,
          depth,
          parent_id,
          project_id
        ),
        node_metrics (
          impressions,
          clicks,
          ctr,
          position,
          sessions,
          revenue,
          conversion_rate,
          date
        )
      `
      )
      .eq('taxonomy_nodes.project_id', params.projectId);

    // Apply filters
    if (params.minScore !== undefined) {
      query = query.gte('score', params.minScore);
    }

    if (params.maxPosition !== undefined) {
      query = query.lte('node_metrics.position', params.maxPosition);
    }

    if (params.minVolume !== undefined) {
      query = query.gte('node_metrics.impressions', params.minVolume);
    }

    if (params.depth !== undefined) {
      query = query.eq('taxonomy_nodes.depth', params.depth);
    }

    if (params.parentId) {
      query = query.eq('taxonomy_nodes.parent_id', params.parentId);
    }

    // Apply sorting
    const sortColumn = getSortColumn(params.sortBy);
    query = query.order(sortColumn, { ascending: params.sortOrder === 'asc' });

    // Apply pagination
    query = query.range(params.offset, params.offset + params.limit - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    // Transform data to response format
    const opportunities: OpportunityResponse[] = data.map(transformOpportunity);

    // Get aggregated stats
    const stats = await getAggregatedStats(params.projectId);

    return NextResponse.json({
      opportunities,
      pagination: {
        total: count,
        limit: params.limit,
        offset: params.offset,
        hasMore: params.offset + params.limit < (count || 0),
      },
      stats,
    });
  } catch (error) {
    console.error('Opportunities API error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid parameters', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: 'Failed to fetch opportunities' }, { status: 500 });
  }
}

/**
 * Transform database record to API response
 */
function transformOpportunity(record: any): OpportunityResponse {
  const latestMetrics = record.node_metrics?.[0] || {};

  return {
    id: record.id,
    nodeId: record.node_id,
    url: record.taxonomy_nodes.url,
    title: record.taxonomy_nodes.title,
    score: record.score,
    factors: record.factors,
    metrics: {
      impressions: latestMetrics.impressions || 0,
      clicks: latestMetrics.clicks || 0,
      ctr: latestMetrics.ctr || 0,
      position: latestMetrics.position || 0,
      sessions: latestMetrics.sessions || 0,
      revenue: latestMetrics.revenue || 0,
      conversionRate: latestMetrics.conversion_rate || 0,
    },
    projections: record.projections || {},
    recommendations: record.recommendations || [],
    hierarchy: {
      depth: record.taxonomy_nodes.depth,
      parentId: record.taxonomy_nodes.parent_id,
      childCount: 0, // Will be calculated separately if needed
    },
  };
}

/**
 * Get sort column based on sort parameter
 */
function getSortColumn(sortBy: string): string {
  const columnMap: Record<string, string> = {
    score: 'score',
    revenue: 'projections->projectedLift',
    volume: 'node_metrics.impressions',
    position: 'node_metrics.position',
    ctr_gap: 'factors->ctrGap',
  };

  return columnMap[sortBy] || 'score';
}

/**
 * Get aggregated statistics for the project
 */
async function getAggregatedStats(projectId: string) {
  const supabase = await createClient();

  const { data } = await supabase
    .from('opportunities')
    .select('score, projections')
    .eq('project_id', projectId);

  if (!data || data.length === 0) {
    return {
      totalOpportunities: 0,
      averageScore: 0,
      totalPotentialRevenue: 0,
      topScoreRange: { min: 0, max: 0 },
    };
  }

  const scores = data.map((d) => d.score);
  const revenues = data.map((d) => d.projections?.projectedLift || 0);

  return {
    totalOpportunities: data.length,
    averageScore: scores.reduce((a, b) => a + b, 0) / scores.length,
    totalPotentialRevenue: revenues.reduce((a, b) => a + b, 0),
    topScoreRange: {
      min: Math.min(...scores),
      max: Math.max(...scores),
    },
  };
}
```

### 2. Node Details API

#### File: `app/api/insights/nodes/[nodeId]/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export interface NodeDetailsResponse {
  node: {
    id: string;
    url: string;
    title: string;
    depth: number;
    parentId: string | null;
  };
  opportunity: {
    score: number;
    factors: any;
    confidence: number;
    recommendations: any[];
  };
  metrics: {
    current: any;
    historical: any[];
    trends: {
      impressions: 'up' | 'down' | 'stable';
      clicks: 'up' | 'down' | 'stable';
      position: 'improving' | 'declining' | 'stable';
      revenue: 'up' | 'down' | 'stable';
    };
  };
  projections: any;
  children: Array<{
    id: string;
    url: string;
    title: string;
    score: number;
  }>;
  competitors: Array<{
    url: string;
    position: number;
    estimatedTraffic: number;
  }>;
}

/**
 * GET /api/insights/nodes/[nodeId]
 * Get detailed insights for a specific node
 */
export async function GET(request: NextRequest, { params }: { params: { nodeId: string } }) {
  try {
    const supabase = await createClient();

    // Fetch node with all related data
    const { data: nodeData, error: nodeError } = await supabase
      .from('taxonomy_nodes')
      .select(
        `
        *,
        opportunities (*),
        node_metrics (*)
      `
      )
      .eq('id', params.nodeId)
      .single();

    if (nodeError || !nodeData) {
      return NextResponse.json({ error: 'Node not found' }, { status: 404 });
    }

    // Fetch children
    const { data: children } = await supabase
      .from('taxonomy_nodes')
      .select(
        `
        id,
        url,
        title,
        opportunities (score)
      `
      )
      .eq('parent_id', params.nodeId)
      .limit(10);

    // Calculate trends
    const trends = calculateTrends(nodeData.node_metrics);

    // Build response
    const response: NodeDetailsResponse = {
      node: {
        id: nodeData.id,
        url: nodeData.url,
        title: nodeData.title,
        depth: nodeData.depth,
        parentId: nodeData.parent_id,
      },
      opportunity: nodeData.opportunities?.[0] || {
        score: 0,
        factors: {},
        confidence: 0,
        recommendations: [],
      },
      metrics: {
        current: nodeData.node_metrics?.[0] || {},
        historical: nodeData.node_metrics || [],
        trends,
      },
      projections: nodeData.opportunities?.[0]?.projections || {},
      children:
        children?.map((c) => ({
          id: c.id,
          url: c.url,
          title: c.title,
          score: c.opportunities?.[0]?.score || 0,
        })) || [],
      competitors: [], // Would need SERP API integration
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Node details API error:', error);
    return NextResponse.json({ error: 'Failed to fetch node details' }, { status: 500 });
  }
}

/**
 * Calculate metric trends from historical data
 */
function calculateTrends(metrics: any[]): any {
  if (!metrics || metrics.length < 2) {
    return {
      impressions: 'stable',
      clicks: 'stable',
      position: 'stable',
      revenue: 'stable',
    };
  }

  // Sort by date
  const sorted = metrics.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const current = sorted[0];
  const previous = sorted[1];

  return {
    impressions: getTrend(current.impressions, previous.impressions),
    clicks: getTrend(current.clicks, previous.clicks),
    position: getPositionTrend(current.position, previous.position),
    revenue: getTrend(current.revenue, previous.revenue),
  };
}

function getTrend(current: number, previous: number): 'up' | 'down' | 'stable' {
  if (!previous || !current) return 'stable';

  const change = ((current - previous) / previous) * 100;

  if (change > 5) return 'up';
  if (change < -5) return 'down';
  return 'stable';
}

function getPositionTrend(current: number, previous: number): string {
  if (!previous || !current) return 'stable';

  // Lower position is better
  if (current < previous - 0.5) return 'improving';
  if (current > previous + 0.5) return 'declining';
  return 'stable';
}
```

### 3. Aggregation API

#### File: `app/api/insights/aggregate/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export interface AggregateInsightsResponse {
  summary: {
    totalNodes: number;
    scoredNodes: number;
    averageScore: number;
    totalPotentialRevenue: number;
    totalCurrentRevenue: number;
    projectedROI: number;
  };
  distribution: {
    byScore: Array<{ range: string; count: number; percentage: number }>;
    byPosition: Array<{ range: string; count: number; avgScore: number }>;
    byDepth: Array<{ depth: number; count: number; avgScore: number }>;
  };
  topCategories: Array<{
    nodeId: string;
    url: string;
    title: string;
    aggregateScore: number;
    childCount: number;
    totalPotentialRevenue: number;
  }>;
  actionableInsights: Array<{
    type: 'quick_win' | 'high_impact' | 'low_hanging' | 'strategic';
    title: string;
    description: string;
    nodeCount: number;
    estimatedImpact: string;
    recommendedAction: string;
  }>;
}

/**
 * GET /api/insights/aggregate
 * Get aggregated insights for the entire project
 */
export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID required' }, { status: 400 });
    }

    const supabase = await createClient();

    // Fetch all opportunities with metrics
    const { data: opportunities } = await supabase
      .from('opportunities')
      .select(
        `
        *,
        taxonomy_nodes!inner (
          id,
          url,
          title,
          depth,
          parent_id
        ),
        node_metrics (
          impressions,
          position,
          revenue
        )
      `
      )
      .eq('taxonomy_nodes.project_id', projectId);

    if (!opportunities) {
      return NextResponse.json({
        summary: getEmptySummary(),
        distribution: getEmptyDistribution(),
        topCategories: [],
        actionableInsights: [],
      });
    }

    // Calculate summary
    const summary = calculateSummary(opportunities);

    // Calculate distributions
    const distribution = calculateDistributions(opportunities);

    // Find top categories
    const topCategories = await findTopCategories(projectId, opportunities);

    // Generate actionable insights
    const actionableInsights = generateActionableInsights(opportunities);

    return NextResponse.json({
      summary,
      distribution,
      topCategories,
      actionableInsights,
    });
  } catch (error) {
    console.error('Aggregate insights API error:', error);
    return NextResponse.json({ error: 'Failed to generate aggregate insights' }, { status: 500 });
  }
}

/**
 * Calculate summary statistics
 */
function calculateSummary(opportunities: any[]): any {
  const scores = opportunities.map((o) => o.score);
  const currentRevenue = opportunities.reduce(
    (sum, o) => sum + (o.node_metrics?.[0]?.revenue || 0),
    0
  );
  const potentialRevenue = opportunities.reduce(
    (sum, o) => sum + (o.projections?.projectedRevenue || 0),
    0
  );

  return {
    totalNodes: opportunities.length,
    scoredNodes: opportunities.filter((o) => o.score > 0).length,
    averageScore: scores.reduce((a, b) => a + b, 0) / scores.length,
    totalPotentialRevenue: potentialRevenue,
    totalCurrentRevenue: currentRevenue,
    projectedROI:
      currentRevenue > 0 ? ((potentialRevenue - currentRevenue) / currentRevenue) * 100 : 0,
  };
}

/**
 * Calculate score and position distributions
 */
function calculateDistributions(opportunities: any[]): any {
  // Score distribution
  const scoreRanges = [
    { range: '0-20', min: 0, max: 20 },
    { range: '21-40', min: 21, max: 40 },
    { range: '41-60', min: 41, max: 60 },
    { range: '61-80', min: 61, max: 80 },
    { range: '81-100', min: 81, max: 100 },
  ];

  const byScore = scoreRanges.map((range) => {
    const inRange = opportunities.filter((o) => o.score >= range.min && o.score <= range.max);

    return {
      range: range.range,
      count: inRange.length,
      percentage: (inRange.length / opportunities.length) * 100,
    };
  });

  // Position distribution
  const positionRanges = [
    { range: '1-3', min: 1, max: 3 },
    { range: '4-10', min: 4, max: 10 },
    { range: '11-20', min: 11, max: 20 },
    { range: '21-50', min: 21, max: 50 },
    { range: '50+', min: 51, max: 100 },
  ];

  const byPosition = positionRanges.map((range) => {
    const inRange = opportunities.filter((o) => {
      const pos = o.node_metrics?.[0]?.position || 100;
      return pos >= range.min && pos <= range.max;
    });

    const avgScore =
      inRange.length > 0 ? inRange.reduce((sum, o) => sum + o.score, 0) / inRange.length : 0;

    return {
      range: range.range,
      count: inRange.length,
      avgScore: Math.round(avgScore),
    };
  });

  // Depth distribution
  const depths = [...new Set(opportunities.map((o) => o.taxonomy_nodes.depth))];
  const byDepth = depths
    .map((depth) => {
      const atDepth = opportunities.filter((o) => o.taxonomy_nodes.depth === depth);

      const avgScore =
        atDepth.length > 0 ? atDepth.reduce((sum, o) => sum + o.score, 0) / atDepth.length : 0;

      return {
        depth,
        count: atDepth.length,
        avgScore: Math.round(avgScore),
      };
    })
    .sort((a, b) => a.depth - b.depth);

  return { byScore, byPosition, byDepth };
}

/**
 * Generate actionable insights
 */
function generateActionableInsights(opportunities: any[]): any[] {
  const insights = [];

  // Quick wins: High score, position 4-10
  const quickWins = opportunities.filter(
    (o) => o.score > 70 && o.node_metrics?.[0]?.position >= 4 && o.node_metrics?.[0]?.position <= 10
  );

  if (quickWins.length > 0) {
    insights.push({
      type: 'quick_win',
      title: 'Quick Win Opportunities',
      description: `${quickWins.length} pages ranking on page 1 with high optimization potential`,
      nodeCount: quickWins.length,
      estimatedImpact: `+${Math.round(quickWins.length * 500)} monthly visits`,
      recommendedAction: 'Optimize meta tags and content for these near-top rankings',
    });
  }

  // High impact: High volume, poor position
  const highImpact = opportunities.filter(
    (o) => o.node_metrics?.[0]?.impressions > 1000 && o.node_metrics?.[0]?.position > 20
  );

  if (highImpact.length > 0) {
    insights.push({
      type: 'high_impact',
      title: 'High Impact Opportunities',
      description: `${highImpact.length} high-volume pages with poor rankings`,
      nodeCount: highImpact.length,
      estimatedImpact: `+${Math.round(highImpact.length * 2000)} monthly visits potential`,
      recommendedAction: 'Invest in comprehensive content optimization and link building',
    });
  }

  // Low hanging fruit: Good position, poor CTR
  const lowHanging = opportunities.filter(
    (o) => o.node_metrics?.[0]?.position <= 5 && o.factors?.ctrGap > 0.5
  );

  if (lowHanging.length > 0) {
    insights.push({
      type: 'low_hanging',
      title: 'CTR Optimization Needed',
      description: `${lowHanging.length} top-ranking pages with below-average CTR`,
      nodeCount: lowHanging.length,
      estimatedImpact: `+${Math.round(lowHanging.length * 0.2)}% overall CTR improvement`,
      recommendedAction: 'A/B test meta titles and descriptions for better click-through',
    });
  }

  return insights;
}

/**
 * Helper functions
 */
async function findTopCategories(projectId: string, opportunities: any[]) {
  // Group by parent categories
  const parentNodes = opportunities.filter((o) => o.taxonomy_nodes.depth <= 2);

  return parentNodes
    .map((parent) => {
      const children = opportunities.filter(
        (o) => o.taxonomy_nodes.parent_id === parent.taxonomy_nodes.id
      );

      const aggregateScore =
        children.length > 0
          ? (parent.score + children.reduce((sum, c) => sum + c.score, 0)) / (children.length + 1)
          : parent.score;

      const totalRevenue =
        parent.projections?.projectedLift ||
        0 + children.reduce((sum, c) => sum + (c.projections?.projectedLift || 0), 0);

      return {
        nodeId: parent.taxonomy_nodes.id,
        url: parent.taxonomy_nodes.url,
        title: parent.taxonomy_nodes.title,
        aggregateScore: Math.round(aggregateScore),
        childCount: children.length,
        totalPotentialRevenue: totalRevenue,
      };
    })
    .sort((a, b) => b.aggregateScore - a.aggregateScore)
    .slice(0, 10);
}

function getEmptySummary() {
  return {
    totalNodes: 0,
    scoredNodes: 0,
    averageScore: 0,
    totalPotentialRevenue: 0,
    totalCurrentRevenue: 0,
    projectedROI: 0,
  };
}

function getEmptyDistribution() {
  return {
    byScore: [],
    byPosition: [],
    byDepth: [],
  };
}
```

## Acceptance Criteria

- [ ] GET /api/insights/opportunities with filtering and sorting
- [ ] GET /api/insights/nodes/[nodeId] for detailed view
- [ ] GET /api/insights/aggregate for dashboard stats
- [ ] Response time <200ms for 100 items
- [ ] Proper error handling with meaningful messages
- [ ] Input validation with Zod schemas
- [ ] Pagination support for large datasets
- [ ] Trend calculation from historical data
- [ ] Actionable insights generation
- [ ] TypeScript types for all responses

## Implementation Steps

1. **Hour 1**: Opportunities endpoint with filtering
2. **Hour 2**: Node details and aggregation endpoints
3. **Hour 3**: Testing and optimization

## Testing

```typescript
describe('Insights API', () => {
  it('should return top opportunities', async () => {
    const response = await fetch('/api/insights/opportunities?projectId=test');
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.opportunities).toBeDefined();
    expect(data.pagination).toBeDefined();
  });

  it('should filter by minimum score', async () => {
    const response = await fetch('/api/insights/opportunities?projectId=test&minScore=50');
    const data = await response.json();

    data.opportunities.forEach((opp) => {
      expect(opp.score).toBeGreaterThanOrEqual(50);
    });
  });

  it('should return node details', async () => {
    const response = await fetch('/api/insights/nodes/test-node-id');
    const data = await response.json();

    expect(data.node).toBeDefined();
    expect(data.metrics).toBeDefined();
    expect(data.projections).toBeDefined();
  });
});
```

## Notes

- Consider caching frequently accessed data
- May need GraphQL for more flexible querying
- Add WebSocket support for real-time updates
- Monitor API usage for rate limiting needs
