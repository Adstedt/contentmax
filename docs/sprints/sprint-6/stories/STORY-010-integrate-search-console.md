# STORY-010: Integrate Google Search Console Metrics

## Story Overview

**Story ID:** STORY-010  
**Epic:** EPIC-001 - Data Ingestion Pipeline  
**Sprint:** Sprint 6  
**Priority:** P2 - Medium  
**Estimated Effort:** 3 hours  
**Story Points:** 3  

## User Story

As an **SEO manager**,  
I want **to see search performance metrics for each category**,  
So that **I can identify which categories need optimization**.

## Context

Google Search Console provides valuable SEO metrics like impressions, clicks, CTR, and average position. Integrating this data helps identify high-opportunity categories that get impressions but low clicks.

## Acceptance Criteria

### Functional Requirements
1. ✅ Fetch Search Console data via API
2. ✅ Map URLs to taxonomy nodes
3. ✅ Display clicks, impressions, CTR, position
4. ✅ Show trending indicators (up/down)
5. ✅ Aggregate metrics by category

### Technical Requirements
6. ✅ Use OAuth tokens from STORY-006
7. ✅ Handle API rate limits
8. ✅ Store metrics with timestamps
9. ✅ Support date range selection
10. ✅ Cache API responses

### Data Requirements
11. ✅ Store historical metrics
12. ✅ Calculate period-over-period changes
13. ✅ Support URL variations
14. ✅ Handle missing data gracefully

## Technical Implementation Notes

### Search Console API Integration
```typescript
// lib/integrations/google/search-console.ts
import { google } from 'googleapis';
import { GoogleTokenManager } from './token-manager';

export class SearchConsoleService {
  private webmasters: any;
  private tokenManager: GoogleTokenManager;
  
  constructor() {
    this.tokenManager = new GoogleTokenManager();
  }
  
  async fetchSearchMetrics(
    userId: string,
    siteUrl: string,
    startDate: string,
    endDate: string
  ) {
    const tokens = await this.tokenManager.getValidTokens(userId);
    
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials(tokens);
    
    this.webmasters = google.webmasters({
      version: 'v3',
      auth: oauth2Client
    });
    
    // Fetch URL-level metrics
    const response = await this.webmasters.searchanalytics.query({
      siteUrl: siteUrl,
      requestBody: {
        startDate: startDate,
        endDate: endDate,
        dimensions: ['page'],
        dimensionFilterGroups: [{
          filters: [{
            dimension: 'page',
            operator: 'contains',
            expression: '/category/' // Filter for category pages
          }]
        }],
        rowLimit: 25000,
        dataState: 'final'
      }
    });
    
    return this.processSearchData(response.data.rows || []);
  }
  
  private processSearchData(rows: any[]) {
    return rows.map(row => ({
      url: row.keys[0],
      clicks: row.clicks || 0,
      impressions: row.impressions || 0,
      ctr: row.ctr || 0,
      position: row.position || 0
    }));
  }
  
  async fetchTopQueries(
    userId: string,
    siteUrl: string,
    pageUrl: string
  ) {
    const tokens = await this.tokenManager.getValidTokens(userId);
    
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials(tokens);
    
    this.webmasters = google.webmasters({
      version: 'v3',
      auth: oauth2Client
    });
    
    const response = await this.webmasters.searchanalytics.query({
      siteUrl: siteUrl,
      requestBody: {
        startDate: this.getDateString(28),
        endDate: this.getDateString(0),
        dimensions: ['query'],
        dimensionFilterGroups: [{
          filters: [{
            dimension: 'page',
            operator: 'equals',
            expression: pageUrl
          }]
        }],
        rowLimit: 10
      }
    });
    
    return response.data.rows || [];
  }
  
  private getDateString(daysAgo: number): string {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    return date.toISOString().split('T')[0];
  }
}
```

