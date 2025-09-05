# STORY-004: Build Taxonomy from Product Feed (REVISED)

## Story Overview

**Story ID:** STORY-004  
**Epic:** EPIC-001 - Data Ingestion Pipeline  
**Sprint:** Sprint 6  
**Priority:** P0 - Critical Path  
**Estimated Effort:** 3 hours  
**Story Points:** 3  
**Revision:** v2 - Now builds from Product Feed, not URLs

## User Story

As a **content manager**,  
I want **the taxonomy automatically built from my Google Merchant product categories**,  
So that **the hierarchy matches my actual product catalog structure**.

## Context

Google Merchant feeds contain explicit category hierarchies in two fields:
- `product_type`: Merchant's custom category taxonomy (e.g., "Home > Kitchen > Appliances > Blenders")
- `google_product_category`: Google's standardized taxonomy

This provides much richer and more accurate taxonomy data than inferring from URLs.

## Acceptance Criteria

### Functional Requirements
1. ✅ Extract categories from product_type field
2. ✅ Parse google_product_category as fallback
3. ✅ Build hierarchical tree from category strings
4. ✅ Merge duplicate categories intelligently
5. ✅ Count products per category

### Technical Requirements
6. ✅ Handle multiple taxonomy formats (> vs / delimiters)
7. ✅ Create parent categories automatically
8. ✅ Maintain bidirectional relationships
9. ✅ Store both merchant and Google taxonomies
10. ✅ Calculate category depth correctly

### Data Requirements
11. ✅ Preserve original category names
12. ✅ Track category source (merchant vs Google)
13. ✅ Store product count per node
14. ✅ Support category aliases

## Technical Implementation Notes

