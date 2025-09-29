import { describe, it, expect, beforeEach } from '@jest/globals';
import { URLMatcher } from '@/lib/core/analysis/url-matcher';
import { URLMatchOptions, BatchMatchRequest } from '@/types/url-matcher.types';

describe('URLMatcher', () => {
  let matcher: URLMatcher;

  beforeEach(() => {
    matcher = new URLMatcher();
  });

  describe('URL Normalization', () => {
    it('should normalize URLs consistently', () => {
      const urls = [
        'https://www.example.com/products/',
        'http://WWW.EXAMPLE.COM/products',
        'https://example.com/products/',
        'HTTPS://example.com/products',
      ];

      const normalized = urls.map(url => matcher.normalizeURL(url));
      
      // All should normalize to the same value
      expect(normalized[0].normalized).toBe(normalized[1].normalized);
      expect(normalized[1].normalized).toBe(normalized[2].normalized);
      expect(normalized[2].normalized).toBe(normalized[3].normalized);
    });

    it('should handle trailing slashes correctly', () => {
      const result1 = matcher.normalizeURL('https://example.com/products/');
      const result2 = matcher.normalizeURL('https://example.com/products');
      
      expect(result1.normalized).toBe(result2.normalized);
    });

    it('should ignore query parameters when configured', () => {
      const options: URLMatchOptions = { ignoreQueryParams: true };
      
      const result1 = matcher.normalizeURL('https://example.com/products?id=123', options);
      const result2 = matcher.normalizeURL('https://example.com/products?id=456', options);
      
      expect(result1.normalized).toBe(result2.normalized);
    });

    it('should preserve query parameters when not ignored', () => {
      const options: URLMatchOptions = { ignoreQueryParams: false };
      
      const result1 = matcher.normalizeURL('https://example.com/products?id=123', options);
      const result2 = matcher.normalizeURL('https://example.com/products?id=456', options);
      
      expect(result1.normalized).not.toBe(result2.normalized);
    });

    it('should handle malformed URLs gracefully', () => {
      const malformed = [
        'not-a-url',
        'example.com/products',
        '/products/shoes',
        'products/shoes',
      ];

      malformed.forEach(url => {
        const result = matcher.normalizeURL(url);
        expect(result).toBeDefined();
        expect(result.original).toBe(url);
      });
    });

    it('should extract URL components correctly', () => {
      const result = matcher.normalizeURL('https://subdomain.example.com/products/shoes?color=red#reviews');
      
      expect(result.components.protocol).toBe('https');
      expect(result.components.domain).toBe('subdomain.example.com');
      expect(result.components.subdomain).toBe('subdomain');
      expect(result.components.path).toBe('/products/shoes');
      expect(result.components.params).toEqual({ color: 'red' });
      expect(result.components.fragment).toBe('reviews');
    });
  });

  describe('Exact Matching', () => {
    it('should match identical URLs with confidence 1.0', () => {
      const url = 'https://example.com/products';
      const result = matcher.matchURL(url, url);
      
      expect(result).not.toBeNull();
      expect(result!.confidence).toBe(1.0);
      expect(result!.matchType).toBe('exact');
    });

    it('should match normalized URLs with confidence 0.95', () => {
      const result = matcher.matchURL(
        'https://www.example.com/products/',
        'http://example.com/products'
      );
      
      expect(result).not.toBeNull();
      expect(result!.confidence).toBe(0.95);
      expect(result!.matchType).toBe('normalized');
    });
  });

  describe('Fuzzy Matching', () => {
    it('should match similar URLs with fuzzy matching', () => {
      const result = matcher.matchURL(
        'https://example.com/products',
        'https://example.com/product'
      );
      
      expect(result).not.toBeNull();
      expect(result!.matchType).toBe('fuzzy');
      expect(result!.confidence).toBeGreaterThan(0.7);
      expect(result!.confidence).toBeLessThan(0.95);
    });

    it('should not match dissimilar URLs', () => {
      const result = matcher.matchURL(
        'https://example.com/products',
        'https://example.com/about'
      );
      
      expect(result).toBeNull();
    });

    it('should respect fuzzy threshold', () => {
      const strictMatcher = new URLMatcher({ fuzzyThreshold: 0.9 });
      
      const result = strictMatcher.matchURL(
        'https://example.com/products',
        'https://example.com/product'
      );
      
      // With higher threshold, slight differences shouldn't match
      expect(result).toBeNull();
    });
  });

  describe('Pattern Matching', () => {
    it('should match product URLs with same ID', () => {
      const result = matcher.matchURL(
        'https://shop1.com/product/shoes-123',
        'https://shop2.com/products/shoes-123'
      );
      
      expect(result).not.toBeNull();
      expect(result!.matchType).toBe('pattern');
      expect(result!.confidence).toBeGreaterThanOrEqual(0.85);
    });

    it('should match category URLs', () => {
      const result = matcher.matchURL(
        'https://example.com/category/electronics',
        'https://example.com/categories/electronics'
      );
      
      expect(result).not.toBeNull();
      expect(result!.matchType).toBe('pattern');
    });

    it('should match blog URLs with dates', () => {
      const result = matcher.matchURL(
        'https://example.com/blog/2024/01/my-post',
        'https://example.com/blog/2024/01/my-post'
      );
      
      expect(result).not.toBeNull();
    });

    it('should match collection URLs', () => {
      const result = matcher.matchURL(
        'https://shop.com/collection/summer-2024',
        'https://shop.com/collections/summer-2024'
      );
      
      expect(result).not.toBeNull();
      expect(result!.matchType).toBe('pattern');
    });

    it('should add custom patterns', () => {
      matcher.addPattern({
        name: 'custom',
        pattern: /\/custom\/([^/]+)/,
        extractId: (url) => {
          const match = url.match(/\/custom\/([^/]+)/);
          return match ? match[1] : '';
        },
        confidence: 0.9,
      });

      const result = matcher.matchURL(
        'https://example.com/custom/test-123',
        'https://example.com/custom/test-123'
      );
      
      expect(result).not.toBeNull();
      expect(result!.confidence).toBe(0.9);
    });
  });

  describe('Batch Matching', () => {
    it('should match multiple URLs efficiently', () => {
      const request: BatchMatchRequest = {
        sourceUrls: [
          'https://example.com/products',
          'https://example.com/about',
          'https://example.com/contact',
        ],
        targetUrls: [
          'https://www.example.com/products/',
          'https://www.example.com/about/',
          'https://www.example.com/services/',
        ],
      };

      const result = matcher.batchMatch(request);
      
      expect(result.matches).toHaveLength(2);
      expect(result.unmatched).toHaveLength(1);
      expect(result.unmatched[0]).toBe('https://example.com/contact');
      expect(result.statistics.totalMatched).toBe(2);
    });

    it('should provide accurate statistics', () => {
      const request: BatchMatchRequest = {
        sourceUrls: [
          'https://example.com/products',  // Exact after normalization
          'https://example.com/product',   // Fuzzy match to products
          'https://example.com/category/electronics', // Pattern match
        ],
        targetUrls: [
          'https://www.example.com/products/',
          'https://www.example.com/categories/electronics',
        ],
      };

      const result = matcher.batchMatch(request);
      
      expect(result.statistics.normalizedMatches).toBeGreaterThanOrEqual(1);
      expect(result.statistics.averageConfidence).toBeGreaterThan(0.7);
    });

    it('should handle large batches efficiently', () => {
      const sourceUrls = Array.from({ length: 1000 }, (_, i) => 
        `https://example.com/product-${i}`
      );
      const targetUrls = Array.from({ length: 1000 }, (_, i) => 
        `https://www.example.com/product-${i}/`
      );

      const start = Date.now();
      const result = matcher.batchMatch({ sourceUrls, targetUrls });
      const duration = Date.now() - start;
      
      expect(result.statistics.totalMatched).toBe(1000);
      expect(duration).toBeLessThan(5000); // Should complete in under 5 seconds
    });
  });

  describe('Component Comparison', () => {
    it('should compare URL components accurately', () => {
      const result = matcher.matchURL(
        'https://example.com/products?id=123',
        'http://example.com/products?id=456'
      );
      
      expect(result).not.toBeNull();
      expect(result!.components.protocol).toBe(true); // Ignored by default
      expect(result!.components.domain).toBe(true);
      expect(result!.components.path).toBe(true);
      expect(result!.components.params).toBe(false); // Different params
    });
  });

  describe('Unmatched Report Generation', () => {
    it('should generate comprehensive unmatched report', () => {
      const unmatched = [
        'https://example.com/page1',
        'https://example.com/page2',
        'https://other.com/page3',
        'invalid-url',
      ];

      const report = matcher.generateUnmatchedReport(unmatched);
      
      expect(report).toContain('Total Unmatched: 4');
      expect(report).toContain('example.com');
      expect(report).toContain('other.com');
      expect(report).toContain('invalid');
    });
  });

  describe('Cache Management', () => {
    it('should cache normalized URLs', () => {
      const url = 'https://example.com/products';
      
      // First call
      matcher.normalizeURL(url);
      
      // Second call should use cache
      const stats1 = matcher.getCacheStats();
      matcher.normalizeURL(url);
      const stats2 = matcher.getCacheStats();
      
      expect(stats2.size).toBe(stats1.size); // Cache size shouldn't increase
    });

    it('should clear cache when requested', () => {
      matcher.normalizeURL('https://example.com/test');
      
      const statsBefore = matcher.getCacheStats();
      expect(statsBefore.size).toBeGreaterThan(0);
      
      matcher.clearCache();
      
      const statsAfter = matcher.getCacheStats();
      expect(statsAfter.size).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle URLs with special characters', () => {
      const result = matcher.matchURL(
        'https://example.com/products/café-100%25',
        'https://example.com/products/café-100%'
      );
      
      expect(result).not.toBeNull();
    });

    it('should handle URLs with international domains', () => {
      const result = matcher.matchURL(
        'https://例え.jp/products',
        'https://例え.jp/products'
      );
      
      expect(result).not.toBeNull();
      expect(result!.confidence).toBe(1.0);
    });

    it('should handle relative URLs', () => {
      const result = matcher.normalizeURL('/products/shoes');
      
      expect(result).toBeDefined();
      expect(result.components.path).toBe('/products/shoes');
    });

    it('should handle URLs with ports', () => {
      const result = matcher.matchURL(
        'https://example.com:8080/products',
        'https://example.com:8080/products'
      );
      
      expect(result).not.toBeNull();
      expect(result!.confidence).toBe(1.0);
    });
  });
});