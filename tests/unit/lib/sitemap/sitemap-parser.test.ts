import { describe, it, expect, beforeEach } from '@jest/globals';
import { SitemapParser } from '@/lib/ingestion/sitemap-parser';
import { categorizeUrl, categorizeUrlWithConfidence } from '@/lib/ingestion/url-categorizer';
import { ContentCategory } from '@/types/sitemap.types';

describe('SitemapParser', () => {
  let parser: SitemapParser;

  beforeEach(() => {
    parser = new SitemapParser();
  });

  describe('parse', () => {
    it('should parse a standard sitemap with single URL', async () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
        <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
          <url>
            <loc>https://example.com/product/item-1</loc>
            <lastmod>2024-01-26</lastmod>
            <changefreq>daily</changefreq>
            <priority>0.8</priority>
          </url>
        </urlset>`;

      const result = await parser.parse(xml);

      expect(result.success).toBe(true);
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0]).toEqual({
        url: 'https://example.com/product/item-1',
        lastmod: '2024-01-26',
        changefreq: 'daily',
        priority: 0.8,
      });
      expect(result.totalUrls).toBe(1);
    });

    it('should parse a sitemap with multiple URLs', async () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
        <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
          <url>
            <loc>https://example.com/page1</loc>
            <priority>1.0</priority>
          </url>
          <url>
            <loc>https://example.com/page2</loc>
            <priority>0.5</priority>
          </url>
        </urlset>`;

      const result = await parser.parse(xml);

      expect(result.success).toBe(true);
      expect(result.entries).toHaveLength(2);
      expect(result.totalUrls).toBe(2);
    });

    it('should handle sitemap index format', async () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
        <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
          <sitemap>
            <loc>https://example.com/sitemap-products.xml</loc>
            <lastmod>2024-01-26</lastmod>
          </sitemap>
          <sitemap>
            <loc>https://example.com/sitemap-categories.xml</loc>
            <lastmod>2024-01-25</lastmod>
          </sitemap>
        </sitemapindex>`;

      const result = await parser.parse(xml);

      expect(result.success).toBe(true);
      // Without fetchChildSitemaps, it returns the index entries as regular entries
      expect(result.entries).toHaveLength(2);
      expect(result.entries[0].url).toBe('https://example.com/sitemap-products.xml');
      expect(result.entries[1].url).toBe('https://example.com/sitemap-categories.xml');
    });

    it('should categorize URLs when option is enabled', async () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
        <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
          <url>
            <loc>https://example.com/product/item-1</loc>
          </url>
          <url>
            <loc>https://example.com/category/electronics</loc>
          </url>
          <url>
            <loc>https://example.com/blog/post-1</loc>
          </url>
        </urlset>`;

      const result = await parser.parse(xml, { categorizeUrls: true });

      expect(result.success).toBe(true);
      expect(result.entries).toHaveLength(3);
      expect(result.entries[0].category).toBe(ContentCategory.PRODUCT);
      expect(result.entries[1].category).toBe(ContentCategory.CATEGORY);
      expect(result.entries[2].category).toBe(ContentCategory.BLOG);
      
      expect(result.categoryCounts[ContentCategory.PRODUCT]).toBe(1);
      expect(result.categoryCounts[ContentCategory.CATEGORY]).toBe(1);
      expect(result.categoryCounts[ContentCategory.BLOG]).toBe(1);
    });

    it('should handle invalid XML gracefully', async () => {
      const invalidXml = `<?xml version="1.0" encoding="UTF-8"?>
        <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
          <url>
            <loc>https://example.com/page1</loc>
          </url
        </urlset>`;

      const result = await parser.parse(invalidXml);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors![0]).toContain('Invalid XML');
      expect(result.entries).toHaveLength(0);
    });

    it('should handle empty sitemap', async () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
        <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        </urlset>`;

      const result = await parser.parse(xml);

      expect(result.success).toBe(true);
      expect(result.entries).toHaveLength(0);
      expect(result.totalUrls).toBe(0);
    });

    it('should respect maxUrls option', async () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
        <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
          <url><loc>https://example.com/page1</loc></url>
          <url><loc>https://example.com/page2</loc></url>
          <url><loc>https://example.com/page3</loc></url>
          <url><loc>https://example.com/page4</loc></url>
          <url><loc>https://example.com/page5</loc></url>
        </urlset>`;

      const result = await parser.parse(xml, { maxUrls: 3 });

      expect(result.success).toBe(true);
      expect(result.entries).toHaveLength(3);
      expect(result.totalUrls).toBe(3);
    });
  });

  describe('identifySitemapType', () => {
    it('should identify urlset type correctly', () => {
      const parsed = {
        urlset: {
          url: [
            { loc: 'https://example.com/page1' },
            { loc: 'https://example.com/page2' },
          ],
        },
      };

      const result = parser.identifySitemapType(parsed);

      expect(result.type).toBe('urlset');
      expect(result.entries).toHaveLength(2);
      expect(result.indexEntries).toBeUndefined();
    });

    it('should identify sitemapindex type correctly', () => {
      const parsed = {
        sitemapindex: {
          sitemap: [
            { loc: 'https://example.com/sitemap1.xml', lastmod: '2024-01-26' },
            { loc: 'https://example.com/sitemap2.xml' },
          ],
        },
      };

      const result = parser.identifySitemapType(parsed);

      expect(result.type).toBe('sitemapindex');
      expect(result.entries).toHaveLength(0);
      expect(result.indexEntries).toHaveLength(2);
      expect(result.indexEntries![0].loc).toBe('https://example.com/sitemap1.xml');
      expect(result.indexEntries![0].lastmod).toBe('2024-01-26');
    });
  });
});

