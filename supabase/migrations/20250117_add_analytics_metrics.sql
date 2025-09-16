-- Migration: Add Google Analytics 4 metrics support
-- Description: Creates tables and indexes for storing GA4 analytics data
-- Author: James (Dev Agent)
-- Date: 2025-01-17

-- Create analytics_metrics table for storing GA4 data
CREATE TABLE IF NOT EXISTS analytics_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id TEXT REFERENCES taxonomy_nodes(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES products(id) ON DELETE CASCADE,
  page_path TEXT NOT NULL,
  sessions INTEGER DEFAULT 0,
  users INTEGER DEFAULT 0,
  revenue DECIMAL(12,2) DEFAULT 0,
  transactions INTEGER DEFAULT 0,
  conversion_rate DECIMAL(5,4) DEFAULT 0,
  avg_order_value DECIMAL(10,2) DEFAULT 0,
  engagement_rate DECIMAL(5,4) DEFAULT 0,
  bounce_rate DECIMAL(5,4) DEFAULT 0,
  avg_session_duration INTEGER DEFAULT 0, -- in seconds
  page_views INTEGER DEFAULT 0,
  date DATE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(page_path, date, user_id)
);

-- Create indexes for efficient querying
CREATE INDEX idx_analytics_metrics_node_date ON analytics_metrics(node_id, date);
CREATE INDEX idx_analytics_metrics_revenue ON analytics_metrics(revenue DESC);
CREATE INDEX idx_analytics_metrics_page ON analytics_metrics(page_path);
CREATE INDEX idx_analytics_metrics_product ON analytics_metrics(product_id);
CREATE INDEX idx_analytics_metrics_user_date ON analytics_metrics(user_id, date DESC);
CREATE INDEX idx_analytics_metrics_conversion ON analytics_metrics(conversion_rate DESC);

-- Enable Row Level Security
ALTER TABLE analytics_metrics ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own analytics metrics"
  ON analytics_metrics FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own analytics metrics"
  ON analytics_metrics FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own analytics metrics"
  ON analytics_metrics FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own analytics metrics"
  ON analytics_metrics FOR DELETE
  USING (auth.uid() = user_id);

-- Create aggregated view for category-level revenue rollups
CREATE OR REPLACE VIEW aggregated_analytics_metrics AS
SELECT
  node_id,
  date,
  user_id,
  SUM(sessions) as total_sessions,
  SUM(users) as total_users,
  SUM(revenue) as total_revenue,
  SUM(transactions) as total_transactions,
  CASE
    WHEN SUM(sessions) > 0 THEN SUM(transactions)::DECIMAL / SUM(sessions)::DECIMAL
    ELSE 0
  END as avg_conversion_rate,
  CASE
    WHEN SUM(transactions) > 0 THEN SUM(revenue)::DECIMAL / SUM(transactions)::DECIMAL
    ELSE 0
  END as avg_order_value,
  AVG(engagement_rate) as avg_engagement_rate,
  AVG(bounce_rate) as avg_bounce_rate,
  AVG(avg_session_duration) as avg_session_duration,
  SUM(page_views) as total_page_views,
  COUNT(DISTINCT page_path) as unique_pages,
  MAX(updated_at) as last_updated
FROM analytics_metrics
WHERE node_id IS NOT NULL
GROUP BY node_id, date, user_id;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_analytics_metrics_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at
CREATE TRIGGER update_analytics_metrics_updated_at_trigger
  BEFORE UPDATE ON analytics_metrics
  FOR EACH ROW
  EXECUTE FUNCTION update_analytics_metrics_updated_at();

-- Create table for storing GA4 sync status
CREATE TABLE IF NOT EXISTS ga4_sync_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id TEXT NOT NULL,
  last_sync_at TIMESTAMPTZ,
  sync_status TEXT CHECK (sync_status IN ('pending', 'running', 'completed', 'failed')),
  sync_message TEXT,
  metrics_synced INTEGER DEFAULT 0,
  error_details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, property_id)
);

