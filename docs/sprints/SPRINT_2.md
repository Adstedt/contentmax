# Sprint 2: External Data Integration

## Week 2 - GSC & GA4 Connections

### Sprint Goal

Connect and sync external data sources (Google Search Console & GA4) to enrich category nodes with performance metrics.

### Success Criteria

- [ ] GSC OAuth flow complete
- [ ] GA4 authentication working
- [ ] Metrics successfully matched to nodes
- [ ] Daily sync job configured
- [ ] 80%+ node match rate achieved

---

## Technical Tasks

### 2.1 Google OAuth Setup

**Priority**: P0 - Blocker
**Estimate**: 4 hours

```typescript
// app/api/auth/google/route.ts
export async function GET(request: Request) {
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', process.env.GOOGLE_REDIRECT_URI);
  authUrl.searchParams.set('scope', 'https://www.googleapis.com/auth/webmasters');
  authUrl.searchParams.set('response_type', 'code');

  return Response.redirect(authUrl);
}
```

### 2.2 GSC Data Fetching

**Priority**: P0 - Critical
**Estimate**: 6 hours

```typescript
// lib/integrations/gsc.ts
interface GSCQuery {
  startDate: string;
  endDate: string;
  dimensions: ['page'];
  dimensionFilterGroups?: [
    {
      filters: [
        {
          dimension: 'page';
          operator: 'contains';
          expression: '/category/';
        },
      ];
    },
  ];
  rowLimit: number;
}

export async function fetchGSCData(siteUrl: string, query: GSCQuery) {
  // Implement Search Console API calls
  // Handle pagination
  // Return metrics by URL
}
```

### 2.3 GA4 Integration

**Priority**: P0 - Critical
**Estimate**: 6 hours

```typescript
// lib/integrations/ga4.ts
import { BetaAnalyticsDataClient } from '@google-analytics/data';

export async function fetchGA4Data(propertyId: string, dateRange: DateRange) {
  const client = new BetaAnalyticsDataClient();

  const request = {
    property: `properties/${propertyId}`,
    dimensions: [{ name: 'landingPage' }],
    metrics: [{ name: 'sessions' }, { name: 'totalRevenue' }, { name: 'ecommercePurchases' }],
    dateRanges: [dateRange],
  };

  return await client.runReport(request);
}
```

### 2.4 Data Matching Algorithm

**Priority**: P0 - Critical
**Estimate**: 8 hours

```typescript
// lib/matching/url-matcher.ts
export class URLMatcher {
  private normalizeURL(url: string): string {
    // Remove protocol, www, trailing slash
    // Handle parameter variations
    // Lowercase everything
  }

  fuzzyMatch(sourceUrl: string, targetUrl: string): number {
    // Return confidence score 0-1
    // Handle URL variations:
    // - With/without trailing slash
    // - With/without www
    // - HTTP vs HTTPS
    // - Parameter ordering
  }

  async matchMetricsToNodes(metrics: MetricData[], nodes: CategoryNode[]) {
    // Build URL index for fast lookup
    // Apply fuzzy matching
    // Log unmatched URLs
    // Return enriched nodes
  }
}
```

### 2.5 Metrics Storage

**Priority**: P1 - High
**Estimate**: 4 hours

```sql
-- Metrics table schema
CREATE TABLE node_metrics (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  node_id UUID REFERENCES category_nodes(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  source TEXT NOT NULL, -- 'gsc' or 'ga4'
  impressions INTEGER,
  clicks INTEGER,
  ctr DECIMAL(5,4),
  position DECIMAL(4,2),
  sessions INTEGER,
  revenue DECIMAL(12,2),
  transactions INTEGER,
  conversion_rate DECIMAL(5,4),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(node_id, date, source)
);

CREATE INDEX idx_metrics_node_date ON node_metrics(node_id, date);
CREATE INDEX idx_metrics_date ON node_metrics(date);
```

### 2.6 Sync Job Implementation

**Priority**: P1 - High
**Estimate**: 4 hours

```typescript
// lib/jobs/sync-metrics.ts
export async function syncMetrics() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  // 1. Fetch all nodes
  const nodes = await getAllNodes();

  // 2. Fetch GSC data
  const gscData = await fetchGSCData({
    startDate: yesterday,
    endDate: yesterday,
  });

  // 3. Fetch GA4 data
  const ga4Data = await fetchGA4Data({
    startDate: yesterday,
    endDate: yesterday,
  });

  // 4. Match and store
  await matchAndStoreMetrics(nodes, gscData, ga4Data);

  // 5. Log results
  return { matched: X, unmatched: Y, errors: Z };
}
```

---

## Testing Requirements

### Integration Tests

```typescript
describe('GSC Integration', () => {
  test('authenticates successfully', async () => {});
  test('fetches data for date range', async () => {});
  test('handles API rate limits', async () => {});
  test('paginates through results', async () => {});
});

describe('URL Matching', () => {
  test('matches exact URLs', () => {});
  test('handles trailing slashes', () => {});
  test('matches with confidence scoring', () => {});
  test('logs unmatched URLs', () => {});
});
```

### E2E Tests

- Complete OAuth flow
- Fetch and store metrics
- Verify data in database
- Check match rates

---

## API Rate Limits

### Google Search Console

- 1200 requests per minute
- 10 requests per second
- Implement exponential backoff

### GA4

- 10 requests per second
- 1000 requests per hour
- Batch requests when possible

---

## Monitoring & Alerts

```typescript
// Set up monitoring for:
interface SyncMetrics {
  totalNodes: number;
  matchedNodes: number;
  matchRate: number;
  unmatchedUrls: string[];
  syncDuration: number;
  errors: Error[];
}

// Alert if:
// - Match rate < 70%
// - Sync takes > 5 minutes
// - API errors > 5%
```

---

## Definition of Done

- [ ] OAuth flow tested with real Google account
- [ ] GSC data fetching with pagination
- [ ] GA4 data retrieval working
- [ ] URL matching achieves 80%+ accuracy
- [ ] Metrics stored in database
- [ ] Daily sync job scheduled
- [ ] Error handling and retries
- [ ] Monitoring configured

---

## Sprint Review Prep

**Demo Script**:

1. Show OAuth connection flow
2. Trigger manual sync
3. Display enriched nodes with metrics
4. Show match rate statistics
5. Query metrics by date range

**Metrics to Share**:

- Nodes with GSC data: X%
- Nodes with GA4 data: X%
- Average match confidence: X%
- Sync time: X seconds
- Unmatched URLs: X

---

## Next Sprint Preview

Sprint 3 will focus on:

- D3.js visualization setup
- Force-directed graph implementation
- Performance optimization for 3000+ nodes
- Interactive controls

**Handoff Requirements**:

- Nodes enriched with metrics
- Sync job running daily
- Historical data available
- API connections stable
