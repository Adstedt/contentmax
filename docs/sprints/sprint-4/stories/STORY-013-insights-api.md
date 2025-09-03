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

- [ ] API routes for insights data
- [ ] Authentication and authorization
- [ ] Rate limiting implementation
- [ ] Response caching
- [ ] OpenAPI spec documentation
- [ ] Integration tests

## Story Metadata

- **Created**: 2025-09-03
- **Sprint**: Sprint 4
- **Parent Task**: TASK-013-insights-api
- **Estimated Effort**: 4 hours
- **Priority**: P1 - High (integration enabler)
- **Dependencies**: Opportunity scoring, auth system
