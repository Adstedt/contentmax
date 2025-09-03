# TASK-002: Hierarchy Builder Implementation

## Overview

**Priority**: P0 - Blocker  
**Estimate**: 6 hours  
**Owner**: Backend Developer  
**Dependencies**: TASK-001 (Database Schema)  
**Status**: Not Started

## Problem Statement

We need to build hierarchical relationships between taxonomy nodes based on their URL structure. The current sitemap parser extracts URLs but doesn't establish parent-child relationships or calculate depth levels needed for the visualization and scoring algorithms.

## Technical Requirements

### 1. Core Implementation

#### File: `lib/ingestion/hierarchy-builder.ts`

```typescript
import { z } from 'zod';

// Input/Output Types
export interface RawNode {
  url: string;
  title: string;
  lastmod?: string;
  changefreq?: string;
  priority?: number;
}

export interface HierarchicalNode {
  id: string;
  url: string;
  path: string;
  title: string;
  parent_id: string | null;
  depth: number;
  children: string[];
  slug: string;
  breadcrumb: string[];
}

export interface HierarchyResult {
  nodes: HierarchicalNode[];
  rootNodes: string[];
  maxDepth: number;
  stats: {
    totalNodes: number;
    rootNodes: number;
    leafNodes: number;
    averageChildren: number;
    maxChildren: number;
  };
  warnings: string[];
}

/**
 * HierarchyBuilder - Constructs hierarchical relationships from flat URL lists
 */
export class HierarchyBuilder {
  private warnings: string[] = [];
  private nodeMap: Map<string, HierarchicalNode> = new Map();

  /**
   * Main entry point - builds hierarchy from raw nodes
   */
  public buildFromUrls(rawNodes: RawNode[]): HierarchyResult {
    // Reset state
    this.warnings = [];
    this.nodeMap = new Map();

    // Step 1: Normalize and create nodes
    const nodes = this.createNodes(rawNodes);

    // Step 2: Build parent-child relationships
    this.buildRelationships(nodes);

    // Step 3: Calculate depths
    this.calculateDepths();

    // Step 4: Validate hierarchy
    const validation = this.validateHierarchy();

    // Step 5: Gather statistics
    const stats = this.calculateStats();

    return {
      nodes: Array.from(this.nodeMap.values()),
      rootNodes: this.findRootNodes(),
      maxDepth: this.findMaxDepth(),
      stats,
      warnings: [...this.warnings, ...validation.warnings],
    };
  }

  /**
   * Create normalized nodes from raw URLs
   */
  private createNodes(rawNodes: RawNode[]): HierarchicalNode[] {
    const nodes: HierarchicalNode[] = [];
    const urlSet = new Set<string>();

    for (const raw of rawNodes) {
      // Normalize URL
      const normalized = this.normalizeUrl(raw.url);

      // Skip duplicates
      if (urlSet.has(normalized)) {
        this.warnings.push(`Duplicate URL skipped: ${raw.url}`);
        continue;
      }
      urlSet.add(normalized);

      // Create node
      const node: HierarchicalNode = {
        id: this.generateId(normalized),
        url: normalized,
        path: this.extractPath(normalized),
        title: raw.title || this.generateTitle(normalized),
        parent_id: null,
        depth: 0,
        children: [],
        slug: this.extractSlug(normalized),
        breadcrumb: this.extractBreadcrumb(normalized),
      };

      nodes.push(node);
      this.nodeMap.set(node.id, node);
    }

    return nodes;
  }

  /**
   * Build parent-child relationships based on URL structure
   */
  private buildRelationships(nodes: HierarchicalNode[]): void {
    // Sort nodes by path length (shorter paths first)
    const sorted = [...nodes].sort((a, b) => {
      const aSegments = a.path.split('/').filter(Boolean).length;
      const bSegments = b.path.split('/').filter(Boolean).length;
      return aSegments - bSegments;
    });

    for (const node of sorted) {
      const parentUrl = this.findParentUrl(node.url, nodes);

      if (parentUrl) {
        const parent = nodes.find((n) => n.url === parentUrl);
        if (parent) {
          node.parent_id = parent.id;
          parent.children.push(node.id);
        }
      }
    }
  }

  /**
   * Find the best parent URL for a given URL
   */
  private findParentUrl(url: string, allNodes: HierarchicalNode[]): string | null {
    const urlObj = new URL(url);
    const pathSegments = urlObj.pathname.split('/').filter(Boolean);

    // No parent for root or single-segment paths
    if (pathSegments.length <= 1) {
      return null;
    }

    // Try progressively shorter paths to find parent
    for (let i = pathSegments.length - 1; i > 0; i--) {
      const parentPath = '/' + pathSegments.slice(0, i).join('/');
      const parentUrl = `${urlObj.protocol}//${urlObj.host}${parentPath}`;

      // Check if this potential parent exists in our nodes
      if (allNodes.some((n) => n.url === parentUrl || n.url === parentUrl + '/')) {
        return parentUrl;
      }
    }

    // Check for homepage parent
    const homepageUrl = `${urlObj.protocol}//${urlObj.host}`;
    if (allNodes.some((n) => n.url === homepageUrl || n.url === homepageUrl + '/')) {
      return homepageUrl;
    }

    return null;
  }

  /**
   * Calculate depth for each node
   */
  private calculateDepths(): void {
    const visited = new Set<string>();
    const rootNodes = this.findRootNodes();

    for (const rootId of rootNodes) {
      this.calculateDepthRecursive(rootId, 0, visited);
    }
  }

  private calculateDepthRecursive(nodeId: string, depth: number, visited: Set<string>): void {
    // Prevent infinite loops
    if (visited.has(nodeId)) {
      this.warnings.push(`Circular reference detected at node: ${nodeId}`);
      return;
    }
    visited.add(nodeId);

    const node = this.nodeMap.get(nodeId);
    if (!node) return;

    node.depth = depth;

    for (const childId of node.children) {
      this.calculateDepthRecursive(childId, depth + 1, visited);
    }
  }

  /**
   * Validate hierarchy for issues
   */
  private validateHierarchy(): { valid: boolean; warnings: string[] } {
    const warnings: string[] = [];

    // Check for circular references
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    for (const node of this.nodeMap.values()) {
      if (!visited.has(node.id)) {
        this.detectCycles(node.id, visited, recursionStack, warnings);
      }
    }

    // Check for orphaned nodes (non-root nodes without parents)
    for (const node of this.nodeMap.values()) {
      if (node.parent_id && !this.nodeMap.has(node.parent_id)) {
        warnings.push(`Orphaned node detected: ${node.url}`);
      }
    }

    // Check for extremely deep hierarchies
    const maxDepth = this.findMaxDepth();
    if (maxDepth > 10) {
      warnings.push(`Very deep hierarchy detected: ${maxDepth} levels`);
    }

    return {
      valid: warnings.length === 0,
      warnings,
    };
  }

  private detectCycles(
    nodeId: string,
    visited: Set<string>,
    recursionStack: Set<string>,
    warnings: string[]
  ): boolean {
    visited.add(nodeId);
    recursionStack.add(nodeId);

    const node = this.nodeMap.get(nodeId);
    if (!node) return false;

    for (const childId of node.children) {
      if (!visited.has(childId)) {
        if (this.detectCycles(childId, visited, recursionStack, warnings)) {
          return true;
        }
      } else if (recursionStack.has(childId)) {
        warnings.push(`Cycle detected: ${nodeId} -> ${childId}`);
        return true;
      }
    }

    recursionStack.delete(nodeId);
    return false;
  }

  /**
   * Utility methods
   */
  private normalizeUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      // Remove trailing slash except for homepage
      let normalized = urlObj.href;
      if (normalized.endsWith('/') && urlObj.pathname !== '/') {
        normalized = normalized.slice(0, -1);
      }
      return normalized.toLowerCase();
    } catch {
      this.warnings.push(`Invalid URL: ${url}`);
      return url.toLowerCase();
    }
  }

  private extractPath(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.pathname;
    } catch {
      return '/';
    }
  }

  private extractSlug(url: string): string {
    const path = this.extractPath(url);
    const segments = path.split('/').filter(Boolean);
    return segments[segments.length - 1] || 'home';
  }

  private extractBreadcrumb(url: string): string[] {
    const path = this.extractPath(url);
    return path.split('/').filter(Boolean);
  }

  private generateTitle(url: string): string {
    const slug = this.extractSlug(url);
    return slug
      .replace(/[-_]/g, ' ')
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private generateId(url: string): string {
    // Simple hash function for consistent IDs
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
      const char = url.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `node_${Math.abs(hash).toString(16)}`;
  }

  private findRootNodes(): string[] {
    return Array.from(this.nodeMap.values())
      .filter((node) => !node.parent_id)
      .map((node) => node.id);
  }

  private findMaxDepth(): number {
    let maxDepth = 0;
    for (const node of this.nodeMap.values()) {
      maxDepth = Math.max(maxDepth, node.depth);
    }
    return maxDepth;
  }

  private calculateStats() {
    const nodes = Array.from(this.nodeMap.values());
    const rootNodes = nodes.filter((n) => !n.parent_id);
    const leafNodes = nodes.filter((n) => n.children.length === 0);

    const childCounts = nodes.map((n) => n.children.length);
    const totalChildren = childCounts.reduce((sum, count) => sum + count, 0);
    const averageChildren = nodes.length > 0 ? totalChildren / nodes.length : 0;
    const maxChildren = Math.max(...childCounts, 0);

    return {
      totalNodes: nodes.length,
      rootNodes: rootNodes.length,
      leafNodes: leafNodes.length,
      averageChildren: Math.round(averageChildren * 100) / 100,
      maxChildren,
    };
  }
}
```

### 2. Integration with Existing Code

#### File: `app/api/import/sitemap/route.ts` (Update)

```typescript
import { HierarchyBuilder } from '@/lib/ingestion/hierarchy-builder';

