import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { OpportunityService } from '@/lib/services/opportunity-service';
import { createClient } from '@/lib/supabase/client';
import type { TaxonomyNode } from '@/components/taxonomy/D3Visualization/ForceGraph';

// Mock Supabase client
jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      upsert: jest.fn(() => Promise.resolve({ data: [], error: null })),
      select: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({ data: [], error: null })),
      })),
      delete: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({ data: [], error: null })),
      })),
    })),
  })),
}));

// Mock the fetch functions
jest.mock('@/lib/integration/gsc-fetcher', () => ({
  fetchSearchMetrics: jest.fn(() =>
    Promise.resolve({
      clicks: 100,
      impressions: 2000,
      ctr: 0.05,
      position: 8,
    })
  ),
}));

jest.mock('@/lib/integration/ga4-fetcher', () => ({
  fetchAnalyticsMetrics: jest.fn(() =>
    Promise.resolve({
      revenue: 5000,
      transactions: 50,
      sessions: 1000,
      conversionRate: 0.05,
      avgOrderValue: 100,
      engagementRate: 0.6,
    })
  ),
}));

describe('OpportunityService', () => {
  let service: OpportunityService;
  const mockUserId = 'test-user-123';

  beforeEach(() => {
    service = new OpportunityService();
    vi.clearAllMocks();
  });

  describe('calculateOpportunityScores', () => {
    it('should calculate scores for all nodes', async () => {
      const nodes: TaxonomyNode[] = [
        {
          id: 'cat-1',
          title: 'Electronics',
          url: '/electronics',
          depth: 1,
          skuCount: 50,
          children: [],
        },
        {
          id: 'cat-2',
          title: 'Laptops',
          url: '/electronics/laptops',
          depth: 2,
          skuCount: 20,
          children: [],
        },
      ];

      const scores = await service.calculateOpportunityScores(nodes, mockUserId);

      expect(scores).toHaveLength(2);
      expect(scores[0]).toHaveProperty('nodeId', 'cat-1');
      expect(scores[0]).toHaveProperty('score');
      expect(scores[0].score).toBeGreaterThanOrEqual(0);
      expect(scores[0].score).toBeLessThanOrEqual(100);
    });

    it('should handle nodes without metrics gracefully', async () => {
      const nodes: TaxonomyNode[] = [
        {
          id: 'cat-empty',
          title: 'Empty Category',
          url: '/empty',
          depth: 1,
          skuCount: 0,
          children: [],
        },
      ];

      // Mock to return null metrics
      const { fetchSearchMetrics } = await import('@/lib/integration/gsc-fetcher');
      const { fetchAnalyticsMetrics } = await import('@/lib/integration/ga4-fetcher');

      jest.mocked(fetchSearchMetrics).mockResolvedValueOnce(null);
      jest.mocked(fetchAnalyticsMetrics).mockResolvedValueOnce(null);

      const scores = await service.calculateOpportunityScores(nodes, mockUserId);

      expect(scores).toHaveLength(1);
      expect(scores[0].score).toBe(0);
      expect(scores[0].confidence).toBe(0);
    });

    it('should categorize opportunities correctly', async () => {
      const nodes: TaxonomyNode[] = [
        {
          id: 'high-opportunity',
          title: 'High Opportunity',
          url: '/high',
          depth: 1,
          skuCount: 5, // Low product count
          children: [],
        },
      ];

      // Mock high opportunity metrics
      const { fetchSearchMetrics } = await import('@/lib/integration/gsc-fetcher');
      jest.mocked(fetchSearchMetrics).mockResolvedValueOnce({
        clicks: 10,
        impressions: 10000,
        ctr: 0.001, // Very low CTR
        position: 15, // Poor position
      });

      const scores = await service.calculateOpportunityScores(nodes, mockUserId);

      expect(scores[0].opportunityType).toBe('quick-win');
      expect(scores[0].score).toBeGreaterThan(60);
    });

    it('should calculate impact projections', async () => {
      const nodes: TaxonomyNode[] = [
        {
          id: 'test-node',
          title: 'Test Category',
          url: '/test',
          depth: 1,
          skuCount: 30,
          children: [],
        },
      ];

      const scores = await service.calculateOpportunityScores(nodes, mockUserId);

      expect(scores[0]).toHaveProperty('projectedRevenue');
      expect(scores[0]).toHaveProperty('projectedTraffic');
      expect(scores[0]).toHaveProperty('timeToImpact');
      expect(scores[0].projectedRevenue).toBeGreaterThanOrEqual(0);
    });
  });

  describe('syncOpportunityScores', () => {
    it('should fetch nodes and calculate scores', async () => {
      const supabase = createClient();
      jest.mocked(supabase.from).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: [
              {
                id: 'sync-node-1',
                title: 'Sync Test',
                url: '/sync',
                depth: 1,
                sku_count: 25,
              },
            ],
            error: null,
          }),
        }),
      } as any);

      const result = await service.syncOpportunityScores(mockUserId);

      expect(result.success).toBe(true);
      expect(result.scoresCalculated).toBe(1);
    });

    it('should handle sync errors gracefully', async () => {
      const supabase = createClient();
      jest.mocked(supabase.from).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Database error' },
          }),
        }),
      } as any);

      const result = await service.syncOpportunityScores(mockUserId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Database error');
    });
  });

  describe('getTopOpportunities', () => {
    it('should return top opportunities sorted by score', async () => {
      const supabase = createClient();
      jest.mocked(supabase.from).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue({
                  data: [
                    { node_id: 'top-1', score: 90, opportunity_type: 'quick-win' },
                    { node_id: 'top-2', score: 85, opportunity_type: 'strategic' },
                    { node_id: 'top-3', score: 75, opportunity_type: 'incremental' },
                  ],
                  error: null,
                }),
              }),
            }),
          }),
        }),
      } as any);

      const opportunities = await service.getTopOpportunities(mockUserId, 3, 70);

      expect(opportunities).toHaveLength(3);
      expect(opportunities[0].score).toBe(90);
      expect(opportunities[1].score).toBe(85);
      expect(opportunities[2].score).toBe(75);
    });
  });

  describe('edge cases', () => {
    it('should handle empty node array', async () => {
      const scores = await service.calculateOpportunityScores([], mockUserId);
      expect(scores).toHaveLength(0);
    });

    it('should handle very large node arrays efficiently', async () => {
      const largeNodeArray = Array.from({ length: 100 }, (_, i) => ({
        id: `node-${i}`,
        title: `Category ${i}`,
        url: `/cat-${i}`,
        depth: Math.floor(Math.random() * 4) + 1,
        skuCount: Math.floor(Math.random() * 100),
        children: [],
      }));

      const startTime = Date.now();
      const scores = await service.calculateOpportunityScores(largeNodeArray, mockUserId);
      const endTime = Date.now();

      expect(scores).toHaveLength(100);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle network failures gracefully', async () => {
      const nodes: TaxonomyNode[] = [
        {
          id: 'test',
          title: 'Test',
          url: '/test',
          depth: 1,
          skuCount: 10,
          children: [],
        },
      ];

      // Mock network failure
      const { fetchSearchMetrics } = await import('@/lib/integration/gsc-fetcher');
      jest.mocked(fetchSearchMetrics).mockRejectedValueOnce(new Error('Network error'));

      const scores = await service.calculateOpportunityScores(nodes, mockUserId);

      expect(scores).toHaveLength(1);
      expect(scores[0].score).toBeGreaterThanOrEqual(0); // Should still return a score
    });
  });
});
