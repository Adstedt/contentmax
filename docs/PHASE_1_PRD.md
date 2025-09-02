# Phase 1 Product Requirements Document (PRD)

## ContentMax Revenue Optimization Platform - MVP

### Version 1.0 | 6-Week Sprint

---

## 1. Executive Summary

### Product Vision

ContentMax Phase 1 delivers a revolutionary e-commerce revenue optimization platform that visualizes site taxonomy as an interactive force-directed graph, enriched with performance metrics to identify and prioritize revenue opportunities at scale.

### Phase 1 Scope (MVP - 6 Weeks)

- **IN SCOPE**: Data ingestion, taxonomy visualization, opportunity scoring, metric integration
- **OUT OF SCOPE**: Content generation, automated publishing, A/B testing, workflow automation

### Success Metrics

- Load and visualize 3,000+ category nodes in < 2 seconds
- Process 100,000+ search queries for opportunity scoring
- Identify top 100 revenue opportunities with 85% accuracy
- Reduce time to find optimization opportunities by 70%

---

## 2. Core Architecture

### 2.1 Node-Centric Data Model

```typescript
interface CategoryNode {
  // Core Identity (from Sitemap/Shopify)
  id: string;
  url: string;
  title: string;
  parent_id: string | null;
  level: number;

  // Structure
  children: string[];
  product_count: number;

  // Enrichment Layers (feed-agnostic)
  metrics: {
    gsc?: GSCMetrics;
    ga4?: GA4Metrics;
    shopify?: ShopifyMetrics;
  };

  // Computed
  opportunity_score: number;
  revenue_potential: number;
  optimization_status: 'optimized' | 'needs_work' | 'critical' | 'no_data';
}
```

### 2.2 Feed-Agnostic Enrichment Strategy

**Principle**: Structure comes from sitemap/Shopify. External feeds enrich but never define.

```
Sitemap/Shopify (Truth) → Node Structure
         ↓
    GSC Enrichment → Search metrics added to existing nodes
         ↓
    GA4 Enrichment → Traffic metrics added to existing nodes
         ↓
    Opportunity Scoring → Computed from available metrics
```

---

## 3. Technical Requirements

### 3.1 Data Ingestion Pipeline

#### Sitemap Processor

- **Input**: XML sitemap or Shopify API
- **Output**: Hierarchical node structure
- **Performance**: Process 10,000 URLs in < 30 seconds
- **Validation**: URL format, hierarchy integrity, duplicate detection

#### GSC Integration

- **Method**: Bulk API with pagination
- **Metrics**: Impressions, clicks, CTR, position
- **Matching**: Fuzzy URL matching with 95% accuracy
- **Frequency**: Daily sync with incremental updates

#### GA4 Integration

- **Method**: Data API v1
- **Metrics**: Sessions, revenue, conversion rate, AOV
- **Dimensions**: Landing page, source/medium
- **Lookback**: 90 days rolling window

### 3.2 Database Schema

```sql
-- Core taxonomy structure
CREATE TABLE category_nodes (
  id UUID PRIMARY KEY,
  url TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  parent_id UUID REFERENCES category_nodes(id),
  level INTEGER NOT NULL,
  product_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Metrics storage (denormalized for performance)
CREATE TABLE node_metrics (
  node_id UUID REFERENCES category_nodes(id),
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

-- Opportunity scoring
CREATE TABLE opportunities (
  node_id UUID REFERENCES category_nodes(id),
  score DECIMAL(6,2),
  revenue_potential DECIMAL(12,2),
  priority INTEGER,
  factors JSONB,
  computed_at TIMESTAMP,
  PRIMARY KEY (node_id)
);
```

### 3.3 Visualization Requirements

#### D3.js Force-Directed Graph

```javascript
const forceSimulation = {
  nodes: 3000+,
  forces: {
    charge: -300,        // Node repulsion
    link: 0.7,          // Edge strength
    collide: 20,        // Prevent overlap
    center: true        // Gravity to center
  },
  performance: {
    target_fps: 30,
    max_render_time: 50ms,
    use_webgl: true,
    progressive_render: true
  }
};
```

#### Visual Encoding

- **Node Size**: Product count (logarithmic scale)
- **Node Color**: Optimization status
  - Green: Optimized (score > 80)
  - Yellow: Needs work (score 50-80)
  - Red: Critical (score < 50)
  - Gray: No data
