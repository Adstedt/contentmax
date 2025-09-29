import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/database.types';

type NodeMetrics = Database['public']['Tables']['node_metrics']['Row'];

export interface RevenueProjection {
  nodeId: string;
  currentRevenue: number;
  projectedRevenue: {
    conservative: number; // 25th percentile
    realistic: number; // 50th percentile (median)
    optimistic: number; // 75th percentile
  };
  revenueIncrease: {
    conservative: number;
    realistic: number;
    optimistic: number;
  };
  assumptions: {
    currentPosition: number;
    targetPosition: number;
    currentCTR: number;
    projectedCTR: number;
    conversionRate: number;
    averageOrderValue: number;
    impressions: number;
    seasonalityFactor: number;
  };
  confidence: number; // 0-100
  timeToImpact: number; // days
}

export interface WhatIfScenario {
  targetPosition: number;
  ctrImprovement?: number; // percentage points
  conversionRateImprovement?: number; // percentage points
}

export interface CalculatorConfig {
  conservativeMultiplier?: number; // Default 0.7
  realisticMultiplier?: number; // Default 1.0
  optimisticMultiplier?: number; // Default 1.5
  seasonalityWindow?: number; // months to look back, default 12
  confidenceThreshold?: number; // minimum data points needed
}

export class RevenueCalculator {
  private supabase: SupabaseClient<Database>;
  private config: Required<CalculatorConfig>;

  // Position to CTR multipliers based on industry research
  private readonly CTR_BY_POSITION: Record<number, number> = {
    1: 0.2849,
    2: 0.1523,
    3: 0.1065,
    4: 0.073,
    5: 0.0553,
    6: 0.0453,
    7: 0.039,
    8: 0.0342,
    9: 0.0306,
    10: 0.0276,
  };

  constructor(supabase: SupabaseClient<Database>, config: CalculatorConfig = {}) {
    this.supabase = supabase;
    this.config = {
      conservativeMultiplier: config.conservativeMultiplier ?? 0.7,
      realisticMultiplier: config.realisticMultiplier ?? 1.0,
      optimisticMultiplier: config.optimisticMultiplier ?? 1.5,
      seasonalityWindow: config.seasonalityWindow ?? 12,
      confidenceThreshold: config.confidenceThreshold ?? 30,
    };
  }