### Enhanced Taxonomy Builder for Product Feeds
```typescript
// lib/taxonomy/feed-taxonomy-builder.ts
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface ProductCategory {
  product_type?: string;           // "Electronics > Phones > Smartphones"
  google_product_category?: string; // "Electronics > Communications > Mobile Phones"
  product_id: string;
  product_title: string;
  url?: string;
}

export interface TaxonomyNode {
  id: string;
  title: string;
  path: string;
  depth: number;
  parent_id?: string;
  product_count: number;
  source: 'merchant' | 'google' | 'hybrid';
  metadata: {
    google_category?: string;
    merchant_category?: string;
    created_from: 'feed' | 'sitemap';
  };
}

export class FeedTaxonomyBuilder {
  private nodes: Map<string, TaxonomyNode> = new Map();
  private productAssignments: Map<string, Set<string>> = new Map();
  
  async buildFromProductFeed(products: any[]) {
    console.log(`Building taxonomy from ${products.length} products`);
    
    // Step 1: Extract all unique category paths
    const categoryPaths = this.extractCategoryPaths(products);
    
    // Step 2: Build hierarchical structure
    for (const path of categoryPaths) {
      this.createNodesFromPath(path);
    }
    
    // Step 3: Assign products to categories
    for (const product of products) {
      this.assignProductToCategory(product);
    }
    
    // Step 4: Calculate product counts
    this.calculateProductCounts();
    
    // Step 5: Store in database
    return await this.persistToDatabase();
  }
  
  private extractCategoryPaths(products: any[]): Set<string> {
    const paths = new Set<string>();
    
    for (const product of products) {
      // Prioritize merchant's product_type
      if (product.product_type) {
        const normalizedPath = this.normalizePathString(product.product_type);
        paths.add(normalizedPath);
      }
      
      // Use Google category as fallback or supplement
      if (product.google_product_category) {
        const normalizedPath = this.normalizePathString(product.google_product_category);
        paths.add(normalizedPath);
      }
    }
    
    return paths;
  }
  
  private normalizePathString(pathString: string): string {
    // Handle different delimiters: >, /, |
    return pathString
      .replace(/\s*[>\/|]\s*/g, ' > ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  
  private createNodesFromPath(pathString: string) {
    const segments = pathString.split(' > ').filter(Boolean);
    let currentPath = '';
    let parentId: string | undefined;
    
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i].trim();
      currentPath = currentPath ? `${currentPath}/${segment}` : segment;
      
      const nodeId = this.generateNodeId(currentPath);
      
      if (!this.nodes.has(nodeId)) {
        const node: TaxonomyNode = {
          id: nodeId,
          title: this.humanizeTitle(segment),
          path: currentPath,
          depth: i + 1,
          parent_id: parentId,
          product_count: 0,
          source: 'merchant',
          metadata: {
            merchant_category: pathString,
            created_from: 'feed'
          }
        };
        
        this.nodes.set(nodeId, node);
      }
      
      parentId = nodeId;
    }
  }
  
  private assignProductToCategory(product: any) {
    // Find the most specific (deepest) category for this product
    let categoryPath = '';
    
    if (product.product_type) {
      categoryPath = this.normalizePathString(product.product_type);
    } else if (product.google_product_category) {
      categoryPath = this.normalizePathString(product.google_product_category);
    }
    
    if (categoryPath) {
      const segments = categoryPath.split(' > ');
      const leafPath = segments.join('/');
      const nodeId = this.generateNodeId(leafPath);
      
      if (!this.productAssignments.has(nodeId)) {
        this.productAssignments.set(nodeId, new Set());
      }
      
      this.productAssignments.get(nodeId)!.add(product.id);
    }
  }
  
  private calculateProductCounts() {
    // Direct product counts
    for (const [nodeId, productIds] of this.productAssignments.entries()) {
      const node = this.nodes.get(nodeId);
      if (node) {
        node.product_count = productIds.size;
      }
    }
    
    // Aggregate counts for parent nodes
    for (const node of this.nodes.values()) {
      if (node.parent_id) {
        this.propagateCountToParent(node.parent_id, node.product_count);
      }
    }
  }
  
  private propagateCountToParent(parentId: string, count: number) {
    const parent = this.nodes.get(parentId);
    if (parent) {
      parent.product_count += count;
      if (parent.parent_id) {
        this.propagateCountToParent(parent.parent_id, count);
      }
    }
  }
  
  private generateNodeId(path: string): string {
    // Create stable IDs based on path
    return path
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
  
  private humanizeTitle(segment: string): string {
    return segment
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase())
      .trim();
  }
  
  private async persistToDatabase() {
    const supabase = await createServerSupabaseClient();
    const nodesArray = Array.from(this.nodes.values());
    
    // Sort by depth to insert parents first
    nodesArray.sort((a, b) => a.depth - b.depth);
    
    // Batch insert nodes
    const { data, error } = await supabase
      .from('taxonomy_nodes')
      .upsert(nodesArray.map(node => ({
        id: node.id,
        title: node.title,
        path: node.path,
        depth: node.depth,
        parent_id: node.parent_id,
        product_count: node.product_count,
        metadata: node.metadata,
        source: node.source,
        created_at: new Date().toISOString()
      })))
      .select();
    
    if (error) {
      console.error('Failed to persist taxonomy:', error);
      throw error;
    }
    
    // Store product-category assignments
    const assignments = [];
    for (const [nodeId, productIds] of this.productAssignments.entries()) {
      for (const productId of productIds) {
        assignments.push({
          product_id: productId,
          category_id: nodeId
        });
      }
    }
    
    if (assignments.length > 0) {
      await supabase
        .from('product_categories')
        .upsert(assignments);
    }
    
    console.log(`Created ${nodesArray.length} taxonomy nodes from product feed`);
    return data;
  }
}
```

### Intelligent Category Merging
```typescript
// lib/taxonomy/category-merger.ts
export class CategoryMerger {
  mergeSimilarCategories(nodes: Map<string, TaxonomyNode>) {
    const similarityThreshold = 0.85;
    const mergeMap = new Map<string, string>();
    
    // Find similar categories
    for (const [id1, node1] of nodes) {
      for (const [id2, node2] of nodes) {
        if (id1 !== id2 && node1.depth === node2.depth) {
          const similarity = this.calculateSimilarity(node1.title, node2.title);
          
          if (similarity > similarityThreshold) {
            // Merge to the one with more products
            if (node1.product_count >= node2.product_count) {
              mergeMap.set(id2, id1);
            } else {
              mergeMap.set(id1, id2);
            }
          }
        }
      }
    }
    
    // Apply merges
    for (const [fromId, toId] of mergeMap) {
      this.mergeNodes(nodes, fromId, toId);
    }
  }
  
  private calculateSimilarity(str1: string, str2: string): number {
    // Levenshtein distance normalized to 0-1
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();
    
    if (s1 === s2) return 1;
    
    // Check for common patterns
    const patterns = [
      { pattern: /^(.+?)s?$/, weight: 0.9 }, // Plural
      { pattern: /^(.+?)(?:&|and)(.+?)$/, weight: 0.85 }, // And/&
      { pattern: /^(.+?)[-\s](.+?)$/, weight: 0.8 } // Hyphen/space
    ];
    
    for (const { pattern, weight } of patterns) {
      const match1 = s1.match(pattern);
      const match2 = s2.match(pattern);
      
      if (match1 && match2 && match1[1] === match2[1]) {
        return weight;
      }
    }
    
    // Fallback to simple comparison
    return 0;
  }
}
```

