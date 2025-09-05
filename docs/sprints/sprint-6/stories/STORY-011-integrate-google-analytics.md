# STORY-011: Integrate Google Analytics 4 Data

## Story Overview

**Story ID:** STORY-011  
**Epic:** EPIC-001 - Data Ingestion Pipeline  
**Sprint:** Sprint 6  
**Priority:** P2 - Medium  
**Estimated Effort:** 3 hours  
**Story Points:** 3  

## User Story

As a **business analyst**,  
I want **to see conversion and revenue metrics for each category**,  
So that **I can identify the most valuable categories for optimization**.

## Context

Google Analytics 4 provides behavioral and conversion data including page views, bounce rate, conversion rate, and revenue. This data helps identify high-value categories that drive business results.

## Acceptance Criteria

### Functional Requirements
1. ✅ Fetch GA4 metrics via Data API
2. ✅ Map page paths to taxonomy nodes
3. ✅ Display pageviews, users, conversions
4. ✅ Show revenue and AOV by category
5. ✅ Calculate engagement metrics

### Technical Requirements
6. ✅ Use OAuth tokens from STORY-006
7. ✅ Handle GA4 API quotas
8. ✅ Support custom dimensions
9. ✅ Store metrics efficiently
10. ✅ Real-time vs batch processing

### Data Requirements
11. ✅ Store conversion funnel metrics
12. ✅ Track user behavior patterns
13. ✅ Support e-commerce tracking
14. ✅ Handle data sampling

## Technical Implementation Notes

### GA4 Analytics Integration
```typescript
// lib/integrations/google/analytics-ga4.ts
import { BetaAnalyticsDataClient } from '@google-analytics/data';
import { GoogleTokenManager } from './token-manager';

export class GA4Service {
  private analyticsData: BetaAnalyticsDataClient;
  private tokenManager: GoogleTokenManager;
  
  constructor() {
    this.tokenManager = new GoogleTokenManager();
  }
  
  async initialize(userId: string) {
    const tokens = await this.tokenManager.getValidTokens(userId);
    
    this.analyticsData = new BetaAnalyticsDataClient({
      authClient: tokens
    });
  }
  
  async fetchCategoryMetrics(
    propertyId: string,
    startDate: string,
    endDate: string
  ) {
    const [response] = await this.analyticsData.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [
        { name: 'pagePath' },
        { name: 'pageTitle' }
      ],
      metrics: [
        { name: 'sessions' },
        { name: 'totalUsers' },
        { name: 'screenPageViews' },
        { name: 'bounceRate' },
        { name: 'averageSessionDuration' },
        { name: 'conversions' },
        { name: 'totalRevenue' },
        { name: 'purchaseRevenue' },
        { name: 'addToCarts' },
        { name: 'checkouts' },
        { name: 'itemsViewed' }
      ],
      dimensionFilter: {
        filter: {
          fieldName: 'pagePath',
          stringFilter: {
            matchType: 'CONTAINS',
            value: '/category/',
            caseSensitive: false
          }
        }
      },
      limit: 10000
    });
    
    return this.processAnalyticsData(response);
  }
  
  private processAnalyticsData(response: any) {
    if (!response.rows) return [];
    
    return response.rows.map(row => {
      const metrics = {};
      row.metricValues.forEach((value, index) => {
        const metricName = response.metricHeaders[index].name;
        metrics[metricName] = this.parseMetricValue(value);
      });
      
      return {
        pagePath: row.dimensionValues[0].value,
        pageTitle: row.dimensionValues[1].value,
        ...metrics
      };
    });
  }
  
  private parseMetricValue(value: any) {
    if (value.value === '(not set)') return null;
    
    const numValue = parseFloat(value.value);
    return isNaN(numValue) ? value.value : numValue;
  }
  
  async fetchEcommerceMetrics(
    propertyId: string,
    startDate: string,
    endDate: string
  ) {
    const [response] = await this.analyticsData.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [
        { name: 'itemCategory' },
        { name: 'itemCategory2' },
        { name: 'itemBrand' }
      ],
      metrics: [
        { name: 'itemRevenue' },
        { name: 'itemsPurchased' },
        { name: 'itemsViewed' },
        { name: 'itemsAddedToCart' },
        { name: 'cartToViewRate' },
        { name: 'purchaseToViewRate' }
      ],
      limit: 10000
    });
    
    return this.processEcommerceData(response);
  }
  
  async fetchConversionFunnel(
    propertyId: string,
    categoryPath: string
  ) {
    const [response] = await this.analyticsData.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
      dimensions: [
        { name: 'eventName' }
      ],
      metrics: [
        { name: 'eventCount' },
        { name: 'totalUsers' }
      ],
      dimensionFilter: {
        andGroup: {
          expressions: [
            {
              filter: {
                fieldName: 'pagePath',
                stringFilter: {
                  matchType: 'EXACT',
                  value: categoryPath
                }
              }
            },
            {
              filter: {
                fieldName: 'eventName',
                inListFilter: {
                  values: [
                    'page_view',
                    'view_item',
                    'add_to_cart',
                    'begin_checkout',
                    'purchase'
                  ]
                }
              }
            }
          ]
        }
      }
    });
    
    return this.calculateFunnelMetrics(response);
  }
}
```

