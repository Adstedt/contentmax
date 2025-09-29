/**
 * Google Search Console API Service
 *
 * Handles fetching and processing search performance data from GSC
 */

import { google, searchconsole_v1 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { supabase } from '@/lib/external/supabase/client';

export interface SearchMetric {
  url: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  date: string;
}

export interface GSCConfig {
  siteUrl: string;
  startDate: string;
  endDate: string;
  rowLimit?: number;
}

export class GSCService {
  private searchConsole: searchconsole_v1.Searchconsole;
  private siteUrl: string;
  private oauth2Client: OAuth2Client;

  constructor() {
    this.siteUrl = process.env.NEXT_PUBLIC_SITE_URL || '';
    this.oauth2Client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
  }

  /**
   * Initialize the service with user tokens
   */
  async initialize(accessToken: string, refreshToken?: string) {
    this.oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    this.searchConsole = google.searchconsole({
      version: 'v1',
      auth: this.oauth2Client
    });
  }

  /**
   * Set custom site URL (override environment variable)
   */
  setSiteUrl(url: string) {
    this.siteUrl = url;
  }

  /**
   * Fetch search metrics from GSC
   */
  async fetchSearchMetrics(config: Partial<GSCConfig> = {}): Promise<SearchMetric[]> {
    const endDate = config.endDate || new Date().toISOString().split('T')[0];
    const startDate = config.startDate || this.getDateDaysAgo(30);
    const siteUrl = config.siteUrl || this.siteUrl;

    if (!siteUrl) {
      throw new Error('Site URL is required for GSC API');
    }

    try {
      const response = await this.searchConsole.searchanalytics.query({
        siteUrl,
        requestBody: {
          startDate,
          endDate,
          dimensions: ['page', 'date'],
          metrics: ['clicks', 'impressions', 'ctr', 'position'],
          rowLimit: config.rowLimit || 25000,
          startRow: 0,
        },
      });

      return this.transformGSCResponse(response.data);
    } catch (error) {
      console.error('Error fetching GSC data:', error);
      throw this.handleGSCError(error);
    }
  }

  /**
   * Fetch metrics for specific URLs
   */
  async fetchMetricsForUrls(urls: string[], dateRange?: { start: string; end: string }): Promise<SearchMetric[]> {
    const endDate = dateRange?.end || new Date().toISOString().split('T')[0];
    const startDate = dateRange?.start || this.getDateDaysAgo(30);

    if (!this.siteUrl) {
      throw new Error('Site URL is required for GSC API');
    }

    try {
      const response = await this.searchConsole.searchanalytics.query({
        siteUrl: this.siteUrl,
        requestBody: {
          startDate,
          endDate,
          dimensions: ['page'],
          metrics: ['clicks', 'impressions', 'ctr', 'position'],
          dimensionFilterGroups: [{
            filters: urls.map(url => ({
              dimension: 'page',
              operator: 'equals',
              expression: url
            }))
          }],
          rowLimit: 5000,
        },
      });

      return this.transformGSCResponse(response.data);
    } catch (error) {
      console.error('Error fetching GSC data for URLs:', error);
      throw this.handleGSCError(error);
    }
  }

  /**
   * Fetch top performing pages
   */
  async fetchTopPages(limit: number = 100): Promise<SearchMetric[]> {
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = this.getDateDaysAgo(30);

    if (!this.siteUrl) {
      throw new Error('Site URL is required for GSC API');
    }

    try {
      const response = await this.searchConsole.searchanalytics.query({
        siteUrl: this.siteUrl,
        requestBody: {
          startDate,
          endDate,
          dimensions: ['page'],
          metrics: ['clicks', 'impressions', 'ctr', 'position'],
          rowLimit: limit,
          startRow: 0,
        },
      });

      return this.transformGSCResponse(response.data);
    } catch (error) {
      console.error('Error fetching top pages:', error);
      throw this.handleGSCError(error);
    }
  }

  /**
   * Store metrics in database
   */
  async storeMetrics(metrics: SearchMetric[], userId: string): Promise<void> {
    if (!metrics || metrics.length === 0) {
      console.log('No metrics to store');
      return;
    }

    // Prepare batch insert data
    const metricsData = metrics.map(metric => ({
      url: metric.url,
      clicks: metric.clicks,
      impressions: metric.impressions,
      ctr: metric.ctr,
      position: metric.position,
      date: metric.date,
      user_id: userId,
    }));

    // Batch insert with upsert
    const { error } = await supabase
      .from('search_metrics')
      .upsert(metricsData, {
        onConflict: 'url,date,user_id',
        ignoreDuplicates: false
      });

    if (error) {
      console.error('Error storing metrics:', error);
      throw new Error(`Failed to store metrics: ${error.message}`);
    }

    // Update sync status
    await this.updateSyncStatus(userId, metrics.length);
  }

  /**
   * Update sync status
   */
  private async updateSyncStatus(userId: string, metricsCount: number) {
    const { error } = await supabase
      .from('gsc_sync_status')
      .upsert({
        user_id: userId,
        last_sync_at: new Date().toISOString(),
        sync_status: 'completed',
        metrics_synced: metricsCount,
        sync_message: `Successfully synced ${metricsCount} metrics`,
      }, {
        onConflict: 'user_id'
      });

    if (error) {
      console.error('Error updating sync status:', error);
    }
  }

  /**
   * Transform GSC API response to our format
   */
  private transformGSCResponse(data: searchconsole_v1.Schema$SearchAnalyticsQueryResponse): SearchMetric[] {
    if (!data.rows || data.rows.length === 0) {
      return [];
    }

    return data.rows.map(row => {
      const url = row.keys?.[0] || '';
      const date = row.keys?.[1] || new Date().toISOString().split('T')[0];

      return {
        url,
        date,
        clicks: Math.round(row.clicks || 0),
        impressions: Math.round(row.impressions || 0),
        ctr: parseFloat((row.ctr || 0).toFixed(4)),
        position: parseFloat((row.position || 0).toFixed(1)),
      };
    });
  }

  /**
   * Get date N days ago in YYYY-MM-DD format
   */
  private getDateDaysAgo(days: number): string {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString().split('T')[0];
  }

  /**
   * Handle GSC API errors
   */
  private handleGSCError(error: any): Error {
    if (error.code === 401) {
      return new Error('Authentication failed. Please reconnect your Google account.');
    }
    if (error.code === 403) {
      return new Error('Permission denied. Please ensure you have access to this Search Console property.');
    }
    if (error.code === 429) {
      return new Error('Rate limit exceeded. Please try again later.');
    }
    if (error.message) {
      return new Error(`GSC API error: ${error.message}`);
    }
    return new Error('An unexpected error occurred while fetching GSC data');
  }

  /**
   * Verify site ownership/access
   */
  async verifySiteAccess(): Promise<boolean> {
    if (!this.siteUrl) {
      return false;
    }

    try {
      const response = await this.searchConsole.sites.get({
        siteUrl: this.siteUrl,
      });

      return response.status === 200;
    } catch (error) {
      console.error('Error verifying site access:', error);
      return false;
    }
  }

  /**
   * Get list of verified sites
   */
  async getVerifiedSites(): Promise<string[]> {
    try {
      const response = await this.searchConsole.sites.list();

      if (!response.data.siteEntry) {
        return [];
      }

      return response.data.siteEntry
        .filter(site => site.permissionLevel !== 'siteUnverifiedUser')
        .map(site => site.siteUrl || '')
        .filter(url => url.length > 0);
    } catch (error) {
      console.error('Error fetching verified sites:', error);
      return [];
    }
  }
}