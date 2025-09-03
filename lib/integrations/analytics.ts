import { BetaAnalyticsDataClient } from '@google-analytics/data';
import { GoogleAuth } from 'google-auth-library';
import pLimit from 'p-limit';
import {
  GA4Metrics,
  GA4Config,
  GA4BatchRequest,
  GA4Error,
  GA4CacheEntry,
  GA4ReportResponse,
  GA4_METRICS,
  GA4_DIMENSIONS,
} from '@/types/ga4.types';

export class GA4Client {
  private client: BetaAnalyticsDataClient;
  private propertyId: string;
  private cache: Map<string, GA4CacheEntry>;
  private cacheTTL: number;
  private rateLimiter: ReturnType<typeof pLimit>;

  constructor(config: GA4Config) {
    this.propertyId = config.propertyId;
    this.cacheTTL = config.cacheTTL || 3600000; // 1 hour default
    this.cache = new Map();

    // Initialize rate limiter (10 requests per second)
    this.rateLimiter = pLimit(config.rateLimit?.maxConcurrent || 10);

    // Initialize GA4 client with authentication
    if (config.serviceAccountKey) {
      // Use provided service account key
      const auth = new GoogleAuth({
        credentials: JSON.parse(config.serviceAccountKey),
        scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
      });

      this.client = new BetaAnalyticsDataClient({ auth });
    } else if (config.serviceAccountPath) {
      // Use service account key file
      this.client = new BetaAnalyticsDataClient({
        keyFilename: config.serviceAccountPath,
      });
    } else {
      // Use default credentials (for local development or GCP)
      this.client = new BetaAnalyticsDataClient();
    }
  }

