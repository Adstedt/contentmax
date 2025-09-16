import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface ProductCategory {
  product_type?: string; // "Electronics > Phones > Smartphones"
  google_product_category?: string; // "Electronics > Communications > Mobile Phones"
  product_id: string;
  product_title: string;
  url?: string;
}

export interface TaxonomyNode {
  id: string;
  title: string;
  path: string;
  url?: string;
  meta_title?: string;
  meta_description?: string;
  depth: number;
  parent_id?: string;
  product_count: number;
  source: 'merchant' | 'google' | 'hybrid';
  metadata: {
    google_category?: string;
    merchant_category?: string;
    created_from: 'feed' | 'sitemap';
    base_url?: string;
  };
}

export class FeedTaxonomyBuilder {
  private nodes: Map<string, TaxonomyNode> = new Map();
  private productAssignments: Map<string, Set<string>> = new Map();
  private products: any[] = [];
  private baseUrl: string = '';
  private progressCallback?: (progress: {
    phase: string;
    current: number;
    total: number;
    message: string;
  }) => void;

  async buildFromProductFeed(
    products: any[],
    options?: {
      skipPersist?: boolean;
      userId?: string;
      projectId?: string;
      onProgress?: (progress: {
        phase: string;
        current: number;
        total: number;
        message: string;
      }) => void;
    }
  ) {
    console.log(`Building taxonomy from ${products.length} products`);
    console.log('First product received:', products[0]);
    console.log('Options:', options);

    // Store progress callback if provided
    this.progressCallback = options?.onProgress;

    // Store products for later persistence
    this.products = products;

    // Extract base URL from product links
    this.extractBaseUrl(products);

    // Step 1: Extract all unique category paths
    this.reportProgress('extracting', 0, 1, 'Extracting category paths...');
    const categoryPaths = this.extractCategoryPaths(products);
    this.reportProgress('extracting', 1, 1, `Found ${categoryPaths.size} unique categories`);

    // Step 2: Build hierarchical structure
    let pathIndex = 0;
    const pathArray = Array.from(categoryPaths);
    for (const path of pathArray) {
      this.reportProgress(
        'building',
        pathIndex,
        pathArray.length,
        `Building category structure...`
      );
      this.createNodesFromPath(path);
      pathIndex++;
    }
    this.reportProgress(
      'building',
      pathArray.length,
      pathArray.length,
      `Created ${this.nodes.size} category nodes`
    );

    // Step 3: Assign products to categories
    for (let i = 0; i < products.length; i++) {
      if (i % 100 === 0) {
        this.reportProgress('assigning', i, products.length, `Assigning products to categories...`);
      }
      this.assignProductToCategory(products[i]);
    }
    this.reportProgress(
      'assigning',
      products.length,
      products.length,
      'Products assigned to categories'
    );

    // Step 4: Calculate product counts
    this.reportProgress('counting', 0, 1, 'Calculating product counts...');
    this.calculateProductCounts();
    this.reportProgress('counting', 1, 1, 'Product counts calculated');

    // Step 5: Store in database (skip in tests)
    if (!options?.skipPersist) {
      this.reportProgress('persisting', 0, 1, 'Saving to database...');
      const result = await this.persistToDatabase(options?.userId, options?.projectId);
      this.reportProgress('persisting', 1, 1, 'Database save complete');
      return result;
    }

    return Array.from(this.nodes.values());
  }

  private extractBaseUrl(products: any[]): void {
    // Find first product with a valid URL to extract base domain
    for (const product of products) {
      const url = product.link || product.url;
      if (url) {
        try {
          const urlObj = new URL(url);
          this.baseUrl = `${urlObj.protocol}//${urlObj.host}`;
          console.log('Extracted base URL:', this.baseUrl);
          break;
        } catch (e) {
          // Invalid URL, continue
        }
      }
    }
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
      .replace(/\s*[>/|]\s*/g, ' > ')
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
            created_from: 'feed',
            base_url: this.baseUrl,
          },
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

