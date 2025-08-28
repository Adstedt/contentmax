import { SitemapParseResult, ContentCategory } from '@/types/sitemap.types';
import { 
  ScrapedContent, 
  ScrapingQueueItem, 
  ScrapingOptions,
  ScrapingResult,
  ScrapingProgress,
  UrlCategory 
} from '@/types/scraper.types';
import { ContentScraper } from './content-scraper';
import { ScrapingQueue } from './scraping-queue';
import { RateLimiter } from './rate-limiter';

export class SitemapDrivenScraper {
  private scraper: ContentScraper;
  private queue: ScrapingQueue;
  private rateLimiter: RateLimiter;
  private progress: ScrapingProgress;

  constructor(options?: ScrapingOptions) {
    this.scraper = new ContentScraper(options);
    this.queue = new ScrapingQueue();
    this.rateLimiter = new RateLimiter(options?.rateLimit);
    this.progress = {
      totalUrls: 0,
      processedUrls: 0,
      successfulUrls: 0,
      failedUrls: 0,
    };
  }

  async scrapeFromSitemap(
    sitemapResult: SitemapParseResult,
    projectId: string
  ): Promise<ScrapingResult[]> {
    const results: ScrapingResult[] = [];

    // Convert ContentCategory enum to UrlCategory type
    const categoryMap: Record<ContentCategory, UrlCategory> = {
      [ContentCategory.CATEGORY]: 'category',
      [ContentCategory.BRAND]: 'brand',
      [ContentCategory.PRODUCT]: 'product',
      [ContentCategory.BLOG]: 'blog',
      [ContentCategory.OTHER]: 'other',
    };

    // Priority map for different URL categories
    const priorityMap: Record<UrlCategory, number> = {
      'category': 1,  // Highest priority
      'brand': 2,
      'product': 3,
      'blog': 4,
      'other': 5
    };

    // Queue URLs with priority
    for (const entry of sitemapResult.entries) {
      const urlCategory = categoryMap[entry.category || ContentCategory.OTHER];
      
      await this.queue.enqueue({
        url: entry.url,
        category: urlCategory,
        priority: priorityMap[urlCategory],
        includePagination: ['category', 'brand'].includes(urlCategory),
        maxRetries: 3
      });
    }

    this.progress.totalUrls = this.queue.size();

    // Process queue with rate limiting
    while (!this.queue.isEmpty()) {
      const batch = await this.queue.dequeueBatch(3); // Process up to 3 URLs concurrently
      
      const batchPromises = batch.map(item => this.processUrl(item, projectId));
      const batchResults = await Promise.allSettled(batchPromises);

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
          if (result.value.success) {
            this.progress.successfulUrls++;
          } else {
            this.progress.failedUrls++;
          }
        } else {
          this.progress.failedUrls++;
          results.push({
            success: false,
            error: result.reason?.toString() || 'Unknown error'
          });
        }
        this.progress.processedUrls++;
      }

      // Update progress
      this.updateProgress();
    }

    return results;
  }

  private async processUrl(
    item: ScrapingQueueItem,
    projectId: string
  ): Promise<ScrapingResult> {
    try {
      // Apply rate limiting
      return await this.rateLimiter.executeWithRateLimit(
        item.url,
        async () => {
          const startTime = Date.now();
          
          // Scrape content
          const content = await this.scraper.scrape(
            item.url,
            item.category,
            item.includePagination
          );

          // Store in database
          await this.storeScrapedContent(content, projectId);

          return {
            success: true,
            content,
            duration: Date.now() - startTime
          };
        }
      );
    } catch (error) {
      console.error(`Failed to scrape ${item.url}:`, error);
      
      // Retry logic
      if (item.retryCount && item.retryCount < (item.maxRetries || 3)) {
        await this.queue.enqueue({
          ...item,
          retryCount: (item.retryCount || 0) + 1
        });
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async storeScrapedContent(
    content: ScrapedContent | ScrapedContent[],
    projectId: string
  ): Promise<void> {
    // This will be implemented to store content in Supabase
    // For now, just log
    const contents = Array.isArray(content) ? content : [content];
    console.log(`Storing ${contents.length} scraped pages for project ${projectId}`);
  }

  private updateProgress(): void {
    const remaining = this.progress.totalUrls - this.progress.processedUrls;
    const avgTimePerUrl = this.progress.processedUrls > 0 
      ? (Date.now() / this.progress.processedUrls) 
      : 0;
    
    this.progress.estimatedTimeRemaining = remaining * avgTimePerUrl;
    
    console.log(`Progress: ${this.progress.processedUrls}/${this.progress.totalUrls} URLs processed`);
  }

  getProgress(): ScrapingProgress {
    return { ...this.progress };
  }

  async stop(): Promise<void> {
    await this.scraper.cleanup();
    this.queue.clear();
  }
}