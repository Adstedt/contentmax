# Story 2.3: Content Scraper with Rate Limiting

## User Story

As a content analyst,
I want to automatically scrape and analyze existing content from my site,
So that I can identify what content exists and what needs improvement.

## Size & Priority

- **Size**: L (8 hours)
- **Priority**: P0 - Critical
- **Sprint**: 2
- **Dependencies**: Task 2.2

## Description

Build a robust web scraper with rate limiting, robots.txt compliance, and content structure analysis to extract and analyze existing website content.

## Implementation Steps

1. **Set up Playwright for scraping**

   ```typescript
   import { chromium, Browser, Page } from 'playwright';

   class ContentScraper {
     private browser: Browser;

     async initialize() {
       this.browser = await chromium.launch({
         headless: true,
         args: ['--disable-blink-features=AutomationControlled'],
       });
     }

     async scrapePage(url: string): Promise<PageContent> {
       const page = await this.browser.newPage();
       // Set user agent, viewport
       // Navigate and extract content
     }
   }
   ```

2. **Implement rate limiting**

   ```typescript
   class RateLimiter {
     private queue: ScrapingJob[] = [];
     private concurrency = 3;
     private delayMs = 1000;

     async execute(job: ScrapingJob): Promise<ScrapingResult> {
       // Queue management
       // Respect rate limits
       // Exponential backoff on 429
     }
   }
   ```

3. **Check robots.txt compliance**

   ```typescript
   import robotsParser from 'robots-txt-parser';

   class RobotsChecker {
     private robots: Map<string, RobotsParser> = new Map();

     async canScrape(url: string): Promise<boolean> {
       const robotsUrl = new URL('/robots.txt', url).href;
       // Fetch and parse robots.txt
       // Check if URL is allowed
     }
   }
   ```

4. **Extract structured content**

   ```typescript
   interface ExtractedContent {
     title: string;
     metaDescription: string;
     h1: string[];
     h2: string[];
     bodyText: string;
     images: ImageData[];
     links: LinkData[];
     schema: any[];
     contentLength: number;
   }

   function extractContent(html: string): ExtractedContent {
     // Parse HTML with cheerio
     // Extract structured data
     // Clean and normalize text
   }
   ```

5. **Content quality analysis**
   ```typescript
   interface ContentAnalysis {
     hasTitle: boolean;
     hasMetaDescription: boolean;
     wordCount: number;
     readingTime: number;
     hasSchema: boolean;
     hasImages: boolean;
     seoScore: number;
     contentQuality: 'missing' | 'basic' | 'good' | 'optimized';
   }
   ```

## Files to Create

- `lib/scraping/scraper.ts` - Core scraping engine with Playwright
- `lib/scraping/rate-limiter.ts` - Rate limiting and queue management
- `lib/scraping/robots-checker.ts` - Robots.txt compliance
- `lib/scraping/content-extractor.ts` - HTML parsing and extraction
- `lib/scraping/content-analyzer.ts` - Content quality scoring
- `lib/queue/scraping-queue.ts` - Job queue management
- `supabase/functions/scrape-content/index.ts` - Edge function for scraping
- `tests/scraping.test.ts` - Unit and integration tests

## Rate Limiting Configuration

```typescript
interface RateLimitConfig {
  maxConcurrency: number; // Max parallel requests (default: 3)
  delayBetweenRequests: number; // Milliseconds (default: 1000)
  respectRobotsTxt: boolean; // Always true
  timeout: number; // Page timeout (default: 30000)
  retryAttempts: number; // Max retries (default: 3)
  backoffMultiplier: number; // Exponential backoff (default: 2)
  userAgent: string; // Custom user agent
}

const defaultConfig: RateLimitConfig = {
  maxConcurrency: 3,
  delayBetweenRequests: 1000,
  respectRobotsTxt: true,
  timeout: 30000,
  retryAttempts: 3,
  backoffMultiplier: 2,
  userAgent: 'ContentMax/1.0 (https://contentmax.ai/bot)',
};
```

## Queue Management

```typescript
interface ScrapingJob {
  id: string;
  url: string;
  priority: number;
  retryCount: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  result?: ExtractedContent;
}

class ScrapingQueue {
  async enqueue(urls: string[]): Promise<string> {
    // Create batch job
    // Store in database
    // Start processing
  }

  async getProgress(jobId: string): Promise<QueueProgress> {
    // Return current progress
  }
}
```

## Error Handling Strategy

- **429 Too Many Requests**: Exponential backoff, increase delay
- **403 Forbidden**: Check robots.txt, mark as blocked
- **404 Not Found**: Mark as missing, don't retry
- **Timeout**: Retry with longer timeout
- **Network Error**: Retry with backoff
- **JavaScript Error**: Try static HTML fallback

## Acceptance Criteria

- [ ] Can scrape content from provided URLs
- [ ] Rate limiting prevents overwhelming servers
- [ ] Robots.txt compliance verified before scraping
- [ ] Content extraction captures all key elements
- [ ] JavaScript-rendered content handled properly
- [ ] Queue system manages batch scraping jobs
- [ ] Progress tracking for long-running jobs
- [ ] Error handling with appropriate retries
- [ ] Content stored in structured format

## Performance Requirements

- Scrape 100 pages per minute (with proper rate limiting)
- Handle pages up to 10MB
- Timeout after 30 seconds per page
- Memory usage <1GB for 1000 pages
- Support concurrent scraping (3-5 threads)

## Database Schema

```sql
CREATE TABLE scraped_content (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects(id),
  url TEXT NOT NULL,
  title TEXT,
  meta_description TEXT,
  content JSONB,
  word_count INTEGER,
  quality_score INTEGER,
  has_schema BOOLEAN,
  scraped_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(project_id, url)
);

CREATE INDEX idx_scraped_quality ON scraped_content(quality_score);
CREATE INDEX idx_scraped_project ON scraped_content(project_id);
```

## Security Considerations

- Never scrape sensitive URLs (admin, login, etc.)
- Respect authentication boundaries
- Don't store passwords or PII
- Sanitize scraped content before storage
- Validate URLs before scraping
- Use proxy rotation if needed

## Testing Requirements

- [ ] Test rate limiting with mock server
- [ ] Test robots.txt compliance
- [ ] Test with various HTML structures
- [ ] Test JavaScript-heavy sites
- [ ] Test error handling and retries
- [ ] Test queue management
- [ ] Test memory usage with large batches
- [ ] Test concurrent scraping

## Definition of Done

- [ ] Code complete and committed
- [ ] Scraping engine working reliably
- [ ] Rate limiting properly enforced
- [ ] Robots.txt compliance verified
- [ ] Content extraction comprehensive
- [ ] Queue system functional
- [ ] Tests written and passing
- [ ] Documentation complete
- [ ] Peer review completed
