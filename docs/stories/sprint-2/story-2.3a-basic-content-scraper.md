# Story 2.3a: Basic Content Scraper

## User Story

As a user,
I want to scrape basic content from my website pages,
So that I can analyze and enhance my existing content.

## Size & Priority

- **Size**: M (4 hours) - Reduced from L (8 hours)
- **Priority**: P0 - Critical
- **Sprint**: 2 (Adjusted)
- **Dependencies**: Story 2.2 (Sitemap Parser)

## Description

Implement basic web scraping functionality with simple content extraction. Advanced features like rate limiting, parallel scraping, and error recovery will be handled in Story 3.6 (Sprint 3).

## Implementation Steps

1. **Basic scraper service**

   ```typescript
   // lib/scraper/basic-scraper.ts
   import * as cheerio from 'cheerio';

   export interface ScrapedContent {
     url: string;
     title: string;
     description: string;
     content: string;
     headings: {
       h1: string[];
       h2: string[];
       h3: string[];
     };
     images: Array<{
       src: string;
       alt: string;
     }>;
     meta: {
       keywords?: string;
       author?: string;
       publishedDate?: string;
     };
     scrapedAt: Date;
   }

   export class BasicContentScraper {
     private userAgent = 'ContentMax/1.0 (compatible; ContentScraper)';

     async scrapeUrl(url: string): Promise<ScrapedContent> {
       try {
         // Fetch the page
         const response = await fetch(url, {
           headers: {
             'User-Agent': this.userAgent,
             Accept: 'text/html,application/xhtml+xml',
             'Accept-Language': 'en-US,en;q=0.9',
           },
         });

         if (!response.ok) {
           throw new Error(`HTTP ${response.status}: ${response.statusText}`);
         }

         const html = await response.text();
         return this.parseContent(url, html);
       } catch (error) {
         console.error(`Failed to scrape ${url}:`, error);
         throw new Error(`Scraping failed: ${error.message}`);
       }
     }

     private parseContent(url: string, html: string): ScrapedContent {
       const $ = cheerio.load(html);

       // Remove script and style elements
       $('script, style, noscript').remove();

       // Extract basic content
       const title = this.extractTitle($);
       const description = this.extractDescription($);
       const content = this.extractMainContent($);
       const headings = this.extractHeadings($);
       const images = this.extractImages($, url);
       const meta = this.extractMetadata($);

       return {
         url,
         title,
         description,
         content,
         headings,
         images,
         meta,
         scrapedAt: new Date(),
       };
     }

     private extractTitle($: cheerio.CheerioAPI): string {
       // Try multiple sources for title
       return (
         $('meta[property="og:title"]').attr('content') ||
         $('title').text() ||
         $('h1').first().text() ||
         ''
       ).trim();
     }

     private extractDescription($: cheerio.CheerioAPI): string {
       return (
         $('meta[name="description"]').attr('content') ||
         $('meta[property="og:description"]').attr('content') ||
         $('p').first().text().substring(0, 160) ||
         ''
       ).trim();
     }

     private extractMainContent($: cheerio.CheerioAPI): string {
       // Try to find main content area
       const contentSelectors = [
         'main',
         'article',
         '[role="main"]',
         '.content',
         '#content',
         '.post',
         '.entry-content',
       ];

       let content = '';

       for (const selector of contentSelectors) {
         const element = $(selector).first();
         if (element.length > 0) {
           content = element.text();
           break;
         }
       }

       // Fallback to body if no main content found
       if (!content) {
         content = $('body').text();
       }

       // Clean up whitespace
       return content
         .replace(/\s+/g, ' ')
         .replace(/\n{3,}/g, '\n\n')
         .trim();
     }

     private extractHeadings($: cheerio.CheerioAPI): ScrapedContent['headings'] {
       return {
         h1: $('h1')
           .map((_, el) => $(el).text().trim())
           .get(),
         h2: $('h2')
           .map((_, el) => $(el).text().trim())
           .get(),
         h3: $('h3')
           .map((_, el) => $(el).text().trim())
           .get(),
       };
     }

     private extractImages($: cheerio.CheerioAPI, baseUrl: string): ScrapedContent['images'] {
       const images: ScrapedContent['images'] = [];

       $('img').each((_, element) => {
         const src = $(element).attr('src');
         const alt = $(element).attr('alt') || '';

         if (src) {
           // Convert relative URLs to absolute
           const absoluteSrc = new URL(src, baseUrl).href;
           images.push({ src: absoluteSrc, alt });
         }
       });

       return images;
     }

     private extractMetadata($: cheerio.CheerioAPI): ScrapedContent['meta'] {
       return {
         keywords: $('meta[name="keywords"]').attr('content'),
         author: $('meta[name="author"]').attr('content'),
         publishedDate:
           $('meta[property="article:published_time"]').attr('content') ||
           $('time[datetime]').attr('datetime'),
       };
     }
   }
   ```

