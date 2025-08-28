import { z } from 'zod';

export enum ContentStatus {
  PENDING = 'pending',
  SCRAPED = 'scraped',
  PROCESSED = 'processed',
  ERROR = 'error',
  MISSING = 'missing',
}

export interface TaxonomyMetadata {
  skuCount: number;
  hasContent: boolean;
  contentStatus: ContentStatus;
  lastModified: Date;
}

export interface TaxonomyNode {
  id: string;
  url: string;
  title: string;
  parentId: string | null;
  depth: number;
  children: TaxonomyNode[];
  metadata: TaxonomyMetadata;
}

export interface ProcessedUrl {
  url: string;
  title: string;
  metadata?: Partial<TaxonomyMetadata>;
}

const TaxonomyNodeSchema = z.object({
  id: z.string(),
  url: z.string().url(),
  title: z.string(),
  parentId: z.string().nullable(),
  depth: z.number().int().min(0),
  children: z.array(z.lazy(() => TaxonomyNodeSchema)),
  metadata: z.object({
    skuCount: z.number().int().min(0),
    hasContent: z.boolean(),
    contentStatus: z.nativeEnum(ContentStatus),
    lastModified: z.date(),
  }),
});

export class TaxonomyBuilder {
  private nodeMap: Map<string, TaxonomyNode> = new Map();
  private urlToId: Map<string, string> = new Map();

  buildHierarchy(urls: ProcessedUrl[]): TaxonomyNode {
    this.nodeMap.clear();
    this.urlToId.clear();

    const sortedUrls = this.sortUrlsByDepth(urls);
    
    const rootNode: TaxonomyNode = {
      id: 'root',
      url: '/',
      title: 'Root',
      parentId: null,
      depth: 0,
      children: [],
      metadata: {
        skuCount: 0,
        hasContent: false,
        contentStatus: ContentStatus.PROCESSED,
        lastModified: new Date(),
      },
    };

    this.nodeMap.set(rootNode.id, rootNode);
    this.urlToId.set('/', rootNode.id);

    for (const urlData of sortedUrls) {
      this.createNode(urlData);
    }

    this.buildTreeStructure();
    this.calculateDepths(rootNode, 0);
    this.aggregateMetadata(rootNode);

    return rootNode;
  }

  private sortUrlsByDepth(urls: ProcessedUrl[]): ProcessedUrl[] {
    return urls.sort((a, b) => {
      const depthA = this.getUrlDepth(a.url);
      const depthB = this.getUrlDepth(b.url);
      if (depthA !== depthB) return depthA - depthB;
      return a.url.localeCompare(b.url);
    });
  }

  private getUrlDepth(url: string): number {
    try {
      const urlObj = new URL(url);
      const pathSegments = urlObj.pathname.split('/').filter(Boolean);
      return pathSegments.length;
    } catch {
      return 0;
    }
  }

  private createNode(urlData: ProcessedUrl): TaxonomyNode {
    const nodeId = this.generateNodeId(urlData.url);
    const parentId = this.findParentId(urlData.url);
    
    const node: TaxonomyNode = {
      id: nodeId,
      url: urlData.url,
      title: urlData.title || this.extractTitleFromUrl(urlData.url),
      parentId,
      depth: 0,
      children: [],
      metadata: {
        skuCount: urlData.metadata?.skuCount || 0,
        hasContent: urlData.metadata?.hasContent || false,
        contentStatus: urlData.metadata?.contentStatus || ContentStatus.PENDING,
        lastModified: urlData.metadata?.lastModified || new Date(),
      },
    };

    this.nodeMap.set(nodeId, node);
    this.urlToId.set(urlData.url, nodeId);

    return node;
  }

