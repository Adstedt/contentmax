import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { IntegrationManager, TokenData } from '../integration-manager';
import { logger } from '../logger';

export interface GA4Config {
  property_id: string;
  data_stream_id?: string;
}

export class GoogleAnalyticsService {
  private oauth2Client: OAuth2Client;
  private integrationManager: IntegrationManager;

  private static readonly SCOPES = [
    'https://www.googleapis.com/auth/analytics.readonly',
    'https://www.googleapis.com/auth/analytics.manage.users.readonly',
  ];

  constructor(
    clientId: string,
    clientSecret: string,
    redirectUri: string,
    integrationManager: IntegrationManager
  ) {
    this.oauth2Client = new OAuth2Client(clientId, clientSecret, redirectUri);
    this.integrationManager = integrationManager;
  }

  // OAuth flow
  getAuthUrl(state: string): string {
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: GoogleAnalyticsService.SCOPES,
      state,
      prompt: 'consent',
    });
  }

  async exchangeCode(code: string): Promise<TokenData> {
    const { tokens } = await this.oauth2Client.getToken(code);

    return {
      access_token: tokens.access_token!,
      refresh_token: tokens.refresh_token || undefined,
      expires_at: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
    };
  }

  async refreshToken(refreshToken: string): Promise<TokenData> {
    this.oauth2Client.setCredentials({
      refresh_token: refreshToken,
    });

    const { credentials } = await this.oauth2Client.refreshAccessToken();

    return {
      access_token: credentials.access_token!,
      refresh_token: credentials.refresh_token || refreshToken,
      expires_at: credentials.expiry_date ? new Date(credentials.expiry_date) : undefined,
    };
  }

  // GA4 API operations
  async validateConnection(connectionId: string): Promise<boolean> {
    return this.integrationManager.validateConnection(connectionId, async (tokens) => {
      try {
        this.oauth2Client.setCredentials({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
        });

        const analytics = google.analyticsadmin({
          version: 'v1beta',
          auth: this.oauth2Client,
        });

        // Test the connection by listing accounts
        const response = await analytics.accounts.list();

        return response.data.accounts !== undefined;
      } catch (error) {
        logger.error('GA4 validation error', error);
        return false;
      }
    });
  }

  async listProperties(connectionId: string): Promise<any[]> {
    const tokens = await this.integrationManager.refreshTokenIfNeeded(
      connectionId,
      (refreshToken) => this.refreshToken(refreshToken)
    );

    if (!tokens) throw new Error('No valid tokens');

    this.oauth2Client.setCredentials({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
    });

    const analytics = google.analyticsadmin({
      version: 'v1beta',
      auth: this.oauth2Client,
    });

    // First get accounts, then list properties with filter
    const accountsResponse = await analytics.accounts.list();
    const accounts = accountsResponse.data.accounts || [];

    if (accounts.length === 0) {
      return [];
    }

    // GA4 Admin API requires a filter parameter
    const filter = accounts.map((acc) => `parent:${acc.name}`).join(' OR ');

    const response = await analytics.properties.list({
      filter,
    });

    return response.data.properties || [];
  }

  async getMetrics(
    connectionId: string,
    propertyId: string,
    startDate: string,
    endDate: string,
    dimensions: string[],
    metrics: string[]
  ): Promise<any> {
    const tokens = await this.integrationManager.refreshTokenIfNeeded(
      connectionId,
      (refreshToken) => this.refreshToken(refreshToken)
    );

    if (!tokens) throw new Error('No valid tokens');

    this.oauth2Client.setCredentials({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
    });

    const analyticsData = google.analyticsdata({
      version: 'v1beta',
      auth: this.oauth2Client,
    });

    const response = await analyticsData.properties.runReport({
      property: propertyId,
      requestBody: {
        dateRanges: [{ startDate, endDate }],
        dimensions: dimensions.map((d) => ({ name: d })),
        metrics: metrics.map((m) => ({ name: m })),
      },
    });

    // Log usage
    await this.integrationManager.logUsage(connectionId, 'fetch_metrics', 'success', {
      records_processed: response.data.rowCount || 0,
      property_id: propertyId,
    });

    return response.data;
  }
}
