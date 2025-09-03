# TASK-001: Database Schema Migration

## Overview

**Priority**: P0 - Blocker  
**Estimate**: 4 hours  
**Owner**: Backend Developer  
**Dependencies**: None  
**Status**: Not Started

## Problem Statement

The current database schema doesn't support the node-centric architecture defined in the Phase 1 PRD. We need to modify existing tables and add new ones to support opportunity scoring, metrics storage, and revenue calculations.

## Technical Requirements

### 1. Schema Changes

#### 1.1 Modify taxonomy_nodes table

```sql
-- Migration: 009_node_centric_model.sql
ALTER TABLE taxonomy_nodes
ADD COLUMN opportunity_score DECIMAL(6,2) DEFAULT 0,
ADD COLUMN revenue_potential DECIMAL(12,2) DEFAULT 0,
ADD COLUMN optimization_status VARCHAR(20)
    CHECK (optimization_status IN ('optimized', 'needs_work', 'critical', 'no_data'))
    DEFAULT 'no_data',
ADD COLUMN last_scored_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN metrics_updated_at TIMESTAMP WITH TIME ZONE;

-- Add indexes for performance
CREATE INDEX idx_taxonomy_nodes_score ON taxonomy_nodes(opportunity_score DESC);
CREATE INDEX idx_taxonomy_nodes_status ON taxonomy_nodes(optimization_status);
CREATE INDEX idx_taxonomy_nodes_revenue ON taxonomy_nodes(revenue_potential DESC);
```

#### 1.2 Create node_metrics table

```sql
CREATE TABLE node_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  node_id UUID NOT NULL REFERENCES taxonomy_nodes(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  source VARCHAR(20) NOT NULL CHECK (source IN ('gsc', 'ga4', 'shopify')),

  -- GSC Metrics
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  ctr DECIMAL(5,4) DEFAULT 0,
  position DECIMAL(4,2) DEFAULT 0,

  -- GA4 Metrics
  sessions INTEGER DEFAULT 0,
  revenue DECIMAL(12,2) DEFAULT 0,
  transactions INTEGER DEFAULT 0,
  conversion_rate DECIMAL(5,4) DEFAULT 0,
  avg_session_duration INTEGER DEFAULT 0,
  bounce_rate DECIMAL(5,4) DEFAULT 0,

  -- Shopify Metrics (future)
  product_views INTEGER DEFAULT 0,
  add_to_carts INTEGER DEFAULT 0,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(node_id, date, source)
);

-- Performance indexes
CREATE INDEX idx_node_metrics_node_date ON node_metrics(node_id, date DESC);
CREATE INDEX idx_node_metrics_date ON node_metrics(date DESC);
CREATE INDEX idx_node_metrics_source ON node_metrics(source);
```

#### 1.3 Create opportunities table

```sql
CREATE TABLE opportunities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  node_id UUID NOT NULL REFERENCES taxonomy_nodes(id) ON DELETE CASCADE,
  score DECIMAL(6,2) NOT NULL,
  revenue_potential DECIMAL(12,2) NOT NULL,
  priority INTEGER NOT NULL CHECK (priority BETWEEN 1 AND 100),

  -- Scoring factors (for transparency and debugging)
  factors JSONB NOT NULL DEFAULT '{}',
  /* Example factors JSON:
  {
    "search_volume": 0.75,
    "ctr_gap": 0.82,
    "position_potential": 0.45,
    "competition": 0.30,
    "revenue_impact": 0.90,
    "confidence": 0.85
  }
  */

  -- Recommendations
  recommendations JSONB DEFAULT '[]',
  /* Example recommendations JSON:
  [{
    "type": "ctr_optimization",
    "priority": "high",
    "action": "Update meta description",
    "impact": "+250 clicks/month"
  }]
  */

  computed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  valid_until TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days'),

  UNIQUE(node_id)
);

-- Performance indexes
CREATE INDEX idx_opportunities_score ON opportunities(score DESC);
CREATE INDEX idx_opportunities_priority ON opportunities(priority);
CREATE INDEX idx_opportunities_revenue ON opportunities(revenue_potential DESC);
CREATE INDEX idx_opportunities_valid ON opportunities(valid_until);
```

### 2. Migration Implementation

#### File: `supabase/migrations/009_node_centric_model.sql`

```sql
-- Migration: Node-Centric Model for Phase 1 MVP
-- Author: Backend Team
-- Date: 2024-03-XX

BEGIN;

-- 1. Modify taxonomy_nodes table
ALTER TABLE taxonomy_nodes
ADD COLUMN IF NOT EXISTS opportunity_score DECIMAL(6,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS revenue_potential DECIMAL(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS optimization_status VARCHAR(20) DEFAULT 'no_data',
ADD COLUMN IF NOT EXISTS last_scored_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS metrics_updated_at TIMESTAMP WITH TIME ZONE;

-- Add constraint for optimization_status
DO $$ BEGIN
  ALTER TABLE taxonomy_nodes
  ADD CONSTRAINT chk_optimization_status
  CHECK (optimization_status IN ('optimized', 'needs_work', 'critical', 'no_data'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2. Create node_metrics table
CREATE TABLE IF NOT EXISTS node_metrics (
  -- [full schema from above]
);

-- 3. Create opportunities table
CREATE TABLE IF NOT EXISTS opportunities (
  -- [full schema from above]
);

-- 4. Create update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_node_metrics_updated_at
BEFORE UPDATE ON node_metrics
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 5. Add RLS policies (if needed)
ALTER TABLE node_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;

-- Add policies based on project access
CREATE POLICY "Users can view metrics for their projects" ON node_metrics
FOR SELECT
USING (
  node_id IN (
    SELECT tn.id FROM taxonomy_nodes tn
    JOIN projects p ON tn.project_id = p.id
    WHERE p.organization_id = auth.jwt() ->> 'org_id'
  )
);

COMMIT;
```

