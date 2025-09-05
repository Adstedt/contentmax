# STORY-009: Display Product Cards with Real Data

## Story Overview

**Story ID:** STORY-009  
**Epic:** EPIC-001 - Data Ingestion Pipeline  
**Sprint:** Sprint 6  
**Priority:** P1 - High  
**Estimated Effort:** 3 hours  
**Story Points:** 3  

## User Story

As a **category manager**,  
I want **to see actual product cards with images and prices when clicking on categories**,  
So that **I can view and analyze the real products in each category**.

## Context

The visualization currently shows placeholder product cards. This story connects the product cards to the database to display real product data including images, prices, availability, and key attributes.

## Acceptance Criteria

### Functional Requirements
1. ✅ Product cards show real product images
2. ✅ Display actual prices and sale prices
3. ✅ Show product availability status
4. ✅ Display brand and key attributes
5. ✅ Link to actual product pages

### UI Requirements
6. ✅ Images load efficiently with lazy loading
7. ✅ Graceful fallback for missing images
8. ✅ Price formatting with currency
9. ✅ Sale price styling when applicable
10. ✅ Responsive card layout

### Performance Requirements
11. ✅ Cards load within 500ms of click
12. ✅ Image optimization for thumbnails
13. ✅ Pagination for categories with many products
14. ✅ Caching for frequently viewed products

## Technical Implementation Notes

### Update Product Card Component
```typescript
// components/taxonomy/ProductCard.tsx
import Image from 'next/image';
import { formatPrice } from '@/lib/utils/format';
import { Product } from '@/types/product';

interface ProductCardProps {
  product: Product;
  onClose?: () => void;
}

export function ProductCard({ product, onClose }: ProductCardProps) {
  const hasDiscount = product.sale_price && product.sale_price < product.price;
  const discountPercentage = hasDiscount 
    ? Math.round((1 - product.sale_price / product.price) * 100)
    : 0;
  
  return (
    <div className="bg-white rounded-lg shadow-lg p-4 w-80">
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
      >
        <XIcon className="w-5 h-5" />
      </button>
      
      {/* Product Image */}
      <div className="relative h-48 mb-4">
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt={product.title}
            fill
            className="object-contain"
            sizes="(max-width: 320px) 100vw, 320px"
            loading="lazy"
            onError={(e) => {
              e.currentTarget.src = '/placeholder-product.png';
            }}
          />
        ) : (
          <div className="w-full h-full bg-gray-200 flex items-center justify-center">
            <PackageIcon className="w-12 h-12 text-gray-400" />
          </div>
        )}
        
        {/* Discount Badge */}
        {hasDiscount && (
          <div className="absolute top-2 left-2 bg-red-500 text-white px-2 py-1 rounded">
            -{discountPercentage}%
          </div>
        )}
        
        {/* Availability Badge */}
        <div className={`absolute top-2 right-2 px-2 py-1 rounded text-xs ${
          product.availability === 'in stock' 
            ? 'bg-green-100 text-green-800' 
            : 'bg-gray-100 text-gray-800'
        }`}>
          {product.availability}
        </div>
      </div>
      
      {/* Product Details */}
      <div className="space-y-2">
        {/* Brand */}
        {product.brand && (
          <p className="text-xs text-gray-500 uppercase">{product.brand}</p>
        )}
        
        {/* Title */}
        <h3 className="font-semibold text-sm line-clamp-2">
          {product.title}
        </h3>
        
        {/* Price */}
        <div className="flex items-baseline gap-2">
          {hasDiscount ? (
            <>
              <span className="text-lg font-bold text-red-600">
                {formatPrice(product.sale_price, product.currency)}
              </span>
              <span className="text-sm text-gray-500 line-through">
                {formatPrice(product.price, product.currency)}
              </span>
            </>
          ) : (
            <span className="text-lg font-bold">
              {formatPrice(product.price, product.currency)}
            </span>
          )}
        </div>
        
        {/* Key Attributes */}
        <div className="flex flex-wrap gap-1">
          {product.gtin && (
            <span className="text-xs bg-gray-100 px-2 py-1 rounded">
              GTIN: {product.gtin}
            </span>
          )}
          {product.mpn && (
            <span className="text-xs bg-gray-100 px-2 py-1 rounded">
              MPN: {product.mpn}
            </span>
          )}
          {product.condition && product.condition !== 'new' && (
            <span className="text-xs bg-yellow-100 px-2 py-1 rounded">
              {product.condition}
            </span>
          )}
        </div>
        
        {/* View Product Link */}
        <a
          href={product.link}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800 mt-2"
        >
          View Product
          <ExternalLinkIcon className="w-4 h-4 ml-1" />
        </a>
      </div>
    </div>
  );
}
```

