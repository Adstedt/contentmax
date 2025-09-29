import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { GA4Client } from '@/lib/external/analytics';
import { GA4Config, GA4BatchRequest } from '@/types/ga4.types';

// Mock the Google Analytics Data client
jest.mock('@google-analytics/data', () => ({
  BetaAnalyticsDataClient: jest.fn().mockImplementation(() => ({
    runReport: jest.fn(),
  })),
}));

describe('GA4Client', () => {
  let client: GA4Client;
  let mockRunReport: jest.Mock;

  const config: GA4Config = {
    propertyId: 'test-property',
    cacheEnabled: true,
    cacheTTL: 3600000, // 1 hour
    rateLimit: {
      maxConcurrent: 10,
      interval: 1000,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    client = new GA4Client(config);
    
    // Access the mocked runReport method
    mockRunReport = (client as any).client.runReport;
  });

  describe('fetchUrlMetrics', () => {
    it('should fetch metrics for a single URL', async () => {
      const mockResponse = {
        rows: [
          {
            dimensionValues: [{ value: '/products' }],
            metricValues: [
              { value: '1500.50' }, // revenue
              { value: '10' },      // transactions
              { value: '100' },     // sessions
              { value: '0.45' },    // bounceRate
              { value: '0.55' },    // engagementRate
              { value: '120.5' },   // averageSessionDuration
              { value: '250' },     // screenPageViews
              { value: '30' },      // newUsers
              { value: '80' },      // totalUsers
            ],
          },
        ],
      };

      mockRunReport.mockResolvedValue([mockResponse]);

      const metrics = await client.fetchUrlMetrics(
        'https://example.com/products',
        '2024-01-01',
        '2024-01-31'
      );

      expect(metrics).toEqual({
        url: 'https://example.com/products',
        dateRange: {
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        },
        revenue: 1500.5,
        transactions: 10,
        conversionRate: 10, // 10/100 * 100
        averageOrderValue: 150.05, // 1500.5/10
        sessions: 100,
        bounceRate: 0.45,
        engagementRate: 0.55,
        averageEngagementTime: 120.5,
        eventsPerSession: 250,
        newUsers: 30,
        totalUsers: 80,
      });

      expect(mockRunReport).toHaveBeenCalledWith(
        expect.objectContaining({
          property: 'properties/test-property',
          dateRanges: [{ startDate: '2024-01-01', endDate: '2024-01-31' }],
        })
      );
    });

    it('should return empty metrics for URL with no data', async () => {
      mockRunReport.mockResolvedValue([{ rows: [] }]);

      const metrics = await client.fetchUrlMetrics(
        'https://example.com/no-data',
        '2024-01-01',
        '2024-01-31'
      );

      expect(metrics.revenue).toBe(0);
      expect(metrics.transactions).toBe(0);
      expect(metrics.sessions).toBe(0);
    });

    it('should use cache for repeated requests', async () => {
      const mockResponse = {
        rows: [
          {
            dimensionValues: [{ value: '/cached' }],
            metricValues: Array(9).fill({ value: '100' }),
          },
        ],
      };

      mockRunReport.mockResolvedValue([mockResponse]);

      // First request
      await client.fetchUrlMetrics(
        'https://example.com/cached',
        '2024-01-01',
        '2024-01-31'
      );

      // Second request (should use cache)
      await client.fetchUrlMetrics(
        'https://example.com/cached',
        '2024-01-01',
        '2024-01-31'
      );

      // Should only be called once due to caching
      expect(mockRunReport).toHaveBeenCalledTimes(1);
    });
  });

  describe('fetchBatchMetrics', () => {
    it('should fetch metrics for multiple URLs', async () => {
      const mockResponse = {
        rows: [
          {
            dimensionValues: [{ value: '/page1' }],
            metricValues: Array(9).fill({ value: '100' }),
          },
          {
            dimensionValues: [{ value: '/page2' }],
            metricValues: Array(9).fill({ value: '200' }),
          },
        ],
      };

      mockRunReport.mockResolvedValue([mockResponse]);

      const request: GA4BatchRequest = {
        urls: [
          'https://example.com/page1',
          'https://example.com/page2',
        ],
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      };

      const results = await client.fetchBatchMetrics(request);

      expect(results).toHaveLength(2);
      expect(results[0].url).toBe('https://example.com/page1');
      expect(results[0].revenue).toBe(100);
      expect(results[1].url).toBe('https://example.com/page2');
      expect(results[1].revenue).toBe(200);
    });

    it('should handle batch size limits', async () => {
      // Create 120 URLs (should be split into 3 batches of 50, 50, 20)
      const urls = Array.from({ length: 120 }, (_, i) => 
        `https://example.com/page${i}`
      );

      mockRunReport.mockResolvedValue([{ rows: [] }]);

      const request: GA4BatchRequest = {
        urls,
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      };

      const results = await client.fetchBatchMetrics(request);

      expect(results).toHaveLength(120);
      // Should be called 3 times (50 + 50 + 20)
      expect(mockRunReport).toHaveBeenCalledTimes(3);
    });

    it('should add empty metrics for URLs not in response', async () => {
      const mockResponse = {
        rows: [
          {
            dimensionValues: [{ value: '/page1' }],
            metricValues: Array(9).fill({ value: '100' }),
          },
        ],
      };

      mockRunReport.mockResolvedValue([mockResponse]);

      const request: GA4BatchRequest = {
        urls: [
          'https://example.com/page1',
          'https://example.com/page2', // Not in response
          'https://example.com/page3', // Not in response
        ],
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      };

      const results = await client.fetchBatchMetrics(request);

      expect(results).toHaveLength(3);
      expect(results[0].revenue).toBe(100);
      expect(results[1].revenue).toBe(0); // Empty metrics
      expect(results[2].revenue).toBe(0); // Empty metrics
    });
  });

  describe('Error handling', () => {
    it('should handle quota exceeded errors', async () => {
      const quotaError = new Error('Quota exceeded');
      (quotaError as any).code = 'RESOURCE_EXHAUSTED';
      mockRunReport.mockRejectedValue(quotaError);

      await expect(
        client.fetchUrlMetrics(
          'https://example.com/test',
          '2024-01-01',
          '2024-01-31'
        )
      ).rejects.toThrow('quota');
    });

    it('should handle API errors gracefully in batch requests', async () => {
      mockRunReport.mockRejectedValue(new Error('API Error'));

      const request: GA4BatchRequest = {
        urls: ['https://example.com/page1'],
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      };

      const results = await client.fetchBatchMetrics(request);

      // Should return empty metrics on error
      expect(results).toHaveLength(1);
      expect(results[0].revenue).toBe(0);
    });
  });

  describe('URL path extraction', () => {
    it('should extract path correctly from full URLs', () => {
      const extractPath = (client as any).extractPath.bind(client);

      expect(extractPath('https://example.com/products')).toBe('/products');
      expect(extractPath('https://example.com/products?id=123')).toBe('/products?id=123');
      expect(extractPath('https://example.com/')).toBe('/');
      expect(extractPath('invalid-url')).toBe('invalid-url');
    });
  });

  describe('Cache management', () => {
    it('should clear cache when requested', () => {
      client.clearCache();
      const stats = client.getCacheStats();
      expect(stats.size).toBe(0);
      expect(stats.entries).toBe(0);
    });

    it('should return cache statistics', async () => {
      const mockResponse = {
        rows: [
          {
            dimensionValues: [{ value: '/test' }],
            metricValues: Array(9).fill({ value: '100' }),
          },
        ],
      };

      mockRunReport.mockResolvedValue([mockResponse]);

      await client.fetchUrlMetrics(
        'https://example.com/test',
        '2024-01-01',
        '2024-01-31'
      );

      const stats = client.getCacheStats();
      expect(stats.size).toBe(1);
      expect(stats.entries).toBe(1);
    });
  });

  describe('Calculations', () => {
    it('should calculate conversion rate correctly', () => {
      const calculateConversionRate = (client as any).calculateConversionRate.bind(client);

      expect(calculateConversionRate(10, 100)).toBe(10); // 10%
      expect(calculateConversionRate(0, 100)).toBe(0);
      expect(calculateConversionRate(10, 0)).toBe(0); // Avoid division by zero
    });

    it('should calculate average order value correctly', () => {
      const calculateAOV = (client as any).calculateAOV.bind(client);

      expect(calculateAOV(1000, 10)).toBe(100);
      expect(calculateAOV(0, 10)).toBe(0);
      expect(calculateAOV(1000, 0)).toBe(0); // Avoid division by zero
    });
  });
});