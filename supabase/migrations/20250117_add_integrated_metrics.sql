-- Migration: Add integrated metrics tables for STORY-023
-- This creates the foundation for matching external metrics to taxonomy nodes and products
-- Builds upon existing search_metrics and analytics_metrics tables

-- Master metrics table that ties everything together
CREATE TABLE IF NOT EXISTS integrated_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT CHECK (entity_type IN ('node', 'product')) NOT NULL,
  entity_id TEXT NOT NULL,

  -- Search Console metrics
  gsc_clicks INTEGER DEFAULT 0,
  gsc_impressions INTEGER DEFAULT 0,
  gsc_ctr DECIMAL(5,4) DEFAULT 0,
  gsc_position DECIMAL(4,1) DEFAULT 0,
  gsc_match_confidence DECIMAL(3,2),

  -- GA4 metrics
  ga4_sessions INTEGER DEFAULT 0,
  ga4_revenue DECIMAL(12,2) DEFAULT 0,
  ga4_transactions INTEGER DEFAULT 0,
  ga4_conversion_rate DECIMAL(5,4) DEFAULT 0,
  ga4_match_confidence DECIMAL(3,2),

  -- Market pricing metrics
  market_price_median DECIMAL(10,2),
  market_competitor_count INTEGER,
  price_position TEXT CHECK (price_position IN ('below', 'at', 'above', 'lowest', 'highest')),
  market_match_confidence DECIMAL(3,2),

  -- Aggregation metadata
  is_aggregated BOOLEAN DEFAULT false,
  child_count INTEGER DEFAULT 0,

  -- Timestamps
  metrics_date DATE NOT NULL,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,

  UNIQUE(entity_type, entity_id, metrics_date, user_id)
);

-- Index for fast lookups
CREATE INDEX idx_integrated_metrics_entity ON integrated_metrics(entity_type, entity_id);
CREATE INDEX idx_integrated_metrics_user_date ON integrated_metrics(user_id, metrics_date);
CREATE INDEX idx_integrated_metrics_aggregated ON integrated_metrics(is_aggregated) WHERE is_aggregated = true;

-- Unmatched data tracking for items we couldn't match
CREATE TABLE IF NOT EXISTS unmatched_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT CHECK (source IN ('gsc', 'ga4', 'market', 'merchant')) NOT NULL,
  identifier TEXT NOT NULL, -- URL, path, or GTIN
  identifier_type TEXT CHECK (identifier_type IN ('url', 'path', 'gtin', 'sku')) NOT NULL,
  metrics JSONB NOT NULL, -- Raw metrics data
  match_attempts INTEGER DEFAULT 1,
  last_attempt_at TIMESTAMPTZ DEFAULT NOW(),
  resolved BOOLEAN DEFAULT false,
  resolved_entity_type TEXT CHECK (resolved_entity_type IN ('node', 'product')),
  resolved_entity_id TEXT,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for finding unmatched items
CREATE INDEX idx_unmatched_metrics_source ON unmatched_metrics(source, resolved);
CREATE INDEX idx_unmatched_metrics_identifier ON unmatched_metrics(identifier);
CREATE INDEX idx_unmatched_metrics_user ON unmatched_metrics(user_id);

-- Manual mapping overrides for fixing incorrect matches
CREATE TABLE IF NOT EXISTS metric_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_identifier TEXT NOT NULL,
  source_type TEXT CHECK (source_type IN ('url', 'path', 'gtin', 'sku')) NOT NULL,
  entity_type TEXT CHECK (entity_type IN ('node', 'product')) NOT NULL,
  entity_id TEXT NOT NULL,
  confidence DECIMAL(3,2) DEFAULT 1.00, -- Manual mappings have high confidence
  active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source_identifier, entity_type, entity_id, created_by)
);

-- Index for fast mapping lookups
CREATE INDEX idx_metric_mappings_identifier ON metric_mappings(source_identifier) WHERE active = true;
CREATE INDEX idx_metric_mappings_entity ON metric_mappings(entity_type, entity_id) WHERE active = true;

-- Match history for debugging and improving match accuracy
CREATE TABLE IF NOT EXISTS match_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT CHECK (source IN ('gsc', 'ga4', 'market', 'merchant')) NOT NULL,
  identifier TEXT NOT NULL,
  match_strategy TEXT CHECK (match_strategy IN ('exact_url', 'path_match', 'product_id', 'category_match', 'fuzzy_match', 'manual', 'gtin_exact')) NOT NULL,
  matched_entity_type TEXT CHECK (matched_entity_type IN ('node', 'product')),
  matched_entity_id TEXT,
  confidence DECIMAL(3,2),
  success BOOLEAN NOT NULL,
  error_reason TEXT,
  processing_time_ms INTEGER,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for analyzing match performance
CREATE INDEX idx_match_history_strategy ON match_history(match_strategy, success);
CREATE INDEX idx_match_history_source ON match_history(source, created_at);

-- Cache for URL to entity mappings (speeds up repeated integrations)
CREATE TABLE IF NOT EXISTS url_entity_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL,
  normalized_url TEXT NOT NULL, -- URL after normalization
  entity_type TEXT CHECK (entity_type IN ('node', 'product')) NOT NULL,
  entity_id TEXT NOT NULL,
  confidence DECIMAL(3,2) NOT NULL,
  match_strategy TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  UNIQUE(normalized_url, user_id)
);

-- Index for fast cache lookups (without the WHERE clause since NOW() is not immutable)
CREATE INDEX idx_url_entity_cache_lookup ON url_entity_cache(normalized_url, user_id, expires_at);

-- RLS Policies
ALTER TABLE integrated_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE unmatched_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE metric_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE url_entity_cache ENABLE ROW LEVEL SECURITY;

-- Policies for integrated_metrics
CREATE POLICY "Users can view their own integrated metrics" ON integrated_metrics
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own integrated metrics" ON integrated_metrics
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own integrated metrics" ON integrated_metrics
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own integrated metrics" ON integrated_metrics
  FOR DELETE USING (auth.uid() = user_id);

-- Policies for unmatched_metrics
CREATE POLICY "Users can view their own unmatched metrics" ON unmatched_metrics
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own unmatched metrics" ON unmatched_metrics
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own unmatched metrics" ON unmatched_metrics
  FOR UPDATE USING (auth.uid() = user_id);

-- Policies for metric_mappings
CREATE POLICY "Users can view their own mappings" ON metric_mappings
  FOR SELECT USING (auth.uid() = created_by);

CREATE POLICY "Users can create their own mappings" ON metric_mappings
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own mappings" ON metric_mappings
  FOR UPDATE USING (auth.uid() = created_by);

-- Policies for match_history
CREATE POLICY "Users can view their own match history" ON match_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own match history" ON match_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policies for url_entity_cache
CREATE POLICY "Users can view their own cache" ON url_entity_cache
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own cache" ON url_entity_cache
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own cache" ON url_entity_cache
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own cache" ON url_entity_cache
  FOR DELETE USING (auth.uid() = user_id);

-- Function to clean up expired cache entries
CREATE OR REPLACE FUNCTION clean_expired_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM url_entity_cache WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE integrated_metrics IS 'Stores integrated metrics from all sources matched to entities';
COMMENT ON TABLE unmatched_metrics IS 'Tracks metrics that could not be matched to any entity';
COMMENT ON TABLE metric_mappings IS 'Manual mappings to override automatic matching';
COMMENT ON TABLE match_history IS 'History of all match attempts for debugging and analysis';
COMMENT ON TABLE url_entity_cache IS 'Cache for URL to entity mappings to speed up repeated integrations';