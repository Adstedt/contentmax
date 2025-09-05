# STORY-007: Parse Google Product Feed

## Story Overview

**Story ID:** STORY-007  
**Epic:** EPIC-001 - Data Ingestion Pipeline  
**Sprint:** Sprint 6  
**Priority:** P1 - High  
**Estimated Effort:** 4 hours  
**Story Points:** 5  

## User Story

As a **merchant**,  
I want **my Google Merchant product feed parsed and imported**,  
So that **all my products appear in the taxonomy visualization with full details**.

## Context

Google Merchant Center provides structured product data in XML format including titles, descriptions, prices, images, categories, and custom attributes. This is the richest data source for e-commerce products.

## Acceptance Criteria

### Functional Requirements
1. ✅ Fetch product feed from Google Merchant API
2. ✅ Parse XML feed structure correctly
3. ✅ Extract all product attributes
4. ✅ Map Google product categories to taxonomy
5. ✅ Handle feed pagination for large catalogs

### Technical Requirements
6. ✅ Support both XML and TSV formats
7. ✅ Stream processing for large feeds
8. ✅ Batch database inserts
9. ✅ Handle malformed data gracefully
10. ✅ Progress tracking during import

### Data Requirements
11. ✅ Preserve all product attributes
12. ✅ Store product images securely
13. ✅ Maintain Google product IDs
14. ✅ Track import timestamps

## Technical Implementation Notes

### Product Feed Fetcher
```typescript
// lib/integrations/google/merchant-feed.ts
import { google } from 'googleapis';
import { GoogleTokenManager } from './token-manager';

export class MerchantFeedProcessor {
  private content: any;
  private tokenManager: GoogleTokenManager;
  
  constructor() {
    this.tokenManager = new GoogleTokenManager();
  }
  
  async fetchProductFeed(userId: string, merchantId: string) {
    const tokens = await this.tokenManager.getValidTokens(userId);
    
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials(tokens);
    
    this.content = google.content({ 
      version: 'v2.1', 
      auth: oauth2Client 
    });
    
    const products = [];
    let pageToken = null;
    
    do {
      const response = await this.content.products.list({
        merchantId: merchantId,
        maxResults: 250,
        pageToken: pageToken
      });
      
      products.push(...response.data.resources || []);
      pageToken = response.data.nextPageToken;
      
      // Emit progress
      await this.updateProgress(userId, products.length);
      
    } while (pageToken);
    
    return products;
  }
  
  async processProducts(products: any[], userId: string) {
    const processedProducts = [];
    
    for (const product of products) {
      const processed = this.transformProduct(product);
      processedProducts.push(processed);
      
      // Batch insert every 100 products
      if (processedProducts.length >= 100) {
        await this.batchInsertProducts(processedProducts);
        processedProducts.length = 0;
      }
    }
    
    // Insert remaining products
    if (processedProducts.length > 0) {
      await this.batchInsertProducts(processedProducts);
    }
  }
  
  private transformProduct(googleProduct: any) {
    return {
      id: googleProduct.id,
      title: googleProduct.title,
      description: googleProduct.description,
      price: this.extractPrice(googleProduct.price),
      sale_price: this.extractPrice(googleProduct.salePrice),
      currency: googleProduct.price?.currency,
      availability: googleProduct.availability,
      condition: googleProduct.condition,
      brand: googleProduct.brand,
      gtin: googleProduct.gtin,
      mpn: googleProduct.mpn,
      image_url: googleProduct.imageLink,
      additional_images: googleProduct.additionalImageLinks,
      product_type: googleProduct.productType,
      google_category: googleProduct.googleProductCategory,
      custom_attributes: this.extractCustomAttributes(googleProduct),
      link: googleProduct.link,
      mobile_link: googleProduct.mobileLink,
      sizes: googleProduct.sizes,
      color: googleProduct.color,
      material: googleProduct.material,
      pattern: googleProduct.pattern,
      age_group: googleProduct.ageGroup,
      gender: googleProduct.gender,
      shipping: googleProduct.shipping,
      tax: googleProduct.taxes,
      custom_labels: {
        label_0: googleProduct.customLabel0,
        label_1: googleProduct.customLabel1,
        label_2: googleProduct.customLabel2,
        label_3: googleProduct.customLabel3,
        label_4: googleProduct.customLabel4
      }
    };
  }
  
  private extractPrice(priceObj: any): number {
    if (!priceObj) return null;
    return parseFloat(priceObj.value);
  }
  
  private extractCustomAttributes(product: any) {
    const customAttrs: any = {};
    
    // Extract any additional attributes
    Object.keys(product).forEach(key => {
      if (key.startsWith('customAttribute')) {
        customAttrs[key] = product[key];
      }
    });
    
    return customAttrs;
  }
}
```

