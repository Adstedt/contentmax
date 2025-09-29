import { TaxonomyNode, Product, IntegratedMetric, AggregatedMetrics } from '@/types/integration';

export class MetricsAggregator {
  /**
   * Aggregate metrics from products to categories (bottom-up)
   * This allows category-level views to show aggregated metrics from all child products
   */
  aggregateToCategories(
    nodes: TaxonomyNode[],
    productMetrics: Map<string, IntegratedMetric>
  ): Map<string, AggregatedMetrics> {
    const nodeMetrics = new Map<string, AggregatedMetrics>();

    // Step 1: Initialize metrics for all nodes
    for (const node of nodes) {
      nodeMetrics.set(node.id, this.initMetrics(node.id));
    }

    // Step 2: Aggregate product metrics to their direct categories
    for (const [productId, metrics] of productMetrics) {
      const product = this.findProductById(productId);
      if (!product || !product.category_id) continue;

      const categoryMetrics = nodeMetrics.get(product.category_id);
      if (categoryMetrics) {
        this.addMetrics(categoryMetrics, metrics);
      }
    }

    // Step 3: Aggregate up the taxonomy tree (bottom-up)
    const sortedNodes = this.sortNodesByDepth(nodes, 'desc');

    for (const node of sortedNodes) {
      const currentMetrics = nodeMetrics.get(node.id);
      if (!currentMetrics) continue;

      // Add metrics from all child nodes
      const children = nodes.filter((n) => n.parent_id === node.id);
      for (const child of children) {
        const childMetrics = nodeMetrics.get(child.id);
        if (childMetrics) {
          this.addAggregatedMetrics(currentMetrics, childMetrics);
        }
      }

      // Calculate averages and rates
      this.calculateDerivedMetrics(currentMetrics);
    }

    return nodeMetrics;
  }

  /**
   * Combine metrics from multiple sources for a single entity
   */
  combineMetrics(gscMetrics?: any, ga4Metrics?: any, marketMetrics?: any): IntegratedMetric {
    const combined: Partial<IntegratedMetric> = {
      // GSC metrics
      gsc_clicks: gscMetrics?.clicks || 0,
      gsc_impressions: gscMetrics?.impressions || 0,
      gsc_ctr: gscMetrics?.ctr || 0,
      gsc_position: gscMetrics?.position || 0,
      gsc_match_confidence: gscMetrics?.confidence,

      // GA4 metrics
      ga4_sessions: ga4Metrics?.sessions || 0,
      ga4_revenue: ga4Metrics?.revenue || 0,
      ga4_transactions: ga4Metrics?.transactions || 0,
      ga4_conversion_rate: ga4Metrics?.conversion_rate || 0,
      ga4_match_confidence: ga4Metrics?.confidence,

      // Market metrics
      market_price_median: marketMetrics?.median_price,
      market_competitor_count: marketMetrics?.competitor_count,
      price_position: marketMetrics?.price_position,
      market_match_confidence: marketMetrics?.confidence,

      is_aggregated: false,
      child_count: 0,
    };

    return combined as IntegratedMetric;
  }

  /**
   * Calculate rollup metrics for date ranges
   */
  aggregateDateRange(
    metrics: IntegratedMetric[],
    startDate: Date,
    endDate: Date
  ): AggregatedMetrics {
    const filtered = metrics.filter((m) => {
      const date = new Date(m.metrics_date);
      return date >= startDate && date <= endDate;
    });

    if (filtered.length === 0) {
      return this.initMetrics('aggregate');
    }

    const aggregated = this.initMetrics('aggregate');

    for (const metric of filtered) {
      this.addMetrics(aggregated, metric);
    }

    this.calculateDerivedMetrics(aggregated);
    return aggregated;
  }

  private initMetrics(nodeId: string): AggregatedMetrics {
    return {
      node_id: nodeId,
      clicks: 0,
      impressions: 0,
      revenue: 0,
      sessions: 0,
      transactions: 0,
      avg_position: 0,
      avg_conversion_rate: 0,
      product_count: 0,
      child_node_count: 0,
      confidence: 0,
      _positions: [],
      _conversion_rates: [],
      _confidences: [],
    } as AggregatedMetrics & {
      _positions: number[];
      _conversion_rates: number[];
      _confidences: number[];
    };
  }

