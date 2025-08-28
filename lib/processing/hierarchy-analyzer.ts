import { TaxonomyNode } from './taxonomy-builder';

export enum RelationshipType {
  PARENT_CHILD = 'parent_child',
  SIBLING = 'sibling',
  CROSS_LINK = 'cross_link',
  ORPHAN = 'orphan',
  DUPLICATE = 'duplicate',
}

export interface Relationship {
  type: RelationshipType;
  sourceId: string;
  targetId: string;
  strength: number;
  metadata?: Record<string, unknown>;
}

export interface SimilarityScore {
  urlSimilarity: number;
  contentSimilarity: number;
  metadataSimilarity: number;
  overall: number;
}

export class HierarchyAnalyzer {
  private relationships: Map<string, Relationship[]> = new Map();
  private nodeIndex: Map<string, TaxonomyNode> = new Map();

  detectRelationships(nodes: TaxonomyNode[]): Relationship[] {
    this.relationships.clear();
    this.buildNodeIndex(nodes);

    const allRelationships: Relationship[] = [];

    for (const node of nodes) {
      const nodeRelationships = [
        ...this.detectParentChildRelationships(node),
        ...this.detectSiblingRelationships(node),
        ...this.detectCrossLinks(node),
        ...this.detectOrphans(node),
        ...this.detectDuplicates(node),
      ];

      this.relationships.set(node.id, nodeRelationships);
      allRelationships.push(...nodeRelationships);
    }

    return allRelationships;
  }

  private buildNodeIndex(nodes: TaxonomyNode[]): void {
    const processNode = (node: TaxonomyNode) => {
      this.nodeIndex.set(node.id, node);
      node.children.forEach(child => processNode(child));
    };

    nodes.forEach(node => processNode(node));
  }

  private detectParentChildRelationships(node: TaxonomyNode): Relationship[] {
    const relationships: Relationship[] = [];

    for (const child of node.children) {
      relationships.push({
        type: RelationshipType.PARENT_CHILD,
        sourceId: node.id,
        targetId: child.id,
        strength: 1.0,
        metadata: {
          depthDifference: child.depth - node.depth,
        },
      });
    }

    return relationships;
  }

  private detectSiblingRelationships(node: TaxonomyNode): Relationship[] {
    const relationships: Relationship[] = [];

    if (!node.parentId) return relationships;

    const parent = this.nodeIndex.get(node.parentId);
    if (!parent) return relationships;

    for (const sibling of parent.children) {
      if (sibling.id !== node.id) {
        const similarity = this.calculateSimilarity(node, sibling);
        
        // Always create sibling relationships for nodes with same parent
        relationships.push({
          type: RelationshipType.SIBLING,
          sourceId: node.id,
          targetId: sibling.id,
          strength: similarity.overall > 0.3 ? similarity.overall : 0.5,
          metadata: {
            similarity,
          },
        });
      }
    }

    return relationships;
  }

  private detectCrossLinks(node: TaxonomyNode): Relationship[] {
    const relationships: Relationship[] = [];
    const nodeUrl = node.url.toLowerCase();

    for (const [otherId, otherNode] of this.nodeIndex) {
      if (otherId === node.id) continue;
      if (this.areRelated(node, otherNode)) continue;

      const otherUrl = otherNode.url.toLowerCase();
      
      if (nodeUrl.includes(otherId) || otherUrl.includes(node.id)) {
        relationships.push({
          type: RelationshipType.CROSS_LINK,
          sourceId: node.id,
          targetId: otherId,
          strength: 0.5,
          metadata: {
            linkType: 'url_reference',
          },
        });
      }
    }

    return relationships;
  }

  private detectOrphans(node: TaxonomyNode): Relationship[] {
    if (!node.parentId && node.id !== 'root' && node.children.length === 0) {
      return [{
        type: RelationshipType.ORPHAN,
        sourceId: node.id,
        targetId: node.id,
        strength: 1.0,
        metadata: {
          reason: 'No parent or children',
        },
      }];
    }
    return [];
  }

  private detectDuplicates(node: TaxonomyNode): Relationship[] {
    const relationships: Relationship[] = [];
    const normalizedUrl = this.normalizeUrl(node.url);

    for (const [otherId, otherNode] of this.nodeIndex) {
      if (otherId === node.id) continue;

      const otherNormalizedUrl = this.normalizeUrl(otherNode.url);
      
      if (normalizedUrl === otherNormalizedUrl || 
          node.title.toLowerCase() === otherNode.title.toLowerCase()) {
        relationships.push({
          type: RelationshipType.DUPLICATE,
          sourceId: node.id,
          targetId: otherId,
          strength: 0.9,
          metadata: {
            duplicateType: normalizedUrl === otherNormalizedUrl ? 'url' : 'title',
          },
        });
      }
    }

    return relationships;
  }

  private areRelated(node1: TaxonomyNode, node2: TaxonomyNode): boolean {
    return node1.parentId === node2.id || 
           node2.parentId === node1.id || 
           (node1.parentId && node1.parentId === node2.parentId);
  }

