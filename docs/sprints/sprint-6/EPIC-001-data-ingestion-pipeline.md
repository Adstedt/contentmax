# EPIC-001: Real-World Data Ingestion Pipeline (v2)

## Epic Overview

**Epic ID:** EPIC-001  
**Epic Title:** Implement Real-World Data Ingestion Pipeline for E-commerce Taxonomy  
**Sprint:** Sprint 6 (and potentially Sprint 7)  
**Priority:** P0 - Critical  
**Estimated Total Effort:** 40-50 hours  
**Dependencies:** Architecture documentation complete, database schema ready  
**Version:** 2.0 - Prioritizes Product Feed over Sitemap

## Epic Summary

Transform ContentMax from a demo visualization to a production-ready system by implementing a complete data ingestion pipeline that connects real e-commerce data sources (primarily Google Merchant feeds, with sitemap as fallback) to the existing D3.js taxonomy visualization, enabling users to see and analyze their actual product hierarchies with performance metrics.

## Key Strategic Change

**Primary Data Source:** Google Merchant Product Feed (not sitemap)

- Product feeds provide structured taxonomy via `product_type` and `google_product_category` fields
- Rich product data available immediately (images, prices, attributes)
- URLs in feed reveal site structure without ambiguity
- Single source of truth for product catalog

## Business Value

- **Enable Real Data Visualization**: Move from demo to production-ready system
- **Immediate Rich Data**: Product feeds provide complete data from day one
- **Accurate Taxonomy**: Explicit category hierarchies from merchant feeds
- **Performance Metrics**: Integrate GSC/GA4 data for opportunity scoring
- **Foundation for AI Features**: Enable future AI-powered recommendations

## Success Criteria

1. ✅ Google Merchant OAuth flow working
2. ✅ Product feed successfully imports with categories and products
3. ✅ Taxonomy built from product_type/google_product_category fields
4. ✅ Visualization displays real products with images and prices
5. ✅ Metrics from GSC/GA4 are displayed on relevant nodes
6. ✅ Sitemap parser available as fallback option
7. ✅ System deploys successfully to production

## Technical Scope

### In Scope

- Google Merchant Center OAuth and feed processing (PRIMARY)
- Taxonomy extraction from product feed categories
- Product data model with full attributes
- Database population with real data
- Visualization connection to database
- Metrics integration (GSC/GA4)
- Sitemap parsing as fallback option
- Build error fixes and deployment readiness

### Out of Scope

- Shopify native integration (Sprint 7)
- Real-time feed updates (future enhancement)
- Multi-merchant support (future feature)
- Other platform integrations (WooCommerce, BigCommerce)

## Risk Mitigation

| Risk                       | Mitigation Strategy                              |
| -------------------------- | ------------------------------------------------ |
| Google OAuth complexity    | Detailed documentation, clear error messages     |
| Large feed processing      | Implement pagination and batch processing        |
| No Google Merchant account | Sitemap fallback ensures universal compatibility |
| API rate limits            | Implement caching and throttling                 |

## REVISED Stories Breakdown

### Phase 0: Foundation (UNCHANGED - Critical Blockers)

- **STORY-001**: Fix Build Blockers and TypeScript Errors (2 hours)
- **STORY-002**: Configure Google OAuth Credentials (2 hours)

### Phase 1: Google Merchant Integration (PRIMARY FLOW)

- **STORY-006**: Implement Google Merchant OAuth Flow (3 hours)
- **STORY-007**: Parse Google Product Feed (4 hours)
- **STORY-008**: Store Products with Full Attributes (3 hours)
- **STORY-004** (REVISED): Build Taxonomy from Product Feed Categories (3 hours)
- **STORY-005**: Connect Visualization to Database (2 hours)
- **STORY-009**: Display Product Cards with Real Data (3 hours)

### Phase 2: Metrics Integration (UNCHANGED)

- **STORY-010**: Integrate Google Search Console Metrics (3 hours)
- **STORY-011**: Integrate Google Analytics 4 Data (3 hours)
- **STORY-012**: Calculate Opportunity Scores (4 hours)

