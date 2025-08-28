import { TaxonomyNode } from './taxonomy-builder';

export interface SimilarityResult {
  node1Id: string;
  node2Id: string;
  urlSimilarity: number;
  titleSimilarity: number;
  structuralSimilarity: number;
  contentSimilarity: number;
  overallSimilarity: number;
  confidence: number;
}

export interface SimilarityConfig {
  weights?: {
    url: number;
    title: number;
    structural: number;
    content: number;
  };
  thresholds?: {
    minimum: number;
    high: number;
  };
}

export class SimilarityCalculator {
  private readonly defaultConfig: Required<SimilarityConfig> = {
    weights: {
      url: 0.25,
      title: 0.25,
      structural: 0.2,
      content: 0.3,
    },
    thresholds: {
      minimum: 0.3,
      high: 0.7,
    },
  };

  private config: Required<SimilarityConfig>;
  private nodeCache: Map<string, TaxonomyNode> = new Map();

  constructor(config?: SimilarityConfig) {
    this.config = {
      ...this.defaultConfig,
      ...config,
      weights: { ...this.defaultConfig.weights, ...config?.weights },
      thresholds: { ...this.defaultConfig.thresholds, ...config?.thresholds },
    };
  }

  calculateSimilarity(node1: TaxonomyNode, node2: TaxonomyNode): SimilarityResult {
    this.cacheNodes([node1, node2]);

    const urlSimilarity = this.calculateUrlSimilarity(node1, node2);
    const titleSimilarity = this.calculateTitleSimilarity(node1, node2);
    const structuralSimilarity = this.calculateStructuralSimilarity(node1, node2);
    const contentSimilarity = this.calculateContentSimilarity(node1, node2);

    const weights = this.config.weights;
    const overallSimilarity = 
      urlSimilarity * weights.url +
      titleSimilarity * weights.title +
      structuralSimilarity * weights.structural +
      contentSimilarity * weights.content;

    const confidence = this.calculateConfidence({
      urlSimilarity,
      titleSimilarity,
      structuralSimilarity,
      contentSimilarity,
    });

    return {
      node1Id: node1.id,
      node2Id: node2.id,
      urlSimilarity,
      titleSimilarity,
      structuralSimilarity,
      contentSimilarity,
      overallSimilarity,
      confidence,
    };
  }

  private cacheNodes(nodes: TaxonomyNode[]): void {
    for (const node of nodes) {
      this.nodeCache.set(node.id, node);
      this.cacheNodeRecursive(node);
    }
  }

  private cacheNodeRecursive(node: TaxonomyNode): void {
    this.nodeCache.set(node.id, node);
    for (const child of node.children) {
      this.cacheNodeRecursive(child);
    }
  }

  private calculateUrlSimilarity(node1: TaxonomyNode, node2: TaxonomyNode): number {
    const url1Parts = this.parseUrl(node1.url);
    const url2Parts = this.parseUrl(node2.url);

    if (!url1Parts || !url2Parts) return 0;

    let similarity = 0;
    let weights = 0;

    if (url1Parts.domain === url2Parts.domain) {
      similarity += 0.2;
    }
    weights += 0.2;

    const pathSimilarity = this.calculatePathSimilarity(url1Parts.segments, url2Parts.segments);
    similarity += pathSimilarity * 0.5;
    weights += 0.5;

    const paramSimilarity = this.calculateParamSimilarity(url1Parts.params, url2Parts.params);
    similarity += paramSimilarity * 0.3;
    weights += 0.3;

    return weights > 0 ? similarity / weights : 0;
  }

  private parseUrl(url: string): {
    domain: string;
    segments: string[];
    params: Map<string, string>;
  } | null {
    try {
      const urlObj = new URL(url);
      const segments = urlObj.pathname.split('/').filter(Boolean);
      const params = new Map<string, string>();
      
      urlObj.searchParams.forEach((value, key) => {
        params.set(key, value);
      });

      return {
        domain: urlObj.hostname,
        segments,
        params,
      };
    } catch {
      return null;
    }
  }

  private calculatePathSimilarity(segments1: string[], segments2: string[]): number {
    if (segments1.length === 0 && segments2.length === 0) return 1;
    if (segments1.length === 0 || segments2.length === 0) return 0;

    const longestCommonPrefix = this.getLongestCommonPrefix(segments1, segments2);
    const maxLength = Math.max(segments1.length, segments2.length);
    
    const prefixScore = longestCommonPrefix / maxLength;

    const commonSegments = segments1.filter(seg => segments2.includes(seg)).length;
    const unionSize = new Set([...segments1, ...segments2]).size;
    const jaccardScore = unionSize > 0 ? commonSegments / unionSize : 0;

    return (prefixScore * 0.6 + jaccardScore * 0.4);
  }

  private getLongestCommonPrefix(arr1: string[], arr2: string[]): number {
    let prefix = 0;
    const minLength = Math.min(arr1.length, arr2.length);
    
    for (let i = 0; i < minLength; i++) {
      if (arr1[i] === arr2[i]) {
        prefix++;
      } else {
        break;
      }
    }
    
    return prefix;
  }

  private calculateParamSimilarity(params1: Map<string, string>, params2: Map<string, string>): number {
    if (params1.size === 0 && params2.size === 0) return 1;
    if (params1.size === 0 || params2.size === 0) return 0;

    let commonKeys = 0;
    let commonValues = 0;
    
    for (const [key, value] of params1) {
      if (params2.has(key)) {
        commonKeys++;
        if (params2.get(key) === value) {
          commonValues++;
        }
      }
    }

    const keysSimilarity = (2 * commonKeys) / (params1.size + params2.size);
    const valuesSimilarity = params1.size > 0 ? commonValues / params1.size : 0;

    return (keysSimilarity * 0.5 + valuesSimilarity * 0.5);
  }