### Category Mapping Service
```typescript
// lib/integrations/google/category-mapper.ts
export class GoogleCategoryMapper {
  private categoryMap: Map<string, string>;
  
  constructor() {
    this.loadCategoryMappings();
  }
  
  async mapToTaxonomy(googleCategory: string, productType: string) {
    // Try exact match first
    if (this.categoryMap.has(googleCategory)) {
      return this.categoryMap.get(googleCategory);
    }
    
    // Parse Google category hierarchy
    // "Apparel & Accessories > Clothing > Shirts & Tops"
    const segments = googleCategory.split('>').map(s => s.trim());
    
    // Try to match with product_type or create new category
    const taxonomyPath = productType || segments.join('/');
    
    return this.findOrCreateCategory(taxonomyPath);
  }
  
  private async findOrCreateCategory(path: string) {
    const segments = path.split('/').filter(Boolean);
    let parentId = null;
    let fullPath = '';
    
    for (const segment of segments) {
      fullPath = fullPath ? `${fullPath}/${segment}` : segment;
      
      // Check if category exists
      let category = await this.findCategoryByPath(fullPath);
      
      if (!category) {
        // Create new category
        category = await this.createCategory({
          title: segment,
          parent_id: parentId,
          path: fullPath,
          source: 'google_merchant'
        });
      }
      
      parentId = category.id;
    }
    
    return parentId; // Return leaf category ID
  }
}
```

### API Endpoint
```typescript
// app/api/import/google-merchant/route.ts
export async function POST(request: NextRequest) {
  const { merchantId } = await request.json();
  const session = await requireAuth(request);
  
  try {
    const processor = new MerchantFeedProcessor();
    const mapper = new GoogleCategoryMapper();
    
    // Fetch products
    const products = await processor.fetchProductFeed(
      session.user.id, 
      merchantId
    );
    
    // Map categories and process products
    for (const product of products) {
      const categoryId = await mapper.mapToTaxonomy(
        product.google_category,
        product.product_type
      );
      
      product.category_id = categoryId;
    }
    
    // Store in database
    await processor.processProducts(products, session.user.id);
    
    return NextResponse.json({
      success: true,
      stats: {
        productsImported: products.length,
        categoriesCreated: mapper.getNewCategoriesCount()
      }
    });
  } catch (error) {
    console.error('Import failed:', error);
    return NextResponse.json(
      { error: 'Failed to import products' },
      { status: 500 }
    );
  }
}
```

### Progress Tracking
```typescript
// lib/jobs/import-progress.ts
export class ImportProgress {
  async updateProgress(jobId: string, current: number, total?: number) {
    await supabase
      .from('import_jobs')
      .update({
        current_count: current,
        total_count: total,
        status: current === total ? 'completed' : 'processing',
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId);
  }
  
  async createJob(userId: string, type: string) {
    const { data } = await supabase
      .from('import_jobs')
      .insert({
        user_id: userId,
        type: type,
        status: 'pending',
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    
    return data;
  }
}
```

## Dependencies

- Requires STORY-006 completion (OAuth flow)
- Google Content API v2.1
- Database schema for products table

## Testing Requirements

### Unit Tests
```typescript
describe('MerchantFeedProcessor', () => {
  it('fetches products from Google API');
  it('handles pagination correctly');
  it('transforms product data accurately');
  it('batches database inserts');
  it('handles API errors gracefully');
  it('maps categories correctly');
});
```

### Integration Tests
- Test with real merchant account
- Verify large feed handling (10,000+ products)
- Test category creation and mapping
- Validate data completeness

### Test Data
- Sample product feed XML
- Various category formats
- Edge cases (missing fields, special characters)

## Definition of Done

- [ ] Product feed fetching working
- [ ] XML/TSV parsing implemented
- [ ] Category mapping functional
- [ ] Batch processing optimized
- [ ] Progress tracking working
- [ ] Error handling comprehensive
- [ ] Unit tests passing
- [ ] Integration test with real feed
- [ ] Performance acceptable for 10K+ products

## Dev Agent Record

### Agent Model Used
_To be filled by implementing agent_

### Debug Log References
_To be filled during implementation_

### Completion Notes
_To be filled after implementation_

### File List
- `lib/integrations/google/merchant-feed.ts` (new)
- `lib/integrations/google/category-mapper.ts` (new)
- `app/api/import/google-merchant/route.ts` (new)
- `lib/jobs/import-progress.ts` (new)

---
**Created:** 2025-01-09  
**Status:** Ready for Development  
**Assigned:** Unassigned