### Analytics Metrics Storage
```sql
-- migrations/add_analytics_metrics_table.sql
CREATE TABLE analytics_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id UUID REFERENCES taxonomy_nodes(id) ON DELETE CASCADE,
  
  -- Traffic metrics
  sessions INTEGER DEFAULT 0,
  users INTEGER DEFAULT 0,
  page_views INTEGER DEFAULT 0,
  unique_page_views INTEGER DEFAULT 0,
  
  -- Engagement metrics
  bounce_rate DECIMAL(5,4) DEFAULT 0,
  avg_session_duration INTEGER DEFAULT 0,
  pages_per_session DECIMAL(5,2) DEFAULT 0,
  
  -- Conversion metrics
  conversions INTEGER DEFAULT 0,
  conversion_rate DECIMAL(5,4) DEFAULT 0,
  
  -- Revenue metrics
  revenue DECIMAL(12,2) DEFAULT 0,
  transactions INTEGER DEFAULT 0,
  avg_order_value DECIMAL(10,2) DEFAULT 0,
  
  -- E-commerce metrics
  add_to_carts INTEGER DEFAULT 0,
  cart_to_view_rate DECIMAL(5,4) DEFAULT 0,
  checkouts INTEGER DEFAULT 0,
  purchase_to_view_rate DECIMAL(5,4) DEFAULT 0,
  
  -- Product metrics
  items_viewed INTEGER DEFAULT 0,
  items_purchased INTEGER DEFAULT 0,
  
  -- Period data
  date_from DATE NOT NULL,
  date_to DATE NOT NULL,
  
  -- Metadata
  page_path TEXT,
  is_sampled BOOLEAN DEFAULT FALSE,
  fetched_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT unique_node_analytics_date UNIQUE (node_id, date_from, date_to)
);

CREATE INDEX idx_analytics_metrics_node ON analytics_metrics(node_id);
CREATE INDEX idx_analytics_metrics_dates ON analytics_metrics(date_from, date_to);
CREATE INDEX idx_analytics_metrics_revenue ON analytics_metrics(revenue DESC);

-- Conversion funnel data
CREATE TABLE conversion_funnels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id UUID REFERENCES taxonomy_nodes(id) ON DELETE CASCADE,
  
  -- Funnel stages
  views INTEGER DEFAULT 0,
  product_views INTEGER DEFAULT 0,
  add_to_carts INTEGER DEFAULT 0,
  checkouts INTEGER DEFAULT 0,
  purchases INTEGER DEFAULT 0,
  
  -- Conversion rates
  view_to_cart_rate DECIMAL(5,4) DEFAULT 0,
  cart_to_checkout_rate DECIMAL(5,4) DEFAULT 0,
  checkout_to_purchase_rate DECIMAL(5,4) DEFAULT 0,
  overall_conversion_rate DECIMAL(5,4) DEFAULT 0,
  
  -- Period
  date_from DATE NOT NULL,
  date_to DATE NOT NULL,
  
  fetched_at TIMESTAMP DEFAULT NOW()
);
```

