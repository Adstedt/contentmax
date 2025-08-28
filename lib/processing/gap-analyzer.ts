import { TaxonomyNode, ContentStatus } from './taxonomy-builder';

export enum GapType {
  MISSING = 'missing',
  OUTDATED = 'outdated',
  THIN = 'thin',
  NO_METADATA = 'no_metadata',
  BROKEN_LINK = 'broken_link',
  LOW_QUALITY = 'low_quality',
}

export interface ContentGap {
  nodeId: string;
  url: string;
  gapType: GapType;
  priority: number;
  reason: string;
  suggestedAction: string;
  metadata?: {
    lastModified?: Date;
    contentLength?: number;
    missingElements?: string[];
    qualityScore?: number;
  };
}

export interface GapAnalysisConfig {
  outdatedThresholdDays?: number;
  thinContentThreshold?: number;
  priorityWeights?: {
    depth: number;
    skuCount: number;
    hasChildren: number;
    recency: number;
  };
}

export class GapAnalyzer {
  private readonly defaultConfig: Required<GapAnalysisConfig> = {
    outdatedThresholdDays: 180,
    thinContentThreshold: 300,
    priorityWeights: {
      depth: 0.3,
      skuCount: 0.3,
      hasChildren: 0.2,
      recency: 0.2,
    },
  };

  private config: Required<GapAnalysisConfig>;

  constructor(config?: GapAnalysisConfig) {
    this.config = { ...this.defaultConfig, ...config };
  }

  identifyGaps(taxonomy: TaxonomyNode): ContentGap[] {
    const gaps: ContentGap[] = [];
    this.traverseAndAnalyze(taxonomy, gaps);
    
    return gaps.sort((a, b) => b.priority - a.priority);
  }

  private traverseAndAnalyze(node: TaxonomyNode, gaps: ContentGap[]): void {
    const nodeGaps = this.analyzeNode(node);
    gaps.push(...nodeGaps);

    for (const child of node.children) {
      this.traverseAndAnalyze(child, gaps);
    }
  }

  private analyzeNode(node: TaxonomyNode): ContentGap[] {
    const gaps: ContentGap[] = [];

    const missingContentGap = this.checkMissingContent(node);
    if (missingContentGap) gaps.push(missingContentGap);

    const outdatedGap = this.checkOutdatedContent(node);
    if (outdatedGap) gaps.push(outdatedGap);

    const thinContentGap = this.checkThinContent(node);
    if (thinContentGap) gaps.push(thinContentGap);

    const metadataGap = this.checkMissingMetadata(node);
    if (metadataGap) gaps.push(metadataGap);

    const qualityGap = this.checkLowQuality(node);
    if (qualityGap) gaps.push(qualityGap);

    return gaps;
  }

  private checkMissingContent(node: TaxonomyNode): ContentGap | null {
    if (node.metadata.contentStatus === ContentStatus.MISSING || 
        !node.metadata.hasContent) {
      return {
        nodeId: node.id,
        url: node.url,
        gapType: GapType.MISSING,
        priority: this.calculatePriority(node, GapType.MISSING),
        reason: 'No content exists for this node',
        suggestedAction: 'Create new content for this URL',
        metadata: {
          lastModified: node.metadata.lastModified,
        },
      };
    }
    return null;
  }

  private checkOutdatedContent(node: TaxonomyNode): ContentGap | null {
    if (node.metadata.contentStatus !== ContentStatus.PROCESSED) {
      return null;
    }

    const daysSinceUpdate = this.getDaysSinceUpdate(node.metadata.lastModified);
    
    if (daysSinceUpdate > this.config.outdatedThresholdDays) {
      return {
        nodeId: node.id,
        url: node.url,
        gapType: GapType.OUTDATED,
        priority: this.calculatePriority(node, GapType.OUTDATED),
        reason: `Content hasn't been updated in ${daysSinceUpdate} days`,
        suggestedAction: 'Review and update content to ensure accuracy',
        metadata: {
          lastModified: node.metadata.lastModified,
        },
      };
    }
    return null;
  }

