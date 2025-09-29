import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/database.types';

type NodeMetrics = Database['public']['Tables']['node_metrics']['Row'];
type TaxonomyNode = Database['public']['Tables']['taxonomy_nodes']['Row'];
type Opportunity = Database['public']['Tables']['opportunities']['Row'];

export interface ScoringFactors {
  ctrGap: number; // 0-100, gap between actual and expected CTR
  searchVolume: number; // 0-100, logarithmic scale of impressions
  positionPotential: number; // 0-100, improvement potential from current position
  competition: number; // 0-100, inverse of difficulty to rank
  revenue: number; // 0-100, logarithmic scale of revenue potential
}

export interface ScoringWeights {
  ctrGap: number; // Default: 0.30
  searchVolume: number; // Default: 0.25
  positionPotential: number; // Default: 0.20
  competition: number; // Default: 0.10
  revenue: number; // Default: 0.15
}

export interface OpportunityScore {
  nodeId: string;
  score: number; // 0-100 weighted total score
  confidence: number; // 0-100 confidence based on data quality
  factors: ScoringFactors;
  recommendations: string[];
  revenuePotential: number;
  priority: number; // 1-5 priority ranking
}

export interface CTRBenchmark {
  position: number;
  expectedCTR: number;
}

export interface ScoringConfig {
  weights?: Partial<ScoringWeights>;
  ctrBenchmarks?: CTRBenchmark[];
  minDataPoints?: number;
  maxAge?: number; // days
}

export class OpportunityScorer {
  private supabase: SupabaseClient<Database>;
  private weights: ScoringWeights;
  private ctrBenchmarks: CTRBenchmark[];
  private config: ScoringConfig;

  // Advanced Web Ranking 2024 CTR benchmarks
  private readonly DEFAULT_CTR_BENCHMARKS: CTRBenchmark[] = [
    { position: 1, expectedCTR: 0.2849 },
    { position: 2, expectedCTR: 0.1523 },
    { position: 3, expectedCTR: 0.1065 },
    { position: 4, expectedCTR: 0.073 },
    { position: 5, expectedCTR: 0.0553 },
    { position: 6, expectedCTR: 0.0453 },
    { position: 7, expectedCTR: 0.039 },
    { position: 8, expectedCTR: 0.0342 },
    { position: 9, expectedCTR: 0.0306 },
    { position: 10, expectedCTR: 0.0276 },
    { position: 11, expectedCTR: 0.0251 },
    { position: 12, expectedCTR: 0.0229 },
    { position: 13, expectedCTR: 0.0211 },
    { position: 14, expectedCTR: 0.0195 },
    { position: 15, expectedCTR: 0.0181 },
    { position: 16, expectedCTR: 0.0169 },
    { position: 17, expectedCTR: 0.0158 },
    { position: 18, expectedCTR: 0.0148 },
    { position: 19, expectedCTR: 0.014 },
    { position: 20, expectedCTR: 0.0132 },
  ];

  private readonly DEFAULT_WEIGHTS: ScoringWeights = {
    ctrGap: 0.3,
    searchVolume: 0.25,
    positionPotential: 0.2,
    competition: 0.1,
    revenue: 0.15,
  };

  constructor(supabase: SupabaseClient<Database>, config: ScoringConfig = {}) {
    this.supabase = supabase;
    this.config = config;
    this.weights = { ...this.DEFAULT_WEIGHTS, ...config.weights };
    this.ctrBenchmarks = config.ctrBenchmarks || this.DEFAULT_CTR_BENCHMARKS;
  }

  /**
   * Calculate opportunity score for a single node
   */
  async calculateScore(nodeId: string): Promise<OpportunityScore> {
    const [node, metrics] = await Promise.all([this.getNode(nodeId), this.getNodeMetrics(nodeId)]);

    if (!node) {
      throw new Error(`Node ${nodeId} not found`);
    }

    const factors = this.calculateFactors(node, metrics);
    const confidence = this.calculateConfidence(metrics);
    const score = this.calculateWeightedScore(factors);
    const recommendations = this.generateRecommendations(factors, node);
    const revenuePotential = this.calculateRevenuePotential(node, metrics);
    const priority = this.calculatePriority(score, revenuePotential);

    return {
      nodeId,
      score,
      confidence,
      factors,
      recommendations,
      revenuePotential,
      priority,
    };
  }

