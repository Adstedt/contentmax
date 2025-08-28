import { describe, it, expect } from '@jest/globals';
import { SitemapParser } from '@/lib/ingestion/sitemap-parser';
import { SitemapFetcher } from '@/lib/ingestion/sitemap-fetcher';
import { 
  categorizeUrl, 
  categorizeUrlWithConfidence,
  getCategoryStatistics 
} from '@/lib/ingestion/url-categorizer';
import { ContentCategory } from '@/types/sitemap.types';

describe('Sitemap Parser Integration Tests', () => {
  describe('End-to-End Parsing', () => {
    it('should parse complex sitemap with all features', async () => {
      const parser = new SitemapParser();
      
      const complexSitemap = `<?xml version="1.0" encoding="UTF-8"?>
        <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
          <url>
            <loc>https://shop.example.com/</loc>
            <lastmod>2024-01-26T10:30:00Z</lastmod>
            <changefreq>daily</changefreq>
            <priority>1.0</priority>
          </url>
          <url>
            <loc>https://shop.example.com/product/laptop-pro-2024</loc>
            <lastmod>2024-01-25T15:45:00Z</lastmod>
            <changefreq>weekly</changefreq>
            <priority>0.9</priority>
          </url>
          <url>
            <loc>https://shop.example.com/category/electronics/computers</loc>
            <lastmod>2024-01-24T08:00:00Z</lastmod>
            <changefreq>weekly</changefreq>
            <priority>0.8</priority>
          </url>
          <url>
            <loc>https://shop.example.com/brand/techcorp</loc>
            <lastmod>2024-01-23T12:00:00Z</lastmod>
            <changefreq>monthly</changefreq>
            <priority>0.7</priority>
          </url>
          <url>
            <loc>https://shop.example.com/blog/2024/01/new-products-announcement</loc>
            <lastmod>2024-01-22T09:30:00Z</lastmod>
            <changefreq>never</changefreq>
            <priority>0.6</priority>
          </url>
          <url>
            <loc>https://shop.example.com/p/SKU123456</loc>
            <priority>0.8</priority>
          </url>
          <url>
            <loc>https://shop.example.com/collections/summer-sale</loc>
            <priority>0.7</priority>
          </url>
          <url>
            <loc>https://shop.example.com/login</loc>
            <priority>0.1</priority>
          </url>
          <url>
            <loc>https://shop.example.com/cart</loc>
            <priority>0.1</priority>
          </url>
          <url>
            <loc>https://shop.example.com/about-us</loc>
            <priority>0.3</priority>
          </url>
        </urlset>`;

      const result = await parser.parse(complexSitemap, { 
        categorizeUrls: true 
      });

      // Verify parsing success
      expect(result.success).toBe(true);
      expect(result.totalUrls).toBe(10);
      expect(result.entries).toHaveLength(10);
      
      // Verify categories are correctly assigned
      expect(result.categoryCounts[ContentCategory.PRODUCT]).toBe(2); // laptop and SKU
      expect(result.categoryCounts[ContentCategory.CATEGORY]).toBe(2); // electronics and summer-sale
      expect(result.categoryCounts[ContentCategory.BRAND]).toBe(1); // techcorp
      expect(result.categoryCounts[ContentCategory.BLOG]).toBe(1); // blog post
      expect(result.categoryCounts[ContentCategory.OTHER]).toBe(4); // home, login, cart, about
      
      // Verify specific entries
      const productEntry = result.entries.find(e => 
        e.url === 'https://shop.example.com/product/laptop-pro-2024'
      );
      expect(productEntry).toBeDefined();
      expect(productEntry?.category).toBe(ContentCategory.PRODUCT);
      expect(productEntry?.lastmod).toBe('2024-01-25T15:45:00Z');
      expect(productEntry?.changefreq).toBe('weekly');
      expect(productEntry?.priority).toBe(0.9);
    });

    it('should handle large sitemaps efficiently', async () => {
      const parser = new SitemapParser();
      
      // Generate a large sitemap
      const urls = [];
      for (let i = 1; i <= 1000; i++) {
        urls.push(`
          <url>
            <loc>https://example.com/product/item-${i}</loc>
            <priority>${(Math.random() * 0.5 + 0.5).toFixed(1)}</priority>
          </url>
        `);
      }
      
      const largeSitemap = `<?xml version="1.0" encoding="UTF-8"?>
        <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
          ${urls.join('')}
        </urlset>`;
      
      const startTime = Date.now();
      const result = await parser.parse(largeSitemap, {
        categorizeUrls: true,
        maxUrls: 500, // Test limiting
      });
      const endTime = Date.now();
      
      // Performance check
      expect(endTime - startTime).toBeLessThan(5000); // Should complete in under 5 seconds
      
      // Verify results
      expect(result.success).toBe(true);
      expect(result.entries).toHaveLength(500); // Limited to 500
      expect(result.totalUrls).toBe(500);
      
      // All should be categorized as products
      expect(result.categoryCounts[ContentCategory.PRODUCT]).toBe(500);
    });

    it('should handle nested sitemap index', async () => {
      const parser = new SitemapParser();
      
      const sitemapIndex = `<?xml version="1.0" encoding="UTF-8"?>
        <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
          <sitemap>
            <loc>https://example.com/sitemap-products.xml</loc>
            <lastmod>2024-01-26T10:00:00Z</lastmod>
          </sitemap>
          <sitemap>
            <loc>https://example.com/sitemap-categories.xml</loc>
            <lastmod>2024-01-25T10:00:00Z</lastmod>
          </sitemap>
          <sitemap>
            <loc>https://example.com/sitemap-blog.xml</loc>
            <lastmod>2024-01-24T10:00:00Z</lastmod>
          </sitemap>
        </sitemapindex>`;
      
      const result = await parser.parse(sitemapIndex);
      
      expect(result.success).toBe(true);
      expect(result.entries).toHaveLength(3);
      expect(result.entries[0].url).toContain('sitemap-products.xml');
      expect(result.entries[0].lastmod).toBe('2024-01-26T10:00:00Z');
    });
  });

  describe('URL Categorization Accuracy', () => {
    it('should achieve >90% accuracy on e-commerce URLs', () => {
      const testCases = [
        // Products
        { url: 'https://amazon.com/dp/B001234567', expected: ContentCategory.PRODUCT },
        { url: 'https://shop.com/product/nike-shoes', expected: ContentCategory.PRODUCT },
        { url: 'https://store.com/p/12345', expected: ContentCategory.PRODUCT },
        { url: 'https://site.com/item/widget', expected: ContentCategory.PRODUCT },
        { url: 'https://shop.com/merchandise/tshirt', expected: ContentCategory.PRODUCT },
        { url: 'https://store.com/pd/laptop', expected: ContentCategory.PRODUCT },
        { url: 'https://site.com/sku/ABC123', expected: ContentCategory.PRODUCT },
        { url: 'https://shop.com/goods/electronic', expected: ContentCategory.PRODUCT },
        { url: 'https://store.com/something-p-12345', expected: ContentCategory.PRODUCT },
        { url: 'https://amazon.com/gp/product/B001234567', expected: ContentCategory.PRODUCT },
        
        // Categories
        { url: 'https://shop.com/category/electronics', expected: ContentCategory.CATEGORY },
        { url: 'https://store.com/c/furniture', expected: ContentCategory.CATEGORY },
        { url: 'https://site.com/collections/summer', expected: ContentCategory.CATEGORY },
        { url: 'https://shop.com/shop/mens', expected: ContentCategory.CATEGORY },
        { url: 'https://store.com/browse/books', expected: ContentCategory.CATEGORY },
        { url: 'https://site.com/department/home', expected: ContentCategory.CATEGORY },
        { url: 'https://shop.com/catalog/appliances', expected: ContentCategory.CATEGORY },
        { url: 'https://store.com/deals', expected: ContentCategory.CATEGORY },
        { url: 'https://site.com/sale', expected: ContentCategory.CATEGORY },
        { url: 'https://shop.com/clearance', expected: ContentCategory.CATEGORY },
        
        // Brands
        { url: 'https://shop.com/brand/nike', expected: ContentCategory.BRAND },
        { url: 'https://store.com/brands/apple', expected: ContentCategory.BRAND },
        { url: 'https://site.com/manufacturer/samsung', expected: ContentCategory.BRAND },
        { url: 'https://shop.com/designer/gucci', expected: ContentCategory.BRAND },
        { url: 'https://store.com/vendor/microsoft', expected: ContentCategory.BRAND },
        
        // Blog
        { url: 'https://shop.com/blog/tips', expected: ContentCategory.BLOG },
        { url: 'https://store.com/news/update', expected: ContentCategory.BLOG },
        { url: 'https://site.com/article/guide', expected: ContentCategory.BLOG },
        { url: 'https://shop.com/2024/01/post', expected: ContentCategory.BLOG },
        { url: 'https://store.com/resources/whitepaper', expected: ContentCategory.BLOG },
      ];
      
      let correctCount = 0;
      let totalCount = testCases.length;
      
      testCases.forEach(({ url, expected }) => {
        const actual = categorizeUrl(url);
        if (actual === expected) {
          correctCount++;
        } else {
          console.log(`Mismatch: ${url} - Expected: ${expected}, Got: ${actual}`);
        }
      });
      
      const accuracy = (correctCount / totalCount) * 100;
      expect(accuracy).toBeGreaterThanOrEqual(90);
    });

    it('should provide accurate confidence scores', () => {
      // High confidence cases
      const highConfidenceUrls = [
        'https://shop.com/product/item',
        'https://shop.com/category/electronics',
        'https://shop.com/brand/nike',
        'https://shop.com/blog/post',
        'https://shop.com/login',
      ];
      
      highConfidenceUrls.forEach(url => {
        const result = categorizeUrlWithConfidence(url);
        expect(result.confidence).toBeGreaterThanOrEqual(0.8);
        expect(result.matchedPatterns.length).toBeGreaterThan(0);
      });
      
      // Low confidence cases
      const lowConfidenceUrls = [
        'https://shop.com/page',
        'https://shop.com/info',
        'https://shop.com/misc',
      ];
      
      lowConfidenceUrls.forEach(url => {
        const result = categorizeUrlWithConfidence(url);
        expect(result.confidence).toBeLessThanOrEqual(0.6);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed XML gracefully', async () => {
      const parser = new SitemapParser();
      
      const malformedXmls = [
        '<urlset>unclosed tag',
        '<?xml version="1.0"?><urlset><url><loc>test</url>',
        'not xml at all',
        '',
      ];
      
      for (const xml of malformedXmls) {
        const result = await parser.parse(xml);
        expect(result.success).toBe(false);
        expect(result.errors).toBeDefined();
        expect(result.errors!.length).toBeGreaterThan(0);
        expect(result.entries).toHaveLength(0);
      }
    });

    it('should handle invalid URLs in sitemap', async () => {
      const parser = new SitemapParser();
      
      const sitemapWithInvalidUrls = `<?xml version="1.0" encoding="UTF-8"?>
        <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
          <url>
            <loc>not-a-url</loc>
          </url>
          <url>
            <loc>javascript:alert(1)</loc>
          </url>
          <url>
            <loc>https://valid.com/page</loc>
          </url>
        </urlset>`;
      
      const result = await parser.parse(sitemapWithInvalidUrls, {
        categorizeUrls: true
      });
      
      expect(result.success).toBe(true);
      expect(result.entries).toHaveLength(3);
      // Invalid URLs should be categorized as OTHER
      expect(result.entries[0].category).toBe(ContentCategory.OTHER);
      expect(result.entries[1].category).toBe(ContentCategory.OTHER);
    });
  });

  describe('Performance Requirements', () => {
    it('should parse 10,000 URLs in under 5 seconds', async () => {
      const parser = new SitemapParser();
      
      // Generate 10,000 URLs
      const urls = [];
      for (let i = 1; i <= 10000; i++) {
        const category = ['product', 'category', 'brand', 'blog'][i % 4];
        urls.push(`
          <url>
            <loc>https://example.com/${category}/item-${i}</loc>
            <priority>0.5</priority>
          </url>
        `);
      }
      
      const largeSitemap = `<?xml version="1.0" encoding="UTF-8"?>
        <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
          ${urls.join('')}
        </urlset>`;
      
      const startTime = Date.now();
      const result = await parser.parse(largeSitemap);
      const endTime = Date.now();
      
      const duration = endTime - startTime;
      
      expect(result.success).toBe(true);
      expect(result.totalUrls).toBe(10000);
      expect(duration).toBeLessThan(5000); // Must complete in under 5 seconds
    });

    it('should handle streaming for large files', async () => {
      const parser = new SitemapParser();
      
      // Create a simulated stream
      const largeContent = `<?xml version="1.0" encoding="UTF-8"?>
        <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
          <url><loc>https://example.com/page1</loc></url>
          <url><loc>https://example.com/page2</loc></url>
        </urlset>`;
      
      // Skip test if TextEncoder is not available (Node.js test environment)
      if (typeof TextEncoder === 'undefined') {
        // Just test the parse method instead
        const result = await parser.parse(largeContent);
        expect(result.success).toBe(true);
        expect(result.totalUrls).toBe(2);
        return;
      }
      
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(largeContent));
          controller.close();
        }
      });
      
      const result = await parser.parseStream(stream);
      
      expect(result.success).toBe(true);
      expect(result.totalUrls).toBe(2);
    });
  });

  describe('Statistics and Reporting', () => {
    it('should provide accurate category statistics', () => {
      const urls = [
        'https://shop.com/product/1',
        'https://shop.com/product/2',
        'https://shop.com/product/3',
        'https://shop.com/category/electronics',
        'https://shop.com/category/furniture',
        'https://shop.com/brand/nike',
        'https://shop.com/blog/post',
        'https://shop.com/about',
        'https://shop.com/contact',
      ];
      
      const stats = getCategoryStatistics(urls);
      
      expect(stats[ContentCategory.PRODUCT]).toBe(3);
      expect(stats[ContentCategory.CATEGORY]).toBe(2);
      expect(stats[ContentCategory.BRAND]).toBe(1);
      expect(stats[ContentCategory.BLOG]).toBe(1);
      expect(stats[ContentCategory.OTHER]).toBe(2);
      
      // Verify all URLs are counted
      const total = Object.values(stats).reduce((sum, count) => sum + count, 0);
      expect(total).toBe(urls.length);
    });
  });
});