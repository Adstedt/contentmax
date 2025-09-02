# Remaining Tasks for Phase 1 MVP

## Current Implementation Status

Based on codebase review (Sep 2, 2025), here's what needs to be completed for the Phase 1 MVP.

---

## 🎯 Sprint 1: Foundation (Week 1) - 30% Remaining

### ✅ Completed

- Supabase project setup and configuration
- Basic database schema (tables exist)
- Authentication system
- Project structure

### 🔴 Remaining Tasks

#### 1.1 Update Database Schema for Node-Centric Model

**Priority**: P0 - Blocker
**Status**: Schema exists but doesn't match PRD spec

```sql
-- Need to modify taxonomy_nodes table to match:
ALTER TABLE taxonomy_nodes
ADD COLUMN node_id UUID UNIQUE,
ADD COLUMN opportunity_score DECIMAL(6,2),
ADD COLUMN revenue_potential DECIMAL(12,2),
ADD COLUMN optimization_status VARCHAR(20);

-- Add node_metrics table
CREATE TABLE node_metrics (
  node_id UUID REFERENCES taxonomy_nodes(id),
  date DATE NOT NULL,
  impressions INTEGER,
  clicks INTEGER,
  ctr DECIMAL(5,4),
  position DECIMAL(4,2),
  sessions INTEGER,
  revenue DECIMAL(12,2),
  conversion_rate DECIMAL(5,4),
  PRIMARY KEY (node_id, date)
);

-- Add opportunities table
CREATE TABLE opportunities (
  node_id UUID REFERENCES taxonomy_nodes(id),
  score DECIMAL(6,2),
  revenue_potential DECIMAL(12,2),
  priority INTEGER,
  factors JSONB,
  computed_at TIMESTAMP,
  PRIMARY KEY (node_id)
);
```

#### 1.2 Complete Hierarchy Builder

**Priority**: P0 - Critical
**File**: `lib/ingestion/sitemap-parser.ts`

```typescript
// Add to existing parser:
export function buildHierarchy(nodes: SitemapNode[]): CategoryNode[] {
  // Implementation needed:
  // - Parse URL paths to determine parent-child relationships
  // - Calculate depth levels
  // - Build tree structure
  // - Ensure single root or multiple roots handled
}
```

#### 1.3 Implement Batch Import API

**Priority**: P0 - Critical
**File**: `app/api/import/batch/route.ts`

- Handle 1000+ nodes efficiently
- Progress tracking
- Transaction management
- Error recovery

---

## 🎯 Sprint 2: External Data Integration (Week 2) - 60% Remaining

### ✅ Completed

- Google OAuth implementation
- GSC client and data fetching
- GSC caching layer

### 🔴 Remaining Tasks

#### 2.1 GA4 Integration

**Priority**: P0 - Critical
**New File**: `lib/integrations/analytics.ts`

```typescript
import { BetaAnalyticsDataClient } from '@google-analytics/data';

export class GA4Client {
  async fetchMetrics(propertyId: string, dateRange: DateRange) {
    // Implementation needed:
    // - Authentication
    // - Metrics fetching (sessions, revenue, conversions)
    // - Dimension filtering by landing page
    // - Batch processing
  }
}
```

#### 2.2 URL Matching Algorithm

**Priority**: P0 - Critical
**New File**: `lib/matching/url-matcher.ts`

```typescript
export class URLMatcher {
  fuzzyMatch(sourceUrl: string, targetUrl: string): number {
    // Implementation needed:
    // - Normalize URLs (remove protocol, www, trailing slash)
    // - Handle parameter variations
    // - Calculate confidence score (0-1)
    // - Log unmatched URLs
  }

  async matchMetricsToNodes(metrics: MetricData[], nodes: CategoryNode[]) {
    // Build index for O(1) lookup
    // Apply fuzzy matching
    // Return enriched nodes
  }
}
```

#### 2.3 Metrics Sync Job

**Priority**: P1 - High
**New File**: `app/api/sync/metrics/route.ts`

```typescript
export async function POST() {
  // Daily sync implementation:
  // 1. Fetch all nodes
  // 2. Get GSC data (last 7 days)
  // 3. Get GA4 data (last 7 days)
  // 4. Match to nodes
  // 5. Store in node_metrics table
  // 6. Return sync statistics
}
```

#### 2.4 Create Sync Scheduler

**Priority**: P1 - High
**Options**:

- Vercel Cron Jobs
- Supabase Edge Functions
- External service (e.g., GitHub Actions)

---

## 🎯 Sprint 3: Visualization Core (Week 3) - 20% Remaining

### ✅ Completed

- D3.js force-directed graph
- Canvas rendering
- Zoom/pan controls
- Basic interactions

### 🔴 Remaining Tasks

#### 3.1 Progressive Loading Refinement

**Priority**: P1 - High
**File**: `components/taxonomy/D3Visualization/ForceGraph.tsx`

```typescript
// Improve progressive loading:
// - Load core nodes first (top-level categories)
// - Stream in child nodes based on viewport
// - Implement clustering for 3000+ nodes
// - Add loading indicators
```

