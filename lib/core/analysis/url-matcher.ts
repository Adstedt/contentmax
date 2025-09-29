import { distance as levenshtein } from 'fastest-levenshtein';
import {
  URLMatchResult,
  URLMatchOptions,
  URLPattern,
  BatchMatchRequest,
  BatchMatchResult,
  URLComponents,
  NormalizedURL,
} from '@/types/url-matcher.types';

export class URLMatcher {
  private cache: Map<string, NormalizedURL> = new Map();
  private patterns: URLPattern[] = [];
  private defaultOptions: URLMatchOptions = {
    ignoreProtocol: true,
    ignoreWww: true,
    ignoreTrailingSlash: true,
    ignoreCase: true,
    ignoreQueryParams: false,
    ignoreFragment: true,
    fuzzyThreshold: 0.7,
    patternMatching: true,
  };

  constructor(options?: Partial<URLMatchOptions>) {
    this.defaultOptions = { ...this.defaultOptions, ...options };
    this.initializePatterns();
  }

  /**
   * Initialize common URL patterns for e-commerce and content sites
   */
  private initializePatterns(): void {
    this.patterns = [
      {
        name: 'product',
        pattern: /\/products?\/([^/]+)/i,
        extractId: (url) => {
          const match = url.match(/\/products?\/([^/?]+)/i);
          return match ? match[1] : '';
        },
        confidence: 0.85,
      },
      {
        name: 'category',
        pattern: /\/categor(y|ies)\/([^/]+)/i,
        extractId: (url) => {
          const match = url.match(/\/categor(?:y|ies)\/([^/?]+)/i);
          return match ? match[1] : '';
        },
        confidence: 0.85,
      },
      {
        name: 'blog',
        pattern: /\/blog\/(\d{4})\/(\d{2})\/([^/]+)/i,
        extractId: (url) => {
          const match = url.match(/\/blog\/\d{4}\/\d{2}\/([^/?]+)/i);
          return match ? match[1] : '';
        },
        confidence: 0.85,
      },
      {
        name: 'collection',
        pattern: /\/collections?\/([^/]+)/i,
        extractId: (url) => {
          const match = url.match(/\/collections?\/([^/?]+)/i);
          return match ? match[1] : '';
        },
        confidence: 0.85,
      },
    ];
  }

  /**
   * Match a single URL against another with confidence scoring
   */
  matchURL(
    sourceUrl: string,
    targetUrl: string,
    options?: URLMatchOptions
  ): URLMatchResult | null {
    const opts = { ...this.defaultOptions, ...options };

    // Check exact match first
    if (sourceUrl === targetUrl) {
      return {
        url: sourceUrl,
        matchedUrl: targetUrl,
        confidence: 1.0,
        matchType: 'exact',
        components: {
          protocol: true,
          domain: true,
          path: true,
          params: true,
        },
      };
    }

    // Normalize and check
    const sourceNorm = this.normalizeURL(sourceUrl, opts);
    const targetNorm = this.normalizeURL(targetUrl, opts);

    if (sourceNorm.normalized === targetNorm.normalized) {
      return {
        url: sourceUrl,
        matchedUrl: targetUrl,
        confidence: 0.95,
        matchType: 'normalized',
        components: this.compareComponents(sourceNorm.components, targetNorm.components),
      };
    }

    // Try fuzzy matching
    if (opts.fuzzyThreshold && opts.fuzzyThreshold > 0) {
      const fuzzyResult = this.fuzzyMatch(sourceNorm, targetNorm, opts.fuzzyThreshold);
      if (fuzzyResult) {
        return {
          url: sourceUrl,
          matchedUrl: targetUrl,
          confidence: fuzzyResult.confidence,
          matchType: 'fuzzy',
          components: fuzzyResult.components,
        };
      }
    }

    // Try pattern matching
    if (opts.patternMatching) {
      const patternResult = this.patternMatch(sourceNorm, targetNorm);
      if (patternResult) {
        return {
          url: sourceUrl,
          matchedUrl: targetUrl,
          confidence: patternResult.confidence,
          matchType: 'pattern',
          components: patternResult.components,
        };
      }
    }

    return null;
  }

