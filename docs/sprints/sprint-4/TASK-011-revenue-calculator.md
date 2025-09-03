# TASK-011: Revenue Calculator

## Overview

**Priority**: P0 - Blocker  
**Estimate**: 6 hours  
**Owner**: Backend Developer  
**Dependencies**: TASK-010 (Opportunity Scorer)  
**Status**: Not Started

## Problem Statement

We need to calculate potential revenue lift for each taxonomy node based on projected improvements in search position, CTR, and conversion rates. This data drives prioritization of optimization efforts.

## Technical Requirements

### 1. Revenue Calculator Implementation

#### File: `lib/scoring/revenue-calculator.ts`

```typescript
import { createClient } from '@/lib/supabase/server';

export interface RevenueProjection {
  nodeId: string;
  current: CurrentMetrics;
  projected: ProjectedMetrics;
  lift: RevenueLift;
  confidence: number;
  timeToImpact: number; // weeks
  assumptions: Assumptions;
  calculatedAt: Date;
}

export interface CurrentMetrics {
  position: number;
  impressions: number;
  clicks: number;
  ctr: number;
  sessions: number;
  revenue: number;
  transactions: number;
  conversionRate: number;
  aov: number; // Average Order Value
}

export interface ProjectedMetrics extends CurrentMetrics {
  targetPosition: number;
  improvementMethod: 'organic' | 'content' | 'technical' | 'mixed';
}

export interface RevenueLift {
  additionalClicks: number;
  additionalSessions: number;
  additionalTransactions: number;
  monthlyRevenueLift: number;
  annualRevenueLift: number;
  percentageIncrease: number;
  roi: number; // Return on Investment
}

export interface Assumptions {
  targetPosition: number;
  ctrImprovement: number;
  conversionRateImprovement: number;
  timeframe: 'conservative' | 'moderate' | 'aggressive';
  seasonalityFactor: number;
  competitionFactor: number;
}

/**
 * RevenueCalculator - Projects revenue potential from SEO improvements
 */
export class RevenueCalculator {
  // Industry CTR curves (same as OpportunityScorer)
  private readonly ctrByPosition = new Map([
    [1, 0.285],
    [2, 0.157],
    [3, 0.094],
    [4, 0.064],
    [5, 0.049],
    [6, 0.037],
    [7, 0.029],
    [8, 0.023],
    [9, 0.019],
    [10, 0.016],
  ]);

  // Time to see impact based on position improvement
  private readonly impactTimeline = {
    small: 2, // 1-3 position improvement: 2 weeks
    medium: 4, // 4-7 position improvement: 4 weeks
    large: 8, // 8-15 position improvement: 8 weeks
    massive: 12, // 15+ position improvement: 12 weeks
  };

  /**
   * Calculate revenue potential for a node
   */
  async calculatePotential(
    nodeId: string,
    targetPosition: number = 3,
    assumptions?: Partial<Assumptions>
  ): Promise<RevenueProjection> {
    // Fetch current metrics
    const currentMetrics = await this.fetchCurrentMetrics(nodeId);

    if (!this.hasMinimumData(currentMetrics)) {
      return this.getNoDataProjection(nodeId);
    }

    // Merge with default assumptions
    const fullAssumptions = this.buildAssumptions(currentMetrics, targetPosition, assumptions);

    // Calculate projected metrics
    const projectedMetrics = this.projectMetrics(currentMetrics, fullAssumptions);

    // Calculate revenue lift
    const lift = this.calculateLift(currentMetrics, projectedMetrics, fullAssumptions);

    // Calculate confidence
    const confidence = this.calculateConfidence(currentMetrics, fullAssumptions);

    // Estimate time to impact
    const timeToImpact = this.estimateTimeToImpact(currentMetrics.position, targetPosition);

    return {
      nodeId,
      current: currentMetrics,
      projected: projectedMetrics,
      lift,
      confidence,
      timeToImpact,
      assumptions: fullAssumptions,
      calculatedAt: new Date(),
    };
  }

  /**
   * Project metrics based on position improvement
   */
  private projectMetrics(current: CurrentMetrics, assumptions: Assumptions): ProjectedMetrics {
    // Calculate new CTR based on target position
    const projectedCTR = this.getExpectedCTR(assumptions.targetPosition);

    // Apply competition factor (harder to achieve theoretical CTR in competitive spaces)
    const adjustedCTR = projectedCTR * assumptions.competitionFactor;

    // Calculate new clicks
    const projectedClicks = Math.round(current.impressions * adjustedCTR);

    // Assume sessions scale with clicks (with some dropoff)
    const clickToSessionRate = current.sessions / current.clicks || 0.9;
    const projectedSessions = Math.round(projectedClicks * clickToSessionRate);

    // Project conversion rate improvement
    const projectedConversionRate =
      current.conversionRate * (1 + assumptions.conversionRateImprovement);

    // Calculate transactions
    const projectedTransactions = Math.round(projectedSessions * projectedConversionRate);

    // Calculate revenue (maintaining current AOV initially)
    const projectedRevenue = projectedTransactions * current.aov;

    return {
      ...current,
      targetPosition: assumptions.targetPosition,
      position: assumptions.targetPosition,
      ctr: adjustedCTR,
      clicks: projectedClicks,
      sessions: projectedSessions,
      conversionRate: projectedConversionRate,
      transactions: projectedTransactions,
      revenue: projectedRevenue,
      improvementMethod: this.determineMethod(current, assumptions),
    };
  }

  /**
   * Calculate revenue lift
   */
  private calculateLift(
    current: CurrentMetrics,
    projected: ProjectedMetrics,
    assumptions: Assumptions
  ): RevenueLift {
    const additionalClicks = projected.clicks - current.clicks;
    const additionalSessions = projected.sessions - current.sessions;
    const additionalTransactions = projected.transactions - current.transactions;

    // Apply seasonality factor
    const monthlyRevenueLift =
      (projected.revenue - current.revenue) * assumptions.seasonalityFactor;

    const annualRevenueLift = monthlyRevenueLift * 12;

    const percentageIncrease =
      current.revenue > 0 ? ((projected.revenue - current.revenue) / current.revenue) * 100 : 100;

    // Calculate ROI (assuming $1000 cost per optimization)
    const estimatedCost = this.estimateOptimizationCost(current, projected);
    const roi = (annualRevenueLift / estimatedCost) * 100;

    return {
      additionalClicks,
      additionalSessions,
      additionalTransactions,
      monthlyRevenueLift,
      annualRevenueLift,
      percentageIncrease,
      roi,
    };
  }

  /**
   * Build complete assumptions
   */
  private buildAssumptions(
    current: CurrentMetrics,
    targetPosition: number,
    partial?: Partial<Assumptions>
  ): Assumptions {
    const defaults: Assumptions = {
      targetPosition,
      ctrImprovement: 0, // Calculated from position
      conversionRateImprovement: this.estimateConversionImprovement(current),
      timeframe: 'moderate',
      seasonalityFactor: 1.0, // No seasonality by default
      competitionFactor: this.estimateCompetitionFactor(current),
    };

    return { ...defaults, ...partial };
  }

  /**
   * Calculate confidence in projection
   */
  private calculateConfidence(current: CurrentMetrics, assumptions: Assumptions): number {
    let confidence = 1.0;

    // Lower confidence for large position jumps
    const positionJump = current.position - assumptions.targetPosition;
    if (positionJump > 15) confidence *= 0.5;
    else if (positionJump > 10) confidence *= 0.7;
    else if (positionJump > 5) confidence *= 0.85;

    // Lower confidence for low data volume
    if (current.impressions < 100) confidence *= 0.5;
    else if (current.impressions < 1000) confidence *= 0.75;

    if (current.transactions < 5) confidence *= 0.5;
    else if (current.transactions < 20) confidence *= 0.75;

    // Lower confidence for aggressive assumptions
    if (assumptions.timeframe === 'aggressive') confidence *= 0.7;
    else if (assumptions.timeframe === 'conservative') confidence *= 1.1;

    return Math.min(1, Math.max(0.1, confidence));
  }

  /**
   * Estimate time to see impact
   */
  private estimateTimeToImpact(currentPosition: number, targetPosition: number): number {
    const improvement = currentPosition - targetPosition;

    if (improvement <= 0) return 0;
    if (improvement <= 3) return this.impactTimeline.small;
    if (improvement <= 7) return this.impactTimeline.medium;
    if (improvement <= 15) return this.impactTimeline.large;
    return this.impactTimeline.massive;
  }

  /**
   * Get expected CTR for position
   */
  private getExpectedCTR(position: number): number {
    if (position < 1) return 0;

    // Use known curve for positions 1-10
    if (position <= 10) {
      return this.ctrByPosition.get(Math.round(position)) || 0.01;
    }

    // Exponential decay for positions beyond 10
    return 0.016 * Math.exp(-0.2 * (position - 10));
  }

  /**
   * Estimate conversion rate improvement potential
   */
  private estimateConversionImprovement(current: CurrentMetrics): number {
    // If conversion rate is very low, high improvement potential
    if (current.conversionRate < 0.005) return 0.5; // 50% improvement
    if (current.conversionRate < 0.01) return 0.3; // 30% improvement
    if (current.conversionRate < 0.02) return 0.15; // 15% improvement
    return 0.05; // 5% improvement for already optimized
  }

  /**
   * Estimate competition factor
   */
  private estimateCompetitionFactor(current: CurrentMetrics): number {
    // If current CTR is much lower than expected, competition is high
    const expectedCTR = this.getExpectedCTR(current.position);
    if (expectedCTR === 0) return 0.5;

    const ctrRatio = current.ctr / expectedCTR;

    if (ctrRatio < 0.3) return 0.5; // High competition
    if (ctrRatio < 0.6) return 0.7; // Medium competition
    if (ctrRatio < 0.9) return 0.85; // Low competition
    return 1.0; // No competition factor
  }

  /**
   * Estimate optimization cost
   */
  private estimateOptimizationCost(current: CurrentMetrics, projected: ProjectedMetrics): number {
    const positionImprovement = current.position - projected.position;

    // Base costs by improvement size
    let baseCost = 500; // Minimum cost

    if (positionImprovement > 15) baseCost = 5000;
    else if (positionImprovement > 10) baseCost = 3000;
    else if (positionImprovement > 5) baseCost = 1500;
    else if (positionImprovement > 3) baseCost = 1000;

    // Adjust for competition
    if (current.position <= 3) baseCost *= 2; // Harder to improve top positions

    return baseCost;
  }

  /**
   * Determine improvement method
   */
  private determineMethod(
    current: CurrentMetrics,
    assumptions: Assumptions
  ): 'organic' | 'content' | 'technical' | 'mixed' {
    const positionImprovement = current.position - assumptions.targetPosition;

    if (positionImprovement <= 3) return 'organic'; // Link building, CTR optimization
    if (positionImprovement <= 7) return 'content'; // Content improvements
    if (positionImprovement <= 15) return 'mixed'; // Multiple strategies
    return 'technical'; // Major technical improvements needed
  }

  /**
   * Fetch current metrics from database
   */
  private async fetchCurrentMetrics(nodeId: string): Promise<CurrentMetrics> {
    const supabase = await createClient();

    // Get latest metrics
    const { data: metrics } = await supabase
      .from('node_metrics')
      .select('*')
      .eq('node_id', nodeId)
      .order('date', { ascending: false })
      .limit(7); // Get last 7 days

    if (!metrics || metrics.length === 0) {
      return this.getEmptyMetrics();
    }

    // Aggregate metrics
    return this.aggregateMetrics(metrics);
  }

  /**
   * Aggregate multiple days of metrics
   */
  private aggregateMetrics(metrics: any[]): CurrentMetrics {
    const totals = metrics.reduce(
      (acc, m) => ({
        impressions: acc.impressions + (m.impressions || 0),
        clicks: acc.clicks + (m.clicks || 0),
        sessions: acc.sessions + (m.sessions || 0),
        revenue: acc.revenue + (m.revenue || 0),
        transactions: acc.transactions + (m.transactions || 0),
        positions: [...acc.positions, m.position].filter(Boolean),
      }),
      {
        impressions: 0,
        clicks: 0,
        sessions: 0,
        revenue: 0,
        transactions: 0,
        positions: [],
      }
    );

    const avgPosition =
      totals.positions.length > 0
        ? totals.positions.reduce((a, b) => a + b) / totals.positions.length
        : 20;

    return {
      position: avgPosition,
      impressions: totals.impressions,
      clicks: totals.clicks,
      ctr: totals.impressions > 0 ? totals.clicks / totals.impressions : 0,
      sessions: totals.sessions,
      revenue: totals.revenue,
      transactions: totals.transactions,
      conversionRate: totals.sessions > 0 ? totals.transactions / totals.sessions : 0,
      aov: totals.transactions > 0 ? totals.revenue / totals.transactions : 0,
    };
  }

  private hasMinimumData(metrics: CurrentMetrics): boolean {
    return metrics.impressions > 10 || metrics.sessions > 5;
  }

  private getEmptyMetrics(): CurrentMetrics {
    return {
      position: 20,
      impressions: 0,
      clicks: 0,
      ctr: 0,
      sessions: 0,
      revenue: 0,
      transactions: 0,
      conversionRate: 0,
      aov: 0,
    };
  }

  private getNoDataProjection(nodeId: string): RevenueProjection {
    return {
      nodeId,
      current: this.getEmptyMetrics(),
      projected: { ...this.getEmptyMetrics(), targetPosition: 3, improvementMethod: 'mixed' },
      lift: {
        additionalClicks: 0,
        additionalSessions: 0,
        additionalTransactions: 0,
        monthlyRevenueLift: 0,
        annualRevenueLift: 0,
        percentageIncrease: 0,
        roi: 0,
      },
      confidence: 0,
      timeToImpact: 0,
      assumptions: {
        targetPosition: 3,
        ctrImprovement: 0,
        conversionRateImprovement: 0,
        timeframe: 'moderate',
        seasonalityFactor: 1,
        competitionFactor: 1,
      },
      calculatedAt: new Date(),
    };
  }
}
```

