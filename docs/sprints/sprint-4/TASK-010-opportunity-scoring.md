# TASK-010: Opportunity Scoring Algorithm

## Overview

**Priority**: P0 - Blocker  
**Estimate**: 8 hours  
**Owner**: Backend Developer  
**Dependencies**: TASK-001 (Database Schema), Metrics data  
**Status**: Not Started

## Problem Statement

We need to implement the core opportunity scoring algorithm that identifies and ranks revenue opportunities based on multiple factors including search volume, CTR gap, position potential, and revenue impact.

## Technical Requirements

### 1. Opportunity Scorer Implementation

#### File: `lib/scoring/opportunity-scorer.ts`

```typescript
import { createClient } from '@/lib/supabase/server';

export interface ScoringFactors {
  searchVolume: number; // 0-1 normalized
  ctrGap: number; // 0-1 (actual vs expected CTR)
  positionPotential: number; // 0-1 (improvement potential)
  competition: number; // 0-1 (inverse of difficulty)
  revenueImpact: number; // 0-1 normalized
}

export interface OpportunityScore {
  nodeId: string;
  score: number; // 0-100
  factors: ScoringFactors;
  confidence: number; // 0-1
  recommendations: Recommendation[];
  computedAt: Date;
}

export interface Recommendation {
  type: 'ctr' | 'position' | 'content' | 'technical';
  priority: 'high' | 'medium' | 'low';
  action: string;
  impact: string;
  effort: 'low' | 'medium' | 'high';
}

/**
 * OpportunityScorer - Calculates opportunity scores for taxonomy nodes
 */
export class OpportunityScorer {
  private readonly weights = {
    searchVolume: 0.25,
    ctrGap: 0.3,
    positionPotential: 0.2,
    competition: 0.1,
    revenueImpact: 0.15,
  };

  // Industry average CTR by position (source: Advanced Web Ranking)
  private readonly ctrCurve = [
    { position: 1, ctr: 0.285 },
    { position: 2, ctr: 0.157 },
    { position: 3, ctr: 0.094 },
    { position: 4, ctr: 0.064 },
    { position: 5, ctr: 0.049 },
    { position: 6, ctr: 0.037 },
    { position: 7, ctr: 0.029 },
    { position: 8, ctr: 0.023 },
    { position: 9, ctr: 0.019 },
    { position: 10, ctr: 0.016 },
  ];

  /**
   * Calculate opportunity score for a single node
   */
  async calculateScore(node: CategoryNode): Promise<OpportunityScore> {
    // Fetch latest metrics
    const metrics = await this.fetchNodeMetrics(node.id);

    if (!metrics || !this.hasMinimumData(metrics)) {
      return this.getNoDataScore(node.id);
    }

    // Calculate individual factors
    const factors = this.calculateFactors(metrics);

    // Apply weights to get final score
    const weightedScore = this.applyWeights(factors);

    // Calculate confidence based on data quality
    const confidence = this.calculateConfidence(metrics);

    // Generate recommendations based on factors
    const recommendations = this.generateRecommendations(factors, metrics);

    return {
      nodeId: node.id,
      score: Math.round(weightedScore * 100),
      factors,
      confidence,
      recommendations,
      computedAt: new Date(),
    };
  }

  /**
   * Calculate all scoring factors
   */
  private calculateFactors(metrics: NodeMetrics): ScoringFactors {
    return {
      searchVolume: this.calculateSearchVolumeFactor(metrics),
      ctrGap: this.calculateCTRGapFactor(metrics),
      positionPotential: this.calculatePositionPotentialFactor(metrics),
      competition: this.calculateCompetitionFactor(metrics),
      revenueImpact: this.calculateRevenueImpactFactor(metrics),
    };
  }

  /**
   * Search Volume Factor (0-1)
   * Logarithmic scale to prevent large sites from dominating
   */
  private calculateSearchVolumeFactor(metrics: NodeMetrics): number {
    const impressions = metrics.gsc?.impressions || 0;

    if (impressions === 0) return 0;

    // Logarithmic normalization (1 to 1M impressions)
    const logValue = Math.log10(impressions + 1);
    const maxLog = Math.log10(1000000); // 1M impressions

    return Math.min(1, logValue / maxLog);
  }

  /**
   * CTR Gap Factor (0-1)
   * Difference between expected and actual CTR
   */
  private calculateCTRGapFactor(metrics: NodeMetrics): number {
    const actualCTR = metrics.gsc?.ctr || 0;
    const position = metrics.gsc?.position || 20;

    // Get expected CTR for position
    const expectedCTR = this.getExpectedCTR(position);

    if (expectedCTR === 0) return 0;

    // Calculate gap (how much below expected we are)
    const gap = Math.max(0, expectedCTR - actualCTR);

    // Normalize (max gap is expected CTR itself)
    return Math.min(1, gap / expectedCTR);
  }

  /**
   * Position Potential Factor (0-1)
   * How much room for improvement in rankings
   */
  private calculatePositionPotentialFactor(metrics: NodeMetrics): number {
    const position = metrics.gsc?.position || 20;

    if (position <= 1) return 0; // Already #1
    if (position > 20) return 1; // Lots of room

    // Linear scale from position 1-20
    return (position - 1) / 19;
  }

  /**
   * Competition Factor (0-1)
   * Inverse of keyword difficulty
   */
  private calculateCompetitionFactor(metrics: NodeMetrics): number {
    // Estimate competition based on position volatility
    // and click-through rate relative to position

    const position = metrics.gsc?.position || 20;
    const ctr = metrics.gsc?.ctr || 0;
    const expectedCTR = this.getExpectedCTR(position);

    // If CTR is much lower than expected, competition is likely high
    if (ctr < expectedCTR * 0.5) {
      return 0.2; // High competition
    } else if (ctr < expectedCTR * 0.75) {
      return 0.5; // Medium competition
    } else {
      return 0.8; // Low competition
    }
  }

  /**
   * Revenue Impact Factor (0-1)
   * Normalized by site's total revenue
   */
  private calculateRevenueImpactFactor(metrics: NodeMetrics): number {
    const revenue = metrics.ga4?.revenue || 0;
    const conversionRate = metrics.ga4?.conversionRate || 0;
    const aov = metrics.ga4?.aov || 0;

    if (revenue === 0 && conversionRate === 0) return 0;

    // Calculate potential revenue impact
    const currentRevenue = revenue;
    const potentialMultiplier = this.estimateRevenueMultiplier(metrics);
    const potentialRevenue = currentRevenue * potentialMultiplier;
    const revenueLift = potentialRevenue - currentRevenue;

    // Normalize (max $100K monthly lift)
    const normalized = Math.min(1, revenueLift / 100000);

    return normalized;
  }

  /**
   * Get expected CTR for a given position
   */
  private getExpectedCTR(position: number): number {
    if (position < 1) return 0;
    if (position > 10) {
      // Exponential decay after position 10
      return 0.016 * Math.exp(-0.2 * (position - 10));
    }

    const curve = this.ctrCurve.find((c) => c.position === Math.round(position));
    if (curve) return curve.ctr;

    // Interpolate between positions
    const lower = this.ctrCurve[Math.floor(position) - 1];
    const upper = this.ctrCurve[Math.ceil(position) - 1];

    if (!lower || !upper) return 0.01;

    const fraction = position - Math.floor(position);
    return lower.ctr + (upper.ctr - lower.ctr) * fraction;
  }

  /**
   * Apply weights to factors
   */
  private applyWeights(factors: ScoringFactors): number {
    let score = 0;

    Object.entries(this.weights).forEach(([key, weight]) => {
      score += factors[key] * weight;
    });

    return Math.min(1, Math.max(0, score));
  }

  /**
   * Calculate confidence score based on data quality
   */
  private calculateConfidence(metrics: NodeMetrics): number {
    let confidence = 1.0;

    // Reduce confidence for low data volume
    const impressions = metrics.gsc?.impressions || 0;
    if (impressions < 100) confidence *= 0.5;
    else if (impressions < 1000) confidence *= 0.75;

    const sessions = metrics.ga4?.sessions || 0;
    if (sessions < 10) confidence *= 0.5;
    else if (sessions < 100) confidence *= 0.75;

    // Reduce confidence for stale data
    const daysSinceUpdate = this.getDaysSinceUpdate(metrics);
    if (daysSinceUpdate > 30) confidence *= 0.5;
    else if (daysSinceUpdate > 7) confidence *= 0.75;

    return Math.max(0.1, confidence);
  }

  /**
   * Generate actionable recommendations
   */
  private generateRecommendations(factors: ScoringFactors, metrics: NodeMetrics): Recommendation[] {
    const recommendations: Recommendation[] = [];

    // CTR optimization
    if (factors.ctrGap > 0.3) {
      recommendations.push({
        type: 'ctr',
        priority: 'high',
        action: 'Optimize meta title and description for click-through rate',
        impact: `+${Math.round(factors.ctrGap * 100)}% CTR potential`,
        effort: 'low',
      });
    }

    // Position improvement
    if (factors.positionPotential > 0.5) {
      const position = metrics.gsc?.position || 20;
      recommendations.push({
        type: 'position',
        priority: position > 10 ? 'high' : 'medium',
        action: 'Improve content depth and internal linking',
        impact: `Move from position ${Math.round(position)} to top 3`,
        effort: 'medium',
      });
    }

    // Content optimization
    if (metrics.ga4?.bounceRate > 0.7) {
      recommendations.push({
        type: 'content',
        priority: 'medium',
        action: 'Improve content relevance and user experience',
        impact: 'Reduce bounce rate by 20%',
        effort: 'medium',
      });
    }

    // Technical SEO
    if (!metrics.gsc || metrics.gsc.impressions === 0) {
      recommendations.push({
        type: 'technical',
        priority: 'high',
        action: 'Fix indexing issues or submit to Google',
        impact: 'Enable search visibility',
        effort: 'low',
      });
    }

    return recommendations.sort((a, b) => {
      const priority = { high: 3, medium: 2, low: 1 };
      return priority[b.priority] - priority[a.priority];
    });
  }

  /**
   * Helper methods
   */
  private async fetchNodeMetrics(nodeId: string): Promise<NodeMetrics | null> {
    const supabase = await createClient();

    const { data } = await supabase
      .from('node_metrics')
      .select('*')
      .eq('node_id', nodeId)
      .order('date', { ascending: false })
      .limit(1)
      .single();

    return data;
  }

  private hasMinimumData(metrics: NodeMetrics): boolean {
    return (metrics.gsc?.impressions || 0) > 10 || (metrics.ga4?.sessions || 0) > 5;
  }

  private getNoDataScore(nodeId: string): OpportunityScore {
    return {
      nodeId,
      score: 0,
      factors: {
        searchVolume: 0,
        ctrGap: 0,
        positionPotential: 0,
        competition: 0,
        revenueImpact: 0,
      },
      confidence: 0,
      recommendations: [
        {
          type: 'technical',
          priority: 'high',
          action: 'Connect Google Search Console and GA4 to gather metrics',
          impact: 'Enable opportunity scoring',
          effort: 'low',
        },
      ],
      computedAt: new Date(),
    };
  }

  private estimateRevenueMultiplier(metrics: NodeMetrics): number {
    const currentPosition = metrics.gsc?.position || 20;
    const targetPosition = 3;

    if (currentPosition <= targetPosition) return 1;

    const currentCTR = this.getExpectedCTR(currentPosition);
    const targetCTR = this.getExpectedCTR(targetPosition);

    if (currentCTR === 0) return 1;

    return targetCTR / currentCTR;
  }

  private getDaysSinceUpdate(metrics: NodeMetrics): number {
    if (!metrics.updatedAt) return 999;

    const now = new Date();
    const updated = new Date(metrics.updatedAt);
    const diff = now.getTime() - updated.getTime();

    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }
}
```

