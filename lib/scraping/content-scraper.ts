import { chromium, Browser, Page, BrowserContext } from 'playwright';
import { 
  ScrapedContent, 
  UrlCategory, 
  ScrapingOptions 
} from '@/types/scraper.types';
import { ContentExtractor } from './content-extractor';
import { PaginationHandler } from './pagination-handler';

export class ContentScraper {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private extractor: ContentExtractor;
  private paginationHandler: PaginationHandler;
  private options: ScrapingOptions;

  constructor(options?: ScrapingOptions) {
    this.extractor = new ContentExtractor();
    this.paginationHandler = new PaginationHandler(this.extractor);
    this.options = {
      timeout: 30000,
      waitUntil: 'networkidle',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      ...options
    };
  }

  async initialize(): Promise<void> {
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: true,
        args: ['--disable-dev-shm-usage', '--no-sandbox']
      });
      
      this.context = await this.browser.newContext({
        userAgent: this.options.userAgent,
        viewport: this.options.viewport,
        ignoreHTTPSErrors: true
      });
    }
  }

  async scrape(
    url: string, 
    urlCategory: UrlCategory,
    includePagination: boolean = false
  ): Promise<ScrapedContent | ScrapedContent[]> {
    await this.initialize();
    
    if (!this.context) {
      throw new Error('Browser context not initialized');
    }

    const page = await this.context.newPage();
    
    try {
      // Set timeout
      page.setDefaultTimeout(this.options.timeout || 30000);

      // Navigate to the URL
      await page.goto(url, {
        waitUntil: this.options.waitUntil || 'networkidle',
        timeout: this.options.timeout
      });

      // Wait for content to load
      await this.waitForContent(page);

      // Extract content based on whether pagination is needed
      if (includePagination && ['category', 'brand'].includes(urlCategory)) {
        // Handle pagination
        const allContent = await this.paginationHandler.scrapeAllPages(
          url,
          page,
          urlCategory
        );
        return allContent;
      } else {
        // Single page extraction
        const content = await this.extractor.extractContent(page, urlCategory);
        return content;
      }
    } catch (error) {
      console.error(`Error scraping ${url}:`, error);
      throw error;
    } finally {
      await page.close();
    }
  }

  private async waitForContent(page: Page): Promise<void> {
    try {
      // Wait for common content selectors
      const contentSelectors = [
        'h1',
        '[class*="content"]',
        '[class*="description"]',
        'main',
        'article'
      ];

      // Wait for at least one content selector
      await page.waitForSelector(
        contentSelectors.join(', '),
        { timeout: 5000 }
      ).catch(() => {
        // If no specific content selector found, just continue
        console.log('No specific content selector found, continuing...');
      });

      // Additional wait for dynamic content
      await page.waitForTimeout(1000);
    } catch (error) {
      console.warn('Error waiting for content:', error);
    }
  }

  async cleanup(): Promise<void> {
    if (this.context) {
      await this.context.close();
      this.context = null;
    }
    
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}