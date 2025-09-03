# TASK-004: GA4 Client Implementation

## Overview

**Priority**: P0 - Blocker  
**Estimate**: 6 hours  
**Owner**: Backend Developer  
**Dependencies**: None  
**Status**: Not Started

## Problem Statement

We need to integrate Google Analytics 4 (GA4) to fetch e-commerce metrics including sessions, revenue, conversion rates, and other engagement metrics. This data will enrich our taxonomy nodes alongside GSC data for comprehensive opportunity scoring.

## Technical Requirements

### 1. GA4 Client Implementation

#### File: `lib/integrations/analytics.ts`

```typescript
import { BetaAnalyticsDataClient } from '@google-analytics/data';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import {
  GA4Metrics,
  GA4Response,
  GA4QueryOptions,
  DateRange,
  GA4Error,
  GA4Dimension,
  GA4Metric,
} from '@/types/ga4.types';

/**
 * GA4Client - Google Analytics 4 Data API integration
 * Uses the GA4 Data API (not the older Universal Analytics API)
 */
export class GA4Client {
  private analyticsDataClient: BetaAnalyticsDataClient;
  private propertyId: string;
  private oauth2Client: OAuth2Client | null = null;
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 3600000; // 1 hour
  private requestCount = 0;
  private lastRequestTime = Date.now();

  // GA4 API Limits
  private readonly RATE_LIMITS = {
    requestsPerSecond: 10,
    tokensPerDay: 25000,
    tokensPerHour: 5000,
    concurrentRequests: 10,
  };

  constructor(propertyId?: string) {
    this.propertyId = propertyId || process.env.GA4_PROPERTY_ID || '';

    // Initialize with service account by default
    this.analyticsDataClient = new BetaAnalyticsDataClient({
      keyFilename: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
    });
  }

  /**
   * Initialize with OAuth2 for user-specific access
   */
  async initializeWithOAuth(refreshToken: string): Promise<void> {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    this.oauth2Client.setCredentials({
      refresh_token: refreshToken,
    });

    // Recreate client with OAuth
    this.analyticsDataClient = new BetaAnalyticsDataClient({
      auth: this.oauth2Client,
    });
  }

  /**
   * Fetch metrics for landing pages
   */
  async fetchLandingPageMetrics(options: GA4QueryOptions): Promise<GA4Metrics[]> {
    const cacheKey = this.getCacheKey('landing_pages', options);
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    await this.enforceRateLimit();

    try {
      const [response] = await this.analyticsDataClient.runReport({
        property: `properties/${this.propertyId}`,
        dateRanges: [
          {
            startDate: options.startDate,
            endDate: options.endDate,
          },
        ],
        dimensions: [{ name: 'landingPagePlusQueryString' }, { name: 'date' }],
        metrics: [
          { name: 'sessions' },
          { name: 'totalRevenue' },
          { name: 'ecommercePurchases' },
          { name: 'addToCarts' },
          { name: 'cartToViewRate' },
          { name: 'ecommercePurchaseRate' },
          { name: 'averagePurchaseRevenue' },
          { name: 'bounceRate' },
          { name: 'engagementRate' },
          { name: 'averageSessionDuration' },
        ],
        dimensionFilter: options.urlFilter
          ? {
              filter: {
                fieldName: 'landingPagePlusQueryString',
                stringFilter: {
                  matchType: 'CONTAINS',
                  value: options.urlFilter,
                },
              },
            }
          : undefined,
        limit: options.limit || 10000,
        offset: options.offset || 0,
      });

      const metrics = this.parseResponse(response);
      this.setCache(cacheKey, metrics);
      return metrics;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Fetch aggregated metrics for a specific URL
   */
  async fetchUrlMetrics(url: string, dateRange: DateRange): Promise<GA4Metrics> {
    const cacheKey = `url_${url}_${dateRange.startDate}_${dateRange.endDate}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    await this.enforceRateLimit();

    // Clean URL for GA4 (remove domain)
    const path = this.extractPath(url);

    try {
      const [response] = await this.analyticsDataClient.runReport({
        property: `properties/${this.propertyId}`,
        dateRanges: [dateRange],
        dimensions: [{ name: 'landingPagePlusQueryString' }],
        metrics: [
          { name: 'sessions' },
          { name: 'totalRevenue' },
          { name: 'ecommercePurchases' },
          { name: 'addToCarts' },
          { name: 'ecommercePurchaseRate' },
          { name: 'averagePurchaseRevenue' },
          { name: 'bounceRate' },
          { name: 'engagementRate' },
          { name: 'averageSessionDuration' },
          { name: 'totalUsers' },
          { name: 'newUsers' },
        ],
        dimensionFilter: {
          filter: {
            fieldName: 'landingPagePlusQueryString',
            stringFilter: {
              matchType: 'EXACT',
              value: path,
            },
          },
        },
      });

      const metrics = this.parseSingleUrlResponse(response);
      this.setCache(cacheKey, metrics);
      return metrics;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Batch fetch metrics for multiple URLs
   */
  async fetchBatchMetrics(urls: string[], dateRange: DateRange): Promise<Map<string, GA4Metrics>> {
    const results = new Map<string, GA4Metrics>();

    // GA4 doesn't support true batch requests like Universal Analytics
    // We need to use OR filters or make parallel requests

    // Split into chunks to avoid filter complexity limits
    const chunks = this.chunkArray(urls, 50);

    for (const chunk of chunks) {
      await this.enforceRateLimit();

      const paths = chunk.map((url) => this.extractPath(url));

      try {
        const [response] = await this.analyticsDataClient.runReport({
          property: `properties/${this.propertyId}`,
          dateRanges: [dateRange],
          dimensions: [{ name: 'landingPagePlusQueryString' }],
          metrics: [
            { name: 'sessions' },
            { name: 'totalRevenue' },
            { name: 'ecommercePurchases' },
            { name: 'ecommercePurchaseRate' },
            { name: 'bounceRate' },
            { name: 'engagementRate' },
            { name: 'averageSessionDuration' },
          ],
          dimensionFilter: {
            orGroup: {
              expressions: paths.map((path) => ({
                filter: {
                  fieldName: 'landingPagePlusQueryString',
                  stringFilter: {
                    matchType: 'EXACT',
                    value: path,
                  },
                },
              })),
            },
          },
        });

        // Parse and map results back to original URLs
        const metricsMap = this.parseToMap(response, urls);
        metricsMap.forEach((value, key) => {
          results.set(key, value);
        });
      } catch (error) {
        console.error(`Error fetching batch metrics for chunk:`, error);
        // Continue with other chunks even if one fails
      }
    }

    return results;
  }

  /**
   * Get e-commerce funnel metrics
   */
  async fetchEcommerceFunnel(dateRange: DateRange, segmentFilter?: string): Promise<any> {
    await this.enforceRateLimit();

    try {
      const [response] = await this.analyticsDataClient.runReport({
        property: `properties/${this.propertyId}`,
        dateRanges: [dateRange],
        dimensions: [{ name: 'date' }],
        metrics: [
          { name: 'itemViews' },
          { name: 'addToCarts' },
          { name: 'checkouts' },
          { name: 'ecommercePurchases' },
          { name: 'cartToViewRate' },
          { name: 'purchaseToViewRate' },
        ],
        dimensionFilter: segmentFilter
          ? {
              filter: {
                fieldName: 'landingPagePlusQueryString',
                stringFilter: {
                  matchType: 'CONTAINS',
                  value: segmentFilter,
                },
              },
            }
          : undefined,
      });

      return this.parseResponse(response);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Parse GA4 response to our metrics format
   */
  private parseResponse(response: any): GA4Metrics[] {
    if (!response?.rows) return [];

    return response.rows.map((row: any) => {
      const metrics: GA4Metrics = {
        url: row.dimensionValues?.[0]?.value || '',
        date: row.dimensionValues?.[1]?.value || '',
        sessions: parseInt(row.metricValues?.[0]?.value || '0'),
        revenue: parseFloat(row.metricValues?.[1]?.value || '0'),
        transactions: parseInt(row.metricValues?.[2]?.value || '0'),
        addToCarts: parseInt(row.metricValues?.[3]?.value || '0'),
        cartToViewRate: parseFloat(row.metricValues?.[4]?.value || '0'),
        conversionRate: parseFloat(row.metricValues?.[5]?.value || '0'),
        aov: parseFloat(row.metricValues?.[6]?.value || '0'),
        bounceRate: parseFloat(row.metricValues?.[7]?.value || '0'),
        engagementRate: parseFloat(row.metricValues?.[8]?.value || '0'),
        avgSessionDuration: parseFloat(row.metricValues?.[9]?.value || '0'),
      };

      return metrics;
    });
  }

  private parseSingleUrlResponse(response: any): GA4Metrics {
    if (!response?.rows?.[0]) {
      return this.getEmptyMetrics();
    }

    const row = response.rows[0];
    return {
      url: row.dimensionValues?.[0]?.value || '',
      sessions: parseInt(row.metricValues?.[0]?.value || '0'),
      revenue: parseFloat(row.metricValues?.[1]?.value || '0'),
      transactions: parseInt(row.metricValues?.[2]?.value || '0'),
      addToCarts: parseInt(row.metricValues?.[3]?.value || '0'),
      conversionRate: parseFloat(row.metricValues?.[4]?.value || '0'),
      aov: parseFloat(row.metricValues?.[5]?.value || '0'),
      bounceRate: parseFloat(row.metricValues?.[6]?.value || '0'),
      engagementRate: parseFloat(row.metricValues?.[7]?.value || '0'),
      avgSessionDuration: parseFloat(row.metricValues?.[8]?.value || '0'),
      totalUsers: parseInt(row.metricValues?.[9]?.value || '0'),
      newUsers: parseInt(row.metricValues?.[10]?.value || '0'),
    };
  }

  private parseToMap(response: any, originalUrls: string[]): Map<string, GA4Metrics> {
    const map = new Map<string, GA4Metrics>();

    // Create path to URL mapping
    const pathToUrl = new Map<string, string>();
    originalUrls.forEach((url) => {
      const path = this.extractPath(url);
      pathToUrl.set(path, url);
    });

    if (response?.rows) {
      response.rows.forEach((row: any) => {
        const path = row.dimensionValues?.[0]?.value || '';
        const originalUrl = pathToUrl.get(path);

        if (originalUrl) {
          map.set(originalUrl, {
            url: originalUrl,
            sessions: parseInt(row.metricValues?.[0]?.value || '0'),
            revenue: parseFloat(row.metricValues?.[1]?.value || '0'),
            transactions: parseInt(row.metricValues?.[2]?.value || '0'),
            conversionRate: parseFloat(row.metricValues?.[3]?.value || '0'),
            bounceRate: parseFloat(row.metricValues?.[4]?.value || '0'),
            engagementRate: parseFloat(row.metricValues?.[5]?.value || '0'),
            avgSessionDuration: parseFloat(row.metricValues?.[6]?.value || '0'),
          });
        }
      });
    }

    // Fill in empty metrics for URLs with no data
    originalUrls.forEach((url) => {
      if (!map.has(url)) {
        map.set(url, this.getEmptyMetrics(url));
      }
    });

    return map;
  }

  private getEmptyMetrics(url?: string): GA4Metrics {
    return {
      url: url || '',
      sessions: 0,
      revenue: 0,
      transactions: 0,
      addToCarts: 0,
      conversionRate: 0,
      aov: 0,
      bounceRate: 0,
      engagementRate: 0,
      avgSessionDuration: 0,
      totalUsers: 0,
      newUsers: 0,
    };
  }

  /**
   * Rate limiting
   */
  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    // Enforce 10 requests per second limit
    if (timeSinceLastRequest < 100) {
      await this.sleep(100 - timeSinceLastRequest);
    }

    this.lastRequestTime = Date.now();
    this.requestCount++;
  }

  /**
   * Utility methods
   */
  private extractPath(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.pathname + urlObj.search;
    } catch {
      return url;
    }
  }

  private getCacheKey(type: string, options: any): string {
    return `${type}_${JSON.stringify(options)}`;
  }

  private getFromCache(key: string): any | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }
    return null;
  }

  private setCache(key: string, data: any): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });

    // Clean old cache entries
    if (this.cache.size > 1000) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private handleError(error: any): GA4Error {
    console.error('GA4 API Error:', error);

    if (error.code === 'UNAUTHENTICATED') {
      return new GA4Error('Authentication failed. Please reconnect GA4.', 'AUTH_ERROR');
    }

    if (error.code === 'PERMISSION_DENIED') {
      return new GA4Error('No permission to access GA4 property.', 'PERMISSION_ERROR');
    }

    if (error.code === 'RESOURCE_EXHAUSTED') {
      return new GA4Error('GA4 API quota exceeded.', 'QUOTA_ERROR');
    }

    return new GA4Error(error.message || 'Unknown GA4 error', 'UNKNOWN_ERROR');
  }
}