### Metrics Mapping Service
```typescript
// lib/services/metrics-mapper.ts
export class MetricsMapper {
  async mapMetricsToNodes(metrics: any[], siteUrl: string) {
    const mappedMetrics = [];
    
    for (const metric of metrics) {
      // Extract path from full URL
      const url = new URL(metric.url);
      const path = url.pathname;
      
      // Find corresponding taxonomy node
      const node = await this.findNodeByUrl(path);
      
      if (node) {
        mappedMetrics.push({
          node_id: node.id,
          metrics: {
            clicks: metric.clicks,
            impressions: metric.impressions,
            ctr: metric.ctr,
            position: metric.position,
            url: metric.url
          }
        });
      }
    }
    
    // Aggregate metrics for parent nodes
    await this.aggregateParentMetrics(mappedMetrics);
    
    return mappedMetrics;
  }
  
  private async findNodeByUrl(path: string) {
    const { data } = await supabase
      .from('taxonomy_nodes')
      .select('*')
      .or(`url.eq.${path},url.eq.${path}/`)
      .single();
    
    return data;
  }
  
  private async aggregateParentMetrics(metrics: any[]) {
    // Group by parent nodes
    const parentMetrics = new Map();
    
    for (const item of metrics) {
      const node = await this.getNodeWithParents(item.node_id);
      
      // Aggregate up the tree
      for (const parentId of node.parent_path) {
        if (!parentMetrics.has(parentId)) {
          parentMetrics.set(parentId, {
            clicks: 0,
            impressions: 0,
            positions: [],
            child_count: 0
          });
        }
        
        const parent = parentMetrics.get(parentId);
        parent.clicks += item.metrics.clicks;
        parent.impressions += item.metrics.impressions;
        parent.positions.push(item.metrics.position);
        parent.child_count++;
      }
    }
    
    // Calculate aggregated metrics
    return Array.from(parentMetrics.entries()).map(([nodeId, data]) => ({
      node_id: nodeId,
      metrics: {
        clicks: data.clicks,
        impressions: data.impressions,
        ctr: data.clicks / data.impressions,
        position: data.positions.reduce((a, b) => a + b, 0) / data.positions.length,
        is_aggregated: true
      }
    }));
  }
}
```

### Store Metrics in Database
```sql
-- migrations/add_search_metrics_table.sql
CREATE TABLE search_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id UUID REFERENCES taxonomy_nodes(id) ON DELETE CASCADE,
  
  -- Core metrics
  clicks INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  ctr DECIMAL(5,4) DEFAULT 0,
  position DECIMAL(5,2) DEFAULT 0,
  
  -- Period data
  date_from DATE NOT NULL,
  date_to DATE NOT NULL,
  
  -- Comparison metrics
  prev_clicks INTEGER,
  prev_impressions INTEGER,
  prev_ctr DECIMAL(5,4),
  prev_position DECIMAL(5,2),
  
  -- Change indicators
  clicks_change DECIMAL(6,2),
  impressions_change DECIMAL(6,2),
  ctr_change DECIMAL(6,2),
  position_change DECIMAL(6,2),
  
  -- Metadata
  url TEXT,
  is_aggregated BOOLEAN DEFAULT FALSE,
  fetched_at TIMESTAMP DEFAULT NOW(),
  
  -- Unique constraint for node and date range
  CONSTRAINT unique_node_date_range UNIQUE (node_id, date_from, date_to)
);

CREATE INDEX idx_search_metrics_node ON search_metrics(node_id);
CREATE INDEX idx_search_metrics_dates ON search_metrics(date_from, date_to);

-- Top queries for each node
CREATE TABLE search_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id UUID REFERENCES taxonomy_nodes(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  clicks INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  ctr DECIMAL(5,4) DEFAULT 0,
  position DECIMAL(5,2) DEFAULT 0,
  date_from DATE NOT NULL,
  date_to DATE NOT NULL
);

CREATE INDEX idx_search_queries_node ON search_queries(node_id);
```