### Metrics Aggregation Service
```typescript
// lib/services/analytics-aggregator.ts
export class AnalyticsAggregator {
  async aggregateMetrics(metrics: any[], propertyId: string) {
    const aggregated = new Map();
    
    for (const metric of metrics) {
      // Map page path to taxonomy node
      const node = await this.findNodeByPath(metric.pagePath);
      if (!node) continue;
      
      // Aggregate by node
      if (!aggregated.has(node.id)) {
        aggregated.set(node.id, {
          sessions: 0,
          users: new Set(),
          page_views: 0,
          revenue: 0,
          conversions: 0,
          add_to_carts: 0,
          bounce_sessions: 0,
          total_duration: 0
        });
      }
      
      const agg = aggregated.get(node.id);
      agg.sessions += metric.sessions;
      agg.page_views += metric.screenPageViews;
      agg.revenue += metric.totalRevenue || 0;
      agg.conversions += metric.conversions || 0;
      agg.add_to_carts += metric.addToCarts || 0;
      agg.bounce_sessions += metric.sessions * metric.bounceRate;
      agg.total_duration += metric.sessions * metric.averageSessionDuration;
      
      // Track unique users
      if (metric.totalUsers) {
        agg.users.add(metric.pagePath); // Simplified
      }
    }
    
    // Calculate derived metrics
    return Array.from(aggregated.entries()).map(([nodeId, data]) => ({
      node_id: nodeId,
      sessions: data.sessions,
      users: data.users.size,
      page_views: data.page_views,
      bounce_rate: data.bounce_sessions / data.sessions,
      avg_session_duration: data.total_duration / data.sessions,
      pages_per_session: data.page_views / data.sessions,
      conversions: data.conversions,
      conversion_rate: data.conversions / data.sessions,
      revenue: data.revenue,
      avg_order_value: data.revenue / (data.conversions || 1),
      add_to_carts: data.add_to_carts,
      cart_to_view_rate: data.add_to_carts / data.page_views
    }));
  }
}
```

### API Endpoint
```typescript
// app/api/metrics/analytics/route.ts
export async function POST(request: NextRequest) {
  const { propertyId, startDate, endDate } = await request.json();
  const session = await requireAuth(request);
  
  try {
    const ga4Service = new GA4Service();
    await ga4Service.initialize(session.user.id);
    
    // Fetch different metric types
    const [categoryMetrics, ecommerceMetrics] = await Promise.all([
      ga4Service.fetchCategoryMetrics(propertyId, startDate, endDate),
      ga4Service.fetchEcommerceMetrics(propertyId, startDate, endDate)
    ]);
    
    // Aggregate and map to nodes
    const aggregator = new AnalyticsAggregator();
    const aggregatedMetrics = await aggregator.aggregateMetrics(
      categoryMetrics,
      propertyId
    );
    
    // Store in database
    await storeAnalyticsMetrics(aggregatedMetrics, startDate, endDate);
    
    return NextResponse.json({
      success: true,
      stats: {
        pagesProcessed: categoryMetrics.length,
        nodesUpdated: aggregatedMetrics.length,
        totalRevenue: aggregatedMetrics.reduce((sum, m) => sum + m.revenue, 0),
        dateRange: { startDate, endDate }
      }
    });
  } catch (error) {
    console.error('Analytics sync failed:', error);
    return NextResponse.json(
      { error: 'Failed to sync Analytics data' },
      { status: 500 }
    );
  }
}
```

## Dependencies

- Requires STORY-006 completion (Google OAuth)
- Google Analytics Data API v1
- GA4 property configured with e-commerce tracking

## Testing Requirements

### Unit Tests
```typescript
describe('GA4Service', () => {
  it('fetches metrics from GA4 API');
  it('processes analytics data correctly');
  it('handles e-commerce metrics');
  it('calculates conversion funnels');
  it('handles API quotas');
});
```

### Integration Tests
- Test with real GA4 property
- Verify metric calculations
- Test data aggregation
- Validate revenue tracking

## Definition of Done

- [ ] GA4 API integrated
- [ ] Metrics fetched successfully
- [ ] E-commerce data captured
- [ ] Conversion funnels calculated
- [ ] Metrics stored in database
- [ ] UI displays analytics data
- [ ] Aggregation working correctly
- [ ] Unit tests passing
- [ ] Integration tested with real data

## Dev Agent Record

### Agent Model Used
_To be filled by implementing agent_

### Debug Log References
_To be filled during implementation_

### Completion Notes
_To be filled after implementation_

### File List
- `lib/integrations/google/analytics-ga4.ts` (new)
- `lib/services/analytics-aggregator.ts` (new)
- `migrations/add_analytics_metrics_table.sql` (new)
- `app/api/metrics/analytics/route.ts` (new)

---
**Created:** 2025-01-09  
**Status:** Ready for Development  
**Assigned:** Unassigned