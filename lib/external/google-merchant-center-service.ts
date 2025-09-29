import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { IntegrationManager, TokenData } from '../integration-manager';
import { logger } from '../logger';

export interface GMCConfig {
  merchant_id: string;
}

export class GoogleMerchantCenterService {
  private oauth2Client: OAuth2Client;
  private integrationManager: IntegrationManager;

  private static readonly SCOPES = ['https://www.googleapis.com/auth/content'];

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
      scope: GoogleMerchantCenterService.SCOPES,
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

  // GMC API operations
  async validateConnection(connectionId: string): Promise<boolean> {
    return this.integrationManager.validateConnection(connectionId, async (tokens) => {
      try {
        this.oauth2Client.setCredentials({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
        });

        const content = google.content({
          version: 'v2.1',
          auth: this.oauth2Client,
        });

        // Test the connection by accessing authinfo
        const response = await content.accounts.authinfo();

        return response.data.accountIdentifiers !== undefined;
      } catch (error) {
        logger.error('GMC validation error', error);
        return false;
      }
    });
  }

  async getAccountInfo(connectionId: string): Promise<any> {
    const tokens = await this.integrationManager.refreshTokenIfNeeded(
      connectionId,
      (refreshToken) => this.refreshToken(refreshToken)
    );

    if (!tokens) throw new Error('No valid tokens');

    this.oauth2Client.setCredentials({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
    });

    const content = google.content({
      version: 'v2.1',
      auth: this.oauth2Client,
    });

    const response = await content.accounts.authinfo();

    return response.data;
  }

  async listProducts(
    connectionId: string,
    merchantId: string,
    maxResults: number = 100
  ): Promise<any[]> {
    const tokens = await this.integrationManager.refreshTokenIfNeeded(
      connectionId,
      (refreshToken) => this.refreshToken(refreshToken)
    );

    if (!tokens) throw new Error('No valid tokens');

    this.oauth2Client.setCredentials({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
    });

    const content = google.content({
      version: 'v2.1',
      auth: this.oauth2Client,
    });

    const response = await content.products.list({
      merchantId,
      maxResults,
    });

    // Log usage
    await this.integrationManager.logUsage(connectionId, 'list_products', 'success', {
      records_processed: response.data.resources?.length || 0,
      merchant_id: merchantId,
    });

    return response.data.resources || [];
  }

  async getProduct(connectionId: string, merchantId: string, productId: string): Promise<any> {
    const tokens = await this.integrationManager.refreshTokenIfNeeded(
      connectionId,
      (refreshToken) => this.refreshToken(refreshToken)
    );

    if (!tokens) throw new Error('No valid tokens');

    this.oauth2Client.setCredentials({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
    });

    const content = google.content({
      version: 'v2.1',
      auth: this.oauth2Client,
    });

    const response = await content.products.get({
      merchantId,
      productId,
    });

    return response.data;
  }

  async getProductStatus(
    connectionId: string,
    merchantId: string,
    maxResults: number = 100
  ): Promise<any[]> {
    const tokens = await this.integrationManager.refreshTokenIfNeeded(
      connectionId,
      (refreshToken) => this.refreshToken(refreshToken)
    );

    if (!tokens) throw new Error('No valid tokens');

    this.oauth2Client.setCredentials({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
    });

    const content = google.content({
      version: 'v2.1',
      auth: this.oauth2Client,
    });

    const response = await content.productstatuses.list({
      merchantId,
      maxResults,
    });

    return response.data.resources || [];
  }
}
