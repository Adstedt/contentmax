import { TaxonomyNode, Product, MatchResult } from '@/types/integration';

export class UrlMatcher {
  /**
   * Multi-strategy URL matching for maximum accuracy
   * Tries multiple strategies in order of confidence
   */
  async matchUrl(
    externalUrl: string,
    nodes: TaxonomyNode[],
    products: Product[]
  ): Promise<MatchResult | null> {
    // Strategy 1: Exact URL match (highest confidence)
    const exactMatch = this.findExactUrlMatch(externalUrl, nodes, products);
    if (exactMatch) return { ...exactMatch, confidence: 1.0, strategy: 'exact_url' };

    // Strategy 2: Path-based match (ignore domain/params)
    const pathMatch = this.findPathMatch(externalUrl, nodes, products);
    if (pathMatch) return { ...pathMatch, confidence: 0.85, strategy: 'path_match' };

    // Strategy 3: Product ID in URL
    const productMatch = this.findProductInUrl(externalUrl, products);
    if (productMatch) return { ...productMatch, confidence: 0.9, strategy: 'product_id' };

    // Strategy 4: Category hierarchy match
    const categoryMatch = this.findCategoryMatch(externalUrl, nodes);
    if (categoryMatch) return { ...categoryMatch, confidence: 0.75, strategy: 'category_match' };

    // Strategy 5: Fuzzy match (last resort)
    const fuzzyMatch = this.fuzzyMatch(externalUrl, nodes, products);
    if (fuzzyMatch && fuzzyMatch.score > 0.6) {
      return { ...fuzzyMatch, confidence: fuzzyMatch.score, strategy: 'fuzzy_match' };
    }

    return null; // No match found
  }

  /**
   * Batch match multiple URLs efficiently
   */
  async batchMatchUrls(
    urls: string[],
    nodes: TaxonomyNode[],
    products: Product[]
  ): Promise<Map<string, MatchResult | null>> {
    // Build indices for faster lookups
    const nodeUrlIndex = this.buildNodeUrlIndex(nodes);
    const productUrlIndex = this.buildProductUrlIndex(products);
    const pathIndex = this.buildPathIndex(nodes);

    const results = new Map<string, MatchResult | null>();

    for (const url of urls) {
      // Try fast index lookups first
      const normalized = this.normalizeUrl(url);

      if (nodeUrlIndex.has(normalized)) {
        const node = nodeUrlIndex.get(normalized)!;
        results.set(url, {
          type: 'node',
          id: node.id,
          confidence: 1.0,
          strategy: 'exact_url',
        });
        continue;
      }

      if (productUrlIndex.has(normalized)) {
        const product = productUrlIndex.get(normalized)!;
        results.set(url, {
          type: 'product',
          id: product.id,
          confidence: 1.0,
          strategy: 'exact_url',
        });
        continue;
      }

      // Fallback to full matching
      const match = await this.matchUrl(url, nodes, products);
      results.set(url, match);
    }

    return results;
  }

  private findExactUrlMatch(
    url: string,
    nodes: TaxonomyNode[],
    products: Product[]
  ): { type: 'node' | 'product'; id: string } | null {
    const normalized = this.normalizeUrl(url);

    // Check nodes
    const node = nodes.find((n) => n.url && this.normalizeUrl(n.url) === normalized);
    if (node) return { type: 'node', id: node.id };

    // Check products
    const product = products.find((p) => p.link && this.normalizeUrl(p.link) === normalized);
    if (product) return { type: 'product', id: product.id };

    return null;
  }

  private findPathMatch(
    url: string,
    nodes: TaxonomyNode[],
    products: Product[]
  ): { type: 'node' | 'product'; id: string } | null {
    const path = this.extractPath(url);
    if (!path) return null;

    // Check nodes by path
    const node = nodes.find((n) => {
      if (!n.url) return false;
      const nodePath = this.extractPath(n.url);
      return nodePath === path;
    });
    if (node) return { type: 'node', id: node.id };

    // Check products by path
    const product = products.find((p) => {
      if (!p.link) return false;
      const productPath = this.extractPath(p.link);
      return productPath === path;
    });
    if (product) return { type: 'product', id: product.id };

    return null;
  }

  private findProductInUrl(
    url: string,
    products: Product[]
  ): { type: 'product'; id: string } | null {
    // Look for product IDs or SKUs in the URL
    const urlLower = url.toLowerCase();

    for (const product of products) {
      // Check if product ID is in URL
      if (product.id && urlLower.includes(product.id.toLowerCase())) {
        return { type: 'product', id: product.id };
      }

      // Check if SKU is in URL
      if (product.mpn && urlLower.includes(product.mpn.toLowerCase())) {
        return { type: 'product', id: product.id };
      }

      // Check if GTIN is in URL
      if (product.gtin && urlLower.includes(product.gtin)) {
        return { type: 'product', id: product.id };
      }
    }

    return null;
  }

