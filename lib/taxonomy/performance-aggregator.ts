/**
 * Performance Aggregator for Taxonomy Trees
 * 
 * Correctly aggregates metrics from leaf nodes (products) up through the category hierarchy
 * Key principle: Sum first, then calculate rates - never average percentages!
 */

export interface PerformanceMetrics {
  impressions: number;
  clicks: number;
  ctr: number; // Calculated: (clicks/impressions) * 100
  conversions: number;
  conversionRate: number; // Calculated: (conversions/clicks) * 100
  revenue: number;
  avgOrderValue: number; // Calculated: revenue/conversions
  productCount: number;
}

export interface TaxonomyNodeWithMetrics {
  id: string;
  path: string;
  title: string;
  depth: number;
  parent_id?: string;
  metrics: PerformanceMetrics;
  children?: TaxonomyNodeWithMetrics[];
  // Derived insights
  performanceScore?: number;
  benchmarkComparison?: {
    ctr: number; // % above/below average
    conversionRate: number;
  };
}

export class PerformanceAggregator {
  /**
   * Aggregates performance metrics up the taxonomy tree
   * 
   * CRITICAL RULES:
   * 1. Sum impressions, clicks, conversions, revenue UP the tree
   * 2. Calculate CTR and conversion rate from the SUMS, not averages
   * 3. Each product's metrics bubble up to ALL parent categories
   */
  aggregatePerformanceBottomUp(
    nodes: any[],
    products: any[]
  ): Map<string, PerformanceMetrics> {
    const aggregatedMetrics = new Map<string, PerformanceMetrics>();
    
    // Initialize all nodes with zero metrics
    for (const node of nodes) {
      aggregatedMetrics.set(node.path, {
        impressions: 0,
        clicks: 0,
        ctr: 0,
        conversions: 0,
        conversionRate: 0,
        revenue: 0,
        avgOrderValue: 0,
        productCount: 0,
      });
    }
    
    // Process each product and bubble up its metrics
    for (const product of products) {
      if (!product.category_path || !product.performance) continue;
      
      const categoryLevels = product.category_path.split(' > ');
      
      // Add this product's metrics to EVERY level in its path
      for (let i = 0; i < categoryLevels.length; i++) {
        const categoryPath = categoryLevels.slice(0, i + 1).join(' > ');
        
        if (aggregatedMetrics.has(categoryPath)) {
          const metrics = aggregatedMetrics.get(categoryPath)!;
          
          // Add raw metrics (these sum up)
          metrics.impressions += product.performance.impressions || 0;
          metrics.clicks += product.performance.clicks || 0;
          metrics.conversions += product.performance.conversions || 0;
          metrics.revenue += product.performance.revenue || 0;
          metrics.productCount += 1;
        }
      }
    }
    
    // Now calculate derived metrics (CTR, conversion rate, AOV)
    for (const [path, metrics] of aggregatedMetrics.entries()) {
      // CTR: Total clicks / Total impressions
      metrics.ctr = metrics.impressions > 0 
        ? (metrics.clicks / metrics.impressions) * 100 
        : 0;
      
      // Conversion Rate: Total conversions / Total clicks
      metrics.conversionRate = metrics.clicks > 0
        ? (metrics.conversions / metrics.clicks) * 100
        : 0;
      
      // Average Order Value: Total revenue / Total conversions
      metrics.avgOrderValue = metrics.conversions > 0
        ? metrics.revenue / metrics.conversions
        : 0;
    }
    
    return aggregatedMetrics;
  }
  
  /**
   * Calculate performance score (0-100) based on metrics
   */
  calculatePerformanceScore(metrics: PerformanceMetrics): number {
    let score = 0;
    const maxScore = 100;
    
    // CTR Component (0-30 points)
    // Industry average CTR for Google Shopping: 0.86% - 2.5%
    if (metrics.impressions >= 100) { // Need meaningful data
      if (metrics.ctr >= 2.5) score += 30;
      else if (metrics.ctr >= 1.5) score += 20;
      else if (metrics.ctr >= 0.86) score += 10;
      else if (metrics.ctr > 0) score += 5;
    }
    
    // Conversion Rate Component (0-30 points)
    // Industry average: 1.91% - 3.5%
    if (metrics.clicks >= 50) { // Need meaningful data
      if (metrics.conversionRate >= 3.5) score += 30;
      else if (metrics.conversionRate >= 2.5) score += 20;
      else if (metrics.conversionRate >= 1.91) score += 10;
      else if (metrics.conversionRate > 0) score += 5;
    }
    
    // Revenue Component (0-20 points)
    // Based on revenue generation
    if (metrics.revenue > 10000) score += 20;
    else if (metrics.revenue > 5000) score += 15;
    else if (metrics.revenue > 1000) score += 10;
    else if (metrics.revenue > 100) score += 5;
    
    // Scale/Volume Component (0-20 points)
    // Reward categories with good traffic
    if (metrics.impressions > 10000) score += 20;
    else if (metrics.impressions > 5000) score += 15;
    else if (metrics.impressions > 1000) score += 10;
    else if (metrics.impressions > 100) score += 5;
    
    return Math.min(maxScore, score);
  }
  
