# Story 2.2: Sitemap Parser

## Status: COMPLETED ✅

## User Story

As a content manager,
I want to import my website's sitemap,
So that I can analyze all pages and identify content gaps.

## Size & Priority

- **Size**: M (6 hours)
- **Priority**: P0 - Critical
- **Sprint**: 2
- **Dependencies**: Sprint 1 complete

## Description

Implement sitemap XML parsing with support for both standard sitemaps and sitemap index files, categorizing URLs by content type.

## Implementation Steps

1. **Build XML parsing engine**

   ```typescript
   import { XMLParser } from 'fast-xml-parser';

   interface SitemapEntry {
     url: string;
     lastmod?: string;
     changefreq?: string;
     priority?: number;
     category?: ContentCategory;
   }

   class SitemapParser {
     async parse(xml: string): Promise<SitemapEntry[]> {
       // Parse XML and extract URLs
       // Handle both sitemap and sitemap index
     }
   }
   ```

2. **Implement URL categorization**

   ```typescript
   enum ContentCategory {
     PRODUCT = 'product',
     CATEGORY = 'category',
     BRAND = 'brand',
     BLOG = 'blog',
     OTHER = 'other',
   }

   function categorizeUrl(url: string): ContentCategory {
     // Pattern matching for common e-commerce URL structures
     if (url.includes('/product/')) return ContentCategory.PRODUCT;
     if (url.includes('/category/')) return ContentCategory.CATEGORY;
     // etc...
   }
   ```

3. **Handle sitemap index files**
   - Detect sitemap index format
   - Recursively fetch and parse child sitemaps
   - Aggregate results from multiple sitemaps

4. **Add streaming support for large files**
   - Use stream parsing for 50k+ URL sitemaps
   - Implement progress tracking
   - Batch database inserts

5. **Create API endpoint**

   ```typescript
   // app/api/ingestion/sitemap/route.ts
   export async function POST(request: Request) {
     const { sitemapUrl } = await request.json();

     // Fetch sitemap
     // Parse XML
     // Categorize URLs
     // Store in database
     // Return summary
   }
   ```

## Files to Create

- `lib/ingestion/sitemap-parser.ts` - Core XML parsing logic
- `lib/ingestion/url-categorizer.ts` - URL pattern classification
- `lib/ingestion/sitemap-fetcher.ts` - Fetch sitemaps with retries
- `app/api/ingestion/sitemap/route.ts` - API endpoint
- `types/sitemap.types.ts` - TypeScript interfaces
- `tests/sitemap-parser.test.ts` - Unit tests

## URL Pattern Recognition

```typescript
const patterns = {
  product: [/\/product\//, /\/p\//, /\/item\//, /\/pd\//],
  category: [/\/category\//, /\/c\//, /\/collections?\//, /\/shop\//],
  brand: [/\/brand\//, /\/manufacturer\//, /\/designer\//],
};
```

## Error Handling

- **Invalid XML**: Return clear error with line number
- **Network timeout**: Retry with exponential backoff
- **Large file**: Switch to streaming mode automatically
- **Malformed URLs**: Skip and log, don't fail entire import
- **Rate limiting**: Respect server delays

## Acceptance Criteria

- [ ] Can parse standard XML sitemaps
- [ ] Handles sitemap index files with multiple sitemaps
- [ ] URL categorization working for common patterns
- [ ] Handles large sitemaps (>50k URLs) without memory issues
- [ ] Progress tracking for long-running imports
- [ ] Error handling for invalid XML or unreachable sitemaps
- [ ] Validation of sitemap format against schema
- [ ] Database storage of parsed entries

## Performance Requirements

- Parse 10,000 URLs in <5 seconds
- Stream processing for files >10MB
- Memory usage <200MB for large files
- Support gzip compressed sitemaps

## Database Schema

```sql
CREATE TABLE sitemap_entries (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects(id),
  url TEXT NOT NULL,
  category TEXT,
  last_modified TIMESTAMP,
  change_frequency TEXT,
  priority DECIMAL,
  imported_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(project_id, url)
);

CREATE INDEX idx_sitemap_category ON sitemap_entries(category);
CREATE INDEX idx_sitemap_project ON sitemap_entries(project_id);
```

## Testing Requirements

- [ ] Test with real sitemaps from major e-commerce sites
- [ ] Test sitemap index with 10+ child sitemaps
- [ ] Test malformed XML handling
- [ ] Test URL pattern recognition accuracy
- [ ] Test streaming with 100k+ URL sitemap
- [ ] Test compressed sitemap support

## Sample Test Data

```xml
<!-- Standard sitemap -->
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/category/electronics</loc>
    <lastmod>2024-01-26</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
</urlset>

<!-- Sitemap index -->
<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://example.com/sitemap-products.xml</loc>
    <lastmod>2024-01-26</lastmod>
  </sitemap>
</sitemapindex>
```

## Definition of Done

- [ ] Code complete and committed
- [ ] Parsing logic handles all sitemap formats
- [ ] URL categorization >90% accurate
- [ ] Performance requirements met
- [ ] Error handling comprehensive
- [ ] Tests written and passing
- [ ] API endpoint documented
- [ ] Peer review completed
