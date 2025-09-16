// Jest test for URL Matcher
import { URLMatcher } from '@/lib/integration/url-matcher';
import type { TaxonomyNode } from '@/components/taxonomy/D3Visualization';

describe('URLMatcher', () => {
  let matcher: URLMatcher;
  let sampleNodes: TaxonomyNode[];
  let sampleProducts: any[];

  beforeEach(() => {
    matcher = new URLMatcher();

    sampleNodes = [
      {
        id: 'node1',
        url: 'https://example.com/electronics',
        title: 'Electronics',
        path: '/electronics',
        children: [],
      },
      {
        id: 'node2',
        url: 'https://example.com/electronics/laptops',
        title: 'Laptops',
        path: '/electronics/laptops',
        children: [],
      },
      {
        id: 'node3',
        url: '/clothing/mens',
        title: 'Men\'s Clothing',
        path: '/clothing/mens',
        children: [],
      },
    ];

    sampleProducts = [
      {
        id: 'prod1',
        link: 'https://example.com/product/laptop-123',
        title: 'Gaming Laptop',
        gtin: '1234567890123',
      },
      {
        id: 'prod2',
        link: '/product/shirt-456',
        title: 'Blue Shirt',
        gtin: '9876543210987',
      },
    ];
  });

  describe('normalizeUrl', () => {
    it('should normalize full URLs correctly', () => {
      const result = matcher.matchUrlToNode(
        'https://example.com/electronics/',
        sampleNodes
      );
      expect(result.nodeId).toBe('node1');
      expect(result.confidence).toBe(1.0);
    });

    it('should normalize relative URLs correctly', () => {
      const result = matcher.matchUrlToNode(
        '/clothing/mens/',
        sampleNodes
      );
      expect(result.nodeId).toBe('node3');
      expect(result.confidence).toBe(1.0);
    });

    it('should handle URLs with trailing slashes', () => {
      const result = matcher.matchUrlToNode(
        'https://example.com/electronics/laptops/',
        sampleNodes
      );
      expect(result.nodeId).toBe('node2');
      expect(result.confidence).toBe(1.0);
    });
  });

  describe('matchUrlToNode', () => {
    it('should return exact match with confidence 1.0', () => {
      const result = matcher.matchUrlToNode(
        'https://example.com/electronics',
        sampleNodes
      );
      expect(result.nodeId).toBe('node1');
      expect(result.confidence).toBe(1.0);
      expect(result.strategy).toBe('exact');
    });

    it('should return path-based match with confidence 0.8+', () => {
      const result = matcher.matchUrlToNode(
        'https://example.com/category/electronics/laptops/gaming',
        sampleNodes
      );
      expect(result.nodeId).toBe('node2');
      expect(result.confidence).toBeGreaterThanOrEqual(0.8);
      expect(result.strategy).toBe('path');
    });

    it('should return category match with confidence 0.7', () => {
      const nodes = [{
        id: 'cat1',
        title: 'Smart Phones',
        url: '',
        path: '',
        children: [],
      }];

      const result = matcher.matchUrlToNode(
        'https://example.com/shop/smart-phones/latest',
        nodes
      );
      expect(result.nodeId).toBe('cat1');
      expect(result.confidence).toBe(0.7);
      expect(result.strategy).toBe('category');
    });

    it('should return null for no match', () => {
      const result = matcher.matchUrlToNode(
        'https://example.com/totally-different',
        sampleNodes
      );
      expect(result.nodeId).toBeNull();
      expect(result.confidence).toBe(0);
    });

    it('should handle malformed URLs gracefully', () => {
      const result = matcher.matchUrlToNode(
        'not-a-valid-url',
        sampleNodes
      );
      expect(result.nodeId).toBeNull();
      expect(result.confidence).toBe(0);
    });

    it('should handle empty input gracefully', () => {
      const result = matcher.matchUrlToNode('', sampleNodes);
      expect(result.nodeId).toBeNull();
      expect(result.confidence).toBe(0);

      const result2 = matcher.matchUrlToNode('test', []);
      expect(result2.nodeId).toBeNull();
      expect(result2.confidence).toBe(0);
    });
  });

  describe('matchUrlToProduct', () => {
    it('should return exact URL match for products', () => {
      const result = matcher.matchUrlToProduct(
        'https://example.com/product/laptop-123',
        sampleProducts
      );
      expect(result.productId).toBe('prod1');
      expect(result.confidence).toBe(1.0);
      expect(result.strategy).toBe('exact');
    });

    it('should extract product ID from URL', () => {
      const result = matcher.matchUrlToProduct(
        'https://example.com/item/1234567890123',
        sampleProducts
      );
      expect(result.productId).toBe('prod1');
      expect(result.confidence).toBe(0.9);
      expect(result.strategy).toBe('product-id');
    });

    it('should match product title in URL', () => {
      const result = matcher.matchUrlToProduct(
        'https://example.com/shop/blue-shirt-special',
        sampleProducts
      );
      expect(result.productId).toBe('prod2');
      expect(result.confidence).toBe(0.7);
      expect(result.strategy).toBe('title');
    });
  });

  describe('matchUrl', () => {
    it('should prefer product matches over node matches', () => {
      const result = matcher.matchUrl(
        'https://example.com/product/laptop-123',
        sampleNodes,
        sampleProducts
      );
      expect(result).not.toBeNull();
      expect(result?.type).toBe('product');
      expect(result?.id).toBe('prod1');
    });

    it('should fall back to node match if no product match', () => {
      const result = matcher.matchUrl(
        'https://example.com/electronics',
        sampleNodes,
        sampleProducts
      );
      expect(result).not.toBeNull();
      expect(result?.type).toBe('node');
      expect(result?.id).toBe('node1');
    });

    it('should return null for no matches', () => {
      const result = matcher.matchUrl(
        'https://example.com/unknown',
        sampleNodes,
        sampleProducts
      );
      expect(result).toBeNull();
    });
  });

  describe('batchMatchUrls', () => {
    it('should match multiple URLs efficiently', () => {
      const urls = [
        'https://example.com/electronics',
        'https://example.com/product/laptop-123',
        'https://example.com/unknown',
      ];

      const results = matcher.batchMatchUrls(urls, sampleNodes, sampleProducts);

      expect(results.size).toBe(3);
      expect(results.get(urls[0])?.type).toBe('node');
      expect(results.get(urls[1])?.type).toBe('product');
      expect(results.get(urls[2])).toBeNull();
    });
  });

  describe('getMatchStatistics', () => {
    it('should calculate correct statistics', () => {
      const urls = [
        'https://example.com/electronics',
        'https://example.com/product/laptop-123',
        'https://example.com/unknown',
        'https://example.com/electronics/laptops',
      ];

      const matches = matcher.batchMatchUrls(urls, sampleNodes, sampleProducts);
      const stats = matcher.getMatchStatistics(matches);

      expect(stats.total).toBe(4);
      expect(stats.matched).toBe(3);
      expect(stats.matchRate).toBe(0.75);
      expect(stats.byType.nodes).toBe(2);
      expect(stats.byType.products).toBe(1);
      expect(stats.byStrategy.exact).toBe(3);
    });
  });
});