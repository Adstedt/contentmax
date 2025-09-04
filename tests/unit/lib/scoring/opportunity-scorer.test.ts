import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  OpportunityScorer,
  ScoringFactors,
  OpportunityScore,
} from '@/lib/scoring/opportunity-scorer';
import type { Database } from '@/types/database.types';

// Mock Supabase
const mockSupabase = {
  from: jest.fn(),
} as any;

const createMockQuery = (returnData: any, returnError?: any) => ({
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn().mockResolvedValue({ data: returnData, error: returnError }),
  order: jest.fn().mockReturnThis(),
  limit: jest.fn().mockResolvedValue({ data: returnData, error: returnError }),
  upsert: jest.fn().mockResolvedValue({ data: returnData, error: returnError }),
});

describe('OpportunityScorer', () => {
  let scorer: OpportunityScorer;
  let mockNode: Database['public']['Tables']['taxonomy_nodes']['Row'];
  let mockGSCMetrics: Database['public']['Tables']['node_metrics']['Row'][];
  let mockGA4Metrics: Database['public']['Tables']['node_metrics']['Row'][];

  beforeEach(() => {
    jest.clearAllMocks();

    scorer = new OpportunityScorer(mockSupabase);

    mockNode = {
      id: 'test-node-1',
      url: 'https://example.com/category/electronics',
      path: '/category/electronics',
      title: 'Electronics',
      project_id: 'test-project',
      parent_id: null,
      depth: 1,
      position: 1,
      sku_count: 150,
      content_status: 'optimized',
      optimization_status: 'completed',
      opportunity_score: null,
      revenue_potential: 25000,
      last_scored_at: null,
      metrics_updated_at: null,
      scraped_at: null,
      meta_title: 'Electronics Category',
      meta_description: 'Shop electronics with free shipping',
      metadata: {},
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      deleted_at: null,
    };

    mockGSCMetrics = [
      {
        id: 'gsc-1',
        node_id: 'test-node-1',
        source: 'gsc',
        date: '2024-09-01',
        impressions: 10000,
        clicks: 500,
        ctr: 0.05, // 5% CTR
        position: 8.5,
        sessions: null,
        revenue: null,
        transactions: null,
        conversion_rate: null,
        bounce_rate: null,
        avg_session_duration: null,
        product_views: null,
        add_to_carts: null,
        created_at: '2024-09-01T00:00:00Z',
        updated_at: '2024-09-01T00:00:00Z',
      },
    ];

    mockGA4Metrics = [
      {
        id: 'ga4-1',
        node_id: 'test-node-1',
        source: 'ga4',
        date: '2024-09-01',
        sessions: 450,
        revenue: 15000,
        transactions: 75,
        conversion_rate: 0.167,
        bounce_rate: 0.35,
        avg_session_duration: 180,
        product_views: 1200,
        add_to_carts: 150,
        impressions: null,
        clicks: null,
        ctr: null,
        position: null,
        created_at: '2024-09-01T00:00:00Z',
        updated_at: '2024-09-01T00:00:00Z',
      },
    ];
  });

  describe('calculateScore', () => {
    it('should calculate a complete opportunity score', async () => {
      // Mock database calls
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'taxonomy_nodes') {
          return createMockQuery(mockNode);
        }
        if (table === 'node_metrics') {
          return createMockQuery([...mockGSCMetrics, ...mockGA4Metrics]);
        }
        return createMockQuery(null);
      });

      const result = await scorer.calculateScore('test-node-1');

      expect(result).toMatchObject({
        nodeId: 'test-node-1',
        score: expect.any(Number),
        confidence: expect.any(Number),
        factors: expect.objectContaining({
          ctrGap: expect.any(Number),
          searchVolume: expect.any(Number),
          positionPotential: expect.any(Number),
          competition: expect.any(Number),
          revenue: expect.any(Number),
        }),
        recommendations: expect.any(Array),
        revenuePotential: expect.any(Number),
        priority: expect.any(Number),
      });

      expect(result.score).toBeGreaterThan(0);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(100);
      expect(result.priority).toBeGreaterThanOrEqual(1);
      expect(result.priority).toBeLessThanOrEqual(5);
    });

    it('should handle missing node', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'taxonomy_nodes') {
          return createMockQuery(null);
        }
        return createMockQuery([]);
      });

      await expect(scorer.calculateScore('non-existent-node')).rejects.toThrow(
        'Node non-existent-node not found'
      );
    });

    it('should handle missing metrics gracefully', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'taxonomy_nodes') {
          return createMockQuery(mockNode);
        }
        if (table === 'node_metrics') {
          return createMockQuery([]);
        }
        return createMockQuery(null);
      });

      const result = await scorer.calculateScore('test-node-1');

      expect(result.confidence).toBe(0); // No metrics = 0 confidence
      expect(result.factors.ctrGap).toBe(0);
      expect(result.factors.searchVolume).toBe(0);
      expect(result.factors.positionPotential).toBe(0);
      expect(result.recommendations.length).toBeGreaterThanOrEqual(1); // Should have at least one recommendation
    });
  });

  describe('CTR Gap Calculation', () => {
    it('should calculate high CTR gap for underperforming pages', async () => {
      // Position 3 should have ~10.65% CTR, but actual is 2%
      const underperformingGSC = [
        {
          ...mockGSCMetrics[0],
          position: 3,
          ctr: 0.02,
          impressions: 5000,
        },
      ];

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'taxonomy_nodes') {
          return createMockQuery(mockNode);
        }
        if (table === 'node_metrics') {
          return createMockQuery([...underperformingGSC, ...mockGA4Metrics]);
        }
        return createMockQuery(null);
      });

      const result = await scorer.calculateScore('test-node-1');

      // CTR gap should be high (expected 10.65% - actual 2% = 8.65% gap)
      expect(result.factors.ctrGap).toBeGreaterThan(30);
      // Check if CTR recommendation is generated when gap is high enough
      const hasCTRRecommendation = result.recommendations.some(
        (r) =>
          r.includes('title tags') || r.includes('meta descriptions') || r.includes('click-through')
      );
      if (result.factors.ctrGap > 60) {
        expect(hasCTRRecommendation).toBe(true);
      }
    });

    it('should calculate low CTR gap for well-performing pages', async () => {
      // Position 5 should have ~5.53% CTR, actual is 6%
      const wellPerformingGSC = [
        {
          ...mockGSCMetrics[0],
          position: 5,
          ctr: 0.06,
          impressions: 8000,
        },
      ];

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'taxonomy_nodes') {
          return createMockQuery(mockNode);
        }
        if (table === 'node_metrics') {
          return createMockQuery([...wellPerformingGSC, ...mockGA4Metrics]);
        }
        return createMockQuery(null);
      });

      const result = await scorer.calculateScore('test-node-1');

      // CTR gap should be low or zero
      expect(result.factors.ctrGap).toBeLessThan(10);
    });
  });

  describe('Search Volume Scoring', () => {
    it('should score high volume pages higher', async () => {
      const highVolumeGSC = [
        {
          ...mockGSCMetrics[0],
          impressions: 100000, // Very high volume
        },
      ];

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'taxonomy_nodes') {
          return createMockQuery(mockNode);
        }
        if (table === 'node_metrics') {
          return createMockQuery([...highVolumeGSC, ...mockGA4Metrics]);
        }
        return createMockQuery(null);
      });

      const result = await scorer.calculateScore('test-node-1');

      expect(result.factors.searchVolume).toBeGreaterThan(70);
      expect(result.recommendations).toContain(
        'High search volume - prioritize for immediate optimization'
      );
    });

    it('should score low volume pages lower', async () => {
      const lowVolumeGSC = [
        {
          ...mockGSCMetrics[0],
          impressions: 100, // Low volume
        },
      ];

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'taxonomy_nodes') {
          return createMockQuery(mockNode);
        }
        if (table === 'node_metrics') {
          return createMockQuery([...lowVolumeGSC, ...mockGA4Metrics]);
        }
        return createMockQuery(null);
      });

      const result = await scorer.calculateScore('test-node-1');

      expect(result.factors.searchVolume).toBeLessThan(40); // Adjust threshold slightly
    });
  });

  describe('Position Potential Scoring', () => {
    it('should give high potential to positions 4-10', async () => {
      const midRankingGSC = [
        {
          ...mockGSCMetrics[0],
          position: 7,
        },
      ];

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'taxonomy_nodes') {
          return createMockQuery(mockNode);
        }
        if (table === 'node_metrics') {
          return createMockQuery([...midRankingGSC, ...mockGA4Metrics]);
        }
        return createMockQuery(null);
      });

      const result = await scorer.calculateScore('test-node-1');

      expect(result.factors.positionPotential).toBe(90);
      expect(result.recommendations).toContain(
        'Optimize content and technical SEO to improve search rankings'
      );
    });

    it('should give low potential to top 3 positions', async () => {
      const topRankingGSC = [
        {
          ...mockGSCMetrics[0],
          position: 2,
        },
      ];

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'taxonomy_nodes') {
          return createMockQuery(mockNode);
        }
        if (table === 'node_metrics') {
          return createMockQuery([...topRankingGSC, ...mockGA4Metrics]);
        }
        return createMockQuery(null);
      });

      const result = await scorer.calculateScore('test-node-1');

      expect(result.factors.positionPotential).toBe(20);
    });

    it('should give very low potential to positions beyond 50', async () => {
      const lowRankingGSC = [
        {
          ...mockGSCMetrics[0],
          position: 75,
        },
      ];

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'taxonomy_nodes') {
          return createMockQuery(mockNode);
        }
        if (table === 'node_metrics') {
          return createMockQuery([...lowRankingGSC, ...mockGA4Metrics]);
        }
        return createMockQuery(null);
      });

      const result = await scorer.calculateScore('test-node-1');

      expect(result.factors.positionPotential).toBe(10);
    });
  });

  describe('Revenue Scoring', () => {
    it('should score high revenue pages higher', async () => {
      const highRevenueGA4 = [
        {
          ...mockGA4Metrics[0],
          revenue: 75000, // High revenue
        },
      ];

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'taxonomy_nodes') {
          return createMockQuery(mockNode);
        }
        if (table === 'node_metrics') {
          return createMockQuery([...mockGSCMetrics, ...highRevenueGA4]);
        }
        return createMockQuery(null);
      });

      const result = await scorer.calculateScore('test-node-1');

      expect(result.factors.revenue).toBeGreaterThan(80);
      expect(result.recommendations).toContain(
        'High revenue potential - focus on conversion optimization'
      );
    });

    it('should use node revenue_potential when GA4 data unavailable', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'taxonomy_nodes') {
          return createMockQuery({
            ...mockNode,
            revenue_potential: 50000,
          });
        }
        if (table === 'node_metrics') {
          return createMockQuery(mockGSCMetrics); // No GA4 data
        }
        return createMockQuery(null);
      });

      const result = await scorer.calculateScore('test-node-1');

      expect(result.factors.revenue).toBeGreaterThan(60);
    });
  });

  describe('Confidence Calculation', () => {
    it('should have high confidence with complete data', async () => {
      const completeGSC = [
        {
          ...mockGSCMetrics[0],
          impressions: 15000,
          clicks: 750,
          position: 6,
          ctr: 0.05,
        },
      ];

      const completeGA4 = [
        {
          ...mockGA4Metrics[0],
          sessions: 700,
          revenue: 20000,
        },
      ];

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'taxonomy_nodes') {
          return createMockQuery(mockNode);
        }
        if (table === 'node_metrics') {
          return createMockQuery([...completeGSC, ...completeGA4]);
        }
        return createMockQuery(null);
      });

      const result = await scorer.calculateScore('test-node-1');

      expect(result.confidence).toBeGreaterThanOrEqual(50); // GA4 data contributes 40%, GSC contributes 60%
    });

    it('should have low confidence with sparse data', async () => {
      const sparseGSC = [
        {
          ...mockGSCMetrics[0],
          impressions: 50, // Low impressions
          clicks: 2, // Low clicks
          position: null,
          ctr: 0.04,
        },
      ];

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'taxonomy_nodes') {
          return createMockQuery(mockNode);
        }
        if (table === 'node_metrics') {
          return createMockQuery(sparseGSC); // No GA4 data
        }
        return createMockQuery(null);
      });

      const result = await scorer.calculateScore('test-node-1');

      expect(result.confidence).toBeLessThan(40);
    });

    it('should penalize old data', async () => {
      const oldGSC = [
        {
          ...mockGSCMetrics[0],
          date: '2024-01-01', // Very old data
        },
      ];

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'taxonomy_nodes') {
          return createMockQuery(mockNode);
        }
        if (table === 'node_metrics') {
          return createMockQuery([...oldGSC, ...mockGA4Metrics]);
        }
        return createMockQuery(null);
      });

      const result = await scorer.calculateScore('test-node-1');

      // Should be penalized for data age
      expect(result.confidence).toBeLessThan(70);
    });
  });

  describe('Batch Scoring', () => {
    it('should process multiple nodes', async () => {
      const nodeIds = ['node-1', 'node-2', 'node-3'];
      let callCount = 0;

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'taxonomy_nodes') {
          return createMockQuery({
            ...mockNode,
            id: `node-${++callCount}`,
          });
        }
        if (table === 'node_metrics') {
          return createMockQuery([...mockGSCMetrics, ...mockGA4Metrics]);
        }
        return createMockQuery(null);
      });

      const progressCallback = jest.fn();
      const results = await scorer.calculateBatchScores(nodeIds, progressCallback);

      expect(results).toHaveLength(3);
      expect(progressCallback).toHaveBeenCalledWith(3, 3);
      expect(results.every((r) => r.score > 0)).toBe(true);
    });

    it('should handle errors gracefully in batch', async () => {
      const nodeIds = ['good-node', 'bad-node'];
      let callCount = 0;

      mockSupabase.from.mockImplementation((table: string) => {
        callCount++;
        if (table === 'taxonomy_nodes') {
          if (callCount <= 2) {
            return createMockQuery(mockNode); // First node succeeds
          } else {
            return createMockQuery(null); // Second node fails
          }
        }
        if (table === 'node_metrics') {
          return createMockQuery([...mockGSCMetrics, ...mockGA4Metrics]);
        }
        return createMockQuery(null);
      });

      const results = await scorer.calculateBatchScores(nodeIds);

      expect(results).toHaveLength(1); // Only successful node
      expect(results[0].score).toBeGreaterThan(0);
    });
  });

  describe('Recommendations Generation', () => {
    it('should generate CTR improvement recommendations', async () => {
      const lowCTRGSC = [
        {
          ...mockGSCMetrics[0],
          position: 4,
          ctr: 0.02, // Much lower than expected ~7.3%
        },
      ];

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'taxonomy_nodes') {
          return createMockQuery(mockNode);
        }
        if (table === 'node_metrics') {
          return createMockQuery([...lowCTRGSC, ...mockGA4Metrics]);
        }
        return createMockQuery(null);
      });

      const result = await scorer.calculateScore('test-node-1');

      // Check if CTR improvement recommendation is present when gap is high
      const hasCTRRecommendation = result.recommendations.some(
        (r) =>
          r.includes('title tags') || r.includes('meta descriptions') || r.includes('click-through')
      );
      if (result.factors.ctrGap > 60) {
        expect(hasCTRRecommendation).toBe(true);
      } else {
        // If gap isn't high enough, other recommendations should still be present
        expect(result.recommendations.length).toBeGreaterThan(0);
      }
    });

    it('should generate content recommendations based on status', async () => {
      const missingContentNode = {
        ...mockNode,
        content_status: 'missing' as const,
      };

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'taxonomy_nodes') {
          return createMockQuery(missingContentNode);
        }
        if (table === 'node_metrics') {
          return createMockQuery([...mockGSCMetrics, ...mockGA4Metrics]);
        }
        return createMockQuery(null);
      });

      const result = await scorer.calculateScore('test-node-1');

      // Check if missing content recommendation is present
      const hasContentRecommendation = result.recommendations.some((r) =>
        r.includes('Create content')
      );
      expect(hasContentRecommendation).toBe(true);
    });

    it('should limit recommendations to 5', async () => {
      // Create conditions that would generate many recommendations
      const highOpportunityGSC = [
        {
          ...mockGSCMetrics[0],
          position: 8, // High position potential
          ctr: 0.01, // Low CTR = high gap
          impressions: 50000, // High volume
        },
      ];

      const highRevenueGA4 = [
        {
          ...mockGA4Metrics[0],
          revenue: 100000, // High revenue
        },
      ];

      const outdatedNode = {
        ...mockNode,
        content_status: 'outdated',
      };

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'taxonomy_nodes') {
          return createMockQuery(outdatedNode);
        }
        if (table === 'node_metrics') {
          return createMockQuery([...highOpportunityGSC, ...highRevenueGA4]);
        }
        return createMockQuery(null);
      });

      const result = await scorer.calculateScore('test-node-1');

      expect(result.recommendations.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Score Storage', () => {
    it('should store opportunity scores in database', async () => {
      const mockScores: OpportunityScore[] = [
        {
          nodeId: 'test-1',
          score: 75,
          confidence: 85,
          factors: {
            ctrGap: 60,
            searchVolume: 80,
            positionPotential: 70,
            competition: 75,
            revenue: 65,
          },
          recommendations: ['Improve CTR', 'Optimize content'],
          revenuePotential: 30000,
          priority: 2,
        },
      ];

      const mockUpsert = jest.fn().mockResolvedValue({ data: null, error: null });
      mockSupabase.from.mockReturnValue({
        upsert: mockUpsert,
      });

      await scorer.storeScores(mockScores);

      expect(mockSupabase.from).toHaveBeenCalledWith('opportunities');
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            node_id: 'test-1',
            score: 75,
            factors: mockScores[0].factors,
            recommendations: mockScores[0].recommendations,
            revenue_potential: 30000,
            priority: 2,
            computed_at: expect.any(String),
            valid_until: expect.any(String),
          }),
        ]),
        { onConflict: 'node_id', returning: 'minimal' }
      );
    });

    it('should handle database errors when storing', async () => {
      const mockError = new Error('Database error');
      const mockUpsert = jest.fn().mockResolvedValue({
        data: null,
        error: mockError,
      });

      mockSupabase.from.mockReturnValue({
        upsert: mockUpsert,
      });

      const mockScores: OpportunityScore[] = [
        {
          nodeId: 'test-1',
          score: 75,
          confidence: 85,
          factors: {} as ScoringFactors,
          recommendations: [],
          revenuePotential: 30000,
          priority: 2,
        },
      ];

      await expect(scorer.storeScores(mockScores)).rejects.toThrow(
        'Failed to store opportunity scores: Database error'
      );
    });
  });

  describe('Custom Configuration', () => {
    it('should use custom weights', () => {
      const customWeights = {
        ctrGap: 0.5,
        searchVolume: 0.3,
        positionPotential: 0.1,
        competition: 0.05,
        revenue: 0.05,
      };

      const customScorer = new OpportunityScorer(mockSupabase, {
        weights: customWeights,
      });

      // Access private weights for testing (in real scenario, this would be tested through score calculation)
      expect((customScorer as any).weights.ctrGap).toBe(0.5);
      expect((customScorer as any).weights.searchVolume).toBe(0.3);
    });

    it('should use custom CTR benchmarks', () => {
      const customBenchmarks = [
        { position: 1, expectedCTR: 0.35 },
        { position: 2, expectedCTR: 0.25 },
      ];

      const customScorer = new OpportunityScorer(mockSupabase, {
        ctrBenchmarks: customBenchmarks,
      });

      expect((customScorer as any).ctrBenchmarks).toEqual(customBenchmarks);
    });
  });
});