  private checkThinContent(node: TaxonomyNode): ContentGap | null {
    if (!node.metadata.hasContent) {
      return null;
    }

    const estimatedContentLength = this.estimateContentLength(node);
    
    if (estimatedContentLength < this.config.thinContentThreshold) {
      return {
        nodeId: node.id,
        url: node.url,
        gapType: GapType.THIN,
        priority: this.calculatePriority(node, GapType.THIN),
        reason: `Content appears to be thin (estimated ${estimatedContentLength} chars)`,
        suggestedAction: 'Expand content with more detailed information',
        metadata: {
          contentLength: estimatedContentLength,
        },
      };
    }
    return null;
  }

  private checkMissingMetadata(node: TaxonomyNode): ContentGap | null {
    const missingElements: string[] = [];

    if (node.metadata.skuCount === 0 && node.children.length === 0) {
      missingElements.push('SKU count');
    }

    if (!node.title || node.title === 'Unknown') {
      missingElements.push('Page title');
    }

    if (missingElements.length > 0) {
      return {
        nodeId: node.id,
        url: node.url,
        gapType: GapType.NO_METADATA,
        priority: this.calculatePriority(node, GapType.NO_METADATA),
        reason: `Missing metadata: ${missingElements.join(', ')}`,
        suggestedAction: 'Add missing metadata elements',
        metadata: {
          missingElements,
        },
      };
    }
    return null;
  }

  private checkLowQuality(node: TaxonomyNode): ContentGap | null {
    const qualityScore = this.calculateQualityScore(node);
    
    if (qualityScore < 0.5) {
      return {
        nodeId: node.id,
        url: node.url,
        gapType: GapType.LOW_QUALITY,
        priority: this.calculatePriority(node, GapType.LOW_QUALITY),
        reason: `Low quality score: ${(qualityScore * 100).toFixed(1)}%`,
        suggestedAction: 'Improve content quality and completeness',
        metadata: {
          qualityScore,
        },
      };
    }
    return null;
  }

  private getDaysSinceUpdate(lastModified: Date): number {
    const now = new Date();
    const diffMs = now.getTime() - lastModified.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }

  private estimateContentLength(node: TaxonomyNode): number {
    const baseLength = 100;
    const perSkuLength = 50;
    const perChildLength = 200;
    
    return baseLength + 
           (node.metadata.skuCount * perSkuLength) + 
           (node.children.length * perChildLength);
  }

  private calculateQualityScore(node: TaxonomyNode): number {
    let score = 0;
    let factors = 0;

    if (node.metadata.hasContent) {
      score += 0.3;
    }
    factors += 0.3;

    if (node.metadata.contentStatus === ContentStatus.PROCESSED) {
      score += 0.2;
    }
    factors += 0.2;

    if (node.metadata.skuCount > 0) {
      score += 0.2;
    }
    factors += 0.2;

    if (node.title && node.title !== 'Unknown') {
      score += 0.1;
    }
    factors += 0.1;

    const daysSinceUpdate = this.getDaysSinceUpdate(node.metadata.lastModified);
    if (daysSinceUpdate < 90) {
      score += 0.2;
    } else if (daysSinceUpdate < 180) {
      score += 0.1;
    }
    factors += 0.2;

    return factors > 0 ? score / factors : 0;
  }

  private calculatePriority(node: TaxonomyNode, gapType: GapType): number {
    const weights = this.config.priorityWeights;
    let priority = 0;

    const depthScore = Math.max(0, 1 - (node.depth / 10));
    priority += depthScore * weights.depth;

    const skuScore = Math.min(1, node.metadata.skuCount / 100);
    priority += skuScore * weights.skuCount;

    const childrenScore = node.children.length > 0 ? 1 : 0;
    priority += childrenScore * weights.hasChildren;

    const daysSinceUpdate = this.getDaysSinceUpdate(node.metadata.lastModified);
    const recencyScore = Math.max(0, 1 - (daysSinceUpdate / 365));
    priority += recencyScore * weights.recency;

    const gapTypeMultiplier = this.getGapTypeMultiplier(gapType);
    priority *= gapTypeMultiplier;

    return Math.min(1, Math.max(0, priority));
  }

