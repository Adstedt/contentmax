/**
 * URL Matcher
 *
 * Matches external URLs to taxonomy nodes and products
 * with confidence scoring
 */

import type { TaxonomyNode } from '@/components/taxonomy/D3Visualization';

export interface Product {
  id: string;
  link?: string;
  title?: string;
  gtin?: string;
}

export interface MatchResult {
  type: 'node' | 'product';
  id: string;
  confidence: number;
  matchStrategy?: 'exact' | 'path' | 'product-id' | 'category' | 'fuzzy';
}

export class URLMatcher {
  /**
   * Normalize URL for comparison
   */
  private normalizeUrl(url: string): string {
    if (!url) return '';

    try {
      // Handle full URLs
      if (url.startsWith('http://') || url.startsWith('https://')) {
        const urlObj = new URL(url);
        // Remove www, trailing slash, and convert to lowercase
        return urlObj.pathname
          .replace(/\/$/, '')
          .toLowerCase()
          .replace(/^\//, ''); // Remove leading slash
      }

      // Handle relative URLs
      return url
        .replace(/\/$/, '')
        .toLowerCase()
        .replace(/^\//, '');
    } catch {
      // Fallback for malformed URLs
      return url
        .toLowerCase()
        .replace(/\/$/, '')
        .replace(/^\//, '');
    }
  }

  /**
   * Extract product ID from URL
   */
  private extractProductId(url: string): string | null {
    // Common patterns for product IDs in URLs
    const patterns = [
      /\/product\/([a-zA-Z0-9_-]+)/,
      /\/p\/([a-zA-Z0-9_-]+)/,
      /\/item\/([a-zA-Z0-9_-]+)/,
      /[?&]id=([a-zA-Z0-9_-]+)/,
      /[?&]product_id=([a-zA-Z0-9_-]+)/,
      /[?&]sku=([a-zA-Z0-9_-]+)/,
      /\/([A-Z0-9]{6,})(?:\/|$)/, // Amazon-style ASINs
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return null;
  }

  /**
   * Calculate string similarity (Levenshtein distance based)
   */
  private calculateSimilarity(str1: string, str2: string): number {
    if (!str1 || !str2) return 0;
    if (str1 === str2) return 1;

    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Match URL to taxonomy node
   */
  matchUrlToNode(
    url: string,
    nodes: TaxonomyNode[]
  ): { nodeId: string | null; confidence: number; strategy?: string } {
    if (!url || !nodes || nodes.length === 0) {
      return { nodeId: null, confidence: 0 };
    }

    const normalizedUrl = this.normalizeUrl(url);

    // Strategy 1: Exact URL match (confidence: 1.0)
    const exactMatch = nodes.find(n => {
      const nodeUrl = this.normalizeUrl(n.url || '');
      return nodeUrl === normalizedUrl;
    });

    if (exactMatch) {
      return {
        nodeId: exactMatch.id,
        confidence: 1.0,
        strategy: 'exact'
      };
    }

    // Strategy 2: Path-based match (confidence: 0.8)
    const pathMatch = nodes.find(n => {
      const nodePath = n.path?.toLowerCase().replace(/^\//, '') || '';
      return nodePath && normalizedUrl.includes(nodePath);
    });

    if (pathMatch) {
      // Higher confidence for longer path matches
      const pathLength = pathMatch.path?.length || 0;
      const confidence = Math.min(0.8 + (pathLength / 100) * 0.1, 0.9);
      return {
        nodeId: pathMatch.id,
        confidence,
        strategy: 'path'
      };
    }

    // Strategy 3: Category/title match in URL (confidence: 0.7)
    const categoryMatch = nodes.find(n => {
      const nodeTitle = n.title?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || '';
      return nodeTitle && normalizedUrl.includes(nodeTitle);
    });

    if (categoryMatch) {
      return {
        nodeId: categoryMatch.id,
        confidence: 0.7,
        strategy: 'category'
      };
    }

    // Strategy 4: Fuzzy matching (confidence: 0.3-0.6)
    let bestMatch: { node: TaxonomyNode; score: number } | null = null;

    for (const node of nodes) {
      if (!node.url && !node.path) continue;

      const nodeUrl = this.normalizeUrl(node.url || node.path || '');
      const similarity = this.calculateSimilarity(normalizedUrl, nodeUrl);

      if (similarity > 0.6 && (!bestMatch || similarity > bestMatch.score)) {
        bestMatch = { node, score: similarity };
      }
    }

    if (bestMatch && bestMatch.score > 0.6) {
      return {
        nodeId: bestMatch.node.id,
        confidence: bestMatch.score * 0.6, // Scale down fuzzy match confidence
        strategy: 'fuzzy'
      };
    }

    // No match found
    return { nodeId: null, confidence: 0 };
  }

  /**
   * Match URL to product
   */
  matchUrlToProduct(
    url: string,
    products: Product[]
  ): { productId: string | null; confidence: number; strategy?: string } {
    if (!url || !products || products.length === 0) {
      return { productId: null, confidence: 0 };
    }

    const normalizedUrl = this.normalizeUrl(url);

    // Strategy 1: Exact URL match (confidence: 1.0)
    const exactMatch = products.find(p => {
      const productUrl = this.normalizeUrl(p.link || '');
      return productUrl === normalizedUrl;
    });

    if (exactMatch) {
      return {
        productId: exactMatch.id,
        confidence: 1.0,
        strategy: 'exact'
      };
    }

    // Strategy 2: Product ID in URL (confidence: 0.9)
    const extractedId = this.extractProductId(url);
    if (extractedId) {
      const productMatch = products.find(p => {
        return p.id === extractedId ||
               p.gtin === extractedId ||
               (p.link && p.link.includes(extractedId));
      });

      if (productMatch) {
        return {
          productId: productMatch.id,
          confidence: 0.9,
          strategy: 'product-id'
        };
      }
    }

    // Strategy 3: Product title in URL (confidence: 0.7)
    const titleMatch = products.find(p => {
      if (!p.title) return false;
      const productSlug = p.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      return normalizedUrl.includes(productSlug);
    });

    if (titleMatch) {
      return {
        productId: titleMatch.id,
        confidence: 0.7,
        strategy: 'title'
      };
    }

    // No match found
    return { productId: null, confidence: 0 };
  }

  /**
   * Match URL to either node or product
   */
  matchUrl(
    url: string,
    nodes: TaxonomyNode[],
    products: Product[]
  ): MatchResult | null {
    // Try to match to product first (usually more specific)
    const productMatch = this.matchUrlToProduct(url, products);
    if (productMatch.productId && productMatch.confidence > 0.6) {
      return {
        type: 'product',
        id: productMatch.productId,
        confidence: productMatch.confidence,
        matchStrategy: productMatch.strategy as MatchResult['matchStrategy'],
      };
    }

    // Try to match to node
    const nodeMatch = this.matchUrlToNode(url, nodes);
    if (nodeMatch.nodeId && nodeMatch.confidence > 0.5) {
      return {
        type: 'node',
        id: nodeMatch.nodeId,
        confidence: nodeMatch.confidence,
        matchStrategy: nodeMatch.strategy as MatchResult['matchStrategy'],
      };
    }

    // Return best match if any
    if (productMatch.confidence > nodeMatch.confidence && productMatch.productId) {
      return {
        type: 'product',
        id: productMatch.productId,
        confidence: productMatch.confidence,
        matchStrategy: productMatch.strategy as MatchResult['matchStrategy'],
      };
    }

    if (nodeMatch.nodeId) {
      return {
        type: 'node',
        id: nodeMatch.nodeId,
        confidence: nodeMatch.confidence,
        matchStrategy: nodeMatch.strategy as MatchResult['matchStrategy'],
      };
    }

    return null;
  }

  /**
   * Batch match multiple URLs
   */
  batchMatchUrls(
    urls: string[],
    nodes: TaxonomyNode[],
    products: Product[]
  ): Map<string, MatchResult | null> {
    const results = new Map<string, MatchResult | null>();

    for (const url of urls) {
      results.set(url, this.matchUrl(url, nodes, products));
    }

    return results;
  }

  /**
   * Get match statistics for a batch
   */
  getMatchStatistics(matches: Map<string, MatchResult | null>): {
    total: number;
    matched: number;
    matchRate: number;
    avgConfidence: number;
    byType: { nodes: number; products: number };
    byStrategy: Record<string, number>;
  } {
    let matched = 0;
    let totalConfidence = 0;
    let nodeMatches = 0;
    let productMatches = 0;
    const strategyCount: Record<string, number> = {};

    matches.forEach(match => {
      if (match) {
        matched++;
        totalConfidence += match.confidence;

        if (match.type === 'node') nodeMatches++;
        else productMatches++;

        const strategy = match.matchStrategy || 'unknown';
        strategyCount[strategy] = (strategyCount[strategy] || 0) + 1;
      }
    });

    return {
      total: matches.size,
      matched,
      matchRate: matches.size > 0 ? matched / matches.size : 0,
      avgConfidence: matched > 0 ? totalConfidence / matched : 0,
      byType: {
        nodes: nodeMatches,
        products: productMatches,
      },
      byStrategy: strategyCount,
    };
  }
}