  private normalizeUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.pathname.toLowerCase().replace(/\/$/, '');
    } catch {
      return url.toLowerCase().replace(/\/$/, '');
    }
  }

  calculateSimilarity(node1: TaxonomyNode, node2: TaxonomyNode): SimilarityScore {
    const urlSimilarity = this.calculateUrlSimilarity(node1.url, node2.url);
    const contentSimilarity = this.calculateContentSimilarity(node1, node2);
    const metadataSimilarity = this.calculateMetadataSimilarity(node1, node2);

    const overall = (urlSimilarity * 0.3 + contentSimilarity * 0.4 + metadataSimilarity * 0.3);

    return {
      urlSimilarity,
      contentSimilarity,
      metadataSimilarity,
      overall,
    };
  }

  private calculateUrlSimilarity(url1: string, url2: string): number {
    const segments1 = this.getUrlSegments(url1);
    const segments2 = this.getUrlSegments(url2);

    const commonSegments = segments1.filter(seg => segments2.includes(seg)).length;
    const totalSegments = Math.max(segments1.length, segments2.length);

    if (totalSegments === 0) return 0;

    return commonSegments / totalSegments;
  }

  private getUrlSegments(url: string): string[] {
    try {
      const urlObj = new URL(url);
      return urlObj.pathname
        .split('/')
        .filter(Boolean)
        .map(seg => seg.toLowerCase());
    } catch {
      return [];
    }
  }

  private calculateContentSimilarity(node1: TaxonomyNode, node2: TaxonomyNode): number {
    const title1Words = this.tokenize(node1.title);
    const title2Words = this.tokenize(node2.title);

    const commonWords = title1Words.filter(word => title2Words.includes(word)).length;
    const totalWords = Math.max(title1Words.length, title2Words.length);

    if (totalWords === 0) return 0;

    const titleSimilarity = commonWords / totalWords;

    const depthSimilarity = 1 / (1 + Math.abs(node1.depth - node2.depth));

    return (titleSimilarity * 0.7 + depthSimilarity * 0.3);
  }

  private tokenize(text: string): string[] {
    return text.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 2);
  }

  private calculateMetadataSimilarity(node1: TaxonomyNode, node2: TaxonomyNode): number {
    const meta1 = node1.metadata;
    const meta2 = node2.metadata;

    let similarity = 0;
    let factors = 0;

    if (meta1.contentStatus === meta2.contentStatus) {
      similarity += 1;
    }
    factors++;

    if (meta1.hasContent === meta2.hasContent) {
      similarity += 1;
    }
    factors++;

    const skuDiff = Math.abs(meta1.skuCount - meta2.skuCount);
    const maxSku = Math.max(meta1.skuCount, meta2.skuCount);
    if (maxSku > 0) {
      similarity += 1 - (skuDiff / maxSku);
      factors++;
    }

    const timeDiff = Math.abs(meta1.lastModified.getTime() - meta2.lastModified.getTime());
    const maxTimeDiff = 30 * 24 * 60 * 60 * 1000;
    similarity += Math.max(0, 1 - (timeDiff / maxTimeDiff));
    factors++;

    return factors > 0 ? similarity / factors : 0;
  }

  findRelatedNodes(nodeId: string, relationshipType?: RelationshipType): TaxonomyNode[] {
    const relationships = this.relationships.get(nodeId) || [];
    const relatedIds = relationships
      .filter(rel => !relationshipType || rel.type === relationshipType)
      .map(rel => rel.targetId === nodeId ? rel.sourceId : rel.targetId);

    return relatedIds
      .map(id => this.nodeIndex.get(id))
      .filter((node): node is TaxonomyNode => node !== undefined);
  }

  getRelationshipStrength(node1Id: string, node2Id: string): number {
    const relationships = this.relationships.get(node1Id) || [];
    const relationship = relationships.find(
      rel => rel.targetId === node2Id || rel.sourceId === node2Id
    );
    
    return relationship?.strength || 0;
  }

  findClusters(nodes: TaxonomyNode[], minClusterSize = 3): TaxonomyNode[][] {
    const clusters: TaxonomyNode[][] = [];
    const visited = new Set<string>();

    for (const node of nodes) {
      if (visited.has(node.id)) continue;

      const cluster = this.buildCluster(node, visited);
      
      if (cluster.length >= minClusterSize) {
        clusters.push(cluster);
      }
    }

    return clusters;
  }

  private buildCluster(startNode: TaxonomyNode, visited: Set<string>): TaxonomyNode[] {
    const cluster: TaxonomyNode[] = [];
    const queue = [startNode];
    
    while (queue.length > 0) {
      const node = queue.shift()!;
      
      if (visited.has(node.id)) continue;
      
      visited.add(node.id);
      cluster.push(node);

      const relatedNodes = this.findRelatedNodes(node.id, RelationshipType.SIBLING);
      
      for (const related of relatedNodes) {
        if (!visited.has(related.id) && this.getRelationshipStrength(node.id, related.id) > 0.5) {
          queue.push(related);
        }
      }
    }

    return cluster;
  }

  analyzeHierarchyHealth(root: TaxonomyNode): {
    orphanCount: number;
    duplicateCount: number;
    maxDepth: number;
    avgChildrenPerNode: number;
    unbalancedNodes: TaxonomyNode[];
  } {
    let orphanCount = 0;
    let duplicateCount = 0;
    let maxDepth = 0;
    let totalChildren = 0;
    let nodeCount = 0;
    const unbalancedNodes: TaxonomyNode[] = [];

    const analyze = (node: TaxonomyNode) => {
      nodeCount++;
      totalChildren += node.children.length;
      maxDepth = Math.max(maxDepth, node.depth);

      const relationships = this.relationships.get(node.id) || [];
      
      if (relationships.some(r => r.type === RelationshipType.ORPHAN)) {
        orphanCount++;
      }
      
      if (relationships.some(r => r.type === RelationshipType.DUPLICATE)) {
        duplicateCount++;
      }

      if (node.children.length > 20) {
        unbalancedNodes.push(node);
      }

      node.children.forEach(child => analyze(child));
    };

    analyze(root);

    return {
      orphanCount,
      duplicateCount,
      maxDepth,
      avgChildrenPerNode: nodeCount > 0 ? totalChildren / nodeCount : 0,
      unbalancedNodes,
    };
  }
}