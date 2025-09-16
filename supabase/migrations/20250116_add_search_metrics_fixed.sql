-- Migration: Add Search Console metrics support (Fixed)
-- Description: Creates tables and indexes for storing Google Search Console metrics data with existence checks
-- Author: James (Dev Agent)
-- Date: 2025-01-16

-- Create search_metrics table for storing GSC data
CREATE TABLE IF NOT EXISTS search_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id TEXT REFERENCES taxonomy_nodes(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  clicks INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  ctr DECIMAL(5,4) DEFAULT 0,
  position DECIMAL(4,1) DEFAULT 0,
  date DATE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(url, date, user_id)
);

-- Create indexes for efficient querying (with existence checks)
CREATE INDEX IF NOT EXISTS idx_search_metrics_node_date ON search_metrics(node_id, date);
CREATE INDEX IF NOT EXISTS idx_search_metrics_url ON search_metrics(url);
CREATE INDEX IF NOT EXISTS idx_search_metrics_user_date ON search_metrics(user_id, date DESC);

-- Enable Row Level Security (only if not already enabled)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables
    WHERE tablename = 'search_metrics'
    AND rowsecurity = true
  ) THEN
    ALTER TABLE search_metrics ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- RLS Policies (drop and recreate to ensure they're current)
DROP POLICY IF EXISTS "Users can view own search metrics" ON search_metrics;
CREATE POLICY "Users can view own search metrics"
  ON search_metrics FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own search metrics" ON search_metrics;
CREATE POLICY "Users can insert own search metrics"
  ON search_metrics FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own search metrics" ON search_metrics;
CREATE POLICY "Users can update own search metrics"
  ON search_metrics FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own search metrics" ON search_metrics;
CREATE POLICY "Users can delete own search metrics"
  ON search_metrics FOR DELETE
  USING (auth.uid() = user_id);

-- Create aggregated_search_metrics view for category-level rollups
CREATE OR REPLACE VIEW aggregated_search_metrics AS
SELECT
  node_id,
  date,
  user_id,
  SUM(clicks) as total_clicks,
  SUM(impressions) as total_impressions,
  CASE
    WHEN SUM(impressions) > 0 THEN SUM(clicks)::DECIMAL / SUM(impressions)::DECIMAL
    ELSE 0
  END as avg_ctr,
  AVG(position) as avg_position,
  COUNT(DISTINCT url) as url_count,
  MAX(updated_at) as last_updated
FROM search_metrics
WHERE node_id IS NOT NULL
GROUP BY node_id, date, user_id;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_search_metrics_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at (drop first if exists)
DROP TRIGGER IF EXISTS update_search_metrics_updated_at_trigger ON search_metrics;
CREATE TRIGGER update_search_metrics_updated_at_trigger
  BEFORE UPDATE ON search_metrics
  FOR EACH ROW
  EXECUTE FUNCTION update_search_metrics_updated_at();

-- Create table for storing GSC sync status
CREATE TABLE IF NOT EXISTS gsc_sync_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  last_sync_at TIMESTAMPTZ,
  sync_status TEXT CHECK (sync_status IN ('pending', 'running', 'completed', 'failed')),
  sync_message TEXT,
  metrics_synced INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Enable RLS for sync status table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables
    WHERE tablename = 'gsc_sync_status'
    AND rowsecurity = true
  ) THEN
    ALTER TABLE gsc_sync_status ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- RLS Policies for sync status
DROP POLICY IF EXISTS "Users can view own sync status" ON gsc_sync_status;
CREATE POLICY "Users can view own sync status"
  ON gsc_sync_status FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own sync status" ON gsc_sync_status;
CREATE POLICY "Users can manage own sync status"
  ON gsc_sync_status FOR ALL
  USING (auth.uid() = user_id);

-- Create function to match URLs to taxonomy nodes
CREATE OR REPLACE FUNCTION match_url_to_node(
  p_url TEXT,
  p_user_id UUID
) RETURNS TEXT AS $$
DECLARE
  v_node_id TEXT;
  v_normalized_url TEXT;
BEGIN
  -- Normalize the URL (remove trailing slash, lowercase)
  v_normalized_url := LOWER(TRIM(TRAILING '/' FROM p_url));

  -- Try exact URL match first
  SELECT id INTO v_node_id
  FROM taxonomy_nodes
  WHERE user_id = p_user_id
    AND LOWER(TRIM(TRAILING '/' FROM url)) = v_normalized_url
  LIMIT 1;

  IF v_node_id IS NOT NULL THEN
    RETURN v_node_id;
  END IF;

  -- Try path-based match
  SELECT id INTO v_node_id
  FROM taxonomy_nodes
  WHERE user_id = p_user_id
    AND path IS NOT NULL
    AND v_normalized_url LIKE '%' || LOWER(path) || '%'
  ORDER BY LENGTH(path) DESC
  LIMIT 1;

  RETURN v_node_id;
END;
$$ LANGUAGE plpgsql;

-- Add comment documentation
COMMENT ON TABLE search_metrics IS 'Stores Google Search Console metrics data for URLs and taxonomy nodes';
COMMENT ON TABLE gsc_sync_status IS 'Tracks the synchronization status of GSC data imports';
COMMENT ON FUNCTION match_url_to_node IS 'Matches a URL to a taxonomy node using various strategies';