### Phase 3: Fallback & Alternative Ingestion

- **STORY-003** (REDUCED PRIORITY): Implement Sitemap Parser as Fallback (4 hours)
- **NEW-STORY-016**: Smart Platform Detection & Onboarding Flow (2 hours)

### Phase 4: Production Readiness (UNCHANGED)

- **STORY-013**: Add Error Recovery and Monitoring (3 hours)
- **STORY-014**: Implement Integration Tests (4 hours)
- **STORY-015**: Production Deployment Validation (3 hours)

## Critical Path (Sprint 6 Priority)

```
Day 1: Foundation
├── STORY-001: Fix build blockers ✅
└── STORY-002: Configure OAuth ✅

Days 2-3: Google Merchant Pipeline
├── STORY-006: OAuth flow ✅
├── STORY-007: Parse feed ✅
└── STORY-008: Store products ✅

Day 4: Visualization Integration
├── STORY-004: Build taxonomy from feed ✅
├── STORY-005: Connect to database ✅
└── STORY-009: Display products ✅

Day 5: Metrics & Polish
├── STORY-010: Search Console ✅
├── STORY-011: GA4 ✅
└── STORY-012: Scoring ✅

Sprint 6 Extension: World-Class UX
└── STORY-013: World-class import UX 🆕

Sprint 7: Robustness & Scaling
├── STORY-003: Sitemap fallback
├── STORY-014: Error recovery
├── STORY-015: Integration tests
└── STORY-016: Production validation
```

## Onboarding Flow Design

### Primary Path (Google Merchant)

1. User enters website URL
2. System detects if Google Merchant is available
3. User authenticates with Google OAuth
4. System fetches product feed
5. Taxonomy auto-generated from product categories
6. Full visualization with products ready

### Fallback Path (No Merchant Feed)

1. User enters website URL
2. System detects no merchant feed available
3. Prompt: "Import via sitemap for basic structure"
4. Parse sitemap for URL patterns
5. Build basic taxonomy (no product data initially)
6. Suggest: "Connect Google Merchant for full data"

## Data Quality Tiers

| Source                | Data Quality         | Features Available                                    |
| --------------------- | -------------------- | ----------------------------------------------------- |
| Google Merchant       | ⭐⭐⭐⭐⭐ Excellent | Full products, images, prices, categories, attributes |
| Shopify API (future)  | ⭐⭐⭐⭐⭐ Excellent | Native integration, real-time updates                 |
| Sitemap + Public APIs | ⭐⭐ Basic           | URL structure, basic categories, limited enrichment   |
| Sitemap Only          | ⭐ Minimal           | URL patterns, inferred structure                      |

## Definition of Done

- [ ] Google Merchant integration fully functional
- [ ] Product feed parsing handles 10,000+ products
- [ ] Taxonomy accurately reflects merchant categories
- [ ] Product cards show real data
- [ ] Metrics integrated and displaying
- [ ] Fallback options documented
- [ ] All tests passing
- [ ] Documentation updated
- [ ] Successfully deployed to production

## Key Technical Decisions

1. **Product Feed First**: Use merchant feeds as primary truth source
2. **Category Extraction**: Parse both `product_type` and `google_product_category`
3. **URL Analysis**: Use product URLs to understand site structure
4. **Hybrid Approach**: Keep sitemap for discovery of non-product pages
5. **Progressive Enhancement**: Start with feed, enrich with metrics

## Notes for Development Team

- Focus on Google Merchant integration first (80% of effort)
- Sitemap parser is a fallback, not primary flow
- Product feed categories are the source of truth for taxonomy
- Test with real merchant accounts early
- Ensure OAuth flow is smooth and well-documented

---

**Created:** 2025-01-09  
**Updated:** 2025-01-09 (v2 - Product Feed Prioritization)  
**Author:** Sarah (Product Owner)  
**Status:** Ready for Sprint 6 Development
