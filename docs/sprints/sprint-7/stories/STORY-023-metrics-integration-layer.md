# STORY-023: Metrics Data Integration Layer

**Status:** Ready for Development
**Sprint:** Sprint 7
**Points:** 5
**Priority:** P0 (Critical - needed before other integrations work)
**Dependencies:** Product import complete, Taxonomy built

## Story

**As a** developer
**I want to** have a robust system for matching external metrics to our taxonomy nodes and products
**So that** GSC, GA4, and market data can be accurately displayed on the correct categories and products

## Acceptance Criteria

### Must Have
1. URL matching system that maps GSC/GA4 URLs to taxonomy nodes
2. GTIN/EAN matching for product-level market data
3. Category path matching for hierarchical data
4. Data aggregation from products to parent categories
5. Confidence scoring for matches
6. Handling of unmatched data

### Should Have
7. Fuzzy matching for imperfect URLs
8. Manual mapping override capability
9. Match accuracy reporting
10. Data freshness indicators

## Tasks / Subtasks

- [ ] Build URL matching engine with multiple strategies (AC: 1, 7)
  - [ ] Create `/lib/integration/url-matcher.ts`
  - [ ] Implement exact URL matching
  - [ ] Implement path-based matching
  - [ ] Implement product ID extraction from URLs
  - [ ] Implement fuzzy matching as fallback

- [ ] Create GTIN matching system (AC: 2)
  - [ ] Create `/lib/integration/gtin-matcher.ts`
  - [ ] Build GTIN index from products
  - [ ] Implement exact GTIN/EAN matching
  - [ ] Handle GTIN format variations

- [ ] Implement category path matching (AC: 3)
  - [ ] Create `/lib/integration/category-matcher.ts`
  - [ ] Parse category paths from URLs
  - [ ] Match to taxonomy hierarchy
  - [ ] Handle path variations and aliases

- [ ] Build metrics aggregation pipeline (AC: 4)
  - [ ] Create `/lib/integration/metrics-aggregator.ts`
  - [ ] Implement bottom-up aggregation
  - [ ] Calculate weighted averages
  - [ ] Handle missing data gracefully

- [ ] Create integration database tables (AC: 5, 6)
  - [ ] Create migration `/supabase/migrations/[timestamp]_add_integrated_metrics.sql`
  - [ ] Add integrated_metrics table
  - [ ] Add unmatched_metrics table
  - [ ] Add metric_mappings table for overrides
  - [ ] Add RLS policies

- [ ] Implement confidence scoring (AC: 5)
  - [ ] Create `/lib/integration/confidence-scorer.ts`
  - [ ] Define confidence levels for each match type
  - [ ] Calculate overall match confidence
  - [ ] Store confidence with metrics

- [ ] Build manual mapping interface (AC: 8)
  - [ ] Create `/app/dashboard/metrics/mappings/page.tsx`
  - [ ] Show unmatched URLs/GTINs
  - [ ] Allow manual entity selection
  - [ ] Store manual mappings

- [ ] Create unmatched data reports (AC: 6, 9)
  - [ ] Create `/app/api/metrics/unmatched/route.ts`
  - [ ] Track unmatched data
  - [ ] Generate match accuracy reports
  - [ ] Export unmatched data for review

- [ ] Add integration status dashboard (AC: 9, 10)
  - [ ] Create `/components/metrics/IntegrationStatus.tsx`
  - [ ] Show match rates by source
  - [ ] Display data freshness
  - [ ] Show confidence distribution

- [ ] Implement incremental updates (AC: 10)
  - [ ] Create `/app/api/metrics/sync/route.ts`
  - [ ] Detect changed data
  - [ ] Update only affected metrics
  - [ ] Maintain update timestamps

- [ ] Add main integration orchestrator
  - [ ] Create `/lib/services/metrics-integrator.ts`
  - [ ] Coordinate all matching services
  - [ ] Handle errors gracefully
  - [ ] Provide detailed integration reports

- [ ] Write comprehensive tests
  - [ ] Unit tests for matchers in `/tests/unit/integration/`
  - [ ] Integration tests for aggregation
  - [ ] E2E test for full pipeline
  - [ ] Performance tests for large datasets

## Dev Notes

