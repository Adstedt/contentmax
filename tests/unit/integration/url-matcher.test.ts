import { UrlMatcher } from '@/lib/integration/url-matcher';
import { TaxonomyNode, Product } from '@/types/integration';

describe('UrlMatcher', () => {
  const matcher = new UrlMatcher();

  const mockNodes: TaxonomyNode[] = [
    {
      id: 'node1',
      title: 'Electronics',
      path: 'electronics',
      url: 'https://example.com/electronics',
      user_id: 'user1',
    },
    {
      id: 'node2',
      title: 'Laptops',
      path: 'electronics/laptops',
      url: 'https://example.com/electronics/laptops',
      parent_id: 'node1',
      user_id: 'user1',
    },
  ];

  const mockProducts: Product[] = [
    {
      id: 'prod1',
      title: 'Gaming Laptop',
      link: 'https://example.com/products/gaming-laptop-123',
      gtin: '1234567890123',
      mpn: 'GL-123',
      category_id: 'node2',
      user_id: 'user1',
    },
  ];

  describe('matchUrl', () => {
    it('should match exact URL for nodes', async () => {
      const result = await matcher.matchUrl(
        'https://example.com/electronics',
        mockNodes,
        mockProducts
      );

      expect(result).not.toBeNull();
      expect(result?.type).toBe('node');
      expect(result?.id).toBe('node1');
      expect(result?.confidence).toBe(1.0);
      expect(result?.strategy).toBe('exact_url');
    });

    it('should match exact URL for products', async () => {
      const result = await matcher.matchUrl(
        'https://example.com/products/gaming-laptop-123',
        mockNodes,
        mockProducts
      );

      expect(result).not.toBeNull();
      expect(result?.type).toBe('product');
      expect(result?.id).toBe('prod1');
      expect(result?.confidence).toBe(1.0);
      expect(result?.strategy).toBe('exact_url');
    });

    it('should match by path ignoring domain', async () => {
      const result = await matcher.matchUrl(
        'https://different-domain.com/electronics/laptops',
        mockNodes,
        mockProducts
      );

      expect(result).not.toBeNull();
      expect(result?.type).toBe('node');
      expect(result?.id).toBe('node2');
      expect(result?.confidence).toBe(1);
      expect(result?.strategy).toBe('exact_url');
    });

    it('should match product by ID in URL', async () => {
      const result = await matcher.matchUrl(
        'https://any-site.com/some-path/GL-123/details',
        mockNodes,
        mockProducts
      );

      expect(result).not.toBeNull();
      expect(result?.type).toBe('product');
      expect(result?.id).toBe('prod1');
      expect(result?.confidence).toBe(0.9);
      expect(result?.strategy).toBe('product_id');
    });

    it('should match category by name in URL', async () => {
      const result = await matcher.matchUrl(
        'https://any-site.com/category/electronics/subcategory/laptops',
        mockNodes,
        mockProducts
      );

      expect(result).not.toBeNull();
      expect(result?.type).toBe('node');
      expect(result?.strategy).toBe('category_match');
    });

    it('should return null for no match', async () => {
      const result = await matcher.matchUrl(
        'https://example.com/completely-unrelated-url',
        mockNodes,
        mockProducts
      );

      expect(result).toBeNull();
    });
  });

  describe('normalizeUrl', () => {
    it('should normalize URLs consistently', () => {
      const urls = [
        'https://example.com/path/',
        'https://example.com/path',
        'https://www.example.com/path/',
        '/path',
      ];

      const normalized = urls.map((url) => matcher.normalizeUrl(url));
      const expected = '/path';

      normalized.forEach((norm) => {
        expect(norm).toBe(expected);
      });

      // Test that index files are preserved
      expect(matcher.normalizeUrl('https://example.com/path/index.html')).toBe('/path/index');
      expect(matcher.normalizeUrl('https://example.com/path/index.php')).toBe('/path/index');
    });
  });

  describe('batchMatchUrls', () => {
    it('should efficiently match multiple URLs', async () => {
      const urls = [
        'https://example.com/electronics',
        'https://example.com/products/gaming-laptop-123',
        'https://example.com/unknown',
      ];

      const results = await matcher.batchMatchUrls(urls, mockNodes, mockProducts);

      expect(results.size).toBe(3);
      expect(results.get(urls[0])?.id).toBe('node1');
      expect(results.get(urls[1])?.id).toBe('prod1');
      expect(results.get(urls[2])).toBeNull();
    });
  });
});