### 2. Bulk Scoring Job

#### File: `lib/scoring/bulk-scorer.ts`

```typescript
export class BulkOpportunityScorer {
  private scorer: OpportunityScorer;

  async scoreAllNodes(projectId: string): Promise<BulkScoringResult> {
    const nodes = await this.fetchProjectNodes(projectId);
    const scores: OpportunityScore[] = [];

    // Process in batches
    const batches = this.createBatches(nodes, 100);

    for (const batch of batches) {
      const batchScores = await Promise.all(batch.map((node) => this.scorer.calculateScore(node)));
      scores.push(...batchScores);

      // Update progress
      await this.updateProgress(scores.length / nodes.length);
    }

    // Store in database
    await this.storeScores(scores);

    // Get top opportunities
    const topOpportunities = this.getTopOpportunities(scores, 100);

    return {
      totalNodes: nodes.length,
      scoredNodes: scores.length,
      topOpportunities,
      averageScore: this.calculateAverageScore(scores),
      distribution: this.calculateDistribution(scores),
    };
  }
}
```

## Acceptance Criteria

- [ ] Calculates scores 0-100 for all nodes
- [ ] Factors properly weighted per PRD
- [ ] CTR gap calculation uses industry curves
- [ ] Confidence scoring based on data quality
- [ ] Generates 3-5 actionable recommendations per node
- [ ] Bulk scoring completes in <30s for 3000 nodes
- [ ] Stores scores in opportunities table
- [ ] Identifies top 100 opportunities accurately
- [ ] Unit tests cover all factor calculations
- [ ] Documentation explains scoring methodology

## Implementation Steps

1. **Hour 1-2**: Core scoring algorithm
2. **Hour 3-4**: Individual factor calculations
3. **Hour 5-6**: Recommendations engine
4. **Hour 7**: Bulk processing
5. **Hour 8**: Testing and optimization

## Notes

- Consider A/B testing different weight configurations
- May need to adjust CTR curves for specific industries
- Could add ML-based scoring in future iterations
- Monitor score distribution to ensure good spread
