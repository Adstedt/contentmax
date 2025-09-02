# Sprint 2: Data Ingestion & Processing

## Sprint Goal

Build comprehensive data ingestion pipeline for sitemaps, content scraping, and Google Search Console integration.

## Duration

2 weeks

## Sprint Overview

This sprint focuses on creating the data foundation by building robust systems to ingest website sitemaps, scrape content with proper rate limiting, and integrate with Google Search Console for performance metrics.

---

## Tasks

### Task 2.1: Sitemap Parser

**Size**: M (6 hours) | **Priority**: P0 - Critical | **Dependencies**: Sprint 1 complete

**Implementation Steps**:

1. Build XML sitemap parser with validation
2. Create URL categorization logic
3. Implement sitemap index support for large sites
4. Add error handling for malformed sitemaps

```typescript
// Core parsing functionality
interface SitemapEntry {
  url: string;
  lastmod?: string;
  changefreq?: string;
  priority?: number;
  category?: ContentCategory;
}
```

**Files to Create**:

- `lib/ingestion/sitemap-parser.ts` - Core XML parsing logic
- `lib/ingestion/url-categorizer.ts` - URL pattern classification
- `api/ingestion/sitemap/route.ts` - API endpoint for sitemap processing
- `types/sitemap.types.ts` - TypeScript interfaces

**Technical Requirements**:

- Support both sitemap.xml and sitemap index files
- Handle large sitemaps (>50k URLs) with streaming
- Validate XML structure and URL formats
- Categorize URLs by content type (product, category, blog, etc.)

**Acceptance Criteria**:

- [ ] Can parse standard XML sitemaps
- [ ] Handles sitemap index files with multiple sitemaps
- [ ] URL categorization working for common e-commerce patterns
- [ ] Error handling for invalid XML or unreachable sitemaps
- [ ] Progress tracking for large sitemap processing

---

### Task 2.2: Content Scraper with Rate Limiting

**Size**: L (8 hours) | **Priority**: P0 - Critical | **Dependencies**: Task 2.1

**Implementation Steps**:

1. Build web scraper using Playwright/Puppeteer
2. Implement sophisticated rate limiting system
3. Add robots.txt compliance checking
4. Create content analysis and structure detection

```typescript
// Rate limiting configuration
interface ScrapingConfig {
  maxConcurrency: number;
  delayBetweenRequests: number;
  respectRobotsTxt: boolean;
  timeout: number;
  userAgent: string;
}
```

**Files to Create**:

- `lib/scraping/scraper.ts` - Core scraping engine
- `lib/scraping/rate-limiter.ts` - Rate limiting implementation
- `lib/scraping/content-analyzer.ts` - Content structure analysis
- `lib/queue/scraping-queue.ts` - Queue management for scraping jobs
- `supabase/functions/scrape-content/index.ts` - Serverless scraping function

**Technical Requirements**:

- Respect robots.txt files automatically
- Implement exponential backoff for failed requests
- Extract structured data (headings, images, links, text)
- Handle JavaScript-rendered content
- Store raw HTML and processed content separately

**Acceptance Criteria**:

- [ ] Can scrape content from provided URLs
- [ ] Rate limiting prevents overwhelming target servers
- [ ] Robots.txt compliance verified before scraping
- [ ] Content analysis extracts headings, links, and text structure
- [ ] Queue system handles batch scraping jobs
- [ ] Error handling for timeouts, 404s, and blocked requests

---

### Task 2.3: Google Search Console Integration

**Size**: M (6 hours) | **Priority**: P1 - High | **Dependencies**: Sprint 1 complete

**Implementation Steps**:

1. Set up Google Search Console API integration
2. Implement OAuth flow for user authorization
3. Create data fetching for clicks, impressions, position
4. Build settings UI for integration management

**Files to Create**:

- `lib/integrations/search-console.ts` - GSC API client
- `app/settings/integrations/page.tsx` - Integration settings page
- `api/integrations/google/callback/route.ts` - OAuth callback handler

**API Data to Fetch**:

- Search performance data (clicks, impressions, CTR, position)
- Top queries and pages
- Coverage issues and index status
- Core Web Vitals data

**Technical Requirements**:

- Handle Google OAuth 2.0 flow securely
- Store refresh tokens encrypted in database
- Implement rate limiting for GSC API calls
- Cache API responses to avoid quota limits

**Acceptance Criteria**:

- [ ] Users can connect their Google Search Console account
- [ ] API fetches search performance data for connected properties
- [ ] Data is stored and associated with correct projects
- [ ] Integration settings allow disconnecting/reconnecting
- [ ] Error handling for API quota limits and auth failures

---

### Task 2.4: Data Processing Pipeline

**Size**: L (8 hours) | **Priority**: P0 - Critical | **Dependencies**: Task 2.2

**Implementation Steps**:

1. Build taxonomy hierarchy from scraped content
2. Create materialized views for performance
3. Implement content similarity detection
4. Build processing queue with retry logic

```sql
-- Example materialized view for taxonomy performance
CREATE MATERIALIZED VIEW taxonomy_hierarchy AS
SELECT
  parent_id,
  child_id,
  depth,
  path
FROM build_hierarchy_recursive(taxonomy_nodes);
```

**Files to Create**:

- `lib/processing/taxonomy-builder.ts` - Build content hierarchy
- `lib/processing/hierarchy-analyzer.ts` - Analyze content relationships
- `supabase/functions/process-taxonomy/index.ts` - Processing function
- `supabase/migrations/002_materialized_views.sql` - Performance views

