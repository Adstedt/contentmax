export type OpportunityType =
  | 'quick-win' // High score, low effort
  | 'strategic' // High score, high effort
  | 'incremental' // Medium score, low effort
  | 'long-term' // Medium score, high effort
  | 'maintain'; // Low score (performing well)

export interface CategorizationResult {
  type: OpportunityType;
  effort: 'low' | 'medium' | 'high';
  priority: 1 | 2 | 3 | 4 | 5;
  description: string;
  suggestedAction: string;
}

export class OpportunityCategorizer {
  /**
   * Categorize opportunity based on score and effort
   */
  categorize(score: number, productCount: number): OpportunityType {
    const effort = this.estimateEffort(productCount);

    if (score >= 70) {
      return effort === 'low' ? 'quick-win' : 'strategic';
    }

    if (score >= 40) {
      return effort === 'low' ? 'incremental' : 'long-term';
    }

    return 'maintain';
  }

  /**
   * Get full categorization with details
   */
  getFullCategorization(score: number, productCount: number): CategorizationResult {
    const type = this.categorize(score, productCount);
    const effort = this.estimateEffort(productCount);
    const priority = this.calculatePriority(score, effort);
    const description = this.getDescription(type);
    const suggestedAction = this.getSuggestedAction(type, score);

    return {
      type,
      effort,
      priority,
      description,
      suggestedAction,
    };
  }

  /**
   * Estimate effort based on product count
   */
  private estimateEffort(productCount: number): 'low' | 'medium' | 'high' {
    if (productCount <= 10) return 'low';
    if (productCount <= 100) return 'medium';
    return 'high';
  }

  /**
   * Calculate priority (1 = highest, 5 = lowest)
   */
  private calculatePriority(score: number, effort: 'low' | 'medium' | 'high'): 1 | 2 | 3 | 4 | 5 {
    // Quick wins are always priority 1
    if (score >= 70 && effort === 'low') return 1;

    // Strategic initiatives are priority 2
    if (score >= 70 && effort !== 'low') return 2;

    // Incremental improvements are priority 3
    if (score >= 40 && effort === 'low') return 3;

    // Long-term projects are priority 4
    if (score >= 40 && effort !== 'low') return 4;

    // Maintenance is priority 5
    return 5;
  }

  /**
   * Get description for opportunity type
   */
  private getDescription(type: OpportunityType): string {
    const descriptions = {
      'quick-win':
        'High-impact opportunity with minimal effort required. Implement immediately for quick results.',
      strategic:
        'Major opportunity requiring significant investment. Plan resources for maximum impact.',
      incremental:
        'Moderate improvement opportunity with low effort. Good for continuous optimization.',
      'long-term':
        'Moderate opportunity requiring substantial effort. Schedule for future quarters.',
      maintain: 'Currently performing well. Monitor and maintain current performance.',
    };

    return descriptions[type];
  }

  /**
   * Get suggested action for opportunity type
   */
  private getSuggestedAction(type: OpportunityType, score: number): string {
    switch (type) {
      case 'quick-win':
        return `Prioritize immediately. Expected ROI within 2-4 weeks. Score: ${score}/100`;

      case 'strategic':
        return `Create detailed project plan. Allocate dedicated resources. Score: ${score}/100`;

      case 'incremental':
        return `Include in next sprint. Low risk with steady returns. Score: ${score}/100`;

      case 'long-term':
        return `Add to roadmap for next quarter. Requires planning phase. Score: ${score}/100`;

      case 'maintain':
        return `No immediate action needed. Set up monitoring alerts. Score: ${score}/100`;

      default:
        return `Review opportunity details for action plan. Score: ${score}/100`;
    }
  }

  /**
   * Group opportunities by type
   */
  groupOpportunities<T extends { category: OpportunityType }>(
    opportunities: T[]
  ): Record<OpportunityType, T[]> {
    const grouped: Record<OpportunityType, T[]> = {
      'quick-win': [],
      strategic: [],
      incremental: [],
      'long-term': [],
      maintain: [],
    };

    for (const opportunity of opportunities) {
      grouped[opportunity.category].push(opportunity);
    }

    return grouped;
  }

  /**
   * Get implementation timeline estimate
   */
  getTimelineEstimate(type: OpportunityType, productCount: number): string {
    const baseTimelines = {
      'quick-win': 14, // 2 weeks
      strategic: 90, // 3 months
      incremental: 30, // 1 month
      'long-term': 180, // 6 months
      maintain: 0, // No action
    };

    let days = baseTimelines[type];

    // Adjust based on product count
    if (productCount > 100) {
      days = Math.round(days * 1.5);
    } else if (productCount > 500) {
      days = Math.round(days * 2);
    }

    if (days === 0) return 'N/A';
    if (days <= 14) return `${days} days`;
    if (days <= 60) return `${Math.round(days / 7)} weeks`;
    return `${Math.round(days / 30)} months`;
  }

  /**
   * Calculate resource requirements
   */
  getResourceRequirements(
    type: OpportunityType,
    productCount: number
  ): {
    developerHours: number;
    contentHours: number;
    marketingHours: number;
    totalHours: number;
  } {
    const baseHours = {
      'quick-win': { dev: 8, content: 4, marketing: 2 },
      strategic: { dev: 80, content: 40, marketing: 20 },
      incremental: { dev: 16, content: 8, marketing: 4 },
      'long-term': { dev: 160, content: 80, marketing: 40 },
      maintain: { dev: 0, content: 0, marketing: 0 },
    };

    const hours = baseHours[type];

    // Scale by product count
    const scaleFactor = Math.log10(Math.max(1, productCount / 10)) + 1;

    const developerHours = Math.round(hours.dev * scaleFactor);
    const contentHours = Math.round(hours.content * scaleFactor);
    const marketingHours = Math.round(hours.marketing * scaleFactor);

    return {
      developerHours,
      contentHours,
      marketingHours,
      totalHours: developerHours + contentHours + marketingHours,
    };
  }

  /**
   * Get risk level for opportunity type
   */
  getRiskLevel(type: OpportunityType): 'low' | 'medium' | 'high' {
    const riskLevels = {
      'quick-win': 'low',
      strategic: 'high',
      incremental: 'low',
      'long-term': 'medium',
      maintain: 'low',
    } as const;

    return riskLevels[type];
  }

  /**
   * Get priority level for opportunity type
   */
  getPriority(type: OpportunityType): number {
    const priorities: Record<OpportunityType, number> = {
      'quick-win': 1,
      strategic: 2,
      incremental: 3,
      'long-term': 4,
      maintain: 5,
    };

    return priorities[type] || 6;
  }
}
