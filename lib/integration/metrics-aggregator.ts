/**
 * Metrics Aggregator
 *
 * Aggregates search and analytics metrics from products to categories
 * using bottom-up approach
 */

import type { TaxonomyNode } from '@/components/taxonomy/D3Visualization';
import type { SearchMetric } from '@/lib/services/gsc-service';
import type { MappedAnalyticsMetric } from '@/lib/integration/ga4-mapper';

export interface AggregatedMetrics {
  nodeId: string;
  clicks: number;
  impressions: number;
  ctr: number;
  avgPosition: number;
  urlCount: number;
  childMetrics?: AggregatedMetrics[];
}

export interface AggregatedAnalyticsMetrics {
  nodeId: string;
  revenue: number;
  transactions: number;
  sessions: number;
  users: number;
  conversionRate: number;
  avgOrderValue: number;
  engagementRate: number;
  bounceRate: number;
  pageViews: number;
  productCount: number;
  childMetrics?: AggregatedAnalyticsMetrics[];
}

export interface ProductMetric {
  productId: string;
  nodeId?: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export class MetricsAggregator {
  /**
   * Aggregate metrics from products to categories (bottom-up)
   */
  aggregateToCategories(
    nodes: TaxonomyNode[],
    productMetrics: Map<string, ProductMetric>
  ): Map<string, AggregatedMetrics> {
    const nodeMetrics = new Map<string, AggregatedMetrics>();

    // Step 1: Initialize leaf nodes with product metrics
    for (const [productId, metric] of productMetrics) {
      if (!metric.nodeId) continue;

      if (!nodeMetrics.has(metric.nodeId)) {
        nodeMetrics.set(metric.nodeId, this.initializeMetrics(metric.nodeId));
      }

      const catMetrics = nodeMetrics.get(metric.nodeId)!;
      this.addMetrics(catMetrics, metric);
    }

    // Step 2: Build parent-child relationships map
    const childToParent = new Map<string, string>();
    const parentToChildren = new Map<string, Set<string>>();

    for (const node of nodes) {
      if (node.parentId) {
        childToParent.set(node.id, node.parentId);

        if (!parentToChildren.has(node.parentId)) {
          parentToChildren.set(node.parentId, new Set());
        }
        parentToChildren.get(node.parentId)!.add(node.id);
      }
    }

    // Step 3: Sort nodes by depth (deepest first for bottom-up)
    const sortedNodes = this.sortNodesByDepth(nodes, childToParent, 'desc');

    // Step 4: Aggregate up the tree
    for (const node of sortedNodes) {
      const children = parentToChildren.get(node.id);
      if (!children || children.size === 0) continue;

      // Initialize parent metrics if not exists
      if (!nodeMetrics.has(node.id)) {
        nodeMetrics.set(node.id, this.initializeMetrics(node.id));
      }

      const parentMetrics = nodeMetrics.get(node.id)!;

      // Aggregate child metrics
      for (const childId of children) {
        const childMetrics = nodeMetrics.get(childId);
        if (childMetrics) {
          this.aggregateChildMetrics(parentMetrics, childMetrics);
        }
      }
    }

    // Step 5: Calculate final CTR and average positions
    for (const metrics of nodeMetrics.values()) {
      this.finalizeMetrics(metrics);
    }

    return nodeMetrics;
  }

  /**
   * Aggregate search metrics from URLs
   */
  aggregateSearchMetrics(
    nodes: TaxonomyNode[],
    urlMetrics: SearchMetric[],
    urlToNodeMap: Map<string, string>
  ): Map<string, AggregatedMetrics> {
    const nodeMetrics = new Map<string, AggregatedMetrics>();

    // Step 1: Group metrics by node
    for (const metric of urlMetrics) {
      const nodeId = urlToNodeMap.get(metric.url);
      if (!nodeId) continue;

      if (!nodeMetrics.has(nodeId)) {
        nodeMetrics.set(nodeId, this.initializeMetrics(nodeId));
      }

      const catMetrics = nodeMetrics.get(nodeId)!;
      this.addSearchMetrics(catMetrics, metric);
    }

    // Step 2: Build parent-child relationships
    const childToParent = new Map<string, string>();
    const parentToChildren = new Map<string, Set<string>>();

    for (const node of nodes) {
      if (node.parentId) {
        childToParent.set(node.id, node.parentId);

        if (!parentToChildren.has(node.parentId)) {
          parentToChildren.set(node.parentId, new Set());
        }
        parentToChildren.get(node.parentId)!.add(node.id);
      }
    }

    // Step 3: Aggregate up the tree
    const sortedNodes = this.sortNodesByDepth(nodes, childToParent, 'desc');

    for (const node of sortedNodes) {
      const children = parentToChildren.get(node.id);
      if (!children || children.size === 0) continue;

      if (!nodeMetrics.has(node.id)) {
        nodeMetrics.set(node.id, this.initializeMetrics(node.id));
      }

      const parentMetrics = nodeMetrics.get(node.id)!;

      for (const childId of children) {
        const childMetrics = nodeMetrics.get(childId);
        if (childMetrics) {
          this.aggregateChildMetrics(parentMetrics, childMetrics);
        }
      }
    }

    // Step 4: Finalize metrics
    for (const metrics of nodeMetrics.values()) {
      this.finalizeMetrics(metrics);
    }

    return nodeMetrics;
  }

  /**
   * Initialize empty metrics for a node
   */
  private initializeMetrics(nodeId: string): AggregatedMetrics {
    return {
      nodeId,
      clicks: 0,
      impressions: 0,
      ctr: 0,
      avgPosition: 0,
      urlCount: 0,
      childMetrics: [],
    };
  }

  /**
   * Add product metrics to aggregated metrics
   */
  private addMetrics(target: AggregatedMetrics, source: ProductMetric) {
    target.clicks += source.clicks;
    target.impressions += source.impressions;
    target.urlCount += 1;

    // Store position for weighted average calculation
    if (!target.childMetrics) {
      target.childMetrics = [];
    }
    target.childMetrics.push({
      nodeId: source.productId,
      clicks: source.clicks,
      impressions: source.impressions,
      ctr: source.ctr,
      avgPosition: source.position,
      urlCount: 1,
    });
  }

  /**
   * Add search metrics to aggregated metrics
   */
  private addSearchMetrics(target: AggregatedMetrics, source: SearchMetric) {
    target.clicks += source.clicks;
    target.impressions += source.impressions;
    target.urlCount += 1;

    // Store for position calculation
    if (!target.childMetrics) {
      target.childMetrics = [];
    }
    target.childMetrics.push({
      nodeId: source.url,
      clicks: source.clicks,
      impressions: source.impressions,
      ctr: source.ctr,
      avgPosition: source.position,
      urlCount: 1,
    });
  }

  /**
   * Aggregate child metrics into parent
   */
  private aggregateChildMetrics(parent: AggregatedMetrics, child: AggregatedMetrics) {
    parent.clicks += child.clicks;
    parent.impressions += child.impressions;
    parent.urlCount += child.urlCount;

    // Store child metrics for position calculation
    if (!parent.childMetrics) {
      parent.childMetrics = [];
    }
    parent.childMetrics.push(child);
  }

  /**
   * Finalize metrics calculation
   */
  private finalizeMetrics(metrics: AggregatedMetrics) {
    // Calculate CTR
    if (metrics.impressions > 0) {
      metrics.ctr = metrics.clicks / metrics.impressions;
    }

    // Calculate weighted average position
    if (metrics.childMetrics && metrics.childMetrics.length > 0) {
      let totalWeight = 0;
      let weightedSum = 0;

      for (const child of metrics.childMetrics) {
        // Use impressions as weight for position average
        const weight = child.impressions || 0;
        if (weight > 0 && child.avgPosition > 0) {
          weightedSum += child.avgPosition * weight;
          totalWeight += weight;
        }
      }

      if (totalWeight > 0) {
        metrics.avgPosition = weightedSum / totalWeight;
      }
    }

    // Round to reasonable precision
    metrics.ctr = Math.round(metrics.ctr * 10000) / 10000;
    metrics.avgPosition = Math.round(metrics.avgPosition * 10) / 10;
  }

  /**
   * Sort nodes by depth
   */
  private sortNodesByDepth(
    nodes: TaxonomyNode[],
    childToParent: Map<string, string>,
    order: 'asc' | 'desc' = 'asc'
  ): TaxonomyNode[] {
    // Calculate depth for each node
    const nodeDepths = new Map<string, number>();

    const getDepth = (nodeId: string): number => {
      if (nodeDepths.has(nodeId)) {
        return nodeDepths.get(nodeId)!;
      }

      const parentId = childToParent.get(nodeId);
      const depth = parentId ? getDepth(parentId) + 1 : 0;
      nodeDepths.set(nodeId, depth);
      return depth;
    };

    // Calculate all depths
    for (const node of nodes) {
      getDepth(node.id);
    }

    // Sort by depth
    return [...nodes].sort((a, b) => {
      const depthA = nodeDepths.get(a.id) || 0;
      const depthB = nodeDepths.get(b.id) || 0;
      return order === 'asc' ? depthA - depthB : depthB - depthA;
    });
  }

  /**
   * Calculate aggregate statistics
   */
  getAggregateStatistics(metrics: Map<string, AggregatedMetrics>): {
    totalNodes: number;
    totalClicks: number;
    totalImpressions: number;
    avgCTR: number;
    avgPosition: number;
    topPerformers: AggregatedMetrics[];
    needsAttention: AggregatedMetrics[];
  } {
    let totalClicks = 0;
    let totalImpressions = 0;
    const allMetrics = Array.from(metrics.values());

    for (const metric of allMetrics) {
      totalClicks += metric.clicks;
      totalImpressions += metric.impressions;
    }

    // Sort by clicks for top performers
    const topPerformers = [...allMetrics]
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 10);

    // Find nodes that need attention (high impressions, low CTR)
    const needsAttention = allMetrics
      .filter(m => m.impressions > 100 && m.ctr < 0.02)
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 10);

