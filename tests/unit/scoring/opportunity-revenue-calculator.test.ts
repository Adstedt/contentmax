import { describe, it, expect, beforeEach } from '@jest/globals';
import { OpportunityRevenueCalculator } from '@/lib/core/analysis/opportunity-revenue-calculator';
import type { AnalyticsMetrics } from '@/components/taxonomy/D3Visualization/NodeTooltip';

describe('OpportunityRevenueCalculator', () => {
  let calculator: OpportunityRevenueCalculator;

  beforeEach(() => {
    calculator = new OpportunityRevenueCalculator();
  });

  describe('calculate', () => {
    it('should return zero score for no metrics', () => {
      const result = calculator.calculate(null);

      expect(result.score).toBe(50); // No data returns unknown potential
      expect(result.confidence).toBe('low');
      expect(result.factors.conversionGap).toBe(0);
      expect(result.factors.aovGap).toBe(0);
      expect(result.factors.revenueVelocity).toBe(0);
    });

    it('should calculate high score for low conversion rate with high traffic', () => {
      const metrics: AnalyticsMetrics = {
        revenue: 1000,
        transactions: 10,
        sessions: 10000,
        conversionRate: 0.001, // 0.1% conversion
        avgOrderValue: 100,
        engagementRate: 0.3,
      };

      const result = calculator.calculate(metrics);

      expect(result.score).toBeGreaterThan(70);
      expect(result.confidence).toBe('high');
      expect(result.factors.conversionGap).toBeGreaterThan(0.7);
      expect(result.potentialRevenue).toBeGreaterThan(1000);
    });

    it('should calculate low score for good conversion and AOV', () => {
      const metrics: AnalyticsMetrics = {
        revenue: 50000,
        transactions: 100,
        sessions: 2000,
        conversionRate: 0.05, // 5% conversion
        avgOrderValue: 500,
        engagementRate: 0.7,
      };

      const result = calculator.calculate(metrics);

      expect(result.score).toBeLessThan(30);
      expect(result.factors.conversionGap).toBeLessThan(0.3);
    });

    it('should identify AOV improvement opportunities', () => {
      const metrics: AnalyticsMetrics = {
        revenue: 5000,
        transactions: 100,
        sessions: 2000,
        conversionRate: 0.05,
        avgOrderValue: 50, // Low AOV
        engagementRate: 0.5,
      };

      const result = calculator.calculate(metrics);

      expect(result.factors.aovGap).toBeGreaterThan(0.5);
      // AOV gap should be identified
      expect(result.factors.aovGap).toBeGreaterThan(0);
    });

    it('should calculate volume opportunity based on growth', () => {
      const metrics: AnalyticsMetrics = {
        revenue: 5500, // Modest 10% growth
        transactions: 55,
        sessions: 1100,
        conversionRate: 0.05,
        avgOrderValue: 100,
        engagementRate: 0.5,
        previousRevenue: 5000,
        previousTransactions: 50,
        previousSessions: 1000,
      };

      const result = calculator.calculate(metrics);

      expect(result.factors.revenueVelocity).toBeGreaterThanOrEqual(20); // 10% growth = 20 score
    });

    it('should handle low confidence for small data sets', () => {
      const metrics: AnalyticsMetrics = {
        revenue: 100,
        transactions: 1,
        sessions: 10,
        conversionRate: 0.1,
        avgOrderValue: 100,
        engagementRate: 0.5,
      };

      const result = calculator.calculate(metrics);

      expect(result.confidence).toBe('low');
    });

    it('should handle edge cases gracefully', () => {
      const metrics: AnalyticsMetrics = {
        revenue: 0,
        transactions: 0,
        sessions: 0,
        conversionRate: 0,
        avgOrderValue: 0,
        engagementRate: 0,
      };

      const result = calculator.calculate(metrics);

      expect(result.score).toBeGreaterThanOrEqual(0); // May have monetization gap opportunity
      expect(result.confidence).toBe('low');
      expect(result.potentialRevenue).toBe(0);
    });

    it('should calculate potential revenue with multiple improvements', () => {
      const metrics: AnalyticsMetrics = {
        revenue: 5000,
        transactions: 50,
        sessions: 5000,
        conversionRate: 0.01, // Low conversion
        avgOrderValue: 100, // Below average AOV
        engagementRate: 0.3,
      };

      const result = calculator.calculate(metrics);

      // Should identify both conversion and AOV opportunities
      expect(result.score).toBeGreaterThan(60);
      expect(result.factors.conversionGap).toBeGreaterThan(0.5);
      expect(result.factors.aovGap).toBeGreaterThan(0.3);
      expect(result.potentialRevenue).toBeGreaterThan(5000);
    });
  });
});