/**
 * Custom error class for GA4
 */
export class GA4Error extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
    this.name = 'GA4Error';
  }
}
```

### 2. TypeScript Types

#### File: `types/ga4.types.ts`

```typescript
export interface GA4Metrics {
  url?: string;
  date?: string;
  sessions: number;
  revenue: number;
  transactions: number;
  addToCarts?: number;
  conversionRate: number;
  aov: number; // Average Order Value
  bounceRate: number;
  engagementRate: number;
  avgSessionDuration: number;
  totalUsers?: number;
  newUsers?: number;
  cartToViewRate?: number;
}

export interface GA4QueryOptions {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  dimensions?: GA4Dimension[];
  metrics?: GA4Metric[];
  urlFilter?: string;
  limit?: number;
  offset?: number;
}

export interface DateRange {
  startDate: string;
  endDate: string;
}

export type GA4Dimension =
  | 'date'
  | 'landingPagePlusQueryString'
  | 'sessionDefaultChannelGroup'
  | 'deviceCategory'
  | 'country'
  | 'city';

export type GA4Metric =
  | 'sessions'
  | 'totalRevenue'
  | 'ecommercePurchases'
  | 'addToCarts'
  | 'cartToViewRate'
  | 'ecommercePurchaseRate'
  | 'averagePurchaseRevenue'
  | 'bounceRate'
  | 'engagementRate'
  | 'averageSessionDuration'
  | 'totalUsers'
  | 'newUsers';

