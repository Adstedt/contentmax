# STORY-008: Store Products with Full Attributes

## Story Overview

**Story ID:** STORY-008  
**Epic:** EPIC-001 - Data Ingestion Pipeline  
**Sprint:** Sprint 6  
**Priority:** P1 - High  
**Estimated Effort:** 3 hours  
**Story Points:** 3  

## User Story

As a **data analyst**,  
I want **all product attributes stored in a queryable format**,  
So that **I can analyze products by any dimension (price, brand, availability, etc.)**.

## Context

Products from Google Merchant have 30+ attributes. We need a flexible schema that stores all attributes while maintaining query performance and enabling filtering/searching.

## Acceptance Criteria

### Functional Requirements
1. ✅ Store all standard product attributes
2. ✅ Support custom attributes dynamically
3. ✅ Maintain attribute history/versions
4. ✅ Enable full-text search on products
5. ✅ Support attribute-based filtering

### Technical Requirements
6. ✅ Optimize for read performance
7. ✅ Use JSONB for flexible attributes
8. ✅ Create indexes for common queries
9. ✅ Implement data validation
10. ✅ Support bulk updates

### Data Requirements
11. ✅ Preserve original attribute names
12. ✅ Handle multi-valued attributes
13. ✅ Store attribute metadata
14. ✅ Track data lineage

## Technical Implementation Notes

### Enhanced Product Schema
```sql
-- migrations/add_products_table.sql
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  google_product_id TEXT UNIQUE NOT NULL,
  category_id UUID REFERENCES taxonomy_nodes(id),
  
  -- Core attributes
  title TEXT NOT NULL,
  description TEXT,
  link TEXT,
  image_url TEXT,
  
  -- Pricing
  price DECIMAL(10,2),
  sale_price DECIMAL(10,2),
  currency VARCHAR(3),
  
  -- Availability
  availability VARCHAR(50),
  availability_date TIMESTAMP,
  expiration_date TIMESTAMP,
  
  -- Identifiers
  brand TEXT,
  gtin TEXT,
  mpn TEXT,
  condition VARCHAR(20),
  
  -- Categories
  google_category TEXT,
  product_type TEXT[],
  
  -- Attributes as JSONB
  attributes JSONB DEFAULT '{}',
  custom_labels JSONB DEFAULT '{}',
  
  -- Variants
  item_group_id TEXT,
  variant_attributes JSONB DEFAULT '{}',
  
  -- Images
  additional_images TEXT[],
  
  -- Metadata
  imported_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  source VARCHAR(50) DEFAULT 'google_merchant',
  import_job_id UUID,
  
  -- Search
  search_vector tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(brand, '')), 'C')
  ) STORED
);

-- Indexes for performance
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_brand ON products(brand);
CREATE INDEX idx_products_availability ON products(availability);
CREATE INDEX idx_products_price ON products(price);
CREATE INDEX idx_products_search ON products USING GIN(search_vector);
CREATE INDEX idx_products_attributes ON products USING GIN(attributes);
CREATE INDEX idx_products_google_id ON products(google_product_id);

-- Product attributes history
CREATE TABLE product_attribute_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  attribute_name TEXT NOT NULL,
  old_value JSONB,
  new_value JSONB,
  changed_at TIMESTAMP DEFAULT NOW(),
  change_source TEXT
);
```

### Product Repository
```typescript
// lib/repositories/product-repository.ts
import { createServerSupabaseClient } from '@/lib/supabase/server';

export class ProductRepository {
  private supabase: any;
  
  async initialize() {
    this.supabase = await createServerSupabaseClient();
  }
  
  async bulkUpsert(products: any[], jobId: string) {
    // Transform products for database
    const dbProducts = products.map(p => ({
      google_product_id: p.id,
      title: p.title,
      description: p.description,
      link: p.link,
      image_url: p.image_url,
      price: p.price,
      sale_price: p.sale_price,
      currency: p.currency,
      availability: p.availability,
      brand: p.brand,
      gtin: p.gtin,
      mpn: p.mpn,
      condition: p.condition,
      google_category: p.google_category,
      product_type: p.product_type?.split('/') || [],
      category_id: p.category_id,
      attributes: this.extractAttributes(p),
      custom_labels: p.custom_labels,
      additional_images: p.additional_images || [],
      import_job_id: jobId
    }));
    
    // Upsert in batches
    const batchSize = 100;
    for (let i = 0; i < dbProducts.length; i += batchSize) {
      const batch = dbProducts.slice(i, i + batchSize);
      
      const { error } = await this.supabase
        .from('products')
        .upsert(batch, {
          onConflict: 'google_product_id',
          ignoreDuplicates: false
        });
      
      if (error) {
        console.error('Batch upsert failed:', error);
        throw error;
      }
    }
  }
  
  private extractAttributes(product: any) {
    // Extract all non-standard attributes into JSONB
    const standardFields = [
      'id', 'title', 'description', 'price', 'brand',
      'category_id', 'google_category', 'image_url'
    ];
    
    const attributes: any = {};
    
    Object.keys(product).forEach(key => {
      if (!standardFields.includes(key)) {
        attributes[key] = product[key];
      }
    });
    
    return attributes;
  }
  
  async searchProducts(query: string, filters?: any) {
    let queryBuilder = this.supabase
      .from('products')
      .select('*')
      .textSearch('search_vector', query, {
        type: 'websearch',
        config: 'english'
      });
    
    // Apply filters
    if (filters?.brand) {
      queryBuilder = queryBuilder.eq('brand', filters.brand);
    }
    
    if (filters?.minPrice) {
      queryBuilder = queryBuilder.gte('price', filters.minPrice);
    }
    
    if (filters?.maxPrice) {
      queryBuilder = queryBuilder.lte('price', filters.maxPrice);
    }
    
    if (filters?.availability) {
      queryBuilder = queryBuilder.eq('availability', filters.availability);
    }
    
    if (filters?.category_id) {
      queryBuilder = queryBuilder.eq('category_id', filters.category_id);
    }
    
    const { data, error } = await queryBuilder.limit(100);
    
    if (error) throw error;
    return data;
  }
  
  async getProductsByCategory(categoryId: string) {
    const { data, error } = await this.supabase
      .from('products')
      .select('*')
      .eq('category_id', categoryId)
      .order('price', { ascending: true });
    
    if (error) throw error;
    return data;
  }
  
  async updateProductAttributes(productId: string, attributes: any) {
    // Get current attributes
    const { data: current } = await this.supabase
      .from('products')
      .select('attributes')
      .eq('id', productId)
      .single();
    
    // Track changes
    const changes = this.detectChanges(current.attributes, attributes);
    
    // Update product
    const { error } = await this.supabase
      .from('products')
      .update({
        attributes: { ...current.attributes, ...attributes },
        updated_at: new Date().toISOString()
      })
      .eq('id', productId);
    
    if (error) throw error;
    
    // Log attribute changes
    if (changes.length > 0) {
      await this.logAttributeChanges(productId, changes);
    }
  }
}
```

