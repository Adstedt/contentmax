# Story 2.8: Google Product Feed Integration

## User Story

As a content manager,
I want to automatically import and sync product data from Google Merchant Center feeds,
So that I can see accurate SKU counts, product relationships, and enrich content with real product data.

## Size & Priority

- **Size**: L (8 hours)
- **Priority**: P0 - Critical
- **Sprint**: 2
- **Dependencies**: Story 2.2 (Sitemap Parser), Story 2.5 (Data Processing)

## Description

Integrate Google Merchant Center product feeds to provide essential e-commerce data including SKU counts per category, product-to-category mappings, pricing, inventory status, and product attributes. This data is critical for accurate taxonomy visualization sizing, content prioritization, and dynamic content generation.

## Implementation Steps

1. **Google Merchant Center API setup**

   ```typescript
   // lib/integrations/google-merchant.ts
   import { google } from 'googleapis';
   import { OAuth2Client } from 'google-auth-library';

   interface MerchantConfig {
     merchantId: string;
     accountId: string;
     credentials: OAuth2Credentials;
     feedSettings: FeedSettings;
   }

   interface FeedSettings {
     primaryFeedId: string;
     supplementalFeeds?: string[];
     updateFrequency: 'hourly' | 'daily' | 'weekly';
     deltaSync: boolean;
   }

   class GoogleMerchantClient {
     private client: any;
     private oauth2Client: OAuth2Client;

     constructor(config: MerchantConfig) {
       this.oauth2Client = new OAuth2Client(
         process.env.GOOGLE_CLIENT_ID,
         process.env.GOOGLE_CLIENT_SECRET,
         process.env.GOOGLE_REDIRECT_URI
       );
     }

     async authenticate(refreshToken: string): Promise<void> {
       this.oauth2Client.setCredentials({
         refresh_token: refreshToken,
       });

       this.client = google.content({
         version: 'v2.1',
         auth: this.oauth2Client,
       });
     }

     async getProductFeed(feedId: string): Promise<ProductFeed> {
       const response = await this.client.products.list({
         merchantId: this.config.merchantId,
         maxResults: 250,
       });

       return this.processFeedResponse(response.data);
     }
   }
   ```

2. **Product feed parser**

   ```typescript
   // lib/parsers/product-feed-parser.ts
   interface ProductData {
     id: string;
     title: string;
     description: string;
     link: string;
     imageLink: string;
     additionalImageLinks?: string[];
     price: {
       value: number;
       currency: string;
     };
     salePrice?: {
       value: number;
       currency: string;
     };
     availability: 'in stock' | 'out of stock' | 'preorder' | 'backorder';
     brand: string;
     gtin?: string;
     mpn?: string;
     productType?: string[]; // Category hierarchy from merchant
     googleProductCategory?: string;
     customAttributes?: Record<string, any>;
   }

   class ProductFeedParser {
     private products: Map<string, ProductData> = new Map();
     private categoryMap: Map<string, Set<string>> = new Map();

     async parseFeed(feedData: any, format: 'xml' | 'json'): Promise<ParsedFeed> {
       if (format === 'xml') {
         return this.parseXMLFeed(feedData);
       }
       return this.parseJSONFeed(feedData);
     }

     private parseXMLFeed(xmlData: string): ParsedFeed {
       const parser = new XMLParser({
         ignoreAttributes: false,
         attributeNamePrefix: '@_',
       });

       const parsed = parser.parse(xmlData);
       const products = parsed.rss?.channel?.item || [];

       return this.processProducts(products);
     }

     private processProducts(products: any[]): ParsedFeed {
       const processed: ProductData[] = [];

       for (const product of products) {
         const productData = this.normalizeProduct(product);
         processed.push(productData);

         // Map to categories
         this.mapProductToCategories(productData);
       }

       return {
         products: processed,
         totalCount: processed.length,
         categories: this.buildCategoryHierarchy(),
       };
     }

     private mapProductToCategories(product: ProductData): void {
       // Extract category from URL pattern
       const urlCategory = this.extractCategoryFromUrl(product.link);

       // Use product type hierarchy
       const productTypes = product.productType || [];

       // Combine all category signals
       const categories = [...productTypes, urlCategory].filter(Boolean);

       categories.forEach((category) => {
         if (!this.categoryMap.has(category)) {
           this.categoryMap.set(category, new Set());
         }
         this.categoryMap.get(category)!.add(product.id);
       });
     }
   }
   ```

