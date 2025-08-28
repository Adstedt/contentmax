import { google, webmasters_v3 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { 
  GSCMetrics,
  GSCPerformanceData,
  GSCQueryOptions,
  GSCResponse,
  GSCError,
  GSCErrorCode,
  QueryData,
  PageData,
  DailyMetric,
  CountryData,
  DeviceData,
  GSC_LIMITS
} from '@/types/google.types';
import { GoogleOAuthClient } from './google-oauth';
import { GSCDataCache } from './gsc-cache';

export class SearchConsoleClient {
  private webmasters: webmasters_v3.Webmasters;
  private authClient: OAuth2Client | null = null;
  private cache: GSCDataCache;
  private oauthClient: GoogleOAuthClient;
  private requestCount: number = 0;
  private lastRequestTime: Date = new Date();

  constructor() {
    this.webmasters = google.webmasters('v3');
    this.cache = new GSCDataCache();
    this.oauthClient = new GoogleOAuthClient();
  }

  /**
   * Initialize client with user authentication
   */
  async initialize(userId: string): Promise<void> {
    this.authClient = await this.oauthClient.getAuthenticatedClient(userId);
    this.webmasters = google.webmasters({
      version: 'v3',
      auth: this.authClient,
    });
  }

  /**
   * Get list of sites the user has access to
   */
  async getSites(): Promise<string[]> {
    if (!this.authClient) {
      throw new GSCError('Client not initialized', GSCErrorCode.INVALID_CREDENTIALS);
    }

    try {
      await this.checkRateLimit();
      
      const response = await this.webmasters.sites.list();
      const sites = response.data.siteEntry || [];
      
      return sites.map(site => site.siteUrl || '').filter(Boolean);
    } catch (error: any) {
      throw this.handleApiError(error);
    }
  }

  /**
   * Fetch search analytics data
   */
  async getSearchAnalytics(
    siteUrl: string,
    options: GSCQueryOptions
  ): Promise<GSCPerformanceData> {
    if (!this.authClient) {
      throw new GSCError('Client not initialized', GSCErrorCode.INVALID_CREDENTIALS);
    }

    // Check cache first
    const cacheKey = this.cache.generateKey({
      projectId: '',
      siteUrl,
      startDate: options.startDate,
      endDate: options.endDate,
      dimensions: options.dimensions?.join(','),
    });

    const cachedData = await this.cache.get<GSCPerformanceData>(cacheKey);
    if (cachedData) {
      return cachedData;
    }

    try {
      await this.checkRateLimit();

      // Fetch overall metrics
      const overallMetrics = await this.fetchMetrics(siteUrl, options);

      // Fetch data by dimensions
      const [queries, pages, countries, devices, dailyData] = await Promise.all([
        this.fetchQueries(siteUrl, options),
        this.fetchPages(siteUrl, options),
        this.fetchCountries(siteUrl, options),
        this.fetchDevices(siteUrl, options),
        this.fetchDailyData(siteUrl, options),
      ]);

      const performanceData: GSCPerformanceData = {
        ...overallMetrics,
        queries,
        pages,
        countries,
        devices,
        dailyData,
      };

      // Cache the results
      await this.cache.set(cacheKey, performanceData, 24 * 60 * 60); // 24 hours TTL

      return performanceData;
    } catch (error: any) {
      throw this.handleApiError(error);
    }
  }

  /**
   * Fetch overall metrics
   */
  private async fetchMetrics(
    siteUrl: string,
    options: GSCQueryOptions
  ): Promise<GSCMetrics> {
    const response = await this.webmasters.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate: options.startDate,
        endDate: options.endDate,
        dimensionFilterGroups: options.dimensionFilterGroups,
        aggregationType: options.aggregationType,
        dataState: options.dataState,
      },
    });

    const data = response.data as GSCResponse;
    
    if (!data.rows || data.rows.length === 0) {
      return { clicks: 0, impressions: 0, ctr: 0, position: 0 };
    }

    const row = data.rows[0];
    return {
      clicks: row.clicks || 0,
      impressions: row.impressions || 0,
      ctr: row.ctr || 0,
      position: row.position || 0,
    };
  }

  /**
   * Fetch query data
   */
  private async fetchQueries(
    siteUrl: string,
    options: GSCQueryOptions
  ): Promise<QueryData[]> {
    const response = await this.webmasters.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate: options.startDate,
        endDate: options.endDate,
        dimensions: ['query'],
        dimensionFilterGroups: options.dimensionFilterGroups,
        rowLimit: Math.min(options.rowLimit || 1000, GSC_LIMITS.rowsPerRequest),
        dataState: options.dataState,
      },
    });

    const data = response.data as GSCResponse;
    
    if (!data.rows) {
      return [];
    }

    return data.rows.map(row => ({
      query: row.keys?.[0] || '',
      clicks: row.clicks || 0,
      impressions: row.impressions || 0,
      ctr: row.ctr || 0,
      position: row.position || 0,
    }));
  }

  /**
   * Fetch page data
   */
  private async fetchPages(
    siteUrl: string,
    options: GSCQueryOptions
  ): Promise<PageData[]> {
    const response = await this.webmasters.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate: options.startDate,
        endDate: options.endDate,
        dimensions: ['page'],
        dimensionFilterGroups: options.dimensionFilterGroups,
        rowLimit: Math.min(options.rowLimit || 1000, GSC_LIMITS.rowsPerRequest),
        dataState: options.dataState,
      },
    });

    const data = response.data as GSCResponse;
    
    if (!data.rows) {
      return [];
    }

    return data.rows.map(row => ({
      page: row.keys?.[0] || '',
      clicks: row.clicks || 0,
      impressions: row.impressions || 0,
      ctr: row.ctr || 0,
      position: row.position || 0,
    }));
  }

  /**
   * Fetch country data
   */
  private async fetchCountries(
    siteUrl: string,
    options: GSCQueryOptions
  ): Promise<CountryData[]> {
    const response = await this.webmasters.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate: options.startDate,
        endDate: options.endDate,
        dimensions: ['country'],
        dimensionFilterGroups: options.dimensionFilterGroups,
        rowLimit: 100, // Limit countries
        dataState: options.dataState,
      },
    });

    const data = response.data as GSCResponse;
    
    if (!data.rows) {
      return [];
    }

    return data.rows.map(row => ({
      country: row.keys?.[0] || '',
      clicks: row.clicks || 0,
      impressions: row.impressions || 0,
      ctr: row.ctr || 0,
      position: row.position || 0,
    }));
  }

  /**
   * Fetch device data
   */
  private async fetchDevices(
    siteUrl: string,
    options: GSCQueryOptions
  ): Promise<DeviceData[]> {
    const response = await this.webmasters.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate: options.startDate,
        endDate: options.endDate,
        dimensions: ['device'],
        dimensionFilterGroups: options.dimensionFilterGroups,
        dataState: options.dataState,
      },
    });

    const data = response.data as GSCResponse;
    
    if (!data.rows) {
      return [];
    }

    return data.rows.map(row => ({
      device: (row.keys?.[0] || 'desktop') as 'desktop' | 'mobile' | 'tablet',
      clicks: row.clicks || 0,
      impressions: row.impressions || 0,
      ctr: row.ctr || 0,
      position: row.position || 0,
    }));
  }

  /**
   * Fetch daily time series data
   */
  private async fetchDailyData(
    siteUrl: string,
    options: GSCQueryOptions
  ): Promise<DailyMetric[]> {
    const response = await this.webmasters.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate: options.startDate,
        endDate: options.endDate,
        dimensions: ['date'],
        dimensionFilterGroups: options.dimensionFilterGroups,
        dataState: options.dataState,
      },
    });

    const data = response.data as GSCResponse;
    
    if (!data.rows) {
      return [];
    }

    return data.rows
      .map(row => ({
        date: row.keys?.[0] || '',
        clicks: row.clicks || 0,
        impressions: row.impressions || 0,
        ctr: row.ctr || 0,
        position: row.position || 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Check and enforce rate limits
   */
  private async checkRateLimit(): Promise<void> {
    const now = new Date();
    const timeSinceLastRequest = now.getTime() - this.lastRequestTime.getTime();
    
    // Check per-minute limit
    if (timeSinceLastRequest < 60000) { // Within the same minute
      if (this.requestCount >= GSC_LIMITS.requestsPerMinute) {
        const waitTime = 60000 - timeSinceLastRequest;
        await this.delay(waitTime);
        this.requestCount = 0;
      }
    } else {
      this.requestCount = 0;
    }

    this.requestCount++;
    this.lastRequestTime = now;
  }

  /**
   * Delay for rate limiting
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Handle API errors
   */
  private handleApiError(error: any): GSCError {
    if (error.code === 401) {
      return new GSCError('Authentication failed', GSCErrorCode.INVALID_CREDENTIALS, error);
    }
    
    if (error.code === 403) {
      if (error.message?.includes('quota')) {
        return new GSCError('API quota exceeded', GSCErrorCode.QUOTA_EXCEEDED, error);
      }
      return new GSCError('No access to this property', GSCErrorCode.NO_ACCESS, error);
    }
    
    if (error.code === 429) {
      return new GSCError('Rate limit exceeded', GSCErrorCode.QUOTA_EXCEEDED, error);
    }
    
    if (error.code >= 500) {
      return new GSCError('Google API error', GSCErrorCode.NETWORK_ERROR, error);
    }
    
    return new GSCError('API request failed', GSCErrorCode.INVALID_REQUEST, error);
  }

  /**
   * Store performance data in database
   */
  async storePerformanceData(
    projectId: string,
    siteUrl: string,
    data: GSCPerformanceData
  ): Promise<void> {
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();

    // Store daily metrics
    const dailyRecords = data.dailyData.map(day => ({
      project_id: projectId,
      url: siteUrl,
      date: day.date,
      clicks: day.clicks,
      impressions: day.impressions,
      ctr: day.ctr,
      position: day.position,
      data: {
        queries: data.queries.slice(0, 10), // Top 10 queries
        pages: data.pages.slice(0, 10), // Top 10 pages
        devices: data.devices,
        countries: data.countries.slice(0, 5), // Top 5 countries
      } as any, // Type workaround for Json field
    }));

    const { error } = await supabase
      .from('gsc_data')
      .insert(dailyRecords);

    if (error) {
      console.error('Error storing GSC data:', error);
      throw new GSCError('Failed to store performance data', GSCErrorCode.INVALID_REQUEST, error);
    }
  }
}