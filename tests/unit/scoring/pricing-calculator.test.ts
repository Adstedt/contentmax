import { describe, it, expect, beforeEach } from '@jest/globals';
import { PricingCalculator, type PricingData } from '@/lib/scoring/pricing-calculator';

describe('PricingCalculator', () => {
  let calculator: PricingCalculator;

  beforeEach(() => {
    calculator = new PricingCalculator();
  });

  describe('calculate', () => {
    it('should return zero score for no pricing data', () => {
      const result = calculator.calculate(null);

      expect(result.score).toBe(0);
      expect(result.confidence).toBe('low');
      expect(result.factors.priceGap).toBe(0);
      expect(result.factors.marginOpportunity).toBe(0);
      expect(result.factors.priceElasticity).toBe(0);
    });

    it('should identify high-priced products with opportunity', () => {
      const pricingData: PricingData = {
        ourPrice: 150,
        marketMedian: 100,
        marketMin: 80,
        marketMax: 120,
        competitorCount: 5,
      };

      const result = calculator.calculate(pricingData);

      // Expect moderate score for above-market pricing (not high opportunity)
      expect(result.score).toBeGreaterThan(25);
      expect(result.score).toBeLessThan(50);
      expect(result.factors.priceGap).toBeGreaterThanOrEqual(20);
      expect(result.potentialPriceIncrease).toBe(0); // Above market, no increase recommended
    });

    it('should identify underpriced products with margin opportunity', () => {
      const pricingData: PricingData = {
        ourPrice: 50,
        marketMedian: 75,
        marketMin: 60,
        marketMax: 90,
        competitorCount: 4,
      };

      const result = calculator.calculate(pricingData);

      expect(result.factors.priceGap).toBeGreaterThan(0); // Below market
      expect(result.potentialPriceIncrease).toBeGreaterThan(0); // Should recommend increasing
      expect(result.estimatedRevenueImpact).toBeGreaterThanOrEqual(0);
    });

    it('should calculate optimal pricing for competitive products', () => {
      const pricingData: PricingData = {
        ourPrice: 100,
        marketMedian: 100,
        marketMin: 95,
        marketMax: 105,
        competitorCount: 8,
      };

      const result = calculator.calculate(pricingData);

      expect(result.score).toBeLessThan(40); // Low opportunity score
      expect(Math.abs(result.potentialPriceIncrease)).toBeLessThan(10); // At market, minimal adjustment
    });

    it('should identify pricing opportunities based on market position', () => {
      const belowMarket: PricingData = {
        ourPrice: 80,
        marketMedian: 100,
        marketMin: 90,
        marketMax: 110,
        competitorCount: 5,
      };

      const aboveMarket: PricingData = {
        ourPrice: 120,
        marketMedian: 100,
        marketMin: 90,
        marketMax: 110,
        competitorCount: 5,
      };

      const belowResult = calculator.calculate(belowMarket);
      const aboveResult = calculator.calculate(aboveMarket);

      // Below market should identify upward opportunity
      expect(belowResult.potentialPriceIncrease).toBeGreaterThan(0);
      // Above market may need adjustment
      expect(aboveResult.factors.competitivePosition).toBeGreaterThan(0);
    });

    it('should handle margin constraints', () => {
      const highPrice: PricingData = {
        ourPrice: 100,
        marketMedian: 80,
        marketMin: 70,
        marketMax: 90,
        competitorCount: 6,
      };

      const result = calculator.calculate(highPrice, 10000, 0.1); // Low margin

      // Should consider margin in opportunity calculation
      expect(result.factors.marginOpportunity).toBeGreaterThan(0);
      expect(result.score).toBeGreaterThan(0);
    });

    it('should calculate confidence based on data quality', () => {
      const goodData: PricingData = {
        ourPrice: 100,
        marketMedian: 100,
        marketMin: 95,
        marketMax: 105, // Tight price range
        competitorCount: 10, // Many competitors
      };

      const poorData: PricingData = {
        ourPrice: 100,
        marketMedian: 100,
        marketMin: 50,
        marketMax: 200, // Wide price range
        competitorCount: 2, // Few competitors
      };

      const goodResult = calculator.calculate(goodData);
      const poorResult = calculator.calculate(poorData);

      expect(goodResult.confidence).toBe('high');
      expect(poorResult.confidence).toBe('low');
    });

    it('should handle edge cases', () => {
      const zeroVolume: PricingData = {
        ourPrice: 0,
        marketMedian: 0,
        marketMin: 0,
        marketMax: 0,
        competitorCount: 0,
      };

      const result = calculator.calculate(zeroVolume);

      expect(result.score).toBe(0);
      expect(result.confidence).toBe('low');
      expect(result.estimatedRevenueImpact).toBe(0);
    });
  });
});