-- Enable RLS for sync status table
ALTER TABLE ga4_sync_status ENABLE ROW LEVEL SECURITY;

-- RLS Policies for sync status
CREATE POLICY "Users can view own GA4 sync status"
  ON ga4_sync_status FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own GA4 sync status"
  ON ga4_sync_status FOR ALL
  USING (auth.uid() = user_id);

-- Create product revenue tracking table
CREATE TABLE IF NOT EXISTS product_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id TEXT REFERENCES products(id) ON DELETE CASCADE,
  item_name TEXT,
  item_category TEXT,
  item_revenue DECIMAL(12,2) DEFAULT 0,
  items_purchased INTEGER DEFAULT 0,
  items_viewed INTEGER DEFAULT 0,
  cart_additions INTEGER DEFAULT 0,
  cart_removals INTEGER DEFAULT 0,
  purchase_to_view_rate DECIMAL(5,4) DEFAULT 0,
  date DATE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_id, date, user_id)
);

-- Create indexes for product analytics
CREATE INDEX idx_product_analytics_product_date ON product_analytics(product_id, date);
CREATE INDEX idx_product_analytics_revenue ON product_analytics(item_revenue DESC);
CREATE INDEX idx_product_analytics_user_date ON product_analytics(user_id, date DESC);

-- Enable RLS for product analytics
ALTER TABLE product_analytics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for product analytics
CREATE POLICY "Users can view own product analytics"
  ON product_analytics FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own product analytics"
  ON product_analytics FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own product analytics"
  ON product_analytics FOR UPDATE
  USING (auth.uid() = user_id);

-- Create function to match GA4 page paths to taxonomy nodes
CREATE OR REPLACE FUNCTION match_ga4_to_node(
  p_page_path TEXT,
  p_user_id UUID
) RETURNS TEXT AS $$
DECLARE
  v_node_id TEXT;
  v_normalized_path TEXT;
BEGIN
  -- Normalize the page path (remove trailing slash, lowercase, remove query params)
  v_normalized_path := LOWER(TRIM(TRAILING '/' FROM SPLIT_PART(p_page_path, '?', 1)));

  -- Try exact URL match first
  SELECT id INTO v_node_id
  FROM taxonomy_nodes
  WHERE user_id = p_user_id
    AND LOWER(TRIM(TRAILING '/' FROM SPLIT_PART(url, '?', 1))) = v_normalized_path
  LIMIT 1;

  IF v_node_id IS NOT NULL THEN
    RETURN v_node_id;
  END IF;

  -- Try path-based match
  SELECT id INTO v_node_id
  FROM taxonomy_nodes
  WHERE user_id = p_user_id
    AND path IS NOT NULL
    AND v_normalized_path LIKE '%' || LOWER(path) || '%'
  ORDER BY LENGTH(path) DESC
  LIMIT 1;

  IF v_node_id IS NOT NULL THEN
    RETURN v_node_id;
  END IF;

  -- Try category name match in path
  SELECT id INTO v_node_id
  FROM taxonomy_nodes
  WHERE user_id = p_user_id
    AND title IS NOT NULL
    AND v_normalized_path LIKE '%' || LOWER(REPLACE(title, ' ', '-')) || '%'
  ORDER BY LENGTH(title) DESC
  LIMIT 1;

  RETURN v_node_id;
END;
$$ LANGUAGE plpgsql;

-- Add comment documentation
COMMENT ON TABLE analytics_metrics IS 'Stores Google Analytics 4 metrics data for pages and taxonomy nodes';
COMMENT ON TABLE ga4_sync_status IS 'Tracks the synchronization status of GA4 data imports';
COMMENT ON TABLE product_analytics IS 'Stores product-level analytics from GA4 enhanced e-commerce';
COMMENT ON FUNCTION match_ga4_to_node IS 'Matches GA4 page paths to taxonomy nodes using various strategies';