export interface GA4Response {
  rows: GA4Row[];
  rowCount: number;
  metadata: GA4Metadata;
}

export interface GA4Row {
  dimensionValues: { value: string }[];
  metricValues: { value: string }[];
}

export interface GA4Metadata {
  currencyCode: string;
  dataLossFromOtherRow: boolean;
  emptyReason?: string;
  subjectToThresholding: boolean;
}
```

### 3. Environment Configuration

#### File: `.env.local` (additions)

```env
# GA4 Configuration
GA4_PROPERTY_ID=123456789
GOOGLE_SERVICE_ACCOUNT_KEY_PATH=./credentials/ga4-service-account.json

# Or use OAuth (from existing GSC setup)
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxx
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
```

### 4. Integration with Metrics Sync

#### File: `lib/jobs/metrics-sync.ts` (update)

```typescript
import { GA4Client } from '@/lib/integrations/analytics';
import { SearchConsoleClient } from '@/lib/integrations/search-console';

export async function syncMetrics(projectId: string) {
  // Initialize clients
  const ga4Client = new GA4Client();
  const gscClient = new SearchConsoleClient();

  // Get all nodes
  const { data: nodes } = await supabase
    .from('taxonomy_nodes')
    .select('id, url')
    .eq('project_id', projectId);

  if (!nodes) return;

  // Prepare URLs
  const urls = nodes.map((n) => n.url);

  // Fetch metrics in parallel
  const dateRange = {
    startDate: getDateString(7), // 7 days ago
    endDate: getDateString(1), // Yesterday
  };

  const [ga4Metrics, gscMetrics] = await Promise.all([
    ga4Client.fetchBatchMetrics(urls, dateRange),
    gscClient.fetchBatchMetrics(urls, dateRange),
  ]);

  // Combine and store metrics
  for (const node of nodes) {
    const ga4 = ga4Metrics.get(node.url);
    const gsc = gscMetrics.get(node.url);

    if (ga4) {
      await supabase.from('node_metrics').upsert({
        node_id: node.id,
        date: dateRange.endDate,
        source: 'ga4',
        sessions: ga4.sessions,
        revenue: ga4.revenue,
        transactions: ga4.transactions,
        conversion_rate: ga4.conversionRate,
        bounce_rate: ga4.bounceRate,
        avg_session_duration: ga4.avgSessionDuration,
      });
    }

    if (gsc) {
      await supabase.from('node_metrics').upsert({
        node_id: node.id,
        date: dateRange.endDate,
        source: 'gsc',
        impressions: gsc.impressions,
        clicks: gsc.clicks,
        ctr: gsc.ctr,
        position: gsc.position,
      });
    }
  }

  // Update metrics_updated_at
  await supabase
    .from('taxonomy_nodes')
    .update({ metrics_updated_at: new Date().toISOString() })
    .eq('project_id', projectId);
}
```

### 5. Testing

#### File: `lib/integrations/analytics.test.ts`

```typescript
import { GA4Client } from './analytics';