export async function POST(request: NextRequest) {
  // ... existing code ...

  // After fetching sitemap entries
  const hierarchyBuilder = new HierarchyBuilder();
  const hierarchy = hierarchyBuilder.buildFromUrls(
    result.entries.map((entry) => ({
      url: entry.loc,
      title: entry.title || undefined,
      lastmod: entry.lastmod,
      changefreq: entry.changefreq,
      priority: entry.priority,
    }))
  );

  // Store nodes with hierarchy
  const { error: insertError } = await supabase.from('taxonomy_nodes').upsert(
    hierarchy.nodes.map((node) => ({
      id: node.id,
      project_id: validated.projectId,
      url: node.url,
      path: node.path,
      title: node.title,
      parent_id: node.parent_id,
      depth: node.depth,
      position: 0, // Will be updated based on siblings
      metadata: {
        slug: node.slug,
        breadcrumb: node.breadcrumb,
        children: node.children,
      },
    }))
  );

  // ... rest of implementation ...
}
```

### 3. Test Suite

#### File: `lib/ingestion/hierarchy-builder.test.ts`

```typescript
import { HierarchyBuilder } from './hierarchy-builder';

describe('HierarchyBuilder', () => {
  let builder: HierarchyBuilder;

  beforeEach(() => {
    builder = new HierarchyBuilder();
  });

  describe('buildFromUrls', () => {
    it('should build simple hierarchy', () => {
      const input = [
        { url: 'https://example.com', title: 'Home' },
        { url: 'https://example.com/products', title: 'Products' },
        { url: 'https://example.com/products/shoes', title: 'Shoes' },
        { url: 'https://example.com/products/shoes/running', title: 'Running Shoes' },
      ];

      const result = builder.buildFromUrls(input);

      expect(result.nodes).toHaveLength(4);
      expect(result.rootNodes).toHaveLength(1);
      expect(result.maxDepth).toBe(3);

      const home = result.nodes.find((n) => n.slug === 'home');
      expect(home?.depth).toBe(0);
      expect(home?.children).toHaveLength(1);

      const running = result.nodes.find((n) => n.slug === 'running');
      expect(running?.depth).toBe(3);
      expect(running?.breadcrumb).toEqual(['products', 'shoes', 'running']);
    });

    it('should handle multiple root nodes', () => {
      const input = [
        { url: 'https://example.com/products', title: 'Products' },
        { url: 'https://example.com/blog', title: 'Blog' },
        { url: 'https://example.com/about', title: 'About' },
      ];

      const result = builder.buildFromUrls(input);

      expect(result.rootNodes).toHaveLength(3);
      expect(result.stats.rootNodes).toBe(3);
    });

    it('should detect circular references', () => {
      // This would require manual manipulation since URLs can't naturally be circular
      // Testing validation logic
      const result = builder.buildFromUrls([
        { url: 'https://example.com/a', title: 'A' },
        { url: 'https://example.com/a/b', title: 'B' },
      ]);

      // Manually create circular reference for testing
      if (result.nodes[0] && result.nodes[1]) {
        result.nodes[0].parent_id = result.nodes[1].id;
      }

      // Validation should detect this
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should normalize URLs correctly', () => {
      const input = [
        { url: 'https://EXAMPLE.com/Products/', title: 'Products' },
        { url: 'https://example.com/products', title: 'Products Duplicate' },
      ];

      const result = builder.buildFromUrls(input);

      expect(result.nodes).toHaveLength(1);
      expect(result.warnings).toContain('Duplicate URL skipped: https://example.com/products');
    });

    it('should generate titles from URLs when missing', () => {
      const input = [
        { url: 'https://example.com/winter-jackets' },
        { url: 'https://example.com/running_shoes' },
      ];

      const result = builder.buildFromUrls(input);

      const winterJackets = result.nodes.find((n) => n.slug === 'winter-jackets');
      expect(winterJackets?.title).toBe('Winter Jackets');

      const runningShoes = result.nodes.find((n) => n.slug === 'running_shoes');
      expect(runningShoes?.title).toBe('Running Shoes');
    });
  });

  describe('edge cases', () => {
    it('should handle empty input', () => {
      const result = builder.buildFromUrls([]);
      expect(result.nodes).toHaveLength(0);
      expect(result.rootNodes).toHaveLength(0);
    });

    it('should handle invalid URLs', () => {
      const input = [
        { url: 'not-a-url', title: 'Invalid' },
        { url: 'https://example.com', title: 'Valid' },
      ];

      const result = builder.buildFromUrls(input);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should handle very deep hierarchies', () => {
      const input = [];
      let path = 'https://example.com';

      // Create 12 levels deep
      for (let i = 0; i < 12; i++) {
        path += `/level${i}`;
        input.push({ url: path, title: `Level ${i}` });
      }

      const result = builder.buildFromUrls(input);
      expect(result.maxDepth).toBe(11);
      expect(result.warnings).toContainEqual(expect.stringContaining('Very deep hierarchy'));
    });
  });

  describe('performance', () => {
    it('should handle 1000+ URLs efficiently', () => {
      const input = [];

      // Generate 1000 URLs
      for (let i = 0; i < 1000; i++) {
        const category = Math.floor(i / 100);
        const subcategory = Math.floor(i / 10) % 10;
        input.push({
          url: `https://example.com/cat${category}/sub${subcategory}/item${i}`,
          title: `Item ${i}`,
        });
      }

      const start = Date.now();
      const result = builder.buildFromUrls(input);
      const duration = Date.now() - start;

      expect(result.nodes).toHaveLength(1000);
      expect(duration).toBeLessThan(1000); // Should complete in under 1 second
    });
  });
});
```

### 4. Usage Examples

```typescript
// Example 1: Basic usage
const builder = new HierarchyBuilder();
const hierarchy = builder.buildFromUrls([
  { url: 'https://store.com', title: 'Home' },
  { url: 'https://store.com/clothing', title: 'Clothing' },
  { url: 'https://store.com/clothing/mens', title: "Men's Clothing" },
  { url: 'https://store.com/clothing/womens', title: "Women's Clothing" },
]);