  /**
   * Calculate revenue projection for a node
   */
  async calculateProjection(nodeId: string, scenario?: WhatIfScenario): Promise<RevenueProjection> {
    // Fetch historical metrics
    const metrics = await this.getHistoricalMetrics(nodeId);

    if (metrics.length === 0) {
      throw new Error(`No metrics found for node ${nodeId}`);
    }

    // Get latest metrics
    const latestGSC = this.getLatestMetric(metrics, 'gsc');
    const latestGA4 = this.getLatestMetric(metrics, 'ga4');

    // Calculate current state
    const currentPosition = latestGSC?.position || 20;
    const currentCTR = latestGSC?.ctr || 0.01;
    const impressions = latestGSC?.impressions || 0;
    const currentRevenue = latestGA4?.revenue || 0;
    const conversionRate = latestGA4?.conversion_rate || 0.02;
    const transactions = latestGA4?.transactions || 1;
    const averageOrderValue = transactions > 0 ? currentRevenue / transactions : 100;

    // Calculate seasonality factor
    const seasonalityFactor = await this.calculateSeasonalityFactor(nodeId, metrics);

    // Determine target position and CTR
    const targetPosition = scenario?.targetPosition || Math.max(1, Math.floor(currentPosition - 3));
    const targetCTR = this.getExpectedCTR(targetPosition);
    const ctrImprovement = scenario?.ctrImprovement || 0;
    const projectedCTR = Math.min(targetCTR + ctrImprovement / 100, 1);

    // Calculate traffic increase
    const currentTraffic = impressions * currentCTR;
    const projectedTraffic = impressions * projectedCTR * seasonalityFactor;
    const trafficMultiplier = currentTraffic > 0 ? projectedTraffic / currentTraffic : 1;

    // Apply conversion rate improvement if specified
    const improvedConversionRate =
      conversionRate * (1 + (scenario?.conversionRateImprovement || 0) / 100);

    // Calculate revenue projections
    const baseProjectedRevenue = projectedTraffic * improvedConversionRate * averageOrderValue;

    const projectedRevenue = {
      conservative: baseProjectedRevenue * this.config.conservativeMultiplier,
      realistic: baseProjectedRevenue * this.config.realisticMultiplier,
      optimistic: baseProjectedRevenue * this.config.optimisticMultiplier,
    };

    const revenueIncrease = {
      conservative: Math.max(0, projectedRevenue.conservative - currentRevenue),
      realistic: Math.max(0, projectedRevenue.realistic - currentRevenue),
      optimistic: Math.max(0, projectedRevenue.optimistic - currentRevenue),
    };

    // Calculate confidence based on data quality
    const confidence = this.calculateConfidence(metrics, impressions);

    // Estimate time to impact (based on typical SEO timelines)
    const timeToImpact = this.estimateTimeToImpact(currentPosition, targetPosition);

    return {
      nodeId,
      currentRevenue,
      projectedRevenue,
      revenueIncrease,
      assumptions: {
        currentPosition,
        targetPosition,
        currentCTR,
        projectedCTR,
        conversionRate: improvedConversionRate,
        averageOrderValue,
        impressions,
        seasonalityFactor,
      },
      confidence,
      timeToImpact,
    };
  }

  /**
   * Calculate projections for multiple scenarios
   */
  async calculateScenarios(
    nodeId: string,
    scenarios: WhatIfScenario[]
  ): Promise<RevenueProjection[]> {
    const projections = await Promise.all(
      scenarios.map((scenario) => this.calculateProjection(nodeId, scenario))
    );
    return projections;
  }

  /**
   * Calculate seasonality factor from historical data
   */
  private async calculateSeasonalityFactor(
    nodeId: string,
    metrics: NodeMetrics[]
  ): Promise<number> {
    const ga4Metrics = metrics.filter((m) => m.source === 'ga4' && m.revenue);

    if (ga4Metrics.length < 3) {
      return 1.0; // Not enough data for seasonality
    }

    // Group by month and calculate average
    const monthlyRevenue = new Map<number, number[]>();

    ga4Metrics.forEach((metric) => {
      const month = new Date(metric.date).getMonth();
      if (!monthlyRevenue.has(month)) {
        monthlyRevenue.set(month, []);
      }
      monthlyRevenue.get(month)!.push(metric.revenue!);
    });

    // Calculate average for each month
    const monthlyAverages = Array.from(monthlyRevenue.entries()).map(([month, revenues]) => ({
      month,
      average: revenues.reduce((a, b) => a + b, 0) / revenues.length,
    }));

    if (monthlyAverages.length === 0) return 1.0;

    // Calculate overall average
    const overallAverage =
      monthlyAverages.reduce((sum, m) => sum + m.average, 0) / monthlyAverages.length;

    // Get current month's factor
    const currentMonth = new Date().getMonth();
    const currentMonthData = monthlyAverages.find((m) => m.month === currentMonth);

    if (!currentMonthData || overallAverage === 0) return 1.0;

    // Return seasonality factor (how current month compares to average)
    return currentMonthData.average / overallAverage;
  }

