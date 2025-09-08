import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { ContentExtractor } from '@/lib/scraping/content-extractor';
import { PaginationHandler } from '@/lib/scraping/pagination-handler';
import { ContentGapAnalyzer } from '@/lib/scraping/gap-analyzer';
import { TemplateDetector } from '@/lib/scraping/template-detector';
import { CategoryExtractor } from '@/lib/scraping/category-extractor';
import { BrandExtractor } from '@/lib/scraping/brand-extractor';
import { RateLimiter } from '@/lib/scraping/rate-limiter';
import { ScrapingQueue } from '@/lib/scraping/scraping-queue';

describe('Content Scraper Integration Tests', () => {
  describe('ContentExtractor', () => {
    it('should extract SEO data from a page', async () => {
      const extractor = new ContentExtractor();
      // Mock page object
      const mockPage = {
        url: () => 'https://example.com/category/test',
        $eval: jest.fn().mockImplementation((selector) => {
          if (selector === 'title') return 'Test Page Title';
          if (selector === 'meta[name="description"]') return 'Test meta description';
          if (selector === 'h1') return 'Test H1 Header';
          return '';
        }),
        $$eval: jest.fn().mockImplementation((selector) => {
          if (selector === 'h2') return ['Subheading 1', 'Subheading 2'];
          return [];
        }),
        textContent: jest.fn().mockResolvedValue('Test content'),
        $$: jest.fn().mockResolvedValue([]),
        content: jest.fn().mockResolvedValue('<html>test</html>'),
      } as any;

      const content = await extractor.extractContent(mockPage, 'category');

      expect(content).toBeDefined();
      expect(content.url).toBe('https://example.com/category/test');
      expect(content.urlCategory).toBe('category');
      expect(content.seo).toBeDefined();
      expect(content.gaps).toBeDefined();
    });
  });

  describe('ContentGapAnalyzer', () => {
    it('should identify content gaps correctly', () => {
      const analyzer = new ContentGapAnalyzer();
      
      const mockContent = {
        url: 'https://example.com',
        urlCategory: 'category' as const,
        seo: {
          title: '',
          metaDescription: '',
          h1: '',
          h2s: []
        },
        content: {
          wordCount: 50,
          uniqueWordCount: 30,
          heroText: undefined,
          mainDescription: 'Short description'
        },
        quality: {
          hasUniqueContent: false,
          contentDepth: 'thin' as const,
          isTemplatized: true,
          hasStructuredData: false,
          contentToCodeRatio: 5
        },
        trustSignals: {
          hasReviews: false
        },
        gaps: {} as any
      };

      const gaps = analyzer.analyzeGaps(mockContent);

      expect(gaps.missingMetaTitle).toBe(true);
      expect(gaps.missingMetaDescription).toBe(true);
      expect(gaps.missingHeroContent).toBe(true);
      expect(gaps.thinDescription).toBe(true);
      expect(gaps.noSchemaMarkup).toBe(true);
    });

    it('should calculate gap score correctly', () => {
      const analyzer = new ContentGapAnalyzer();
      
      const gaps = {
        missingMetaTitle: true,
        missingMetaDescription: true,
        missingHeroContent: false,
        thinDescription: true,
        noUSP: true,
        noFAQ: false,
        noBuyingGuide: false,
        noSchemaMarkup: false,
        templateOnly: false
      };

      const score = analyzer.calculateGapScore(gaps);
      
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should provide relevant recommendations', () => {
      const analyzer = new ContentGapAnalyzer();
      
      const gaps = {
        missingMetaTitle: true,
        missingMetaDescription: true,
        missingHeroContent: false,
        thinDescription: false,
        noUSP: false,
        noFAQ: false,
        noBuyingGuide: false,
        noSchemaMarkup: false,
        templateOnly: false
      };

      const recommendations = analyzer.getRecommendations(gaps);
      
      expect(recommendations).toContain('Add a unique, descriptive meta title (50-60 characters)');
      expect(recommendations).toContain('Create a compelling meta description (150-160 characters)');
    });
  });

  describe('TemplateDetector', () => {
    it('should detect template patterns', () => {
      const detector = new TemplateDetector();
      
      const templateText = 'Browse our selection of [CATEGORY_NAME] products at great prices.';
      const normalText = 'Our premium leather jackets are handcrafted from Italian leather with attention to detail.';
      
      expect(detector.isTemplate(templateText)).toBe(true);
      expect(detector.isTemplate(normalText)).toBe(false);
    });

    it('should calculate template score', () => {
      const detector = new TemplateDetector();
      
      const templateText = 'Shop for products at competitive prices. Click here to learn more.';
      const score = detector.detectTemplateScore(templateText);
      
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should suggest improvements for template content', () => {
      const detector = new TemplateDetector();
      
      const templateText = 'Browse our selection. Shop now. Free shipping.';
      const suggestions = detector.suggestImprovements(templateText);
      
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some(s => s.includes('generic phrases'))).toBe(true);
    });
  });

  describe('RateLimiter', () => {
    it('should check robots.txt compliance', async () => {
      const limiter = new RateLimiter();
      
      // Mock fetch for robots.txt
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        text: jest.fn().mockResolvedValue('User-agent: *\nAllow: /\nCrawl-delay: 1')
      } as any);
      
      const robotsCheck = await limiter.checkRobots('https://example.com/test');
      
      expect(robotsCheck.allowed).toBe(true);
      expect(robotsCheck.crawlDelay).toBeGreaterThanOrEqual(0);
    });

    it('should respect rate limits', async () => {
      const limiter = new RateLimiter({
        maxConcurrency: 1,
        interval: 100,
        intervalCap: 1
      });

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        text: jest.fn().mockResolvedValue('User-agent: *\nAllow: /')
      } as any);

      const startTime = Date.now();
      
      const promises = [
        limiter.executeWithRateLimit('https://example.com/1', async () => 'result1'),
        limiter.executeWithRateLimit('https://example.com/2', async () => 'result2')
      ];
      
      await Promise.all(promises);
      const endTime = Date.now();
      
      // Should take at least 100ms due to rate limiting
      expect(endTime - startTime).toBeGreaterThanOrEqual(100);
    });
  });

  describe('ScrapingQueue', () => {
    it('should maintain priority order', async () => {
      const queue = new ScrapingQueue();
      
      await queue.enqueue({
        url: 'https://example.com/low',
        category: 'other',
        priority: 5,
        includePagination: false
      });
      
      await queue.enqueue({
        url: 'https://example.com/high',
        category: 'category',
        priority: 1,
        includePagination: true
      });
      
      await queue.enqueue({
        url: 'https://example.com/medium',
        category: 'brand',
        priority: 2,
        includePagination: true
      });
      
      const first = await queue.dequeue();
      const second = await queue.dequeue();
      const third = await queue.dequeue();
      
      expect(first?.priority).toBe(1);
      expect(second?.priority).toBe(2);
      expect(third?.priority).toBe(5);
    });

    it('should prevent duplicate URLs', async () => {
      const queue = new ScrapingQueue();
      
      await queue.enqueue({
        url: 'https://example.com/test',
        category: 'category',
        priority: 1,
        includePagination: false
      });
      
      await queue.enqueue({
        url: 'https://example.com/test',
        category: 'category',
        priority: 1,
        includePagination: false
      });
      
      expect(queue.size()).toBe(1);
    });
  });

  describe('CategoryExtractor', () => {
    it('should extract category-specific data', async () => {
      const extractor = new CategoryExtractor();
      
      const mockPage = {
        url: () => 'https://example.com/category/test',
        textContent: jest.fn().mockResolvedValue('Showing 1-24 of 156 products'),
        $$: jest.fn().mockResolvedValue([]),
        $$eval: jest.fn().mockResolvedValue(['Home', 'Category', 'Subcategory']),
        $: jest.fn().mockResolvedValue(null)
      } as any;
      
      const categoryData = await extractor.extract(mockPage);
      
      expect(categoryData).toBeDefined();
      expect(categoryData.productCount).toBe(156);
      expect(categoryData.breadcrumbs.length).toBe(3);
    });
  });

  describe('BrandExtractor', () => {
    it('should extract brand-specific data', async () => {
      const extractor = new BrandExtractor();
      
      const mockPage = {
        textContent: jest.fn().mockImplementation((selector) => {
          if (selector?.includes('brand-story')) {
            return 'Founded in 1990, our brand has been dedicated to quality and innovation for over 30 years.';
          }
          return null;
        }),
        $$: jest.fn().mockResolvedValue([]),
        $: jest.fn().mockResolvedValue(null),
        $$eval: jest.fn().mockResolvedValue([])
      } as any;
      
      const brandData = await extractor.extract(mockPage);
      
      expect(brandData).toBeDefined();
      expect(brandData.brandStory).toContain('Founded in 1990');
    });

    it('should detect authorized dealer status', async () => {
      const extractor = new BrandExtractor();
      
      const mockPage = {
        textContent: jest.fn().mockResolvedValue('We are an Authorized Dealer'),
        $$: jest.fn().mockResolvedValue([]),
        $: jest.fn().mockImplementation((selector) => {
          if (selector?.includes('authorized')) {
            return {
              textContent: jest.fn().mockResolvedValue('Authorized Dealer'),
              getAttribute: jest.fn().mockResolvedValue('')
            };
          }
          return null;
        }),
        $$eval: jest.fn().mockResolvedValue([])
      } as any;
      
      const brandData = await extractor.extract(mockPage);
      
      expect(brandData.authorizedDealer).toBe(true);
    });
  });
});