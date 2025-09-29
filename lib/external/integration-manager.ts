import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export type ServiceType =
  | 'google_analytics'
  | 'google_search_console'
  | 'google_merchant_center'
  | 'shopify'
  | 'meta';

export type ConnectionStatus = 'pending' | 'active' | 'error' | 'expired';

export interface ConnectionConfig {
  service_type: ServiceType;
  connection_name: string;
  account_id?: string;
  config?: Record<string, any>;
}

export interface Connection {
  id: string;
  org_id: string;
  user_id: string;
  service_type: ServiceType;
  connection_name: string;
  account_id?: string;
  is_active: boolean;
  connection_status: ConnectionStatus;
  last_sync_at?: Date;
  last_error?: string;
  config: Record<string, any>;
  permissions: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface TokenData {
  access_token: string;
  refresh_token?: string;
  expires_at?: Date;
}

export class IntegrationManager {
  private supabase: ReturnType<typeof createClient>;
  private encryptionKey: string;

  constructor(supabaseUrl: string, supabaseKey: string, encryptionKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.encryptionKey = encryptionKey;
  }

  // Encryption helpers
  private encrypt(text: string): string {
    if (!text) return '';
    const algorithm = 'aes-256-gcm';
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, Buffer.from(this.encryptionKey, 'hex'), iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
  }

  private decrypt(encryptedText: string): string {
    if (!encryptedText) return '';
    const algorithm = 'aes-256-gcm';
    const parts = encryptedText.split(':');

    if (parts.length !== 3) {
      throw new Error('Invalid encrypted text format');
    }

    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];

    const decipher = crypto.createDecipheriv(algorithm, Buffer.from(this.encryptionKey, 'hex'), iv);

    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  // Connection management
  async createConnection(
    orgId: string,
    userId: string,
    config: ConnectionConfig
  ): Promise<Connection> {
    const { data, error } = await this.supabase
      .from('data_source_connections')
      .insert({
        org_id: orgId,
        user_id: userId,
        service_type: config.service_type,
        connection_name: config.connection_name,
        account_id: config.account_id,
        config: config.config || {},
        connection_status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateTokens(connectionId: string, tokens: TokenData): Promise<void> {
    const encryptedAccessToken = this.encrypt(tokens.access_token);
    const encryptedRefreshToken = tokens.refresh_token ? this.encrypt(tokens.refresh_token) : null;

    const { error } = await this.supabase
      .from('data_source_connections')
      .update({
        encrypted_access_token: encryptedAccessToken,
        encrypted_refresh_token: encryptedRefreshToken,
        token_expires_at: tokens.expires_at?.toISOString(),
        connection_status: 'active',
        last_error: null,
      })
      .eq('id', connectionId);

    if (error) throw error;
  }

  async getConnection(connectionId: string): Promise<Connection | null> {
    const { data, error } = await this.supabase
      .from('data_source_connections')
      .select('*')
      .eq('id', connectionId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }

    return data;
  }

  async getConnectionsByOrg(orgId: string, serviceType?: ServiceType): Promise<Connection[]> {
    let query = this.supabase
      .from('data_source_connections')
      .select('*')
      .eq('org_id', orgId)
      .eq('is_active', true);

    if (serviceType) {
      query = query.eq('service_type', serviceType);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async getDecryptedTokens(connectionId: string): Promise<TokenData | null> {
    const { data, error } = await this.supabase
      .from('data_source_connections')
      .select('encrypted_access_token, encrypted_refresh_token, token_expires_at')
      .eq('id', connectionId)
      .single();

    if (error || !data?.encrypted_access_token) return null;

    return {
      access_token: this.decrypt(data.encrypted_access_token),
      refresh_token: data.encrypted_refresh_token
        ? this.decrypt(data.encrypted_refresh_token)
        : undefined,
      expires_at: data.token_expires_at ? new Date(data.token_expires_at) : undefined,
    };
  }

  async updateConnectionStatus(
    connectionId: string,
    status: ConnectionStatus,
    error?: string
  ): Promise<void> {
    const update: any = {
      connection_status: status,
      updated_at: new Date().toISOString(),
    };

    if (error) {
      update.last_error = error;
    } else if (status === 'active') {
      update.last_error = null;
      update.last_sync_at = new Date().toISOString();
    }

    const { error: updateError } = await this.supabase
      .from('data_source_connections')
      .update(update)
      .eq('id', connectionId);

    if (updateError) throw updateError;
  }

  async deactivateConnection(connectionId: string): Promise<void> {
    const { error } = await this.supabase
      .from('data_source_connections')
      .update({
        is_active: false,
        connection_status: 'pending',
        encrypted_access_token: null,
        encrypted_refresh_token: null,
        encrypted_api_key: null,
      })
      .eq('id', connectionId);

    if (error) throw error;
  }

  async deleteConnection(connectionId: string): Promise<void> {
    const { error } = await this.supabase
      .from('data_source_connections')
      .delete()
      .eq('id', connectionId);

    if (error) throw error;
  }

  // Usage tracking
  async logUsage(
    connectionId: string,
    action: string,
    status: 'success' | 'failure' | 'partial',
    metadata?: {
      records_processed?: number;
      duration_ms?: number;
      error_message?: string;
      [key: string]: any;
    }
  ): Promise<void> {
    const { error } = await this.supabase.from('connection_usage_logs').insert({
      connection_id: connectionId,
      action,
      status,
      error_message: metadata?.error_message,
      records_processed: metadata?.records_processed,
      duration_ms: metadata?.duration_ms,
      metadata: metadata || {},
    });

    if (error) throw error;
  }

  async getUsageLogs(connectionId: string, limit: number = 100): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('connection_usage_logs')
      .select('*')
      .eq('connection_id', connectionId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  }

  // Token refresh
  async refreshTokenIfNeeded(
    connectionId: string,
    refreshCallback: (refreshToken: string) => Promise<TokenData>
  ): Promise<TokenData | null> {
    const tokens = await this.getDecryptedTokens(connectionId);

    if (!tokens) return null;

    // Check if token needs refresh (5 minutes before expiry)
    if (tokens.expires_at) {
      const now = new Date();
      const expiryBuffer = new Date(tokens.expires_at.getTime() - 5 * 60 * 1000);

      if (now < expiryBuffer) {
        return tokens; // Token still valid
      }
    }

    // Refresh token if we have a refresh token
    if (tokens.refresh_token) {
      try {
        const newTokens = await refreshCallback(tokens.refresh_token);
        await this.updateTokens(connectionId, newTokens);
        return newTokens;
      } catch (error) {
        await this.updateConnectionStatus(
          connectionId,
          'error',
          `Token refresh failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
        throw error;
      }
    }

    return tokens;
  }

  // Validate connection
  async validateConnection(
    connectionId: string,
    validationCallback: (tokens: TokenData) => Promise<boolean>
  ): Promise<boolean> {
    try {
      const tokens = await this.getDecryptedTokens(connectionId);
      if (!tokens) {
        await this.updateConnectionStatus(connectionId, 'error', 'No tokens found');
        return false;
      }

      const isValid = await validationCallback(tokens);

      await this.updateConnectionStatus(
        connectionId,
        isValid ? 'active' : 'error',
        isValid ? undefined : 'Connection validation failed'
      );

      return isValid;
    } catch (error) {
      await this.updateConnectionStatus(
        connectionId,
        'error',
        error instanceof Error ? error.message : 'Validation error'
      );
      return false;
    }
  }
}