  /**
   * Batch match multiple URLs efficiently
   */
  batchMatch(request: BatchMatchRequest): BatchMatchResult {
    const { sourceUrls, targetUrls, options } = request;
    const opts = { ...this.defaultOptions, ...options };
    
    // Pre-normalize all URLs for efficiency
    const normalizedTargets = targetUrls.map(url => this.normalizeURL(url, opts));
    
    // Build index for faster matching
    const targetIndex = new Map<string, number>();
    normalizedTargets.forEach((norm, idx) => {
      targetIndex.set(norm.normalized, idx);
      // Also index by path for partial matching
      if (norm.components.path) {
        targetIndex.set(norm.components.path, idx);
      }
    });

    const matches: URLMatchResult[] = [];
    const unmatched: string[] = [];
    let exactCount = 0;
    let normalizedCount = 0;
    let fuzzyCount = 0;
    let patternCount = 0;

    for (const sourceUrl of sourceUrls) {
      let bestMatch: URLMatchResult | null = null;
      let bestConfidence = 0;

      for (let i = 0; i < targetUrls.length; i++) {
        const result = this.matchURL(sourceUrl, targetUrls[i], opts);
        if (result && result.confidence > bestConfidence) {
          bestMatch = result;
          bestConfidence = result.confidence;
          
          // Perfect match, no need to continue
          if (result.confidence === 1.0) {
            break;
          }
        }
      }

      if (bestMatch) {
        matches.push(bestMatch);
        switch (bestMatch.matchType) {
          case 'exact':
            exactCount++;
            break;
          case 'normalized':
            normalizedCount++;
            break;
          case 'fuzzy':
            fuzzyCount++;
            break;
          case 'pattern':
            patternCount++;
            break;
        }
      } else {
        unmatched.push(sourceUrl);
      }
    }

    const avgConfidence = matches.length > 0
      ? matches.reduce((sum, m) => sum + m.confidence, 0) / matches.length
      : 0;

    return {
      matches,
      unmatched,
      statistics: {
        totalSource: sourceUrls.length,
        totalMatched: matches.length,
        exactMatches: exactCount,
        normalizedMatches: normalizedCount,
        fuzzyMatches: fuzzyCount,
        patternMatches: patternCount,
        averageConfidence: Math.round(avgConfidence * 100) / 100,
      },
    };
  }

  /**
   * Normalize a URL according to options
   */
  normalizeURL(url: string, options?: URLMatchOptions): NormalizedURL {
    const opts = { ...this.defaultOptions, ...options };
    
    // Check cache
    const cacheKey = `${url}-${JSON.stringify(opts)}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    let normalized = url;
    const components: URLComponents = {};

    try {
      const urlObj = new URL(url.includes('://') ? url : `https://${url}`);
      
      // Extract components
      components.protocol = urlObj.protocol.replace(':', '');
      components.domain = urlObj.hostname;
      components.path = urlObj.pathname;
      components.params = Object.fromEntries(urlObj.searchParams.entries());
      components.fragment = urlObj.hash.replace('#', '');

      // Check for subdomain
      const domainParts = urlObj.hostname.split('.');
      if (domainParts.length > 2) {
        components.subdomain = domainParts[0];
      }

      // Apply normalization rules
      if (opts.ignoreProtocol) {
        urlObj.protocol = 'https:';
      }

      if (opts.ignoreWww && urlObj.hostname.startsWith('www.')) {
        urlObj.hostname = urlObj.hostname.substring(4);
      }

      let path = urlObj.pathname;
      if (opts.ignoreTrailingSlash && path.length > 1 && path.endsWith('/')) {
        path = path.slice(0, -1);
      }

      if (opts.ignoreCase) {
        urlObj.hostname = urlObj.hostname.toLowerCase();
        path = path.toLowerCase();
      }

      if (opts.ignoreQueryParams) {
        urlObj.search = '';
      }

      if (opts.ignoreFragment) {
        urlObj.hash = '';
      }

      normalized = urlObj.hostname + path;
      if (!opts.ignoreQueryParams && urlObj.search) {
        normalized += urlObj.search;
      }
    } catch (error) {
      // Handle malformed URLs
      normalized = opts.ignoreCase ? url.toLowerCase() : url;
      components.path = url;
    }

