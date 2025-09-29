import { XMLParser, XMLValidator } from 'fast-xml-parser';
import {
  SitemapEntry,
  SitemapIndexEntry,
  ParsedSitemap,
  SitemapParseOptions,
  SitemapParseResult,
  ContentCategory,
} from '@/types/sitemap.types';

export class SitemapParser {
  private parser: XMLParser;

  constructor() {
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      textNodeName: '#text',
      parseAttributeValue: true,
      trimValues: true,
      parseTagValue: true,
      removeNSPrefix: true,
    });
  }

  async parse(
    xmlContent: string,
    options: SitemapParseOptions = {}
  ): Promise<SitemapParseResult> {
    const errors: string[] = [];
    
    try {
      // Validate XML first
      const validationResult = XMLValidator.validate(xmlContent, {
        allowBooleanAttributes: true,
      });
      
      if (validationResult !== true) {
        throw new Error(`Invalid XML: ${validationResult.err?.msg || 'Unknown error'}`);
      }

      // Parse the XML
      const parsed = this.parser.parse(xmlContent);
      
      // Determine if this is a sitemap index or regular sitemap
      const sitemapData = this.identifySitemapType(parsed);
      
      if (sitemapData.type === 'sitemapindex') {
        return await this.parseSitemapIndex(sitemapData, options);
      } else {
        return await this.parseUrlSet(sitemapData, options);
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Unknown parsing error');
      return {
        success: false,
        entries: [],
        totalUrls: 0,
        categoryCounts: this.initializeCategoryCounts(),
        errors,
      };
    }
  }

  identifySitemapType(parsed: Record<string, unknown>): ParsedSitemap {
    if (parsed.sitemapindex) {
      // This is a sitemap index file
      const sitemapData = parsed.sitemapindex as Record<string, unknown>;
      const sitemaps = Array.isArray(sitemapData.sitemap)
        ? sitemapData.sitemap
        : sitemapData.sitemap
        ? [sitemapData.sitemap]
        : [];

      const indexEntries: SitemapIndexEntry[] = sitemaps.map((sitemap: Record<string, unknown>) => ({
        loc: String(sitemap.loc || sitemap['#text'] || ''),
        lastmod: sitemap.lastmod ? String(sitemap.lastmod) : undefined,
      }));

      return {
        type: 'sitemapindex',
        entries: [],
        indexEntries,
      };
    } else if (parsed.urlset) {
      // This is a regular sitemap
      const urlsetData = parsed.urlset as Record<string, unknown>;
      const urls = Array.isArray(urlsetData.url)
        ? urlsetData.url
        : urlsetData.url
        ? [urlsetData.url]
        : [];

      const entries: SitemapEntry[] = urls.map((url: Record<string, unknown>) => ({
        url: String(url.loc || url['#text'] || ''),
        lastmod: url.lastmod ? String(url.lastmod) : undefined,
        changefreq: url.changefreq as SitemapEntry['changefreq'],
        priority: url.priority ? parseFloat(String(url.priority)) : undefined,
      }));

      return {
        type: 'urlset',
        entries,
      };
    } else {
      // Empty sitemap or unknown format - return empty urlset
      return {
        type: 'urlset',
        entries: [],
      };
    }
  }

  private async parseSitemapIndex(
    sitemapData: ParsedSitemap,
    options: SitemapParseOptions
  ): Promise<SitemapParseResult> {
    const entries: SitemapEntry[] = [];
    const errors: string[] = [];

    if (!options.fetchChildSitemaps) {
      // Just return the index entries as regular entries
      const indexEntries = sitemapData.indexEntries || [];
      return {
        success: true,
        entries: indexEntries.map(entry => ({
          url: entry.loc,
          lastmod: entry.lastmod,
        })),
        totalUrls: indexEntries.length,
        categoryCounts: this.initializeCategoryCounts(),
        errors: errors.length > 0 ? errors : undefined,
      };
    }

    // Note: Actual fetching of child sitemaps would be handled by sitemap-fetcher.ts
    // This is just the parsing logic
    return {
      success: true,
      entries,
      totalUrls: 0,
      categoryCounts: this.initializeCategoryCounts(),
      errors: ['Child sitemap fetching not implemented in parser. Use SitemapFetcher.'],
    };
  }

  private async parseUrlSet(
    sitemapData: ParsedSitemap,
    options: SitemapParseOptions
  ): Promise<SitemapParseResult> {
    let entries = sitemapData.entries;

    // Apply max URLs limit if specified
    if (options.maxUrls && entries.length > options.maxUrls) {
      entries = entries.slice(0, options.maxUrls);
    }

    // Categorize URLs if requested
    if (options.categorizeUrls) {
      const { categorizeUrl } = await import('./url-categorizer');
      entries = entries.map(entry => ({
        ...entry,
        category: categorizeUrl(entry.url),
      }));
    }

    // Count categories
    const categoryCounts = this.countCategories(entries);

    return {
      success: true,
      entries,
      totalUrls: entries.length,
      categoryCounts,
    };
  }

  private initializeCategoryCounts(): Record<ContentCategory, number> {
    return {
      [ContentCategory.PRODUCT]: 0,
      [ContentCategory.CATEGORY]: 0,
      [ContentCategory.BRAND]: 0,
      [ContentCategory.BLOG]: 0,
      [ContentCategory.OTHER]: 0,
    };
  }

  private countCategories(entries: SitemapEntry[]): Record<ContentCategory, number> {
    const counts = this.initializeCategoryCounts();
    
    entries.forEach(entry => {
      const category = entry.category || ContentCategory.OTHER;
      counts[category]++;
    });

    return counts;
  }

  // Stream parsing for large files
  async parseStream(
    xmlStream: ReadableStream<Uint8Array>,
    options: SitemapParseOptions = {}
  ): Promise<SitemapParseResult> {
    // Note: For MVP, we'll convert stream to string and use regular parsing
    // Full streaming implementation would require a streaming XML parser
    const reader = xmlStream.getReader();
    const chunks: Uint8Array[] = [];
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      
      const xmlContent = new TextDecoder().decode(
        new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0))
      );
      
      return this.parse(xmlContent, { ...options, streaming: true });
    } finally {
      reader.releaseLock();
    }
  }
}