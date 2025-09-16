export interface PricingData {
  ourPrice: number;
  marketMedian: number;
  marketMin: number;
  marketMax: number;
  competitorCount: number;
  pricePosition?: 'below_market' | 'at_market' | 'above_market';
}

export interface PricingOpportunityResult {
  score: number;
  factors: {
    priceGap: number;
    marginOpportunity: number;
    competitivePosition: number;
    priceElasticity: number;
  };
  confidence: 'high' | 'medium' | 'low';
  recommendations: string[];
  potentialPriceIncrease: number;
  estimatedRevenueImpact: number;
}

export class PricingCalculator {
  private readonly MARGIN_TARGET = 0.3; // 30% target margin
  private readonly PRICE_ELASTICITY = -1.5; // Default price elasticity of demand

  /**
   * Calculate pricing opportunity score (0-100)
   */
  calculate(
    pricingData: PricingData | null,
    currentRevenue: number = 0,
    currentMargin: number = 0.2
  ): PricingOpportunityResult {
    if (!pricingData || pricingData.competitorCount === 0) {
      return {
        score: 0,
        factors: {
          priceGap: 0,
          marginOpportunity: 0,
          competitivePosition: 0,
          priceElasticity: 0,
        },
        confidence: 'low',
        recommendations: [
          'No pricing data available. Collect competitor pricing to identify opportunities.',
        ],
        potentialPriceIncrease: 0,
        estimatedRevenueImpact: 0,
      };
    }

    // Handle edge case where all prices are zero
    if (
      pricingData.ourPrice === 0 &&
      pricingData.marketMedian === 0 &&
      pricingData.marketMax === 0
    ) {
      return {
        score: 0,
        factors: {
          priceGap: 0,
          marginOpportunity: 0,
          competitivePosition: 0,
          priceElasticity: 0,
        },
        confidence: 'low',
        recommendations: ['No valid pricing data. Ensure products have prices set.'],
        potentialPriceIncrease: 0,
        estimatedRevenueImpact: 0,
      };
    }

    // Determine price position
    const pricePosition = this.determinePricePosition(pricingData);
    pricingData.pricePosition = pricePosition;

    // Calculate individual scoring factors
    const priceGapScore = this.calculatePriceGap(pricingData);
    const marginOpportunityScore = this.calculateMarginOpportunity(currentMargin);
    const competitivePositionScore = this.calculateCompetitivePosition(pricingData);
    const priceElasticityScore = this.calculatePriceElasticity(pricingData, currentRevenue);

    // Weighted composite score
    const score = Math.min(
      100,
      priceGapScore * 0.35 +
        marginOpportunityScore * 0.25 +
        competitivePositionScore * 0.25 +
        priceElasticityScore * 0.15
    );

    // Calculate potential price increase
    const potentialPriceIncrease = this.calculatePotentialPriceIncrease(pricingData);

    // Estimate revenue impact
    const estimatedRevenueImpact = this.estimateRevenueImpact(
      currentRevenue,
      potentialPriceIncrease,
      pricingData.ourPrice
    );

    // Determine confidence
    const confidence = this.getConfidence(pricingData);

    // Generate recommendations
    const recommendations = this.generateRecommendations({
      pricingData,
      score,
      priceGapScore,
      marginOpportunityScore,
      currentMargin,
    });

    return {
      score: Math.round(score),
      factors: {
        priceGap: Math.round(priceGapScore),
        marginOpportunity: Math.round(marginOpportunityScore),
        competitivePosition: Math.round(competitivePositionScore),
        priceElasticity: Math.round(priceElasticityScore),
      },
      confidence,
      recommendations,
      potentialPriceIncrease: Math.round(potentialPriceIncrease * 100) / 100,
      estimatedRevenueImpact: Math.round(estimatedRevenueImpact),
    };
  }

  /**
   * Determine price position relative to market
   */
  private determinePricePosition(data: PricingData): 'below_market' | 'at_market' | 'above_market' {
    // Handle zero market median edge case
    if (data.marketMedian === 0) {
      if (data.ourPrice === 0) return 'at_market';
      return 'above_market';
    }

    const tolerance = 0.05; // 5% tolerance for "at market"
    const percentDiff = (data.ourPrice - data.marketMedian) / data.marketMedian;

    if (percentDiff < -tolerance) return 'below_market';
    if (percentDiff > tolerance) return 'above_market';
    return 'at_market';
  }

  /**
   * Calculate price gap score
   */
  private calculatePriceGap(data: PricingData): number {
    const { ourPrice, marketMedian, marketMin, marketMax } = data;

    if (data.pricePosition === 'below_market') {
      // Opportunity to increase price
      const gap = marketMedian - ourPrice;
      const maxGap = marketMedian - marketMin;
      if (maxGap === 0) return 50;

      // Scale based on how far below market we are
      const relativeGap = gap / maxGap;
      return Math.min(100, relativeGap * 100);
    }

    if (data.pricePosition === 'above_market') {
      // May be limiting sales, but could be premium positioning
      const gap = ourPrice - marketMedian;
      const maxGap = marketMax - marketMedian;
      if (maxGap === 0) return 30;

      // Moderate opportunity - might need price optimization
      const relativeGap = gap / maxGap;
      return Math.max(20, 50 - relativeGap * 30);
    }

    // At market - limited pricing opportunity
    return 10;
  }