### API Endpoint
```typescript
// app/api/metrics/search-console/route.ts
export async function POST(request: NextRequest) {
  const { siteUrl, startDate, endDate } = await request.json();
  const session = await requireAuth(request);
  
  try {
    const searchConsole = new SearchConsoleService();
    const mapper = new MetricsMapper();
    
    // Fetch metrics from Search Console
    const metrics = await searchConsole.fetchSearchMetrics(
      session.user.id,
      siteUrl,
      startDate,
      endDate
    );
    
    // Map to taxonomy nodes
    const mappedMetrics = await mapper.mapMetricsToNodes(metrics, siteUrl);
    
    // Store in database
    await storeSearchMetrics(mappedMetrics, startDate, endDate);
    
    // Calculate period-over-period changes
    await calculateMetricChanges(startDate, endDate);
    
    return NextResponse.json({
      success: true,
      stats: {
        urlsProcessed: metrics.length,
        nodesUpdated: mappedMetrics.length,
        dateRange: { startDate, endDate }
      }
    });
  } catch (error) {
    console.error('Search Console sync failed:', error);
    return NextResponse.json(
      { error: 'Failed to sync Search Console data' },
      { status: 500 }
    );
  }
}
```

### Display Metrics in Visualization
```typescript
// components/taxonomy/NodeMetrics.tsx
export function NodeMetrics({ node }: { node: any }) {
  const { metrics } = node;
  
  if (!metrics) return null;
  
  const getTrendIcon = (change: number) => {
    if (change > 0) return <TrendingUpIcon className="text-green-500" />;
    if (change < 0) return <TrendingDownIcon className="text-red-500" />;
    return <MinusIcon className="text-gray-400" />;
  };
  
  return (
    <div className="absolute top-full left-0 mt-2 p-3 bg-white rounded-lg shadow-lg z-10">
      <h4 className="font-semibold text-sm mb-2">Search Performance</h4>
      
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-gray-600">Clicks:</span>
          <div className="flex items-center gap-1">
            <span className="font-medium">{metrics.clicks.toLocaleString()}</span>
            {getTrendIcon(metrics.clicks_change)}
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-gray-600">Impressions:</span>
          <div className="flex items-center gap-1">
            <span className="font-medium">{metrics.impressions.toLocaleString()}</span>
            {getTrendIcon(metrics.impressions_change)}
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-gray-600">CTR:</span>
          <div className="flex items-center gap-1">
            <span className="font-medium">{(metrics.ctr * 100).toFixed(1)}%</span>
            {getTrendIcon(metrics.ctr_change)}
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-gray-600">Position:</span>
          <div className="flex items-center gap-1">
            <span className="font-medium">{metrics.position.toFixed(1)}</span>
            {getTrendIcon(-metrics.position_change)} {/* Inverted for position */}
          </div>
        </div>
      </div>
      
      {metrics.is_aggregated && (
        <p className="text-xs text-gray-500 mt-2">
          * Aggregated from child categories
        </p>
      )}
    </div>
  );
}
```

## Dependencies

- Requires STORY-006 completion (Google OAuth)
- Search Console API access
- Taxonomy nodes in database

## Testing Requirements

### Unit Tests
```typescript
describe('SearchConsoleService', () => {
  it('fetches metrics from API');
  it('handles rate limits gracefully');
  it('maps URLs to nodes correctly');
  it('aggregates parent metrics');
  it('calculates period changes');
});
```

### Integration Tests
- Test with real Search Console data
- Verify metric aggregation
- Test date range handling
- Validate cache behavior

## Definition of Done

- [ ] Search Console API integrated
- [ ] Metrics mapped to nodes
- [ ] Historical data stored
- [ ] Period comparisons working
- [ ] Metrics displayed in UI
- [ ] Aggregation logic correct
- [ ] Rate limiting handled
- [ ] Unit tests passing
- [ ] Manual testing complete

## Dev Agent Record

### Agent Model Used
_To be filled by implementing agent_

### Debug Log References
_To be filled during implementation_

### Completion Notes
_To be filled after implementation_

### File List
- `lib/integrations/google/search-console.ts` (new)
- `lib/services/metrics-mapper.ts` (new)
- `migrations/add_search_metrics_table.sql` (new)
- `app/api/metrics/search-console/route.ts` (new)
- `components/taxonomy/NodeMetrics.tsx` (new)

---
**Created:** 2025-01-09  
**Status:** Ready for Development  
**Assigned:** Unassigned