  /**
   * Calculate confidence score based on data quality
   */
  private calculateConfidence(metrics: NodeMetrics[], impressions: number): number {
    let confidence = 0;

    // Data recency (max 30 points)
    const latestMetric = metrics[0];
    const daysSinceUpdate = Math.floor(
      (Date.now() - new Date(latestMetric.date).getTime()) / (1000 * 60 * 60 * 24)
    );
    confidence += Math.max(0, 30 - daysSinceUpdate);

    // Data volume (max 30 points)
    if (metrics.length >= this.config.confidenceThreshold) {
      confidence += 30;
    } else {
      confidence += (metrics.length / this.config.confidenceThreshold) * 30;
    }

    // Traffic volume (max 20 points)
    if (impressions > 10000) confidence += 20;
    else if (impressions > 1000) confidence += 15;
    else if (impressions > 100) confidence += 10;
    else if (impressions > 10) confidence += 5;

    // Historical consistency (max 20 points)
    if (metrics.length >= 6) {
      const revenues = metrics
        .filter((m) => m.source === 'ga4' && m.revenue)
        .map((m) => m.revenue!);

      if (revenues.length > 1) {
        const mean = revenues.reduce((a, b) => a + b, 0) / revenues.length;
        const variance =
          revenues.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / revenues.length;
        const stdDev = Math.sqrt(variance);
        const coefficientOfVariation = mean > 0 ? stdDev / mean : 1;

        // Lower variation = higher confidence
        if (coefficientOfVariation < 0.3) confidence += 20;
        else if (coefficientOfVariation < 0.5) confidence += 15;
        else if (coefficientOfVariation < 0.7) confidence += 10;
        else if (coefficientOfVariation < 1.0) confidence += 5;
      }
    }

    return Math.min(100, Math.max(0, confidence));
  }

  /**
   * Estimate time to see impact based on position change
   */
  private estimateTimeToImpact(currentPosition: number, targetPosition: number): number {
    const positionChange = Math.abs(currentPosition - targetPosition);

    // Based on typical SEO timelines
    if (positionChange <= 3) return 30; // 1 month for small improvements
    if (positionChange <= 5) return 60; // 2 months for moderate improvements
    if (positionChange <= 10) return 90; // 3 months for significant improvements
    return 120; // 4 months for major improvements
  }

  /**
   * Get expected CTR for a position
   */
  private getExpectedCTR(position: number): number {
    if (position < 1) return this.CTR_BY_POSITION[1];
    if (position <= 10) return this.CTR_BY_POSITION[Math.floor(position)] || 0.02;
    if (position <= 20) return 0.015;
    if (position <= 30) return 0.01;
    return 0.005;
  }

  /**
   * Get historical metrics for a node
   */
  private async getHistoricalMetrics(nodeId: string): Promise<NodeMetrics[]> {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - this.config.seasonalityWindow);

    const { data, error } = await this.supabase
      .from('node_metrics')
      .select('*')
      .eq('node_id', nodeId)
      .gte('date', startDate.toISOString().split('T')[0])
      .order('date', { ascending: false });

    if (error) {
      console.error('Error fetching historical metrics:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Get latest metric by source
   */
  private getLatestMetric(metrics: NodeMetrics[], source: string): NodeMetrics | null {
    return metrics.find((m) => m.source === source) || null;
  }

  /**
   * Batch calculate projections for multiple nodes
   */
  async batchCalculateProjections(
    nodeIds: string[],
    scenario?: WhatIfScenario,
    onProgress?: (completed: number, total: number) => void
  ): Promise<RevenueProjection[]> {
    const results: RevenueProjection[] = [];
    const batchSize = 10;

    for (let i = 0; i < nodeIds.length; i += batchSize) {
      const batch = nodeIds.slice(i, i + batchSize);
      const batchPromises = batch.map((nodeId) =>
        this.calculateProjection(nodeId, scenario).catch((error) => {
          console.error(`Failed to calculate projection for ${nodeId}:`, error);
          return null;
        })
      );

      const batchResults = await Promise.all(batchPromises);
      const validResults = batchResults.filter((r) => r !== null) as RevenueProjection[];
      results.push(...validResults);

      if (onProgress) {
        onProgress(Math.min(i + batchSize, nodeIds.length), nodeIds.length);
      }
    }

    return results;
  }
}
