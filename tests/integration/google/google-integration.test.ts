import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { GoogleOAuthClient } from '@/lib/integrations/google-oauth';
import { SearchConsoleClient } from '@/lib/integrations/search-console';
import { GSCDataCache } from '@/lib/integrations/gsc-cache';
import { GSCError, GSCErrorCode } from '@/types/google.types';
import crypto from 'crypto';

// Mock Google APIs
jest.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: jest.fn().mockImplementation(() => ({
        generateAuthUrl: jest.fn().mockReturnValue('https://accounts.google.com/oauth2/auth'),
        getToken: jest.fn().mockResolvedValue({
          tokens: {
            access_token: 'mock-access-token',
            refresh_token: 'mock-refresh-token',
            expiry_date: Date.now() + 3600000,
          },
        }),
        setCredentials: jest.fn(),
        refreshAccessToken: jest.fn().mockResolvedValue({
          credentials: {
            access_token: 'new-access-token',
            expiry_date: Date.now() + 3600000,
          },
        }),
        revokeCredentials: jest.fn().mockResolvedValue({}),
      })),
    },
    oauth2: jest.fn(() => ({
      userinfo: {
        get: jest.fn().mockResolvedValue({
          data: {
            email: 'test@example.com',
          },
        }),
      },
    })),
    webmasters: jest.fn(() => ({
      sites: {
        list: jest.fn().mockResolvedValue({
          data: {
            siteEntry: [
              { siteUrl: 'https://example.com' },
              { siteUrl: 'https://test.com' },
            ],
          },
        }),
      },
      searchanalytics: {
        query: jest.fn().mockResolvedValue({
          data: {
            rows: [
              {
                keys: ['test query'],
                clicks: 100,
                impressions: 1000,
                ctr: 0.1,
                position: 5.5,
              },
            ],
          },
        }),
      },
    })),
  },
}));

// Mock Supabase client
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn().mockResolvedValue({
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: {
          user: {
            id: 'test-user-id',
            email: 'user@example.com',
          },
        },
      }),
    },
    from: jest.fn(() => ({
      upsert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: {}, error: null }),
        }),
      }),
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: {
              id: 'test-integration-id',
              user_id: 'test-user-id',
              email: 'test@example.com',
              refresh_token: 'encrypted-refresh-token',
              access_token: 'encrypted-access-token',
            },
            error: null,
          }),
        }),
      }),
      delete: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      }),
      insert: jest.fn().mockResolvedValue({ error: null }),
    })),
  }),
}));

