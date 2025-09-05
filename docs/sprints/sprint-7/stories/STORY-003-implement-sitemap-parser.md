# STORY-003: Implement Sitemap Parser (Fallback Option)

## Story Overview

**Story ID:** STORY-003  
**Epic:** EPIC-001 - Data Ingestion Pipeline  
**Sprint:** Sprint 7 (moved from Sprint 6)  
**Priority:** P2 - Medium (Fallback mechanism)  
**Estimated Effort:** 4 hours  
**Story Points:** 3  
**Note:** This is a fallback option for users without Google Merchant access  

## User Story

As a **site owner**,  
I want **to import my site structure from sitemap.xml**,  
So that **I can visualize my site's taxonomy hierarchy automatically**.

## Context

Sitemap.xml serves as a universal fallback option for stores that don't have Google Merchant Center or other product feed integrations. While it provides less rich data than product feeds, it ensures all users can import their site structure. This is particularly useful for smaller stores or those not advertising on Google.

## Acceptance Criteria

### Functional Requirements
1. ✅ Parse standard sitemap.xml format
2. ✅ Handle sitemap index files (multiple sitemaps)
3. ✅ Extract URLs with priority and lastmod
4. ✅ Support both gzipped and plain XML
5. ✅ Handle large sitemaps (>10,000 URLs)

### Technical Requirements
6. ✅ URL pattern analysis to detect categories
7. ✅ Hierarchy extraction from URL paths
8. ✅ Product URL identification
9. ✅ Validation of sitemap format
10. ✅ Progress tracking for large imports

### Performance Requirements
11. ✅ Stream processing for large files
12. ✅ Batch processing in chunks of 100
13. ✅ Memory efficient parsing
14. ✅ Timeout handling (max 30 seconds)

## Technical Implementation Notes

### Create New Parser Module
```typescript
// lib/parsers/sitemap-parser.ts
import { XMLParser } from 'fast-xml-parser';

export interface SitemapEntry {
  loc: string;
  lastmod?: string;
  priority?: number;
  changefreq?: string;
}

export interface ParsedCategory {
  url: string;
  title: string;
  depth: number;
  parent?: string;
  isProduct: boolean;
}

export class SitemapParser {
  private xmlParser: XMLParser;
  
  constructor() {
    this.xmlParser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_'
    });
  }
  
  async parseSitemap(url: string): Promise<SitemapEntry[]> {
    // Fetch and parse sitemap
  }
  
  async parseSitemapContent(xml: string): Promise<SitemapEntry[]> {
    // Parse XML content
  }
  
  extractHierarchy(urls: SitemapEntry[]): ParsedCategory[] {
    // Analyze URLs to build hierarchy
  }
  
  private detectProductUrl(url: string): boolean {
    // Patterns to identify product pages
    return /\/(product|item|p|pd|sku)\/|\.html?$|\d{3,}/.test(url);
  }
  
  private extractCategoryFromUrl(url: string): string[] {
    // Extract path segments as categories
    const path = new URL(url).pathname;
    return path.split('/').filter(Boolean);
  }
}
```

### API Route Implementation
```typescript
// app/api/import/sitemap/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { SitemapParser } from '@/lib/parsers/sitemap-parser';
import { TaxonomyBuilder } from '@/lib/taxonomy/hierarchy-builder';

export async function POST(request: NextRequest) {
  const { sitemapUrl } = await request.json();
  
  const parser = new SitemapParser();
  const builder = new TaxonomyBuilder();
  
  // Parse sitemap
  const entries = await parser.parseSitemap(sitemapUrl);
  
  // Extract hierarchy
  const categories = parser.extractHierarchy(entries);
  
  // Build taxonomy nodes
  const nodes = await builder.buildFromCategories(categories);
  
  return NextResponse.json({
    success: true,
    stats: {
      urlsParsed: entries.length,
      categoriesFound: categories.length,
      nodesCreated: nodes.length
    }
  });
}
```

### URL Pattern Analysis
```typescript
// Common e-commerce URL patterns to detect
const patterns = {
  category: /\/(category|categories|c|cat)\//,
  product: /\/(product|products|p|item|sku)\//,
  brand: /\/(brand|brands|manufacturer)\//,
  collection: /\/(collection|collections|sale|deals)\//
};
```

## Dependencies

- Requires STORY-001 completion (build fixes)
- Uses existing database schema
- fast-xml-parser package (already installed)

## Testing Requirements

### Unit Tests
```typescript
describe('SitemapParser', () => {
  it('parses standard sitemap XML');
  it('handles sitemap index files');
  it('extracts URL hierarchy correctly');
  it('identifies product URLs');
  it('handles malformed XML gracefully');
});
```

### Integration Tests
- Test with real sitemap URLs
- Test with various e-commerce platforms
- Test error handling for invalid URLs
- Test timeout handling

### Test Data
```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/category/electronics</loc>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://example.com/category/electronics/phones</loc>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://example.com/product/iphone-15</loc>
    <priority>0.6</priority>
  </url>
</urlset>
```

## Definition of Done

- [ ] Parser module created and tested
- [ ] API endpoint implemented
- [ ] URL hierarchy extraction working
- [ ] Product detection accurate
- [ ] Large sitemap handling tested
- [ ] Unit tests passing
- [ ] Integration test with real sitemap
- [ ] Error handling comprehensive
- [ ] Documentation updated

## Dev Agent Record

### Agent Model Used
_To be filled by implementing agent_

### Debug Log References
_To be filled during implementation_

### Completion Notes
_To be filled after implementation_

### File List
- `lib/parsers/sitemap-parser.ts` (new)
- `lib/parsers/sitemap-parser.test.ts` (new)
- `app/api/import/sitemap/route.ts` (modified)
- `types/sitemap.types.ts` (new)

---
**Created:** 2025-01-09  
**Status:** Ready for Development  
**Assigned:** Unassigned