  private getGapTypeMultiplier(gapType: GapType): number {
    const multipliers: Record<GapType, number> = {
      [GapType.MISSING]: 1.5,
      [GapType.BROKEN_LINK]: 1.3,
      [GapType.OUTDATED]: 1.0,
      [GapType.THIN]: 0.8,
      [GapType.LOW_QUALITY]: 0.7,
      [GapType.NO_METADATA]: 0.5,
    };
    return multipliers[gapType] || 1.0;
  }

  generateGapReport(gaps: ContentGap[]): {
    summary: {
      total: number;
      byType: Record<GapType, number>;
      highPriority: number;
      mediumPriority: number;
      lowPriority: number;
    };
    recommendations: string[];
    estimatedEffort: {
      hours: number;
      complexity: 'low' | 'medium' | 'high';
    };
  } {
    const summary = {
      total: gaps.length,
      byType: {} as Record<GapType, number>,
      highPriority: 0,
      mediumPriority: 0,
      lowPriority: 0,
    };

    for (const gap of gaps) {
      summary.byType[gap.gapType] = (summary.byType[gap.gapType] || 0) + 1;
      
      if (gap.priority > 0.7) {
        summary.highPriority++;
      } else if (gap.priority > 0.4) {
        summary.mediumPriority++;
      } else {
        summary.lowPriority++;
      }
    }

    const recommendations = this.generateRecommendations(gaps);
    const estimatedEffort = this.estimateEffort(gaps);

    return {
      summary,
      recommendations,
      estimatedEffort,
    };
  }

  private generateRecommendations(gaps: ContentGap[]): string[] {
    const recommendations: string[] = [];
    
    const missingCount = gaps.filter(g => g.gapType === GapType.MISSING).length;
    if (missingCount > 10) {
      recommendations.push(`Create content for ${missingCount} missing pages - prioritize high-traffic URLs`);
    }

    const outdatedCount = gaps.filter(g => g.gapType === GapType.OUTDATED).length;
    if (outdatedCount > 0) {
      recommendations.push(`Update ${outdatedCount} outdated pages to improve freshness`);
    }

    const thinCount = gaps.filter(g => g.gapType === GapType.THIN).length;
    if (thinCount > 0) {
      recommendations.push(`Expand ${thinCount} thin content pages with more comprehensive information`);
    }

    const highPriorityGaps = gaps.filter(g => g.priority > 0.7);
    if (highPriorityGaps.length > 0) {
      recommendations.push(`Focus on ${highPriorityGaps.length} high-priority gaps first for maximum impact`);
    }

    if (recommendations.length === 0) {
      recommendations.push('Content coverage is good - focus on quality improvements');
    }

    return recommendations;
  }

  private estimateEffort(gaps: ContentGap[]): {
    hours: number;
    complexity: 'low' | 'medium' | 'high';
  } {
    const effortPerGap: Record<GapType, number> = {
      [GapType.MISSING]: 4,
      [GapType.OUTDATED]: 2,
      [GapType.THIN]: 3,
      [GapType.NO_METADATA]: 0.5,
      [GapType.BROKEN_LINK]: 0.5,
      [GapType.LOW_QUALITY]: 2.5,
    };

    let totalHours = 0;
    for (const gap of gaps) {
      totalHours += effortPerGap[gap.gapType] || 1;
    }

    let complexity: 'low' | 'medium' | 'high';
    if (totalHours < 40) {
      complexity = 'low';
    } else if (totalHours < 160) {
      complexity = 'medium';
    } else {
      complexity = 'high';
    }

    return {
      hours: Math.round(totalHours),
      complexity,
    };
  }

  exportGapsToCSV(gaps: ContentGap[]): string {
    const headers = ['Node ID', 'URL', 'Gap Type', 'Priority', 'Reason', 'Suggested Action'];
    const rows = gaps.map(gap => [
      gap.nodeId,
      gap.url,
      gap.gapType,
      gap.priority.toFixed(2),
      gap.reason,
      gap.suggestedAction,
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    return csvContent;
  }
}