- **Edge Thickness**: Traffic flow between categories
- **Hover State**: +20% scale, show metrics tooltip
- **Click Action**: Open detail modal with full metrics

---

## 4. Sprint Breakdown

### Sprint 1: Foundation (Week 1)

**Goal**: Database setup and basic data ingestion

**Tasks**:

1. Supabase project initialization
2. Database schema creation
3. Sitemap parser implementation
4. Basic CRUD operations
5. Initial data load from sample sitemap

**Deliverable**: Working database with 1000+ nodes imported

### Sprint 2: Integration Layer (Week 2)

**Goal**: External data source connections

**Tasks**:

1. Google Search Console OAuth flow
2. GSC data fetching and storage
3. GA4 authentication setup
4. GA4 metrics retrieval
5. Data matching algorithms

**Deliverable**: Enriched nodes with real metrics

### Sprint 3: Visualization Core (Week 3)

**Goal**: Interactive D3.js taxonomy visualization

**Tasks**:

1. D3.js force simulation setup
2. Node rendering with visual encoding
3. Zoom/pan controls
4. Performance optimization for 3000+ nodes
5. Progressive loading strategy

**Deliverable**: Interactive graph visualization

### Sprint 4: Intelligence Layer (Week 4)

**Goal**: Opportunity scoring and insights

**Tasks**:

1. Opportunity scoring algorithm
2. Revenue potential calculation
3. Priority ranking system
4. Bulk opportunity identification
5. Metrics aggregation

**Deliverable**: Scored and prioritized opportunity list

### Sprint 5: Polish & Deploy (Week 5-6)

**Goal**: Production-ready MVP

**Tasks**:

1. UI/UX refinements
2. Performance optimization
3. Error handling and edge cases
4. Deployment to Vercel
5. Documentation and onboarding

**Deliverable**: Deployed MVP with documentation

---

## 5. User Interface Specifications

### 5.1 Main Dashboard Layout

```
┌─────────────────────────────────────────────────────────┐
│  ContentMax  [Import] [Refresh] [Settings]              │
├─────────────────────────────────────────────────────────┤
│  Revenue Potential: $2.4M  |  Opportunities: 147       │
├────────────┬────────────────────────────────┬──────────┤
│            │                                │          │
│  FILTERS   │    VISUALIZATION CANVAS       │  DETAILS │
│            │    (Force-Directed Graph)     │  PANEL   │
│            │                                │          │
├────────────┴────────────────────────────────┴──────────┤
│  Top Opportunities: [List of top 5 with scores]        │
└─────────────────────────────────────────────────────────┘
```

### 5.2 Node Detail Modal

```
┌─────────────────────────────────────────┐
│  Winter Jackets                        X│
├─────────────────────────────────────────┤
│  URL: /categories/winter-jackets        │
│  Products: 1,247                        │
│  Status: Needs Optimization (Score: 65) │
├─────────────────────────────────────────┤
│  SEARCH METRICS         │ REVENUE DATA  │
│  Impressions: 45,230    │ Revenue: $487K│
│  Clicks: 1,876          │ AOV: $125     │
│  CTR: 4.1%              │ Conv: 2.3%    │
│  Position: 8.7          │ Sessions: 12K │
├─────────────────────────────────────────┤
│  OPPORTUNITY ANALYSIS                   │
│  Revenue Potential: +$234K/year         │
│  Primary Issue: Low CTR vs competitors  │
│  Recommended Action: Optimize title     │
└─────────────────────────────────────────┘
```

---

## 6. API Specifications

### 6.1 REST Endpoints

```typescript
// Taxonomy Management
GET    /api/nodes              // List all nodes
GET    /api/nodes/:id          // Get node details
POST   /api/nodes/import       // Import from sitemap
PUT    /api/nodes/:id          // Update node

// Metrics
GET    /api/metrics/:nodeId    // Get node metrics
POST   /api/metrics/sync       // Trigger metrics sync
GET    /api/metrics/summary    // Dashboard summary

// Opportunities
GET    /api/opportunities       // List all opportunities
GET    /api/opportunities/top   // Top 100 by score
POST   /api/opportunities/calc  // Recalculate scores
```

### 6.2 WebSocket Events

```typescript
// Real-time updates
ws.on('node:updated', (node) => updateVisualization(node));
ws.on('metrics:synced', (stats) => refreshDashboard(stats));
ws.on('import:progress', (percent) => updateProgress(percent));
```

