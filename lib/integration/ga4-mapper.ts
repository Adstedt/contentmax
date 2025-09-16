/**
 * GA4 Data Mapper
 *
 * Maps Google Analytics 4 data to taxonomy nodes and products
 */

import { URLMatcher } from './url-matcher';
import type { TaxonomyNode } from '@/components/taxonomy/D3Visualization';
import type { AnalyticsMetric, ProductMetric } from '@/lib/services/ga4-service';

export interface MappedAnalyticsMetric extends AnalyticsMetric {
  nodeId?: string;
  productId?: string;
  confidence: number;
  matchStrategy?: string;
}

export interface CategoryMapping {
  ga4Category: string;
  nodeId: string;
  confidence: number;
}

export class GA4Mapper {
  private urlMatcher: URLMatcher;
  private categoryMappings: Map<string, CategoryMapping>;

  constructor() {
    this.urlMatcher = new URLMatcher();
    this.categoryMappings = new Map();
  }

  /**
   * Map GA4 page metrics to taxonomy nodes
   */
  async mapPageMetricsToTaxonomy(
    metrics: AnalyticsMetric[],
    nodes: TaxonomyNode[],
    products: any[] = []
  ): Promise<MappedAnalyticsMetric[]> {
    const mappedMetrics: MappedAnalyticsMetric[] = [];

    for (const metric of metrics) {
      // Try URL-based matching first
      const urlMatch = this.urlMatcher.matchUrl(
        metric.pagePath,
        nodes,
        products
      );

      if (urlMatch) {
        if (urlMatch.type === 'node') {
          mappedMetrics.push({
            ...metric,
            nodeId: urlMatch.id,
            confidence: urlMatch.confidence,
            matchStrategy: urlMatch.matchStrategy,
          });
        } else if (urlMatch.type === 'product') {
          // Find the node for this product
          const product = products.find(p => p.id === urlMatch.id);
          if (product?.node_id) {
            mappedMetrics.push({
              ...metric,
              productId: urlMatch.id,
              nodeId: product.node_id,
              confidence: urlMatch.confidence,
              matchStrategy: urlMatch.matchStrategy,
            });
          } else {
            mappedMetrics.push({
              ...metric,
              productId: urlMatch.id,
              confidence: urlMatch.confidence,
              matchStrategy: urlMatch.matchStrategy,
            });
          }
        }
      } else if (metric.category) {
        // Try category-based matching as fallback
        const categoryMatch = this.matchByCategory(metric.category, nodes);
        if (categoryMatch) {
          mappedMetrics.push({
            ...metric,
            nodeId: categoryMatch.id,
            confidence: 0.7,
            matchStrategy: 'category',
          });
        } else {
          // No match found
          mappedMetrics.push({
            ...metric,
            confidence: 0,
            matchStrategy: 'none',
          });
        }
      } else {
        // No match found
        mappedMetrics.push({
          ...metric,
          confidence: 0,
          matchStrategy: 'none',
        });
      }
    }

    return mappedMetrics;
  }

  /**
   * Map GA4 product metrics to products and nodes
   */
  async mapProductMetrics(
    metrics: ProductMetric[],
    products: any[],
    nodes: TaxonomyNode[]
  ): Promise<any[]> {
    const mappedMetrics = [];

    for (const metric of metrics) {
      // Try to match by product ID
      let product = products.find(p =>
        p.id === metric.itemId ||
        p.gtin === metric.itemId ||
        p.mpn === metric.itemId
      );

      if (!product && metric.itemName) {
        // Try to match by name
        product = products.find(p =>
          p.title?.toLowerCase() === metric.itemName.toLowerCase()
        );
      }

      if (product) {
        mappedMetrics.push({
          ...metric,
          productId: product.id,
          nodeId: product.node_id,
          confidence: 0.9,
          matchStrategy: 'product-id',
        });
      } else if (metric.itemCategory) {
        // Try to match category to node
        const categoryMatch = this.matchByCategory(metric.itemCategory, nodes);
        if (categoryMatch) {
          mappedMetrics.push({
            ...metric,
            nodeId: categoryMatch.id,
            confidence: 0.6,
            matchStrategy: 'category',
          });
        } else {
          mappedMetrics.push({
            ...metric,
            confidence: 0,
            matchStrategy: 'none',
          });
        }
      } else {
        mappedMetrics.push({
          ...metric,
          confidence: 0,
          matchStrategy: 'none',
        });
      }
    }

    return mappedMetrics;
  }