describe('GA4Client', () => {
  let client: GA4Client;

  beforeAll(() => {
    client = new GA4Client('test-property');
  });

  describe('fetchUrlMetrics', () => {
    it('should fetch metrics for a single URL', async () => {
      const metrics = await client.fetchUrlMetrics('https://example.com/products', {
        startDate: '2024-01-01',
        endDate: '2024-01-07',
      });

      expect(metrics).toHaveProperty('sessions');
      expect(metrics).toHaveProperty('revenue');
      expect(metrics).toHaveProperty('conversionRate');
      expect(metrics.sessions).toBeGreaterThanOrEqual(0);
    });

    it('should return empty metrics for non-existent URL', async () => {
      const metrics = await client.fetchUrlMetrics('https://example.com/does-not-exist-12345', {
        startDate: '2024-01-01',
        endDate: '2024-01-07',
      });

      expect(metrics.sessions).toBe(0);
      expect(metrics.revenue).toBe(0);
    });
  });

  describe('fetchBatchMetrics', () => {
    it('should fetch metrics for multiple URLs', async () => {
      const urls = [
        'https://example.com/products',
        'https://example.com/categories',
        'https://example.com/about',
      ];

      const metricsMap = await client.fetchBatchMetrics(urls, {
        startDate: '2024-01-01',
        endDate: '2024-01-07',
      });

      expect(metricsMap.size).toBe(3);
      urls.forEach((url) => {
        expect(metricsMap.has(url)).toBe(true);
      });
    });

    it('should handle large batches efficiently', async () => {
      const urls = Array.from({ length: 200 }, (_, i) => `https://example.com/product-${i}`);

      const start = Date.now();
      const metricsMap = await client.fetchBatchMetrics(urls, {
        startDate: '2024-01-01',
        endDate: '2024-01-07',
      });
      const duration = Date.now() - start;

      expect(metricsMap.size).toBe(200);
      expect(duration).toBeLessThan(30000); // Should complete in 30s
    });
  });

  describe('rate limiting', () => {
    it('should respect rate limits', async () => {
      const promises = [];

      // Try to make 15 requests rapidly
      for (let i = 0; i < 15; i++) {
        promises.push(
          client.fetchUrlMetrics(`https://example.com/page-${i}`, {
            startDate: '2024-01-01',
            endDate: '2024-01-07',
          })
        );
      }

      // Should complete without rate limit errors
      await expect(Promise.all(promises)).resolves.toBeDefined();
    });
  });

  describe('caching', () => {
    it('should cache repeated requests', async () => {
      const url = 'https://example.com/cached-test';
      const dateRange = {
        startDate: '2024-01-01',
        endDate: '2024-01-07',
      };

      // First request
      const start1 = Date.now();
      const metrics1 = await client.fetchUrlMetrics(url, dateRange);
      const duration1 = Date.now() - start1;

      // Second request (should be cached)
      const start2 = Date.now();
      const metrics2 = await client.fetchUrlMetrics(url, dateRange);
      const duration2 = Date.now() - start2;

      expect(metrics1).toEqual(metrics2);
      expect(duration2).toBeLessThan(duration1 / 10); // Cached should be much faster
    });
  });
});
```

## Acceptance Criteria

- [ ] Successfully authenticates with GA4 using service account or OAuth
- [ ] Fetches e-commerce metrics (revenue, transactions, conversion rate)
- [ ] Fetches engagement metrics (sessions, bounce rate, duration)
- [ ] Handles batch requests for 100+ URLs efficiently
- [ ] Implements proper rate limiting (10 req/sec)
- [ ] Caches responses to reduce API calls
- [ ] Maps GA4 paths back to full URLs correctly
- [ ] Returns empty metrics for URLs with no data
- [ ] Error handling with meaningful messages
- [ ] Unit tests with >80% coverage

## Implementation Steps

1. **Hour 1-2**: Core GA4Client implementation
2. **Hour 3**: Batch fetching and rate limiting
3. **Hour 4**: Caching and error handling
4. **Hour 5**: Integration with sync job
5. **Hour 6**: Testing and optimization

## Configuration Steps

1. **Enable GA4 Data API** in Google Cloud Console
2. **Create Service Account** with Viewer permissions
3. **Grant access** to GA4 property
4. **Download credentials** JSON file
5. **Set environment variables**

## Performance Considerations

- Cache responses for 1 hour to reduce API calls
- Batch requests in groups of 50 URLs
- Use dimension filters to reduce data transfer
- Consider using GA4 Data Export for very large datasets

## Security Notes

- Store service account credentials securely
- Never commit credentials to git
- Rotate service account keys periodically
- Use least-privilege permissions

## Dependencies for Next Tasks

- **TASK-005**: URL Matcher needs GA4 path format understanding
- **TASK-006**: Metrics Sync Job will use this client
- **Scoring**: Revenue metrics critical for opportunity scoring

## Notes

- GA4 Data API is different from Universal Analytics API
- Consider implementing real-time data for critical metrics
- May need custom dimensions for better category tracking
- E-commerce tracking must be properly configured in GA4
