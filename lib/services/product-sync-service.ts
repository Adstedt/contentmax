import { SupabaseClient } from '@supabase/supabase-js';
import { ProductData, ParsedFeed, CategoryInfo } from '@/lib/parsers/product-feed-parser';

export interface SyncResult {
  inserted: number;
  updated: number;
  deleted: number;
  failed: number;
  errors: any[];
  duration: number;
  syncId?: string;
}

export interface ProductChanges {
  hasChanges: boolean;
  added: ProductData[];
  updated: ProductData[];
  removed: string[];
}

export interface ProductSyncService {
  syncProducts(feed: ParsedFeed): Promise<SyncResult>;
  updateCategoryCounts(): Promise<void>;
  detectChanges(oldProducts: ProductData[], newProducts: ProductData[]): ProductChanges;
  markStaleProducts(activeProductIds: string[]): Promise<number>;
}

export class ProductSyncServiceImpl implements ProductSyncService {
  constructor(private supabase: SupabaseClient) {}

  async syncProducts(feed: ParsedFeed): Promise<SyncResult> {
    const startTime = Date.now();
    const results: SyncResult = {
      inserted: 0,
      updated: 0,
      deleted: 0,
      failed: 0,
      errors: [],
      duration: 0,
    };

    let syncId: string | undefined;

    try {
      // Create sync history record
      const { data: syncRecord, error: syncError } = await this.supabase
        .from('feed_sync_history')
        .insert({
          feed_id: 'google_merchant',
          sync_type: 'full',
          status: 'running',
          started_at: new Date().toISOString(),
          products_processed: feed.totalCount,
        })
        .select('id')
        .single();

      if (syncError) {
        console.error('Failed to create sync record:', syncError);
      } else {
        syncId = syncRecord.id;
        results.syncId = syncId;
      }

      // Get existing products for comparison
      const { data: existingProducts } = await this.supabase
        .from('products')
        .select('id, last_updated');

      const existingIds = new Set(existingProducts?.map(p => p.id) || []);
      
      // Process products in batches
      const batches = this.chunkArray(feed.products, 500);

      for (const batch of batches) {
        try {
          const productsToUpsert = batch.map((p) => ({
            id: p.id,
            title: p.title,
            description: p.description || null,
            url: p.link,
            price: p.price?.value || null,
            currency: p.price?.currency || 'USD',
            sale_price: p.salePrice?.value || null,
            availability: p.availability || 'out of stock',
            brand: p.brand || null,
            image_url: p.imageLink || null,
            additional_images: p.additionalImageLinks || null,
            gtin: p.gtin || null,
            mpn: p.mpn || null,
            product_type: p.productType || null,
            google_category: p.googleProductCategory || null,
            custom_attributes: p.customAttributes || null,
            condition: p.condition || null,
            channel: p.channel || null,
            content_language: p.contentLanguage || null,
            target_country: p.targetCountry || null,
            last_updated: new Date().toISOString(),
          }));

          const { data, error } = await this.supabase
            .from('products')
            .upsert(productsToUpsert, {
              onConflict: 'id',
              ignoreDuplicates: false,
            })
            .select('id');

          if (error) {
            console.error('Batch upsert error:', error);
            results.errors.push(error);
            results.failed += batch.length;
          } else {
            // Count inserts vs updates
            batch.forEach(p => {
              if (existingIds.has(p.id)) {
                results.updated++;
              } else {
                results.inserted++;
                existingIds.add(p.id);
              }
            });
          }
        } catch (batchError) {
          console.error('Batch processing error:', batchError);
          results.errors.push(batchError);
          results.failed += batch.length;
        }
      }

      // Update category relationships
      await this.updateCategoryProducts(feed.categories);

      // Update SKU counts
      await this.updateCategoryCounts();

      // Mark stale products (not in current feed)
      const currentProductIds = feed.products.map(p => p.id);
      const staleCount = await this.markStaleProducts(currentProductIds);
      results.deleted = staleCount;

      // Update sync history record
      if (syncId) {
        await this.supabase
          .from('feed_sync_history')
          .update({
            status: results.errors.length > 0 ? 'partial' : 'success',
            products_added: results.inserted,
            products_updated: results.updated,
            products_removed: results.deleted,
            products_failed: results.failed,
            completed_at: new Date().toISOString(),
            duration_ms: Date.now() - startTime,
            error_message: results.errors.length > 0 
              ? `${results.errors.length} batch errors occurred`
              : null,
            error_details: results.errors.length > 0 ? results.errors : null,
          })
          .eq('id', syncId);
      }
    } catch (error) {
      console.error('Product sync failed:', error);
      results.errors.push(error);

      // Update sync history with failure
      if (syncId) {
        await this.supabase
          .from('feed_sync_history')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            duration_ms: Date.now() - startTime,
            error_message: error instanceof Error ? error.message : 'Unknown error',
          })
          .eq('id', syncId);
      }