    const result: NormalizedURL = {
      original: url,
      normalized,
      components,
      hash: this.hashString(normalized),
    };

    this.cache.set(cacheKey, result);
    return result;
  }

  /**
   * Fuzzy match using Levenshtein distance
   */
  private fuzzyMatch(
    source: NormalizedURL,
    target: NormalizedURL,
    threshold: number
  ): { confidence: number; components: any } | null {
    const sourceStr = source.normalized;
    const targetStr = target.normalized;

    // Calculate similarity
    const maxLen = Math.max(sourceStr.length, targetStr.length);
    if (maxLen === 0) return null;

    const dist = levenshtein(sourceStr, targetStr);
    const similarity = 1 - (dist / maxLen);

    if (similarity >= threshold) {
      // Component-wise comparison for detailed matching
      const components = this.compareComponents(source.components, target.components);
      
      // Weighted confidence based on component matches
      let confidence = similarity * 0.6; // Base from string similarity
      if (components.domain) confidence += 0.2;
      if (components.path) confidence += 0.15;
      if (components.params) confidence += 0.05;

      return {
        confidence: Math.min(confidence, 0.94), // Cap below normalized match
        components,
      };
    }

    return null;
  }

  /**
   * Pattern-based matching for dynamic URLs
   */
  private patternMatch(
    source: NormalizedURL,
    target: NormalizedURL
  ): { confidence: number; components: any } | null {
    for (const pattern of this.patterns) {
      const sourceMatch = source.original.match(pattern.pattern);
      const targetMatch = target.original.match(pattern.pattern);

      if (sourceMatch && targetMatch) {
        // Extract IDs and compare
        const sourceId = pattern.extractId ? pattern.extractId(source.original) : sourceMatch[1];
        const targetId = pattern.extractId ? pattern.extractId(target.original) : targetMatch[1];

        if (sourceId === targetId) {
          return {
            confidence: pattern.confidence,
            components: {
              protocol: source.components.protocol === target.components.protocol,
              domain: source.components.domain === target.components.domain,
              path: true, // Patterns match
              params: false, // May differ
            },
          };
        }
      }
    }

    return null;
  }

  /**
   * Compare URL components
   */
  private compareComponents(source: URLComponents, target: URLComponents): any {
    return {
      protocol: source.protocol === target.protocol,
      domain: source.domain === target.domain,
      path: source.path === target.path,
      params: JSON.stringify(source.params) === JSON.stringify(target.params),
    };
  }

  /**
   * Simple hash function for strings
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(16);
  }

  /**
   * Add custom pattern for matching
   */
  addPattern(pattern: URLPattern): void {
    this.patterns.push(pattern);
  }

  /**
   * Generate report for unmatched URLs
   */
  generateUnmatchedReport(unmatched: string[]): string {
    const report = ['=== Unmatched URLs Report ===\n'];
    report.push(`Total Unmatched: ${unmatched.length}\n`);
    report.push('\nUnmatched URLs:\n');

    // Group by domain for easier analysis
    const byDomain = new Map<string, string[]>();
    
    for (const url of unmatched) {
      try {
        const urlObj = new URL(url.includes('://') ? url : `https://${url}`);
        const domain = urlObj.hostname;
        if (!byDomain.has(domain)) {
          byDomain.set(domain, []);
        }
        byDomain.get(domain)!.push(url);
      } catch {
        if (!byDomain.has('invalid')) {
          byDomain.set('invalid', []);
        }
        byDomain.get('invalid')!.push(url);
      }
    }

    for (const [domain, urls] of byDomain.entries()) {
      report.push(`\n${domain} (${urls.length} URLs):\n`);
      urls.forEach(url => report.push(`  - ${url}\n`));
    }

    return report.join('');
  }

  /**
   * Clear the normalization cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; entries: string[] } {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys()),
    };
  }
}