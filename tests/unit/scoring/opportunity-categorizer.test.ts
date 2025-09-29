import { describe, it, expect, beforeEach } from '@jest/globals';
import { OpportunityCategorizer } from '@/lib/core/analysis/opportunity-categorizer';

describe('OpportunityCategorizer', () => {
  let categorizer: OpportunityCategorizer;

  beforeEach(() => {
    categorizer = new OpportunityCategorizer();
  });

  describe('categorize', () => {
    it('should categorize quick-win opportunities', () => {
      // High score, low effort (few products)
      const result = categorizer.categorize(75, 5);
      expect(result).toBe('quick-win');
    });

    it('should categorize strategic opportunities', () => {
      // High score, high effort (many products)
      const result = categorizer.categorize(80, 150);
      expect(result).toBe('strategic');
    });

    it('should categorize incremental opportunities', () => {
      // Medium score, low effort (≤10 products = low effort)
      const result = categorizer.categorize(50, 5);
      expect(result).toBe('incremental');
    });

    it('should categorize long-term opportunities', () => {
      // Medium score, high effort
      const result = categorizer.categorize(45, 200);
      expect(result).toBe('long-term');
    });

    it('should categorize maintain status', () => {
      // Low score
      const result = categorizer.categorize(15, 50);
      expect(result).toBe('maintain');
    });

    it('should handle edge cases at boundaries', () => {
      // Test boundary conditions
      expect(categorizer.categorize(70, 10)).toBe('quick-win'); // Exactly at quick-win threshold
      expect(categorizer.categorize(70, 101)).toBe('strategic'); // Just over product threshold
      expect(categorizer.categorize(40, 5)).toBe('incremental'); // At medium score boundary with low effort
      expect(categorizer.categorize(20, 10)).toBe('maintain'); // At low score boundary
    });

    it('should handle zero and negative values', () => {
      expect(categorizer.categorize(0, 0)).toBe('maintain');
      expect(categorizer.categorize(-10, 50)).toBe('maintain');
      expect(categorizer.categorize(50, -5)).toBe('incremental'); // Treats negative as zero
    });

    it('should handle very high scores', () => {
      expect(categorizer.categorize(100, 5)).toBe('quick-win');
      expect(categorizer.categorize(95, 500)).toBe('strategic');
    });

    it('should properly weight effort vs score', () => {
      // High score should override high effort for strategic
      expect(categorizer.categorize(85, 300)).toBe('strategic');

      // High score with low effort should be quick-win
      expect(categorizer.categorize(75, 8)).toBe('quick-win');

      // Medium score with very high effort should be long-term
      expect(categorizer.categorize(50, 250)).toBe('long-term');
    });
  });

  describe('getDescription', () => {
    it('should return correct descriptions for each type', () => {
      expect(categorizer.getDescription('quick-win')).toContain('minimal effort');
      expect(categorizer.getDescription('strategic')).toContain('significant investment');
      expect(categorizer.getDescription('incremental')).toContain('continuous optimization');
      expect(categorizer.getDescription('long-term')).toContain('substantial effort');
      expect(categorizer.getDescription('maintain')).toContain('current performance');
    });
  });

  describe('getPriority', () => {
    it('should return correct priority levels', () => {
      expect(categorizer.getPriority('quick-win')).toBe(1);
      expect(categorizer.getPriority('strategic')).toBe(2);
      expect(categorizer.getPriority('incremental')).toBe(3);
      expect(categorizer.getPriority('long-term')).toBe(4);
      expect(categorizer.getPriority('maintain')).toBe(5);
    });
  });
});