  /**
   * Compare metrics against benchmarks (peer categories or industry averages)
   */
  compareToBenchmark(
    metrics: PerformanceMetrics,
    benchmark: PerformanceMetrics
  ): { ctr: number; conversionRate: number; revenue: number } {
    return {
      ctr: benchmark.ctr > 0 
        ? ((metrics.ctr - benchmark.ctr) / benchmark.ctr) * 100 
        : 0,
      conversionRate: benchmark.conversionRate > 0
        ? ((metrics.conversionRate - benchmark.conversionRate) / benchmark.conversionRate) * 100
        : 0,
      revenue: benchmark.revenue > 0
        ? ((metrics.revenue - benchmark.revenue) / benchmark.revenue) * 100
        : 0,
    };
  }
  
  /**
   * Calculate benchmark from peer categories at the same depth
   */
  calculatePeerBenchmark(
    nodes: TaxonomyNodeWithMetrics[],
    targetDepth: number
  ): PerformanceMetrics {
    const peerNodes = nodes.filter(n => n.depth === targetDepth);
    
    if (peerNodes.length === 0) {
      return {
        impressions: 0,
        clicks: 0,
        ctr: 0,
        conversions: 0,
        conversionRate: 0,
        revenue: 0,
        avgOrderValue: 0,
        productCount: 0,
      };
    }
    
    // Sum all metrics from peers
    const totalMetrics = peerNodes.reduce((acc, node) => ({
      impressions: acc.impressions + node.metrics.impressions,
      clicks: acc.clicks + node.metrics.clicks,
      conversions: acc.conversions + node.metrics.conversions,
      revenue: acc.revenue + node.metrics.revenue,
      productCount: acc.productCount + node.metrics.productCount,
    }), {
      impressions: 0,
      clicks: 0,
      conversions: 0,
      revenue: 0,
      productCount: 0,
    });
    
    // Calculate rates from totals (not average of rates!)
    return {
      ...totalMetrics,
      ctr: totalMetrics.impressions > 0 
        ? (totalMetrics.clicks / totalMetrics.impressions) * 100 
        : 0,
      conversionRate: totalMetrics.clicks > 0
        ? (totalMetrics.conversions / totalMetrics.clicks) * 100
        : 0,
      avgOrderValue: totalMetrics.conversions > 0
        ? totalMetrics.revenue / totalMetrics.conversions
        : 0,
    };
  }
  
  /**
   * Identify underperforming categories that need attention
   */
  findOpportunities(
    nodes: TaxonomyNodeWithMetrics[],
    minImpressions: number = 100
  ): Array<{
    node: TaxonomyNodeWithMetrics;
    issue: string;
    recommendation: string;
    potentialImpact: string;
    priority: 'critical' | 'high' | 'medium' | 'low';
  }> {
    const opportunities = [];
    
    for (const node of nodes) {
      // Skip nodes without meaningful data
      if (node.metrics.impressions < minImpressions) continue;
      
      const score = this.calculatePerformanceScore(node.metrics);
      const benchmark = this.calculatePeerBenchmark(nodes, node.depth);
      const comparison = this.compareToBenchmark(node.metrics, benchmark);
      
      // Critical: High traffic but terrible CTR
      if (node.metrics.impressions > 10000 && node.metrics.ctr < 0.5) {
        opportunities.push({
          node,
          issue: `Extremely low CTR (${node.metrics.ctr.toFixed(2)}%) despite high visibility`,
          recommendation: 'Urgently review and update product titles and images',
          potentialImpact: `Could gain ${Math.round(node.metrics.impressions * 0.02)} more clicks/month`,
          priority: 'critical' as const,
        });
      }
      
      // High: Below average CTR
      else if (comparison.ctr < -30) {
        opportunities.push({
          node,
          issue: `CTR ${Math.abs(comparison.ctr).toFixed(0)}% below category average`,
          recommendation: 'Optimize product titles and descriptions',
          potentialImpact: `Match peer performance for +${Math.round(benchmark.clicks - node.metrics.clicks)} clicks`,
          priority: 'high' as const,
        });
      }
      
      // High: Poor conversion despite good traffic
      if (node.metrics.clicks > 100 && node.metrics.conversionRate < 1) {
        opportunities.push({
          node,
          issue: `Low conversion rate (${node.metrics.conversionRate.toFixed(2)}%)`,
          recommendation: 'Review pricing, shipping costs, and product descriptions',
          potentialImpact: `Could gain $${Math.round(node.metrics.clicks * 0.02 * 50)} in revenue`,
          priority: 'high' as const,
        });
      }
      
      // Medium: Room for improvement
      if (score < 50 && node.metrics.productCount > 5) {
        opportunities.push({
          node,
          issue: `Overall performance score only ${score}/100`,
          recommendation: 'Comprehensive category optimization needed',
          potentialImpact: 'Significant revenue opportunity',
          priority: 'medium' as const,
        });
      }
    }
    
    // Sort by priority and potential impact
    return opportunities.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }
}