  private calculateTitleSimilarity(node1: TaxonomyNode, node2: TaxonomyNode): number {
    const title1 = node1.title.toLowerCase();
    const title2 = node2.title.toLowerCase();

    if (title1 === title2) return 1;

    const tokens1 = this.tokenize(title1);
    const tokens2 = this.tokenize(title2);

    const commonTokens = tokens1.filter(token => tokens2.includes(token)).length;
    const unionSize = new Set([...tokens1, ...tokens2]).size;
    
    const jaccardSimilarity = unionSize > 0 ? commonTokens / unionSize : 0;

    const levenshteinSimilarity = 1 - (this.levenshteinDistance(title1, title2) / Math.max(title1.length, title2.length));

    return (jaccardSimilarity * 0.6 + levenshteinSimilarity * 0.4);
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(token => token.length > 2);
  }

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
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  private calculateStructuralSimilarity(node1: TaxonomyNode, node2: TaxonomyNode): number {
    let similarity = 0;
    let factors = 0;

    const depthDiff = Math.abs(node1.depth - node2.depth);
    const depthSimilarity = 1 / (1 + depthDiff);
    similarity += depthSimilarity * 0.3;
    factors += 0.3;

    const childrenDiff = Math.abs(node1.children.length - node2.children.length);
    const maxChildren = Math.max(node1.children.length, node2.children.length);
    const childrenSimilarity = maxChildren > 0 ? 1 - (childrenDiff / maxChildren) : 1;
    similarity += childrenSimilarity * 0.3;
    factors += 0.3;

    const sameParent = node1.parentId === node2.parentId ? 1 : 0;
    similarity += sameParent * 0.4;
    factors += 0.4;

    return factors > 0 ? similarity / factors : 0;
  }

  private calculateContentSimilarity(node1: TaxonomyNode, node2: TaxonomyNode): number {
    let similarity = 0;
    let factors = 0;

    const statusMatch = node1.metadata.contentStatus === node2.metadata.contentStatus ? 1 : 0;
    similarity += statusMatch * 0.2;
    factors += 0.2;

    const hasContentMatch = node1.metadata.hasContent === node2.metadata.hasContent ? 1 : 0;
    similarity += hasContentMatch * 0.2;
    factors += 0.2;

    const skuDiff = Math.abs(node1.metadata.skuCount - node2.metadata.skuCount);
    const maxSku = Math.max(node1.metadata.skuCount, node2.metadata.skuCount);
    const skuSimilarity = maxSku > 0 ? 1 - (skuDiff / maxSku) : 1;
    similarity += skuSimilarity * 0.3;
    factors += 0.3;

    const timeDiff = Math.abs(
      node1.metadata.lastModified.getTime() - node2.metadata.lastModified.getTime()
    );
    const maxTimeDiff = 365 * 24 * 60 * 60 * 1000;
    const timeSimilarity = Math.max(0, 1 - (timeDiff / maxTimeDiff));
    similarity += timeSimilarity * 0.3;
    factors += 0.3;

    return factors > 0 ? similarity / factors : 0;
  }

  private calculateConfidence(similarities: {
    urlSimilarity: number;
    titleSimilarity: number;
    structuralSimilarity: number;
    contentSimilarity: number;
  }): number {
    const values = Object.values(similarities);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    
    const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    
    const consistency = 1 - stdDev;
    
    const nonZeroCount = values.filter(v => v > 0).length;
    const coverage = nonZeroCount / values.length;
    
    return (consistency * 0.7 + coverage * 0.3);
  }

  findSimilarNodes(targetNode: TaxonomyNode, allNodes: TaxonomyNode[], limit = 10): SimilarityResult[] {
    const similarities: SimilarityResult[] = [];

    for (const node of allNodes) {
      if (node.id === targetNode.id) continue;

      const similarity = this.calculateSimilarity(targetNode, node);
      
      if (similarity.overallSimilarity >= this.config.thresholds.minimum) {
        similarities.push(similarity);
      }
    }

    return similarities
      .sort((a, b) => b.overallSimilarity - a.overallSimilarity)
      .slice(0, limit);
  }

  findDuplicates(nodes: TaxonomyNode[], threshold = 0.85): SimilarityResult[] {
    const duplicates: SimilarityResult[] = [];
    const processed = new Set<string>();

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const pairKey = `${nodes[i].id}-${nodes[j].id}`;
        if (processed.has(pairKey)) continue;
        
        processed.add(pairKey);
        
        const similarity = this.calculateSimilarity(nodes[i], nodes[j]);
        
        if (similarity.overallSimilarity >= threshold) {
          duplicates.push(similarity);
        }
      }
    }

    return duplicates.sort((a, b) => b.overallSimilarity - a.overallSimilarity);
  }

  clusterBySimilarity(nodes: TaxonomyNode[], threshold = 0.5): TaxonomyNode[][] {
    const clusters: TaxonomyNode[][] = [];
    const assigned = new Set<string>();

    for (const node of nodes) {
      if (assigned.has(node.id)) continue;

      const cluster = [node];
      assigned.add(node.id);

      for (const otherNode of nodes) {
        if (assigned.has(otherNode.id)) continue;

        const similarity = this.calculateSimilarity(node, otherNode);
        
        if (similarity.overallSimilarity >= threshold) {
          cluster.push(otherNode);
          assigned.add(otherNode.id);
        }
      }

      if (cluster.length > 1) {
        clusters.push(cluster);
      }
    }

    return clusters.sort((a, b) => b.length - a.length);
  }
}