import { google, content_v2_1 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

export interface OAuth2Credentials {
  accessToken?: string;
  refreshToken?: string;
  expiryDate?: number;
}

export interface MerchantConfig {
  merchantId: string;
  accountId: string;
  credentials?: OAuth2Credentials;
  feedSettings: FeedSettings;
}

export interface FeedSettings {
  primaryFeedId: string;
  supplementalFeeds?: string[];
  updateFrequency: 'hourly' | 'daily' | 'weekly';
  deltaSync: boolean;
}

export interface ProductFeed {
  feedId: string;
  products: Record<string, unknown>[];
  totalCount: number;
  nextPageToken?: string;
}

export class GoogleMerchantClient {
  private client: content_v2_1.Content | null = null;
  private oauth2Client: OAuth2Client;
  private config: MerchantConfig;

  constructor(config: MerchantConfig) {
    this.config = config;
    this.oauth2Client = new OAuth2Client(
      process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback`
    );

    if (config.credentials?.refreshToken) {
      this.oauth2Client.setCredentials({
        refresh_token: config.credentials.refreshToken,
      });
    }
  }

  async authenticate(refreshToken?: string): Promise<void> {
    if (refreshToken) {
      this.oauth2Client.setCredentials({
        refresh_token: refreshToken,
      });
    }

    this.client = google.content({
      version: 'v2.1',
      auth: this.oauth2Client,
    });
  }

  async getAuthUrl(): Promise<string> {
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/content',
        'https://www.googleapis.com/auth/manufacturercenter',
      ],
      prompt: 'consent',
    });
  }

  async getTokenFromCode(code: string): Promise<OAuth2Credentials> {
    const { tokens } = await this.oauth2Client.getToken(code);
    this.oauth2Client.setCredentials(tokens);
    
    return {
      accessToken: tokens.access_token || undefined,
      refreshToken: tokens.refresh_token || undefined,
      expiryDate: tokens.expiry_date || undefined,
    };
  }

  async getProductFeed(
    feedId?: string,
    pageToken?: string,
    maxResults = 250
  ): Promise<ProductFeed> {
    if (!this.client) {
      throw new Error('Client not authenticated. Call authenticate() first.');
    }

    try {
      const response = await this.client.products.list({
        merchantId: this.config.merchantId,
        maxResults,
        pageToken,
      });

      const products = response.data.resources || [];
      
      return {
        feedId: feedId || this.config.feedSettings.primaryFeedId,
        products: products.map(this.normalizeProduct),
        totalCount: products.length,
        nextPageToken: response.data.nextPageToken || undefined,
      };
    } catch (error: any) {
      if (error.code === 401) {
        throw new Error('Authentication failed. Please re-authenticate.');
      }
      throw error;
    }
  }

  async getAllProducts(feedId?: string): Promise<ProductFeed> {
    const allProducts: any[] = [];
    let pageToken: string | undefined;
    let totalCount = 0;

    do {
      const feed = await this.getProductFeed(feedId, pageToken);
      allProducts.push(...feed.products);
      totalCount += feed.products.length;
      pageToken = feed.nextPageToken;
    } while (pageToken);

    return {
      feedId: feedId || this.config.feedSettings.primaryFeedId,
      products: allProducts,
      totalCount,
    };
  }

  async getProductById(productId: string): Promise<any> {
    if (!this.client) {
      throw new Error('Client not authenticated. Call authenticate() first.');
    }

    const response = await this.client.products.get({
      merchantId: this.config.merchantId,
      productId,
    });

    return this.normalizeProduct(response.data);
  }

  private normalizeProduct(product: any): any {
    return {
      id: product.id || product.offerId,
      title: product.title,
      description: product.description,
      link: product.link,
      imageLink: product.imageLink,
      additionalImageLinks: product.additionalImageLinks,
      price: product.price ? {
        value: parseFloat(product.price.value),
        currency: product.price.currency,
      } : undefined,
      salePrice: product.salePrice ? {
        value: parseFloat(product.salePrice.value),
        currency: product.salePrice.currency,
      } : undefined,
      availability: product.availability,
      brand: product.brand,
      gtin: product.gtin,
      mpn: product.mpn,
      productType: product.productType,
      googleProductCategory: product.googleProductCategory,
      customAttributes: product.customAttributes,
      condition: product.condition,
      channel: product.channel,
      contentLanguage: product.contentLanguage,
      targetCountry: product.targetCountry,
    };
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.getProductFeed(undefined, undefined, 1);
      return true;
    } catch (error) {
      console.error('Connection test failed:', error);
      return false;
    }
  }
}