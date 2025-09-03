import { z } from 'zod';

// Input/Output Types
export interface RawNode {
  url: string;
  title?: string;
  lastmod?: string;
  changefreq?: string;
  priority?: number;
  metadata?: Record<string, any>;
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
  project_id?: string;
  position?: number;
  metadata?: Record<string, any>;
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

export interface BuildOptions {
  projectId?: string;
  autoDetectRelationships?: boolean;
  validateIntegrity?: boolean;
  preserveExisting?: boolean;
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
  public buildFromUrls(rawNodes: RawNode[], options?: BuildOptions): HierarchyResult {
    // Reset state
    this.warnings = [];
    this.nodeMap = new Map();

    // Step 1: Normalize and create nodes
    const nodes = this.createNodes(rawNodes, options?.projectId);

    // Step 2: Build parent-child relationships
    if (options?.autoDetectRelationships !== false) {
      this.buildRelationships(nodes);
    }

    // Step 3: Calculate depths
    this.calculateDepths();

    // Step 4: Calculate positions for siblings
    this.calculatePositions();

    // Step 5: Validate hierarchy if requested
    let validationWarnings: string[] = [];
    if (options?.validateIntegrity !== false) {
      const validation = this.validateHierarchy();
      validationWarnings = validation.warnings;
    }

    // Step 6: Gather statistics
    const stats = this.calculateStats();

    return {
      nodes: Array.from(this.nodeMap.values()),
      rootNodes: this.findRootNodes(),
      maxDepth: this.findMaxDepth(),
      stats,
      warnings: [...this.warnings, ...validationWarnings],
    };
  }

  /**
   * Create normalized nodes from raw URLs
   */
  private createNodes(rawNodes: RawNode[], projectId?: string): HierarchicalNode[] {
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
        project_id: projectId,
        position: 0,
        metadata: raw.metadata || {},
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
        const parent = nodes.find((n) => n.url === parentUrl || n.url === parentUrl + '/');
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
    try {
      const urlObj = new URL(url);
      const pathSegments = urlObj.pathname.split('/').filter(Boolean);

      // No parent for root or single-segment paths
      if (pathSegments.length === 0) {
        return null;
      }

      // Try progressively shorter paths to find parent
      for (let i = pathSegments.length - 1; i > 0; i--) {
        const parentPath = '/' + pathSegments.slice(0, i).join('/');
        const parentUrl = `${urlObj.protocol}//${urlObj.host}${parentPath}`;

        // Check if this potential parent exists in our nodes
        const parent = allNodes.find((n) => {
          const normalized = this.normalizeUrl(n.url);
          return normalized === parentUrl || normalized === this.normalizeUrl(parentUrl);
        });

        if (parent) {
          return parent.url;
        }
      }

      // Check for homepage parent
      const homepageUrl = `${urlObj.protocol}//${urlObj.host}`;
      const homepageUrlWithSlash = `${urlObj.protocol}//${urlObj.host}/`;

      const homepage = allNodes.find((n) => {
        const normalized = this.normalizeUrl(n.url);
        return (
          normalized === this.normalizeUrl(homepageUrl) ||
          normalized === this.normalizeUrl(homepageUrlWithSlash)
        );
      });

      if (homepage) {
        return homepage.url;
      }

      return null;
    } catch (error) {
      this.warnings.push(`Error finding parent for URL: ${url}`);
      return null;
    }
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
   * Calculate positions for sibling nodes
   */
  private calculatePositions(): void {
    // Group nodes by parent
    const nodesByParent = new Map<string | null, HierarchicalNode[]>();

    for (const node of this.nodeMap.values()) {
      const parentId = node.parent_id;
      if (!nodesByParent.has(parentId)) {
        nodesByParent.set(parentId, []);
      }
      nodesByParent.get(parentId)!.push(node);
    }

    // Sort siblings and assign positions
    for (const [parentId, siblings] of nodesByParent.entries()) {
      siblings.sort((a, b) => a.url.localeCompare(b.url));
      siblings.forEach((node, index) => {
        node.position = index;
      });
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

    // Check for orphaned nodes (non-root nodes without valid parents)
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
      // Remove query parameters and fragments for hierarchy building
      urlObj.search = '';
      urlObj.hash = '';
      return urlObj.href.toLowerCase();
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

  /**
   * Recalculate depths for all nodes in a project
   * Used after moving nodes in the hierarchy
   */
  public async recalculateDepths(projectId: string): Promise<void> {
    // This would need database access - placeholder for now
    // In real implementation, fetch nodes from database and recalculate
    console.log(`Recalculating depths for project: ${projectId}`);
  }
}
