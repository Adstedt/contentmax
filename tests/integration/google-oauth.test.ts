/**
 * Integration tests for Google OAuth configuration
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  loadGoogleOAuthConfig,
  generateAuthUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  getUserInfo,
  isOAuthConfigured,
  getMissingConfig,
  GOOGLE_OAUTH_SCOPES,
  ALL_SCOPES
} from '@/lib/integrations/google/oauth-config';

describe('Google OAuth Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment variables for each test
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  describe('loadGoogleOAuthConfig', () => {
    it('should load valid configuration from environment variables', () => {
      process.env.GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';
      process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
      process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3000/api/integrations/google/callback';
      process.env.GOOGLE_MERCHANT_ID = 'test-merchant-id';

      const config = loadGoogleOAuthConfig();

      expect(config).toEqual({
        clientId: 'test-client-id.apps.googleusercontent.com',
        clientSecret: 'test-client-secret',
        redirectUri: 'http://localhost:3000/api/integrations/google/callback',
        merchantId: 'test-merchant-id',
        serviceAccountKey: undefined
      });
    });

    it('should throw error when required variables are missing', () => {
      delete process.env.GOOGLE_CLIENT_ID;
      delete process.env.GOOGLE_CLIENT_SECRET;

      expect(() => loadGoogleOAuthConfig()).toThrow('Missing or invalid Google OAuth configuration');
    });

    it('should throw error for invalid redirect URI', () => {
      process.env.GOOGLE_CLIENT_ID = 'test-client-id';
      process.env.GOOGLE_CLIENT_SECRET = 'test-secret';
      process.env.GOOGLE_REDIRECT_URI = 'not-a-valid-url';

      expect(() => loadGoogleOAuthConfig()).toThrow('Missing or invalid Google OAuth configuration');
    });
  });

  describe('isOAuthConfigured', () => {
    it('should return true when configuration is complete', () => {
      process.env.GOOGLE_CLIENT_ID = 'test-client-id';
      process.env.GOOGLE_CLIENT_SECRET = 'test-secret';
      process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3000/callback';

      expect(isOAuthConfigured()).toBe(true);
    });

    it('should return false when configuration is incomplete', () => {
      delete process.env.GOOGLE_CLIENT_ID;

      expect(isOAuthConfigured()).toBe(false);
    });
  });

  describe('getMissingConfig', () => {
    it('should return empty array when all required variables are present', () => {
      process.env.GOOGLE_CLIENT_ID = 'test-client-id';
      process.env.GOOGLE_CLIENT_SECRET = 'test-secret';
      process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3000/callback';

      expect(getMissingConfig()).toEqual([]);
    });

    it('should return list of missing variables', () => {
      delete process.env.GOOGLE_CLIENT_ID;
      delete process.env.GOOGLE_REDIRECT_URI;

      const missing = getMissingConfig();
      expect(missing).toContain('GOOGLE_CLIENT_ID');
      expect(missing).toContain('GOOGLE_REDIRECT_URI');
    });
  });

  describe('generateAuthUrl', () => {
    beforeEach(() => {
      process.env.GOOGLE_CLIENT_ID = 'test-client-id';
      process.env.GOOGLE_CLIENT_SECRET = 'test-secret';
      process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3000/callback';
    });

    it('should generate valid authorization URL', () => {
      const url = generateAuthUrl();

      expect(url).toContain('https://accounts.google.com/o/oauth2/v2/auth');
      expect(url).toContain('client_id=test-client-id');
      expect(url).toContain('redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fcallback');
      expect(url).toContain('response_type=code');
      expect(url).toContain('access_type=offline');
      expect(url).toContain('prompt=consent');
    });

    it('should include all required scopes', () => {
      const url = generateAuthUrl();

      // Check that all scopes are included
      ALL_SCOPES.forEach(scope => {
        expect(url).toContain(encodeURIComponent(scope));
      });
    });

    it('should include state parameter when provided', () => {
      const state = 'test-state-123';
      const url = generateAuthUrl(state);

      expect(url).toContain(`state=${state}`);
    });
  });

  describe('OAuth Scopes', () => {
    it('should have all required scopes defined', () => {
      expect(GOOGLE_OAUTH_SCOPES.OPENID).toBe('openid');
      expect(GOOGLE_OAUTH_SCOPES.EMAIL).toBe('email');
      expect(GOOGLE_OAUTH_SCOPES.PROFILE).toBe('profile');
      expect(GOOGLE_OAUTH_SCOPES.MERCHANT_CENTER).toBe('https://www.googleapis.com/auth/content');
      expect(GOOGLE_OAUTH_SCOPES.SEARCH_CONSOLE).toBe('https://www.googleapis.com/auth/webmasters.readonly');
      expect(GOOGLE_OAUTH_SCOPES.ANALYTICS).toBe('https://www.googleapis.com/auth/analytics.readonly');
    });

    it('should include all scopes in ALL_SCOPES array', () => {
      expect(ALL_SCOPES).toContain(GOOGLE_OAUTH_SCOPES.OPENID);
      expect(ALL_SCOPES).toContain(GOOGLE_OAUTH_SCOPES.EMAIL);
      expect(ALL_SCOPES).toContain(GOOGLE_OAUTH_SCOPES.PROFILE);
      expect(ALL_SCOPES).toContain(GOOGLE_OAUTH_SCOPES.MERCHANT_CENTER);
      expect(ALL_SCOPES).toContain(GOOGLE_OAUTH_SCOPES.SEARCH_CONSOLE);
      expect(ALL_SCOPES).toContain(GOOGLE_OAUTH_SCOPES.ANALYTICS);
      expect(ALL_SCOPES.length).toBe(6);
    });
  });

  describe('Token Exchange Functions', () => {
    beforeEach(() => {
      process.env.GOOGLE_CLIENT_ID = 'test-client-id';
      process.env.GOOGLE_CLIENT_SECRET = 'test-secret';
      process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3000/callback';
    });

    describe('exchangeCodeForTokens', () => {
      it('should handle successful token exchange', async () => {
        const mockTokens = {
          access_token: 'test-access-token',
          refresh_token: 'test-refresh-token',
          token_type: 'Bearer',
          expires_in: 3600,
          scope: 'openid email profile',
        };

        global.fetch = vi.fn().mockResolvedValueOnce({
          ok: true,
          json: async () => mockTokens,
        } as Response);

        const tokens = await exchangeCodeForTokens('test-auth-code');

        expect(tokens).toEqual(mockTokens);
        expect(global.fetch).toHaveBeenCalledWith(
          'https://oauth2.googleapis.com/token',
          expect.objectContaining({
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          })
        );
      });

      it('should handle token exchange errors', async () => {
        global.fetch = vi.fn().mockResolvedValueOnce({
          ok: false,
          text: async () => 'Invalid authorization code',
        } as Response);

        await expect(exchangeCodeForTokens('invalid-code')).rejects.toThrow(
          'Failed to exchange code for tokens'
        );
      });
    });

    describe('refreshAccessToken', () => {
      it('should handle successful token refresh', async () => {
        const mockTokens = {
          access_token: 'new-access-token',
          token_type: 'Bearer',
          expires_in: 3600,
          scope: 'openid email profile',
        };

        global.fetch = vi.fn().mockResolvedValueOnce({
          ok: true,
          json: async () => mockTokens,
        } as Response);

        const tokens = await refreshAccessToken('test-refresh-token');

        expect(tokens).toEqual(mockTokens);
      });
    });

    describe('getUserInfo', () => {
      it('should fetch user information successfully', async () => {
        const mockUserInfo = {
          id: 'google-user-123',
          email: 'test@example.com',
          verified_email: true,
          name: 'Test User',
          picture: 'https://example.com/picture.jpg',
        };

        global.fetch = vi.fn().mockResolvedValueOnce({
          ok: true,
          json: async () => mockUserInfo,
        } as Response);

        const userInfo = await getUserInfo('test-access-token');

        expect(userInfo).toEqual(mockUserInfo);
        expect(global.fetch).toHaveBeenCalledWith(
          'https://www.googleapis.com/oauth2/v2/userinfo',
          expect.objectContaining({
            headers: {
              Authorization: 'Bearer test-access-token',
            },
          })
        );
      });

      it('should handle user info fetch errors', async () => {
        global.fetch = vi.fn().mockResolvedValueOnce({
          ok: false,
          text: async () => 'Unauthorized',
        } as Response);

        await expect(getUserInfo('invalid-token')).rejects.toThrow(
          'Failed to get user info'
        );
      });
    });
  });
});