console.log(hierarchy.stats);
// {
//   totalNodes: 4,
//   rootNodes: 1,
//   leafNodes: 2,
//   averageChildren: 0.75,
//   maxChildren: 2
// }

// Example 2: With validation warnings
const hierarchy2 = builder.buildFromUrls([
  { url: 'https://store.com/a/b/c/d/e/f/g/h/i/j/k/l', title: 'Deep' },
]);

console.log(hierarchy2.warnings);
// ["Very deep hierarchy detected: 11 levels"]
```

## Acceptance Criteria

- [ ] Correctly identifies parent-child relationships from URLs
- [ ] Handles multiple root nodes (e.g., /products, /blog, /about)
- [ ] Calculates accurate depth for all nodes
- [ ] Detects and reports circular references
- [ ] Normalizes URLs (lowercase, trailing slash handling)
- [ ] Generates meaningful titles from URLs when missing
- [ ] Provides hierarchy statistics
- [ ] Processes 1000 nodes in <1 second
- [ ] Unit test coverage >90%
- [ ] Integration test with real sitemap data

## Implementation Steps

1. **Hour 1-2**: Implement core HierarchyBuilder class
2. **Hour 3-4**: Write comprehensive test suite
3. **Hour 5**: Integrate with existing sitemap import
4. **Hour 6**: Test with real data and optimize

## Performance Considerations

- Use Map for O(1) lookups instead of array searches
- Process nodes in sorted order (by depth) for efficiency
- Batch database operations when storing
- Consider caching for repeated builds

## Dependencies for Next Tasks

- **TASK-003**: Batch Import API needs hierarchical structure
- **Visualization**: Needs parent-child relationships for force-directed graph
- **Scoring**: Uses depth and hierarchy for opportunity calculations

## Notes

- Consider supporting multiple URL formats (with/without www, http/https)
- May need special handling for parameterized URLs (?page=2, etc.)
- Could add support for sitemap index files in the future
- Hierarchy statistics useful for monitoring data quality