      // Use the same ID generation logic as in persistToDatabase
      const productIndex = this.products.indexOf(product);
      const productId = product.id || product.product_id || `prod_${Date.now()}_${productIndex}`;
      this.productAssignments.get(nodeId)!.add(productId);
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
      .map((word) => {
        if (word.length === 0) return word;
        // Check if word contains non-ASCII characters (like Swedish å, ä, ö)
        if (/[^\u0020-\u007F]/.test(word)) {
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

  // Removed URL generation methods - URLs should be discovered from actual site or provided in feed

  private async persistToDatabase(userId?: string, projectId?: string) {
    const supabase = await createServerSupabaseClient();
    const nodesArray = Array.from(this.nodes.values());

    // Sort by depth to insert parents first
    nodesArray.sort((a, b) => a.depth - b.depth);

    this.reportProgress('persisting', 0, 3, 'Saving taxonomy nodes...');

    // Batch insert nodes with user and project association
    const { data, error } = await supabase
      .from('taxonomy_nodes')
      .upsert(
        nodesArray.map((node) => ({
          id: node.id,
          title: node.title,
          path: node.path,
          url: node.url || null,
          meta_title: node.meta_title || null,
          meta_description: node.meta_description || null,
          depth: node.depth,
          parent_id: node.parent_id,
          product_count: node.product_count,
          metadata: node.metadata,
          source: node.source,
          user_id: userId,
          project_id: projectId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }))
      )
      .select();

    if (error) {
      console.error('Failed to persist taxonomy:', error);
      throw error;
    }

    this.reportProgress('persisting', 1, 3, 'Saving products...');

    // Store products first - IN BATCHES for large feeds
    if (this.products.length > 0) {
      console.log(`Preparing to save ${this.products.length} products...`);

      const BATCH_SIZE = 100; // Insert 100 products at a time
      let totalSaved = 0;
      const totalBatches = Math.ceil(this.products.length / BATCH_SIZE);

      for (let i = 0; i < this.products.length; i += BATCH_SIZE) {
        const batch = this.products.slice(i, i + BATCH_SIZE);
        const batchNumber = Math.floor(i / BATCH_SIZE) + 1;

        // Report progress for product saving
        // We're in step 2 of 3 (0=nodes, 1=products start, 2=products end, 3=assignments)
        // Map batch progress from 1.0 to 2.0
        const batchRatio = (batchNumber - 1) / Math.max(totalBatches - 1, 1);
        const batchProgress = 1.0 + batchRatio; // Will go from 1.0 to 2.0

        this.reportProgress(
          'persisting',
          batchProgress,
          3,
          `Saving products batch ${batchNumber}/${totalBatches}...`
        );

        const productsToInsert = batch.map((product, index) => ({
          // Generate ID if not provided - CRITICAL FIX
          id: product.id || product.product_id || `prod_${Date.now()}_${i + index}`,
          title: product.title || product.product_title || 'Untitled Product',
          description: product.description || null,
          price:
            typeof product.price === 'object' && product.price !== null
              ? product.price.value
              : typeof product.price === 'string'
                ? parseFloat(product.price.replace(/[^0-9.]/g, ''))
                : product.price,
          image_link: product.image_link || null,
          link: product.link || product.url || null, // Keep for backwards compatibility
          brand: product.brand || null,
          condition: product.condition || null,
          availability: product.availability || null,
          gtin: product.gtin || null,
          mpn: product.mpn || null,
          product_type: product.product_type || null,
          google_product_category: product.google_product_category || null,
          additional_images: [], // Empty array for the TEXT[] field
          // Extract meta fields if available
          meta_title: product.meta_title || product.seo_title || null,
          meta_description: product.meta_description || product.seo_description || null,
          user_id: userId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }));

        console.log(
          `Inserting batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(this.products.length / BATCH_SIZE)} (${productsToInsert.length} products)`
        );

        // Debug: Log first product to check structure
        if (i === 0) {
          console.log('First product to insert:', JSON.stringify(productsToInsert[0], null, 2));
        }

        const { data: insertedProducts, error: productError } = await supabase
          .from('products')
          .upsert(productsToInsert)
          .select();

        if (productError) {
          console.error(`Failed to persist batch ${Math.floor(i / BATCH_SIZE) + 1}:`, productError);
          console.error('Error details:', JSON.stringify(productError, null, 2));
          // Continue with next batch
        } else {
          totalSaved += insertedProducts?.length || 0;
          console.log(
            `Batch ${batchNumber}/${totalBatches} saved. Total products saved: ${totalSaved}`
          );
        }
      }

      console.log(
        `Finished saving products. Total saved: ${totalSaved} out of ${this.products.length}`
      );

      // Report completion of product saving
      this.reportProgress('persisting', 2, 3, 'Products saved successfully');
    }

    this.reportProgress('persisting', 2.5, 3, 'Creating category assignments...');

    // Store product-category assignments
    const assignments = [];
    for (const [nodeId, productIds] of this.productAssignments.entries()) {
      for (const productId of productIds) {
        assignments.push({
          product_id: productId,
          category_id: nodeId,
          created_at: new Date().toISOString(),
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

    // Report final completion
    this.reportProgress('persisting', 3, 3, 'Database save complete');

    return data || nodesArray; // Return nodes even if data is undefined
  }

  // Public method to get nodes for testing
  getNodes(): Map<string, TaxonomyNode> {
    return this.nodes;
  }

  // Public method to get product assignments for testing
  getProductAssignments(): Map<string, Set<string>> {
    return this.productAssignments;
  }

  private reportProgress(phase: string, current: number, total: number, message: string) {
    if (this.progressCallback) {
      this.progressCallback({ phase, current, total, message });
    }
  }
}