  /**
   * Calculate margin improvement opportunity
   */
  private calculateMarginOpportunity(currentMargin: number): number {
    if (currentMargin >= this.MARGIN_TARGET) {
      return 0; // Already at target margin
    }

    const marginGap = this.MARGIN_TARGET - currentMargin;
    // Scale to 0-100 based on margin gap
    return Math.min(100, marginGap * 333); // 0.3 gap = 100 score
  }

  /**
   * Calculate competitive position score
   */
  private calculateCompetitivePosition(data: PricingData): number {
    const { competitorCount, pricePosition } = data;

    // More competitors = more opportunity for differentiation
    let baseScore = Math.min(50, competitorCount * 5);

    if (pricePosition === 'below_market') {
      // Good position for price increases
      baseScore += 30;
    } else if (pricePosition === 'at_market') {
      // Moderate opportunity
      baseScore += 15;
    } else {
      // Premium positioning - less opportunity
      baseScore += 5;
    }

    return Math.min(100, baseScore);
  }

  /**
   * Calculate price elasticity impact
   */
  private calculatePriceElasticity(data: PricingData, currentRevenue: number): number {
    if (currentRevenue === 0) return 50; // Unknown elasticity

    // If we're below market, price increases likely won't hurt demand much
    if (data.pricePosition === 'below_market') {
      return 80; // High opportunity
    }

    // If above market, need to be careful with further increases
    if (data.pricePosition === 'above_market') {
      return 20; // Low opportunity
    }

    return 50; // Moderate opportunity
  }

  /**
   * Calculate potential price increase
   */
  private calculatePotentialPriceIncrease(data: PricingData): number {
    const { ourPrice, marketMedian, pricePosition } = data;

    if (pricePosition === 'below_market') {
      // Can increase to at least market median
      return marketMedian - ourPrice;
    }

    if (pricePosition === 'at_market') {
      // Conservative 5% increase potential
      return ourPrice * 0.05;
    }

    // Above market - no increase recommended
    return 0;
  }

  /**
   * Estimate revenue impact from price change
   */
  private estimateRevenueImpact(
    currentRevenue: number,
    priceIncrease: number,
    currentPrice: number
  ): number {
    if (currentRevenue === 0 || currentPrice === 0) return 0;

    const priceChangePercent = priceIncrease / currentPrice;

    // Apply price elasticity of demand
    // Revenue change = (1 + price%) * (1 + quantity%) - 1
    const quantityChangePercent = priceChangePercent * this.PRICE_ELASTICITY;
    const revenueChangePercent = (1 + priceChangePercent) * (1 + quantityChangePercent) - 1;

    return currentRevenue * revenueChangePercent;
  }

  /**
   * Determine confidence level
   */
  private getConfidence(data: PricingData): 'high' | 'medium' | 'low' {
    if (data.competitorCount >= 10) return 'high';
    if (data.competitorCount >= 5) return 'medium';
    return 'low';
  }

  /**
   * Generate actionable recommendations
   */
  private generateRecommendations(data: {
    pricingData: PricingData;
    score: number;
    priceGapScore: number;
    marginOpportunityScore: number;
    currentMargin: number;
  }): string[] {
    const recommendations: string[] = [];
    const { pricingData } = data;

    if (data.score >= 80) {
      recommendations.push('High-priority pricing optimization opportunity');
    }

    if (pricingData.pricePosition === 'below_market') {
      recommendations.push(
        `Consider increasing prices toward market median ($${pricingData.marketMedian})`
      );
      recommendations.push('Test price increases on low-risk segments first');
    } else if (pricingData.pricePosition === 'above_market') {
      recommendations.push('Analyze price sensitivity - may be limiting conversion');
      recommendations.push('Consider A/B testing lower price points');
    } else {
      recommendations.push('Monitor competitor pricing for changes');
      recommendations.push('Consider value-added bundling to justify premium pricing');
    }

    if (data.marginOpportunityScore > 60) {
      recommendations.push('Focus on margin improvement through strategic pricing');
    }

    if (pricingData.competitorCount > 10) {
      recommendations.push('High competition - differentiate on value, not just price');
    }

    if (data.currentMargin < 0.15) {
      recommendations.push('Critical: Current margins too low - urgent pricing review needed');
    }

    return recommendations;
  }

  /**
   * Analyze price sensitivity
   */
  analyzePriceSensitivity(
    historicalData: Array<{ price: number; units: number; date: Date }>
  ): number {
    if (historicalData.length < 2) return this.PRICE_ELASTICITY;

    // Calculate price elasticity from historical data
    const changes = [];
    for (let i = 1; i < historicalData.length; i++) {
      const priceChange =
        (historicalData[i].price - historicalData[i - 1].price) / historicalData[i - 1].price;
      const quantityChange =
        (historicalData[i].units - historicalData[i - 1].units) / historicalData[i - 1].units;

      if (priceChange !== 0) {
        changes.push(quantityChange / priceChange);
      }
    }

    if (changes.length === 0) return this.PRICE_ELASTICITY;

    // Return average elasticity
    return changes.reduce((a, b) => a + b, 0) / changes.length;
  }
}