### Project Structure Context
Based on `/docs/architecture/source-tree.md`:
```
contentmax/
├── app/
│   ├── api/
│   │   └── metrics/
│   │       ├── integrate/
│   │       │   └── route.ts        # Main integration endpoint
│   │       ├── unmatched/
│   │       │   └── route.ts        # Unmatched data report
│   │       └── sync/
│   │           └── route.ts        # Incremental updates
│   └── dashboard/
│       └── metrics/
│           └── mappings/
│               └── page.tsx         # Manual mapping UI
├── components/
│   └── metrics/
│       └── IntegrationStatus.tsx   # Status dashboard
├── lib/
│   ├── integration/
│   │   ├── url-matcher.ts         # URL matching
│   │   ├── gtin-matcher.ts        # GTIN matching
│   │   ├── category-matcher.ts    # Category matching
│   │   ├── metrics-aggregator.ts  # Aggregation
│   │   └── confidence-scorer.ts   # Confidence scoring
│   └── services/
│       └── metrics-integrator.ts  # Main orchestrator
├── supabase/
│   └── migrations/                # Database migrations
└── tests/
    ├── unit/
    │   └── integration/           # Matcher tests
    └── integration/
        └── metrics/               # Pipeline tests
```

### The Integration Challenge

We have data from multiple sources that need to be connected:
1. **Our Data**: Taxonomy nodes + Products (with URLs and GTINs)
2. **GSC Data**: URLs with search metrics
3. **GA4 Data**: Page paths with revenue/traffic
4. **Market Data**: GTINs with competitor prices

### Integration Architecture

```typescript
// lib/integration/metrics-integrator.ts

export class MetricsIntegrator {
  private urlMatcher: UrlMatcher;
  private gtinMatcher: GtinMatcher;
  private categoryMatcher: CategoryMatcher;

  async integrateAllMetrics(userId: string) {
    // Step 1: Load our base data
    const { nodes, products } = await this.loadTaxonomyData(userId);

    // Step 2: Build mapping indices for fast lookups
    const urlIndex = this.buildUrlIndex(nodes, products);
    const gtinIndex = this.buildGtinIndex(products);
    const categoryIndex = this.buildCategoryIndex(nodes);

    // Step 3: Fetch and match external data
    const [gscData, ga4Data, marketData] = await Promise.all([
      this.fetchAndMatchGSC(urlIndex),
      this.fetchAndMatchGA4(urlIndex, categoryIndex),
      this.fetchAndMatchMarket(gtinIndex)
    ]);

    // Step 4: Aggregate metrics up the taxonomy tree
    const aggregatedMetrics = this.aggregateMetrics(
      nodes,
      products,
      { gscData, ga4Data, marketData }
    );

    // Step 5: Store integrated metrics
    await this.persistIntegratedMetrics(aggregatedMetrics);

    return {
      matchedNodes: aggregatedMetrics.length,
      unmatchedUrls: gscData.unmatched,
      confidence: this.calculateOverallConfidence(aggregatedMetrics)
    };
  }
}
```

### URL Matching Strategy

```typescript
class UrlMatcher {
  /**
   * Multi-strategy URL matching for maximum accuracy
   */
  async matchUrl(externalUrl: string, nodes: TaxonomyNode[], products: Product[]) {
    // Strategy 1: Exact URL match
    const exactMatch = this.findExactUrlMatch(externalUrl, nodes, products);
    if (exactMatch) return { ...exactMatch, confidence: 1.0 };

    // Strategy 2: Path-based match (ignore domain/params)
    const pathMatch = this.findPathMatch(externalUrl, nodes);
    if (pathMatch) return { ...pathMatch, confidence: 0.8 };

    // Strategy 3: Product ID in URL
    const productMatch = this.findProductInUrl(externalUrl, products);
    if (productMatch) return { ...productMatch, confidence: 0.9 };

    // Strategy 4: Category hierarchy match
    const categoryMatch = this.findCategoryMatch(externalUrl, nodes);
    if (categoryMatch) return { ...categoryMatch, confidence: 0.7 };

    // Strategy 5: Fuzzy match (last resort)
    const fuzzyMatch = this.fuzzyMatch(externalUrl, nodes);
    if (fuzzyMatch && fuzzyMatch.score > 0.6) {
      return { ...fuzzyMatch, confidence: fuzzyMatch.score };
    }

    return null; // No match found
  }

  private findExactUrlMatch(url: string, nodes: TaxonomyNode[], products: Product[]) {
    // Clean and normalize URL
    const normalized = this.normalizeUrl(url);

    // Check nodes
    const node = nodes.find(n => this.normalizeUrl(n.url) === normalized);
    if (node) return { type: 'node', id: node.id };

    // Check products
    const product = products.find(p => this.normalizeUrl(p.link) === normalized);
    if (product) return { type: 'product', id: product.id };

    return null;
  }

  private normalizeUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      // Remove trailing slash, www, and sort params
      return urlObj.pathname.replace(/\/$/, '').toLowerCase();
    } catch {
      return url.toLowerCase();
    }
  }
}
```

