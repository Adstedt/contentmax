# STORY-021: Market Pricing Intelligence Integration

## Story Overview

**Story ID:** STORY-021
**Sprint:** Sprint 7
**Priority:** P1 - High
**Points:** 8
**Dependencies:** Completed product import (STORY-008)

## User Story

**As a** retailer/e-commerce manager
**I want to** see how my product prices compare to the market
**So that** I can identify pricing opportunities and optimize my category strategy

## Background

Integrate Google Shopping data to provide competitive pricing intelligence at both product and category levels, similar to specialized tools like PriceShape but integrated directly into the taxonomy visualization.

## Acceptance Criteria

### Must Have

- [ ] Fetch market prices for products with GTIN/EAN via Google Shopping API
- [ ] Calculate price position (below/at/above market) for each product
- [ ] Display pricing indicators on individual products
- [ ] Aggregate pricing insights at category level
- [ ] Show confidence scores based on match rates
- [ ] Visual indicators in taxonomy for pricing health

### Should Have

- [ ] Historical price tracking (30-day trend)
- [ ] Competitor count per product
- [ ] Price distribution visualization
- [ ] Export pricing reports by category

### Could Have

- [ ] Price optimization recommendations
- [ ] Automated alerts for pricing anomalies
- [ ] Competitor tracking by name

## Technical Approach

### 1. Google Shopping Content API Integration

```typescript
// services/google-shopping-service.ts
class GoogleShoppingService {
  async getMarketPrices(gtin: string): Promise<MarketPriceData> {
    // Use existing OAuth token from Merchant Center
    const auth = await getGoogleAuth();

    // Query Shopping Content API for price comparisons
    const response = await shoppingAPI.products.list({
      auth,
      query: `gtin:${gtin}`,
      maxResults: 50,
    });

    return calculatePriceMetrics(response.products);
  }

  async batchGetMarketPrices(gtins: string[]): Promise<Map<string, MarketPriceData>> {
    // Batch API calls with rate limiting
    // Max 50 GTINs per batch
  }
}
```

### 2. Database Schema Updates

```sql
-- Market pricing data table
CREATE TABLE product_market_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id TEXT REFERENCES products(id),
  gtin TEXT NOT NULL,
  our_price DECIMAL(10,2),
  market_min DECIMAL(10,2),
  market_max DECIMAL(10,2),
  market_median DECIMAL(10,2),
  market_average DECIMAL(10,2),
  competitor_count INTEGER,
  price_position TEXT CHECK (price_position IN ('below_market', 'at_market', 'above_market')),
  price_percentile INTEGER,
  confidence_score DECIMAL(3,2),
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id)
);

-- Category pricing insights view
CREATE VIEW category_pricing_insights AS
SELECT
  c.id as category_id,
  COUNT(DISTINCT p.id) as total_products,
  COUNT(DISTINCT CASE WHEN p.gtin IS NOT NULL THEN p.id END) as products_with_ean,
  COUNT(DISTINCT pmd.product_id) as products_with_market_data,

  -- Pricing distribution
  COUNT(CASE WHEN pmd.price_position = 'below_market' THEN 1 END) as below_market_count,
  COUNT(CASE WHEN pmd.price_position = 'at_market' THEN 1 END) as at_market_count,
  COUNT(CASE WHEN pmd.price_position = 'above_market' THEN 1 END) as above_market_count,

  -- Average position (-100 to +100)
  AVG(pmd.price_percentile - 50) * 2 as average_price_position,

  -- Confidence based on sample size
  CASE
    WHEN COUNT(pmd.product_id)::FLOAT / NULLIF(COUNT(p.id), 0) > 0.7 THEN 'high'
    WHEN COUNT(pmd.product_id)::FLOAT / NULLIF(COUNT(p.id), 0) > 0.3 THEN 'medium'
    ELSE 'low'
  END as confidence_level

FROM taxonomy_nodes c
LEFT JOIN product_categories pc ON c.id = pc.category_id
LEFT JOIN products p ON pc.product_id = p.id
LEFT JOIN product_market_data pmd ON p.id = pmd.product_id
GROUP BY c.id;
```