2. **Scraper queue for basic sequential processing**

   ```typescript
   // lib/scraper/scraper-queue.ts
   import { BasicContentScraper, ScrapedContent } from './basic-scraper';

   export interface ScrapeJob {
     id: string;
     url: string;
     status: 'pending' | 'processing' | 'completed' | 'failed';
     result?: ScrapedContent;
     error?: string;
     createdAt: Date;
     completedAt?: Date;
   }

   export class ScraperQueue {
     private scraper: BasicContentScraper;
     private jobs: Map<string, ScrapeJob> = new Map();
     private processing = false;
     private delay = 1000; // 1 second between requests (polite crawling)

     constructor() {
       this.scraper = new BasicContentScraper();
     }

     addJob(url: string): string {
       const id = crypto.randomUUID();
       const job: ScrapeJob = {
         id,
         url,
         status: 'pending',
         createdAt: new Date(),
       };

       this.jobs.set(id, job);

       if (!this.processing) {
         this.processQueue();
       }

       return id;
     }

     addBatch(urls: string[]): string[] {
       return urls.map((url) => this.addJob(url));
     }

     getJob(id: string): ScrapeJob | undefined {
       return this.jobs.get(id);
     }

     getAllJobs(): ScrapeJob[] {
       return Array.from(this.jobs.values());
     }

     private async processQueue() {
       this.processing = true;

       const pendingJobs = Array.from(this.jobs.values()).filter((job) => job.status === 'pending');

       for (const job of pendingJobs) {
         await this.processJob(job);
         await this.sleep(this.delay);
       }

       this.processing = false;
     }

     private async processJob(job: ScrapeJob) {
       // Update status
       job.status = 'processing';
       this.jobs.set(job.id, job);

       try {
         // Scrape the content
         const result = await this.scraper.scrapeUrl(job.url);

         // Update job with result
         job.status = 'completed';
         job.result = result;
         job.completedAt = new Date();
       } catch (error) {
         // Handle error
         job.status = 'failed';
         job.error = error.message;
         job.completedAt = new Date();

         console.error(`Scrape job ${job.id} failed:`, error);
       }

       this.jobs.set(job.id, job);
     }

     private sleep(ms: number): Promise<void> {
       return new Promise((resolve) => setTimeout(resolve, ms));
     }

     getProgress(): {
       total: number;
       pending: number;
       processing: number;
       completed: number;
       failed: number;
     } {
       const jobs = Array.from(this.jobs.values());

       return {
         total: jobs.length,
         pending: jobs.filter((j) => j.status === 'pending').length,
         processing: jobs.filter((j) => j.status === 'processing').length,
         completed: jobs.filter((j) => j.status === 'completed').length,
         failed: jobs.filter((j) => j.status === 'failed').length,
       };
     }
   }
   ```

