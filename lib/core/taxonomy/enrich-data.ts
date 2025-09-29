import { useState, useEffect } from 'react';
import type { TaxonomyNode } from '@/components/taxonomy/D3Visualization';
import { OpportunityService } from '@/lib/services/opportunity-service';
import { OpportunityRevenueCalculator } from '@/lib/core/analysis/opportunity-revenue-calculator';
import { OpportunityCategorizer } from '@/lib/core/analysis/opportunity-categorizer';

// Use real implementations from Sprint 7
const opportunityService = new OpportunityService();
const revenueCalculator = new OpportunityRevenueCalculator();
const categorizer = new OpportunityCategorizer();

// Adapter classes for backward compatibility
class OpportunityScorer {
  async calculateScore(metrics: any) {
    try {
      // For now, return a simple calculated score since the service method is not compatible
      const trafficScore = Math.min(100, (metrics.traffic || 100) / 100);
      const revenueScore = Math.min(100, (metrics.revenue || 1000) / 1000);
      const positionScore = Math.max(0, 100 - (metrics.position || 15) * 5);

      const totalScore = (trafficScore + revenueScore + positionScore) / 3;

      return {
        value: totalScore,
        confidence:
          totalScore > 70
            ? 'high'
            : totalScore > 40
              ? 'medium'
              : ('low' as 'low' | 'medium' | 'high'),
        factors: [
          {
            name: 'Traffic Potential',
            impact: trafficScore / 10,
            current: metrics.traffic || 100,
            potential: (metrics.traffic || 100) * 2,
          },
          {
            name: 'Revenue Opportunity',
            impact: revenueScore / 10,
            current: metrics.revenue || 1000,
            potential: (metrics.revenue || 1000) * 1.5,
          },
          {
            name: 'Pricing Position',
            impact: positionScore / 10,
            current: metrics.price || 80,
            potential: 100,
          },
        ],
      };
    } catch (error) {
      console.error('Error calculating opportunity score:', error);
      // Fallback to mock data if real service fails
      const value = Math.random() * 10;
      return {
        value,
        confidence: value > 7 ? 'high' : value > 4 ? 'medium' : 'low',
        factors: [],
      };
    }
  }
}

class RevenueCalculator {
  project(params: any) {
    try {
      const revenue = revenueCalculator.calculate({
        currentRevenue: params.currentRevenue || 1000,
        trafficGap: params.trafficGap || 0.5,
        conversionGap: params.conversionGap || 0.3,
        aovGap: params.aovGap || 0.2,
        marketSize: params.marketSize || 10000,
      });

      return {
        conservative: params.currentRevenue * 1.2,
        realistic: params.currentRevenue + revenue.projectedIncrease,
        optimistic: params.currentRevenue + revenue.projectedIncrease * 1.5,
        current: params.currentRevenue,
        timeToImpact: revenue.timeToImpact,
      };
    } catch (error) {
      console.error('Error calculating revenue projection:', error);
      // Fallback to mock data
      const base = params.currentRevenue || 1000;
      return {
        conservative: base * 1.2,
        realistic: base * 1.5,
        optimistic: base * 2.0,
        current: base,
      };
    }
  }
}

class RecommendationsEngine {
  async generate(node: any, score: any, options?: any) {
    try {
      const category = categorizer.categorize(score.value, 'low');
      const priority = categorizer.getPriority(category);

      const recommendations = [];

      // Generate recommendations based on opportunity category
      if (category === 'quick-win') {
        recommendations.push({
          id: '1',
          title: 'Quick SEO optimizations',
          description: 'Update meta descriptions and title tags for immediate impact',
          priority: 'high' as const,
          impact: {
            metric: 'CTR',
            current: 2.5,
            projected: 4.0,
            confidence: 0.9,
          },
          effort: 'minimal' as const,
        });
      }

      if (score.value > 5) {
        recommendations.push({
          id: '2',
          title: 'Enhance product content',
          description: 'Add detailed specifications, benefits, and use cases',
          priority: priority === 'critical' ? 'high' : ('medium' as const),
          effort: 'moderate' as const,
        });
      }

      if (node.imageCount < 5) {
        recommendations.push({
          id: '3',
          title: 'Add high-quality images',
          description: 'Include lifestyle shots and detail views',
          priority: 'medium' as const,
          effort: 'moderate' as const,
        });
      }

      return recommendations;
    } catch (error) {
      console.error('Error generating recommendations:', error);
      // Fallback recommendations
      return [
        {
          id: '1',
          title: 'Optimize product description',
          description: 'Add more detailed product specifications and benefits',
          priority: 'high' as const,
          effort: 'minimal' as const,
        },
      ];
    }
  }
}

export interface GoogleShoppingData {
  nodeId: string;
  imageUrl?: string;
  price?: number;
  currency?: string;
  availability?: 'in_stock' | 'out_of_stock' | 'preorder';
  condition?: 'new' | 'used' | 'refurbished';
  brand?: string;
  gtin?: string;
  mpn?: string;
  description?: string;
  rating?: number;
  reviewCount?: number;
  imageCount?: number;
  additionalImages?: string[];
  productHighlights?: string[];
}

