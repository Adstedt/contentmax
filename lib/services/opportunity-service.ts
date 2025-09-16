import { supabase } from '@/lib/supabase/client';
import { TrafficCalculator } from '@/lib/scoring/traffic-calculator';
import { OpportunityRevenueCalculator } from '@/lib/scoring/opportunity-revenue-calculator';
import { PricingCalculator, type PricingData } from '@/lib/scoring/pricing-calculator';
import { OpportunityCategorizer } from '@/lib/scoring/opportunity-categorizer';
import type { TaxonomyNode } from '@/components/taxonomy/D3Visualization';
import type {
  SearchMetrics,
  AnalyticsMetrics,
} from '@/components/taxonomy/D3Visualization/NodeTooltip';

export interface OpportunityScore {
  nodeId: string;
  score: number;
  factors: {
    trafficPotential: number;
    revenuePotential: number;
    pricingOpportunity: number;
    competitiveGap: number;
    contentQuality: number;
  };
  category: 'quick-win' | 'strategic' | 'incremental' | 'long-term' | 'maintain';
  confidence: 'high' | 'medium' | 'low';
  projectedImpact: {
    revenue: number;
    traffic: number;
    timeline: number; // days
  };
  recommendations: string[];
  calculatedAt: Date;
}

export interface NodeMetrics {
  search: SearchMetrics | null;
  analytics: AnalyticsMetrics | null;
  pricing: PricingData | null;
  productCount: number;
  dataCompleteness: number; // 0-100
}

interface ScoringWeights {
  traffic: number;
  revenue: number;
  pricing: number;
  competitive: number;
  content: number;
}

export class OpportunityService {
  private trafficCalc: TrafficCalculator;
  private revenueCalc: OpportunityRevenueCalculator;
  private pricingCalc: PricingCalculator;
  private categorizer: OpportunityCategorizer;
  private weights: ScoringWeights;

  constructor(weights?: Partial<ScoringWeights>) {
    this.trafficCalc = new TrafficCalculator();
    this.revenueCalc = new OpportunityRevenueCalculator();
    this.pricingCalc = new PricingCalculator();
    this.categorizer = new OpportunityCategorizer();

    // Default weights
    this.weights = {
      traffic: 0.25,
      revenue: 0.3,
      pricing: 0.25,
      competitive: 0.1,
      content: 0.1,
      ...weights,
    };
  }

  /**
   * Calculate opportunity scores for all nodes
   */
  async calculateOpportunityScores(
    nodes: TaxonomyNode[],
    userId: string
  ): Promise<OpportunityScore[]> {
    const scores: OpportunityScore[] = [];

    for (const node of nodes) {
      try {
        const score = await this.calculateNodeScore(node, userId);
        scores.push(score);
      } catch (error) {
        console.error(`Failed to calculate score for node ${node.id}:`, error);
      }
    }

    // Store scores in database
    await this.persistScores(scores, userId);

    return scores.sort((a, b) => b.score - a.score);
  }

  /**
   * Calculate opportunity score for a single node
   */
  async calculateNodeScore(node: TaxonomyNode, userId: string): Promise<OpportunityScore> {
    // Fetch all metrics for the node
    const metrics = await this.fetchNodeMetrics(node.id, userId);

    // Calculate individual scoring factors
    const trafficResult = this.trafficCalc.calculate(metrics.search);
    const revenueResult = this.revenueCalc.calculate(metrics.analytics);
    const pricingResult = this.pricingCalc.calculate(
      metrics.pricing,
      metrics.analytics?.revenue || 0
    );

    // Calculate competitive gap (simplified for now)
    const competitiveGap = this.calculateCompetitiveGap(metrics);

    // Calculate content quality score
    const contentQuality = this.calculateContentQuality(metrics);

    // Calculate composite score with weights
    const score = Math.min(
      100,
      trafficResult.score * this.weights.traffic +
        revenueResult.score * this.weights.revenue +
        pricingResult.score * this.weights.pricing +
        competitiveGap * this.weights.competitive +
        contentQuality * this.weights.content
    );

    // Determine confidence based on data availability
    const confidence = this.calculateConfidence(metrics);

    // Categorize opportunity
    const category = this.categorizer.categorize(score, node.skuCount || 0);

    // Calculate projected impact
    const projectedImpact = await this.calculateProjectedImpact(
      node,
      metrics,
      trafficResult,
      revenueResult,
      pricingResult
    );

    // Combine all recommendations
    const recommendations = [
      ...trafficResult.recommendations,
      ...revenueResult.recommendations,
      ...pricingResult.recommendations,
    ].slice(0, 5); // Top 5 recommendations

    return {
      nodeId: node.id,
      score: Math.round(score),
      factors: {
        trafficPotential: trafficResult.score,
        revenuePotential: revenueResult.score,
        pricingOpportunity: pricingResult.score,
        competitiveGap: Math.round(competitiveGap),
        contentQuality: Math.round(contentQuality),
      },
      category,
      confidence,
      projectedImpact,
      recommendations,
      calculatedAt: new Date(),
    };
  }

