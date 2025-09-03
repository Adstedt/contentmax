# Story: Metrics Sync Job - Brownfield Addition

## User Story

As a **content manager**,  
I want **automated daily syncing of Google Analytics and Search Console metrics to my content nodes**,  
So that **I always have fresh data for making content optimization decisions without manual updates**.

## Story Context

**Existing System Integration:**

- Integrates with: GA4Client, GSC Client, URLMatcher, taxonomy_nodes
- Technology: Cron job/scheduled function, TypeScript, Supabase
- Follows pattern: Job pattern in `/lib/jobs/`
- Touch points:
  - GA4 and GSC API clients
  - URL matching algorithm
  - node_metrics table
  - sync_history table for audit trail

## Acceptance Criteria

**Functional Requirements:**

1. Sync metrics from GSC and GA4 for all taxonomy nodes
2. Match metrics to nodes with 95%+ accuracy using URLMatcher
3. Store metrics in node_metrics table with proper timestamps
4. Track sync progress and provide real-time status updates

**Integration Requirements:** 5. Use existing GA4Client and GSC client implementations 6. Apply URLMatcher for fuzzy URL matching 7. Handle API failures gracefully with retry logic 8. Record sync history for debugging and audit

**Quality Requirements:** 9. Complete sync for 1000 nodes in under 5 minutes 10. Generate unmatched URL reports for investigation 11. Support dry-run mode for testing without data changes 12. Configurable date ranges and source selection

## Technical Notes

- **Integration Approach:** Scheduled job with progress tracking
- **Existing Pattern Reference:** Similar to batch import job pattern
- **Key Constraints:**
  - API rate limits (GSC: 1200/min, GA4: 10/sec)
  - Memory efficient for large node sets
  - Must handle partial failures gracefully
  - Daily execution window (preferably off-peak)

## Definition of Done

- [ ] MetricsSyncJob class implemented
- [ ] Progress tracking with MetricsSyncTracker
- [ ] URL matching integration working
- [ ] Batch fetching from both GSC and GA4
- [ ] Error handling and retry logic
- [ ] Sync history recording

## Risk and Compatibility Check

**Minimal Risk Assessment:**

- **Primary Risk:** API quota exhaustion blocking other operations
- **Mitigation:** Implement quota monitoring and backoff strategies
- **Rollback:** Can disable job without affecting manual metrics

**Compatibility Verification:**

- [x] No breaking changes to existing APIs
- [x] Uses existing database tables
- [x] Follows existing job patterns
- [x] Performance impact isolated to sync window

## Implementation Approach

Based on existing code, here's the specific implementation path:

1. **Create** `/lib/jobs/metrics-sync.ts` - Main sync job class
2. **Create** `/lib/jobs/sync-tracker.ts` - Progress tracking
3. **Create** `/app/api/jobs/metrics-sync/route.ts` - API endpoint to trigger
4. **Implement** matching logic using URLMatcher
5. **Add** retry and error handling
6. **Setup** cron job or Vercel cron for daily execution

## Validation Checklist

**Scope Validation:**

- ✅ Story can be completed in one development session (4 hours)
- ✅ Integration with existing components straightforward
- ✅ Follows existing job patterns
- ✅ No new architecture required

**Clarity Check:**

- ✅ Story requirements are unambiguous
- ✅ Integration points clearly specified
- ✅ Success criteria are testable (95% match rate)
- ✅ Rollback approach is simple (disable cron)

## Story Metadata

- **Created**: 2025-09-03
- **Sprint**: Sprint 2
- **Parent Task**: TASK-006-metrics-sync-job
- **Estimated Effort**: 4 hours
- **Priority**: P0 - Blocker (needed for opportunity scoring)
- **Dependencies**:
  - ✅ TASK-004 GA4 Client (must be complete)
  - ✅ TASK-005 URL Matcher (must be complete)
  - ✅ GSC Client (existing)
  - ⏳ Enables opportunity scoring

## Dev Agent Record

### Status

**Not Started**

### Tasks

- [ ] Create MetricsSyncJob class
- [ ] Implement sync configuration options
- [ ] Fetch metrics from GSC and GA4
- [ ] Apply URL matching algorithm
- [ ] Store matched metrics in database
- [ ] Create sync progress tracker
- [ ] Record sync history
- [ ] Write integration tests

### Implementation Notes

- Batch fetch URLs to respect API limits
- Use transactions for database writes
- Consider parallel processing for GA4 and GSC
- Implement circuit breaker for API failures
