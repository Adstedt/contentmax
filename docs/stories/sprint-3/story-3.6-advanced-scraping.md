# Story 3.6: Advanced Content Scraping

## User Story

As a power user,
I want robust scraping with rate limiting and parallel processing,
So that I can efficiently scrape large websites without getting blocked.

## Size & Priority

- **Size**: M (4 hours) - Split from original Story 2.3
- **Priority**: P1 - High
- **Sprint**: 3 (Adjusted)
- **Dependencies**: Story 2.3a (Basic Content Scraper)

## Description

Add advanced scraping features including rate limiting, parallel processing, retry logic, robots.txt compliance, and comprehensive error recovery. This completes the scraping functionality started in Story 2.3a.

## Implementation Steps

1. **Advanced scraper with rate limiting**

   ```typescript
   // lib/scraper/advanced-scraper.ts
   import { BasicContentScraper, ScrapedContent } from './basic-scraper';
   import robotsParser from 'robots-txt-parser';
   import PQueue from 'p-queue';

   export interface AdvancedScraperConfig {
     maxConcurrency: number;
     requestsPerSecond: number;
     userAgent: string;
     timeout: number;
     maxRetries: number;
     respectRobotsTxt: boolean;
     followRedirects: boolean;
     maxRedirects: number;
   }

   export class AdvancedContentScraper extends BasicContentScraper {
     private config: AdvancedScraperConfig;
     private queue: PQueue;
     private robotsCache: Map<string, any> = new Map();
     private requestCount = 0;
     private startTime = Date.now();

     constructor(config: Partial<AdvancedScraperConfig> = {}) {
       super();

       this.config = {
         maxConcurrency: config.maxConcurrency || 3,
         requestsPerSecond: config.requestsPerSecond || 2,
         userAgent: config.userAgent || 'ContentMax/1.0 Advanced',
         timeout: config.timeout || 30000,
         maxRetries: config.maxRetries || 3,
         respectRobotsTxt: config.respectRobotsTxt ?? true,
         followRedirects: config.followRedirects ?? true,
         maxRedirects: config.maxRedirects || 5,
       };

       // Initialize queue with concurrency control
       this.queue = new PQueue({
         concurrency: this.config.maxConcurrency,
         interval: 1000,
         intervalCap: this.config.requestsPerSecond,
       });
     }

     async scrapeUrl(url: string): Promise<ScrapedContent> {
       // Check robots.txt compliance
       if (this.config.respectRobotsTxt) {
         const canScrape = await this.checkRobotsPermission(url);
         if (!canScrape) {
           throw new Error(`Robots.txt disallows scraping ${url}`);
         }
       }

       // Add to queue with retry logic
       return this.queue.add(() => this.scrapeWithRetry(url));
     }

     private async scrapeWithRetry(url: string, attempt = 1): Promise<ScrapedContent> {
       try {
         // Rate limiting check
         await this.enforceRateLimit();

         // Create abort controller for timeout
         const controller = new AbortController();
         const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

         const response = await fetch(url, {
           signal: controller.signal,
           headers: {
             'User-Agent': this.config.userAgent,
             Accept: 'text/html,application/xhtml+xml',
             'Accept-Language': 'en-US,en;q=0.9',
             'Cache-Control': 'no-cache',
           },
           redirect: this.config.followRedirects ? 'follow' : 'manual',
         });

         clearTimeout(timeoutId);

         if (!response.ok) {
           throw new Error(`HTTP ${response.status}: ${response.statusText}`);
         }

         const html = await response.text();
         const content = this.parseContent(url, html);

         // Add performance metrics
         content['metrics'] = {
           responseTime: Date.now() - this.requestCount,
           htmlSize: html.length,
           attempt,
         };

         this.requestCount++;

         return content;
       } catch (error) {
         // Retry logic
         if (attempt < this.config.maxRetries) {
           const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
           console.log(`Retrying ${url} after ${delay}ms (attempt ${attempt + 1})`);

           await this.sleep(delay);
           return this.scrapeWithRetry(url, attempt + 1);
         }

         throw error;
       }
     }

     private async checkRobotsPermission(url: string): Promise<boolean> {
       try {
         const urlObj = new URL(url);
         const robotsUrl = `${urlObj.protocol}//${urlObj.host}/robots.txt`;

         // Check cache
         if (this.robotsCache.has(robotsUrl)) {
           const robots = this.robotsCache.get(robotsUrl);
           return robots.isAllowed(url, this.config.userAgent);
         }

         // Fetch and parse robots.txt
         const response = await fetch(robotsUrl);

         if (!response.ok) {
           // No robots.txt means we can scrape
           return true;
         }

         const robotsTxt = await response.text();
         const robots = robotsParser({
           userAgent: this.config.userAgent,
           allowOnNeutralGroup: true,
         });

         robots.parse(robotsTxt);
         this.robotsCache.set(robotsUrl, robots);

         return robots.isAllowed(url, this.config.userAgent);
       } catch (error) {
         // If we can't check robots.txt, allow by default
         console.warn(`Could not check robots.txt for ${url}:`, error);
         return true;
       }
     }

     private async enforceRateLimit() {
       const elapsed = Date.now() - this.startTime;
       const expectedTime = (this.requestCount / this.config.requestsPerSecond) * 1000;

       if (expectedTime > elapsed) {
         const delay = expectedTime - elapsed;
         await this.sleep(delay);
       }
     }

     private sleep(ms: number): Promise<void> {
       return new Promise((resolve) => setTimeout(resolve, ms));
     }

     async scrapeBatch(
       urls: string[],
       onProgress?: (completed: number, total: number) => void
     ): Promise<Map<string, ScrapedContent | Error>> {
       const results = new Map<string, ScrapedContent | Error>();
       let completed = 0;

       const promises = urls.map((url) =>
         this.scrapeUrl(url)
           .then((content) => {
             results.set(url, content);
             completed++;
             onProgress?.(completed, urls.length);
             return content;
           })
           .catch((error) => {
             results.set(url, error);
             completed++;
             onProgress?.(completed, urls.length);
             return error;
           })
       );

       await Promise.allSettled(promises);

       return results;
     }

     getStats(): {
       totalRequests: number;
       requestsPerSecond: number;
       queueSize: number;
       pendingRequests: number;
       runningRequests: number;
     } {
       const elapsed = (Date.now() - this.startTime) / 1000;

       return {
         totalRequests: this.requestCount,
         requestsPerSecond: this.requestCount / elapsed,
         queueSize: this.queue.size,
         pendingRequests: this.queue.pending,
         runningRequests: this.queue.concurrency - this.queue.pending,
       };
     }
   }
   ```

2. **Intelligent content extraction**

   ```typescript
   // lib/scraper/content-extractor.ts
   import { Readability } from '@mozilla/readability';
   import { JSDOM } from 'jsdom';

   export class IntelligentContentExtractor {
     async extractArticle(
       html: string,
       url: string
     ): Promise<{
       title: string;
       content: string;
       textContent: string;
       excerpt: string;
       byline: string;
       siteName: string;
       publishedTime: string;
       lang: string;
       readingTime: number;
     }> {
       const dom = new JSDOM(html, { url });
       const reader = new Readability(dom.window.document);
       const article = reader.parse();

       if (!article) {
         throw new Error('Could not extract article content');
       }

       // Calculate reading time (avg 200 words per minute)
       const wordCount = article.textContent.split(/\s+/).length;
       const readingTime = Math.ceil(wordCount / 200);

       return {
         title: article.title,
         content: article.content, // HTML content
         textContent: article.textContent, // Plain text
         excerpt: article.excerpt,
         byline: article.byline || this.extractAuthor(dom.window.document),
         siteName: article.siteName || this.extractSiteName(dom.window.document),
         publishedTime: this.extractPublishedTime(dom.window.document),
         lang: article.lang || dom.window.document.documentElement.lang || 'en',
         readingTime,
       };
     }

     private extractAuthor(doc: Document): string {
       const selectors = [
         'meta[name="author"]',
         'meta[property="article:author"]',
         '.author',
         '.by-author',
         '.byline',
         '[rel="author"]',
       ];

       for (const selector of selectors) {
         const element = doc.querySelector(selector);
         if (element) {
           return element.getAttribute('content') || element.textContent || '';
         }
       }

       return '';
     }

     private extractSiteName(doc: Document): string {
       return (
         doc.querySelector('meta[property="og:site_name"]')?.getAttribute('content') ||
         doc.querySelector('meta[name="application-name"]')?.getAttribute('content') ||
         ''
       );
     }

     private extractPublishedTime(doc: Document): string {
       const selectors = [
         'meta[property="article:published_time"]',
         'meta[name="publish_date"]',
         'time[datetime]',
         'meta[name="DC.date.issued"]',
       ];

       for (const selector of selectors) {
         const element = doc.querySelector(selector);
         if (element) {
           return element.getAttribute('content') || element.getAttribute('datetime') || '';
         }
       }

       return '';
     }

     extractStructuredData(html: string): any[] {
       const dom = new JSDOM(html);
       const scripts = dom.window.document.querySelectorAll('script[type="application/ld+json"]');

       const structuredData = [];

       scripts.forEach((script) => {
         try {
           const data = JSON.parse(script.textContent || '');
           structuredData.push(data);
         } catch (error) {
           console.warn('Failed to parse structured data:', error);
         }
       });

       return structuredData;
     }
   }
   ```

3. **Scraper monitoring dashboard**

   ```typescript
   // components/scraper/ScraperMonitor.tsx
   import { useEffect, useState } from 'react';

   interface ScraperStats {
     totalRequests: number;
     requestsPerSecond: number;
     queueSize: number;
     pendingRequests: number;
     runningRequests: number;
     successRate: number;
     averageResponseTime: number;
   }

   export function ScraperMonitor({ scraperId }: { scraperId: string }) {
     const [stats, setStats] = useState<ScraperStats | null>(null);
     const [jobs, setJobs] = useState<any[]>([]);
     const [isActive, setIsActive] = useState(false);

     useEffect(() => {
       const interval = setInterval(async () => {
         try {
           const response = await fetch(`/api/scraper/${scraperId}/stats`);
           const data = await response.json();

           setStats(data.stats);
           setJobs(data.recentJobs);
           setIsActive(data.isActive);
         } catch (error) {
           console.error('Failed to fetch scraper stats:', error);
         }
       }, 2000); // Update every 2 seconds

       return () => clearInterval(interval);
     }, [scraperId]);

     if (!stats) {
       return <div>Loading scraper stats...</div>;
     }

     return (
       <div className="space-y-6">
         {/* Status indicator */}
         <div className="flex items-center space-x-2">
           <div className={`w-3 h-3 rounded-full ${
             isActive ? 'bg-green-500 animate-pulse' : 'bg-gray-300'
           }`} />
           <span className="font-medium">
             {isActive ? 'Scraping Active' : 'Idle'}
           </span>
         </div>

         {/* Stats grid */}
         <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
           <StatCard
             label="Total Requests"
             value={stats.totalRequests}
           />
           <StatCard
             label="Requests/sec"
             value={stats.requestsPerSecond.toFixed(2)}
           />
           <StatCard
             label="Queue Size"
             value={stats.queueSize}
             color={stats.queueSize > 100 ? 'yellow' : 'green'}
           />
           <StatCard
             label="Success Rate"
             value={`${stats.successRate.toFixed(1)}%`}
             color={stats.successRate < 90 ? 'red' : 'green'}
           />
         </div>

         {/* Active jobs */}
         <div>
           <h3 className="text-lg font-medium mb-2">Active Jobs</h3>
           <div className="space-y-2">
             {stats.runningRequests > 0 && (
               <div className="flex items-center space-x-2">
                 <div className="w-2 h-2 bg-blue-500 rounded-full" />
                 <span className="text-sm">
                   {stats.runningRequests} running
                 </span>
               </div>
             )}
             {stats.pendingRequests > 0 && (
               <div className="flex items-center space-x-2">
                 <div className="w-2 h-2 bg-yellow-500 rounded-full" />
                 <span className="text-sm">
                   {stats.pendingRequests} pending
                 </span>
               </div>
             )}
           </div>
         </div>

         {/* Recent jobs list */}
         <div>
           <h3 className="text-lg font-medium mb-2">Recent Jobs</h3>
           <div className="space-y-2">
             {jobs.map(job => (
               <JobRow key={job.id} job={job} />
             ))}
           </div>
         </div>
       </div>
     );
   }

   function StatCard({
     label,
     value,
     color = 'blue'
   }: {
     label: string;
     value: string | number;
     color?: string;
   }) {
     const colorClasses = {
       blue: 'bg-blue-100 text-blue-800',
       green: 'bg-green-100 text-green-800',
       yellow: 'bg-yellow-100 text-yellow-800',
       red: 'bg-red-100 text-red-800',
     };

     return (
       <div className={`p-4 rounded-lg ${colorClasses[color]}`}>
         <div className="text-sm opacity-75">{label}</div>
         <div className="text-2xl font-bold">{value}</div>
       </div>
     );
   }

   function JobRow({ job }: { job: any }) {
     const statusColors = {
       completed: 'text-green-600',
       failed: 'text-red-600',
       processing: 'text-blue-600',
       pending: 'text-gray-600',
     };

     return (
       <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
         <span className="text-sm truncate flex-1">{job.url}</span>
         <span className={`text-sm ${statusColors[job.status]}`}>
           {job.status}
         </span>
       </div>
     );
   }
   ```

## Files to Create

- `lib/scraper/advanced-scraper.ts` - Advanced scraping features
- `lib/scraper/content-extractor.ts` - Intelligent content extraction
- `lib/scraper/robots-checker.ts` - Robots.txt compliance
- `components/scraper/ScraperMonitor.tsx` - Monitoring dashboard
- `app/api/scraper/[id]/stats/route.ts` - Stats API endpoint

## Acceptance Criteria

- [ ] Rate limiting prevents overwhelming target sites
- [ ] Parallel scraping with configurable concurrency
- [ ] Respects robots.txt directives
- [ ] Retry logic with exponential backoff
- [ ] Timeout handling for slow sites
- [ ] Progress tracking for batch operations
- [ ] Monitoring dashboard shows real-time stats
- [ ] Intelligent content extraction using Readability

## Testing Requirements

- [ ] Test rate limiting enforcement
- [ ] Test parallel scraping performance
- [ ] Test robots.txt compliance
- [ ] Test retry logic on failures
- [ ] Test timeout handling
- [ ] Test with various website types
- [ ] Load test with 100+ URLs
- [ ] Verify monitoring accuracy

## Definition of Done

- [ ] All advanced features implemented
- [ ] Rate limiting working correctly
- [ ] Parallel processing functional
- [ ] Robots.txt compliance verified
- [ ] Monitoring dashboard active
- [ ] Performance targets met
- [ ] Error handling comprehensive
- [ ] Documentation updated