  /**
   * Fetch all metrics for a node
   */
  private async fetchNodeMetrics(nodeId: string, userId: string): Promise<NodeMetrics> {
    // Fetch search metrics
    const { data: searchData } = await supabase
      .from('search_metrics')
      .select('*')
      .eq('node_id', nodeId)
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(1)
      .single();

    // Fetch analytics metrics
    const { data: analyticsData } = await supabase
      .from('analytics_metrics')
      .select('*')
      .eq('node_id', nodeId)
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(1)
      .single();

    // Fetch pricing data (would need market_pricing table)
    const pricingData = await this.fetchPricingData(nodeId, userId);

    // Get product count
    const { count: productCount } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('node_id', nodeId)
      .eq('user_id', userId);

    // Calculate data completeness
    const dataCompleteness = await this.calculateDataCompleteness(nodeId, userId);

    return {
      search: searchData
        ? {
            clicks: searchData.clicks || 0,
            impressions: searchData.impressions || 0,
            ctr: searchData.ctr || 0,
            position: searchData.position || 20,
          }
        : null,
      analytics: analyticsData
        ? {
            revenue: analyticsData.revenue || 0,
            transactions: analyticsData.transactions || 0,
            sessions: analyticsData.sessions || 0,
            conversionRate: analyticsData.conversion_rate || 0,
            avgOrderValue: analyticsData.avg_order_value || 0,
            engagementRate: analyticsData.engagement_rate || 0,
          }
        : null,
      pricing: pricingData,
      productCount: productCount || 0,
      dataCompleteness,
    };
  }

  /**
   * Fetch pricing data
   */
  private async fetchPricingData(nodeId: string, userId: string): Promise<PricingData | null> {
    try {
      // Query market pricing data if available
      const { data: products } = await this.supabase
        .from('products')
        .select('price')
        .eq('node_id', nodeId)
        .eq('user_id', userId);

      if (!products || products.length === 0) {
        return null;
      }

      const prices = products.map((p) => p.price).filter((p) => p > 0);
      if (prices.length === 0) {
        return null;
      }

      // Calculate pricing statistics
      const ourPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
      const sortedPrices = [...prices].sort((a, b) => a - b);
      const median = sortedPrices[Math.floor(sortedPrices.length / 2)];

      // For market data, we'd need competitor pricing from STORY-021
      // Using simplified approach for now
      return {
        ourPrice,
        marketMedian: median * 1.1, // Estimated market median
        marketMin: Math.min(...prices),
        marketMax: Math.max(...prices),
        competitorCount: 5, // Placeholder
      };
    } catch (error) {
      console.error('Error fetching pricing data:', error);
      return null;
    }
  }

  /**
   * Calculate competitive gap score
   */
  private calculateCompetitiveGap(metrics: NodeMetrics): number {
    // Simplified calculation - would use competitor data
    if (!metrics.search) return 50;

    const { position } = metrics.search;

    // Better position = less competitive gap
    if (position <= 3) return 10;
    if (position <= 10) return 40;
    if (position <= 20) return 70;
    return 90;
  }

  /**
   * Calculate content quality score
   */
  private calculateContentQuality(metrics: NodeMetrics): number {
    return metrics.dataCompleteness;
  }

  /**
   * Calculate data completeness for products in node
   */
  private async calculateDataCompleteness(nodeId: string, userId: string): Promise<number> {
    const { data: products } = await supabase
      .from('products')
      .select('title, description, price, image, gtin')
      .eq('node_id', nodeId)
      .eq('user_id', userId)
      .limit(100);

    if (!products || products.length === 0) return 0;

    let totalScore = 0;
    for (const product of products) {
      let productScore = 0;
      if (product.title) productScore += 20;
      if (product.description && product.description.length > 50) productScore += 20;
      if (product.price && product.price > 0) productScore += 20;
      if (product.image) productScore += 20;
      if (product.gtin) productScore += 20;
      totalScore += productScore;
    }

    return Math.round(totalScore / products.length);
  }

