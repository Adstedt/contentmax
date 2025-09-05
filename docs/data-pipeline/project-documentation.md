# ContentMax Brownfield Architecture Document

## Introduction

This document captures the CURRENT STATE of the ContentMax codebase, including technical debt, workarounds, and real-world patterns. It serves as a reference for AI agents working on the data ingestion pipeline enhancement.

### Document Scope

Focused on areas relevant to: **Implementing real-world data ingestion from Google Merchant feeds, sitemaps, and metrics APIs to populate the taxonomy visualization with actual e-commerce data**

### Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2025-01-09 | 1.0 | Initial brownfield analysis for data pipeline | Winston (Architect) |

## Quick Reference - Key Files and Entry Points

### Critical Files for Understanding the System

- **Main Entry**: `app/layout.tsx` - Root layout with error boundaries
- **Configuration**: `.env.local`, `next.config.js` 
- **Core Business Logic**: `lib/services/`, `lib/parsers/`
- **API Definitions**: `app/api/*/route.ts` files
- **Database Models**: `supabase/migrations/*.sql`, `types/database.types.ts`
- **Visualization Core**: `components/taxonomy/D3Visualization/`

### Data Pipeline Impact Areas

Files that need enhancement for real data ingestion:
- `app/api/feeds/google-merchant/route.ts` - Incomplete implementation
- `app/api/import/sitemap/route.ts` - Needs connection to taxonomy builder
- `lib/parsers/product-feed-parser.ts` - Parser exists but unused
- `lib/services/product-sync-service.ts` - Service scaffolding only
- `components/taxonomy/TaxonomyVisualization.tsx` - Currently uses demo data

## High Level Architecture

### Technical Summary

ContentMax is a Next.js 15 monolithic application using App Router, deployed on Vercel with Supabase backend. Currently has a working visualization layer but lacks real data connections.

### Actual Tech Stack (from package.json)

| Category | Technology | Version | Notes |
|----------|------------|---------|-------|
| Runtime | Node.js | 20.0.0+ | Required minimum |
| Framework | Next.js | 15.5.1 | App Router, not Pages |
| UI Library | Shadcn/UI | Latest | Copy-paste components |
| Database | PostgreSQL | 15 | Via Supabase |
| Visualization | D3.js | 7.9.0 | Force-directed graph |
| Auth | Supabase Auth | 2.56.0 | Integrated |
| Monitoring | Sentry | 10.10.0 | Recently added |
| Analytics | Vercel Analytics | 1.5.0 | Installed |
| Testing | Jest | 30.1.1 | Limited coverage |

### Repository Structure Reality Check

- Type: Monolithic Next.js app
- Package Manager: npm (not pnpm despite docs)
- Notable: No monorepo setup, single package.json

## Source Tree and Module Organization

### Project Structure (Actual)

```text
contentmachine/
├── app/                    # Next.js App Router
│   ├── api/               # API routes (many incomplete)
│   │   ├── feeds/         # Google Merchant (scaffolding)
│   │   ├── import/        # Sitemap/batch import (partial)
│   │   ├── insights/      # Missing auth module
│   │   └── monitoring/    # New, working
│   ├── dashboard/         # Main app pages
│   │   └── taxonomy/      # Visualization page
│   └── import/           # Import UI (exists)
├── components/            
│   ├── taxonomy/          # Visualization components
│   │   ├── D3Visualization/ # Core viz (WORKING)
│   │   └── EnhancedTaxonomyVisualization.tsx
│   └── shared/           # Error boundaries (new)
├── lib/
│   ├── parsers/          # Feed parsers (UNUSED)
│   ├── services/         # Business logic (INCOMPLETE)
│   ├── supabase/         # DB clients (working)
│   └── security/         # New security utils
├── supabase/
│   └── migrations/       # Schema definitions
│       └── 009_node_centric_model.sql # Latest
└── tests/                # Minimal coverage
```

### Key Modules and Their Current State

