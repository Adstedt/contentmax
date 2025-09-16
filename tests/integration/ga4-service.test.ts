// Jest test for GA4 Service
import { GA4Service } from '@/lib/services/ga4-service';

// Mock @google-analytics/data
jest.mock('@google-analytics/data', () => ({
  BetaAnalyticsDataClient: jest.fn().mockImplementation(() => ({
    runReport: jest.fn(),
  })),
}));

// Mock OAuth2Client
jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({
    setCredentials: jest.fn(),
  })),
}));

// Mock supabase
jest.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: jest.fn(() => ({
      upsert: jest.fn(() => Promise.resolve({ error: null })),
    })),
  },
}));

describe('GA4Service', () => {
  let service: GA4Service;

  beforeEach(() => {
    // Reset environment variables
    process.env.GOOGLE_CLIENT_ID = 'test-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
    process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3000/callback';

    service = new GA4Service('123456789');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialize', () => {
    it('should initialize with access token', async () => {
      await service.initialize('test-access-token', 'test-refresh-token');
      expect(service).toBeDefined();
    });
  });

  describe('setPropertyId', () => {
    it('should set property ID', () => {
      service.setPropertyId('987654321');
      expect(service).toBeDefined();
    });
  });

  describe('fetchPageMetrics', () => {
    it('should handle empty response gracefully', async () => {
      const { BetaAnalyticsDataClient } = await import('@google-analytics/data');
      const mockRunReport = jest.fn().mockResolvedValue([{
        rows: [],
      }]);

      jest.mocked(BetaAnalyticsDataClient).mockReturnValue({
        runReport: mockRunReport,
      } as any);

      await service.initialize('test-token');
      const results = await service.fetchPageMetrics();

      expect(results).toEqual([]);
      expect(mockRunReport).toHaveBeenCalledWith(
        expect.objectContaining({
          property: 'properties/123456789',
        })
      );
    });

    it('should transform page metrics correctly', async () => {
      const mockResponse = [{
        rows: [
          {
            dimensionValues: [
              { value: '/page1' },
              { value: '2025-01-17' },
            ],
            metricValues: [
              { value: '100' },    // sessions
              { value: '80' },     // users
              { value: '5000.50' }, // revenue
              { value: '10' },     // transactions
              { value: '0.75' },   // engagement rate
              { value: '0.25' },   // bounce rate
              { value: '180.5' },  // avg session duration
              { value: '250' },    // page views
            ],
          },
        ],
      }];

      const { BetaAnalyticsDataClient } = await import('@google-analytics/data');
      jest.mocked(BetaAnalyticsDataClient).mockReturnValue({
        runReport: jest.fn().mockResolvedValue(mockResponse),
      } as any);

      await service.initialize('test-token');
      const results = await service.fetchPageMetrics();

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        pagePath: '/page1',
        date: '2025-01-17',
        sessions: 100,
        users: 80,
        revenue: 5000.50,
        transactions: 10,
        conversionRate: 0.1,
        avgOrderValue: 500.05,
        engagementRate: 0.75,
        bounceRate: 0.25,
        avgSessionDuration: 180.5,
        pageViews: 250,
      });
    });

    it('should handle API errors gracefully', async () => {
      const { BetaAnalyticsDataClient } = await import('@google-analytics/data');
      jest.mocked(BetaAnalyticsDataClient).mockReturnValue({
        runReport: jest.fn().mockRejectedValue({
          code: 'PERMISSION_DENIED',
          message: 'Permission denied',
        }),
      } as any);

      await service.initialize('test-token');

      await expect(service.fetchPageMetrics()).rejects.toThrow(
        'Permission denied. Please ensure you have access to this GA4 property.'
      );
    });

    it('should handle rate limit errors', async () => {
      const { BetaAnalyticsDataClient } = await import('@google-analytics/data');
      jest.mocked(BetaAnalyticsDataClient).mockReturnValue({
        runReport: jest.fn().mockRejectedValue({
          code: 'RESOURCE_EXHAUSTED',
          message: 'Rate limit exceeded',
        }),
      } as any);

      await service.initialize('test-token');

      await expect(service.fetchPageMetrics()).rejects.toThrow(
        'Rate limit exceeded. Please try again later.'
      );
    });

    it('should handle property not found errors', async () => {
      const { BetaAnalyticsDataClient } = await import('@google-analytics/data');
      jest.mocked(BetaAnalyticsDataClient).mockReturnValue({
        runReport: jest.fn().mockRejectedValue({
          code: 'NOT_FOUND',
          message: 'Property not found',
        }),
      } as any);

      await service.initialize('test-token');

      await expect(service.fetchPageMetrics()).rejects.toThrow(
        'GA4 property not found. Please check your property ID.'
      );
    });
  });

  describe('fetchProductMetrics', () => {
    it('should transform product metrics correctly', async () => {
      const mockResponse = [{
        rows: [
          {
            dimensionValues: [
              { value: 'PROD123' },
              { value: 'Gaming Laptop' },
              { value: 'Electronics > Laptops' },
              { value: '2025-01-17' },
            ],
            metricValues: [
              { value: '25000' },  // revenue
              { value: '25' },     // purchased
              { value: '500' },    // viewed
              { value: '50' },     // added to cart
              { value: '10' },     // removed from cart
              { value: '0.05' },   // purchase to view rate
            ],
          },
        ],
      }];

      const { BetaAnalyticsDataClient } = await import('@google-analytics/data');
      jest.mocked(BetaAnalyticsDataClient).mockReturnValue({
        runReport: jest.fn().mockResolvedValue(mockResponse),
      } as any);

      await service.initialize('test-token');
      const results = await service.fetchProductMetrics();

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        itemId: 'PROD123',
        itemName: 'Gaming Laptop',
        itemCategory: 'Electronics > Laptops',
        date: '2025-01-17',
        itemRevenue: 25000,
        itemsPurchased: 25,
        itemsViewed: 500,
        cartAdditions: 50,
        cartRemovals: 10,
        purchaseToViewRate: 0.05,
      });
    });
  });

  describe('storePageMetrics', () => {
    it('should store metrics in database', async () => {
      const metrics = [{
        pagePath: '/page1',
        date: '2025-01-17',
        sessions: 100,
        users: 80,
        revenue: 5000,
        transactions: 10,
        conversionRate: 0.1,
        avgOrderValue: 500,
        engagementRate: 0.75,
        bounceRate: 0.25,
        avgSessionDuration: 180,
        pageViews: 250,
      }];

      const mockUpsert = jest.fn().mockResolvedValue({ error: null });
      const { supabase } = await import('@/lib/supabase/client');

      jest.mocked(supabase.from).mockReturnValue({
        upsert: mockUpsert,
      } as any);

      await service.storePageMetrics(metrics, 'user-123');

      expect(mockUpsert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            page_path: '/page1',
            sessions: 100,
            revenue: 5000,
            user_id: 'user-123',
          }),
        ]),
        expect.objectContaining({
          onConflict: 'page_path,date,user_id',
        })
      );
    });

    it('should handle empty metrics array', async () => {
      await expect(
        service.storePageMetrics([], 'user-123')
      ).resolves.not.toThrow();
    });
  });

  describe('verifyPropertyAccess', () => {
    it('should verify access successfully', async () => {
      const { BetaAnalyticsDataClient } = await import('@google-analytics/data');
      jest.mocked(BetaAnalyticsDataClient).mockReturnValue({
        runReport: jest.fn().mockResolvedValue([{ rows: [] }]),
      } as any);

      await service.initialize('test-token');
      const hasAccess = await service.verifyPropertyAccess();

      expect(hasAccess).toBe(true);
    });

    it('should return false for no access', async () => {
      const { BetaAnalyticsDataClient } = await import('@google-analytics/data');
      jest.mocked(BetaAnalyticsDataClient).mockReturnValue({
        runReport: jest.fn().mockRejectedValue(new Error('Access denied')),
      } as any);

      await service.initialize('test-token');
      const hasAccess = await service.verifyPropertyAccess();

      expect(hasAccess).toBe(false);
    });

    it('should return false when not initialized', async () => {
      const hasAccess = await service.verifyPropertyAccess();
      expect(hasAccess).toBe(false);
    });
  });
});