  /**
   * Calculate confidence based on data availability
   */
  private calculateConfidence(metrics: NodeMetrics): 'high' | 'medium' | 'low' {
    let dataPoints = 0;

    if (metrics.search && metrics.search.impressions > 100) dataPoints++;
    if (metrics.analytics && metrics.analytics.sessions > 100) dataPoints++;
    if (metrics.pricing) dataPoints++;
    if (metrics.productCount > 0) dataPoints++;
    if (metrics.dataCompleteness > 50) dataPoints++;

    if (dataPoints >= 4) return 'high';
    if (dataPoints >= 2) return 'medium';
    return 'low';
  }

  /**
   * Calculate projected impact
   */
  private async calculateProjectedImpact(
    node: TaxonomyNode,
    metrics: NodeMetrics,
    trafficResult: any,
    revenueResult: any,
    pricingResult: any
  ): Promise<OpportunityScore['projectedImpact']> {
    // Estimate traffic increase
    const currentTraffic = metrics.search?.clicks || 0;
    const trafficIncrease = this.trafficCalc.estimateTrafficIncrease(
      metrics.search || { clicks: 0, impressions: 0, ctr: 0, position: 20 },
      3 // Target position 3
    );

    // Estimate revenue increase
    const revenueIncrease = revenueResult.potentialRevenue || 0;
    const pricingRevenue = pricingResult.estimatedRevenueImpact || 0;
    const totalRevenueImpact = revenueIncrease + pricingRevenue;

    // Estimate timeline based on effort
    const productCount = node.skuCount || 0;
    const timeline = this.estimateTimeline(productCount);

    return {
      revenue: Math.round(totalRevenueImpact),
      traffic: Math.round(trafficIncrease),
      timeline,
    };
  }

  /**
   * Estimate implementation timeline
   */
  private estimateTimeline(productCount: number): number {
    if (productCount <= 10) return 14; // 2 weeks
    if (productCount <= 50) return 30; // 1 month
    if (productCount <= 200) return 60; // 2 months
    if (productCount <= 1000) return 90; // 3 months
    return 120; // 4 months
  }

  /**
   * Store scores in database
   */
  private async persistScores(scores: OpportunityScore[], userId: string): Promise<void> {
    const records = scores.map((score) => ({
      node_id: score.nodeId,
      score: score.score,
      traffic_potential: score.factors.trafficPotential,
      revenue_potential: score.factors.revenuePotential,
      pricing_opportunity: score.factors.pricingOpportunity,
      competitive_gap: score.factors.competitiveGap,
      content_quality: score.factors.contentQuality,
      opportunity_type: score.category,
      confidence_level: score.confidence,
      projected_impact_revenue: score.projectedImpact.revenue,
      projected_impact_traffic: score.projectedImpact.traffic,
      projected_timeline_days: score.projectedImpact.timeline,
      factors: score.factors,
      recommendations: score.recommendations,
      calculated_at: score.calculatedAt,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      user_id: userId,
    }));

    const { error } = await supabase.from('opportunity_scores').upsert(records, {
      onConflict: 'node_id,user_id',
    });

    if (error) {
      console.error('Failed to persist opportunity scores:', error);
    }
  }

  /**
   * Get top opportunities
   */
  async getTopOpportunities(
    userId: string,
    limit: number = 10,
    category?: OpportunityScore['category']
  ): Promise<OpportunityScore[]> {
    let query = supabase
      .from('opportunity_scores')
      .select('*')
      .eq('user_id', userId)
      .gt('expires_at', new Date().toISOString())
      .order('score', { ascending: false })
      .limit(limit);

    if (category) {
      query = query.eq('opportunity_type', category);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Failed to fetch opportunities:', error);
      return [];
    }

    return (data || []).map(this.mapDbToOpportunityScore);
  }

  /**
   * Map database record to OpportunityScore
   */
  private mapDbToOpportunityScore(record: any): OpportunityScore {
    return {
      nodeId: record.node_id,
      score: record.score,
      factors: record.factors,
      category: record.opportunity_type,
      confidence: record.confidence_level,
      projectedImpact: {
        revenue: record.projected_impact_revenue,
        traffic: record.projected_impact_traffic,
        timeline: record.projected_timeline_days,
      },
      recommendations: record.recommendations || [],
      calculatedAt: new Date(record.calculated_at),
    };
  }
}
