# TASK-005: URL Matching Algorithm

## Overview

**Priority**: P0 - Blocker  
**Estimate**: 8 hours  
**Owner**: Backend Developer  
**Dependencies**: None  
**Status**: Not Started

## Problem Statement

We need a robust URL matching algorithm to correlate metrics from different sources (GSC, GA4, Shopify) with our taxonomy nodes. URLs can vary in format across systems (trailing slashes, www, protocols, parameters), requiring fuzzy matching with confidence scoring.

## Technical Requirements

### 1. URL Matcher Implementation

#### File: `lib/matching/url-matcher.ts`

```typescript
import { createHash } from 'crypto';
import { distance as levenshteinDistance } from 'fastest-levenshtein';

export interface MatchResult {
  sourceUrl: string;
  targetUrl: string;
  confidence: number; // 0-1
  matchType: 'exact' | 'normalized' | 'fuzzy' | 'pattern';
  transformations: string[];
}

export interface MatchOptions {
  requireSameDomain?: boolean;
  ignoreQueryParams?: boolean;
  ignoreFragment?: boolean;
  caseInsensitive?: boolean;
  maxLevenshteinDistance?: number;
  minConfidence?: number;
}

export interface UnmatchedReport {
  unmatchedSources: string[];
  unmatchedTargets: string[];
  lowConfidenceMatches: MatchResult[];
  statistics: {
    totalSources: number;
    totalTargets: number;
    exactMatches: number;
    fuzzyMatches: number;
    unmatchedCount: number;
    averageConfidence: number;
  };
}

/**
 * URLMatcher - Intelligent URL matching with confidence scoring
 */
export class URLMatcher {
  private indexMap: Map<string, string[]> = new Map();
  private patternCache: Map<string, RegExp> = new Map();
  private readonly DEFAULT_OPTIONS: MatchOptions = {
    requireSameDomain: true,
    ignoreQueryParams: false,
    ignoreFragment: true,
    caseInsensitive: true,
    maxLevenshteinDistance: 3,
    minConfidence: 0.7,
  };

  /**
   * Normalize URL for consistent comparison
   */
  normalizeURL(url: string, options: Partial<MatchOptions> = {}): string {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };

    try {
      let normalized = url.trim();

      // Ensure protocol
      if (!normalized.match(/^https?:\/\//)) {
        normalized = 'https://' + normalized;
      }

      const urlObj = new URL(normalized);

      // Normalize protocol to https
      urlObj.protocol = 'https:';

      // Remove www if present
      urlObj.hostname = urlObj.hostname.replace(/^www\./, '');

      // Handle case sensitivity
      if (opts.caseInsensitive) {
        urlObj.hostname = urlObj.hostname.toLowerCase();
        urlObj.pathname = urlObj.pathname.toLowerCase();
      }

      // Remove trailing slash except for root
      if (urlObj.pathname !== '/' && urlObj.pathname.endsWith('/')) {
        urlObj.pathname = urlObj.pathname.slice(0, -1);
      }

      // Handle query parameters
      if (opts.ignoreQueryParams) {
        urlObj.search = '';
      } else {
        // Sort query parameters for consistent comparison
        const params = new URLSearchParams(urlObj.search);
        const sorted = new URLSearchParams();
        Array.from(params.keys())
          .sort()
          .forEach((key) => {
            sorted.append(key, params.get(key) || '');
          });
        urlObj.search = sorted.toString();
      }

      // Handle fragment
      if (opts.ignoreFragment) {
        urlObj.hash = '';
      }

      return urlObj.href;
    } catch (error) {
      // If URL parsing fails, do basic string normalization
      let normalized = url.trim().toLowerCase();

      // Remove trailing slash
      if (normalized.endsWith('/') && normalized !== '/') {
        normalized = normalized.slice(0, -1);
      }

      return normalized;
    }
  }

  /**
   * Calculate fuzzy match confidence between two URLs
   */
  fuzzyMatch(sourceUrl: string, targetUrl: string, options: Partial<MatchOptions> = {}): number {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };

    // First try exact match
    if (sourceUrl === targetUrl) {
      return 1.0;
    }

    // Try normalized match
    const normalizedSource = this.normalizeURL(sourceUrl, opts);
    const normalizedTarget = this.normalizeURL(targetUrl, opts);

    if (normalizedSource === normalizedTarget) {
      return 0.95; // Slightly less than perfect due to normalization
    }

    // Parse URLs for component comparison
    try {
      const sourceObj = new URL(normalizedSource);
      const targetObj = new URL(normalizedTarget);

      // Check domain match if required
      if (opts.requireSameDomain && sourceObj.hostname !== targetObj.hostname) {
        return 0;
      }

      let confidence = 0;
      let weights = {
        hostname: 0.3,
        pathname: 0.5,
        search: 0.15,
        hash: 0.05,
      };

      // Compare hostname
      if (sourceObj.hostname === targetObj.hostname) {
        confidence += weights.hostname;
      } else {
        // Partial domain match (e.g., subdomain differences)
        const domainSimilarity = this.calculateSimilarity(sourceObj.hostname, targetObj.hostname);
        confidence += weights.hostname * domainSimilarity;
      }

      // Compare pathname
      const pathSimilarity = this.calculatePathSimilarity(sourceObj.pathname, targetObj.pathname);
      confidence += weights.pathname * pathSimilarity;

      // Compare search params
      if (!opts.ignoreQueryParams) {
        const searchSimilarity = this.calculateParamsSimilarity(
          sourceObj.searchParams,
          targetObj.searchParams
        );
        confidence += weights.search * searchSimilarity;
      } else {
        confidence += weights.search; // Full score if ignoring
      }

      // Compare hash
      if (!opts.ignoreFragment) {
        if (sourceObj.hash === targetObj.hash) {
          confidence += weights.hash;
        }
      } else {
        confidence += weights.hash; // Full score if ignoring
      }

      return Math.min(1, confidence);
    } catch (error) {
      // Fall back to string similarity
      return this.calculateSimilarity(normalizedSource, normalizedTarget);
    }
  }

  /**
   * Build index for fast lookups
   */
  buildIndex(urls: string[]): void {
    this.indexMap.clear();

    for (const url of urls) {
      // Index by normalized URL
      const normalized = this.normalizeURL(url);
      this.addToIndex(normalized, url);

      // Index by path only
      try {
        const urlObj = new URL(normalized);
        this.addToIndex(urlObj.pathname, url);

        // Index by last path segment
        const segments = urlObj.pathname.split('/').filter(Boolean);
        if (segments.length > 0) {
          this.addToIndex(segments[segments.length - 1], url);
        }
      } catch {
        // Skip invalid URLs
      }
    }
  }

  private addToIndex(key: string, url: string): void {
    if (!this.indexMap.has(key)) {
      this.indexMap.set(key, []);
    }
    this.indexMap.get(key)!.push(url);
  }

  /**
   * Match a batch of source URLs to target URLs
   */
  async matchBatch(
    sources: Array<{ url: string; data?: any }>,
    targets: string[],
    options: Partial<MatchOptions> = {}
  ): Promise<Map<string, MatchResult>> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    const results = new Map<string, MatchResult>();

    // Build index for fast lookups
    this.buildIndex(targets);

    for (const source of sources) {
      const match = await this.findBestMatch(source.url, targets, opts);

      if (match && match.confidence >= (opts.minConfidence || 0.7)) {
        results.set(source.url, match);
      }
    }

    return results;
  }

  /**
   * Find the best matching target URL for a source URL
   */
  private async findBestMatch(
    sourceUrl: string,
    targets: string[],
    options: MatchOptions
  ): Promise<MatchResult | null> {
    let bestMatch: MatchResult | null = null;
    let bestConfidence = 0;

    // Try exact match first
    const normalized = this.normalizeURL(sourceUrl, options);
    const exactMatches = this.indexMap.get(normalized) || [];

    if (exactMatches.length > 0) {
      return {
        sourceUrl,
        targetUrl: exactMatches[0],
        confidence: 1.0,
        matchType: 'exact',
        transformations: [],
      };
    }

    // Try path-based matching
    try {
      const sourceObj = new URL(normalized);
      const pathMatches = this.indexMap.get(sourceObj.pathname) || [];

      for (const target of pathMatches) {
        const confidence = this.fuzzyMatch(sourceUrl, target, options);
        if (confidence > bestConfidence) {
          bestConfidence = confidence;
          bestMatch = {
            sourceUrl,
            targetUrl: target,
            confidence,
            matchType: confidence > 0.95 ? 'normalized' : 'fuzzy',
            transformations: this.getTransformations(sourceUrl, target),
          };
        }
      }
    } catch {
      // Invalid URL, continue with fuzzy matching
    }

    // If no good match yet, try fuzzy matching against all targets
    if (bestConfidence < 0.9) {
      for (const target of targets) {
        const confidence = this.fuzzyMatch(sourceUrl, target, options);
        if (confidence > bestConfidence) {
          bestConfidence = confidence;
          bestMatch = {
            sourceUrl,
            targetUrl: target,
            confidence,
            matchType: 'fuzzy',
            transformations: this.getTransformations(sourceUrl, target),
          };
        }

        // Early exit if we find a very good match
        if (bestConfidence > 0.95) {
          break;
        }
      }
    }

    return bestMatch;
  }

  /**
   * Calculate similarity between two strings
   */
  private calculateSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 1;

    const maxLength = Math.max(str1.length, str2.length);
    if (maxLength === 0) return 1;

    const distance = levenshteinDistance(str1, str2);
    return 1 - distance / maxLength;
  }

  /**
   * Calculate similarity between two URL paths
   */
  private calculatePathSimilarity(path1: string, path2: string): number {
    const segments1 = path1.split('/').filter(Boolean);
    const segments2 = path2.split('/').filter(Boolean);

    if (segments1.length === 0 && segments2.length === 0) {
      return 1;
    }

    // Check segment overlap
    let matchingSegments = 0;
    const maxSegments = Math.max(segments1.length, segments2.length);

    for (let i = 0; i < Math.min(segments1.length, segments2.length); i++) {
      if (segments1[i] === segments2[i]) {
        matchingSegments++;
      } else {
        // Check if segments are similar (e.g., singular vs plural)
        const similarity = this.calculateSimilarity(segments1[i], segments2[i]);
        if (similarity > 0.8) {
          matchingSegments += similarity;
        }
      }
    }

    return matchingSegments / maxSegments;
  }

  /**
   * Calculate similarity between URL parameters
   */
  private calculateParamsSimilarity(params1: URLSearchParams, params2: URLSearchParams): number {
    const keys1 = new Set(params1.keys());
    const keys2 = new Set(params2.keys());

    if (keys1.size === 0 && keys2.size === 0) {
      return 1;
    }

    // Calculate Jaccard similarity of parameter keys
    const intersection = new Set([...keys1].filter((x) => keys2.has(x)));
    const union = new Set([...keys1, ...keys2]);

    if (union.size === 0) return 1;

    let similarity = intersection.size / union.size;

    // Bonus for matching values
    let valueMatches = 0;
    intersection.forEach((key) => {
      if (params1.get(key) === params2.get(key)) {
        valueMatches++;
      }
    });

    if (intersection.size > 0) {
      similarity = (similarity + valueMatches / intersection.size) / 2;
    }

    return similarity;
  }

  /**
   * Get list of transformations applied between URLs
   */
  private getTransformations(source: string, target: string): string[] {
    const transformations: string[] = [];

    try {
      const sourceObj = new URL(source);
      const targetObj = new URL(target);

      if (sourceObj.protocol !== targetObj.protocol) {
        transformations.push(`protocol: ${sourceObj.protocol} → ${targetObj.protocol}`);
      }

      if (sourceObj.hostname !== targetObj.hostname) {
        transformations.push(`hostname: ${sourceObj.hostname} → ${targetObj.hostname}`);
      }

      if (sourceObj.pathname !== targetObj.pathname) {
        transformations.push(`path: ${sourceObj.pathname} → ${targetObj.pathname}`);
      }

      if (sourceObj.search !== targetObj.search) {
        transformations.push('query parameters changed');
      }
    } catch {
      transformations.push('URL structure changed');
    }

    return transformations;
  }

  /**
   * Generate unmatched report
   */
  generateUnmatchedReport(
    sources: string[],
    targets: string[],
    matches: Map<string, MatchResult>
  ): UnmatchedReport {
    const matchedSources = new Set(matches.keys());
    const matchedTargets = new Set(Array.from(matches.values()).map((m) => m.targetUrl));

    const unmatchedSources = sources.filter((s) => !matchedSources.has(s));
    const unmatchedTargets = targets.filter((t) => !matchedTargets.has(t));

    const lowConfidenceMatches = Array.from(matches.values())
      .filter((m) => m.confidence < 0.8)
      .sort((a, b) => a.confidence - b.confidence);

    const confidences = Array.from(matches.values()).map((m) => m.confidence);
    const averageConfidence =
      confidences.length > 0 ? confidences.reduce((a, b) => a + b, 0) / confidences.length : 0;

    return {
      unmatchedSources,
      unmatchedTargets,
      lowConfidenceMatches,
      statistics: {
        totalSources: sources.length,
        totalTargets: targets.length,
        exactMatches: Array.from(matches.values()).filter((m) => m.matchType === 'exact').length,
        fuzzyMatches: Array.from(matches.values()).filter((m) => m.matchType === 'fuzzy').length,
        unmatchedCount: unmatchedSources.length,
        averageConfidence,
      },
    };
  }
}
```