describe('URL Categorizer', () => {
  describe('categorizeUrl', () => {
    it('should categorize product URLs correctly', () => {
      const productUrls = [
        'https://example.com/product/item-123',
        'https://example.com/products/shoes/nike-air',
        'https://example.com/p/12345',
        'https://example.com/item/widget',
        'https://example.com/dp/B001234567',
        'https://example.com/gp/product/B001234567',
        'https://example.com/something-p-12345',
      ];

      productUrls.forEach(url => {
        expect(categorizeUrl(url)).toBe(ContentCategory.PRODUCT);
      });
    });

    it('should categorize category URLs correctly', () => {
      const categoryUrls = [
        'https://example.com/category/electronics',
        'https://example.com/categories/home-garden',
        'https://example.com/c/furniture',
        'https://example.com/collection/summer-2024',
        'https://example.com/shop/mens',
        'https://example.com/catalog/appliances',
        'https://example.com/browse/books',
      ];

      categoryUrls.forEach(url => {
        expect(categorizeUrl(url)).toBe(ContentCategory.CATEGORY);
      });
    });

    it('should categorize brand URLs correctly', () => {
      const brandUrls = [
        'https://example.com/brand/nike',
        'https://example.com/brands/apple',
        'https://example.com/manufacturer/samsung',
        'https://example.com/designer/gucci',
        'https://example.com/vendor/microsoft',
      ];

      brandUrls.forEach(url => {
        expect(categorizeUrl(url)).toBe(ContentCategory.BRAND);
      });
    });

    it('should categorize blog URLs correctly', () => {
      const blogUrls = [
        'https://example.com/blog/post-title',
        'https://example.com/news/latest-update',
        'https://example.com/article/how-to-guide',
        'https://example.com/posts/2024/01/26/title',
        'https://example.com/2024/01/some-post',
        'https://example.com/insights/market-trends',
        'https://example.com/resources/whitepaper',
      ];

      blogUrls.forEach(url => {
        expect(categorizeUrl(url)).toBe(ContentCategory.BLOG);
      });
    });

    it('should categorize excluded URLs as OTHER', () => {
      const excludedUrls = [
        'https://example.com/login',
        'https://example.com/register',
        'https://example.com/cart',
        'https://example.com/checkout',
        'https://example.com/privacy',
        'https://example.com/terms',
        'https://example.com/404',
        'https://example.com/sitemap.xml',
        'https://example.com/image.jpg',
        'https://example.com/document.pdf',
      ];

      excludedUrls.forEach(url => {
        expect(categorizeUrl(url)).toBe(ContentCategory.OTHER);
      });
    });

    it('should handle invalid URLs gracefully', () => {
      const invalidUrls = [
        'not-a-url',
        'ftp://example.com/file',
        '',
        'javascript:alert(1)',
      ];

      invalidUrls.forEach(url => {
        expect(categorizeUrl(url)).toBe(ContentCategory.OTHER);
      });
    });
  });

  describe('categorizeUrlWithConfidence', () => {
    it('should provide confidence scores for categorization', () => {
      const result = categorizeUrlWithConfidence('https://example.com/product/item-123');
      
      expect(result.category).toBe(ContentCategory.PRODUCT);
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.matchedPatterns.length).toBeGreaterThan(0);
      expect(result.matchedPatterns[0]).toContain('product');
    });

    it('should have lower confidence for ambiguous URLs', () => {
      const result = categorizeUrlWithConfidence('https://example.com/page');
      
      expect(result.category).toBe(ContentCategory.OTHER);
      expect(result.confidence).toBeLessThanOrEqual(0.5);
    });

    it('should have high confidence for excluded URLs', () => {
      const result = categorizeUrlWithConfidence('https://example.com/login');
      
      expect(result.category).toBe(ContentCategory.OTHER);
      expect(result.confidence).toBe(1.0);
      expect(result.matchedPatterns[0]).toContain('Excluded');
    });
  });
});