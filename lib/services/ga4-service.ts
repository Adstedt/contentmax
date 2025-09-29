/**
 * Google Analytics 4 API Service
 *
 * Handles fetching and processing analytics data from GA4
 */

import { BetaAnalyticsDataClient } from '@google-analytics/data';
import { OAuth2Client } from 'google-auth-library';
import { supabase } from '@/lib/external/supabase/client';

export interface AnalyticsMetric {
  pagePath: string;
  category?: string;
  sessions: number;
  users: number;
  revenue: number;
  transactions: number;
  conversionRate: number;
  avgOrderValue: number;
  engagementRate: number;
  bounceRate: number;
  avgSessionDuration: number;
  pageViews: number;
  date: string;
}

export interface ProductMetric {
  itemId: string;
  itemName: string;
  itemCategory?: string;
  itemRevenue: number;
  itemsPurchased: number;
  itemsViewed: number;
  cartAdditions: number;
  cartRemovals: number;
  purchaseToViewRate: number;
  date: string;
}

export interface GA4Config {
  propertyId: string;
  startDate: string;
  endDate: string;
  limit?: number;
}

export class GA4Service {
  private analyticsDataClient: BetaAnalyticsDataClient | null = null;
  private propertyId: string;
  private oauth2Client: OAuth2Client;

  constructor(propertyId: string) {
    this.propertyId = propertyId;
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

    this.analyticsDataClient = new BetaAnalyticsDataClient({
      authClient: this.oauth2Client,
    });
  }

  /**
   * Set property ID
   */
  setPropertyId(propertyId: string) {
    this.propertyId = propertyId;
  }

  /**
   * Fetch page-level metrics from GA4
   */
  async fetchPageMetrics(config: Partial<GA4Config> = {}): Promise<AnalyticsMetric[]> {
    if (!this.analyticsDataClient) {
      throw new Error('GA4 client not initialized. Call initialize() first.');
    }

    const endDate = config.endDate || new Date().toISOString().split('T')[0];
    const startDate = config.startDate || this.getDateDaysAgo(30);
    const propertyId = config.propertyId || this.propertyId;

    if (!propertyId) {
      throw new Error('GA4 Property ID is required');
    }

    try {
      const [response] = await this.analyticsDataClient.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [{ startDate, endDate }],
        dimensions: [
          { name: 'pagePath' },
          { name: 'date' },
        ],
        metrics: [
          { name: 'sessions' },
          { name: 'totalUsers' },
          { name: 'totalRevenue' },
          { name: 'transactions' },
          { name: 'engagementRate' },
          { name: 'bounceRate' },
          { name: 'averageSessionDuration' },
          { name: 'screenPageViews' },
        ],
        limit: config.limit || 10000,
      });

