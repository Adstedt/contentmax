// Jest test for GA4 Sync API routes
import { NextRequest } from 'next/server';
import { POST, GET } from '@/app/api/metrics/ga4/sync/route';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

// Mock dependencies
jest.mock('@supabase/auth-helpers-nextjs');
jest.mock('next/headers', () => ({
  cookies: jest.fn(),
}));

jest.mock('@/lib/services/ga4-service');
jest.mock('@/lib/integration/ga4-mapper');
jest.mock('@/lib/integration/metrics-aggregator');

describe('GA4 Sync API Routes', () => {
  let mockSupabase: any;
  let mockRequest: NextRequest;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock Supabase client
    mockSupabase = {
      auth: {
        getUser: jest.fn(),
      },
      from: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn(),
        upsert: jest.fn().mockResolvedValue({ error: null }),
        update: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
      })),
    };

    (createRouteHandlerClient as jest.Mock).mockReturnValue(mockSupabase);

    // Setup mock request
    mockRequest = {
      json: jest.fn(),
      nextUrl: {
        searchParams: new URLSearchParams(),
      },
    } as unknown as NextRequest;
  });

  describe('POST /api/metrics/ga4/sync', () => {
    it('should require authentication', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Unauthorized'),
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should require Google OAuth connection', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      const googleAuthMock = mockSupabase.from().single;
      googleAuthMock.mockResolvedValue({
        data: null,
        error: new Error('Not found'),
      });

      mockRequest.json = jest.fn().mockResolvedValue({
        dateRange: 30,
        forceRefresh: false,
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Please connect your Google account first');
    });

    it('should require GA4 Property ID configuration', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      // Mock Google Auth exists
      const fromMock = jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { access_token: 'token', refresh_token: 'refresh' },
          error: null,
        }),
        upsert: jest.fn().mockResolvedValue({ error: null }),
      }));

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'google_auth') {
          return fromMock();
        }
        if (table === 'user_settings') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: { integration_config: {} },
              error: null,
            }),
          };
        }
        return fromMock();
      });

      mockRequest.json = jest.fn().mockResolvedValue({
        dateRange: 30,
        forceRefresh: false,
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('GA4 Property ID not configured');
    });

    it('should enforce rate limiting', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      const fromMock = jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockImplementation(() => {
          const table = fromMock.mock.calls[fromMock.mock.calls.length - 1][0];
          if (table === 'google_auth') {
            return Promise.resolve({
              data: { access_token: 'token', refresh_token: 'refresh' },
              error: null,
            });
          }
          if (table === 'user_settings') {
            return Promise.resolve({
              data: { integration_config: { ga4_property_id: '123456789' } },
              error: null,
            });
          }
          if (table === 'ga4_sync_status') {
            // Return recent sync
            return Promise.resolve({
              data: {
                last_sync_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 minutes ago
              },
              error: null,
            });
          }
          return Promise.resolve({ data: null, error: null });
        }),
        upsert: jest.fn().mockResolvedValue({ error: null }),
      }));

      mockSupabase.from = fromMock;

      mockRequest.json = jest.fn().mockResolvedValue({
        dateRange: 30,
        forceRefresh: false,
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.error).toBe('Please wait at least 1 hour between syncs');
      expect(data.lastSyncAt).toBeDefined();
    });

    it('should allow force refresh to bypass rate limiting', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      // Mock all required data
      const fromMock = jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { access_token: 'token', refresh_token: 'refresh' },
          error: null,
        }),
        upsert: jest.fn().mockResolvedValue({ error: null }),
      }));

      mockSupabase.from = fromMock;

      mockRequest.json = jest.fn().mockResolvedValue({
        dateRange: 30,
        forceRefresh: true, // Force refresh enabled
        propertyId: '123456789',
      });

      // Mock GA4Service
      const { GA4Service } = await import('@/lib/services/ga4-service');
      jest.mocked(GA4Service).mockImplementation(() => ({
        initialize: jest.fn().mockResolvedValue(undefined),
        verifyPropertyAccess: jest.fn().mockResolvedValue(true),
        fetchPageMetrics: jest.fn().mockResolvedValue([]),
        fetchProductMetrics: jest.fn().mockResolvedValue([]),
        storePageMetrics: jest.fn().mockResolvedValue(undefined),
        storeProductMetrics: jest.fn().mockResolvedValue(undefined),
      } as any));

      // Mock GA4Mapper
      const { GA4Mapper } = await import('@/lib/integration/ga4-mapper');
      jest.mocked(GA4Mapper).mockImplementation(() => ({
        mapPageMetricsToTaxonomy: jest.fn().mockResolvedValue([]),
        getMappingStatistics: jest.fn().mockReturnValue({
          total: 0,
          mapped: 0,
          mappingRate: 0,
          avgConfidence: 0,
        }),
      } as any));

      // Mock MetricsAggregator
      const { MetricsAggregator } = await import('@/lib/integration/metrics-aggregator');
      jest.mocked(MetricsAggregator).mockImplementation(() => ({
        aggregateAnalyticsMetrics: jest.fn().mockReturnValue(new Map()),
        getRevenueStatistics: jest.fn().mockReturnValue({
          totalRevenue: 0,
          totalTransactions: 0,
          avgOrderValue: 0,
          topRevenueNodes: [],
        }),
      } as any));

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe('GET /api/metrics/ga4/sync', () => {
    it('should return unconfigured status when no property ID', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      mockSupabase.from().single.mockResolvedValue({
        data: { integration_config: {} },
        error: null,
      });

      const response = await GET(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.configured).toBe(false);
      expect(data.message).toBe('GA4 Property ID not configured');
    });

    it('should return sync status and summary', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      const fromMock = jest.fn((table: string) => {
        if (table === 'user_settings') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: { integration_config: { ga4_property_id: '123456789' } },
              error: null,
            }),
          };
        }
        if (table === 'ga4_sync_status') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: {
                last_sync_at: '2025-01-17T12:00:00Z',
                sync_status: 'completed',
                sync_message: 'Success',
                metrics_synced: 100,
              },
              error: null,
            }),
          };
        }
        if (table === 'analytics_metrics') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
            limit: jest.fn().mockResolvedValue({
              data: [
                { date: '2025-01-17', revenue: 1000, transactions: 10, sessions: 100 },
                { date: '2025-01-16', revenue: 500, transactions: 5, sessions: 50 },
              ],
              error: null,
            }),
          };
        }
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: null, error: null }),
        };
      });

      mockSupabase.from = fromMock;

      const response = await GET(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.configured).toBe(true);
      expect(data.propertyId).toBe('123456789');
      expect(data.syncStatus.sync_status).toBe('completed');
      expect(data.summary.totalRevenue).toBe(1500);
      expect(data.summary.totalTransactions).toBe(15);
      expect(data.summary.totalSessions).toBe(150);
      expect(data.summary.avgOrderValue).toBe(100);
      expect(data.summary.conversionRate).toBe(0.1);
    });

    it('should handle never synced state', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      const fromMock = jest.fn((table: string) => {
        if (table === 'user_settings') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: { integration_config: { ga4_property_id: '123456789' } },
              error: null,
            }),
          };
        }
        if (table === 'ga4_sync_status') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116' }, // No rows found
            }),
          };
        }
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue({ data: [], error: null }),
        };
      });

      mockSupabase.from = fromMock;

      const response = await GET(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.configured).toBe(true);
      expect(data.syncStatus.sync_status).toBe('never');
      expect(data.syncStatus.sync_message).toBe('No sync performed yet');
    });
  });
});