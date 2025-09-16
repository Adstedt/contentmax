import type {
  SearchMetrics,
  AnalyticsMetrics,
} from '@/components/taxonomy/D3Visualization/NodeTooltip';

export interface ImpactProjection {
  revenue: {
    current: number;
    projected: number;
    increase: number;
    percentChange: number;
  };
  traffic: {
    current: number;
    projected: number;
    increase: number;
    percentChange: number;
  };
  timeline: {
    days: number;
    milestones: Milestone[];
  };
  confidence: number; // 0-100
  assumptions: string[];
}

export interface Milestone {
  day: number;
  description: string;
  expectedProgress: number; // 0-100 percentage
}

export interface ImprovementScenario {
  positionImprovement?: number;
  ctrImprovement?: number;
  conversionRateImprovement?: number;
  aovImprovement?: number;
  priceIncrease?: number;
}

export class ImpactCalculator {
  // CTR by position for projection calculations
  private readonly CTR_BY_POSITION: Record<number, number> = {
    1: 0.285,
    2: 0.157,
    3: 0.094,
    4: 0.064,
    5: 0.044,
    6: 0.031,
    7: 0.022,
    8: 0.017,
    9: 0.014,
    10: 0.012,
  };

  /**
   * Calculate projected impact based on improvements
   */
  calculateImpact(
    searchMetrics: SearchMetrics | null,
    analyticsMetrics: AnalyticsMetrics | null,
    scenario: ImprovementScenario,
    productCount: number = 0
  ): ImpactProjection {
    // Current state
    const currentTraffic = searchMetrics?.clicks || 0;
    const currentRevenue = analyticsMetrics?.revenue || 0;

    // Project traffic impact
    const trafficProjection = this.projectTrafficImpact(searchMetrics, scenario);

    // Project revenue impact
    const revenueProjection = this.projectRevenueImpact(
      analyticsMetrics,
      trafficProjection.increase,
      scenario
    );

    // Calculate timeline
    const timeline = this.calculateTimeline(scenario, productCount);

    // Calculate confidence
    const confidence = this.calculateConfidence(searchMetrics, analyticsMetrics, scenario);

    // Generate assumptions
    const assumptions = this.generateAssumptions(scenario);

    return {
      revenue: {
        current: currentRevenue,
        projected: revenueProjection.projected,
        increase: revenueProjection.increase,
        percentChange: revenueProjection.percentChange,
      },
      traffic: {
        current: currentTraffic,
        projected: trafficProjection.projected,
        increase: trafficProjection.increase,
        percentChange: trafficProjection.percentChange,
      },
      timeline,
      confidence,
      assumptions,
    };
  }

  /**
   * Project traffic impact from SEO improvements
   */
  private projectTrafficImpact(
    metrics: SearchMetrics | null,
    scenario: ImprovementScenario
  ): {
    projected: number;
    increase: number;
    percentChange: number;
  } {
    if (!metrics) {
      return { projected: 0, increase: 0, percentChange: 0 };
    }

    const { impressions, clicks, position } = metrics;
    const currentCTR = clicks / Math.max(1, impressions);

    // Calculate new position
    const newPosition = Math.max(1, position - (scenario.positionImprovement || 0));

    // Get expected CTR for new position
    const expectedCTR = this.getExpectedCTR(newPosition);

    // Add CTR improvement if specified
    const projectedCTR = Math.min(1, expectedCTR + (scenario.ctrImprovement || 0) / 100);

    // Calculate projected traffic
    const projectedClicks = impressions * projectedCTR;
    const increase = projectedClicks - clicks;
    const percentChange = clicks > 0 ? (increase / clicks) * 100 : 0;

    return {
      projected: Math.round(projectedClicks),
      increase: Math.round(increase),
      percentChange: Math.round(percentChange),
    };
  }

  /**
   * Project revenue impact from improvements
   */
  private projectRevenueImpact(
    metrics: AnalyticsMetrics | null,
    trafficIncrease: number,
    scenario: ImprovementScenario
  ): {
    projected: number;
    increase: number;
    percentChange: number;
  } {
    if (!metrics) {
      return { projected: 0, increase: 0, percentChange: 0 };
    }

    const { revenue, sessions, conversionRate, avgOrderValue } = metrics;

    // Calculate new sessions (current + traffic increase)
    const newSessions = sessions + trafficIncrease;

    // Apply conversion rate improvement
    const newConversionRate =
      conversionRate * (1 + (scenario.conversionRateImprovement || 0) / 100);

    // Apply AOV improvement
    const newAOV = avgOrderValue * (1 + (scenario.aovImprovement || 0) / 100);

    // Apply price increase if specified
    const priceMultiplier = 1 + (scenario.priceIncrease || 0) / 100;

    // Calculate projected revenue
    const projectedRevenue = newSessions * newConversionRate * newAOV * priceMultiplier;
    const increase = projectedRevenue - revenue;
    const percentChange = revenue > 0 ? (increase / revenue) * 100 : 0;

    return {
      projected: Math.round(projectedRevenue),
      increase: Math.round(increase),
      percentChange: Math.round(percentChange),
    };
  }

