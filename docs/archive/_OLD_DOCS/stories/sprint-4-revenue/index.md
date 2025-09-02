# Sprint 4: Data & Intelligence Layer (Revenue Optimization)

## Sprint Goal

Build the data integration and opportunity scoring system that powers the revenue optimization platform.

## Duration

2 weeks

## Epic

Transform raw performance data into actionable revenue opportunities through intelligent scoring and analysis.

## Stories

### Story 4.1: Enhance Search Console Integration for URL Metrics

- **Priority**: P0 - Critical
- **Size**: L (8 hours)
- **Description**: Expand GSC integration to pull URL-level performance metrics
- **Deliverables**:
  - URL-level impressions, CTR, position data
  - Historical trend analysis (6 months)
  - Category-level aggregation

### Story 4.2: Opportunity Scoring Algorithm

- **Priority**: P0 - Critical
- **Size**: L (8 hours)
- **Description**: Implement the core opportunity scoring algorithm
- **Formula**: `Score = (Search Volume × 0.3) + (CTR Gap × AOV × 0.4) + (Position Potential × 0.2) + (Competition × 0.1)`
- **Deliverables**:
  - Scoring service
  - Database schema for scores
  - Real-time calculation

### Story 4.3: Benchmark Calculation System

- **Priority**: P0 - Critical
- **Size**: M (6 hours)
- **Description**: Create internal and external benchmark calculations
- **Deliverables**:
  - Internal best performer identification
  - Category benchmark calculations
  - Industry standard comparisons

### Story 4.4: Quick Win Identification Engine

- **Priority**: P1 - High
- **Size**: M (4 hours)
- **Description**: Identify low-effort, high-impact optimization opportunities
- **Deliverables**:
  - Quick win algorithm
  - Priority ranking system
  - Effort estimation

### Story 4.5: Performance Data Overlay for Visualization

- **Priority**: P0 - Critical
- **Size**: M (6 hours)
- **Description**: Add performance metrics to D3 visualization
- **Deliverables**:
  - Color coding by opportunity score
  - Node sizing by revenue potential
  - Hover states with metrics
  - Real-time data updates

## Technical Requirements

### Data Models

```typescript
interface CategoryPerformance {
  url: string;
  impressions: number;
  clicks: number;
  ctr: number;
  position: number;
  revenue?: number;
  conversionRate?: number;
  opportunityScore: number;
  benchmarkCTR: number;
  potentialRevenue: number;
}

interface OpportunityScore {
  categoryId: string;
  score: number;
  components: {
    searchVolume: number;
    ctrGap: number;
    positionPotential: number;
    competition: number;
  };
  quickWin: boolean;
  effortEstimate: 'low' | 'medium' | 'high';
  revenueImpact: number;
}
```

### API Endpoints

- `GET /api/performance/categories` - Get all category performance
- `GET /api/opportunities/scores` - Get opportunity scores
- `GET /api/benchmarks/{categoryId}` - Get category benchmarks
- `POST /api/opportunities/calculate` - Trigger recalculation

### Database Schema Updates

```sql
-- Performance metrics table
CREATE TABLE category_performance (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects(id),
  url TEXT NOT NULL,
  date DATE NOT NULL,
  impressions INTEGER,
  clicks INTEGER,
  ctr DECIMAL(5,4),
  position DECIMAL(4,2),
  revenue DECIMAL(10,2),
  conversion_rate DECIMAL(5,4),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(project_id, url, date)
);

-- Opportunity scores table
CREATE TABLE opportunity_scores (
  id UUID PRIMARY KEY,
  category_id UUID REFERENCES taxonomy_nodes(id),
  score DECIMAL(10,2),
  search_volume_component DECIMAL(10,2),
  ctr_gap_component DECIMAL(10,2),
  position_component DECIMAL(10,2),
  competition_component DECIMAL(10,2),
  quick_win BOOLEAN DEFAULT FALSE,
  effort_estimate TEXT,
  revenue_impact DECIMAL(10,2),
  calculated_at TIMESTAMP DEFAULT NOW()
);
```

## Success Criteria

- [ ] Search Console data updates daily for all categories
- [ ] Opportunity scores calculated for all categories
- [ ] Benchmarks established for top 20% performers
- [ ] Quick wins identified with >80% accuracy
- [ ] Visualization shows real-time performance data
- [ ] Score calculation takes <2 seconds for 500 categories

## Dependencies

- Completed D3 visualization (Sprint 3)
- Google Search Console access
- Product feed data for AOV calculations

## Risk Mitigation

- **Risk**: API rate limits
- **Mitigation**: Implement caching, batch requests, queue system

- **Risk**: Scoring algorithm accuracy
- **Mitigation**: A/B test with manual assessments, iterate based on results