### 3. Processing Pipeline

```typescript
// Background job for market data collection
async function collectMarketPricing(userId: string, projectId?: string) {
  // 1. Get all products with GTIN
  const products = await getProductsWithGTIN(userId);

  // 2. Batch process in chunks of 50
  for (const batch of chunk(products, 50)) {
    const marketData = await googleShopping.batchGetMarketPrices(batch.map((p) => p.gtin));

    // 3. Calculate positions and insights
    for (const product of batch) {
      const data = marketData.get(product.gtin);
      if (data) {
        const position = calculatePricePosition(product.price, data);
        await saveMarketData(product.id, position);
      }
    }

    // 4. Rate limiting - 10 requests per second
    await sleep(5000);
  }

  // 5. Update category aggregations
  await updateCategoryInsights(userId);
}
```

### 4. Visualization Updates

```typescript
// Add to TaxonomyNode type
interface TaxonomyNode {
  // ... existing fields
  pricingInsights?: {
    position: 'below' | 'at' | 'above';
    confidence: 'high' | 'medium' | 'low';
    percentile: number;
    competitorCount: number;
  };
}

// Visual indicators in D3
const nodeColor = (d: TaxonomyNode) => {
  if (!d.pricingInsights) return defaultColor;

  const { position, confidence } = d.pricingInsights;
  const opacity = confidence === 'high' ? 1 : confidence === 'medium' ? 0.7 : 0.4;

  switch (position) {
    case 'below':
      return `rgba(34, 197, 94, ${opacity})`; // green
    case 'above':
      return `rgba(239, 68, 68, ${opacity})`; // red
    default:
      return `rgba(250, 204, 21, ${opacity})`; // yellow
  }
};
```

## Implementation Steps

1. **Setup Google Shopping API**
   - Enable Shopping Content API in Google Cloud Console
   - Add scopes to OAuth configuration
   - Test API access with sample GTIN

2. **Database Preparation**
   - Run migration for new tables
   - Create indexes on GTIN fields
   - Set up RLS policies

3. **Build Data Collection Service**
   - Implement API client with rate limiting
   - Create batch processing logic
   - Add error handling and retry logic

4. **Create Processing Pipeline**
   - Background job for initial collection
   - Scheduled updates (daily/weekly)
   - Manual refresh trigger

5. **Update Visualization**
   - Add pricing indicators to nodes
   - Create legend for pricing colors
   - Add tooltip with detailed metrics

6. **Testing**
   - Unit tests for price calculations
   - Integration tests with mock API
   - Performance tests with large datasets

## Success Metrics

- Successfully fetch market data for >70% of products with GTIN
- Display pricing position for all matched products
- Category confidence level of "high" for >50% of categories
- Processing time <5 minutes for 10,000 products
- Visual indicators clearly communicate pricing health

## Risk Mitigation

| Risk               | Mitigation                                     |
| ------------------ | ---------------------------------------------- |
| API rate limits    | Implement aggressive caching, batch processing |
| Missing GTINs      | Fall back to title matching (lower confidence) |
| Price volatility   | Show historical trends, update frequently      |
| Large data volumes | Progressive loading, pagination                |

## Effort Breakdown

- API Integration: 2 hours
- Database schema: 1 hour
- Data collection service: 2 hours
- Processing pipeline: 2 hours
- Visualization updates: 1 hour
- Testing: 1 hour

**Total: 8 story points**

## Dependencies

- Google Shopping API access
- Completed product import with GTIN data
- Existing OAuth implementation

## Notes

This feature transforms ContentMax from a visualization tool into a competitive intelligence platform, providing actionable pricing insights that directly impact revenue and margin optimization.

Similar to PriceShape but integrated into the taxonomy view, making it contextual and actionable within the product hierarchy.
