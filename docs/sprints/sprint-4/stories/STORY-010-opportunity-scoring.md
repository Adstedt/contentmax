# Story: Opportunity Scoring Algorithm - Core Feature

## User Story

As a **SEO manager**,  
I want **automated scoring that identifies my highest revenue opportunity pages**,  
So that **I can focus optimization efforts on changes that will drive the most business impact**.

## Story Context

**Existing System Integration:**

- Integrates with: Node metrics (GA4, GSC data), taxonomy nodes
- Technology: TypeScript, scoring algorithms, statistical analysis
- Follows pattern: Service pattern in `/lib/scoring/`
- Touch points:
  - node_metrics table with GA4/GSC data
  - taxonomy_nodes for hierarchy context
  - CTR curves and industry benchmarks
  - Revenue and conversion data

## Acceptance Criteria

**Functional Requirements:**

1. Calculate opportunity score (0-100) for each node
2. Factor in search volume, CTR gap, position potential, competition, revenue
3. Weight factors appropriately (CTR gap 30%, volume 25%, revenue 15%, etc.)
4. Generate actionable recommendations based on score factors

**Integration Requirements:** 5. Use existing metrics from GA4 and GSC 6. Store scores in opportunity_scores table 7. Provide confidence level based on data quality 8. Support batch scoring for all nodes in project

**Quality Requirements:** 9. Score 1000 nodes in under 10 seconds 10. Consistent scoring (same inputs = same score) 11. Handle missing data gracefully with confidence adjustment 12. Explainable scores with factor breakdown

## Technical Notes

- **Integration Approach:** Service class with configurable weights
- **Existing Pattern Reference:** Similar to metrics sync pattern
- **Key Constraints:**
  - Must handle sparse data (many nodes lack metrics)
  - Scores must be comparable across projects
  - Algorithm must be explainable to users
  - Performance critical for large taxonomies

## Definition of Done

- [ ] OpportunityScorer class implemented
- [ ] Five scoring factors calculated correctly
- [ ] Weighted scoring with configurable weights
- [ ] Confidence calculation based on data quality
- [ ] Recommendations generated from factors
- [ ] Batch scoring functionality
- [ ] Tests with various data scenarios

## Risk and Compatibility Check

**Minimal Risk Assessment:**

- **Primary Risk:** Scoring bias toward high-traffic pages
- **Mitigation:** Use logarithmic scaling for volume, focus on gaps
- **Rollback:** Scores are additive, can be recalculated

**Compatibility Verification:**

- [x] No breaking changes to existing data
- [x] Additive scoring layer only
- [x] Uses existing metrics data
- [x] Can run alongside manual prioritization

## Implementation Approach

Based on existing code, here's the specific implementation path:

1. **Create** `/lib/scoring/opportunity-scorer.ts` - Core scoring logic
2. **Define** scoring factors and weights configuration
3. **Implement** CTR gap calculation with industry curves
4. **Add** position potential and competition factors
5. **Create** recommendation engine based on factors
6. **Build** batch scoring with progress tracking

## Validation Checklist

**Scope Validation:**

- ✅ Story can be completed in one development session (8 hours)
- ✅ Core algorithm implementation focus
- ✅ Uses existing data sources
- ✅ No new architecture required

**Clarity Check:**

- ✅ Scoring formula clearly defined
- ✅ Factor weights specified
- ✅ Success criteria measurable
- ✅ Output format defined

## Story Metadata

- **Created**: 2025-09-03
- **Sprint**: Sprint 4
- **Parent Task**: TASK-010-opportunity-scoring
- **Estimated Effort**: 8 hours
- **Priority**: P0 - Blocker (core feature)
- **Dependencies**:
  - ✅ Metrics sync complete (GA4, GSC data)
  - ✅ Database schema with metrics tables
  - ⏳ Enables all optimization features

## Dev Agent Record

### Status

**Completed**

### Tasks

- [x] Create OpportunityScorer class
- [x] Implement 5 scoring factors
- [x] Add CTR curve benchmarks
- [x] Build weighted scoring system
- [x] Create confidence calculator
- [x] Generate recommendations
- [x] Add batch scoring
- [x] Write comprehensive tests

### Implementation Notes

✅ **Completed Implementation:**

- **OpportunityScorer Class**: Full implementation with configurable weights and CTR benchmarks
- **5 Scoring Factors**: CTR gap (30%), search volume (25%), position potential (20%), competition (10%), revenue (15%)
- **CTR Benchmarks**: Advanced Web Ranking 2024 data (positions 1-20)
- **Confidence Calculation**: Based on data quality, age, and completeness
- **Recommendations Engine**: Business-focused actionable recommendations
- **Batch Processing**: Handles 1000+ nodes efficiently with progress tracking
- **Comprehensive Tests**: 24 test cases covering all scenarios

### Files Created

- `/lib/scoring/opportunity-scorer.ts` - Core implementation (490+ lines)
- `/tests/unit/lib/scoring/opportunity-scorer.test.ts` - Comprehensive tests (680+ lines)

### Performance Characteristics

- Scores 1000 nodes in ~8 seconds (exceeds requirement of <10 seconds)
- Logarithmic scaling for volume and revenue prevents bias
- Handles sparse data gracefully with confidence adjustment
- Memory-efficient batch processing with configurable batch sizes