3. **Product data storage and synchronization**

   ```typescript
   // lib/services/product-sync-service.ts
   interface ProductSyncService {
     syncProducts(feed: ParsedFeed): Promise<SyncResult>;
     updateCategoryCounts(): Promise<void>;
     detectChanges(oldProducts: ProductData[], newProducts: ProductData[]): ProductChanges;
   }

   class ProductSyncServiceImpl implements ProductSyncService {
     constructor(private supabase: SupabaseClient) {}

     async syncProducts(feed: ParsedFeed): Promise<SyncResult> {
       const startTime = Date.now();
       const results = {
         inserted: 0,
         updated: 0,
         deleted: 0,
         errors: [],
       };

       try {
         // Upsert products in batches
         const batches = this.chunkArray(feed.products, 500);

         for (const batch of batches) {
           const { error } = await this.supabase.from('products').upsert(
             batch.map((p) => ({
               id: p.id,
               title: p.title,
               description: p.description,
               url: p.link,
               price: p.price.value,
               currency: p.price.currency,
               sale_price: p.salePrice?.value,
               availability: p.availability,
               brand: p.brand,
               image_url: p.imageLink,
               additional_images: p.additionalImageLinks,
               gtin: p.gtin,
               mpn: p.mpn,
               product_type: p.productType,
               google_category: p.googleProductCategory,
               custom_attributes: p.customAttributes,
               last_updated: new Date().toISOString(),
             })),
             { onConflict: 'id' }
           );

           if (error) {
             results.errors.push(error);
           } else {
             results.inserted += batch.length;
           }
         }

         // Update category relationships
         await this.updateCategoryProducts(feed.categories);

         // Calculate SKU counts
         await this.updateCategoryCounts();

         // Mark stale products
         await this.markStaleProducts(feed.products.map((p) => p.id));
       } catch (error) {
         console.error('Product sync failed:', error);
         throw error;
       }

       return {
         ...results,
         duration: Date.now() - startTime,
       };
     }

     async updateCategoryCounts(): Promise<void> {
       // Update SKU counts using database function
       const { error } = await this.supabase.rpc('update_category_sku_counts');

       if (error) {
         throw new Error(`Failed to update SKU counts: ${error.message}`);
       }
     }

     private async updateCategoryProducts(categoryMap: Map<string, Set<string>>): Promise<void> {
       const relationships = [];

       for (const [category, productIds] of categoryMap.entries()) {
         // Find or create category node
         const { data: categoryNode } = await this.supabase
           .from('taxonomy_nodes')
           .select('id')
           .eq('url_path', category)
           .single();

         if (categoryNode) {
           for (const productId of productIds) {
             relationships.push({
               category_id: categoryNode.id,
               product_id: productId,
             });
           }
         }
       }

       // Bulk insert relationships
       if (relationships.length > 0) {
         await this.supabase
           .from('category_products')
           .upsert(relationships, { onConflict: 'category_id,product_id' });
       }
     }
   }
   ```

4. **Feed scheduling and monitoring**

   ```typescript
   // lib/jobs/product-feed-job.ts
   interface FeedScheduler {
     schedule(feedId: string, frequency: string): void;
     pause(feedId: string): void;
     getStatus(feedId: string): FeedStatus;
   }

   class ProductFeedJob {
     private isRunning = false;
     private lastSync: Date | null = null;

     async run(config: FeedConfig): Promise<void> {
       if (this.isRunning) {
         console.log('Feed sync already in progress');
         return;
       }

       this.isRunning = true;

       try {
         // Record sync start
         await this.recordSyncStart(config.feedId);

         // Fetch feed
         const merchantClient = new GoogleMerchantClient(config);
         const feed = await merchantClient.getProductFeed(config.feedId);

         // Parse feed
         const parser = new ProductFeedParser();
         const parsed = await parser.parseFeed(feed, config.format);

         // Check for changes (delta sync)
         if (config.deltaSync && this.lastSync) {
           const changes = await this.detectChanges(parsed);
           if (changes.hasChanges) {
             await this.syncChanges(changes);
           }
         } else {
           // Full sync
           const syncService = new ProductSyncServiceImpl(supabase);
           await syncService.syncProducts(parsed);
         }

         // Update taxonomy with new SKU counts
         await this.updateTaxonomyMetrics();

         // Record successful sync
         await this.recordSyncSuccess(config.feedId, parsed);

         this.lastSync = new Date();
       } catch (error) {
         console.error('Product feed sync failed:', error);
         await this.recordSyncError(config.feedId, error);
         throw error;
       } finally {
         this.isRunning = false;
       }
     }

     private async updateTaxonomyMetrics(): Promise<void> {
       // Trigger recalculation of all taxonomy metrics
       await supabase.rpc('recalculate_taxonomy_metrics', {
         include_sku_counts: true,
         include_revenue: true,
         include_availability: true,
       });
     }
   }
   ```