    return {
      totalNodes: metrics.size,
      totalClicks,
      totalImpressions,
      avgCTR: totalImpressions > 0 ? totalClicks / totalImpressions : 0,
      avgPosition: this.calculateOverallAvgPosition(allMetrics),
      topPerformers,
      needsAttention,
    };
  }

  /**
   * Calculate overall average position
   */
  private calculateOverallAvgPosition(metrics: AggregatedMetrics[]): number {
    let totalWeight = 0;
    let weightedSum = 0;

    for (const metric of metrics) {
      if (metric.impressions > 0 && metric.avgPosition > 0) {
        weightedSum += metric.avgPosition * metric.impressions;
        totalWeight += metric.impressions;
      }
    }

    return totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 10) / 10 : 0;
  }

  /**
   * Aggregate GA4 analytics metrics to categories (bottom-up)
   */
  aggregateAnalyticsMetrics(
    nodes: TaxonomyNode[],
    analyticsMetrics: MappedAnalyticsMetric[]
  ): Map<string, AggregatedAnalyticsMetrics> {
    const nodeMetrics = new Map<string, AggregatedAnalyticsMetrics>();

    // Step 1: Initialize nodes with direct metrics
    for (const metric of analyticsMetrics) {
      if (!metric.nodeId) continue;

      if (!nodeMetrics.has(metric.nodeId)) {
        nodeMetrics.set(metric.nodeId, this.initializeAnalyticsMetrics(metric.nodeId));
      }

      const catMetrics = nodeMetrics.get(metric.nodeId)!;
      this.addAnalyticsMetrics(catMetrics, metric);
    }

    // Step 2: Build parent-child relationships
    const childToParent = new Map<string, string>();
    const parentToChildren = new Map<string, Set<string>>();

    for (const node of nodes) {
      if (node.parentId) {
        childToParent.set(node.id, node.parentId);

        if (!parentToChildren.has(node.parentId)) {
          parentToChildren.set(node.parentId, new Set());
        }
        parentToChildren.get(node.parentId)!.add(node.id);
      }
    }

    // Step 3: Aggregate up the tree (bottom-up)
    const sortedNodes = this.sortNodesByDepth(nodes, childToParent, 'desc');

    for (const node of sortedNodes) {
      const children = parentToChildren.get(node.id);
      if (!children || children.size === 0) continue;

      if (!nodeMetrics.has(node.id)) {
        nodeMetrics.set(node.id, this.initializeAnalyticsMetrics(node.id));
      }

      const parentMetrics = nodeMetrics.get(node.id)!;

      for (const childId of children) {
        const childMetrics = nodeMetrics.get(childId);
        if (childMetrics) {
          this.aggregateChildAnalyticsMetrics(parentMetrics, childMetrics);
        }
      }
    }

    // Step 4: Calculate final rates and averages
    for (const metrics of nodeMetrics.values()) {
      this.finalizeAnalyticsMetrics(metrics);
    }

    return nodeMetrics;
  }

  /**
   * Initialize empty analytics metrics for a node
   */
  private initializeAnalyticsMetrics(nodeId: string): AggregatedAnalyticsMetrics {
    return {
      nodeId,
      revenue: 0,
      transactions: 0,
      sessions: 0,
      users: 0,
      conversionRate: 0,
      avgOrderValue: 0,
      engagementRate: 0,
      bounceRate: 0,
      pageViews: 0,
      productCount: 0,
      childMetrics: [],
    };
  }

  /**
   * Add analytics metrics to aggregated metrics
   */
  private addAnalyticsMetrics(target: AggregatedAnalyticsMetrics, source: MappedAnalyticsMetric) {
    target.revenue += source.revenue;
    target.transactions += source.transactions;
    target.sessions += source.sessions;
    target.users += source.users;
    target.pageViews += source.pageViews;
    target.productCount += 1;

    // Store for weighted average calculation
    if (!target.childMetrics) {
      target.childMetrics = [];
    }
    target.childMetrics.push({
      nodeId: source.pagePath,
      revenue: source.revenue,
      transactions: source.transactions,
      sessions: source.sessions,
      users: source.users,
      conversionRate: source.conversionRate,
      avgOrderValue: source.avgOrderValue,
      engagementRate: source.engagementRate,
      bounceRate: source.bounceRate,
      pageViews: source.pageViews,
      productCount: 1,
    });
  }

  /**
   * Aggregate child analytics metrics into parent
   */
  private aggregateChildAnalyticsMetrics(parent: AggregatedAnalyticsMetrics, child: AggregatedAnalyticsMetrics) {
    parent.revenue += child.revenue;
    parent.transactions += child.transactions;
    parent.sessions += child.sessions;
    parent.users += child.users;
    parent.pageViews += child.pageViews;
    parent.productCount += child.productCount;

    // Store child metrics for rate calculations
    if (!parent.childMetrics) {
      parent.childMetrics = [];
    }
    parent.childMetrics.push(child);
  }

  /**
   * Finalize analytics metrics calculation
   */
  private finalizeAnalyticsMetrics(metrics: AggregatedAnalyticsMetrics) {
    // Calculate conversion rate
    if (metrics.sessions > 0) {
      metrics.conversionRate = metrics.transactions / metrics.sessions;
    }

    // Calculate average order value
    if (metrics.transactions > 0) {
      metrics.avgOrderValue = metrics.revenue / metrics.transactions;
    }

    // Calculate weighted average engagement rate
    if (metrics.childMetrics && metrics.childMetrics.length > 0) {
      let totalWeight = 0;
      let weightedEngagement = 0;
      let weightedBounce = 0;

      for (const child of metrics.childMetrics) {
        // Use sessions as weight for engagement metrics
        const weight = child.sessions || 0;
        if (weight > 0) {
          weightedEngagement += child.engagementRate * weight;
          weightedBounce += child.bounceRate * weight;
          totalWeight += weight;
        }
      }

      if (totalWeight > 0) {
        metrics.engagementRate = weightedEngagement / totalWeight;
        metrics.bounceRate = weightedBounce / totalWeight;
      }
    }

    // Round to reasonable precision
    metrics.conversionRate = Math.round(metrics.conversionRate * 10000) / 10000;
    metrics.avgOrderValue = Math.round(metrics.avgOrderValue * 100) / 100;
    metrics.engagementRate = Math.round(metrics.engagementRate * 10000) / 10000;
    metrics.bounceRate = Math.round(metrics.bounceRate * 10000) / 10000;
  }

  /**
   * Calculate revenue statistics
   */
  getRevenueStatistics(metrics: Map<string, AggregatedAnalyticsMetrics>): {
    totalRevenue: number;
    totalTransactions: number;
    avgOrderValue: number;
    topRevenueNodes: AggregatedAnalyticsMetrics[];
    highConversionNodes: AggregatedAnalyticsMetrics[];
    lowConversionNodes: AggregatedAnalyticsMetrics[];
  } {
    let totalRevenue = 0;
    let totalTransactions = 0;
    const allMetrics = Array.from(metrics.values());

    for (const metric of allMetrics) {
      totalRevenue += metric.revenue;
      totalTransactions += metric.transactions;
    }

    // Sort by revenue for top performers
    const topRevenueNodes = [...allMetrics]
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // Find high conversion nodes (>5% conversion with decent traffic)
    const highConversionNodes = allMetrics
      .filter(m => m.sessions > 100 && m.conversionRate > 0.05)
      .sort((a, b) => b.conversionRate - a.conversionRate)
      .slice(0, 10);

    // Find low conversion nodes (needs optimization)
    const lowConversionNodes = allMetrics
      .filter(m => m.sessions > 100 && m.conversionRate < 0.01)
      .sort((a, b) => b.sessions - a.sessions)
      .slice(0, 10);

    return {
      totalRevenue,
      totalTransactions,
      avgOrderValue: totalTransactions > 0 ? totalRevenue / totalTransactions : 0,
      topRevenueNodes,
      highConversionNodes,
      lowConversionNodes,
    };
  }

  /**
   * Export metrics to CSV format
   */
  exportToCSV(metrics: Map<string, AggregatedMetrics>, nodes: TaxonomyNode[]): string {
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const rows: string[] = [];

    // Header
    rows.push('Node ID,Node Title,Path,Clicks,Impressions,CTR,Avg Position,URL Count');

    // Data rows
    for (const [nodeId, metric] of metrics) {
      const node = nodeMap.get(nodeId);
      const title = node?.title || nodeId;
      const path = node?.path || '';

      rows.push([
        nodeId,
        `"${title}"`,
        `"${path}"`,
        metric.clicks.toString(),
        metric.impressions.toString(),
        metric.ctr.toFixed(4),
        metric.avgPosition.toFixed(1),
        metric.urlCount.toString(),
      ].join(','));
    }

    return rows.join('\n');
  }

  /**
   * Export analytics metrics to CSV
   */
  exportAnalyticsToCSV(metrics: Map<string, AggregatedAnalyticsMetrics>, nodes: TaxonomyNode[]): string {
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const rows: string[] = [];

    // Header
    rows.push('Node ID,Node Title,Path,Revenue,Transactions,Sessions,Conversion Rate,AOV,Engagement Rate,Product Count');

    // Data rows
    for (const [nodeId, metric] of metrics) {
      const node = nodeMap.get(nodeId);
      const title = node?.title || nodeId;
      const path = node?.path || '';

      rows.push([
        nodeId,
        `"${title}"`,
        `"${path}"`,
        metric.revenue.toFixed(2),
        metric.transactions.toString(),
        metric.sessions.toString(),
        metric.conversionRate.toFixed(4),
        metric.avgOrderValue.toFixed(2),
        metric.engagementRate.toFixed(4),
        metric.productCount.toString(),
      ].join(','));
    }

    return rows.join('\n');
  }
}