  /**
   * Calculate implementation timeline
   */
  private calculateTimeline(
    scenario: ImprovementScenario,
    productCount: number
  ): ImpactProjection['timeline'] {
    const milestones: Milestone[] = [];
    let totalDays = 0;

    // SEO improvements timeline
    if (scenario.positionImprovement || scenario.ctrImprovement) {
      const seoDays = this.calculateSEOTimeline(scenario.positionImprovement || 0);
      milestones.push({
        day: 14,
        description: 'Complete on-page SEO optimizations',
        expectedProgress: 20,
      });
      milestones.push({
        day: seoDays / 2,
        description: 'Initial ranking improvements visible',
        expectedProgress: 50,
      });
      milestones.push({
        day: seoDays,
        description: 'Target position achieved',
        expectedProgress: 80,
      });
      totalDays = Math.max(totalDays, seoDays);
    }

    // Conversion rate optimization timeline
    if (scenario.conversionRateImprovement) {
      milestones.push({
        day: 7,
        description: 'A/B test setup complete',
        expectedProgress: 10,
      });
      milestones.push({
        day: 30,
        description: 'Initial test results available',
        expectedProgress: 40,
      });
      milestones.push({
        day: 60,
        description: 'Optimizations fully implemented',
        expectedProgress: 90,
      });
      totalDays = Math.max(totalDays, 60);
    }

    // Pricing changes timeline
    if (scenario.priceIncrease) {
      milestones.push({
        day: 7,
        description: 'Price changes implemented',
        expectedProgress: 100,
      });
      totalDays = Math.max(totalDays, 7);
    }

    // Adjust for product count
    if (productCount > 100) {
      totalDays = Math.round(totalDays * 1.5);
      milestones.forEach((m) => (m.day = Math.round(m.day * 1.5)));
    }

    // Sort milestones by day
    milestones.sort((a, b) => a.day - b.day);

    return {
      days: totalDays || 30, // Default 30 days if no specific improvements
      milestones,
    };
  }

  /**
   * Calculate SEO timeline based on position improvement
   */
  private calculateSEOTimeline(positionImprovement: number): number {
    if (positionImprovement <= 3) return 30; // 1 month
    if (positionImprovement <= 5) return 60; // 2 months
    if (positionImprovement <= 10) return 90; // 3 months
    return 120; // 4 months for major improvements
  }

  /**
   * Calculate confidence in projections
   */
  private calculateConfidence(
    searchMetrics: SearchMetrics | null,
    analyticsMetrics: AnalyticsMetrics | null,
    scenario: ImprovementScenario
  ): number {
    let confidence = 0;

    // Data availability (max 40 points)
    if (searchMetrics && searchMetrics.impressions > 100) confidence += 20;
    if (analyticsMetrics && analyticsMetrics.sessions > 100) confidence += 20;

    // Scenario realism (max 30 points)
    const totalImprovement =
      (scenario.positionImprovement || 0) +
      (scenario.ctrImprovement || 0) +
      (scenario.conversionRateImprovement || 0) +
      (scenario.aovImprovement || 0) +
      (scenario.priceIncrease || 0);

    if (totalImprovement <= 50) {
      confidence += 30; // Conservative scenario
    } else if (totalImprovement <= 100) {
      confidence += 20; // Moderate scenario
    } else {
      confidence += 10; // Aggressive scenario
    }

    // Historical data quality (max 30 points)
    if (searchMetrics && searchMetrics.impressions > 1000) confidence += 15;
    if (analyticsMetrics && analyticsMetrics.transactions > 10) confidence += 15;

    return Math.min(100, confidence);
  }

  /**
   * Generate assumptions for the projection
   */
  private generateAssumptions(scenario: ImprovementScenario): string[] {
    const assumptions: string[] = [];

    if (scenario.positionImprovement) {
      assumptions.push(`Search position improves by ${scenario.positionImprovement} positions`);
      assumptions.push('Competitor positions remain stable');
    }

    if (scenario.ctrImprovement) {
      assumptions.push(
        `CTR improves by ${scenario.ctrImprovement}% through better titles/descriptions`
      );
    }

    if (scenario.conversionRateImprovement) {
      assumptions.push(`Conversion rate increases by ${scenario.conversionRateImprovement}%`);
      assumptions.push('User experience improvements are successful');
    }

    if (scenario.aovImprovement) {
      assumptions.push(`Average order value increases by ${scenario.aovImprovement}%`);
      assumptions.push('Upselling/cross-selling strategies are effective');
    }

    if (scenario.priceIncrease) {
      assumptions.push(
        `Prices increase by ${scenario.priceIncrease}% without significant demand drop`
      );
      assumptions.push('Price elasticity remains within normal range');
    }

    // Add general assumptions
    assumptions.push('Search volume remains stable');
    assumptions.push('No major algorithm updates occur');
    assumptions.push('Market conditions remain consistent');

    return assumptions;
  }

  /**
   * Get expected CTR for a position
   */
  private getExpectedCTR(position: number): number {
    if (position < 1) return this.CTR_BY_POSITION[1];
    if (position <= 10) return this.CTR_BY_POSITION[Math.floor(position)] || 0.01;
    if (position <= 20) return 0.008;
    if (position <= 30) return 0.004;
    return 0.002;
  }

  /**
   * Calculate ROI for improvements
   */
  calculateROI(
    impactProjection: ImpactProjection,
    implementationCost: number
  ): {
    roi: number;
    paybackPeriod: number; // days
    breakEven: number; // revenue needed to break even
  } {
    const monthlyRevenueIncrease =
      impactProjection.revenue.increase / (impactProjection.timeline.days / 30);

    const roi =
      implementationCost > 0
        ? ((impactProjection.revenue.increase - implementationCost) / implementationCost) * 100
        : 0;

    const paybackPeriod =
      monthlyRevenueIncrease > 0 ? (implementationCost / monthlyRevenueIncrease) * 30 : Infinity;

    return {
      roi: Math.round(roi),
      paybackPeriod: Math.round(paybackPeriod),
      breakEven: implementationCost,
    };
  }
}