---

## 7. Performance Requirements

### 7.1 Load Time Targets

- Initial page load: < 2 seconds
- Visualization render: < 1 second for 3000 nodes
- Metric sync: < 30 seconds for full refresh
- Search/filter: < 100ms response

### 7.2 Scalability Limits

- Maximum nodes: 10,000
- Maximum concurrent users: 100
- Data retention: 90 days
- API rate limits: GSC 1200/min, GA4 10/sec

---

## 8. Security & Compliance

### 8.1 Authentication

- Supabase Auth with email/password
- OAuth for Google services
- Row-level security in database
- API key rotation every 90 days

### 8.2 Data Privacy

- No PII storage
- Aggregated metrics only
- SSL/TLS for all connections
- GDPR-compliant data handling

---

## 9. Success Criteria

### 9.1 Acceptance Criteria

- [ ] Import and visualize 3000+ category nodes
- [ ] Display real GSC metrics for 80%+ of nodes
- [ ] Calculate opportunity scores with documented algorithm
- [ ] Identify top 100 revenue opportunities
- [ ] Render visualization at 30+ FPS
- [ ] Deploy to production environment

### 9.2 Launch Readiness

- [ ] All acceptance criteria met
- [ ] Performance targets achieved
- [ ] Security audit passed
- [ ] Documentation complete
- [ ] User training materials ready

---

## 10. Risks & Mitigations

| Risk                               | Impact | Mitigation                                |
| ---------------------------------- | ------ | ----------------------------------------- |
| D3.js performance with 3000+ nodes | High   | Implement WebGL renderer, clustering      |
| GSC API rate limits                | Medium | Implement caching, batch processing       |
| Data matching accuracy             | Medium | Fuzzy matching algorithms, manual mapping |
| Opportunity scoring accuracy       | Low    | Iterative refinement based on feedback    |

---

## 11. Future Considerations (Phase 2)

**Not in Phase 1 MVP scope, but architected for:**

- AI content generation integration
- A/B testing framework
- Workflow automation
- Multi-language support
- Competitor analysis
- Custom reporting

---

## 12. Technical Stack

### Frontend

- Next.js 14 (App Router)
- TypeScript
- D3.js for visualization
- Tailwind CSS
- Shadcn/ui components

### Backend

- Supabase (PostgreSQL)
- Edge Functions for API
- Redis for caching
- Bull for job queues

### Infrastructure

- Vercel for hosting
- GitHub Actions for CI/CD
- Sentry for error tracking
- Posthog for analytics

---

## Appendix A: Opportunity Scoring Algorithm

```typescript
function calculateOpportunityScore(node: CategoryNode): number {
  const weights = {
    searchVolume: 0.3,
    ctrGap: 0.4,
    positionPotential: 0.2,
    competition: 0.1,
  };

  const factors = {
    searchVolume: normalizeSearchVolume(node.metrics.gsc?.impressions),
    ctrGap: calculateCTRGap(node.metrics.gsc?.ctr, node.metrics.gsc?.position),
    positionPotential: calculatePositionPotential(node.metrics.gsc?.position),
    competition: estimateCompetition(node.metrics.gsc?.position),
  };

  const score = Object.entries(weights).reduce((sum, [key, weight]) => {
    return sum + factors[key] * weight * 100;
  }, 0);

  return Math.min(100, Math.max(0, score));
}
```

---

## Appendix B: Sample Data Structures

### Import Response

```json
{
  "status": "success",
  "imported": 3247,
  "failed": 12,
  "duration": "28.3s",
  "hierarchy": {
    "levels": 4,
    "root_nodes": 8,
    "max_children": 127
  }
}
```

### Opportunity Response

```json
{
  "node_id": "uuid-123",
  "url": "/categories/winter-jackets",
  "score": 78.5,
  "revenue_potential": 234000,
  "factors": {
    "search_volume": 45230,
    "ctr_gap": 0.023,
    "position_potential": 4.3,
    "competition": "medium"
  },
  "recommendations": ["Improve meta description", "Add FAQ schema", "Increase internal links"]
}
```

---

This PRD provides the complete specification for Phase 1 MVP development, focusing exclusively on data ingestion, visualization, and opportunity identification while maintaining clear boundaries from Phase 2 content generation features.