      throw error;
    }

    results.duration = Date.now() - startTime;
    return results;
  }

  async updateCategoryCounts(): Promise<void> {
    const { error } = await this.supabase.rpc('update_category_sku_counts');

    if (error) {
      console.error('Failed to update SKU counts:', error);
      throw new Error(`Failed to update SKU counts: ${error.message}`);
    }
  }

  async markStaleProducts(activeProductIds: string[]): Promise<number> {
    if (activeProductIds.length === 0) return 0;

    const { data, error } = await this.supabase.rpc('mark_stale_products', {
      active_product_ids: activeProductIds,
      stale_threshold: '7 days',
    });

    if (error) {
      console.error('Failed to mark stale products:', error);
      return 0;
    }

    return data || 0;
  }

  detectChanges(oldProducts: ProductData[], newProducts: ProductData[]): ProductChanges {
    const oldMap = new Map(oldProducts.map(p => [p.id, p]));
    const newMap = new Map(newProducts.map(p => [p.id, p]));

    const added: ProductData[] = [];
    const updated: ProductData[] = [];
    const removed: string[] = [];

    // Find added and updated products
    for (const [id, product] of newMap) {
      if (!oldMap.has(id)) {
        added.push(product);
      } else {
        const oldProduct = oldMap.get(id)!;
        if (this.hasProductChanged(oldProduct, product)) {
          updated.push(product);
        }
      }
    }

    // Find removed products
    for (const id of oldMap.keys()) {
      if (!newMap.has(id)) {
        removed.push(id);
      }
    }

    return {
      hasChanges: added.length > 0 || updated.length > 0 || removed.length > 0,
      added,
      updated,
      removed,
    };
  }

  private hasProductChanged(oldProduct: ProductData, newProduct: ProductData): boolean {
    // Check key fields for changes
    return (
      oldProduct.title !== newProduct.title ||
      oldProduct.description !== newProduct.description ||
      oldProduct.price?.value !== newProduct.price?.value ||
      oldProduct.salePrice?.value !== newProduct.salePrice?.value ||
      oldProduct.availability !== newProduct.availability ||
      oldProduct.imageLink !== newProduct.imageLink ||
      JSON.stringify(oldProduct.productType) !== JSON.stringify(newProduct.productType)
    );
  }

  private async updateCategoryProducts(categoryMap: Map<string, CategoryInfo>): Promise<void> {
    const relationships: Array<{ category_id: string; product_id: string }> = [];

    for (const [categoryName, categoryInfo] of categoryMap) {
      // Try to find category by path or name
      let categoryId: string | null = null;

      // First try to match by URL path
      const pathToMatch = categoryInfo.path?.join('/').toLowerCase() || categoryName.toLowerCase();
      
      const { data: categoryNode } = await this.supabase
        .from('taxonomy_nodes')
        .select('id')
        .or(`url_path.ilike.%${pathToMatch}%,title.ilike.%${categoryName}%`)
        .limit(1)
        .single();

      if (categoryNode) {
        categoryId = categoryNode.id;
      } else {
        // Create new taxonomy node if not found
        const { data: newNode, error } = await this.supabase
          .from('taxonomy_nodes')
          .insert({
            title: categoryName,
            url_path: `/${pathToMatch.replace(/\s+/g, '-')}`,
            metadata: {
              source: 'product_feed',
              auto_created: true,
            },
          })
          .select('id')
          .single();

        if (!error && newNode) {
          categoryId = newNode.id;
        }
      }

      // Add product relationships
      if (categoryId) {
        for (const productId of categoryInfo.productIds) {
          relationships.push({
            category_id: categoryId,
            product_id: productId,
          });
        }
      }
    }

    // Bulk upsert relationships
    if (relationships.length > 0) {
      // Process in batches to avoid query size limits
      const batches = this.chunkArray(relationships, 1000);
      
      for (const batch of batches) {
        const { error } = await this.supabase
          .from('category_products')
          .upsert(batch, {
            onConflict: 'category_id,product_id',
            ignoreDuplicates: true,
          });

        if (error) {
          console.error('Failed to update category products:', error);
        }
      }
    }
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  async getProductsByCategory(categoryId: string): Promise<ProductData[]> {
    const { data, error } = await this.supabase
      .from('category_products')
      .select(`
        products (*)
      `)
      .eq('category_id', categoryId);

    if (error) {
      console.error('Failed to get products by category:', error);
      return [];
    }

    return data?.map(cp => cp.products as any) || [];
  }

  async getProductStats(): Promise<{
    total: number;
    inStock: number;
    brands: number;
    categories: number;
  }> {
    const { data: stats } = await this.supabase
      .from('products')
      .select('id, availability, brand');

    const { data: categoryCount } = await this.supabase
      .from('category_products')
      .select('category_id', { count: 'exact', head: true });

    const total = stats?.length || 0;
    const inStock = stats?.filter(p => p.availability === 'in stock').length || 0;
    const brands = new Set(stats?.map(p => p.brand).filter(Boolean)).size;

    return {
      total,
      inStock,
      brands,
      categories: categoryCount?.length || 0,
    };
  }
}