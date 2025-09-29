import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { IntegrationManager, TokenData } from '../integration-manager';
import { logger } from '../logger';

export interface GSCConfig {
  site_url: string;
}

export class GoogleSearchConsoleService {
  private oauth2Client: OAuth2Client;
  private integrationManager: IntegrationManager;

  private static readonly SCOPES = ['https://www.googleapis.com/auth/webmasters.readonly'];

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
      scope: GoogleSearchConsoleService.SCOPES,
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

  // GSC API operations
  async validateConnection(connectionId: string): Promise<boolean> {
    return this.integrationManager.validateConnection(connectionId, async (tokens) => {
      try {
        this.oauth2Client.setCredentials({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
        });

        const searchConsole = google.searchconsole({
          version: 'v1',
          auth: this.oauth2Client,
        });

        // Test the connection by listing sites
        const response = await searchConsole.sites.list();

        return response.data.siteEntry !== undefined;
      } catch (error) {
        logger.error('GSC validation error', error);
        return false;
      }
    });
  }

  async listSites(connectionId: string): Promise<any[]> {
    const tokens = await this.integrationManager.refreshTokenIfNeeded(
      connectionId,
      (refreshToken) => this.refreshToken(refreshToken)
    );

    if (!tokens) throw new Error('No valid tokens');

    this.oauth2Client.setCredentials({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
    });

    const searchConsole = google.searchconsole({
      version: 'v1',
      auth: this.oauth2Client,
    });

    const response = await searchConsole.sites.list();

    return response.data.siteEntry || [];
  }

  async getSearchAnalytics(
    connectionId: string,
    siteUrl: string,
    startDate: string,
    endDate: string,
    dimensions?: string[]
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

    const searchConsole = google.searchconsole({
      version: 'v1',
      auth: this.oauth2Client,
    });

    const response = await searchConsole.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate,
        endDate,
        dimensions: dimensions || ['query', 'page'],
        rowLimit: 5000,
      },
    });

    // Log usage
    await this.integrationManager.logUsage(connectionId, 'fetch_search_analytics', 'success', {
      records_processed: response.data.rows?.length || 0,
      site_url: siteUrl,
    });

    return response.data;
  }

  async getPageIndexingStatus(
    connectionId: string,
    siteUrl: string,
    pageUrl: string
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

    const searchConsole = google.searchconsole({
      version: 'v1',
      auth: this.oauth2Client,
    });

    const response = await searchConsole.urlInspection.index.inspect({
      requestBody: {
        inspectionUrl: pageUrl,
        siteUrl,
      },
    });

    return response.data;
  }
}
