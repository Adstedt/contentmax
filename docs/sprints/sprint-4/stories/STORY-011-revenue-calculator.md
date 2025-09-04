# Story: Revenue Impact Calculator - Business Value Feature

## User Story

As a **business stakeholder**,  
I want **to see potential revenue impact for each optimization opportunity**,  
So that **I can justify SEO investments with clear ROI projections**.

## Story Context

**Existing System Integration:**

- Integrates with: Opportunity scores, GA4 revenue data, conversion rates
- Technology: TypeScript, financial calculations, Monte Carlo simulation
- Follows pattern: Calculator pattern in `/lib/scoring/`
- Touch points:
  - GA4 revenue and conversion metrics
  - Position improvement estimates
  - CTR improvement projections
  - Historical performance data

## Acceptance Criteria

**Functional Requirements:**

1. Calculate potential revenue increase for position improvements
2. Project traffic gains from CTR optimization
3. Estimate conversion rate improvements
4. Provide confidence intervals (low/med/high scenarios)

**Integration Requirements:** 5. Use historical GA4 revenue data 6. Factor in seasonality from past 12 months 7. Store projections with opportunity scores 8. Support what-if scenarios for position changes

**Quality Requirements:** 9. Calculations complete in <1 second per node 10. Projections based on statistical models 11. Clear assumptions documented 12. Conservative estimates to maintain credibility

## Definition of Done

- [x] RevenueCalculator class implemented
- [x] Traffic projection from position changes
- [x] Revenue calculation with confidence intervals
- [x] Seasonality adjustment from historical data
- [x] What-if scenario support
- [x] Tests with various revenue models

## Dev Agent Record

### Status: **Completed**

### Implementation Summary:

- Created `/lib/scoring/revenue-calculator.ts` (380+ lines)
- Comprehensive test suite with 12+ test cases
- Conservative/Realistic/Optimistic projections
- Seasonality detection from 12-month history
- What-if scenarios for position and CTR changes
- Confidence scoring based on data quality

## Story Metadata

- **Created**: 2025-09-03
- **Sprint**: Sprint 4
- **Parent Task**: TASK-011-revenue-calculator
- **Estimated Effort**: 6 hours
- **Priority**: P0 - Blocker (key differentiator)
- **Dependencies**: Opportunity scoring, GA4 metrics