  private addMetrics(target: any, source: IntegratedMetric) {
    // Sum absolute metrics
    target.clicks += source.gsc_clicks || 0;
    target.impressions += source.gsc_impressions || 0;
    target.revenue += source.ga4_revenue || 0;
    target.sessions += source.ga4_sessions || 0;
    target.transactions += source.ga4_transactions || 0;
    target.product_count += 1;

    // Collect values for averaging
    if (source.gsc_position && source.gsc_position > 0) {
      target._positions = target._positions || [];
      target._positions.push(source.gsc_position);
    }

    if (source.ga4_conversion_rate !== undefined) {
      target._conversion_rates = target._conversion_rates || [];
      target._conversion_rates.push(source.ga4_conversion_rate);
    }

    // Track confidence scores
    const confidences = [
      source.gsc_match_confidence,
      source.ga4_match_confidence,
      source.market_match_confidence,
    ].filter((c) => c !== undefined && c !== null);

    if (confidences.length > 0) {
      target._confidences = target._confidences || [];
      target._confidences.push(...confidences);
    }
  }

  private addAggregatedMetrics(target: any, source: AggregatedMetrics) {
    // Sum metrics from child nodes
    target.clicks += source.clicks;
    target.impressions += source.impressions;
    target.revenue += source.revenue;
    target.sessions += source.sessions;
    target.transactions += source.transactions;
    target.product_count += source.product_count;
    target.child_node_count += 1;

    // Merge position and rate arrays for recalculation
    if (source.avg_position > 0) {
      target._positions = target._positions || [];
      // Weight by impressions
      const weight = source.impressions || 1;
      for (let i = 0; i < weight; i += 1000) {
        target._positions.push(source.avg_position);
      }
    }

    if (source.avg_conversion_rate > 0) {
      target._conversion_rates = target._conversion_rates || [];
      // Weight by sessions
      const weight = source.sessions || 1;
      for (let i = 0; i < weight; i += 100) {
        target._conversion_rates.push(source.avg_conversion_rate);
      }
    }

    // Merge confidence scores
    if (source.confidence > 0) {
      target._confidences = target._confidences || [];
      target._confidences.push(source.confidence);
    }
  }

  private calculateDerivedMetrics(metrics: any) {
    // Calculate average position (weighted by impressions)
    if (metrics._positions && metrics._positions.length > 0) {
      metrics.avg_position = this.average(metrics._positions);
    }

    // Calculate average conversion rate (weighted by sessions)
    if (metrics._conversion_rates && metrics._conversion_rates.length > 0) {
      metrics.avg_conversion_rate = this.average(metrics._conversion_rates);
    } else if (metrics.sessions > 0) {
      metrics.avg_conversion_rate = metrics.transactions / metrics.sessions;
    }

    // Calculate average confidence
    if (metrics._confidences && metrics._confidences.length > 0) {
      metrics.confidence = this.average(metrics._confidences);
    }

    // Clean up temporary arrays
    delete metrics._positions;
    delete metrics._conversion_rates;
    delete metrics._confidences;
  }

  private average(values: number[]): number {
    if (values.length === 0) return 0;
    const sum = values.reduce((a, b) => a + b, 0);
    return sum / values.length;
  }

  private sortNodesByDepth(nodes: TaxonomyNode[], order: 'asc' | 'desc'): TaxonomyNode[] {
    const getDepth = (node: TaxonomyNode): number => {
      if (!node.parent_id) return 0;
      const parent = nodes.find((n) => n.id === node.parent_id);
      return parent ? getDepth(parent) + 1 : 0;
    };

    return [...nodes].sort((a, b) => {
      const depthA = getDepth(a);
      const depthB = getDepth(b);
      return order === 'asc' ? depthA - depthB : depthB - depthA;
    });
  }

  private findProductById(productId: string): Product | null {
    // This would need to be implemented based on your data access pattern
    // For now, returning null as a placeholder
    return null;
  }

  /**
   * Calculate opportunity scores based on aggregated metrics
   */
  calculateOpportunityScore(metrics: AggregatedMetrics): number {
    let score = 0;

    // High impressions but low clicks = opportunity
    if (metrics.impressions > 1000 && metrics.clicks < metrics.impressions * 0.02) {
      score += 30;
    }

    // Good clicks but low conversions = opportunity
    if (metrics.clicks > 100 && metrics.avg_conversion_rate < 0.01) {
      score += 25;
    }

    // Poor position with traffic = opportunity
    if (metrics.avg_position > 10 && metrics.impressions > 500) {
      score += 20;
    }

    // Revenue potential (high-value category with low performance)
    if (metrics.product_count > 10 && metrics.revenue < metrics.product_count * 100) {
      score += 25;
    }

    return Math.min(score, 100);
  }
}