### 3. Rollback Script

#### File: `supabase/migrations/009_node_centric_model_rollback.sql`

```sql
BEGIN;

-- Remove columns from taxonomy_nodes
ALTER TABLE taxonomy_nodes
DROP COLUMN IF EXISTS opportunity_score,
DROP COLUMN IF EXISTS revenue_potential,
DROP COLUMN IF EXISTS optimization_status,
DROP COLUMN IF EXISTS last_scored_at,
DROP COLUMN IF EXISTS metrics_updated_at;

-- Drop tables
DROP TABLE IF EXISTS opportunities;
DROP TABLE IF EXISTS node_metrics;

-- Drop triggers
DROP TRIGGER IF EXISTS update_node_metrics_updated_at ON node_metrics;
DROP FUNCTION IF EXISTS update_updated_at_column();

COMMIT;
```

### 4. Testing

#### 4.1 Local Testing

```bash
# Apply migration locally
supabase migration up

# Test migration
npm run test:migration

# Verify tables created
supabase db dump --schema-only | grep -E "(node_metrics|opportunities)"
```

#### 4.2 Test Queries

```typescript
// test/migrations/009_node_centric_model.test.ts
import { createClient } from '@/lib/supabase/server';

describe('Node-Centric Model Migration', () => {
  it('should create node_metrics table', async () => {
    const { data, error } = await supabase.from('node_metrics').select('*').limit(1);

    expect(error).toBeNull();
  });

  it('should create opportunities table', async () => {
    const { data, error } = await supabase.from('opportunities').select('*').limit(1);

    expect(error).toBeNull();
  });

  it('should add new columns to taxonomy_nodes', async () => {
    const { data, error } = await supabase
      .from('taxonomy_nodes')
      .select('opportunity_score, revenue_potential, optimization_status')
      .limit(1);

    expect(error).toBeNull();
  });

  it('should enforce optimization_status constraint', async () => {
    const { error } = await supabase
      .from('taxonomy_nodes')
      .update({ optimization_status: 'invalid_status' })
      .eq('id', 'test-id');

    expect(error).toBeTruthy();
    expect(error.message).toContain('chk_optimization_status');
  });
});
```

### 5. Data Types Reference

#### TypeScript Interfaces

```typescript
// types/database.types.ts
export interface TaxonomyNode {
  id: string;
  project_id: string;
  url: string;
  title: string;
  // New fields
  opportunity_score: number;
  revenue_potential: number;
  optimization_status: 'optimized' | 'needs_work' | 'critical' | 'no_data';
  last_scored_at?: Date;
  metrics_updated_at?: Date;
}

export interface NodeMetrics {
  id: string;
  node_id: string;
  date: Date;
  source: 'gsc' | 'ga4' | 'shopify';
  // GSC
  impressions?: number;
  clicks?: number;
  ctr?: number;
  position?: number;
  // GA4
  sessions?: number;
  revenue?: number;
  transactions?: number;
  conversion_rate?: number;
}

export interface Opportunity {
  id: string;
  node_id: string;
  score: number;
  revenue_potential: number;
  priority: number;
  factors: OpportunityFactors;
  recommendations: Recommendation[];
  computed_at: Date;
  valid_until: Date;
}
```

## Acceptance Criteria

- [ ] Migration script created and tested locally
- [ ] All tables created with proper indexes
- [ ] Foreign key relationships validated
- [ ] Constraints working (optimization_status)
- [ ] Rollback script tested
- [ ] TypeScript types updated
- [ ] RLS policies configured
- [ ] Migration runs in <5 seconds
- [ ] No data loss on existing tables
- [ ] Documentation updated

## Implementation Steps

1. **Hour 1**: Write migration script
2. **Hour 2**: Write rollback script and test locally
3. **Hour 3**: Update TypeScript types and write tests
4. **Hour 4**: Apply to staging, test, and document

## Risk Mitigation

- **Risk**: Migration fails on production
  - **Mitigation**: Test on staging first, have rollback ready
- **Risk**: Performance impact on large datasets
  - **Mitigation**: Run during low-traffic window, indexes included

- **Risk**: Breaking existing code
  - **Mitigation**: New columns have defaults, no columns removed

## Dependencies for Next Tasks

This migration enables:

- TASK-002: Hierarchy Builder (needs updated node structure)
- TASK-006: Metrics Sync Job (needs node_metrics table)
- TASK-010: Opportunity Scorer (needs opportunities table)

## Notes

- Consider adding partition by date on node_metrics for better performance
- May need to adjust decimal precision based on real data
- Indexes can be fine-tuned based on query patterns
