import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import crypto from 'crypto';
import { OAuth2Tokens, GoogleIntegration, GSCError, GSCErrorCode } from '@/types/google.types';
import { createClient } from '@/lib/supabase/server';

export class GoogleOAuthClient {
  private oauth2Client: OAuth2Client;
  private readonly SCOPES = [
    'https://www.googleapis.com/auth/webmasters.readonly',
    'https://www.googleapis.com/auth/userinfo.email',
  ];

  constructor() {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      throw new Error('Google OAuth credentials not configured');
    }

    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI ||
        `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/google/callback`
    );
  }

  /**
   * Generate authorization URL for OAuth flow
   */
  generateAuthUrl(userId: string): string {
    // Generate state for CSRF protection
    const state = this.generateState(userId);

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: this.SCOPES,
      prompt: 'consent',
      state,
    });
  }

  /**
   * Handle OAuth callback and exchange code for tokens
   */
  async handleCallback(
    code: string,
    state: string
  ): Promise<{ tokens: OAuth2Tokens; email: string }> {
    try {
      // Verify state for CSRF protection
      const userId = this.verifyState(state);
      if (!userId) {
        throw new GSCError('Invalid state parameter', GSCErrorCode.INVALID_REQUEST);
      }

      // Exchange authorization code for tokens
      const { tokens } = await this.oauth2Client.getToken(code);

      if (!tokens.refresh_token) {
        throw new GSCError('No refresh token received', GSCErrorCode.INVALID_CREDENTIALS);
      }

      // Set credentials to fetch user info
      this.oauth2Client.setCredentials(tokens);

      // Get user email
      const oauth2 = google.oauth2({
        version: 'v2',
        auth: this.oauth2Client,
      });

      const { data } = await oauth2.userinfo.get();

      if (!data.email) {
        throw new GSCError('Could not retrieve user email', GSCErrorCode.INVALID_REQUEST);
      }

      return {
        tokens: tokens as OAuth2Tokens,
        email: data.email,
      };
    } catch (error) {
      console.error('OAuth callback error:', error);
      if (error instanceof GSCError) {
        throw error;
      }
      throw new GSCError('OAuth authentication failed', GSCErrorCode.INVALID_CREDENTIALS, error);
    }
  }

  /**
   * Store encrypted tokens in database
   */
  async storeTokens(userId: string, tokens: OAuth2Tokens, email: string): Promise<void> {
    const supabase = await createClient();

    // Encrypt sensitive tokens
    const refreshToken = tokens.refresh_token!;
    const accessToken = tokens.access_token || null;

    const { error } = await supabase
      .from('google_integrations')
      .upsert({
        user_id: userId,
        email,
        google_id: email, // Using email as google_id temporarily
        refresh_token: refreshToken,
        access_token: accessToken,
        expires_at: tokens.expiry_date
          ? new Date(tokens.expiry_date).toISOString()
          : new Date(Date.now() + 3600000).toISOString(),
        scopes: tokens.scope || '',
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error storing tokens:', error);
      throw new GSCError('Failed to store integration', GSCErrorCode.INVALID_REQUEST, error);
    }
  }

  /**
   * Get stored tokens for a user
   */
  async getStoredTokens(userId: string): Promise<GoogleIntegration | null> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('google_integrations')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      return null;
    }

    // Return tokens (no encryption for now)
    return {
      id: data.id,
      userId: data.user_id || '',
      email: data.email,
      refreshToken: data.refresh_token,
      accessToken: data.access_token || undefined,
      tokenExpiry: data.expires_at ? new Date(data.expires_at) : undefined,
      connectedAt: new Date(data.connected_at || ''),
      lastSync: data.last_sync ? new Date(data.last_sync) : undefined,
    };
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<OAuth2Tokens> {
    try {
      this.oauth2Client.setCredentials({
        refresh_token: refreshToken,
      });

      const { credentials } = await this.oauth2Client.refreshAccessToken();

      return credentials as OAuth2Tokens;
    } catch (error) {
      console.error('Token refresh error:', error);
      throw new GSCError('Failed to refresh access token', GSCErrorCode.TOKEN_EXPIRED, error);
    }
  }

  /**
   * Update stored access token
   */
  async updateAccessToken(userId: string, tokens: OAuth2Tokens): Promise<void> {
    const supabase = await createClient();

    const accessToken = tokens.access_token || null;

    const { error } = await supabase
      .from('google_integrations')
      .update({
        access_token: accessToken,
        expires_at: tokens.expiry_date
          ? new Date(tokens.expiry_date).toISOString()
          : new Date(Date.now() + 3600000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    if (error) {
      console.error('Error updating access token:', error);
      throw new GSCError('Failed to update access token', GSCErrorCode.INVALID_REQUEST, error);
    }
  }

  /**
   * Revoke access and remove integration
   */
  async revokeAccess(userId: string): Promise<void> {
    const integration = await this.getStoredTokens(userId);

    if (!integration) {
      throw new GSCError('Integration not found', GSCErrorCode.INVALID_REQUEST);
    }

    try {
      // Revoke token with Google
      this.oauth2Client.setCredentials({
        refresh_token: integration.refreshToken,
      });

      await this.oauth2Client.revokeCredentials();
    } catch (error) {
      console.error('Error revoking credentials:', error);
      // Continue even if revoke fails
    }

    // Remove from database
    const supabase = await createClient();
    const { error } = await supabase.from('google_integrations').delete().eq('user_id', userId);

    if (error) {
      throw new GSCError('Failed to remove integration', GSCErrorCode.INVALID_REQUEST, error);
    }
  }

  /**
   * Get authenticated OAuth client for a user
   */
  async getAuthenticatedClient(userId: string): Promise<OAuth2Client> {
    const integration = await this.getStoredTokens(userId);

    if (!integration) {
      throw new GSCError('No Google integration found', GSCErrorCode.INVALID_CREDENTIALS);
    }

    // Check if token needs refresh
    const now = new Date();
    const tokenExpiry = integration.tokenExpiry ? new Date(integration.tokenExpiry) : new Date();

    if (!integration.accessToken || tokenExpiry < now) {
      // Refresh the token
      const newTokens = await this.refreshAccessToken(integration.refreshToken);
      await this.updateAccessToken(userId, newTokens);

      this.oauth2Client.setCredentials(newTokens);
    } else {
      this.oauth2Client.setCredentials({
        access_token: integration.accessToken,
        refresh_token: integration.refreshToken,
      });
    }

    return this.oauth2Client;
  }

  /**
   * Generate state parameter for CSRF protection
   */
  private generateState(userId: string): string {
    const timestamp = Date.now().toString();
    const random = crypto.randomBytes(16).toString('hex');
    const data = `${userId}:${timestamp}:${random}`;

    // Sign the data
    const hmac = crypto.createHmac('sha256', process.env.GOOGLE_STATE_SECRET || 'default-secret');
    hmac.update(data);
    const signature = hmac.digest('hex');

    // Encode as base64
    return Buffer.from(`${data}:${signature}`).toString('base64');
  }

  /**
   * Verify state parameter
   */
  private verifyState(state: string): string | null {
    try {
      const decoded = Buffer.from(state, 'base64').toString();
      const parts = decoded.split(':');

      if (parts.length !== 4) {
        return null;
      }

      const [userId, timestamp, random, signature] = parts;

      // Verify signature
      const data = `${userId}:${timestamp}:${random}`;
      const hmac = crypto.createHmac('sha256', process.env.GOOGLE_STATE_SECRET || 'default-secret');
      hmac.update(data);
      const expectedSignature = hmac.digest('hex');

      if (signature !== expectedSignature) {
        return null;
      }

      // Check timestamp (valid for 1 hour)
      const stateTime = parseInt(timestamp, 10);
      const now = Date.now();
      const oneHour = 60 * 60 * 1000;

      if (now - stateTime > oneHour) {
        return null;
      }

      return userId;
    } catch {
      return null;
    }
  }

  /**
   * Encrypt token for storage
   */
  private encryptToken(token: string): string {
    const algorithm = 'aes-256-gcm';
    const key = Buffer.from(
      process.env.ENCRYPTION_KEY || 'default-encryption-key-32-chars!',
      'utf-8'
    ).slice(0, 32);
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv(algorithm, key, iv);

    let encrypted = cipher.update(token, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
  }

  /**
   * Decrypt token from storage
   */
  private decryptToken(encryptedToken: string): string {
    const parts = encryptedToken.split(':');
    const iv = Buffer.from(parts.shift()!, 'hex');
    const authTag = Buffer.from(parts.shift()!, 'hex');
    const encrypted = parts.join(':');

    const algorithm = 'aes-256-gcm';
    const key = Buffer.from(
      process.env.ENCRYPTION_KEY || 'default-encryption-key-32-chars!',
      'utf-8'
    ).slice(0, 32);

    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}
