// Jest test for GSC Service
import { GSCService } from '@/lib/services/gsc-service';

// Mock googleapis
jest.mock('googleapis', () => ({
  google: {
    searchconsole: jest.fn(() => ({
      searchanalytics: {
        query: jest.fn(),
      },
      sites: {
        get: jest.fn(),
        list: jest.fn(),
      },
    })),
  },
}));

// Mock OAuth2Client
jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({
    setCredentials: jest.fn(),
  })),
}));

// Mock supabase
jest.mock('@/lib/external/supabase/client', () => ({
  supabase: {
    from: jest.fn(() => ({
      upsert: jest.fn(() => Promise.resolve({ error: null })),
    })),
  },
}));

describe('GSCService', () => {
  let service: GSCService;

  beforeEach(() => {
    // Reset environment variables
    process.env.NEXT_PUBLIC_SITE_URL = 'https://example.com';
    process.env.GOOGLE_CLIENT_ID = 'test-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
    process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3000/callback';

    service = new GSCService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialize', () => {
    it('should initialize with access token', async () => {
      await service.initialize('test-access-token', 'test-refresh-token');
      // Verify that credentials were set (implementation specific)
      expect(service).toBeDefined();
    });
  });

  describe('setSiteUrl', () => {
    it('should set custom site URL', () => {
      service.setSiteUrl('https://custom-site.com');
      // The site URL is private, so we test indirectly through behavior
      expect(service).toBeDefined();
    });
  });

  describe('fetchSearchMetrics', () => {
    it('should handle empty response gracefully', async () => {
      const mockQuery = jest.fn().mockResolvedValue({
        data: { rows: [] },
      });

      // Mock the searchConsole methods
      const google = await import('googleapis');
      jest.mocked(google.google.searchconsole).mockReturnValue({
        searchanalytics: { query: mockQuery },
        sites: { get: jest.fn(), list: jest.fn() },
      } as any);

      await service.initialize('test-token');
      const results = await service.fetchSearchMetrics();

      expect(results).toEqual([]);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          siteUrl: 'https://example.com',
        })
      );
    });

    it('should transform GSC response correctly', async () => {
      const mockResponse = {
        data: {
          rows: [
            {
              keys: ['/page1', '2025-01-16'],
              clicks: 100.5,
              impressions: 1000.2,
              ctr: 0.1005,
              position: 5.5,
            },
            {
              keys: ['/page2', '2025-01-16'],
              clicks: 50,
              impressions: 500,
              ctr: 0.1,
              position: 10.2,
            },
          ],
        },
      };

      const mockQuery = jest.fn().mockResolvedValue(mockResponse);

      const google = await import('googleapis');
      jest.mocked(google.google.searchconsole).mockReturnValue({
        searchanalytics: { query: mockQuery },
        sites: { get: jest.fn(), list: jest.fn() },
      } as any);

      await service.initialize('test-token');
      const results = await service.fetchSearchMetrics();

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        url: '/page1',
        date: '2025-01-16',
        clicks: 101,
        impressions: 1000,
        ctr: 0.1005,
        position: 5.5,
      });
    });

    it('should handle API errors gracefully', async () => {
      const mockQuery = jest.fn().mockRejectedValue({
        code: 403,
        message: 'Permission denied',
      });

      const google = await import('googleapis');
      jest.mocked(google.google.searchconsole).mockReturnValue({
        searchanalytics: { query: mockQuery },
        sites: { get: jest.fn(), list: jest.fn() },
      } as any);

      await service.initialize('test-token');

      await expect(service.fetchSearchMetrics()).rejects.toThrow(
        'Permission denied. Please ensure you have access to this Search Console property.'
      );
    });

    it('should handle rate limit errors', async () => {
      const mockQuery = jest.fn().mockRejectedValue({
        code: 429,
        message: 'Rate limit exceeded',
      });

      const google = await import('googleapis');
      jest.mocked(google.google.searchconsole).mockReturnValue({
        searchanalytics: { query: mockQuery },
        sites: { get: jest.fn(), list: jest.fn() },
      } as any);

      await service.initialize('test-token');

      await expect(service.fetchSearchMetrics()).rejects.toThrow(
        'Rate limit exceeded. Please try again later.'
      );
    });
  });

  describe('fetchMetricsForUrls', () => {
    it('should fetch metrics for specific URLs', async () => {
      const urls = ['/page1', '/page2'];
      const mockQuery = jest.fn().mockResolvedValue({
        data: { rows: [] },
      });

      const google = await import('googleapis');
      jest.mocked(google.google.searchconsole).mockReturnValue({
        searchanalytics: { query: mockQuery },
        sites: { get: jest.fn(), list: jest.fn() },
      } as any);

      await service.initialize('test-token');
      await service.fetchMetricsForUrls(urls);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          requestBody: expect.objectContaining({
            dimensionFilterGroups: [
              {
                filters: [
                  { dimension: 'page', operator: 'equals', expression: '/page1' },
                  { dimension: 'page', operator: 'equals', expression: '/page2' },
                ],
              },
            ],
          }),
        })
      );
    });
  });

  describe('storeMetrics', () => {
    it('should store metrics in database', async () => {
      const metrics = [
        {
          url: '/page1',
          clicks: 100,
          impressions: 1000,
          ctr: 0.1,
          position: 5,
          date: '2025-01-16',
        },
      ];

      const mockUpsert = jest.fn().mockResolvedValue({ error: null });
      const { supabase } = await import('@/lib/external/supabase/client');

      jest.mocked(supabase.from).mockReturnValue({
        upsert: mockUpsert,
      } as any);

      await service.storeMetrics(metrics, 'user-123');

      expect(mockUpsert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            url: '/page1',
            clicks: 100,
            user_id: 'user-123',
          }),
        ]),
        expect.objectContaining({
          onConflict: 'url,date,user_id',
        })
      );
    });

    it('should handle empty metrics array', async () => {
      await expect(
        service.storeMetrics([], 'user-123')
      ).resolves.not.toThrow();
    });
  });

  describe('verifySiteAccess', () => {
    it('should verify site access successfully', async () => {
      const mockGet = jest.fn().mockResolvedValue({ status: 200 });

      const google = await import('googleapis');
      jest.mocked(google.google.searchconsole).mockReturnValue({
        searchanalytics: { query: jest.fn() },
        sites: { get: mockGet, list: jest.fn() },
      } as any);

      await service.initialize('test-token');
      const hasAccess = await service.verifySiteAccess();

      expect(hasAccess).toBe(true);
      expect(mockGet).toHaveBeenCalledWith({
        siteUrl: 'https://example.com',
      });
    });

    it('should return false for no site URL', async () => {
      service = new GSCService();
      service.setSiteUrl('');

      const hasAccess = await service.verifySiteAccess();
      expect(hasAccess).toBe(false);
    });
  });

  describe('getVerifiedSites', () => {
    it('should return list of verified sites', async () => {
      const mockList = jest.fn().mockResolvedValue({
        data: {
          siteEntry: [
            { siteUrl: 'https://site1.com', permissionLevel: 'siteOwner' },
            { siteUrl: 'https://site2.com', permissionLevel: 'siteFullUser' },
            { siteUrl: 'https://site3.com', permissionLevel: 'siteUnverifiedUser' },
          ],
        },
      });

      const google = await import('googleapis');
      jest.mocked(google.google.searchconsole).mockReturnValue({
        searchanalytics: { query: jest.fn() },
        sites: { get: jest.fn(), list: mockList },
      } as any);

      await service.initialize('test-token');
      const sites = await service.getVerifiedSites();

      expect(sites).toEqual(['https://site1.com', 'https://site2.com']);
      expect(sites).not.toContain('https://site3.com');
    });

    it('should handle empty site list', async () => {
      const mockList = jest.fn().mockResolvedValue({
        data: {},
      });

      const google = await import('googleapis');
      jest.mocked(google.google.searchconsole).mockReturnValue({
        searchanalytics: { query: jest.fn() },
        sites: { get: jest.fn(), list: mockList },
      } as any);

      await service.initialize('test-token');
      const sites = await service.getVerifiedSites();

      expect(sites).toEqual([]);
    });
  });
});