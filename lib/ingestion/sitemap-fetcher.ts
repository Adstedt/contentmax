import { SitemapParser } from './sitemap-parser';
import { categorizeUrl } from './url-categorizer';
import {
  SitemapEntry,
  SitemapParseOptions,
  SitemapParseResult,
  ContentCategory,
} from '@/types/sitemap.types';

interface FetchOptions {
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
  userAgent?: string;
  followRedirects?: boolean;
  maxRedirects?: number;
  acceptGzip?: boolean;
}

interface FetchProgress {
  totalUrls: number;
  processedUrls: number;
  currentSitemap: string;
  status: 'fetching' | 'parsing' | 'complete' | 'error';
  errors: string[];
}

type ProgressCallback = (progress: FetchProgress) => void;

export class SitemapFetcher {
  private parser: SitemapParser;
  private defaultOptions: FetchOptions = {
    maxRetries: 3,
    retryDelay: 1000, // 1 second
    timeout: 30000, // 30 seconds
    userAgent: 'ContentMax-Sitemap-Parser/1.0',
    followRedirects: true,
    maxRedirects: 5,
    acceptGzip: true,
  };

  constructor() {
    this.parser = new SitemapParser();
  }

  async fetch(
    sitemapUrl: string,
    options: SitemapParseOptions & FetchOptions = {},
    progressCallback?: ProgressCallback
  ): Promise<SitemapParseResult> {
    const fetchOptions = { ...this.defaultOptions, ...options };
    const allEntries: SitemapEntry[] = [];
    const errors: string[] = [];
    
    try {
      // Validate URL
      const url = this.validateUrl(sitemapUrl);
      
      // Update progress
      if (progressCallback) {
        progressCallback({
          totalUrls: 0,
          processedUrls: 0,
          currentSitemap: url.href,
          status: 'fetching',
          errors: [],
        });
      }

      // Fetch the sitemap with retries
      const xmlContent = await this.fetchWithRetry(url.href, fetchOptions);
      
      // Update progress
      if (progressCallback) {
        progressCallback({
          totalUrls: 0,
          processedUrls: 0,
          currentSitemap: url.href,
          status: 'parsing',
          errors: [],
        });
      }

      // Parse the sitemap
      const parseResult = await this.parser.parse(xmlContent, options);
      
      if (!parseResult.success) {
        errors.push(...(parseResult.errors || []));
        return parseResult;
      }

      // Check if it's a sitemap index and we need to fetch child sitemaps
      const xmlParser = new (await import('fast-xml-parser')).XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
        textNodeName: '#text',
        parseAttributeValue: true,
        trimValues: true,
        parseTagValue: true,
        removeNSPrefix: true,
      });
      const parsedXml = xmlParser.parse(xmlContent);
      const parsed = this.parser.identifySitemapType(parsedXml);
      
      if (parsed.type === 'sitemapindex' && options.fetchChildSitemaps) {
        // Fetch and parse child sitemaps
        const childResults = await this.fetchChildSitemaps(
          parsed.indexEntries || [],
          options,
          fetchOptions,
          progressCallback
        );
        
        allEntries.push(...childResults.entries);
        errors.push(...childResults.errors);
      } else {
        allEntries.push(...parseResult.entries);
      }

      // Apply categorization if needed
      if (options.categorizeUrls) {
        for (const entry of allEntries) {
          if (!entry.category) {
            entry.category = categorizeUrl(entry.url);
          }
        }
      }

      // Calculate category counts
      const categoryCounts = this.countCategories(allEntries);

      // Update final progress
      if (progressCallback) {
        progressCallback({
          totalUrls: allEntries.length,
          processedUrls: allEntries.length,
          currentSitemap: url.href,
          status: 'complete',
          errors,
        });
      }