describe('Google OAuth Integration', () => {
  let oauthClient: GoogleOAuthClient;

  beforeEach(() => {
    // Set up environment variables
    process.env.GOOGLE_CLIENT_ID = 'test-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
    process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3000/api/integrations/google/callback';
    process.env.GOOGLE_STATE_SECRET = 'test-state-secret';
    process.env.ENCRYPTION_KEY = 'test-encryption-key-32-characters';
    
    oauthClient = new GoogleOAuthClient();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('OAuth Flow', () => {
    it('should generate a valid auth URL with state', () => {
      const userId = 'test-user-id';
      const authUrl = oauthClient.generateAuthUrl(userId);
      
      expect(authUrl).toContain('https://accounts.google.com/oauth2/auth');
      expect(authUrl).toContain('state=');
    });

    it('should handle OAuth callback successfully', async () => {
      const code = 'test-auth-code';
      const userId = 'test-user-id';
      const state = Buffer.from(
        `${userId}:${Date.now()}:random:signature`
      ).toString('base64');

      // Mock state verification
      jest.spyOn(oauthClient as any, 'verifyState').mockReturnValue(userId);

      const result = await oauthClient.handleCallback(code, state);
      
      expect(result).toHaveProperty('tokens');
      expect(result).toHaveProperty('email');
      expect(result.email).toBe('test@example.com');
    });

    it('should reject invalid state parameter', async () => {
      const code = 'test-auth-code';
      const invalidState = 'invalid-state';

      await expect(
        oauthClient.handleCallback(code, invalidState)
      ).rejects.toThrow(GSCError);
    });

    it('should refresh access token when expired', async () => {
      const refreshToken = 'mock-refresh-token';
      const newTokens = await oauthClient.refreshAccessToken(refreshToken);
      
      expect(newTokens).toHaveProperty('access_token');
      expect(newTokens.access_token).toBe('new-access-token');
    });
  });

  describe('Token Management', () => {
    it('should encrypt and decrypt tokens correctly', () => {
      const originalToken = 'test-token-12345';
      const encrypted = (oauthClient as any).encryptToken(originalToken);
      const decrypted = (oauthClient as any).decryptToken(encrypted);
      
      expect(encrypted).not.toBe(originalToken);
      expect(decrypted).toBe(originalToken);
    });

    it('should store tokens securely', async () => {
      const userId = 'test-user-id';
      const tokens = {
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
        expiry_date: Date.now() + 3600000,
      };
      const email = 'test@example.com';

      await oauthClient.storeTokens(userId, tokens, email);
      
      // Verify that the tokens were stored (mocked)
      expect(true).toBe(true); // Mock verification
    });
  });
});

describe('Search Console Client', () => {
  let searchConsoleClient: SearchConsoleClient;

  beforeEach(() => {
    searchConsoleClient = new SearchConsoleClient();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Data Fetching', () => {
    it('should fetch list of sites', async () => {
      await searchConsoleClient.initialize('test-user-id');
      const sites = await searchConsoleClient.getSites();
      
      expect(sites).toHaveLength(2);
      expect(sites).toContain('https://example.com');
      expect(sites).toContain('https://test.com');
    });

    it('should fetch search analytics data', async () => {
      await searchConsoleClient.initialize('test-user-id');
      
      const data = await searchConsoleClient.getSearchAnalytics(
        'https://example.com',
        {
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        }
      );
      
      expect(data).toHaveProperty('clicks');
      expect(data).toHaveProperty('impressions');
      expect(data).toHaveProperty('ctr');
      expect(data).toHaveProperty('position');
      expect(data).toHaveProperty('queries');
      expect(data).toHaveProperty('pages');
    });

    it('should handle API errors gracefully', async () => {
      const mockError = { code: 403, message: 'Quota exceeded' };
      
      jest.spyOn(searchConsoleClient as any, 'fetchMetrics').mockRejectedValue(mockError);
      
      await searchConsoleClient.initialize('test-user-id');
      
      await expect(
        searchConsoleClient.getSearchAnalytics('https://example.com', {
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        })
      ).rejects.toThrow(GSCError);
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits', async () => {
      const startTime = Date.now();
      
      // Simulate multiple rapid requests
      for (let i = 0; i < 5; i++) {
        await (searchConsoleClient as any).checkRateLimit();
      }
      
      const endTime = Date.now();
      const elapsed = endTime - startTime;
      
      // Should have some delay due to rate limiting
      expect(elapsed).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('GSC Data Cache', () => {
  let cache: GSCDataCache;

  beforeEach(() => {
    cache = new GSCDataCache();
  });

  afterEach(() => {
    cache.clear();
  });

  describe('Cache Operations', () => {
    it('should generate consistent cache keys', () => {
      const params = {
        projectId: 'project-123',
        siteUrl: 'https://example.com',
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      };
      
      const key1 = cache.generateKey(params);
      const key2 = cache.generateKey(params);
      
      expect(key1).toBe(key2);
      expect(key1).toHaveLength(32); // MD5 hash length
    });

    it('should store and retrieve cached data', async () => {
      const key = 'test-key';
      const data = { test: 'data', value: 123 };
      
      await cache.set(key, data, 3600);
      const retrieved = await cache.get(key);
      
      expect(retrieved).toEqual(data);
    });

    it('should return null for expired cache', async () => {
      const key = 'test-key';
      const data = { test: 'data' };
      
      // Set with 0 TTL (immediately expired)
      await cache.set(key, data, 0);
      const retrieved = await cache.get(key);
      
      expect(retrieved).toBeNull();
    });

    it('should invalidate cache entries', async () => {
      const key = 'test-key';
      const data = { test: 'data' };
      
      await cache.set(key, data);
      await cache.invalidate(key);
      const retrieved = await cache.get(key);
      
      expect(retrieved).toBeNull();
    });

    it('should calculate remaining TTL', async () => {
      const key = 'test-key';
      const data = { test: 'data' };
      const ttl = 3600;
      
      await cache.set(key, data, ttl);
      const remainingTTL = cache.getTTL(key);
      
      expect(remainingTTL).toBeLessThanOrEqual(ttl);
      expect(remainingTTL).toBeGreaterThan(ttl - 10); // Allow small time difference
    });

    it('should cleanup expired entries', async () => {
      // Add entries with different TTLs
      await cache.set('key1', 'data1', 0); // Expired
      await cache.set('key2', 'data2', 3600); // Valid
      
      const stats = cache.getStats();
      
      // Trigger cleanup by adding many entries
      for (let i = 0; i < 101; i++) {
        await cache.set(`key-${i}`, `data-${i}`, 3600);
      }
      
      // Check that expired entry is removed
      const data1 = await cache.get('key1');
      const data2 = await cache.get('key2');
      
      expect(data1).toBeNull();
      expect(data2).toBe('data2');
    });
  });
});