      return this.transformPageMetrics(response);
    } catch (error) {
      console.error('Error fetching GA4 page metrics:', error);
      throw this.handleGA4Error(error);
    }
  }

  /**
   * Fetch e-commerce product metrics
   */
  async fetchProductMetrics(config: Partial<GA4Config> = {}): Promise<ProductMetric[]> {
    if (!this.analyticsDataClient) {
      throw new Error('GA4 client not initialized. Call initialize() first.');
    }

    const endDate = config.endDate || new Date().toISOString().split('T')[0];
    const startDate = config.startDate || this.getDateDaysAgo(30);
    const propertyId = config.propertyId || this.propertyId;

    if (!propertyId) {
      throw new Error('GA4 Property ID is required');
    }

    try {
      const [response] = await this.analyticsDataClient.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [{ startDate, endDate }],
        dimensions: [
          { name: 'itemId' },
          { name: 'itemName' },
          { name: 'itemCategory' },
          { name: 'date' },
        ],
        metrics: [
          { name: 'itemRevenue' },
          { name: 'itemsPurchased' },
          { name: 'itemsViewed' },
          { name: 'itemsAddedToCart' },
          { name: 'itemsRemovedFromCart' },
          { name: 'itemPurchaseToViewRate' },
        ],
        limit: config.limit || 10000,
      });

      return this.transformProductMetrics(response);
    } catch (error) {
      console.error('Error fetching GA4 product metrics:', error);
      throw this.handleGA4Error(error);
    }
  }

  /**
   * Fetch revenue by category
   */
  async fetchCategoryRevenue(config: Partial<GA4Config> = {}): Promise<any[]> {
    if (!this.analyticsDataClient) {
      throw new Error('GA4 client not initialized. Call initialize() first.');
    }

    const endDate = config.endDate || new Date().toISOString().split('T')[0];
    const startDate = config.startDate || this.getDateDaysAgo(30);
    const propertyId = config.propertyId || this.propertyId;

    try {
      const [response] = await this.analyticsDataClient.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [{ startDate, endDate }],
        dimensions: [
          { name: 'itemCategory' },
          { name: 'date' },
        ],
        metrics: [
          { name: 'itemRevenue' },
          { name: 'itemsPurchased' },
          { name: 'itemsViewed' },
          { name: 'itemPurchaseToViewRate' },
          { name: 'averagePurchaseRevenue' },
        ],
        limit: config.limit || 5000,
      });

      return this.transformCategoryMetrics(response);
    } catch (error) {
      console.error('Error fetching category revenue:', error);
      throw this.handleGA4Error(error);
    }
  }

  /**
   * Store metrics in database
   */
  async storePageMetrics(metrics: AnalyticsMetric[], userId: string): Promise<void> {
    if (!metrics || metrics.length === 0) {
      console.log('No metrics to store');
      return;
    }

    // Prepare batch insert data
    const metricsData = metrics.map(metric => ({
      page_path: metric.pagePath,
      sessions: metric.sessions,
      users: metric.users,
      revenue: metric.revenue,
      transactions: metric.transactions,
      conversion_rate: metric.conversionRate,
      avg_order_value: metric.avgOrderValue,
      engagement_rate: metric.engagementRate,
      bounce_rate: metric.bounceRate,
      avg_session_duration: Math.round(metric.avgSessionDuration),
      page_views: metric.pageViews,
      date: metric.date,
      user_id: userId,
    }));

    // Batch insert with upsert
    const { error } = await supabase
      .from('analytics_metrics')
      .upsert(metricsData, {
        onConflict: 'page_path,date,user_id',
        ignoreDuplicates: false,
      });

    if (error) {
      console.error('Error storing analytics metrics:', error);
      throw new Error(`Failed to store metrics: ${error.message}`);
    }

    // Update sync status
    await this.updateSyncStatus(userId, metrics.length);
  }

  /**
   * Store product metrics in database
   */
  async storeProductMetrics(metrics: ProductMetric[], userId: string): Promise<void> {
    if (!metrics || metrics.length === 0) {
      console.log('No product metrics to store');
      return;
    }

    const metricsData = metrics.map(metric => ({
      product_id: metric.itemId,
      item_name: metric.itemName,
      item_category: metric.itemCategory,
      item_revenue: metric.itemRevenue,
      items_purchased: metric.itemsPurchased,
      items_viewed: metric.itemsViewed,
      cart_additions: metric.cartAdditions,
      cart_removals: metric.cartRemovals,
      purchase_to_view_rate: metric.purchaseToViewRate,
      date: metric.date,
      user_id: userId,
    }));

    const { error } = await supabase
      .from('product_analytics')
      .upsert(metricsData, {
        onConflict: 'product_id,date,user_id',
        ignoreDuplicates: false,
      });

    if (error) {
      console.error('Error storing product metrics:', error);
      throw new Error(`Failed to store product metrics: ${error.message}`);
    }
  }

  /**
   * Update sync status
   */
  private async updateSyncStatus(userId: string, metricsCount: number) {
    const { error } = await supabase
      .from('ga4_sync_status')
      .upsert({
        user_id: userId,
        property_id: this.propertyId,
        last_sync_at: new Date().toISOString(),
        sync_status: 'completed',
        metrics_synced: metricsCount,
        sync_message: `Successfully synced ${metricsCount} metrics`,
      }, {
        onConflict: 'user_id,property_id',
      });

    if (error) {
      console.error('Error updating sync status:', error);
    }
  }

  /**
   * Transform GA4 page metrics response
   */
  private transformPageMetrics(response: any): AnalyticsMetric[] {
    if (!response.rows || response.rows.length === 0) {
      return [];
    }

    return response.rows.map((row: any) => {
      const pagePath = row.dimensionValues?.[0]?.value || '';
      const date = row.dimensionValues?.[1]?.value || new Date().toISOString().split('T')[0];

      const sessions = parseInt(row.metricValues?.[0]?.value || '0');
      const transactions = parseInt(row.metricValues?.[3]?.value || '0');
      const revenue = parseFloat(row.metricValues?.[2]?.value || '0');

      return {
        pagePath,
        date,
        sessions,
        users: parseInt(row.metricValues?.[1]?.value || '0'),
        revenue,
        transactions,
        conversionRate: sessions > 0 ? transactions / sessions : 0,
        avgOrderValue: transactions > 0 ? revenue / transactions : 0,
        engagementRate: parseFloat(row.metricValues?.[4]?.value || '0'),
        bounceRate: parseFloat(row.metricValues?.[5]?.value || '0'),
        avgSessionDuration: parseFloat(row.metricValues?.[6]?.value || '0'),
        pageViews: parseInt(row.metricValues?.[7]?.value || '0'),
      };
    });
  }

  /**
   * Transform GA4 product metrics response
   */
  private transformProductMetrics(response: any): ProductMetric[] {
    if (!response.rows || response.rows.length === 0) {
      return [];
    }

    return response.rows.map((row: any) => ({
      itemId: row.dimensionValues?.[0]?.value || '',
      itemName: row.dimensionValues?.[1]?.value || '',
      itemCategory: row.dimensionValues?.[2]?.value || '',
      date: row.dimensionValues?.[3]?.value || new Date().toISOString().split('T')[0],
      itemRevenue: parseFloat(row.metricValues?.[0]?.value || '0'),
      itemsPurchased: parseInt(row.metricValues?.[1]?.value || '0'),
      itemsViewed: parseInt(row.metricValues?.[2]?.value || '0'),
      cartAdditions: parseInt(row.metricValues?.[3]?.value || '0'),
      cartRemovals: parseInt(row.metricValues?.[4]?.value || '0'),
      purchaseToViewRate: parseFloat(row.metricValues?.[5]?.value || '0'),
    }));
  }

  /**
   * Transform category metrics response
   */
  private transformCategoryMetrics(response: any): any[] {
    if (!response.rows || response.rows.length === 0) {
      return [];
    }

    return response.rows.map((row: any) => ({
      category: row.dimensionValues?.[0]?.value || '',
      date: row.dimensionValues?.[1]?.value || new Date().toISOString().split('T')[0],
      revenue: parseFloat(row.metricValues?.[0]?.value || '0'),
      itemsPurchased: parseInt(row.metricValues?.[1]?.value || '0'),
      itemsViewed: parseInt(row.metricValues?.[2]?.value || '0'),
      purchaseToViewRate: parseFloat(row.metricValues?.[3]?.value || '0'),
      avgOrderValue: parseFloat(row.metricValues?.[4]?.value || '0'),
    }));
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
   * Handle GA4 API errors
   */
  private handleGA4Error(error: any): Error {
    if (error.code === 401 || error.code === 'UNAUTHENTICATED') {
      return new Error('Authentication failed. Please reconnect your Google account.');
    }
    if (error.code === 403 || error.code === 'PERMISSION_DENIED') {
      return new Error('Permission denied. Please ensure you have access to this GA4 property.');
    }
    if (error.code === 429 || error.code === 'RESOURCE_EXHAUSTED') {
      return new Error('Rate limit exceeded. Please try again later.');
    }
    if (error.code === 404 || error.code === 'NOT_FOUND') {
      return new Error('GA4 property not found. Please check your property ID.');
    }
    if (error.message) {
      return new Error(`GA4 API error: ${error.message}`);
    }
    return new Error('An unexpected error occurred while fetching GA4 data');
  }

  /**
   * Verify property access
   */
  async verifyPropertyAccess(): Promise<boolean> {
    if (!this.analyticsDataClient || !this.propertyId) {
      return false;
    }

    try {
      // Try to fetch minimal data to verify access
      await this.analyticsDataClient.runReport({
        property: `properties/${this.propertyId}`,
        dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
        dimensions: [{ name: 'date' }],
        metrics: [{ name: 'sessions' }],
        limit: 1,
      });

      return true;
    } catch (error) {
      console.error('Error verifying property access:', error);
      return false;
    }
  }
}