  /**
   * Calculate opportunity scores for multiple nodes in batch
   */
  async calculateBatchScores(
    nodeIds: string[],
    onProgress?: (completed: number, total: number) => void
  ): Promise<OpportunityScore[]> {
    const results: OpportunityScore[] = [];
    const batchSize = 10; // Process in batches to avoid memory issues

    for (let i = 0; i < nodeIds.length; i += batchSize) {
      const batch = nodeIds.slice(i, i + batchSize);
      const batchPromises = batch.map((nodeId) =>
        this.calculateScore(nodeId).catch((error) => {
          console.error(`Failed to score node ${nodeId}:`, error);
          return null;
        })
      );

      const batchResults = await Promise.all(batchPromises);
      const validResults = batchResults.filter((result) => result !== null) as OpportunityScore[];
      results.push(...validResults);

      if (onProgress) {
        onProgress(Math.min(i + batchSize, nodeIds.length), nodeIds.length);
      }
    }

    return results;
  }

  /**
   * Store opportunity scores in database
   */
  async storeScores(scores: OpportunityScore[]): Promise<void> {
    const records = scores.map((score) => ({
      node_id: score.nodeId,
      score: score.score,
      factors: score.factors as any,
      recommendations: score.recommendations as any,
      revenue_potential: score.revenuePotential,
      priority: score.priority,
      computed_at: new Date().toISOString(),
      valid_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
    }));

    const { error } = await this.supabase.from('opportunities').upsert(records, {
      onConflict: 'node_id',
      returning: 'minimal',
    });

    if (error) {
      throw new Error(`Failed to store opportunity scores: ${error.message}`);
    }
  }

  private calculateFactors(node: TaxonomyNode, metrics: NodeMetrics[]): ScoringFactors {
    // Get latest metrics by source
    const latestGA4 = this.getLatestMetric(metrics, 'ga4');
    const latestGSC = this.getLatestMetric(metrics, 'gsc');

    return {
      ctrGap: this.calculateCTRGap(latestGSC),
      searchVolume: this.calculateSearchVolumeScore(latestGSC),
      positionPotential: this.calculatePositionPotential(latestGSC),
      competition: this.calculateCompetitionScore(latestGSC),
      revenue: this.calculateRevenueScore(latestGA4, node),
    };
  }

  private calculateCTRGap(gscMetric: NodeMetrics | null): number {
    if (!gscMetric || !gscMetric.position || !gscMetric.ctr || !gscMetric.impressions) {
      return 0;
    }

    const expectedCTR = this.getExpectedCTR(gscMetric.position);
    const actualCTR = gscMetric.ctr;
    const gap = Math.max(0, expectedCTR - actualCTR);

    // Convert gap to 0-100 scale, higher gap = higher opportunity
    // Max gap assumed to be 25% (0.25)
    return Math.min(100, (gap / 0.25) * 100);
  }

  private calculateSearchVolumeScore(gscMetric: NodeMetrics | null): number {
    if (!gscMetric || !gscMetric.impressions) {
      return 0;
    }

    // Logarithmic scaling: log10(impressions + 1) / log10(1000000) * 100
    // Scales 0-1M impressions to 0-100 score
    const score = (Math.log10(gscMetric.impressions + 1) / Math.log10(1000000)) * 100;
    return Math.min(100, Math.max(0, score));
  }

  private calculatePositionPotential(gscMetric: NodeMetrics | null): number {
    if (!gscMetric || !gscMetric.position) {
      return 0;
    }

    const position = gscMetric.position;

    // Higher potential for positions 4-20 (can move to top 3)
    if (position <= 3) return 20; // Already in top 3
    if (position <= 10) return 90; // High potential to reach top 3
    if (position <= 20) return 70; // Good potential
    if (position <= 50) return 40; // Moderate potential
    return 10; // Low potential for positions beyond 50
  }

  private calculateCompetitionScore(gscMetric: NodeMetrics | null): number {
    if (!gscMetric || !gscMetric.position || !gscMetric.ctr) {
      return 50; // Default moderate competition
    }

    const position = gscMetric.position;
    const ctr = gscMetric.ctr;
    const expectedCTR = this.getExpectedCTR(position);

    // If CTR is higher than expected, competition might be lower
    const ctrRatio = ctr / expectedCTR;

    // Base competition score based on position (higher position = more competition)
    let competitionScore = Math.max(10, 100 - position * 2);

    // Adjust based on CTR performance
    if (ctrRatio > 1.2) competitionScore = Math.min(90, competitionScore + 20);
    if (ctrRatio < 0.8) competitionScore = Math.max(10, competitionScore - 20);

    return competitionScore;
  }