export interface EnrichedTaxonomyNode extends TaxonomyNode {
  opportunityScore?: {
    value: number;
    confidence: 'low' | 'medium' | 'high';
    trend?: 'up' | 'down' | 'stable';
    factors?: Array<{
      name: string;
      impact: number;
      current: number;
      potential: number;
    }>;
  };

  revenueProjection?: {
    current: number;
    conservative: number;
    realistic: number;
    optimistic: number;
    timeToImpact?: string;
  };

  recommendations?: Array<{
    id: string;
    title: string;
    description: string;
    priority: 'critical' | 'high' | 'medium' | 'low';
    impact?: {
      metric: string;
      current: number;
      projected: number;
      confidence: number;
    };
    effort?: 'minimal' | 'moderate' | 'significant';
  }>;

  contentMetrics?: {
    description: {
      currentLength: number;
      recommendedLength: number;
      quality: 'poor' | 'fair' | 'good' | 'excellent';
      missingKeywords?: string[];
    };
    images: {
      count: number;
      recommended: number;
      missingTypes?: string[];
    };
    specifications: {
      filledFields: number;
      totalFields: number;
      criticalMissing?: string[];
    };
    schema: {
      isValid: boolean;
      missingProperties?: string[];
      warnings?: string[];
    };
  };

  shoppingData?: GoogleShoppingData;
}

export class TaxonomyEnrichmentPipeline {
  private scorer: OpportunityScorer;
  private calculator: RevenueCalculator;
  private recommendationsEngine: RecommendationsEngine;

  constructor() {
    this.scorer = new OpportunityScorer();
    this.calculator = new RevenueCalculator();
    this.recommendationsEngine = new RecommendationsEngine();
  }

  /**
   * Enrich taxonomy nodes with Sprint 4 features
   */
  async enrichNodes(
    nodes: TaxonomyNode[],
    options?: {
      includeScoring?: boolean;
      includeRevenue?: boolean;
      includeRecommendations?: boolean;
      includeShoppingData?: boolean;
      batchSize?: number;
    }
  ): Promise<EnrichedTaxonomyNode[]> {
    const {
      includeScoring = true,
      includeRevenue = true,
      includeRecommendations = true,
      includeShoppingData = true,
      batchSize = 50,
    } = options || {};

    // Process in batches for better performance
    const batches = this.createBatches(nodes, batchSize);
    const enrichedBatches: EnrichedTaxonomyNode[][] = [];

    for (const batch of batches) {
      const enrichedBatch = await Promise.all(
        batch.map(async (node) =>
          this.enrichSingleNode(node, {
            includeScoring,
            includeRevenue,
            includeRecommendations,
            includeShoppingData,
          })
        )
      );
      enrichedBatches.push(enrichedBatch);
    }

    return enrichedBatches.flat();
  }

  /**
   * Enrich a single taxonomy node
   */
  private async enrichSingleNode(
    node: TaxonomyNode,
    options: {
      includeScoring: boolean;
      includeRevenue: boolean;
      includeRecommendations: boolean;
      includeShoppingData: boolean;
    }
  ): Promise<EnrichedTaxonomyNode> {
    const enriched: EnrichedTaxonomyNode = { ...node };

    // Enrich all nodes, not just product-level
    // Categories get aggregated scores from their children

    try {
      // Calculate opportunity score
      if (options.includeScoring) {
        enriched.opportunityScore = await this.calculateOpportunityScore(node);
      }

      // Calculate revenue projection
      if (options.includeRevenue && enriched.opportunityScore) {
        enriched.revenueProjection = await this.calculateRevenueProjection(
          node,
          enriched.opportunityScore.value
        );
      }

      // Generate recommendations
      if (options.includeRecommendations && enriched.opportunityScore) {
        enriched.recommendations = await this.generateRecommendations(
          node,
          enriched.opportunityScore
        );
      }

      // Fetch shopping data
      if (options.includeShoppingData) {
        enriched.shoppingData = await this.fetchShoppingData(node);
      }

      // Calculate content metrics
      enriched.contentMetrics = this.calculateContentMetrics(node, enriched.shoppingData);
    } catch (error) {
      console.error(`Error enriching node ${node.id}:`, error);
    }

    return enriched;
  }

  /**
   * Calculate opportunity score for a node
   */
  private async calculateOpportunityScore(node: TaxonomyNode) {
    // Mock implementation - replace with actual Sprint 4 integration
    const mockMetrics = {
      ctr: Math.random() * 0.1,
      position: Math.floor(Math.random() * 20) + 1,
      impressions: Math.floor(Math.random() * 10000),
      clicks: Math.floor(Math.random() * 500),
      searchVolume: Math.floor(Math.random() * 5000),
    };

    const score = await this.scorer.calculateScore(mockMetrics);

    return {
      value: score.value,
      confidence: score.confidence as 'low' | 'medium' | 'high',
      trend: this.calculateTrend(node),
      factors: score.factors,
    };
  }