      return {
        success: errors.length === 0,
        entries: allEntries,
        totalUrls: allEntries.length,
        categoryCounts,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push(errorMessage);
      
      if (progressCallback) {
        progressCallback({
          totalUrls: 0,
          processedUrls: 0,
          currentSitemap: sitemapUrl,
          status: 'error',
          errors: [errorMessage],
        });
      }

      return {
        success: false,
        entries: allEntries,
        totalUrls: allEntries.length,
        categoryCounts: this.countCategories(allEntries),
        errors,
      };
    }
  }

  private async fetchChildSitemaps(
    indexEntries: Array<{ loc: string; lastmod?: string }>,
    parseOptions: SitemapParseOptions,
    fetchOptions: FetchOptions,
    progressCallback?: ProgressCallback
  ): Promise<{ entries: SitemapEntry[]; errors: string[] }> {
    const allEntries: SitemapEntry[] = [];
    const errors: string[] = [];
    let processedCount = 0;

    for (const indexEntry of indexEntries) {
      try {
        if (!indexEntry.loc) {
          errors.push('Empty sitemap location in index');
          continue;
        }

        // Update progress
        if (progressCallback) {
          progressCallback({
            totalUrls: allEntries.length,
            processedUrls: processedCount,
            currentSitemap: indexEntry.loc,
            status: 'fetching',
            errors,
          });
        }

        // Fetch child sitemap
        const xmlContent = await this.fetchWithRetry(indexEntry.loc, fetchOptions);
        
        // Parse child sitemap
        const childResult = await this.parser.parse(xmlContent, {
          ...parseOptions,
          fetchChildSitemaps: false, // Don't recursively fetch from child sitemaps
        });

        if (childResult.success) {
          allEntries.push(...childResult.entries);
        } else {
          errors.push(`Failed to parse ${indexEntry.loc}: ${childResult.errors?.join(', ')}`);
        }

        processedCount++;
        
        // Apply rate limiting
        if (processedCount < indexEntries.length) {
          await this.delay(fetchOptions.retryDelay || 1000);
        }
      } catch (error) {
        const errorMessage = `Error fetching ${indexEntry.loc}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`;
        errors.push(errorMessage);
      }
    }

    return { entries: allEntries, errors };
  }

  private async fetchWithRetry(
    url: string,
    options: FetchOptions
  ): Promise<string> {
    const { maxRetries = 3, retryDelay = 1000, timeout = 30000 } = options;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'User-Agent': options.userAgent || 'ContentMax-Sitemap-Parser/1.0',
            'Accept': 'application/xml, text/xml, application/rss+xml, */*',
            'Accept-Encoding': options.acceptGzip ? 'gzip, deflate, br' : 'identity',
          },
          signal: controller.signal,
          redirect: options.followRedirects ? 'follow' : 'manual',
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('xml') && !contentType.includes('text')) {
          console.warn(`Unexpected content-type: ${contentType} for ${url}`);
        }

        const text = await response.text();
        
        // Basic validation that it looks like XML
        if (!text.trim().startsWith('<?xml') && !text.trim().startsWith('<')) {
          throw new Error('Response does not appear to be XML');
        }

        return text;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown fetch error');
        
        if (error instanceof Error && error.name === 'AbortError') {
          lastError = new Error(`Request timeout after ${timeout}ms`);
        }

        // Don't retry on certain errors
        if (
          lastError.message.includes('HTTP 404') ||
          lastError.message.includes('HTTP 403') ||
          lastError.message.includes('HTTP 401')
        ) {
          throw lastError;
        }

        // If not the last attempt, wait before retrying
        if (attempt < maxRetries) {
          await this.delay(retryDelay * Math.pow(2, attempt)); // Exponential backoff
        }
      }
    }

    throw lastError || new Error('Failed to fetch sitemap after retries');
  }

  private validateUrl(urlString: string): URL {
    try {
      const url = new URL(urlString);
      if (!['http:', 'https:'].includes(url.protocol)) {
        throw new Error('Only HTTP and HTTPS protocols are supported');
      }
      return url;
    } catch (_error) {
      throw new Error(`Invalid URL: ${urlString}`);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private countCategories(entries: SitemapEntry[]): Record<ContentCategory, number> {
    const counts: Record<ContentCategory, number> = {
      [ContentCategory.PRODUCT]: 0,
      [ContentCategory.CATEGORY]: 0,
      [ContentCategory.BRAND]: 0,
      [ContentCategory.BLOG]: 0,
      [ContentCategory.OTHER]: 0,
    };

    for (const entry of entries) {
      const category = entry.category || ContentCategory.OTHER;
      counts[category]++;
    }

    return counts;
  }

  // Check if a URL is a sitemap
  async isSitemap(url: string): Promise<boolean> {
    try {
      const response = await fetch(url, {
        method: 'HEAD',
        headers: {
          'User-Agent': this.defaultOptions.userAgent || 'ContentMax-Sitemap-Parser/1.0',
        },
      });

      const contentType = response.headers.get('content-type') || '';
      
      // Check content type
      if (contentType.includes('xml')) {
        return true;
      }

      // Check URL patterns
      if (
        url.includes('sitemap') ||
        url.endsWith('.xml') ||
        url.includes('sitemap.xml')
      ) {
        return true;
      }

      return false;
    } catch (_error) {
      return false;
    }
  }

  // Discover sitemaps from robots.txt
  async discoverSitemaps(domain: string): Promise<string[]> {
    const sitemaps: string[] = [];
    
    try {
      // Ensure proper URL format
      const baseUrl = domain.startsWith('http') ? domain : `https://${domain}`;
      const url = new URL(baseUrl);
      const robotsUrl = `${url.origin}/robots.txt`;

      const response = await fetch(robotsUrl, {
        headers: {
          'User-Agent': this.defaultOptions.userAgent || 'ContentMax-Sitemap-Parser/1.0',
        },
      });

      if (response.ok) {
        const text = await response.text();
        const lines = text.split('\n');
        
        for (const line of lines) {
          if (line.toLowerCase().startsWith('sitemap:')) {
            const sitemapUrl = line.substring(8).trim();
            if (sitemapUrl) {
              sitemaps.push(sitemapUrl);
            }
          }
        }
      }

      // Also check common sitemap locations
      const commonLocations = [
        `${url.origin}/sitemap.xml`,
        `${url.origin}/sitemap_index.xml`,
        `${url.origin}/sitemaps/sitemap.xml`,
        `${url.origin}/sitemap/sitemap.xml`,
      ];

      for (const location of commonLocations) {
        if (await this.isSitemap(location)) {
          if (!sitemaps.includes(location)) {
            sitemaps.push(location);
          }
        }
      }
    } catch (error) {
      console.error('Error discovering sitemaps:', error);
    }

    return sitemaps;
  }
}