### Attribute Validation
```typescript
// lib/validation/product-validator.ts
import { z } from 'zod';

const ProductSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  price: z.number().positive().optional(),
  sale_price: z.number().positive().optional(),
  currency: z.string().length(3).optional(),
  availability: z.enum(['in stock', 'out of stock', 'preorder']),
  brand: z.string().optional(),
  gtin: z.string().regex(/^\d{8,14}$/).optional(),
  mpn: z.string().optional(),
  condition: z.enum(['new', 'refurbished', 'used']).optional(),
  attributes: z.record(z.any()).optional()
});

export function validateProduct(product: any) {
  try {
    return ProductSchema.parse(product);
  } catch (error) {
    console.error('Product validation failed:', error);
    throw new Error(`Invalid product data: ${error.message}`);
  }
}

export function validateBulkProducts(products: any[]) {
  const errors: any[] = [];
  const valid: any[] = [];
  
  products.forEach((product, index) => {
    try {
      valid.push(validateProduct(product));
    } catch (error) {
      errors.push({ index, product, error: error.message });
    }
  });
  
  return { valid, errors };
}
```

### Query Optimization
```typescript
// lib/queries/product-queries.ts
export const productQueries = {
  // Materialized view for category product counts
  createProductCountView: `
    CREATE MATERIALIZED VIEW category_product_counts AS
    SELECT 
      category_id,
      COUNT(*) as product_count,
      AVG(price) as avg_price,
      MIN(price) as min_price,
      MAX(price) as max_price,
      COUNT(DISTINCT brand) as brand_count
    FROM products
    WHERE availability = 'in stock'
    GROUP BY category_id;
    
    CREATE UNIQUE INDEX ON category_product_counts(category_id);
  `,
  
  // Function for attribute aggregation
  createAttributeAggregation: `
    CREATE OR REPLACE FUNCTION get_attribute_values(attr_name TEXT)
    RETURNS TABLE(value TEXT, count INT) AS $$
    BEGIN
      RETURN QUERY
      SELECT 
        attributes->>attr_name as value,
        COUNT(*)::INT as count
      FROM products
      WHERE attributes ? attr_name
      GROUP BY attributes->>attr_name
      ORDER BY count DESC;
    END;
    $$ LANGUAGE plpgsql;
  `
};
```

## Dependencies

- Requires STORY-007 completion (product feed parsing)
- PostgreSQL with JSONB support
- Search capabilities (tsvector)

## Testing Requirements

### Unit Tests
```typescript
describe('ProductRepository', () => {
  it('stores products with all attributes');
  it('handles bulk upserts efficiently');
  it('validates product data');
  it('searches products by text');
  it('filters by attributes');
  it('tracks attribute changes');
});
```

### Performance Tests
- Bulk insert 10,000 products
- Query performance with 100K+ products
- Search response time < 100ms
- Attribute filtering performance

### Data Integrity Tests
1. Verify all attributes preserved
2. Check data type conversions
3. Validate foreign key relationships
4. Test concurrent updates

## Definition of Done

- [ ] Product schema created with migrations
- [ ] Repository methods implemented
- [ ] Validation in place
- [ ] Search functionality working
- [ ] Attribute filtering operational
- [ ] Bulk operations optimized
- [ ] Indexes created
- [ ] Unit tests passing
- [ ] Performance benchmarks met

## Dev Agent Record

### Agent Model Used
_To be filled by implementing agent_

### Debug Log References
_To be filled during implementation_

### Completion Notes
_To be filled after implementation_

### File List
- `migrations/add_products_table.sql` (new)
- `lib/repositories/product-repository.ts` (new)
- `lib/validation/product-validator.ts` (new)
- `lib/queries/product-queries.ts` (new)

---
**Created:** 2025-01-09  
**Status:** Ready for Development  
**Assigned:** Unassigned