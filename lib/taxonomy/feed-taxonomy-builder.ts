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
  private products: any[] = [];
  
  async buildFromProductFeed(products: any[], options?: { skipPersist?: boolean; userId?: string; projectId?: string }) {
    console.log(`Building taxonomy from ${products.length} products`);
    
    // Store products for later persistence
    this.products = products;
    
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
    
    // Step 5: Store in database (skip in tests)
    if (!options?.skipPersist) {
      return await this.persistToDatabase(options?.userId, options?.projectId);
    }
    
    return Array.from(this.nodes.values());
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
      
      this.productAssignments.get(nodeId)!.add(product.id || product.product_id);
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
    // Preserve original casing for non-ASCII characters
    // Only capitalize first letter of each word for ASCII text
    return segment
      .replace(/[-_]/g, ' ')
      .split(' ')
      .map(word => {
        if (word.length === 0) return word;
        // Check if word contains non-ASCII characters (like Swedish å, ä, ö)
        if (/[^\u0000-\u007F]/.test(word)) {
          // For words with special characters, only capitalize first letter
          return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        } else {
          // For regular ASCII words, capitalize first letter
          return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        }
      })
      .join(' ')
      .trim();
  }
  
  private async persistToDatabase(userId?: string, projectId?: string) {
    const supabase = await createServerSupabaseClient();
    const nodesArray = Array.from(this.nodes.values());
    
    // Sort by depth to insert parents first
    nodesArray.sort((a, b) => a.depth - b.depth);
    
    // Batch insert nodes with user and project association
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
        user_id: userId,
        project_id: projectId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })))
      .select();
    
    if (error) {
      console.error('Failed to persist taxonomy:', error);
      throw error;
    }
    
    // Store products first
    if (this.products.length > 0) {
      const productsToInsert = this.products.map(product => ({
        id: product.id || product.product_id,
        title: product.title || product.product_title,
        description: product.description,
        price: product.price,
        image_link: product.image_link,
        link: product.link || product.url,
        brand: product.brand,
        condition: product.condition,
        availability: product.availability,
        gtin: product.gtin,
        mpn: product.mpn,
        product_type: product.product_type,
        google_product_category: product.google_product_category,
        user_id: userId,
        project_id: projectId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));
      
      const { error: productError } = await supabase
        .from('products')
        .upsert(productsToInsert);
      
      if (productError) {
        console.error('Failed to persist products:', productError);
        // Continue anyway to at least save the taxonomy
      } else {
        console.log(`Saved ${this.products.length} products to database`);
      }
    }
    
    // Store product-category assignments
    const assignments = [];
    for (const [nodeId, productIds] of this.productAssignments.entries()) {
      for (const productId of productIds) {
        assignments.push({
          product_id: productId,
          category_id: nodeId,
          created_at: new Date().toISOString()
        });
      }
    }
    
    if (assignments.length > 0) {
      const { error: assignmentError } = await supabase
        .from('product_categories')
        .upsert(assignments);
      
      if (assignmentError) {
        console.error('Failed to persist product assignments:', assignmentError);
      } else {
        console.log(`Created ${assignments.length} product-category assignments`);
      }
    }
    
    console.log(`Created ${nodesArray.length} taxonomy nodes from product feed`);
    return data;
  }
  
  // Public method to get nodes for testing
  getNodes(): Map<string, TaxonomyNode> {
    return this.nodes;
  }
  
  // Public method to get product assignments for testing
  getProductAssignments(): Map<string, Set<string>> {
    return this.productAssignments;
  }
}