  private calculateRevenueScore(ga4Metric: NodeMetrics | null, node: TaxonomyNode): number {
    let revenue = 0;

    if (ga4Metric && ga4Metric.revenue) {
      revenue = ga4Metric.revenue;
    } else if (node.revenue_potential) {
      revenue = node.revenue_potential;
    } else {
      return 10; // Default low score for no revenue data
    }

    // Logarithmic scaling: log10(revenue + 1) / log10(100000) * 100
    // Scales $0-$100K revenue to 0-100 score
    const score = (Math.log10(revenue + 1) / Math.log10(100000)) * 100;
    return Math.min(100, Math.max(10, score));
  }

  private calculateWeightedScore(factors: ScoringFactors): number {
    const score =
      factors.ctrGap * this.weights.ctrGap +
      factors.searchVolume * this.weights.searchVolume +
      factors.positionPotential * this.weights.positionPotential +
      factors.competition * this.weights.competition +
      factors.revenue * this.weights.revenue;

    return Math.min(100, Math.max(0, score));
  }

  private calculateConfidence(metrics: NodeMetrics[]): number {
    if (metrics.length === 0) return 0;

    let confidence = 0;
    const weights = { gsc: 0.6, ga4: 0.4 };

    // Check for GSC data quality
    const gscMetrics = metrics.filter((m) => m.source === 'gsc');
    if (gscMetrics.length > 0) {
      const latest = gscMetrics[0];
      let gscConfidence = 0;

      if (latest.impressions && latest.impressions > 100) gscConfidence += 25;
      if (latest.clicks && latest.clicks > 10) gscConfidence += 25;
      if (latest.position && latest.position <= 50) gscConfidence += 25;
      if (latest.ctr && latest.ctr > 0) gscConfidence += 25;

      confidence += gscConfidence * weights.gsc;
    }

    // Check for GA4 data quality
    const ga4Metrics = metrics.filter((m) => m.source === 'ga4');
    if (ga4Metrics.length > 0) {
      const latest = ga4Metrics[0];
      let ga4Confidence = 0;

      if (latest.sessions && latest.sessions > 10) ga4Confidence += 50;
      if (latest.revenue && latest.revenue > 0) ga4Confidence += 50;

      confidence += ga4Confidence * weights.ga4;
    }

    // Age penalty - reduce confidence for old data
    const maxAge = this.config.maxAge || 30; // days
    const oldestMetric = metrics.reduce((oldest, current) =>
      new Date(current.date) < new Date(oldest.date) ? current : oldest
    );

    const daysSinceUpdate =
      (Date.now() - new Date(oldestMetric.date).getTime()) / (1000 * 60 * 60 * 24);
    const agePenalty = Math.min(50, (daysSinceUpdate / maxAge) * 50);
    confidence = Math.max(0, confidence - agePenalty);

    return Math.min(100, Math.max(0, confidence));
  }

  private generateRecommendations(factors: ScoringFactors, node: TaxonomyNode): string[] {
    const recommendations: string[] = [];

    // Content status recommendations (highest priority)
    if (node.content_status === 'missing') {
      recommendations.push('Create content for this category page to capture organic traffic');
    }
    if (node.content_status === 'outdated') {
      recommendations.push('Update existing content with fresh information and keywords');
    }

    // CTR Gap recommendations
    if (factors.ctrGap > 60) {
      recommendations.push(
        'Improve title tags and meta descriptions to increase click-through rate'
      );
    }
    if (factors.ctrGap > 40) {
      recommendations.push('Test different SERP snippets with rich snippets or schema markup');
    }

    // Position recommendations
    if (factors.positionPotential > 70) {
      recommendations.push('Optimize content and technical SEO to improve search rankings');
    }
    if (factors.positionPotential > 50) {
      recommendations.push('Build high-quality backlinks to increase domain authority');
    }

    // Volume recommendations
    if (factors.searchVolume > 80) {
      recommendations.push('High search volume - prioritize for immediate optimization');
    }
    if (factors.searchVolume > 60) {
      recommendations.push('Expand content to target related long-tail keywords');
    }

    // Revenue recommendations
    if (factors.revenue > 70) {
      recommendations.push('High revenue potential - focus on conversion optimization');
    }
    if (factors.revenue > 50) {
      recommendations.push('Implement conversion tracking to measure ROI impact');
    }

    // Competition recommendations
    if (factors.competition > 80) {
      recommendations.push('Low competition detected - opportunity for quick wins');
    }
    if (factors.competition < 30) {
      recommendations.push('High competition - focus on long-tail variations');
    }

    return recommendations.slice(0, 5); // Limit to top 5 recommendations
  }

