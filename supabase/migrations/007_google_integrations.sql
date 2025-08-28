-- Create google_integrations table
CREATE TABLE IF NOT EXISTS google_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  refresh_token TEXT NOT NULL, -- Encrypted
  access_token TEXT, -- Encrypted
  token_expiry TIMESTAMPTZ,
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  last_sync TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Create gsc_data table for storing Google Search Console data
CREATE TABLE IF NOT EXISTS gsc_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  date DATE NOT NULL,
  clicks INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  ctr DECIMAL(5,4) DEFAULT 0,
  position DECIMAL(6,2) DEFAULT 0,
  data JSONB, -- Additional data (queries, pages, devices, etc.)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, url, date)
);

-- Create audit_logs table if it doesn't exist
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX idx_google_integrations_user ON google_integrations(user_id);
CREATE INDEX idx_google_integrations_email ON google_integrations(email);
CREATE INDEX idx_gsc_data_project ON gsc_data(project_id);
CREATE INDEX idx_gsc_data_url ON gsc_data(url);
CREATE INDEX idx_gsc_data_date ON gsc_data(date DESC);
CREATE INDEX idx_gsc_data_project_date ON gsc_data(project_id, date DESC);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);

-- Create a view for GSC performance summary
CREATE OR REPLACE VIEW gsc_performance_summary AS
SELECT 
  project_id,
  url,
  DATE_TRUNC('month', date) as month,
  SUM(clicks) as total_clicks,
  SUM(impressions) as total_impressions,
  AVG(ctr) as avg_ctr,
  AVG(position) as avg_position,
  COUNT(DISTINCT date) as days_with_data
FROM gsc_data
GROUP BY project_id, url, DATE_TRUNC('month', date);

-- Create a view for top performing pages
CREATE OR REPLACE VIEW gsc_top_pages AS
SELECT 
  project_id,
  url,
  SUM(clicks) as total_clicks,
  SUM(impressions) as total_impressions,
  AVG(ctr) as avg_ctr,
  AVG(position) as avg_position,
  MAX(date) as last_updated
FROM gsc_data
WHERE date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY project_id, url
ORDER BY total_clicks DESC;

-- Create a function to calculate GSC trends
CREATE OR REPLACE FUNCTION calculate_gsc_trend(
  p_project_id UUID,
  p_url TEXT,
  p_metric TEXT,
  p_days INTEGER DEFAULT 30
) RETURNS TABLE (
  period TEXT,
  value DECIMAL,
  change_percent DECIMAL
) AS $$
DECLARE
  current_period_start DATE := CURRENT_DATE - (p_days - 1);
  previous_period_start DATE := current_period_start - p_days;
BEGIN
  RETURN QUERY
  WITH current_period AS (
    SELECT 
      CASE 
        WHEN p_metric = 'clicks' THEN SUM(clicks)::DECIMAL
        WHEN p_metric = 'impressions' THEN SUM(impressions)::DECIMAL
        WHEN p_metric = 'ctr' THEN AVG(ctr)::DECIMAL
        WHEN p_metric = 'position' THEN AVG(position)::DECIMAL
      END as value
    FROM gsc_data
    WHERE project_id = p_project_id 
      AND url = p_url
      AND date >= current_period_start
      AND date <= CURRENT_DATE
  ),
  previous_period AS (
    SELECT 
      CASE 
        WHEN p_metric = 'clicks' THEN SUM(clicks)::DECIMAL
        WHEN p_metric = 'impressions' THEN SUM(impressions)::DECIMAL
        WHEN p_metric = 'ctr' THEN AVG(ctr)::DECIMAL
        WHEN p_metric = 'position' THEN AVG(position)::DECIMAL
      END as value
    FROM gsc_data
    WHERE project_id = p_project_id 
      AND url = p_url
      AND date >= previous_period_start
      AND date < current_period_start
  )
  SELECT 
    'current' as period,
    COALESCE(c.value, 0) as value,
    CASE 
      WHEN p.value IS NULL OR p.value = 0 THEN 0
      ELSE ROUND(((c.value - p.value) / p.value * 100), 2)
    END as change_percent
  FROM current_period c, previous_period p
  UNION ALL
  SELECT 
    'previous' as period,
    COALESCE(p.value, 0) as value,
    0 as change_percent
  FROM previous_period p;
END;
$$ LANGUAGE plpgsql;

-- Row Level Security
ALTER TABLE google_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE gsc_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy for google_integrations: Users can only manage their own integration
CREATE POLICY "Users can manage their own Google integration"
  ON google_integrations
  FOR ALL
  USING (user_id = auth.uid());

-- Policy for gsc_data: Users can view data for their projects
CREATE POLICY "Users can view GSC data for their projects"
  ON gsc_data
  FOR SELECT
  USING (
    project_id IN (
      SELECT p.id FROM projects p
      JOIN organizations o ON p.organization_id = o.id
      JOIN users u ON u.organization_id = o.id
      WHERE u.id = auth.uid()
    )
  );

-- Policy for gsc_data: Users can insert/update data for their projects
CREATE POLICY "Users can manage GSC data for their projects"
  ON gsc_data
  FOR ALL
  USING (
    project_id IN (
      SELECT p.id FROM projects p
      JOIN organizations o ON p.organization_id = o.id
      JOIN users u ON u.organization_id = o.id
      WHERE u.id = auth.uid()
    )
  );

-- Policy for audit_logs: Users can view their own audit logs
CREATE POLICY "Users can view their own audit logs"
  ON audit_logs
  FOR SELECT
  USING (user_id = auth.uid());

-- Policy for audit_logs: System can insert audit logs
CREATE POLICY "System can insert audit logs"
  ON audit_logs
  FOR INSERT
  WITH CHECK (true);

-- Grant permissions
GRANT ALL ON google_integrations TO authenticated;
GRANT ALL ON gsc_data TO authenticated;
GRANT SELECT, INSERT ON audit_logs TO authenticated;
GRANT SELECT ON gsc_performance_summary TO authenticated;
GRANT SELECT ON gsc_top_pages TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_gsc_trend TO authenticated;