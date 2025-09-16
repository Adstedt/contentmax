-- Create opportunity_scores table for storing calculated opportunity metrics
CREATE TABLE IF NOT EXISTS opportunity_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id TEXT REFERENCES taxonomy_nodes(id) ON DELETE CASCADE,
  score DECIMAL(5,2) NOT NULL CHECK (score >= 0 AND score <= 100),

  -- Individual scoring factors (0-100)
  traffic_potential DECIMAL(5,2) CHECK (traffic_potential >= 0 AND traffic_potential <= 100),
  revenue_potential DECIMAL(5,2) CHECK (revenue_potential >= 0 AND revenue_potential <= 100),
  pricing_opportunity DECIMAL(5,2) CHECK (pricing_opportunity >= 0 AND pricing_opportunity <= 100),
  competitive_gap DECIMAL(5,2) CHECK (competitive_gap >= 0 AND competitive_gap <= 100),
  content_quality DECIMAL(5,2) CHECK (content_quality >= 0 AND content_quality <= 100),

  -- Categorization
  opportunity_type TEXT CHECK (opportunity_type IN ('quick-win', 'strategic', 'incremental', 'long-term', 'maintain')),
  confidence_level TEXT CHECK (confidence_level IN ('high', 'medium', 'low')),
  effort_score DECIMAL(5,2) CHECK (effort_score >= 0 AND effort_score <= 100),

  -- Projected impact
  projected_impact_revenue DECIMAL(12,2),
  projected_impact_traffic INTEGER,
  projected_timeline_days INTEGER,

  -- Additional metadata
  factors JSONB DEFAULT '{}',
  recommendations TEXT[],
  data_sources TEXT[],

  -- Timestamps and ownership
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Constraints
  UNIQUE(node_id, user_id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX idx_opportunity_scores_ranking ON opportunity_scores(user_id, score DESC);
CREATE INDEX idx_opportunity_scores_type ON opportunity_scores(user_id, opportunity_type);
CREATE INDEX idx_opportunity_scores_node ON opportunity_scores(node_id);
CREATE INDEX idx_opportunity_scores_expires ON opportunity_scores(expires_at);

-- Create view for high-opportunity nodes
CREATE OR REPLACE VIEW high_opportunity_nodes AS
SELECT
  os.*,
  tn.title as node_title,
  tn.url as node_url,
  tn.path as node_path,
  tn.depth as node_depth,
  (SELECT COUNT(*) FROM products WHERE node_id = tn.id) as product_count
FROM opportunity_scores os
JOIN taxonomy_nodes tn ON os.node_id = tn.id
WHERE os.score > 70
  AND os.confidence_level IN ('high', 'medium')
  AND os.expires_at > NOW()
ORDER BY os.score DESC;

-- Create aggregated opportunity view by parent
CREATE OR REPLACE VIEW aggregated_opportunities AS
SELECT
  tn.parent_id,
  COUNT(DISTINCT os.node_id) as opportunity_count,
  AVG(os.score) as avg_opportunity_score,
  SUM(os.projected_impact_revenue) as total_revenue_opportunity,
  SUM(os.projected_impact_traffic) as total_traffic_opportunity,
  ARRAY_AGG(DISTINCT os.opportunity_type) as opportunity_types,
  os.user_id
FROM opportunity_scores os
JOIN taxonomy_nodes tn ON os.node_id = tn.id
WHERE os.expires_at > NOW()
GROUP BY tn.parent_id, os.user_id;

-- Enable Row Level Security
ALTER TABLE opportunity_scores ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view own opportunity scores"
  ON opportunity_scores FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own opportunity scores"
  ON opportunity_scores FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own opportunity scores"
  ON opportunity_scores FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own opportunity scores"
  ON opportunity_scores FOR DELETE
  USING (auth.uid() = user_id);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_opportunity_scores_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_opportunity_scores_updated_at
  BEFORE UPDATE ON opportunity_scores
  FOR EACH ROW
  EXECUTE FUNCTION update_opportunity_scores_updated_at();

-- Create function to clean up expired scores
CREATE OR REPLACE FUNCTION cleanup_expired_opportunity_scores()
RETURNS void AS $$
BEGIN
  DELETE FROM opportunity_scores WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON TABLE opportunity_scores IS 'Stores calculated opportunity scores for taxonomy nodes';
COMMENT ON COLUMN opportunity_scores.score IS 'Composite opportunity score (0-100)';
COMMENT ON COLUMN opportunity_scores.opportunity_type IS 'Categorization based on score and effort';
COMMENT ON COLUMN opportunity_scores.confidence_level IS 'Data availability confidence';
COMMENT ON COLUMN opportunity_scores.factors IS 'Detailed scoring factors and calculations';
COMMENT ON COLUMN opportunity_scores.expires_at IS 'Expiration time for score recalculation';