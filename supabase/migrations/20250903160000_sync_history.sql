-- Create sync_history table for tracking metrics sync jobs
CREATE TABLE IF NOT EXISTS sync_history (
  id TEXT PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  sync_type VARCHAR(50) NOT NULL DEFAULT 'metrics',
  sources TEXT[] DEFAULT '{}',
  date_range JSONB,
  status VARCHAR(50) NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  stats JSONB DEFAULT '{}',
  errors JSONB DEFAULT '[]',
  started_at TIMESTAMP WITH TIME ZONE NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE,
  duration_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_sync_history_project_id ON sync_history(project_id);
CREATE INDEX idx_sync_history_sync_type ON sync_history(sync_type);
CREATE INDEX idx_sync_history_status ON sync_history(status);
CREATE INDEX idx_sync_history_started_at ON sync_history(started_at DESC);

-- Enable RLS
ALTER TABLE sync_history ENABLE ROW LEVEL SECURITY;

-- Users can view sync history for their projects
CREATE POLICY "Users can view own sync history" ON sync_history
  FOR SELECT USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

-- Service role can manage all sync history
CREATE POLICY "Service role can manage sync history" ON sync_history
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');