### 2. Testing Suite

#### File: `lib/matching/url-matcher.test.ts`

```typescript
import { URLMatcher } from './url-matcher';

describe('URLMatcher', () => {
  let matcher: URLMatcher;

  beforeEach(() => {
    matcher = new URLMatcher();
  });

  describe('normalizeURL', () => {
    it('should normalize URLs consistently', () => {
      const urls = [
        'https://www.example.com/products/',
        'http://example.com/products',
        'HTTPS://WWW.EXAMPLE.COM/PRODUCTS/',
        'example.com/products/',
      ];

      const normalized = urls.map((url) => matcher.normalizeURL(url));
      const unique = new Set(normalized);

      expect(unique.size).toBe(1);
      expect(normalized[0]).toBe('https://example.com/products');
    });

    it('should handle query parameters', () => {
      const url1 = matcher.normalizeURL('https://example.com?b=2&a=1');
      const url2 = matcher.normalizeURL('https://example.com?a=1&b=2');

      expect(url1).toBe(url2); // Parameters should be sorted
    });

    it('should respect options', () => {
      const url = 'https://example.com/page?utm_source=google#section';

      const withParams = matcher.normalizeURL(url, { ignoreQueryParams: false });
      const withoutParams = matcher.normalizeURL(url, { ignoreQueryParams: true });

      expect(withParams).toContain('utm_source');
      expect(withoutParams).not.toContain('utm_source');
    });
  });

  describe('fuzzyMatch', () => {
    it('should return 1.0 for exact matches', () => {
      const confidence = matcher.fuzzyMatch(
        'https://example.com/products',
        'https://example.com/products'
      );

      expect(confidence).toBe(1.0);
    });

    it('should match URLs with different protocols', () => {
      const confidence = matcher.fuzzyMatch(
        'http://example.com/products',
        'https://example.com/products'
      );

      expect(confidence).toBeGreaterThan(0.9);
    });

    it('should match URLs with/without www', () => {
      const confidence = matcher.fuzzyMatch(
        'https://www.example.com/products',
        'https://example.com/products'
      );

      expect(confidence).toBeGreaterThan(0.9);
    });

    it('should match URLs with/without trailing slash', () => {
      const confidence = matcher.fuzzyMatch(
        'https://example.com/products/',
        'https://example.com/products'
      );

      expect(confidence).toBeGreaterThan(0.9);
    });

    it('should handle similar paths', () => {
      const confidence = matcher.fuzzyMatch(
        'https://example.com/product/winter-jacket',
        'https://example.com/products/winter-jackets'
      );

      expect(confidence).toBeGreaterThan(0.5);
      expect(confidence).toBeLessThan(0.8);
    });

    it('should return 0 for different domains when required', () => {
      const confidence = matcher.fuzzyMatch(
        'https://example.com/products',
        'https://other.com/products',
        { requireSameDomain: true }
      );

      expect(confidence).toBe(0);
    });
  });

  describe('matchBatch', () => {
    it('should match multiple URLs efficiently', async () => {
      const sources = [
        { url: 'https://www.example.com/products/' },
        { url: 'http://example.com/categories' },
        { url: 'https://example.com/about-us' },
      ];

      const targets = [
        'https://example.com/products',
        'https://example.com/categories',
        'https://example.com/about',
        'https://example.com/contact',
      ];

      const matches = await matcher.matchBatch(sources, targets);

      expect(matches.size).toBe(3);
      expect(matches.get('https://www.example.com/products/')?.targetUrl).toBe(
        'https://example.com/products'
      );
    });

    it('should respect minimum confidence', async () => {
      const sources = [{ url: 'https://example.com/completely-different' }];

      const targets = ['https://example.com/products'];

      const matches = await matcher.matchBatch(sources, targets, { minConfidence: 0.9 });

      expect(matches.size).toBe(0);
    });
  });

  describe('generateUnmatchedReport', () => {
    it('should generate comprehensive report', () => {
      const sources = [
        'https://example.com/page1',
        'https://example.com/page2',
        'https://example.com/page3',
      ];

      const targets = ['https://example.com/page1', 'https://example.com/different'];

      const matches = new Map([
        [
          'https://example.com/page1',
          {
            sourceUrl: 'https://example.com/page1',
            targetUrl: 'https://example.com/page1',
            confidence: 1.0,
            matchType: 'exact' as const,
            transformations: [],
          },
        ],
      ]);

      const report = matcher.generateUnmatchedReport(sources, targets, matches);

      expect(report.unmatchedSources).toContain('https://example.com/page2');
      expect(report.unmatchedSources).toContain('https://example.com/page3');
      expect(report.unmatchedTargets).toContain('https://example.com/different');
      expect(report.statistics.exactMatches).toBe(1);
      expect(report.statistics.unmatchedCount).toBe(2);
    });
  });

  describe('performance', () => {
    it('should handle 10,000 URLs efficiently', async () => {
      const sources = Array.from({ length: 1000 }, (_, i) => ({
        url: `https://example.com/product-${i}`,
      }));

      const targets = Array.from({ length: 10000 }, (_, i) => `https://example.com/product-${i}`);

      const start = Date.now();
      const matches = await matcher.matchBatch(sources, targets);
      const duration = Date.now() - start;

      expect(matches.size).toBe(1000);
      expect(duration).toBeLessThan(5000); // Should complete in 5 seconds
    });
  });
});
```

## Acceptance Criteria

- [ ] Normalizes URLs consistently (protocol, www, trailing slash, case)
- [ ] Fuzzy matching with confidence scoring (0-1)
- [ ] Handles URL variations across different systems
- [ ] O(1) lookup performance with index
- [ ] Processes 10,000 URLs in <5 seconds
- [ ] Match rate >85% on real data
- [ ] Generates detailed unmatched reports
- [ ] Handles edge cases (invalid URLs, special characters)
- [ ] Configurable matching options
- [ ] Unit test coverage >90%

## Implementation Steps

1. **Hour 1-2**: Core normalization logic
2. **Hour 3-4**: Fuzzy matching algorithm
3. **Hour 5**: Index building and batch matching
4. **Hour 6**: Optimization and performance tuning
5. **Hour 7**: Testing with real data
6. **Hour 8**: Documentation and edge cases

## Notes

- Consider caching normalized URLs for performance
- May need special handling for pagination URLs
- Could add ML-based matching in future
- Pattern matching for dynamic URLs (e.g., /product/[id])
