# Story: Batch Import API - Brownfield Addition

## User Story

As a **content manager**,  
I want **to efficiently import large numbers of URLs (1000+) with progress tracking**,  
So that **I can quickly populate the taxonomy without timeouts or losing track of import status**.

## Story Context

**Existing System Integration:**

- Integrates with: `HierarchyBuilder` class in `/lib/processing/hierarchy-builder.ts`
- Technology: Next.js API routes, TypeScript, Supabase, Server-Sent Events
- Follows pattern: Existing API patterns in `/app/api/`
- Touch points:
  - `taxonomy_nodes` table in Supabase
  - Existing authentication middleware
  - HierarchyBuilder for relationship building
  - Import history tracking

## Acceptance Criteria

**Functional Requirements:**

1. Import 1000+ nodes in under 30 seconds
2. Process nodes in configurable chunks (10-500 nodes per chunk)
3. Provide real-time progress updates via SSE
4. Handle duplicate URLs appropriately (skip or update based on options)

**Integration Requirements:** 5. Existing HierarchyBuilder continues to work for relationship building 6. Authentication and project access validation enforced 7. Import history recorded for audit trail 8. Database transactions ensure data consistency

**Quality Requirements:** 9. Retry failed chunks with exponential backoff (max 3 retries) 10. Memory efficient - no loading all nodes in memory at once 11. Detailed error reporting per failed node 12. No regression in existing import functionality

## Technical Notes

- **Integration Approach:** Chunked processing with batch inserts
- **Existing Pattern Reference:** Follow `/app/api/taxonomy/hierarchy/route.ts` patterns
- **Key Constraints:**
  - Max 10,000 nodes per import
  - Chunk size between 10-500 nodes
  - 30-second target for 1000 nodes
  - Memory limit considerations

## Definition of Done

- [ ] Batch import endpoint handles 1000+ nodes efficiently
- [ ] Chunk-based processing implemented
- [ ] Real-time progress updates via SSE working
- [ ] Transaction management ensures consistency
- [ ] Retry logic with exponential backoff implemented
- [ ] Tests pass (API integration tests)

## Risk and Compatibility Check

**Minimal Risk Assessment:**

- **Primary Risk:** Database connection pool exhaustion
- **Mitigation:** Implement connection pooling and chunk size limits
- **Rollback:** Can disable endpoint without affecting existing imports

**Compatibility Verification:**

- [x] No breaking changes to existing APIs
- [x] Database changes - additive only (import_history, import_progress tables)
- [x] Follows existing authentication patterns
- [x] Performance impact isolated to import operations

## Implementation Approach

Based on existing code, here's the specific implementation path:

1. **Create** `/app/api/import/batch/route.ts` - Main batch import endpoint
2. **Create** `/lib/import/batch-importer.ts` - Chunked import logic
3. **Create** `/lib/import/progress-tracker.ts` - Progress tracking
4. **Create** `/app/api/import/stream/route.ts` - SSE endpoint for progress
5. **Update** database schema with import_history and import_progress tables
6. **Test** with datasets of varying sizes (100, 1000, 5000 nodes)

## Validation Checklist

**Scope Validation:**

- ✅ Story can be completed in one development session (4 hours)
- ✅ Integration approach is straightforward (uses existing patterns)
- ✅ Follows existing API structure
- ✅ No new architecture required

**Clarity Check:**

- ✅ Story requirements are unambiguous
- ✅ Integration points are clearly specified
- ✅ Success criteria are testable (1000 nodes in 30 seconds)
- ✅ Rollback approach is simple (disable endpoint)

## Story Metadata

- **Created**: 2025-09-03
- **Sprint**: Sprint 1
- **Parent Task**: TASK-003-batch-import-api
- **Estimated Effort**: 4 hours
- **Priority**: P0 - Blocker (needed for large-scale imports)
- **Dependencies**:
  - ✅ HierarchyBuilder implementation (complete)
  - ✅ Database schema (complete)
  - ⏳ This enables bulk content operations

## Dev Agent Record

### Status

**Not Started**

### Tasks

- [ ] Create batch import API endpoint
- [ ] Implement BatchImporter class with chunking
- [ ] Add ImportProgressTracker for real-time updates
- [ ] Create SSE endpoint for progress streaming
- [ ] Add database tables for import tracking
- [ ] Write integration tests
- [ ] Test with 1000+ node datasets

### Implementation Notes

- Use database transactions per chunk for consistency
- Implement connection pooling to prevent exhaustion
- Consider using COPY command for very large imports (future optimization)
- Add rate limiting to prevent abuse
