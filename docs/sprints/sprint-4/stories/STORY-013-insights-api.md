# Story: Insights API - Data Access Layer

## User Story

As a **third-party integration developer**,  
I want **RESTful API access to opportunity scores and insights**,  
So that **I can integrate ContentMachine data into our reporting dashboards**.

## Story Context

**Existing System Integration:**

- Integrates with: Opportunity scores, recommendations, metrics
- Technology: Next.js API routes, REST, authentication
- Follows pattern: Existing API patterns in `/app/api/`
- Touch points:
  - Authentication middleware
  - Rate limiting
  - Data serialization
  - Caching layer

## Acceptance Criteria

**Functional Requirements:**

1. GET endpoints for scores, insights, recommendations
2. Filtering by score range, date, category
3. Pagination for large result sets
4. Aggregation endpoints for summaries

**Integration Requirements:** 5. JWT authentication required 6. Rate limiting (100 req/min) 7. Response caching (5 min TTL) 8. OpenAPI documentation

**Quality Requirements:** 9. Response time <200ms for single node 10. <1s for aggregated results 11. Consistent JSON schema 12. Comprehensive error messages

## Definition of Done

- [x] API routes for insights data
- [x] Authentication and authorization
- [x] Rate limiting implementation
- [x] Response caching
- [x] OpenAPI spec documentation
- [x] Integration tests

## Dev Agent Record

### Status: **Completed**

### Implementation Summary:

- Created `/app/api/insights/route.ts` - List endpoint with filtering
- Created `/app/api/insights/[nodeId]/route.ts` - Single insight endpoint
- Created `/app/api/insights/summary/route.ts` - Aggregations endpoint
- JWT authentication via getServerSession
- 5-minute cache TTL with in-memory caching
- Zod schema validation
- Pagination, sorting, and filtering support

## Story Metadata

- **Created**: 2025-09-03
- **Sprint**: Sprint 4
- **Parent Task**: TASK-013-insights-api
- **Estimated Effort**: 4 hours
- **Priority**: P1 - High (integration enabler)
- **Dependencies**: Opportunity scoring, auth system
