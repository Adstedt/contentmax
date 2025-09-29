import { MatchResult } from '@/types/integration';

export interface ConfidenceFactors {
  matchStrategy: string;
  stringDistance?: number;
  pathDepth?: number;
  hasExactMatch: boolean;
  hasPartialMatch: boolean;
  dataRecency?: number; // days since last update
  dataCompleteness?: number; // percentage of fields populated
}

export class ConfidenceScorer {
  private readonly strategyWeights: Record<string, number> = {
    exact_url: 1.0,
    gtin_exact: 1.0,
    manual: 0.95,
    product_id: 0.9,
    path_match: 0.85,
    category_match: 0.75,
    fuzzy_match: 0.6,
  };

  /**
   * Calculate confidence score for a match
   */
  calculateConfidence(factors: ConfidenceFactors): number {
    let score = 0;
    let weightSum = 0;

    // Base score from match strategy
    const strategyScore = this.strategyWeights[factors.matchStrategy] || 0.5;
    score += strategyScore * 0.5; // 50% weight
    weightSum += 0.5;

    // String similarity score
    if (factors.stringDistance !== undefined) {
      score += factors.stringDistance * 0.2; // 20% weight
      weightSum += 0.2;
    }

    // Path depth bonus (deeper = more specific = higher confidence)
    if (factors.pathDepth !== undefined) {
      const depthScore = Math.min(factors.pathDepth / 5, 1); // Max at 5 levels deep
      score += depthScore * 0.1; // 10% weight
      weightSum += 0.1;
    }

    // Exact vs partial match
    if (factors.hasExactMatch) {
      score += 0.15; // 15% weight
      weightSum += 0.15;
    } else if (factors.hasPartialMatch) {
      score += 0.07; // 7% weight
      weightSum += 0.15;
    }

    // Data recency penalty
    if (factors.dataRecency !== undefined) {
      const recencyScore = Math.max(0, 1 - factors.dataRecency / 30); // Decay over 30 days
      score += recencyScore * 0.05; // 5% weight
      weightSum += 0.05;
    }

    // Data completeness bonus
    if (factors.dataCompleteness !== undefined) {
      score += factors.dataCompleteness * 0.05; // 5% weight
      weightSum += 0.05;
    }

    // Normalize to 0-1 range
    return weightSum > 0 ? Math.min(score / weightSum, 1) : 0;
  }

  /**
   * Calculate aggregate confidence for multiple matches
   */
  calculateAggregateConfidence(matches: MatchResult[]): number {
    if (matches.length === 0) return 0;

    // Weighted average based on match count
    const weights = matches.map((_, index) => 1 / (index + 1)); // Decay weight for subsequent matches
    const weightSum = weights.reduce((a, b) => a + b, 0);

    const weightedSum = matches.reduce(
      (sum, match, index) => sum + match.confidence * weights[index],
      0
    );

    return weightedSum / weightSum;
  }

  /**
   * Determine confidence level category
   */
  getConfidenceLevel(score: number): 'high' | 'medium' | 'low' | 'none' {
    if (score >= 0.9) return 'high';
    if (score >= 0.7) return 'medium';
    if (score > 0) return 'low';
    return 'none';
  }

  /**
   * Calculate confidence for combined metrics from multiple sources
   */
  calculateCombinedConfidence(
    gscConfidence?: number,
    ga4Confidence?: number,
    marketConfidence?: number
  ): number {
    const confidences = [gscConfidence, ga4Confidence, marketConfidence].filter(
      (c) => c !== undefined && c !== null && c > 0
    );

    if (confidences.length === 0) return 0;

    // Use harmonic mean for combined confidence (penalizes low values)
    const harmonicMean = confidences.length / confidences.reduce((sum, c) => sum + 1 / c, 0);

    return harmonicMean;
  }

  /**
   * Validate if confidence meets minimum threshold
   */
  meetsThreshold(confidence: number, threshold: number = 0.6): boolean {
    return confidence >= threshold;
  }

  /**
   * Get recommended action based on confidence
   */
  getRecommendedAction(confidence: number): {
    action: 'accept' | 'review' | 'reject';
    reason: string;
  } {
    const level = this.getConfidenceLevel(confidence);

    switch (level) {
      case 'high':
        return {
          action: 'accept',
          reason: 'High confidence match - automatically accepted',
        };
      case 'medium':
        return {
          action: 'review',
          reason: 'Medium confidence - manual review recommended',
        };
      case 'low':
        return {
          action: 'review',
          reason: 'Low confidence - requires manual verification',
        };
      default:
        return {
          action: 'reject',
          reason: 'No match found - item will be tracked as unmatched',
        };
    }
  }
}
