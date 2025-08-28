import { Page } from 'playwright';
import { 
  ScrapedContent, 
  UrlCategory 
} from '@/types/scraper.types';
import { ContentExtractor } from './content-extractor';

export class PaginationHandler {
  private extractor: ContentExtractor;
  private maxPages: number = 100; // Safety limit

  constructor(extractor: ContentExtractor) {
    this.extractor = extractor;
  }

  async scrapeAllPages(
    firstPageUrl: string,
    page: Page,
    urlCategory: UrlCategory
  ): Promise<ScrapedContent[]> {
    const allContent: ScrapedContent[] = [];
    const visitedUrls = new Set<string>();
    let currentUrl = firstPageUrl;
    let pageNum = 1;

    // Starting pagination scraping

    while (currentUrl && pageNum <= this.maxPages) {
      // Avoid infinite loops
      if (visitedUrls.has(currentUrl)) {
        // Already visited URL, stopping pagination
        break;
      }
      visitedUrls.add(currentUrl);

      try {
        // Navigate to current page if not already there
        if (page.url() !== currentUrl && pageNum > 1) {
          await page.goto(currentUrl, {
            waitUntil: 'networkidle',
            timeout: 30000
          });
          await this.waitForContentLoad(page);
        }

        // Extract content from current page
        // Scraping current page
        const content = await this.extractor.extractContent(page, urlCategory);
        
        // Add pagination info
        content.pagination = {
          currentPage: pageNum,
          totalPages: 0, // Will be updated later
          hasNextPage: false,
          scrapedPages: []
        };

        // Check for next page
        const nextPageUrl = await this.findNextPageUrl(page, currentUrl);
        
        if (nextPageUrl && nextPageUrl !== currentUrl) {
          content.pagination.hasNextPage = true;
          content.pagination.nextPageUrl = nextPageUrl;
          currentUrl = nextPageUrl;
          pageNum++;
        } else {
          // No more pages
          // No more pages found
          allContent.push(content);
          break;
        }

        allContent.push(content);

        // Add a small delay between pages to be respectful
        await page.waitForTimeout(1000);

      } catch (error) {
        console.error(`Error scraping page ${pageNum}:`, error);
        break;
      }
    }

    // Update total pages in all records
    const totalPages = pageNum;
    const scrapedPages = Array.from({ length: totalPages }, (_, i) => i + 1);
    
    allContent.forEach(content => {
      if (content.pagination) {
        content.pagination.totalPages = totalPages;
        content.pagination.scrapedPages = scrapedPages;
      }
    });

    // Pagination complete
    return allContent;
  }

  private async findNextPageUrl(page: Page, currentUrl: string): Promise<string | null> {
    // Common pagination selectors ordered by specificity
    const selectors = [
      'a[rel="next"]',
      'link[rel="next"]',
      '.pagination a.next:not(.disabled)',
      '.pagination li.next a',
      '[class*="pagination"] a[aria-label*="Next"]',
      '[class*="pagination"] a[title*="Next"]',
      '.page-numbers a.next',
      'nav[aria-label="pagination"] a[aria-label*="next"]',
      'a.next-page:not(.disabled)',
      'a[class*="next"]:not(.disabled)',
      'a:has-text("Next"):not(.disabled)',
      'a:has-text("→"):not(.disabled)',
      'a:has-text("»"):not(.disabled)',
      'button:has-text("Next"):not(:disabled)',
      '[data-testid*="next"]',
      '[data-qa*="next"]'
    ];

    for (const selector of selectors) {
      try {
        // Check if element exists and is visible
        const element = await page.$(selector);
        if (!element) continue;

        // Check if element is visible and not disabled
        const isVisible = await element.isVisible().catch(() => false);
        if (!isVisible) continue;

        // Get href or onclick URL
        let nextUrl = await element.getAttribute('href').catch(() => null);
        
        // If no href, check for data attributes or onclick
        if (!nextUrl) {
          nextUrl = await element.getAttribute('data-href').catch(() => null);
        }

        if (nextUrl) {
          // Handle relative URLs
          if (!nextUrl.startsWith('http')) {
            const baseUrl = new URL(currentUrl);
            if (nextUrl.startsWith('/')) {
              nextUrl = `${baseUrl.protocol}//${baseUrl.host}${nextUrl}`;
            } else if (nextUrl.startsWith('?')) {
              nextUrl = `${baseUrl.protocol}//${baseUrl.host}${baseUrl.pathname}${nextUrl}`;
            } else {
              // Relative path
              const pathParts = baseUrl.pathname.split('/');
              pathParts.pop(); // Remove current page
              nextUrl = `${baseUrl.protocol}//${baseUrl.host}${pathParts.join('/')}/${nextUrl}`;
            }
          }

          // Validate URL
          try {
            new URL(nextUrl);
            // Found next page URL
            return nextUrl;
          } catch {
            console.warn(`Invalid next page URL: ${nextUrl}`);
          }
        }
      } catch {
        // Continue to next selector
        continue;
      }
    }

    // Try numbered pagination
    const numberedUrl = await this.findNumberedPagination(page, currentUrl);
    if (numberedUrl) {
      return numberedUrl;
    }

    return null;
  }

  private async findNumberedPagination(page: Page, currentUrl: string): Promise<string | null> {
    try {
      // Look for numbered pagination
      const numberSelectors = [
        '.pagination a',
        '.page-numbers a',
        '[class*="pagination"] a',
        'nav[role="navigation"] a'
      ];

      for (const selector of numberSelectors) {
        const links = await page.$$(selector);
        
        for (const link of links) {
          const text = await link.textContent().catch(() => '');
          const href = await link.getAttribute('href').catch(() => null);
          
          // Check if this is a number and higher than current
          if (text && /^\d+$/.test(text.trim()) && href) {
            const pageNumber = parseInt(text.trim());
            const currentPageMatch = currentUrl.match(/[?&]page=(\d+)/);
            const currentPage = currentPageMatch ? parseInt(currentPageMatch[1]) : 1;
            
            if (pageNumber === currentPage + 1) {
              // Found next page number
              const baseUrl = new URL(currentUrl);
              if (!href.startsWith('http')) {
                return `${baseUrl.protocol}//${baseUrl.host}${href.startsWith('/') ? href : '/' + href}`;
              }
              return href;
            }
          }
        }
      }
    } catch (error) {
      console.error('Error finding numbered pagination:', error);
    }

    return null;
  }

  private async waitForContentLoad(page: Page): Promise<void> {
    try {
      // Wait for main content to load
      await page.waitForSelector(
        'h1, [class*="product"], [class*="category"], main',
        { timeout: 5000 }
      ).catch(() => {});

      // Wait for any loading indicators to disappear
      const loadingSelectors = [
        '.loading',
        '[class*="spinner"]',
        '[class*="loader"]',
        '.skeleton'
      ];

      for (const selector of loadingSelectors) {
        await page.waitForSelector(selector, { 
          state: 'hidden', 
          timeout: 3000 
        }).catch(() => {});
      }

      // Small additional wait for dynamic content
      await page.waitForTimeout(500);
    } catch (error) {
      // Continue even if wait fails
      console.warn('Timeout waiting for content load, continuing...');
    }
  }
}