#### 3.2 Visual Encoding Update

**Priority**: P1 - High
**File**: `components/taxonomy/D3Visualization/CanvasRenderer.ts`

```typescript
// Update color scheme to match PRD:
const STATUS_COLORS = {
  optimized: '#10B981', // Green
  needs_work: '#F59E0B', // Yellow
  critical: '#EF4444', // Red
  no_data: '#9CA3AF', // Gray
};

// Add node size scaling based on product count
// Implement edge thickness based on traffic flow
```

#### 3.3 Performance Optimization

**Priority**: P2 - Medium
**Target**: 3000+ nodes at 30+ FPS

- Implement WebGL fallback renderer
- Add viewport culling
- Optimize force calculations
- Memory management

---

## 🎯 Sprint 4: Intelligence Layer (Week 4) - 100% Remaining

### 🔴 All Tasks Remaining

#### 4.1 Opportunity Scoring Algorithm

**Priority**: P0 - Critical
**New File**: `lib/scoring/opportunity-scorer.ts`

Complete implementation as specified in PRD:

- Calculate scoring factors
- Apply weights
- Generate recommendations
- Store in opportunities table

#### 4.2 Revenue Potential Calculator

**Priority**: P0 - Critical
**New File**: `lib/scoring/revenue-calculator.ts`

- Project clicks based on position improvement
- Calculate revenue lift
- Estimate time to impact
- Confidence scoring

#### 4.3 Bulk Processing Pipeline

**Priority**: P1 - High
**New File**: `lib/scoring/bulk-processor.ts`

- Process all nodes in batches
- Rank opportunities
- Store top 100
- Progress tracking

#### 4.4 Insights API

**Priority**: P1 - High
**New File**: `app/api/insights/route.ts`

- Overview endpoint
- Top opportunities endpoint
- Trend analysis
- Segment analysis

#### 4.5 Recommendations Engine

**Priority**: P2 - Medium
**New File**: `lib/scoring/recommendations.ts`

- Generate actionable recommendations
- Priority ranking
- Estimated impact calculations

---

## 🎯 Sprint 5: Polish & Production (Weeks 5-6) - 70% Remaining

### ✅ Completed

- Basic UI components
- Dark theme

### 🔴 Remaining Tasks

#### 5.1 UI/UX Polish

- Loading states for all components
- Empty states
- Error states
- Progress indicators
- Animated transitions

#### 5.2 Performance Optimization

- React Query implementation
- Virtual scrolling for lists
- Code splitting
- Database query optimization
- Materialized views

#### 5.3 Error Handling

- Global error boundary
- API error recovery
- Graceful degradation
- User-friendly error messages

#### 5.4 Production Configuration

- Environment variables in Vercel
- GitHub Actions CI/CD
- Monitoring (Sentry)
- Analytics (PostHog)
- Performance monitoring

#### 5.5 Documentation

- API documentation
- Deployment guide
- Troubleshooting guide
- User onboarding flow

---

## 📋 Priority Order for Implementation

### Week 1 Focus (Complete Sprint 1)

1. Update database schema ⚡
2. Complete hierarchy builder ⚡
3. Implement batch import ⚡

### Week 2 Focus (Complete Sprint 2)

1. GA4 integration ⚡
2. URL matching algorithm ⚡
3. Metrics sync job ⚡

### Week 3 Focus (Polish Sprint 3 + Start Sprint 4)

1. Refine progressive loading
2. Start opportunity scoring algorithm ⚡
3. Revenue calculator ⚡

### Week 4 Focus (Complete Sprint 4)

1. Bulk processing pipeline ⚡
2. Insights API ⚡
3. Recommendations engine

### Week 5-6 Focus (Sprint 5)

1. Error handling
2. Performance optimization
3. Production deployment
4. Documentation

---

## 🚨 Blockers & Risks

1. **Database Schema Mismatch**: Current schema doesn't support node-centric model
2. **GA4 Not Connected**: Half of metrics missing
3. **No Scoring Algorithm**: Core value prop not implemented
4. **Performance Unknown**: Not tested with 3000+ nodes
5. **No Production Config**: Deployment not set up

---

## ✅ Definition of Done for MVP

- [ ] Import and visualize 3000+ nodes
- [ ] GSC + GA4 metrics integrated
- [ ] Opportunity scoring working
- [ ] Top 100 opportunities identified
- [ ] 30+ FPS with full dataset
- [ ] Deployed to production
- [ ] Documentation complete

---

## 📊 Estimated Completion

- **Sprint 1 Remaining**: 2-3 days
- **Sprint 2 Remaining**: 3-4 days
- **Sprint 3 Remaining**: 1-2 days
- **Sprint 4 Complete**: 5 days
- **Sprint 5 Complete**: 5-7 days

**Total Remaining**: ~18-22 days of focused development

---

## Next Immediate Actions

1. **Create migration** for database schema updates
2. **Implement GA4 client** following GSC pattern
3. **Build URL matcher** with test cases
4. **Create opportunity scorer** with algorithm from PRD
5. **Set up Vercel deployment** with environment variables