5. **Database schema for products**

   ```sql
   -- Products table
   CREATE TABLE products (
     id TEXT PRIMARY KEY,
     title TEXT NOT NULL,
     description TEXT,
     url TEXT NOT NULL,
     price DECIMAL(10, 2),
     currency VARCHAR(3),
     sale_price DECIMAL(10, 2),
     availability VARCHAR(20),
     brand TEXT,
     image_url TEXT,
     additional_images JSONB,
     gtin TEXT,
     mpn TEXT,
     product_type TEXT[],
     google_category TEXT,
     custom_attributes JSONB,
     last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );

   -- Category-Product relationship
   CREATE TABLE category_products (
     category_id UUID REFERENCES taxonomy_nodes(id) ON DELETE CASCADE,
     product_id TEXT REFERENCES products(id) ON DELETE CASCADE,
     position INTEGER,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     PRIMARY KEY (category_id, product_id)
   );

   -- Feed sync history
   CREATE TABLE feed_sync_history (
     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
     feed_id TEXT NOT NULL,
     sync_type VARCHAR(20), -- 'full' or 'delta'
     status VARCHAR(20), -- 'running', 'success', 'failed'
     products_processed INTEGER,
     products_added INTEGER,
     products_updated INTEGER,
     products_removed INTEGER,
     error_message TEXT,
     started_at TIMESTAMP WITH TIME ZONE,
     completed_at TIMESTAMP WITH TIME ZONE,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );

   -- Function to update SKU counts
   CREATE OR REPLACE FUNCTION update_category_sku_counts()
   RETURNS void AS $$
   BEGIN
     UPDATE taxonomy_nodes tn
     SET metadata = jsonb_set(
       COALESCE(metadata, '{}'::jsonb),
       '{sku_count}',
       to_jsonb(sub.count)
     )
     FROM (
       SELECT
         category_id,
         COUNT(DISTINCT product_id) as count
       FROM category_products cp
       JOIN products p ON cp.product_id = p.id
       WHERE p.availability = 'in stock'
       GROUP BY category_id
     ) sub
     WHERE tn.id = sub.category_id;
   END;
   $$ LANGUAGE plpgsql;

   -- Index for performance
   CREATE INDEX idx_products_brand ON products(brand);
   CREATE INDEX idx_products_availability ON products(availability);
   CREATE INDEX idx_products_url ON products(url);
   CREATE INDEX idx_category_products_category ON category_products(category_id);
   CREATE INDEX idx_category_products_product ON category_products(product_id);
   ```

## Acceptance Criteria

1. ✅ Google Merchant Center OAuth2 authentication working
2. ✅ Support for both XML and JSON feed formats
3. ✅ Products stored in database with all relevant attributes
4. ✅ Category-to-product relationships established
5. ✅ SKU counts automatically calculated per taxonomy node
6. ✅ Delta sync to only update changed products
7. ✅ Feed sync history tracked with success/error logging
8. ✅ Support for multiple feeds (multi-region/language)
9. ✅ Automatic brand extraction and normalization
10. ✅ Performance handling for 100,000+ products

## UI Components

1. **Feed Configuration Screen**
   - Merchant ID input
   - OAuth2 connection flow
   - Feed selection dropdown
   - Sync frequency settings
   - Delta sync toggle

2. **Feed Status Dashboard**
   - Last sync timestamp
   - Products processed count
   - Success/error status
   - Sync history table
   - Manual sync trigger button

3. **Product Data Preview**
   - Sample products table
   - Category mapping visualization
   - SKU count per category display
   - Brand distribution chart

## Integration Points

- **Story 2.2 (Sitemap Parser)**: Combines URL structure with product categories
- **Story 2.5 (Data Processing)**: Provides SKU counts for taxonomy building
- **Story 3.1 (D3 Visualization)**: Node sizing based on actual SKU counts
- **Story 4.4 (Content Generation)**: Product data for dynamic content insertion

## Technical Considerations

1. **Rate Limiting**: Google Merchant API has quotas - implement exponential backoff
2. **Large Feeds**: Stream parsing for feeds over 10MB
3. **Memory Management**: Process products in batches to avoid memory issues
4. **Sync Timing**: Schedule during low-traffic periods
5. **Data Consistency**: Use database transactions for atomic updates
6. **Multi-tenant**: Support multiple merchant accounts per instance

## Error Handling

1. **Authentication Errors**: Prompt for re-authentication
2. **Feed Format Errors**: Validate and provide detailed error messages
3. **Partial Failures**: Continue processing valid products, log errors
4. **Network Timeouts**: Implement retry with exponential backoff
5. **Data Conflicts**: Resolution strategy for product duplicates

## Success Metrics

- Feed sync completion rate > 95%
- Average sync time < 5 minutes for 10,000 products
- SKU count accuracy > 99%
- Delta sync reduces processing by > 80%
- Zero data loss during sync failures

## Dev Agent Record

### Status: Not Started

### Implementation Notes:

This story fills a critical gap in the data ingestion pipeline, providing the essential product data that drives:

- Accurate taxonomy node sizing (SKU counts)
- Content prioritization algorithms
- Dynamic product information in generated content
- Brand page organization
- Inventory-aware content generation

The integration should be implemented early in Sprint 2 as other stories depend on this data.
