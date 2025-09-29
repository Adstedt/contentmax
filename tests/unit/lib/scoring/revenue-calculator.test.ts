import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  RevenueCalculator,
  RevenueProjection,
  WhatIfScenario,
} from '@/lib/core/analysis/revenue-calculator';
import type { Database } from '@/types/database.types';

// Mock Supabase
const mockSupabase = {
  from: jest.fn(),
} as any;

const createMockQuery = (returnData: any, returnError?: any) => ({
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  gte: jest.fn().mockReturnThis(),
  order: jest.fn().mockResolvedValue({ data: returnData, error: returnError }),
});

describe('RevenueCalculator', () => {
  let calculator: RevenueCalculator;
  let mockMetrics: Database['public']['Tables']['node_metrics']['Row'][];

  beforeEach(() => {
    jest.clearAllMocks();
    calculator = new RevenueCalculator(mockSupabase);

    // Create mock metrics with seasonal variation
    const baseDate = new Date();
    mockMetrics = [];

    for (let i = 0; i < 12; i++) {
      const date = new Date(baseDate);
      date.setMonth(date.getMonth() - i);

      // GSC metrics
      mockMetrics.push({
        id: `gsc-${i}`,
        node_id: 'test-node-1',
        source: 'gsc',
        date: date.toISOString().split('T')[0],
        impressions: 10000 - i * 100, // Declining impressions over time
        clicks: 500 - i * 10,
        ctr: 0.05,
        position: 8 + i * 0.2, // Gradually improving position
        sessions: null,
        revenue: null,
        transactions: null,
        conversion_rate: null,
        bounce_rate: null,
        avg_session_duration: null,
        product_views: null,
        add_to_carts: null,
        created_at: date.toISOString(),
        updated_at: date.toISOString(),
      });

      // GA4 metrics with seasonal variation
      const seasonalMultiplier = 1 + 0.3 * Math.sin((date.getMonth() / 12) * 2 * Math.PI);
      mockMetrics.push({
        id: `ga4-${i}`,
        node_id: 'test-node-1',
        source: 'ga4',
        date: date.toISOString().split('T')[0],
        sessions: Math.floor(450 * seasonalMultiplier),
        revenue: Math.floor(15000 * seasonalMultiplier),
        transactions: Math.floor(75 * seasonalMultiplier),
        conversion_rate: 0.167,
        bounce_rate: 0.35,
        avg_session_duration: 180,
        product_views: 1200,
        add_to_carts: 150,
        impressions: null,
        clicks: null,
        ctr: null,
        position: null,
        created_at: date.toISOString(),
        updated_at: date.toISOString(),
      });
    }
  });

  describe('calculateProjection', () => {
    it('should calculate revenue projection with default scenario', async () => {
      mockSupabase.from.mockReturnValue(createMockQuery(mockMetrics));

      const result = await calculator.calculateProjection('test-node-1');

      expect(result).toMatchObject({
        nodeId: 'test-node-1',
        currentRevenue: expect.any(Number),
        projectedRevenue: {
          conservative: expect.any(Number),
          realistic: expect.any(Number),
          optimistic: expect.any(Number),
        },
        revenueIncrease: {
          conservative: expect.any(Number),
          realistic: expect.any(Number),
          optimistic: expect.any(Number),
        },
        assumptions: expect.objectContaining({
          currentPosition: expect.any(Number),
          targetPosition: expect.any(Number),
          currentCTR: expect.any(Number),
          projectedCTR: expect.any(Number),
        }),
        confidence: expect.any(Number),
        timeToImpact: expect.any(Number),
      });

      // Verify projections are logical
      expect(result.projectedRevenue.conservative).toBeLessThanOrEqual(
        result.projectedRevenue.realistic
      );
      expect(result.projectedRevenue.realistic).toBeLessThanOrEqual(
        result.projectedRevenue.optimistic
      );
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(100);
    });

    it('should handle what-if scenarios', async () => {
      mockSupabase.from.mockReturnValue(createMockQuery(mockMetrics));

      const scenario: WhatIfScenario = {
        targetPosition: 3,
        ctrImprovement: 2, // 2 percentage points
        conversionRateImprovement: 10, // 10% improvement
      };

      const result = await calculator.calculateProjection('test-node-1', scenario);

      expect(result.assumptions.targetPosition).toBe(3);
      expect(result.assumptions.projectedCTR).toBeGreaterThan(result.assumptions.currentCTR);
      expect(result.assumptions.conversionRate).toBeGreaterThan(0.167);
      expect(result.revenueIncrease.realistic).toBeGreaterThan(0);
    });

    it('should throw error when no metrics found', async () => {
      mockSupabase.from.mockReturnValue(createMockQuery([]));

      await expect(calculator.calculateProjection('non-existent')).rejects.toThrow(
        'No metrics found for node non-existent'
      );
    });
  });

  describe('calculateScenarios', () => {
    it('should calculate multiple scenarios', async () => {
      mockSupabase.from.mockReturnValue(createMockQuery(mockMetrics));

      const scenarios: WhatIfScenario[] = [
        { targetPosition: 1 },
        { targetPosition: 3 },
        { targetPosition: 5 },
      ];

      const results = await calculator.calculateScenarios('test-node-1', scenarios);

      expect(results).toHaveLength(3);

      // Position 1 should have highest revenue potential
      expect(results[0].projectedRevenue.realistic).toBeGreaterThan(
        results[1].projectedRevenue.realistic
      );
      expect(results[1].projectedRevenue.realistic).toBeGreaterThan(
        results[2].projectedRevenue.realistic
      );
    });
  });

  describe('Seasonality Calculation', () => {
    it('should detect seasonal patterns', async () => {
      mockSupabase.from.mockReturnValue(createMockQuery(mockMetrics));

      const result = await calculator.calculateProjection('test-node-1');

      // Seasonality factor should be calculated
      expect(result.assumptions.seasonalityFactor).toBeGreaterThan(0);
      expect(result.assumptions.seasonalityFactor).toBeLessThanOrEqual(2); // Reasonable range
    });

    it('should default to 1.0 with insufficient data', async () => {
      const limitedMetrics = mockMetrics.slice(0, 4); // Only 2 months of data
      mockSupabase.from.mockReturnValue(createMockQuery(limitedMetrics));

      const result = await calculator.calculateProjection('test-node-1');

      expect(result.assumptions.seasonalityFactor).toBe(1.0);
    });
  });

  describe('Confidence Calculation', () => {
    it('should have high confidence with complete recent data', async () => {
      mockSupabase.from.mockReturnValue(createMockQuery(mockMetrics));

      const result = await calculator.calculateProjection('test-node-1');

      // With 12 months of data and good volume, confidence should be high
      expect(result.confidence).toBeGreaterThan(60);
    });

    it('should have low confidence with sparse data', async () => {
      const sparseMetrics = mockMetrics.slice(0, 2); // Only 1 month
      mockSupabase.from.mockReturnValue(createMockQuery(sparseMetrics));

      const result = await calculator.calculateProjection('test-node-1');

      expect(result.confidence).toBeLessThan(50); // Adjusted threshold for sparse data
    });
  });

  describe('Time to Impact Estimation', () => {
    it('should estimate shorter time for small position changes', async () => {
      mockSupabase.from.mockReturnValue(createMockQuery(mockMetrics));

      const scenario: WhatIfScenario = {
        targetPosition: 7, // From position 8 to 7
      };

      const result = await calculator.calculateProjection('test-node-1', scenario);

      expect(result.timeToImpact).toBe(30); // 1 month
    });

    it('should estimate longer time for large position changes', async () => {
      mockSupabase.from.mockReturnValue(createMockQuery(mockMetrics));

      const scenario: WhatIfScenario = {
        targetPosition: 1, // From position 8 to 1
      };

      const result = await calculator.calculateProjection('test-node-1', scenario);

      expect(result.timeToImpact).toBe(90); // 3 months
    });
  });

  describe('Batch Processing', () => {
    it('should process multiple nodes', async () => {
      mockSupabase.from.mockReturnValue(createMockQuery(mockMetrics));

      const nodeIds = ['node-1', 'node-2', 'node-3'];
      const progressCallback = jest.fn();

      const results = await calculator.batchCalculateProjections(
        nodeIds,
        undefined,
        progressCallback
      );

      expect(results).toHaveLength(3);
      expect(progressCallback).toHaveBeenCalledWith(3, 3);
    });

    it('should handle errors gracefully in batch', async () => {
      mockSupabase.from
        .mockReturnValueOnce(createMockQuery(mockMetrics)) // First succeeds
        .mockReturnValueOnce(createMockQuery([])) // Second fails
        .mockReturnValueOnce(createMockQuery(mockMetrics)); // Third succeeds

      const nodeIds = ['node-1', 'node-2', 'node-3'];
      const results = await calculator.batchCalculateProjections(nodeIds);

      expect(results).toHaveLength(2); // Only successful ones
    });
  });

  describe('Revenue Calculations', () => {
    it('should calculate realistic revenue increases', async () => {
      mockSupabase.from.mockReturnValue(createMockQuery(mockMetrics));

      const scenario: WhatIfScenario = {
        targetPosition: 3, // Move from 8 to 3
      };

      const result = await calculator.calculateProjection('test-node-1', scenario);

      // Moving from position 8 to 3 should significantly increase traffic and revenue
      expect(result.revenueIncrease.realistic).toBeGreaterThan(0);

      // CTR should improve significantly (position 8 ~3.4% to position 3 ~10.6%)
      expect(result.assumptions.projectedCTR).toBeGreaterThan(result.assumptions.currentCTR * 2);
    });

    it('should apply multipliers correctly', async () => {
      const customCalculator = new RevenueCalculator(mockSupabase, {
        conservativeMultiplier: 0.5,
        realisticMultiplier: 1.0,
        optimisticMultiplier: 2.0,
      });

      mockSupabase.from.mockReturnValue(createMockQuery(mockMetrics));

      const result = await customCalculator.calculateProjection('test-node-1');

      // Check multiplier relationships
      expect(result.projectedRevenue.conservative).toBe(result.projectedRevenue.realistic * 0.5);
      expect(result.projectedRevenue.optimistic).toBe(result.projectedRevenue.realistic * 2.0);
    });
  });
});