### 2. Bulk Revenue Calculation

#### File: `lib/scoring/bulk-revenue-calculator.ts`

```typescript
export class BulkRevenueCalculator {
  private calculator: RevenueCalculator;

  async calculateForAllNodes(
    projectId: string,
    options?: {
      targetPosition?: number;
      minImpressions?: number;
      limit?: number;
    }
  ): Promise<BulkRevenueResult> {
    const nodes = await this.fetchEligibleNodes(projectId, options);
    const projections: RevenueProjection[] = [];

    // Process in parallel batches
    const batchSize = 10;
    for (let i = 0; i < nodes.length; i += batchSize) {
      const batch = nodes.slice(i, i + batchSize);
      const batchProjections = await Promise.all(
        batch.map((node) =>
          this.calculator.calculatePotential(node.id, options?.targetPosition || 3)
        )
      );
      projections.push(...batchProjections);
    }

    // Sort by revenue potential
    const sorted = projections.sort((a, b) => b.lift.annualRevenueLift - a.lift.annualRevenueLift);

    return {
      totalNodes: nodes.length,
      projections: sorted,
      totalPotentialRevenue: this.sumRevenue(projections),
      topOpportunities: sorted.slice(0, 100),
      averageROI: this.calculateAverageROI(projections),
    };
  }
}
```

## Acceptance Criteria

- [ ] Calculates revenue projections for all nodes with metrics
- [ ] Uses industry CTR curves for position-based projections
- [ ] Factors in conversion rate improvements
- [ ] Provides confidence scores for projections
- [ ] Estimates time to see impact (2-12 weeks)
- [ ] Calculates ROI based on estimated costs
- [ ] Handles seasonality and competition factors
- [ ] Bulk processing completes <30s for 3000 nodes
- [ ] Unit tests cover all calculation methods
- [ ] Results stored in database for historical tracking

## Implementation Steps

1. **Hour 1-2**: Core calculator implementation
2. **Hour 3**: Projection methods and CTR curves
3. **Hour 4**: Confidence and assumption handling
4. **Hour 5**: Bulk processing and aggregation
5. **Hour 6**: Testing and validation

## Notes

- Consider A/B testing projections vs actual results
- May need industry-specific CTR curves
- Could add machine learning for better predictions
- Monitor projection accuracy over time