  /**
   * Match GA4 category to taxonomy node
   */
  private matchByCategory(category: string, nodes: TaxonomyNode[]): TaxonomyNode | null {
    if (!category) return null;

    // Check cache first
    const cached = this.categoryMappings.get(category);
    if (cached) {
      return nodes.find(n => n.id === cached.nodeId) || null;
    }

    // Normalize category string
    const normalized = this.normalizeCategory(category);

    // Strategy 1: Exact path match
    let match = nodes.find(node => {
      const nodePath = this.normalizePath(node.path || '');
      return nodePath === normalized;
    });

    if (match) {
      this.cacheMapping(category, match.id, 1.0);
      return match;
    }

    // Strategy 2: Exact title match
    match = nodes.find(node => {
      const nodeTitle = this.normalizeTitle(node.title || '');
      return nodeTitle === normalized;
    });

    if (match) {
      this.cacheMapping(category, match.id, 0.9);
      return match;
    }

    // Strategy 3: Partial path match
    match = nodes.find(node => {
      const nodePath = this.normalizePath(node.path || '');
      return nodePath.includes(normalized) || normalized.includes(nodePath);
    });

    if (match) {
      this.cacheMapping(category, match.id, 0.7);
      return match;
    }

    // Strategy 4: Split category and match parts
    const categoryParts = normalized.split(/[\s>\/\-_]+/);
    if (categoryParts.length > 1) {
      // Try to find nodes that match the last part (most specific)
      const lastPart = categoryParts[categoryParts.length - 1];
      match = nodes.find(node => {
        const nodeTitle = this.normalizeTitle(node.title || '');
        return nodeTitle.includes(lastPart) || lastPart.includes(nodeTitle);
      });

      if (match) {
        this.cacheMapping(category, match.id, 0.5);
        return match;
      }
    }

    return null;
  }

  /**
   * Build category hierarchy from GA4 data
   */
  buildCategoryHierarchy(categories: string[]): Map<string, string[]> {
    const hierarchy = new Map<string, string[]>();

    for (const category of categories) {
      const parts = category.split(/[\s>\/]+/).filter(p => p.length > 0);

      for (let i = 0; i < parts.length; i++) {
        const current = parts.slice(0, i + 1).join(' > ');
        const parent = i > 0 ? parts.slice(0, i).join(' > ') : null;

        if (!hierarchy.has(current)) {
          hierarchy.set(current, []);
        }

        if (parent && !hierarchy.get(parent)?.includes(current)) {
          const children = hierarchy.get(parent) || [];
          children.push(current);
          hierarchy.set(parent, children);
        }
      }
    }

    return hierarchy;
  }

  /**
   * Calculate mapping statistics
   */
  getMappingStatistics(mappedMetrics: MappedAnalyticsMetric[]): {
    total: number;
    mapped: number;
    mappingRate: number;
    avgConfidence: number;
    byStrategy: Record<string, number>;
    unmappedUrls: string[];
  } {
    const total = mappedMetrics.length;
    const mapped = mappedMetrics.filter(m => m.nodeId || m.productId).length;
    const totalConfidence = mappedMetrics.reduce((sum, m) => sum + m.confidence, 0);
    const strategies: Record<string, number> = {};
    const unmapped: string[] = [];

    for (const metric of mappedMetrics) {
      const strategy = metric.matchStrategy || 'none';
      strategies[strategy] = (strategies[strategy] || 0) + 1;

      if (!metric.nodeId && !metric.productId && metric.pagePath) {
        unmapped.push(metric.pagePath);
      }
    }

    return {
      total,
      mapped,
      mappingRate: total > 0 ? mapped / total : 0,
      avgConfidence: total > 0 ? totalConfidence / total : 0,
      byStrategy: strategies,
      unmappedUrls: unmapped.slice(0, 100), // Limit to first 100
    };
  }

  /**
   * Normalize category string for matching
   */
  private normalizeCategory(category: string): string {
    return category
      .toLowerCase()
      .replace(/[^a-z0-9\s\-_>\/]/g, '')
      .replace(/\s+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Normalize path for comparison
   */
  private normalizePath(path: string): string {
    return path
      .toLowerCase()
      .replace(/^\/+|\/+$/g, '')
      .replace(/[^a-z0-9\-_\/]/g, '-')
      .replace(/-+/g, '-');
  }

  /**
   * Normalize title for comparison
   */
  private normalizeTitle(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s\-_]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Cache category mapping for performance
   */
  private cacheMapping(category: string, nodeId: string, confidence: number) {
    this.categoryMappings.set(category, {
      ga4Category: category,
      nodeId,
      confidence,
    });
  }

  /**
   * Export mapping cache
   */
  exportMappingCache(): CategoryMapping[] {
    return Array.from(this.categoryMappings.values());
  }

  /**
   * Import mapping cache
   */
  importMappingCache(mappings: CategoryMapping[]) {
    this.categoryMappings.clear();
    for (const mapping of mappings) {
      this.categoryMappings.set(mapping.ga4Category, mapping);
    }
  }
}