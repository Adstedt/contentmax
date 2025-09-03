-- Migration: Node-Centric Model for Phase 1 MVP
-- Author: Backend Team
-- Date: 2025-01-03
-- Description: Adds opportunity scoring, metrics storage, and revenue calculation support

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

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_taxonomy_nodes_score ON taxonomy_nodes(opportunity_score DESC);
CREATE INDEX IF NOT EXISTS idx_taxonomy_nodes_status ON taxonomy_nodes(optimization_status);
CREATE INDEX IF NOT EXISTS idx_taxonomy_nodes_revenue ON taxonomy_nodes(revenue_potential DESC);

-- 2. Create node_metrics table
CREATE TABLE IF NOT EXISTS node_metrics (
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

-- Performance indexes for node_metrics
CREATE INDEX IF NOT EXISTS idx_node_metrics_node_date ON node_metrics(node_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_node_metrics_date ON node_metrics(date DESC);
CREATE INDEX IF NOT EXISTS idx_node_metrics_source ON node_metrics(source);

-- 3. Create opportunities table
CREATE TABLE IF NOT EXISTS opportunities (
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

-- Performance indexes for opportunities
CREATE INDEX IF NOT EXISTS idx_opportunities_score ON opportunities(score DESC);
CREATE INDEX IF NOT EXISTS idx_opportunities_priority ON opportunities(priority);
CREATE INDEX IF NOT EXISTS idx_opportunities_revenue ON opportunities(revenue_potential DESC);
CREATE INDEX IF NOT EXISTS idx_opportunities_valid ON opportunities(valid_until);

-- 4. Create update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists before creating new one
DROP TRIGGER IF EXISTS update_node_metrics_updated_at ON node_metrics;

CREATE TRIGGER update_node_metrics_updated_at
BEFORE UPDATE ON node_metrics
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 5. Add RLS policies
ALTER TABLE node_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;

-- Add policies based on project access
-- For now, create simple policies that allow authenticated users
-- These can be refined later based on your specific auth structure
CREATE POLICY "Users can view metrics for their projects" ON node_metrics
FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Users can insert metrics for their projects" ON node_metrics
FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update metrics for their projects" ON node_metrics
FOR UPDATE
USING (auth.role() = 'authenticated');

CREATE POLICY "Users can view opportunities for their projects" ON opportunities
FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Users can manage opportunities for their projects" ON opportunities
FOR ALL
USING (auth.role() = 'authenticated');

COMMIT;