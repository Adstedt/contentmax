import { TaxonomyNode } from '@/types/integration';

export interface CategoryMatchResult {
  nodeId: string;
  confidence: number;
  strategy: 'exact_path' | 'partial_path' | 'name_match' | 'alias_match';
}

export class CategoryMatcher {
  /**
   * Match a category path string to taxonomy nodes
   */
  async matchCategoryPath(
    categoryPath: string,
    nodes: TaxonomyNode[]
  ): Promise<CategoryMatchResult | null> {
    if (!categoryPath || !nodes.length) return null;

    // Clean and normalize the path
    const normalizedPath = this.normalizePath(categoryPath);

    // Strategy 1: Exact path match
    const exactMatch = this.findExactPathMatch(normalizedPath, nodes);
    if (exactMatch) {
      return { ...exactMatch, confidence: 1.0, strategy: 'exact_path' };
    }

    // Strategy 2: Partial path match (for deeply nested categories)
    const partialMatch = this.findPartialPathMatch(normalizedPath, nodes);
    if (partialMatch) {
      return { ...partialMatch, confidence: 0.85, strategy: 'partial_path' };
    }

    // Strategy 3: Name-based match
    const nameMatch = this.findNameMatch(normalizedPath, nodes);
    if (nameMatch) {
      return { ...nameMatch, confidence: 0.75, strategy: 'name_match' };
    }

    // Strategy 4: Alias match (if nodes have aliases)
    const aliasMatch = this.findAliasMatch(normalizedPath, nodes);
    if (aliasMatch) {
      return { ...aliasMatch, confidence: 0.8, strategy: 'alias_match' };
    }

    return null;
  }

  /**
   * Match multiple category paths in batch
   */
  async batchMatchCategories(
    paths: string[],
    nodes: TaxonomyNode[]
  ): Promise<Map<string, CategoryMatchResult | null>> {
    const results = new Map<string, CategoryMatchResult | null>();

    // Process in parallel for better performance
    const promises = paths.map(async (path) => {
      const result = await this.matchCategoryPath(path, nodes);
      return { path, result };
    });

    const matches = await Promise.all(promises);
    matches.forEach(({ path, result }) => {
      results.set(path, result);
    });

    return results;
  }

  /**
   * Parse category hierarchy from various formats
   */
  parseCategoryHierarchy(input: string): string[] {
    // Handle different separators: /, >, |, ::
    const separators = [' > ', ' / ', ' | ', '::', '/', '>', '|'];
    let separator = '/';

    // Find which separator is used
    for (const sep of separators) {
      if (input.includes(sep)) {
        separator = sep;
        break;
      }
    }

    return input
      .split(separator)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }

  private findExactPathMatch(path: string, nodes: TaxonomyNode[]): { nodeId: string } | null {
    const node = nodes.find((n) => this.normalizePath(n.path || '') === path);

    return node ? { nodeId: node.id } : null;
  }

  private findPartialPathMatch(path: string, nodes: TaxonomyNode[]): { nodeId: string } | null {
    const pathParts = path.split('/');

    // Sort by depth to prefer deeper matches
    const sortedNodes = [...nodes].sort((a, b) => {
      const depthA = a.path?.split('/').length || 0;
      const depthB = b.path?.split('/').length || 0;
      return depthB - depthA;
    });

    for (const node of sortedNodes) {
      if (!node.path) continue;

      const nodeParts = this.normalizePath(node.path).split('/');

      // Check if all node parts exist in the path
      const isMatch = nodeParts.every((part) => pathParts.includes(part));

      if (isMatch) {
        return { nodeId: node.id };
      }
    }

    return null;
  }

  private findNameMatch(path: string, nodes: TaxonomyNode[]): { nodeId: string } | null {
    const pathParts = path.toLowerCase().split('/');
    const lastPart = pathParts[pathParts.length - 1];

    // Try to match the deepest category name
    const node = nodes.find((n) => {
      const nodeTitle = n.title?.toLowerCase() || '';
      return (
        nodeTitle === lastPart || this.normalizeString(nodeTitle) === this.normalizeString(lastPart)
      );
    });

    return node ? { nodeId: node.id } : null;
  }

  private findAliasMatch(path: string, nodes: TaxonomyNode[]): { nodeId: string } | null {
    const pathParts = path.toLowerCase().split('/');

    for (const node of nodes) {
      // Check if node has aliases in metadata
      const aliases = (node as any).aliases || [];

      for (const alias of aliases) {
        if (pathParts.includes(alias.toLowerCase())) {
          return { nodeId: node.id };
        }
      }
    }

    return null;
  }

  private normalizePath(path: string): string {
    return path
      .toLowerCase()
      .replace(/^\/+|\/+$/g, '') // Remove leading/trailing slashes
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Collapse multiple hyphens
      .replace(/[^\w/-]/g, ''); // Remove special characters
  }

  private normalizeString(str: string): string {
    return str
      .toLowerCase()
      .replace(/[^\w]/g, '') // Remove all non-word characters
      .trim();
  }

  /**
   * Handle breadcrumb-style category paths
   */
  matchBreadcrumb(breadcrumb: string, nodes: TaxonomyNode[]): CategoryMatchResult | null {
    const parts = this.parseCategoryHierarchy(breadcrumb);
    const reconstructedPath = parts.join('/');
    return this.matchCategoryPath(reconstructedPath, nodes);
  }

  /**
   * Extract category information from a URL
   */
  extractCategoryFromUrl(url: string): string | null {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;

      // Common category URL patterns
      const patterns = [
        /\/category\/(.*?)(?:\/|$)/,
        /\/c\/(.*?)(?:\/|$)/,
        /\/collections?\/(.*?)(?:\/|$)/,
        /\/shop\/(.*?)(?:\/|$)/,
        /\/products?\/(.*?)(?:\/|$)/,
      ];

      for (const pattern of patterns) {
        const match = pathname.match(pattern);
        if (match && match[1]) {
          return match[1];
        }
      }

      // Fallback: use path segments
      const segments = pathname.split('/').filter((s) => s.length > 0);
      if (segments.length > 1) {
        // Skip common non-category segments
        const skipWords = ['product', 'item', 'p', 'i', 'detail', 'view'];
        const categorySegments = segments.filter(
          (s) => !skipWords.includes(s.toLowerCase()) && !/^\d+$/.test(s) // Skip numeric IDs
        );

        if (categorySegments.length > 0) {
          return categorySegments.join('/');
        }
      }

      return null;
    } catch {
      return null;
    }
  }
}
