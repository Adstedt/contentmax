import type { SearchMetrics } from '@/components/taxonomy/D3Visualization/NodeTooltip';

export interface TrafficPotentialResult {
  score: number;
  factors: {
    ctrGap: number;
    positionGap: number;
    impressionPotential: number;
    clickPotential: number;
  };
  confidence: 'high' | 'medium' | 'low';
  recommendations: string[];
}

export class TrafficCalculator {
  /**
   * Calculate expected CTR based on search position
   * Based on industry averages
   */
  private getExpectedCTR(position: number): number {
    const ctrByPosition = [
      0.285, // Position 1
      0.157, // Position 2
      0.094, // Position 3
      0.064, // Position 4
      0.044, // Position 5
      0.031, // Position 6
      0.022, // Position 7
      0.017, // Position 8
      0.014, // Position 9
      0.012, // Position 10
    ];

    if (position <= 0) return 0;
    if (position <= 10) return ctrByPosition[Math.floor(position) - 1];
    if (position <= 20) return 0.008;
    if (position <= 30) return 0.004;
    return 0.002;
  }

  /**
   * Calculate traffic potential score (0-100)
   */
  calculate(metrics: SearchMetrics | null): TrafficPotentialResult {
    if (!metrics || metrics.impressions === 0) {
      return {
        score: 0,
        factors: {
          ctrGap: 0,
          positionGap: 0,
          impressionPotential: 0,
          clickPotential: 0,
        },
        confidence: 'low',
        recommendations: [
          'No search data available. Consider improving content and technical SEO.',
        ],
      };
    }

    const { clicks, impressions, ctr, position } = metrics;
    const expectedCTR = this.getExpectedCTR(position);
    const actualCTR = ctr;

    // Calculate CTR gap (opportunity to improve CTR)
    const ctrGap = Math.max(0, expectedCTR - actualCTR);
    const ctrGapScore = Math.min(100, ctrGap * 500); // Scale to 0-100

    // Calculate position improvement potential
    let positionGapScore = 0;
    if (position > 1) {
      if (position <= 3) {
        positionGapScore = (position - 1) * 30; // High value for top 3
      } else if (position <= 10) {
        positionGapScore = 60 + (position - 3) * 5; // Medium value for first page
      } else {
        positionGapScore = Math.min(100, 80 + (position - 10) * 1); // Lower incremental value
      }
    }

    // Calculate impression potential
    const impressionPotentialScore = this.calculateImpressionPotential(impressions, position);

    // Calculate click potential based on impressions and CTR gap
    const potentialClicks = impressions * expectedCTR;
    const clickGap = Math.max(0, potentialClicks - clicks);
    const clickPotentialScore = Math.min(100, (clickGap / Math.max(1, clicks)) * 50);

    // Weighted composite score
    const score = Math.min(
      100,
      ctrGapScore * 0.3 +
        positionGapScore * 0.35 +
        impressionPotentialScore * 0.2 +
        clickPotentialScore * 0.15
    );

    // Determine confidence based on data volume
    const confidence = this.getConfidence(impressions);

    // Generate recommendations
    const recommendations = this.generateRecommendations({
      ctrGap,
      position,
      impressions,
      clicks,
      score,
    });

    return {
      score: Math.round(score),
      factors: {
        ctrGap: Math.round(ctrGapScore),
        positionGap: Math.round(positionGapScore),
        impressionPotential: Math.round(impressionPotentialScore),
        clickPotential: Math.round(clickPotentialScore),
      },
      confidence,
      recommendations,
    };
  }

  /**
   * Calculate impression potential based on current impressions and position
   */
  private calculateImpressionPotential(impressions: number, position: number): number {
    // High impressions with poor position = high potential
    if (impressions > 1000 && position > 10) {
      return 90;
    }
    if (impressions > 500 && position > 5) {
      return 70;
    }
    if (impressions > 100 && position > 3) {
      return 50;
    }
    if (impressions < 100 && position > 10) {
      return 30; // Low impressions, poor position = some potential
    }
    return 10; // Already performing well or low search volume
  }

  /**
   * Determine confidence level based on data volume
   */
  private getConfidence(impressions: number): 'high' | 'medium' | 'low' {
    if (impressions >= 1000) return 'high';
    if (impressions >= 100) return 'medium';
    return 'low';
  }

  /**
   * Generate actionable recommendations
   */
  private generateRecommendations(data: {
    ctrGap: number;
    position: number;
    impressions: number;
    clicks: number;
    score: number;
  }): string[] {
    const recommendations: string[] = [];

    if (data.score >= 80) {
      recommendations.push('High-priority optimization opportunity');
    }

    if (data.ctrGap > 0.05) {
      recommendations.push('Optimize title tags and meta descriptions to improve CTR');
    }

    if (data.position > 10) {
      recommendations.push('Focus on content quality and backlink acquisition to improve rankings');
    } else if (data.position > 3) {
      recommendations.push('Optimize on-page SEO and internal linking to reach top 3');
    } else if (data.position > 1) {
      recommendations.push('Fine-tune content and user signals to reach position 1');
    }

    if (data.impressions > 1000 && data.clicks < 100) {
      recommendations.push(
        'Strong search demand but low engagement - review search intent alignment'
      );
    }

    if (data.impressions < 100) {
      recommendations.push('Low search visibility - expand keyword targeting');
    }

    return recommendations;
  }

  /**
   * Calculate traffic increase potential
   */
  estimateTrafficIncrease(currentMetrics: SearchMetrics, targetPosition: number = 3): number {
    const currentClicks = currentMetrics.clicks;
    const impressions = currentMetrics.impressions;
    const targetCTR = this.getExpectedCTR(targetPosition);
    const potentialClicks = impressions * targetCTR;

    return Math.max(0, potentialClicks - currentClicks);
  }
}
