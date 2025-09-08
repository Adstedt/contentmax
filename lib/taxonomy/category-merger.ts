import { TaxonomyNode } from './feed-taxonomy-builder';

export class CategoryMerger {
  private mergeMap: Map<string, string> = new Map();
  
  mergeSimilarCategories(nodes: Map<string, TaxonomyNode>): Map<string, TaxonomyNode> {
    const similarityThreshold = 0.85;
    const processedPairs = new Set<string>();
    
    // Find similar categories at the same depth level
    const nodesByDepth = this.groupNodesByDepth(nodes);
    
    for (const [depth, depthNodes] of nodesByDepth) {
      for (const node1 of depthNodes) {
        for (const node2 of depthNodes) {
          if (node1.id === node2.id) continue;
          
          // Create a unique pair identifier to avoid duplicate processing
          const pairKey = [node1.id, node2.id].sort().join('|');
          if (processedPairs.has(pairKey)) continue;
          processedPairs.add(pairKey);
          
          // Check if they have the same parent
          if (node1.parent_id !== node2.parent_id) continue;
          
          const similarity = this.calculateSimilarity(node1.title, node2.title);
          
          if (similarity > similarityThreshold) {
            // Merge to the one with more products, or alphabetically if equal
            if (node1.product_count > node2.product_count) {
              this.mergeMap.set(node2.id, node1.id);
            } else if (node2.product_count > node1.product_count) {
              this.mergeMap.set(node1.id, node2.id);
            } else if (node1.title.toLowerCase() < node2.title.toLowerCase()) {
              this.mergeMap.set(node2.id, node1.id);
            } else {
              this.mergeMap.set(node1.id, node2.id);
            }
          }
        }
      }
    }
    
    // Apply merges
    return this.applyMerges(nodes);
  }
  
  private groupNodesByDepth(nodes: Map<string, TaxonomyNode>): Map<number, TaxonomyNode[]> {
    const depthMap = new Map<number, TaxonomyNode[]>();
    
    for (const node of nodes.values()) {
      if (!depthMap.has(node.depth)) {
        depthMap.set(node.depth, []);
      }
      depthMap.get(node.depth)!.push(node);
    }
    
    return depthMap;
  }
  
  private calculateSimilarity(str1: string, str2: string): number {
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();
    
    // Exact match
    if (s1 === s2) return 1;
    
    // Common variations patterns
    const patterns = [
      // Plural variations
      { test: (a: string, b: string) => {
        // Simple plural (add s)
        if (a + 's' === b || b + 's' === a) return true;
        // Remove s plural
        if (a.replace(/s$/, '') === b || b.replace(/s$/, '') === a) return true;
        // -y to -ies plural (category -> categories)
        if (a.replace(/y$/, 'ies') === b || b.replace(/y$/, 'ies') === a) return true;
        // -ies to -y singular
        if (a.replace(/ies$/, 'y') === b || b.replace(/ies$/, 'y') === a) return true;
        return false;
      }, weight: 0.95 },
      
      // And/& variations
      { test: (a: string, b: string) => {
        const withAnd = a.replace(/\s*&\s*/g, ' and ');
        const withAmpersand = a.replace(/\s+and\s+/g, ' & ');
        return b === withAnd || b === withAmpersand;
      }, weight: 0.92 },
      
      // Hyphen/space variations
      { test: (a: string, b: string) => {
        const withHyphen = a.replace(/\s+/g, '-');
        const withSpace = a.replace(/-/g, ' ');
        return b === withHyphen || b === withSpace;
      }, weight: 0.90 },
      
      // Common abbreviations
      { test: (a: string, b: string) => {
        const abbreviations: Record<string, string[]> = {
          'accessories': ['acc', 'access'],
          'electronics': ['elec', 'electronic'],
          'equipment': ['equip', 'eqpt'],
          'miscellaneous': ['misc', 'other'],
        };
        
        for (const [full, abbrevs] of Object.entries(abbreviations)) {
          if ((a === full && abbrevs.includes(b)) || 
              (b === full && abbrevs.includes(a))) {
            return true;
          }
        }
        return false;
      }, weight: 0.88 }
    ];
    
    // Check patterns
    for (const { test, weight } of patterns) {
      if (test(s1, s2) || test(s2, s1)) {
        return weight;
      }
    }
    
    // Levenshtein distance for remaining cases
    const distance = this.levenshteinDistance(s1, s2);
    const maxLength = Math.max(s1.length, s2.length);
    const similarity = 1 - (distance / maxLength);
    
    return similarity;
  }
  
  private levenshteinDistance(str1: string, str2: string): number {
    const m = str1.length;
    const n = str2.length;
    const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
    
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = Math.min(
            dp[i - 1][j] + 1,     // deletion
            dp[i][j - 1] + 1,     // insertion
            dp[i - 1][j - 1] + 1  // substitution
          );
        }
      }
    }
    
    return dp[m][n];
  }
  
  private applyMerges(nodes: Map<string, TaxonomyNode>): Map<string, TaxonomyNode> {
    const mergedNodes = new Map<string, TaxonomyNode>();
    const processedIds = new Set<string>();
    
    // First pass: identify all nodes that will be kept
    for (const [nodeId, node] of nodes) {
      if (!this.mergeMap.has(nodeId)) {
        // This node is not being merged away
        mergedNodes.set(nodeId, { ...node });
      }
    }
    
    // Second pass: merge data from nodes being removed
    for (const [fromId, toId] of this.mergeMap) {
      const fromNode = nodes.get(fromId);
      const toNode = mergedNodes.get(toId);
      
      if (fromNode && toNode) {
        // Combine product counts
        toNode.product_count += fromNode.product_count;
        
        // Merge metadata
        if (fromNode.metadata.google_category && !toNode.metadata.google_category) {
          toNode.metadata.google_category = fromNode.metadata.google_category;
        }
        if (fromNode.metadata.merchant_category && !toNode.metadata.merchant_category) {
          toNode.metadata.merchant_category = fromNode.metadata.merchant_category;
        }
        
        // Update source to hybrid if merging different sources
        if (fromNode.source !== toNode.source) {
          toNode.source = 'hybrid';
        }
        
        // Update children to point to the merged parent
        for (const [childId, childNode] of nodes) {
          if (childNode.parent_id === fromId) {
            const mergedChild = mergedNodes.get(childId);
            if (mergedChild) {
              mergedChild.parent_id = toId;
            }
          }
        }
        
        console.log(`Merged category "${fromNode.title}" into "${toNode.title}"`);
      }
    }
    
    return mergedNodes;
  }
  
  // Get merge statistics for reporting
  getMergeStats(): { totalMerges: number; mergeMap: Map<string, string> } {
    return {
      totalMerges: this.mergeMap.size,
      mergeMap: this.mergeMap
    };
  }
}