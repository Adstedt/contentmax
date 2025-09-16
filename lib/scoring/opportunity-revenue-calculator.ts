import type { AnalyticsMetrics } from '@/components/taxonomy/D3Visualization/NodeTooltip';

export interface RevenuePotentialResult {
  score: number;
  factors: {
    conversionGap: number;
    aovGap: number;
    monetizationGap: number;
    revenueVelocity: number;
  };
  confidence: 'high' | 'medium' | 'low';
  recommendations: string[];
  potentialRevenue: number;
}

export class OpportunityRevenueCalculator {
  // Industry benchmark conversion rates by category
  private readonly benchmarks = {
    conversionRate: 0.025, // 2.5% average e-commerce conversion
    avgOrderValue: 150, // $150 average order value
    revenuePerSession: 3.75, // $3.75 per session average
  };

  /**
   * Calculate revenue potential score (0-100)
   */
  calculate(
    metrics: AnalyticsMetrics | null,
    categoryAverage?: Partial<typeof this.benchmarks>
  ): RevenuePotentialResult {
    if (!metrics) {
      return {
        score: 50, // Unknown potential
        factors: {
          conversionGap: 0,
          aovGap: 0,
          monetizationGap: 0,
          revenueVelocity: 0,
        },
        confidence: 'low',
        recommendations: [
          'No analytics data available. Implement tracking to measure performance.',
        ],
        potentialRevenue: 0,
      };
    }

    const benchmarks = { ...this.benchmarks, ...categoryAverage };

    // Calculate conversion rate gap
    const conversionGapScore = this.calculateConversionGap(
      metrics.conversionRate,
      benchmarks.conversionRate
    );

    // Calculate average order value gap
    const aovGapScore = this.calculateAOVGap(metrics.avgOrderValue, benchmarks.avgOrderValue);

    // Calculate monetization gap (traffic without revenue)
    const monetizationGapScore = this.calculateMonetizationGap(metrics.sessions, metrics.revenue);

    // Calculate revenue velocity (growth potential)
    const revenueVelocityScore = this.calculateRevenueVelocity(
      metrics.revenue,
      metrics.previousRevenue
    );

    // Weighted composite score
    const score = Math.min(
      100,
      conversionGapScore * 0.35 +
        aovGapScore * 0.25 +
        monetizationGapScore * 0.3 +
        revenueVelocityScore * 0.1
    );

    // Calculate potential revenue increase
    const potentialRevenue = this.calculatePotentialRevenue(metrics, benchmarks);

    // Determine confidence
    const confidence = this.getConfidence(metrics);

    // Generate recommendations
    const recommendations = this.generateRecommendations({
      metrics,
      benchmarks,
      conversionGapScore,
      aovGapScore,
      monetizationGapScore,
      score,
    });

    return {
      score: Math.round(score),
      factors: {
        conversionGap: Math.round(conversionGapScore),
        aovGap: Math.round(aovGapScore),
        monetizationGap: Math.round(monetizationGapScore),
        revenueVelocity: Math.round(revenueVelocityScore),
      },
      confidence,
      recommendations,
      potentialRevenue: Math.round(potentialRevenue),
    };
  }

  /**
   * Calculate conversion rate gap score
   */
  private calculateConversionGap(currentRate: number, benchmarkRate: number): number {
    if (currentRate >= benchmarkRate) {
      return 0; // Already performing at or above benchmark
    }

    const gap = benchmarkRate - currentRate;
    const relativeGap = gap / benchmarkRate;

    // Scale to 0-100 based on relative gap
    if (relativeGap >= 0.8) return 100; // 80%+ below benchmark
    if (relativeGap >= 0.5) return 80; // 50%+ below benchmark
    if (relativeGap >= 0.3) return 60; // 30%+ below benchmark
    if (relativeGap >= 0.1) return 40; // 10%+ below benchmark
    return 20; // Less than 10% below benchmark
  }

  /**
   * Calculate average order value gap score
   */
  private calculateAOVGap(currentAOV: number, benchmarkAOV: number): number {
    if (currentAOV >= benchmarkAOV) {
      return 0; // Already at or above benchmark
    }

    const gap = benchmarkAOV - currentAOV;
    const relativeGap = gap / benchmarkAOV;

    // Scale to 0-100
    return Math.min(100, relativeGap * 200);
  }