  private findCategoryMatch(
    url: string,
    nodes: TaxonomyNode[]
  ): { type: 'node'; id: string } | null {
    const urlLower = url.toLowerCase();
    const urlParts = urlLower.split(/[/\-_]/);

    // Sort nodes by depth (deeper nodes first for more specific matches)
    const sortedNodes = [...nodes].sort((a, b) => {
      const depthA = a.path?.split('/').length || 0;
      const depthB = b.path?.split('/').length || 0;
      return depthB - depthA;
    });

    for (const node of sortedNodes) {
      if (!node.title) continue;

      // Check if category name appears in URL
      const categoryWords = node.title.toLowerCase().split(/\s+/);
      const allWordsMatch = categoryWords.every((word) =>
        urlParts.some((part) => part.includes(word))
      );

      if (allWordsMatch) {
        return { type: 'node', id: node.id };
      }

      // Check if path matches
      if (node.path) {
        const pathParts = node.path.toLowerCase().split('/');
        const pathMatch = pathParts.every((part) => urlParts.includes(part));
        if (pathMatch) {
          return { type: 'node', id: node.id };
        }
      }
    }

    return null;
  }

  private fuzzyMatch(
    url: string,
    nodes: TaxonomyNode[],
    products: Product[]
  ): { type: 'node' | 'product'; id: string; score: number } | null {
    const urlLower = url.toLowerCase();
    let bestMatch: { type: 'node' | 'product'; id: string; score: number } | null = null;
    let bestScore = 0;

    // Fuzzy match against nodes
    for (const node of nodes) {
      if (!node.url && !node.title) continue;

      const score = Math.max(
        node.url ? this.calculateSimilarity(urlLower, node.url.toLowerCase()) : 0,
        node.title
          ? this.calculateSimilarity(
              this.extractPath(urlLower) || urlLower,
              node.title.toLowerCase().replace(/\s+/g, '-')
            )
          : 0
      );

      if (score > bestScore) {
        bestScore = score;
        bestMatch = { type: 'node', id: node.id, score };
      }
    }

    // Fuzzy match against products
    for (const product of products) {
      if (!product.link && !product.title) continue;

      const score = Math.max(
        product.link ? this.calculateSimilarity(urlLower, product.link.toLowerCase()) : 0,
        product.title
          ? this.calculateSimilarity(
              this.extractPath(urlLower) || urlLower,
              product.title.toLowerCase().replace(/\s+/g, '-')
            )
          : 0
      );

      if (score > bestScore) {
        bestScore = score;
        bestMatch = { type: 'product', id: product.id, score };
      }
    }

    return bestMatch;
  }

  normalizeUrl(url: string): string {
    try {
      const urlObj = new URL(url.startsWith('http') ? url : `https://example.com${url}`);
      // Remove trailing slash, www, and sort params
      let normalized = urlObj.pathname.replace(/\/$/, '').toLowerCase();
      // Remove common file extensions
      normalized = normalized.replace(/\.(html?|php|aspx?)$/i, '');
      return normalized || '/';
    } catch {
      // If URL parsing fails, just lowercase and trim
      return url.toLowerCase().trim().replace(/\/$/, '') || '/';
    }
  }

  private extractPath(url: string): string | null {
    try {
      const urlObj = new URL(url.startsWith('http') ? url : `https://example.com${url}`);
      return urlObj.pathname.replace(/\/$/, '') || '/';
    } catch {
      // Try to extract path from string
      const match = url.match(/^(?:https?:\/\/[^/]+)?(\/.*)?$/);
      return match ? match[1].replace(/\/$/, '') : null;
    }
  }

  private calculateSimilarity(str1: string, str2: string): number {
    // Simple Jaccard similarity for now
    const set1 = new Set(str1.split(/[\s\-_/]+/));
    const set2 = new Set(str2.split(/[\s\-_/]+/));

    const intersection = new Set([...set1].filter((x) => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  // Index builders for performance
  private buildNodeUrlIndex(nodes: TaxonomyNode[]): Map<string, TaxonomyNode> {
    const index = new Map<string, TaxonomyNode>();
    for (const node of nodes) {
      if (node.url) {
        index.set(this.normalizeUrl(node.url), node);
      }
    }
    return index;
  }

  private buildProductUrlIndex(products: Product[]): Map<string, Product> {
    const index = new Map<string, Product>();
    for (const product of products) {
      if (product.link) {
        index.set(this.normalizeUrl(product.link), product);
      }
    }
    return index;
  }

  private buildPathIndex(nodes: TaxonomyNode[]): Map<string, TaxonomyNode> {
    const index = new Map<string, TaxonomyNode>();
    for (const node of nodes) {
      if (node.path) {
        index.set(node.path.toLowerCase(), node);
      }
      if (node.url) {
        const path = this.extractPath(node.url);
        if (path) {
          index.set(path.toLowerCase(), node);
        }
      }
    }
    return index;
  }
}
