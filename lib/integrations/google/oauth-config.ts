/**
 * Google OAuth Configuration
 *
 * This module provides configuration and utilities for Google OAuth2 authentication
 * Used for integrating with Google Merchant Center, Search Console, and Analytics APIs
 */

import { z } from 'zod';

// Environment variable validation schema
const GoogleOAuthEnvSchema = z.object({
  GOOGLE_CLIENT_ID: z.string().min(1, 'Google Client ID is required'),
  GOOGLE_CLIENT_SECRET: z.string().min(1, 'Google Client Secret is required'),
  GOOGLE_REDIRECT_URI: z.string().url('Google Redirect URI must be a valid URL'),
  GOOGLE_MERCHANT_ID: z.string().optional(),
  GOOGLE_SERVICE_ACCOUNT_KEY: z.string().optional(),
});

// OAuth scopes required for different Google services
export const GOOGLE_OAUTH_SCOPES = {
  // Core user information
  OPENID: 'openid',
  EMAIL: 'https://www.googleapis.com/auth/userinfo.email',
  PROFILE: 'https://www.googleapis.com/auth/userinfo.profile',

  // API-specific scopes
  MERCHANT_CENTER: 'https://www.googleapis.com/auth/content',
  SEARCH_CONSOLE: 'https://www.googleapis.com/auth/webmasters.readonly',
  ANALYTICS: 'https://www.googleapis.com/auth/analytics.readonly',
} as const;

// All scopes needed for the application
export const ALL_SCOPES = [
  GOOGLE_OAUTH_SCOPES.OPENID,
  GOOGLE_OAUTH_SCOPES.EMAIL,
  GOOGLE_OAUTH_SCOPES.PROFILE,
  GOOGLE_OAUTH_SCOPES.MERCHANT_CENTER,
  GOOGLE_OAUTH_SCOPES.SEARCH_CONSOLE,
  GOOGLE_OAUTH_SCOPES.ANALYTICS,
];

// OAuth endpoints
export const GOOGLE_OAUTH_ENDPOINTS = {
  AUTH: 'https://accounts.google.com/o/oauth2/v2/auth',
  TOKEN: 'https://oauth2.googleapis.com/token',
  REVOKE: 'https://oauth2.googleapis.com/revoke',
  USER_INFO: 'https://www.googleapis.com/oauth2/v2/userinfo',
} as const;

// API endpoints for different services
export const GOOGLE_API_ENDPOINTS = {
  MERCHANT: 'https://shoppingcontent.googleapis.com/content/v2.1',
  SEARCH_CONSOLE: 'https://searchconsole.googleapis.com/v1',
  ANALYTICS: 'https://analyticsdata.googleapis.com/v1beta',
} as const;

export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  merchantId?: string;
  serviceAccountKey?: string;
}

export interface GoogleAuthTokens {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
  scope: string;
  id_token?: string;
}

export interface GoogleUserInfo {
  id: string;
  email: string;
  verified_email: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  locale?: string;
}

/**
 * Load and validate Google OAuth configuration from environment variables
 */
export function loadGoogleOAuthConfig(): GoogleOAuthConfig {
  try {
    const env = GoogleOAuthEnvSchema.parse({
      GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
      GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI,
      GOOGLE_MERCHANT_ID: process.env.GOOGLE_MERCHANT_ID,
      GOOGLE_SERVICE_ACCOUNT_KEY: process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
    });

    return {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      redirectUri: env.GOOGLE_REDIRECT_URI,
      merchantId: env.GOOGLE_MERCHANT_ID,
      serviceAccountKey: env.GOOGLE_SERVICE_ACCOUNT_KEY,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors.map((e) => e.path.join('.')).join(', ');
      throw new Error(`Missing or invalid Google OAuth configuration: ${missingVars}`);
    }
    throw error;
  }
}

/**
 * Generate the OAuth authorization URL
 */
export function generateAuthUrl(state?: string): string {
  const config = loadGoogleOAuthConfig();

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: ALL_SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    ...(state && { state }),
  });

  return `${GOOGLE_OAUTH_ENDPOINTS.AUTH}?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(code: string): Promise<GoogleAuthTokens> {
  const config = loadGoogleOAuthConfig();

  const params = new URLSearchParams({
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    grant_type: 'authorization_code',
  });

  const response = await fetch(GOOGLE_OAUTH_ENDPOINTS.TOKEN, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to exchange code for tokens: ${error}`);
  }

  return response.json();
}

/**
 * Refresh an access token using a refresh token
 */
export async function refreshAccessToken(refreshToken: string): Promise<GoogleAuthTokens> {
  const config = loadGoogleOAuthConfig();

  const params = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: 'refresh_token',
  });

  const response = await fetch(GOOGLE_OAUTH_ENDPOINTS.TOKEN, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to refresh access token: ${error}`);
  }

  return response.json();
}

/**
 * Revoke a token (access or refresh)
 */
export async function revokeToken(token: string): Promise<void> {
  const params = new URLSearchParams({ token });

  const response = await fetch(GOOGLE_OAUTH_ENDPOINTS.REVOKE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok && response.status !== 400) {
    // 400 means token was already invalid, which is fine
    const error = await response.text();
    throw new Error(`Failed to revoke token: ${error}`);
  }
}

/**
 * Get user information using an access token
 */
export async function getUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const response = await fetch(GOOGLE_OAUTH_ENDPOINTS.USER_INFO, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get user info: ${error}`);
  }

  return response.json();
}

/**
 * Check if the OAuth configuration is complete
 */
export function isOAuthConfigured(): boolean {
  try {
    loadGoogleOAuthConfig();
    return true;
  } catch {
    return false;
  }
}

/**
 * Get missing configuration variables
 */
export function getMissingConfig(): string[] {
  const required = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI'];
  const missing: string[] = [];

  for (const key of required) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  return missing;
}
