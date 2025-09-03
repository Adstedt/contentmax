# Story: URL Matching Algorithm - Brownfield Addition

## User Story

As a **data analyst**,  
I want **to accurately match URLs from different sources (GA4, GSC, Shopify) with my taxonomy nodes**,  
So that **metrics are correctly attributed to pages regardless of URL format variations**.

## Story Context

**Existing System Integration:**

- Integrates with: Metrics sync jobs, GA4 client, GSC client
- Technology: TypeScript, Levenshtein distance algorithm, URL parsing
- Follows pattern: Utility service pattern in `/lib/matching/`
- Touch points:
  - Taxonomy nodes URL matching
  - GA4 landing page path to URL conversion
  - GSC URL normalization
  - Shopify product URL matching

## Acceptance Criteria

**Functional Requirements:**

1. Normalize URLs consistently (protocol, www, trailing slashes, case)
2. Match exact URLs with 100% confidence
3. Match normalized URLs with 95% confidence
4. Fuzzy match similar URLs with confidence scoring (0-1)

**Integration Requirements:** 5. Handle different URL formats from GA4 (paths) vs GSC (full URLs) 6. Support batch matching for 1000+ URLs efficiently 7. Generate unmatched reports for debugging 8. Pattern matching for dynamic URLs (product IDs, categories)

**Quality Requirements:** 9. Match 95% of valid URLs correctly 10. Process 1000 URL matches in under 5 seconds 11. Configurable matching options (ignore params, case sensitivity) 12. No false positives above 70% confidence threshold

## Technical Notes

- **Integration Approach:** Standalone utility class with caching
- **Existing Pattern Reference:** Similar to existing string matching utilities
- **Key Constraints:**
  - Must handle malformed URLs gracefully
  - Memory efficient for large URL sets
  - Thread-safe for concurrent matching
  - Support incremental index building

## Definition of Done

- [x] URLMatcher class with normalization methods
- [x] Fuzzy matching with Levenshtein distance
- [x] Pattern matching for dynamic URLs
- [x] Batch matching with performance optimization
- [x] Confidence scoring algorithm
- [x] Tests with real-world URL variations

## Risk and Compatibility Check

**Minimal Risk Assessment:**

- **Primary Risk:** False positive matches could corrupt metrics
- **Mitigation:** Conservative confidence thresholds, manual review for low scores
- **Rollback:** Can revert to exact matching only

**Compatibility Verification:**

- [x] No breaking changes to existing APIs
- [x] Pure utility function, no database changes
- [x] Can run alongside existing exact matching
- [x] Performance impact negligible with caching

## Implementation Approach

Based on existing code, here's the specific implementation path:

1. **Create** `/lib/matching/url-matcher.ts` - Core matching logic
2. **Install** `fastest-levenshtein` package for string distance
3. **Implement** normalization with configurable options
4. **Add** fuzzy matching with component-wise comparison
5. **Create** pattern matching for common URL patterns
6. **Build** batch matching with indexing for performance

## Validation Checklist

**Scope Validation:**

- ✅ Story can be completed in one development session (4-8 hours)
- ✅ Pure algorithm implementation, no external dependencies
- ✅ Follows utility pattern from existing codebase
- ✅ No new architecture required

**Clarity Check:**

- ✅ Story requirements are unambiguous
- ✅ Matching rules clearly defined
- ✅ Success criteria are testable (95% accuracy)
- ✅ Edge cases documented (malformed URLs)

## Story Metadata

- **Created**: 2025-09-03
- **Sprint**: Sprint 2
- **Parent Task**: TASK-005-url-matching-algorithm
- **Estimated Effort**: 8 hours
- **Priority**: P0 - Blocker (required for accurate metrics)
- **Dependencies**:
  - None (standalone utility)
  - ⏳ Blocks accurate metrics sync

## Dev Agent Record

### Status

**Ready for Review**

### Tasks

- [x] Create URLMatcher class
- [x] Implement URL normalization
- [x] Add fuzzy matching with Levenshtein
- [x] Create pattern matching system
- [x] Build confidence scoring
- [x] Optimize batch matching
- [x] Create unmatched report generator
- [x] Write comprehensive tests

### Implementation Notes

- Use URL parsing for component comparison
- Cache normalized URLs for performance
- Consider phonetic matching for similar paths
- Support custom matching rules via configuration

### File List

**Created:**
- `/lib/matching/url-matcher.ts` - Core URLMatcher class with all functionality
- `/types/url-matcher.types.ts` - TypeScript interfaces for URL matching
- `/app/api/matching/urls/route.ts` - API endpoint for URL matching
- `/tests/unit/lib/matching/url-matcher.test.ts` - Comprehensive test suite

**Modified:**
- `package.json` - Added fastest-levenshtein dependency

### Agent Model Used

claude-3-5-sonnet-20241022

### Debug Log References

- Successfully installed fastest-levenshtein package
- Implemented four matching strategies: exact, normalized, fuzzy, pattern
- Batch matching optimized with pre-normalization and indexing
- Pattern matching for product, category, blog, and collection URLs
- Cache implementation for normalized URLs
- Performance target met: 1000 URLs in under 5 seconds

### Completion Notes List

1. ✅ URL normalization with configurable options (protocol, www, trailing slash, case, params)
2. ✅ Exact matching with 100% confidence
3. ✅ Normalized matching with 95% confidence
4. ✅ Fuzzy matching using Levenshtein distance with configurable threshold (default 0.7)
5. ✅ Pattern matching for dynamic URLs (products, categories, blog posts, collections)
6. ✅ Batch matching optimized for 1000+ URLs
7. ✅ Confidence scoring based on match type and component similarity
8. ✅ Unmatched report generation grouped by domain
9. ✅ Comprehensive test coverage including edge cases

### Change Log

1. Created URLMatcher class with configurable options
2. Implemented URL normalization with component extraction
3. Added fuzzy matching using Levenshtein distance algorithm
4. Created pattern matching for common e-commerce URL patterns
5. Built confidence scoring system (exact: 1.0, normalized: 0.95, fuzzy: 0.7-0.94, pattern: 0.85)
6. Optimized batch matching with pre-normalization and indexing
7. Added unmatched report generator with domain grouping
8. Created API endpoint for URL matching operations
9. Wrote comprehensive test suite covering all match types and edge cases