- **Taxonomy Visualization**: `components/taxonomy/` - WORKING with demo data
- **Feed Parser**: `lib/parsers/product-feed-parser.ts` - EXISTS but not connected
- **Google Merchant API**: `app/api/feeds/google-merchant/` - Scaffolding only
- **Import Service**: `lib/services/ImportService.ts` - Partial implementation
- **Database**: Schema ready in `009_node_centric_model.sql` but empty

## Data Models and APIs

### Data Models

Database schema exists and is well-designed:

- **taxonomy_nodes**: Ready for category hierarchy
- **products**: Table exists but empty
- **node_metrics**: Ready for GSC/GA4 data
- **opportunities**: Scoring table ready

See `supabase/migrations/009_node_centric_model.sql` for complete schema.

### API Endpoints Status

| Endpoint | Status | Issue |
|----------|--------|-------|
| `/api/feeds/google-merchant` | Scaffold | No OAuth, no parsing |
| `/api/import/sitemap` | Partial | Doesn't build taxonomy |
| `/api/import/batch` | Broken | Missing ImportProgressTracker |
| `/api/insights/*` | Broken | Missing auth/session module |
| `/api/integrations/google/*` | Partial | OAuth flow incomplete |

## Technical Debt and Known Issues

### Critical Technical Debt

1. **Demo Data Hardcoded**: `app/dashboard/taxonomy/page.tsx` generates fake data (line 8-118)
2. **Missing Auth Module**: `lib/auth/session.ts` doesn't exist, breaking insights APIs
3. **Unused Parsers**: Feed parsing code exists but isn't wired up
4. **Type Errors**: Multiple TypeScript errors in API routes
5. **No Real Data Flow**: Complete disconnect between data sources and visualization

### Workarounds and Gotchas

- **Demo Data**: Taxonomy page uses `generateDemoData(150)` instead of real data
- **Missing Imports**: Several APIs import non-existent modules
- **Async Handling**: Many routes use outdated Next.js patterns
- **Environment Variables**: Google API credentials not configured

## Integration Points and External Dependencies

### External Services (Configured but Not Connected)

| Service | Purpose | Integration Status | Key Files |
|---------|---------|-------------------|-----------|
| Google Merchant | Product feed | OAuth incomplete | `app/api/feeds/google-merchant/` |
| Google Search Console | Metrics | API exists, not called | `app/api/integrations/google/gsc-data/` |
| Google Analytics 4 | Revenue data | Partial setup | `app/api/analytics/ga4/` |
| Supabase | Database/Auth | Working | `lib/supabase/` |

### Internal Integration Gaps

- **Feed → Database**: Parser exists but doesn't save to DB
- **Database → Visualization**: Viz reads demo data, not DB
- **Metrics → Nodes**: Metrics tables empty, no sync jobs

## Development and Deployment

### Local Development Setup (What Actually Works)

```bash
# 1. Install dependencies
npm install  # NOT pnpm as docs suggest

# 2. Start Supabase (requires Docker)
npx supabase start  # Works if Docker running

# 3. Set environment variables
# Copy .env.example to .env.local
# Add Supabase keys from local instance
# Google API keys NOT configured

# 4. Run dev server
npm run dev  # Currently running on port 3000
```

### Known Setup Issues

- Supabase local requires Docker Desktop running
- Google OAuth not configured (no client ID/secret)
- Build has TypeScript errors but runs in dev
- Sentry warnings about deprecated config

### Build and Deployment Process

- **Build Command**: `npm run build` (currently fails)
- **Deployment**: Vercel auto-deploy from main branch
- **CI/CD**: GitHub Actions configured but allows failures

## Testing Reality

### Current Test Coverage

- Unit Tests: <10% coverage
- Integration Tests: None for data pipeline
- E2E Tests: Playwright configured but no tests
- Manual Testing: Primary method

### Test Files That Exist

```
tests/
├── migrations/009_node_centric_model.test.ts  # DB test
├── unit/lib/  # Some utility tests
└── test-*.js  # Manual test scripts
```