  private generateNodeId(url: string): string {
    try {
      const urlObj = new URL(url);
      const pathSegments = urlObj.pathname.split('/').filter(Boolean);
      
      let baseId: string;
      if (pathSegments.length === 0) {
        baseId = `${urlObj.hostname}-root`;
      } else {
        const nodeId = pathSegments.join('-').toLowerCase().replace(/[^a-z0-9-]/g, '');
        baseId = `${urlObj.hostname}-${nodeId}`.replace(/[^a-z0-9-]/g, '-');
      }
      
      // Include query params in ID if present
      if (urlObj.search) {
        const queryId = urlObj.search.replace(/[^a-z0-9]/gi, '').toLowerCase();
        baseId = `${baseId}-${queryId}`;
      }
      
      return baseId;
    } catch {
      return `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
  }

  private findParentId(url: string): string | null {
    try {
      const urlObj = new URL(url);
      const pathSegments = urlObj.pathname.split('/').filter(Boolean);

      if (pathSegments.length === 0) {
        return null;
      }

      for (let i = pathSegments.length - 1; i > 0; i--) {
        const parentPath = '/' + pathSegments.slice(0, i).join('/');
        const parentUrl = `${urlObj.protocol}//${urlObj.host}${parentPath}`;
        
        const parentId = this.urlToId.get(parentUrl);
        if (parentId) {
          return parentId;
        }
      }

      return 'root';
    } catch {
      return 'root';
    }
  }

  private buildTreeStructure(): void {
    for (const [, node] of this.nodeMap) {
      if (node.parentId && node.parentId !== node.id) {
        const parent = this.nodeMap.get(node.parentId);
        if (parent) {
          parent.children.push(node);
        }
      }
    }
  }

  private calculateDepths(node: TaxonomyNode, depth: number): void {
    node.depth = depth;
    for (const child of node.children) {
      this.calculateDepths(child, depth + 1);
    }
  }

  private aggregateMetadata(node: TaxonomyNode): void {
    let totalSkuCount = node.metadata.skuCount;
    let hasAnyContent = node.metadata.hasContent;

    for (const child of node.children) {
      this.aggregateMetadata(child);
      totalSkuCount += child.metadata.skuCount;
      hasAnyContent = hasAnyContent || child.metadata.hasContent;
    }

    node.metadata.skuCount = totalSkuCount;
    node.metadata.hasContent = hasAnyContent;
  }

  private extractTitleFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      const pathSegments = urlObj.pathname.split('/').filter(Boolean);
      
      if (pathSegments.length === 0) {
        return urlObj.hostname;
      }

      const lastSegment = pathSegments[pathSegments.length - 1];
      return lastSegment
        .replace(/[-_]/g, ' ')
        .replace(/\.\w+$/, '')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
    } catch {
      return 'Unknown';
    }
  }

  detectPattern(url: string): string | null {
    const patterns = {
      category: /\/(category|categories|c)\//i,
      product: /\/(product|products|p)\//i,
      brand: /\/(brand|brands|manufacturer)\//i,
      collection: /\/(collection|collections)\//i,
      blog: /\/(blog|article|news|post)\//i,
    };

    for (const [name, pattern] of Object.entries(patterns)) {
      if (pattern.test(url)) {
        return name;
      }
    }

    return null;
  }

  isParent(parentUrl: string, childUrl: string): boolean {
    if (!parentUrl || !childUrl) return false;
    
    try {
      const parentObj = new URL(parentUrl);
      const childObj = new URL(childUrl);
      
      if (parentObj.host !== childObj.host) return false;
      
      const parentPath = parentObj.pathname.replace(/\/$/, '');
      const childPath = childObj.pathname.replace(/\/$/, '');
      
      if (!childPath.startsWith(parentPath)) return false;
      
      const remainingPath = childPath.slice(parentPath.length);
      const remainingSegments = remainingPath.split('/').filter(Boolean);
      
      return remainingSegments.length === 1;
    } catch {
      return false;
    }
  }

  areSiblings(url1: string, url2: string): boolean {
    if (!url1 || !url2 || url1 === url2) return false;
    
    try {
      const urlObj1 = new URL(url1);
      const urlObj2 = new URL(url2);
      
      if (urlObj1.host !== urlObj2.host) return false;
      
      const path1 = urlObj1.pathname.replace(/\/$/, '');
      const path2 = urlObj2.pathname.replace(/\/$/, '');
      
      const segments1 = path1.split('/').filter(Boolean);
      const segments2 = path2.split('/').filter(Boolean);
      
      if (segments1.length !== segments2.length || segments1.length === 0) {
        return false;
      }
      
      const parent1 = segments1.slice(0, -1).join('/');
      const parent2 = segments2.slice(0, -1).join('/');
      
      return parent1 === parent2;
    } catch {
      return false;
    }
  }

  validateHierarchy(root: TaxonomyNode): boolean {
    try {
      TaxonomyNodeSchema.parse(root);
      return this.checkHierarchyIntegrity(root);
    } catch {
      return false;
    }
  }

  private checkHierarchyIntegrity(node: TaxonomyNode, visitedIds = new Set<string>()): boolean {
    if (visitedIds.has(node.id)) {
      console.error(`Circular reference detected at node ${node.id}`);
      return false;
    }
    
    visitedIds.add(node.id);
    
    for (const child of node.children) {
      if (child.parentId !== node.id) {
        console.error(`Parent-child mismatch: ${child.id} should have parent ${node.id}`);
        return false;
      }
      
      if (child.depth !== node.depth + 1) {
        console.error(`Depth mismatch: ${child.id} has incorrect depth`);
        return false;
      }
      
      if (!this.checkHierarchyIntegrity(child, new Set(visitedIds))) {
        return false;
      }
    }
    
    return true;
  }
}