### API Endpoint for Category Products
```typescript
// app/api/categories/[categoryId]/products/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { ProductRepository } from '@/lib/repositories/product-repository';

export async function GET(
  request: NextRequest,
  { params }: { params: { categoryId: string } }
) {
  const searchParams = request.nextUrl.searchParams;
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '20');
  const sort = searchParams.get('sort') || 'relevance';
  
  try {
    const repository = new ProductRepository();
    await repository.initialize();
    
    // Get products for category
    const products = await repository.getProductsByCategory(
      params.categoryId,
      {
        page,
        limit,
        sort
      }
    );
    
    // Get category info
    const category = await repository.getCategoryInfo(params.categoryId);
    
    return NextResponse.json({
      category,
      products,
      pagination: {
        page,
        limit,
        total: products.total,
        hasMore: page * limit < products.total
      }
    });
  } catch (error) {
    console.error('Failed to fetch products:', error);
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    );
  }
}
```

### Integration with D3 Visualization
```typescript
// components/taxonomy/D3Visualization/nodeInteractions.ts
export function setupNodeInteractions(nodes: any, svg: any) {
  nodes.on('click', async (event: any, d: any) => {
    event.stopPropagation();
    
    // Check if this is a leaf node with products
    if (d.data.product_count > 0) {
      await showProductsForNode(d);
    }
  });
}

async function showProductsForNode(node: any) {
  const container = document.getElementById('product-cards-container');
  if (!container) return;
  
  // Show loading state
  container.innerHTML = '<div class="loading">Loading products...</div>';
  container.classList.add('visible');
  
  try {
    // Fetch products for this category
    const response = await fetch(`/api/categories/${node.data.id}/products`);
    const data = await response.json();
    
    // Render product cards
    renderProductCards(container, data.products);
  } catch (error) {
    console.error('Failed to load products:', error);
    container.innerHTML = '<div class="error">Failed to load products</div>';
  }
}

function renderProductCards(container: HTMLElement, products: Product[]) {
  const cards = products.map(product => `
    <div class="product-card" data-product-id="${product.id}">
      ${renderProductCard(product)}
    </div>
  `).join('');
  
  container.innerHTML = `
    <div class="product-cards-grid">
      ${cards}
    </div>
  `;
  
  // Attach event listeners
  attachProductCardListeners(container);
}
```

### Image Optimization
```typescript
// next.config.js
module.exports = {
  images: {
    domains: [
      'storage.googleapis.com', // Google Storage
      'cdn.shopify.com',        // Shopify CDN
      'images-na.ssl-images-amazon.com', // Amazon
      // Add other domains as needed
    ],
    deviceSizes: [320, 640, 750, 828, 1080, 1200],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
    formats: ['image/webp'],
  },
  // Image optimization API
  async rewrites() {
    return [
      {
        source: '/api/image-proxy/:path*',
        destination: '/api/optimize-image/:path*',
      },
    ];
  },
};
```

### Caching Strategy
```typescript
// lib/cache/product-cache.ts
import { LRUCache } from 'lru-cache';

const productCache = new LRUCache<string, any>({
  max: 500, // Maximum 500 products in cache
  ttl: 1000 * 60 * 5, // 5 minutes TTL
});

export async function getCachedProducts(categoryId: string) {
  const cacheKey = `products:${categoryId}`;
  
  // Check cache first
  const cached = productCache.get(cacheKey);
  if (cached) return cached;
  
  // Fetch from database
  const products = await fetchProductsFromDB(categoryId);
  
  // Store in cache
  productCache.set(cacheKey, products);
  
  return products;
}

export function invalidateProductCache(categoryId?: string) {
  if (categoryId) {
    productCache.delete(`products:${categoryId}`);
  } else {
    productCache.clear();
  }
}
```

## Dependencies

- Requires STORY-008 completion (products in database)
- Next.js Image component for optimization
- Product data available in database

## Testing Requirements

### Unit Tests
```typescript
describe('ProductCard', () => {
  it('displays product information correctly');
  it('handles missing images gracefully');
  it('formats prices with currency');
  it('shows discount badge when applicable');
  it('displays availability status');
  it('links to product page');
});
```

### Integration Tests
- Click on category node loads products
- Product cards display real data
- Images load correctly
- Pagination works for large categories
- Cache improves performance

### Visual Tests
1. Product card layout responsive
2. Image aspect ratios maintained
3. Text truncation for long titles
4. Price formatting consistent
5. Badges positioned correctly

## Definition of Done

- [ ] Product cards show real data
- [ ] Images load with optimization
- [ ] Prices formatted correctly
- [ ] Availability status displayed
- [ ] Links to product pages work
- [ ] Performance under 500ms
- [ ] Caching implemented
- [ ] Unit tests passing
- [ ] Visual regression tests pass

## Dev Agent Record

### Agent Model Used
_To be filled by implementing agent_

### Debug Log References
_To be filled during implementation_

### Completion Notes
_To be filled after implementation_

### File List
- `components/taxonomy/ProductCard.tsx` (modified)
- `app/api/categories/[categoryId]/products/route.ts` (new)
- `components/taxonomy/D3Visualization/nodeInteractions.ts` (modified)
- `lib/cache/product-cache.ts` (new)

---
**Created:** 2025-01-09  
**Status:** Ready for Development  
**Assigned:** Unassigned