  /**
   * Fetch metrics for a single URL
   */
  async fetchUrlMetrics(
    url: string,
    startDate: string,
    endDate: string
  ): Promise<GA4Metrics> {
    // Check cache first
    const cacheKey = `${url}-${startDate}-${endDate}`;
    const cachedData = this.getFromCache(cacheKey);
    if (cachedData) {
      return cachedData;
    }

    try {
      // Extract path from URL for GA4 dimension filter
      const urlPath = this.extractPath(url);

      const [response] = await this.rateLimiter(() =>
        this.client.runReport({
          property: `properties/${this.propertyId}`,
          dateRanges: [{ startDate, endDate }],
          dimensions: [{ name: GA4_DIMENSIONS.PAGE }],
          metrics: [
            { name: 'totalRevenue' },
            { name: 'transactions' },
            { name: 'sessions' },
            { name: 'bounceRate' },
            { name: 'engagementRate' },
            { name: 'averageSessionDuration' },
            { name: 'screenPageViews' },
            { name: 'newUsers' },
            { name: 'totalUsers' },
          ],
          dimensionFilter: {
            filter: {
              fieldName: GA4_DIMENSIONS.PAGE,
              stringFilter: {
                matchType: 'EXACT',
                value: urlPath,
              },
            },
          },
        })
      );

      const metrics = this.parseResponse(response, url, { startDate, endDate });
      this.setCache(cacheKey, metrics);

      return metrics;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Fetch metrics for multiple URLs in batch
   */
  async fetchBatchMetrics(request: GA4BatchRequest): Promise<GA4Metrics[]> {
    const { urls, startDate, endDate } = request;

    // GA4 API supports up to 50 dimension values in OR filter
    const batchSize = 50;
    const batches = this.chunkArray(urls, batchSize);
    const results: GA4Metrics[] = [];

    for (const batch of batches) {
      try {
        const paths = batch.map((url) => this.extractPath(url));
        
        const [response] = await this.rateLimiter(() =>
          this.client.runReport({
            property: `properties/${this.propertyId}`,
            dateRanges: [{ startDate, endDate }],
            dimensions: [{ name: GA4_DIMENSIONS.PAGE }],
            metrics: [
              { name: 'totalRevenue' },
              { name: 'transactions' },
              { name: 'sessions' },
              { name: 'bounceRate' },
              { name: 'engagementRate' },
              { name: 'averageSessionDuration' },
              { name: 'screenPageViews' },
              { name: 'newUsers' },
              { name: 'totalUsers' },
            ],
            dimensionFilter: {
              orGroup: {
                expressions: paths.map((path) => ({
                  filter: {
                    fieldName: GA4_DIMENSIONS.PAGE,
                    stringFilter: {
                      matchType: 'EXACT',
                      value: path,
                    },
                  },
                })),
              },
            },
          })
        );

        // Parse and map results back to URLs
        const pathToUrlMap = new Map(
          batch.map((url) => [this.extractPath(url), url])
        );

        if (response.rows) {
          for (const row of response.rows) {
            const path = row.dimensionValues?.[0]?.value || '';
            const originalUrl = pathToUrlMap.get(path) || path;
            
            const metrics = this.parseRow(row, originalUrl, { startDate, endDate });
            results.push(metrics);

            // Cache each result
            const cacheKey = `${originalUrl}-${startDate}-${endDate}`;
            this.setCache(cacheKey, metrics);
          }
        }

        // Add zero metrics for URLs with no data
        for (const url of batch) {
          if (!results.find((r) => r.url === url)) {
            const emptyMetrics = this.createEmptyMetrics(url, { startDate, endDate });
            results.push(emptyMetrics);
          }
        }
      } catch (error) {
        console.error('Batch fetch error:', error);
        // Add empty metrics for failed batch
        for (const url of batch) {
          results.push(this.createEmptyMetrics(url, { startDate, endDate }));
        }
      }

      // Rate limiting delay between batches
      if (batches.indexOf(batch) < batches.length - 1) {
        await this.sleep(100); // 100ms between batches
      }
    }

    return results;
  }

  /**
   * Parse GA4 response into metrics object
   */
  private parseResponse(
    response: any,
    url: string,
    dateRange: { startDate: string; endDate: string }
  ): GA4Metrics {
    if (!response.rows || response.rows.length === 0) {
      return this.createEmptyMetrics(url, dateRange);
    }

    return this.parseRow(response.rows[0], url, dateRange);
  }

  /**
   * Parse a single GA4 report row
   */
  private parseRow(
    row: any,
    url: string,
    dateRange: { startDate: string; endDate: string }
  ): GA4Metrics {
    const metricValues = row.metricValues || [];

    return {
      url,
      dateRange,
      revenue: parseFloat(metricValues[0]?.value || '0'),
      transactions: parseInt(metricValues[1]?.value || '0'),
      conversionRate: this.calculateConversionRate(
        parseInt(metricValues[1]?.value || '0'),
        parseInt(metricValues[2]?.value || '0')
      ),
      averageOrderValue: this.calculateAOV(
        parseFloat(metricValues[0]?.value || '0'),
        parseInt(metricValues[1]?.value || '0')
      ),
      sessions: parseInt(metricValues[2]?.value || '0'),
      bounceRate: parseFloat(metricValues[3]?.value || '0'),
      engagementRate: parseFloat(metricValues[4]?.value || '0'),
      averageEngagementTime: parseFloat(metricValues[5]?.value || '0'),
      eventsPerSession: parseFloat(metricValues[6]?.value || '0'),
      newUsers: parseInt(metricValues[7]?.value || '0'),
      totalUsers: parseInt(metricValues[8]?.value || '0'),
    };
  }

  /**
   * Create empty metrics object for URLs with no data
   */
  private createEmptyMetrics(
    url: string,
    dateRange: { startDate: string; endDate: string }
  ): GA4Metrics {
    return {
      url,
      dateRange,
      revenue: 0,
      transactions: 0,
      conversionRate: 0,
      averageOrderValue: 0,
      sessions: 0,
      bounceRate: 0,
      engagementRate: 0,
      averageEngagementTime: 0,
      eventsPerSession: 0,
      newUsers: 0,
      totalUsers: 0,
    };
  }

  /**
   * Extract path from full URL for GA4 dimension matching
   */
  private extractPath(url: string): string {
    try {
      const urlObj = new URL(url);
      // Include pathname and query string (GA4 landingPagePlusQueryString)
      return urlObj.pathname + urlObj.search;
    } catch {
      // If URL parsing fails, return as-is
      return url;
    }
  }

  /**
   * Calculate conversion rate
   */
  private calculateConversionRate(transactions: number, sessions: number): number {
    if (sessions === 0) return 0;
    return Math.round((transactions / sessions) * 10000) / 100; // Percentage with 2 decimals
  }

  /**
   * Calculate average order value
   */
  private calculateAOV(revenue: number, transactions: number): number {
    if (transactions === 0) return 0;
    return Math.round((revenue / transactions) * 100) / 100; // Round to 2 decimals
  }

  /**
   * Get data from cache
   */
  private getFromCache(key: string): GA4Metrics | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    const now = Date.now();
    if (now - cached.timestamp > cached.ttl) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  /**
   * Set data in cache
   */
  private setCache(key: string, data: GA4Metrics): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: this.cacheTTL,
    });

    // Clean up old cache entries
    this.cleanupCache();
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Chunk array into smaller batches
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Handle and format GA4 API errors
   */
  private handleError(error: any): GA4Error {
    const ga4Error = new Error(error.message) as GA4Error;
    ga4Error.name = 'GA4Error';
    ga4Error.code = error.code || 'UNKNOWN_ERROR';
    ga4Error.statusCode = error.statusCode;
    ga4Error.details = error.details;

    // Check for quota exceeded
    if (error.message?.includes('quota') || error.code === 'RESOURCE_EXHAUSTED') {
      ga4Error.quotaExceeded = true;
      ga4Error.message = 'GA4 API quota exceeded. Please try again later.';
    }

    return ga4Error;
  }

  /**
   * Clear all cached data
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; entries: number } {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.values()).filter(
        (entry) => Date.now() - entry.timestamp <= entry.ttl
      ).length,
    };
  }
}