  /**
   * Calculate revenue projection
   */
  private async calculateRevenueProjection(node: TaxonomyNode, opportunityScore: number) {
    const currentRevenue = node.revenue || 0;

    const projection = this.calculator.project({
      currentRevenue,
      opportunityScore,
      historicalData: this.generateMockHistoricalData(),
      conversionRate: 0.02,
      avgOrderValue: 150,
    });

    return {
      current: currentRevenue,
      conservative: projection.conservative,
      realistic: projection.realistic,
      optimistic: projection.optimistic,
      timeToImpact: '30-60 days',
    };
  }

  /**
   * Generate AI recommendations
   */
  private async generateRecommendations(node: TaxonomyNode, opportunityScore: any) {
    const recommendations = await this.recommendationsEngine.generate(
      node,
      opportunityScore,
      { mode: 'template' } // Use template mode for speed
    );

    return recommendations.slice(0, 3).map((rec) => ({
      id: rec.id,
      title: rec.title,
      description: rec.description,
      priority: rec.priority,
      impact: rec.impact,
      effort: rec.effort,
    }));
  }

  /**
   * Fetch Google Shopping data
   */
  private async fetchShoppingData(node: TaxonomyNode): Promise<GoogleShoppingData | undefined> {
    // Mock implementation - replace with actual API call
    if (Math.random() > 0.7) {
      return {
        nodeId: node.id,
        imageUrl: `https://picsum.photos/seed/${node.id}/400/400`,
        price: Math.floor(Math.random() * 1000) + 50,
        currency: 'USD',
        availability: ['in_stock', 'out_of_stock', 'preorder'][
          Math.floor(Math.random() * 3)
        ] as any,
        condition: 'new',
        brand: ['Apple', 'Samsung', 'Sony', 'LG', 'Nike'][Math.floor(Math.random() * 5)],
        description: `High-quality ${node.title} with advanced features and reliable performance.`,
        rating: 3.5 + Math.random() * 1.5,
        reviewCount: Math.floor(Math.random() * 1000),
        imageCount: Math.floor(Math.random() * 8) + 1,
      };
    }
    return undefined;
  }

  /**
   * Calculate content metrics
   */
  private calculateContentMetrics(node: TaxonomyNode, shoppingData?: GoogleShoppingData) {
    const descLength = shoppingData?.description?.length || 0;
    const imageCount = shoppingData?.imageCount || 0;

    return {
      description: {
        currentLength: descLength,
        recommendedLength: 500,
        quality: this.assessDescriptionQuality(descLength),
        missingKeywords: descLength < 200 ? ['features', 'benefits', 'specifications'] : undefined,
      },
      images: {
        count: imageCount,
        recommended: 8,
        missingTypes: imageCount < 4 ? ['lifestyle', 'size-chart', 'detail-shots'] : undefined,
      },
      specifications: {
        filledFields: Math.floor(Math.random() * 20),
        totalFields: 20,
        criticalMissing: Math.random() > 0.5 ? ['dimensions', 'weight'] : undefined,
      },
      schema: {
        isValid: Math.random() > 0.3,
        missingProperties: Math.random() > 0.5 ? ['aggregateRating', 'offers'] : undefined,
      },
    };
  }

  private assessDescriptionQuality(length: number): 'poor' | 'fair' | 'good' | 'excellent' {
    if (length < 100) return 'poor';
    if (length < 300) return 'fair';
    if (length < 500) return 'good';
    return 'excellent';
  }

  private calculateTrend(node: TaxonomyNode): 'up' | 'down' | 'stable' {
    // Mock trend calculation
    const rand = Math.random();
    if (rand < 0.33) return 'up';
    if (rand < 0.66) return 'down';
    return 'stable';
  }

  private generateMockHistoricalData() {
    return Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      revenue: Math.floor(Math.random() * 10000) + 5000,
      traffic: Math.floor(Math.random() * 5000) + 1000,
    }));
  }

  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }
}

/**
 * Fetch Google Shopping data for multiple nodes
 */
export async function fetchGoogleShoppingData(
  nodeIds: string[]
): Promise<Map<string, GoogleShoppingData>> {
  try {
    const response = await fetch(`/api/shopping-feed?nodeIds=${nodeIds.join(',')}`);
    if (!response.ok) throw new Error('Failed to fetch shopping data');

    const data = await response.json();
    const dataMap = new Map<string, GoogleShoppingData>();

    data.forEach((item: GoogleShoppingData) => {
      dataMap.set(item.nodeId, item);
    });

    return dataMap;
  } catch (error) {
    console.error('Error fetching shopping data:', error);
    return new Map();
  }
}

/**
 * Hook for using enriched taxonomy data
 */
export function useEnrichedTaxonomy(
  nodes: TaxonomyNode[],
  options?: Parameters<TaxonomyEnrichmentPipeline['enrichNodes']>[1]
) {
  const [enrichedNodes, setEnrichedNodes] = useState<EnrichedTaxonomyNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const pipeline = new TaxonomyEnrichmentPipeline();

    setLoading(true);
    pipeline
      .enrichNodes(nodes, options)
      .then(setEnrichedNodes)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [nodes, options]);

  return { enrichedNodes, loading, error };
}