  /**
   * Calculate monetization gap for traffic without revenue
   */
  private calculateMonetizationGap(sessions: number, revenue: number): number {
    if (sessions === 0) return 0;

    const revenuePerSession = revenue / sessions;

    // High traffic with low/no revenue = high opportunity
    if (sessions > 1000 && revenuePerSession < 1) {
      return 100;
    }
    if (sessions > 500 && revenuePerSession < 2) {
      return 80;
    }
    if (sessions > 100 && revenuePerSession < 3) {
      return 60;
    }
    if (sessions > 50 && revenue === 0) {
      return 50;
    }
    if (revenuePerSession < this.benchmarks.revenuePerSession) {
      return 30;
    }

    return 0; // Well monetized
  }

  /**
   * Calculate revenue velocity score
   */
  private calculateRevenueVelocity(currentRevenue: number, previousRevenue?: number): number {
    if (!previousRevenue || previousRevenue === 0) {
      return currentRevenue > 0 ? 50 : 0; // New revenue source
    }

    const growth = (currentRevenue - previousRevenue) / previousRevenue;

    // Declining revenue = opportunity to improve
    if (growth < -0.2) return 80; // >20% decline
    if (growth < 0) return 60; // Any decline
    if (growth < 0.1) return 40; // <10% growth
    if (growth < 0.2) return 20; // <20% growth

    return 0; // Strong growth already
  }

  /**
   * Calculate potential revenue increase
   */
  private calculatePotentialRevenue(
    metrics: AnalyticsMetrics,
    benchmarks: typeof this.benchmarks
  ): number {
    const currentRevenue = metrics.revenue;
    const sessions = metrics.sessions;

    // Calculate revenue if performing at benchmark
    const benchmarkRevenue = sessions * benchmarks.conversionRate * benchmarks.avgOrderValue;

    // Return the potential increase
    return Math.max(0, benchmarkRevenue - currentRevenue);
  }

  /**
   * Determine confidence level
   */
  private getConfidence(metrics: AnalyticsMetrics): 'high' | 'medium' | 'low' {
    if (metrics.sessions >= 1000 && metrics.transactions >= 10) return 'high';
    if (metrics.sessions >= 100 && metrics.transactions >= 1) return 'medium';
    return 'low';
  }

  /**
   * Generate actionable recommendations
   */
  private generateRecommendations(data: {
    metrics: AnalyticsMetrics;
    benchmarks: typeof this.benchmarks;
    conversionGapScore: number;
    aovGapScore: number;
    monetizationGapScore: number;
    score: number;
  }): string[] {
    const recommendations: string[] = [];

    if (data.score >= 80) {
      recommendations.push('Critical revenue optimization opportunity');
    }

    if (data.conversionGapScore > 60) {
      recommendations.push('Focus on conversion rate optimization (CRO)');
      recommendations.push('Review checkout process and reduce friction');
    }

    if (data.aovGapScore > 60) {
      recommendations.push('Implement upselling and cross-selling strategies');
      recommendations.push('Consider bundling products or volume discounts');
    }

    if (data.monetizationGapScore > 60) {
      recommendations.push('High traffic with low revenue - review product-market fit');
      recommendations.push('Analyze user intent and improve product relevance');
    }

    if (data.metrics.revenue === 0 && data.metrics.sessions > 0) {
      recommendations.push('No revenue detected - verify tracking implementation');
    }

    if (data.metrics.conversionRate > data.benchmarks.conversionRate) {
      recommendations.push('Conversion rate above average - focus on traffic growth');
    }

    return recommendations;
  }

  /**
   * Estimate revenue increase from improvements
   */
  estimateRevenueImpact(
    currentMetrics: AnalyticsMetrics,
    improvements: {
      conversionRateIncrease?: number;
      aovIncrease?: number;
      trafficIncrease?: number;
    }
  ): number {
    const newSessions = currentMetrics.sessions * (1 + (improvements.trafficIncrease || 0));
    const newConversionRate =
      currentMetrics.conversionRate * (1 + (improvements.conversionRateIncrease || 0));
    const newAOV = currentMetrics.avgOrderValue * (1 + (improvements.aovIncrease || 0));

    const newRevenue = newSessions * newConversionRate * newAOV;
    return newRevenue - currentMetrics.revenue;
  }
}