## Data Pipeline Implementation Plan

### Files That Need Modification

Based on requirements for real data ingestion:

1. **Sitemap Import** (Simplest Start)
   - `app/api/import/sitemap/route.ts` - Parse URLs to categories
   - Create new: `lib/taxonomy/sitemap-parser.ts`
   - Create new: `lib/taxonomy/hierarchy-builder.ts`

2. **Google Merchant Feed**
   - `app/api/feeds/google-merchant/route.ts` - Complete implementation
   - `lib/parsers/product-feed-parser.ts` - Wire up existing parser
   - Create new: `lib/integrations/google-merchant-client.ts`

3. **Connect to Visualization**
   - `app/dashboard/taxonomy/page.tsx` - Replace demo data with DB query
   - Create new: `lib/services/taxonomy-service.ts`

### New Files/Modules Needed

```typescript
// lib/taxonomy/sitemap-parser.ts
export class SitemapParser {
  parseToCategories(xml: string): Category[]
  extractHierarchy(urls: string[]): Node[]
}

// lib/taxonomy/hierarchy-builder.ts  
export class HierarchyBuilder {
  buildFromUrls(urls: string[]): TaxonomyNode[]
  mergeGoogleCategories(products: Product[]): void
}

// lib/services/taxonomy-service.ts
export class TaxonomyService {
  async getTreeData(): Promise<VisualizationData>
  async syncFromSitemap(url: string): Promise<void>
}
```

### Integration Considerations

- Must preserve existing visualization component interfaces
- Use existing Supabase client setup in `lib/supabase/`
- Follow existing API route patterns (NextRequest/NextResponse)
- Maintain TypeScript types in `types/` directory

## Current Blockers

1. **No Google OAuth Setup**: Need client ID/secret for Merchant Center
2. **Missing Auth Module**: `lib/auth/session.ts` needs creation
3. **Build Failures**: TypeScript errors prevent production build
4. **Empty Database**: No seed data or import mechanism

## Recommended Next Steps

1. **Fix Build Issues**
   - Create missing `lib/auth/session.ts`
   - Fix TypeScript errors in API routes

2. **Implement Sitemap Import** (Quickest to value)
   - Complete `/api/import/sitemap` endpoint
   - Parse URLs into taxonomy structure
   - Save to database
   - Test with real sitemap

3. **Connect Visualization to Database**
   - Replace demo data generator
   - Query real taxonomy_nodes table
   - Test visualization with real structure

4. **Add Google Merchant Feed**
   - Set up OAuth credentials
   - Complete feed fetching
   - Parse products and categories
   - Populate products table

## Appendix - Useful Commands and Scripts

### Frequently Used Commands

```bash
npm run dev         # Start development server
npm run build       # Production build (currently fails)
npm run lint        # Run ESLint (827 warnings)
npm run type-check  # TypeScript check (fails)
npm test           # Run tests (limited)

# Supabase
npx supabase start  # Start local Supabase
npx supabase stop   # Stop local Supabase
npx supabase db reset # Reset database
```

### Debugging and Troubleshooting

- **Logs**: Check browser console for client errors
- **API Errors**: Network tab shows API failures
- **Database**: Supabase Studio at http://localhost:54323
- **Type Errors**: Run `npm run type-check` to see all issues

### Environment Variables Required

```bash
# Supabase (local)
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=[from supabase start output]
SUPABASE_SERVICE_ROLE_KEY=[from supabase start output]

# Google APIs (not configured)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_MERCHANT_ID=

# OpenAI (if needed)
OPENAI_API_KEY=

# Monitoring (optional)
NEXT_PUBLIC_SENTRY_DSN=
```

## Summary

ContentMax has a solid visualization layer and database schema but lacks the critical data pipeline to connect real e-commerce data to the visualization. The immediate priority should be implementing the simplest data source (sitemap) to validate the full flow, then adding richer data sources like Google Merchant feeds.