**Processing Logic**:

- Detect parent-child relationships from URL structure
- Identify content gaps in taxonomy
- Calculate content similarity scores
- Generate category suggestions

**Acceptance Criteria**:

- [ ] Scraped content processed into hierarchical taxonomy
- [ ] Content gaps identified and flagged
- [ ] Similar content grouped and deduplicated
- [ ] Processing handles large datasets (10k+ pages)
- [ ] Materialized views improve query performance
- [ ] Queue system processes jobs reliably with retries

---

### Task 2.5: CI/CD Pipeline Setup

**Size**: M (4 hours) | **Priority**: P0 - Critical | **Dependencies**: Sprint 1 complete

**Implementation Steps**:

1. Set up GitHub Actions workflow for automated testing
2. Configure build and type checking pipeline
3. Implement branch protection rules
4. Add automated deployment to Vercel preview environments

**Files to Create**:

- `.github/workflows/ci.yml` - Main CI workflow
- `.github/workflows/preview.yml` - Preview deployment workflow
- `.github/dependabot.yml` - Dependency updates configuration

**CI/CD Configuration**:

```yaml
# Basic CI workflow structure
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run lint
      - run: npm run type-check
      - run: npm run test
```

**Acceptance Criteria**:

- [ ] Tests run automatically on every push/PR
- [ ] TypeScript type checking prevents type errors
- [ ] Linting enforces code quality standards
- [ ] Preview deployments created for PRs
- [ ] Build failures block merging to main
- [ ] Test results visible in PR interface

---

### Task 2.6: Import UI & Progress Tracking

**Size**: M (4 hours) | **Priority**: P1 - High | **Dependencies**: Tasks 2.1-2.4

**Implementation Steps**:

1. Create multi-step import wizard
2. Implement real-time progress tracking
3. Add error reporting and retry mechanisms
4. Build import history and status dashboard

**Files to Create**:

- `app/import/page.tsx` - Main import interface
- `components/import/ImportWizard.tsx` - Step-by-step wizard
- `components/import/ProgressTracker.tsx` - Real-time progress display
- `hooks/useImportProgress.ts` - Progress tracking hook

**Wizard Steps**:

1. **Sitemap Input**: URL entry and validation
2. **Configuration**: Scraping settings and rate limits
3. **Processing**: Real-time progress of scraping and analysis
4. **Review**: Summary of imported content and taxonomy

**Acceptance Criteria**:

- [ ] Wizard guides users through complete import process
- [ ] Real-time progress updates during scraping and processing
- [ ] Error states clearly communicated with retry options
- [ ] Import history shows previous imports and their status
- [ ] Users can configure scraping parameters per import
- [ ] Cancel functionality works during long-running imports

---

## Dependencies & Prerequisites

**External Dependencies**:

- Google Search Console API access and credentials
- Target websites must have accessible sitemaps
- Sufficient server resources for concurrent scraping

**Technical Prerequisites**:

- Sprint 1 authentication and database setup complete
- Playwright/Puppeteer properly configured
- Supabase Edge Functions deployed and working
- Queue system (Redis or Supabase) configured

---

## Definition of Done

**Sprint 2 is complete when**:

- [ ] Users can import sitemaps and see parsed URL list
- [ ] Content scraping works with proper rate limiting
- [ ] Google Search Console integration fetches real data
- [ ] Scraped content is processed into hierarchical taxonomy
- [ ] Import UI provides clear progress feedback and error handling
- [ ] System handles edge cases (large sites, blocked content, API limits)

**Demo Criteria**:

- Import a real e-commerce sitemap (500+ URLs)
- Show content scraping with rate limiting in action
- Display Google Search Console data integration
- Demonstrate taxonomy hierarchy generation
- Show error handling and retry mechanisms

---

## Technical Warnings

⚠️ **Critical Considerations**:

- **Rate Limiting**: Too aggressive scraping can get IP addresses blocked
- **Memory Usage**: Large sitemaps (50k+ URLs) require streaming processing
- **API Quotas**: Google Search Console has daily/hourly limits
- **Robots.txt**: Must respect all directives to avoid legal issues

⚠️ **Performance Concerns**:

- Implement circuit breakers for unreliable target sites
- Use database connection pooling for concurrent operations
- Monitor queue depths to prevent overwhelming the system
- Consider using CDN/proxy for scraping to distribute load

⚠️ **Security Considerations**:

- Validate all scraped content before storage
- Sanitize HTML to prevent XSS in admin interface
- Encrypt stored OAuth tokens
- Implement request signing for internal API calls

---

## Success Metrics

- **Scraping Success Rate**: >90% for accessible URLs
- **Processing Speed**: 100 URLs processed per minute
- **Error Recovery**: <5% permanent failures after retries
- **API Integration**: Google Search Console data refreshes within 24 hours
- **User Experience**: Import completion rate >85% for initiated imports

---

## Risk Mitigation

**High-Risk Items**:

1. **Target Site Blocking**: Implement rotating user agents and IP addresses
2. **API Rate Limits**: Build comprehensive caching and request queuing
3. **Large Dataset Processing**: Use streaming and batch processing patterns
4. **Memory Leaks**: Monitor memory usage during long-running operations

**Contingency Plans**:

- Fallback to manual content upload if scraping fails
- Alternative data sources if Google Search Console unavailable
- Simplified taxonomy if automatic hierarchy detection fails