### Data Aggregation Logic

```typescript
class MetricsAggregator {
  /**
   * Aggregate metrics from products to categories (bottom-up)
   */
  aggregateToCategories(nodes: TaxonomyNode[], productMetrics: Map<string, Metrics>) {
    const nodeMetrics = new Map<string, AggregatedMetrics>();

    // Step 1: Initialize with product-level metrics
    for (const [productId, metrics] of productMetrics) {
      const categoryId = this.getProductCategory(productId);
      if (!categoryId) continue;

      if (!nodeMetrics.has(categoryId)) {
        nodeMetrics.set(categoryId, this.initMetrics());
      }

      const catMetrics = nodeMetrics.get(categoryId)!;
      this.addMetrics(catMetrics, metrics);
    }

    // Step 2: Aggregate up the tree
    const sortedNodes = this.sortNodesByDepth(nodes, 'desc'); // Bottom-up

    for (const node of sortedNodes) {
      if (!node.children?.length) continue;

      const parentMetrics = nodeMetrics.get(node.id) || this.initMetrics();

      for (const child of node.children) {
        const childMetrics = nodeMetrics.get(child.id);
        if (childMetrics) {
          this.addMetrics(parentMetrics, childMetrics);
        }
      }

      nodeMetrics.set(node.id, parentMetrics);
    }

    return nodeMetrics;
  }

  private addMetrics(target: AggregatedMetrics, source: Metrics) {
    target.clicks += source.clicks || 0;
    target.impressions += source.impressions || 0;
    target.revenue += source.revenue || 0;
    target.sessions += source.sessions || 0;
    target.productCount += 1;

    // Weighted averages
    if (source.position) {
      target.positions.push(source.position);
    }
    if (source.conversionRate) {
      target.conversionRates.push(source.conversionRate);
    }

    // Recalculate averages
    target.avgPosition = this.average(target.positions);
    target.avgConversionRate = this.weightedAverage(
      target.conversionRates,
      target.sessions
    );
  }
}
```

### Database Schema for Integration

```sql
-- Master metrics table that ties everything together
CREATE TABLE integrated_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT CHECK (entity_type IN ('node', 'product')),
  entity_id TEXT NOT NULL,

  -- Search Console metrics
  gsc_clicks INTEGER DEFAULT 0,
  gsc_impressions INTEGER DEFAULT 0,
  gsc_ctr DECIMAL(5,4) DEFAULT 0,
  gsc_position DECIMAL(4,1) DEFAULT 0,
  gsc_match_confidence DECIMAL(3,2),

  -- GA4 metrics
  ga4_sessions INTEGER DEFAULT 0,
  ga4_revenue DECIMAL(12,2) DEFAULT 0,
  ga4_transactions INTEGER DEFAULT 0,
  ga4_conversion_rate DECIMAL(5,4) DEFAULT 0,
  ga4_match_confidence DECIMAL(3,2),

  -- Market pricing metrics
  market_price_median DECIMAL(10,2),
  market_competitor_count INTEGER,
  price_position TEXT,
  market_match_confidence DECIMAL(3,2),

  -- Aggregation metadata
  is_aggregated BOOLEAN DEFAULT false,
  child_count INTEGER DEFAULT 0,

  -- Timestamps
  metrics_date DATE NOT NULL,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id),

  UNIQUE(entity_type, entity_id, metrics_date, user_id)
);

-- Unmatched data tracking
CREATE TABLE unmatched_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT CHECK (source IN ('gsc', 'ga4', 'market')),
  identifier TEXT NOT NULL, -- URL or GTIN
  metrics JSONB NOT NULL,
  attempted_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id)
);

-- Manual mapping overrides
CREATE TABLE metric_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_identifier TEXT NOT NULL,
  entity_type TEXT CHECK (entity_type IN ('node', 'product')),
  entity_id TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source_identifier, entity_type, entity_id)
);
```

