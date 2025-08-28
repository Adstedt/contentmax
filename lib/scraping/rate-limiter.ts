import PQueue from 'p-queue';
import robotsParser from 'robots-parser';
import { RobotsCheck } from '@/types/scraper.types';

interface RateLimitOptions {
  maxConcurrency?: number;
  interval?: number;
  intervalCap?: number;
}

export class RateLimiter {
  private queue: PQueue;
  private robotsCache: Map<string, any> = new Map();
  private crawlDelayCache: Map<string, number> = new Map();
  private userAgent: string;

  constructor(options?: RateLimitOptions) {
    this.queue = new PQueue({
      concurrency: options?.maxConcurrency || 3,
      interval: options?.interval || 1000,
      intervalCap: options?.intervalCap || 1
    });
    
    this.userAgent = 'ContentMaxBot/1.0 (+https://contentmax.ai/bot)';
  }

  async executeWithRateLimit<T>(
    url: string,
    scrapeFunc: () => Promise<T>
  ): Promise<T> {
    // Check robots.txt first
    const robotsCheck = await this.checkRobots(url);
    
    if (!robotsCheck.allowed) {
      throw new Error(`Robots.txt disallows scraping: ${url}`);
    }

    // Determine delay based on URL category and robots.txt
    const delay = this.calculateDelay(url, robotsCheck.crawlDelay);

    // Execute with rate limiting
    return this.queue.add(async () => {
      // Add delay before execution
      if (delay > 0) {
        await this.delay(delay);
      }
      
      try {
        return await scrapeFunc();
      } catch (error) {
        console.error(`Rate limited request failed for ${url}:`, error);
        throw error;
      }
    }) as Promise<T>;
  }

  async checkRobots(url: string): Promise<RobotsCheck> {
    try {
      const urlObj = new URL(url);
      const robotsUrl = `${urlObj.protocol}//${urlObj.host}/robots.txt`;
      
      // Check cache first
      if (this.robotsCache.has(urlObj.host)) {
        const robots = this.robotsCache.get(urlObj.host);
        const allowed = robots.isAllowed(url, this.userAgent) ?? true;
        const crawlDelay = robots.getCrawlDelay(this.userAgent) ?? 0;
        
        return {
          allowed,
          crawlDelay,
          userAgent: this.userAgent
        };
      }

      // Fetch and parse robots.txt
      const response = await fetch(robotsUrl);
      
      if (response.ok) {
        const robotsTxt = await response.text();
        const robots = robotsParser(robotsUrl, robotsTxt);
        
        // Cache the parsed robots
        this.robotsCache.set(urlObj.host, robots);
        
        const allowed = robots.isAllowed(url, this.userAgent) ?? true;
        const crawlDelay = robots.getCrawlDelay(this.userAgent) ?? 0;
        
        // Cache crawl delay for this domain
        if (crawlDelay > 0) {
          this.crawlDelayCache.set(urlObj.host, crawlDelay * 1000); // Convert to ms
        }
        
        return {
          allowed,
          crawlDelay,
          userAgent: this.userAgent
        };
      }
      
      // If robots.txt doesn't exist or can't be fetched, allow by default
      return {
        allowed: true,
        crawlDelay: 0,
        userAgent: this.userAgent
      };
    } catch (error) {
      console.warn(`Error checking robots.txt for ${url}:`, error);
      // On error, be conservative and allow with default delay
      return {
        allowed: true,
        crawlDelay: 1,
        userAgent: this.userAgent
      };
    }
  }

  private calculateDelay(url: string, robotsCrawlDelay?: number): number {
    const urlObj = new URL(url);
    
    // Use robots.txt crawl delay if specified
    if (robotsCrawlDelay && robotsCrawlDelay > 0) {
      return robotsCrawlDelay * 1000; // Convert to milliseconds
    }
    
    // Check cached domain-specific delay
    if (this.crawlDelayCache.has(urlObj.host)) {
      return this.crawlDelayCache.get(urlObj.host) || 1000;
    }
    
    // Determine delay based on URL type
    const category = this.determineUrlCategory(url);
    
    switch (category) {
      case 'category':
        return 2000; // 2 seconds for category pages (more important)
      case 'brand':
        return 1500; // 1.5 seconds for brand pages
      case 'product':
        return 1000; // 1 second for product pages
      default:
        return 1000; // Default 1 second
    }
  }

  private determineUrlCategory(url: string): string {
    const urlLower = url.toLowerCase();
    
    if (urlLower.includes('/category/') || urlLower.includes('/categories/')) {
      return 'category';
    }
    if (urlLower.includes('/brand/') || urlLower.includes('/brands/')) {
      return 'brand';
    }
    if (urlLower.includes('/product/') || urlLower.includes('/products/')) {
      return 'product';
    }
    if (urlLower.includes('/blog/') || urlLower.includes('/article/')) {
      return 'blog';
    }
    
    return 'other';
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async pause(): Promise<void> {
    this.queue.pause();
  }

  async resume(): Promise<void> {
    this.queue.start();
  }

  async clear(): Promise<void> {
    this.queue.clear();
  }

  getQueueSize(): number {
    return this.queue.size;
  }

  getPendingCount(): number {
    return this.queue.pending;
  }

  clearCache(): void {
    this.robotsCache.clear();
    this.crawlDelayCache.clear();
  }
}