3. **API endpoint for scraping**

   ```typescript
   // app/api/scrape/route.ts
   import { NextRequest, NextResponse } from 'next/server';
   import { getServerSession } from 'next-auth';
   import { BasicContentScraper } from '@/lib/scraper/basic-scraper';
   import { supabase } from '@/lib/supabase/server';

   export async function POST(request: NextRequest) {
     // Check authentication
     const session = await getServerSession();
     if (!session) {
       return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
     }

     const { url, urls } = await request.json();

     if (!url && !urls) {
       return NextResponse.json({ error: 'URL or URLs array required' }, { status: 400 });
     }

     const scraper = new BasicContentScraper();

     try {
       if (url) {
         // Single URL scraping
         const content = await scraper.scrapeUrl(url);

         // Save to database
         const { data, error } = await supabase
           .from('scraped_content')
           .insert({
             user_id: session.user.id,
             url: content.url,
             title: content.title,
             description: content.description,
             content: content.content,
             headings: content.headings,
             images: content.images,
             meta: content.meta,
             scraped_at: content.scrapedAt,
           })
           .select()
           .single();

         if (error) throw error;

         return NextResponse.json({ success: true, data });
       } else {
         // Batch scraping (basic version - sequential)
         const results = [];

         for (const singleUrl of urls.slice(0, 10)) {
           // Limit to 10 URLs
           try {
             const content = await scraper.scrapeUrl(singleUrl);
             results.push({ url: singleUrl, success: true, content });

             // Basic delay between requests
             await new Promise((resolve) => setTimeout(resolve, 1000));
           } catch (error) {
             results.push({
               url: singleUrl,
               success: false,
               error: error.message,
             });
           }
         }

         return NextResponse.json({ success: true, results });
       }
     } catch (error) {
       console.error('Scraping error:', error);
       return NextResponse.json(
         { error: 'Scraping failed', details: error.message },
         { status: 500 }
       );
     }
   }
   ```

4. **Basic UI component for scraping**

   ```typescript
   // components/scraper/SimpleScraper.tsx
   import { useState } from 'react';

   export function SimpleScraper() {
     const [url, setUrl] = useState('');
     const [loading, setLoading] = useState(false);
     const [result, setResult] = useState(null);
     const [error, setError] = useState('');

     const handleScrape = async () => {
       if (!url) return;

       setLoading(true);
       setError('');
       setResult(null);

       try {
         const response = await fetch('/api/scrape', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ url }),
         });

         const data = await response.json();

         if (!response.ok) {
           throw new Error(data.error || 'Scraping failed');
         }

         setResult(data.data);
       } catch (err) {
         setError(err.message);
       } finally {
         setLoading(false);
       }
     };

     return (
       <div className="space-y-4">
         <div className="flex space-x-2">
           <input
             type="url"
             value={url}
             onChange={(e) => setUrl(e.target.value)}
             placeholder="Enter URL to scrape"
             className="flex-1 px-3 py-2 border rounded-md"
             disabled={loading}
           />
           <button
             onClick={handleScrape}
             disabled={loading || !url}
             className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
           >
             {loading ? 'Scraping...' : 'Scrape'}
           </button>
         </div>

         {error && (
           <div className="p-4 bg-red-50 text-red-600 rounded-md">
             {error}
           </div>
         )}

         {result && (
           <div className="p-4 bg-gray-50 rounded-md">
             <h3 className="font-semibold">{result.title}</h3>
             <p className="text-sm text-gray-600 mt-1">{result.description}</p>
             <div className="mt-2 text-sm">
               <span className="text-gray-500">Content length:</span>{' '}
               {result.content.length} characters
             </div>
           </div>
         )}
       </div>
     );
   }
   ```

## Files to Create

- `lib/scraper/basic-scraper.ts` - Core scraping logic
- `lib/scraper/scraper-queue.ts` - Simple queue management
- `app/api/scrape/route.ts` - API endpoint
- `components/scraper/SimpleScraper.tsx` - Basic UI
- `types/scraper.ts` - Type definitions

## Acceptance Criteria

- [ ] Can scrape single URL successfully
- [ ] Extracts title, description, and content
- [ ] Handles basic HTML parsing
- [ ] Saves scraped content to database
- [ ] Simple error handling for failed requests
- [ ] Basic UI for testing scraping
- [ ] Respects 1-second delay between requests
- [ ] Works with common website structures

## Testing Requirements

- [ ] Test with various website types
- [ ] Test with invalid URLs
- [ ] Test with pages that return errors
- [ ] Test content extraction accuracy
- [ ] Test image URL resolution
- [ ] Test metadata extraction
- [ ] Verify database storage
- [ ] Test UI error states

## Definition of Done

- [ ] Basic scraping functional
- [ ] Content saved to database
- [ ] Simple UI working
- [ ] Error handling in place
- [ ] Tests passing
- [ ] No console errors
- [ ] Code reviewed
- [ ] Ready for advanced features in Sprint 3