  private calculateRevenuePotential(node: TaxonomyNode, metrics: NodeMetrics[]): number {
    const ga4Metric = this.getLatestMetric(metrics, 'ga4');
    const gscMetric = this.getLatestMetric(metrics, 'gsc');

    // Base revenue from existing data
    let baseRevenue = 0;
    if (ga4Metric && ga4Metric.revenue) {
      baseRevenue = ga4Metric.revenue;
    } else if (node.revenue_potential) {
      baseRevenue = node.revenue_potential;
    }

    // Calculate potential uplift based on CTR improvement
    let multiplier = 1.0;
    if (gscMetric) {
      const ctrGap = this.calculateCTRGap(gscMetric);
      // High CTR gap = high potential for traffic increase
      if (ctrGap > 70) multiplier = 3.0;
      else if (ctrGap > 50) multiplier = 2.5;
      else if (ctrGap > 30) multiplier = 2.0;
      else if (ctrGap > 10) multiplier = 1.5;
    }

    // Adjust for search volume
    if (gscMetric && gscMetric.impressions) {
      if (gscMetric.impressions > 10000) multiplier *= 1.5;
      else if (gscMetric.impressions > 1000) multiplier *= 1.2;
    }

    return baseRevenue * multiplier;
  }

  private calculatePriority(score: number, revenuePotential: number): number {
    // Priority 1-5 based on score and revenue potential
    const combinedScore =
      score * 0.7 + (Math.log10(revenuePotential + 1) / Math.log10(100000)) * 100 * 0.3;

    if (combinedScore >= 80) return 1; // Critical
    if (combinedScore >= 65) return 2; // High
    if (combinedScore >= 50) return 3; // Medium
    if (combinedScore >= 30) return 4; // Low
    return 5; // Very Low
  }

  private getExpectedCTR(position: number): number {
    const benchmark = this.ctrBenchmarks.find((b) => b.position === Math.round(position));
    if (benchmark) return benchmark.expectedCTR;

    // Interpolate for positions not in benchmarks
    if (position < 1) return this.ctrBenchmarks[0].expectedCTR;
    if (position > 20) return 0.01; // Default for positions beyond 20

    const lower = this.ctrBenchmarks.find((b) => b.position <= position);
    const upper = this.ctrBenchmarks.find((b) => b.position > position);

    if (!lower || !upper) return 0.01;

    const ratio = (position - lower.position) / (upper.position - lower.position);
    return lower.expectedCTR + ratio * (upper.expectedCTR - lower.expectedCTR);
  }

  private getLatestMetric(metrics: NodeMetrics[], source: string): NodeMetrics | null {
    const sourceMetrics = metrics.filter((m) => m.source === source);
    if (sourceMetrics.length === 0) return null;

    return sourceMetrics.reduce((latest, current) =>
      new Date(current.date) > new Date(latest.date) ? current : latest
    );
  }

  private async getNode(nodeId: string): Promise<TaxonomyNode | null> {
    const { data, error } = await this.supabase
      .from('taxonomy_nodes')
      .select('*')
      .eq('id', nodeId)
      .single();

    if (error) {
      console.error('Error fetching node:', error);
      return null;
    }

    return data;
  }

  private async getNodeMetrics(nodeId: string): Promise<NodeMetrics[]> {
    const { data, error } = await this.supabase
      .from('node_metrics')
      .select('*')
      .eq('node_id', nodeId)
      .order('date', { ascending: false })
      .limit(10); // Get last 10 metrics for analysis

    if (error) {
      console.error('Error fetching node metrics:', error);
      return [];
    }

    return data || [];
  }
}