### Integration Pipeline Flow

```typescript
// app/api/metrics/integrate/route.ts
export async function POST(request: Request) {
  const integrator = new MetricsIntegrator();

  // 1. Match URLs from GSC to nodes/products
  const gscMatches = await integrator.matchGSCData();
  console.log(`GSC: ${gscMatches.matched}/${gscMatches.total} URLs matched`);

  // 2. Match GA4 pages to taxonomy
  const ga4Matches = await integrator.matchGA4Data();
  console.log(`GA4: ${ga4Matches.matched}/${ga4Matches.total} pages matched`);

  // 3. Match products by GTIN for market data
  const marketMatches = await integrator.matchMarketData();
  console.log(`Market: ${marketMatches.matched}/${marketMatches.total} GTINs matched`);

  // 4. Aggregate all metrics
  const aggregated = await integrator.aggregateAllMetrics();

  // 5. Calculate opportunity scores
  const opportunities = await integrator.calculateOpportunities();

  return NextResponse.json({
    success: true,
    stats: {
      gsc: gscMatches,
      ga4: ga4Matches,
      market: marketMatches,
      aggregated: aggregated.count,
      opportunities: opportunities.length
    },
    unmatchedCount: gscMatches.unmatched + ga4Matches.unmatched
  });
}
```

### How It All Connects

1. **Products** → Have URLs and GTINs
2. **Taxonomy Nodes** → Have URLs and contain products
3. **GSC Data** → Matched by URL to nodes/products
4. **GA4 Data** → Matched by page path and product categories
5. **Market Data** → Matched by GTIN to products
6. **Aggregation** → Product metrics roll up to parent categories
7. **Visualization** → Shows aggregated metrics at each node level

### Match Confidence Scoring

```typescript
interface MatchConfidence {
  exact: 1.0;        // Perfect URL/GTIN match
  pathMatch: 0.8;    // URL path matches
  categoryMatch: 0.7; // Category hierarchy matches
  fuzzyMatch: 0.6;   // Similarity-based match
  noMatch: 0.0;      // No match found
}
```

### Configuration Requirements
- Products must have URLs imported from feed
- Products should have GTINs where available
- Taxonomy must be built before integration
- External APIs (GSC, GA4, Market) must be configured

### Error Handling Strategy
- Failed matches: Store in unmatched_metrics table
- API failures: Retry with exponential backoff
- Data inconsistencies: Log and continue with partial data
- Aggregation errors: Skip node and log issue

## Testing

### Testing Standards (from `/docs/architecture/coding-standards.md`)
- Test framework: Vitest for unit/integration tests
- Test coverage: Minimum 80% for new code
- Mock external APIs for unit tests
- Use real sample data for integration tests

### Test Scenarios
1. **URL Matching Tests**
   - Exact URL matches correctly
   - Path-based matching works
   - Product IDs extracted from URLs
   - Fuzzy matching with threshold

2. **GTIN Matching Tests**
   - Valid GTINs match products
   - Handle GTIN format variations
   - Invalid GTINs rejected
   - Missing GTINs handled

3. **Aggregation Tests**
   - Metrics sum correctly
   - Weighted averages accurate
   - Tree traversal correct
   - Missing data handled

4. **Integration Tests**
   - Full pipeline execution
   - Match confidence scoring
   - Unmatched data tracking
   - Performance with 10K+ products

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2025-01-16 | 1.0 | Initial story creation | Sarah (PO) |
| 2025-01-16 | 1.1 | Updated to Ready for Development status | Sarah (PO) |

## Dev Agent Record

**Agent Model Used:** claude-3-5-sonnet-20241022

**Debug Log References:**
- [ ] URL matching accuracy >85%
- [ ] GTIN matching 100% for valid GTINs
- [ ] Aggregation calculations correct
- [ ] Performance <30s for full integration

**Completion Notes:**
-

**File List:**
-

**QA Results**
-