### API Integration
```typescript
// app/api/taxonomy/build/route.ts
export async function POST(request: NextRequest) {
  const { products } = await request.json();
  
  try {
    const builder = new FeedTaxonomyBuilder();
    const nodes = await builder.buildFromProductFeed(products);
    
    // Optional: Merge similar categories
    const merger = new CategoryMerger();
    merger.mergeSimilarCategories(nodes);
    
    // Calculate statistics
    const stats = {
      totalNodes: nodes.length,
      maxDepth: Math.max(...nodes.map(n => n.depth)),
      totalProducts: products.length,
      avgProductsPerCategory: products.length / nodes.length,
      categoriesWithProducts: nodes.filter(n => n.product_count > 0).length
    };
    
    return NextResponse.json({
      success: true,
      nodes: nodes.length,
      stats
    });
  } catch (error) {
    console.error('Taxonomy build failed:', error);
    return NextResponse.json(
      { error: 'Failed to build taxonomy' },
      { status: 500 }
    );
  }
}
```

### Example Category Extraction
```typescript
// Example of how categories are extracted from a Google Merchant product
const exampleProduct = {
  id: "SKU123",
  title: "iPhone 15 Pro Max 256GB",
  product_type: "Electronics > Mobile Phones > Smartphones > Apple",
  google_product_category: "Electronics > Communications > Telephony > Mobile Phones",
  price: { value: "1199.00", currency: "USD" },
  link: "https://example.com/products/iphone-15-pro-max"
};

// This creates nodes:
// 1. Electronics (depth: 1)
// 2. Electronics > Mobile Phones (depth: 2)
// 3. Electronics > Mobile Phones > Smartphones (depth: 3)
// 4. Electronics > Mobile Phones > Smartphones > Apple (depth: 4)
```

## Dependencies

- Requires STORY-007 completion (product feed parsed)
- Products available with category data
- Database schema ready for taxonomy nodes

## Testing Requirements

### Unit Tests
```typescript
describe('FeedTaxonomyBuilder', () => {
  it('extracts categories from product_type field');
  it('uses google_product_category as fallback');
  it('builds hierarchy correctly from paths');
  it('merges duplicate categories');
  it('counts products accurately per category');
  it('handles various delimiter formats');
  it('creates parent nodes automatically');
});
```

### Integration Tests
- Test with real Google Merchant feed data
- Verify hierarchy matches expected structure
- Test with 10,000+ products
- Validate category merging logic

## Definition of Done

- [ ] Categories extracted from product feed
- [ ] Hierarchy built correctly
- [ ] Product counts accurate
- [ ] Duplicate categories merged
- [ ] Database populated with nodes
- [ ] Parent-child relationships correct
- [ ] Unit tests passing
- [ ] Tested with real merchant data
- [ ] Performance acceptable for large feeds

## Dev Agent Record

### Agent Model Used
_To be filled by implementing agent_

### Debug Log References
_To be filled during implementation_

### Completion Notes
_To be filled after implementation_

### File List
- `lib/taxonomy/feed-taxonomy-builder.ts` (new)
- `lib/taxonomy/category-merger.ts` (new)
- `app/api/taxonomy/build/route.ts` (new)
- `lib/taxonomy/feed-taxonomy-builder.test.ts` (new)

---
**Created:** 2025-01-09  
**Updated:** 2025-01-09 (Revised for Product Feed)  
**Status:** Ready for Development  
**Assigned:** Unassigned