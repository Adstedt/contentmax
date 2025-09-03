-- Create import_history table for tracking batch imports
CREATE TABLE IF NOT EXISTS import_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  total_nodes INTEGER NOT NULL,
  successful_nodes INTEGER DEFAULT 0,
  failed_nodes INTEGER DEFAULT 0,
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  options JSONB DEFAULT '{}',
  errors JSONB DEFAULT '[]',
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create import_progress table for real-time progress tracking
CREATE TABLE IF NOT EXISTS import_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id UUID NOT NULL REFERENCES import_history(id) ON DELETE CASCADE,
  processed INTEGER NOT NULL DEFAULT 0,
  successful INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0,
  percentage INTEGER NOT NULL DEFAULT 0,
  current_chunk INTEGER,
  total_chunks INTEGER,
  message TEXT,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_import_history_project_id ON import_history(project_id);
CREATE INDEX idx_import_history_user_id ON import_history(user_id);
CREATE INDEX idx_import_history_status ON import_history(status);
CREATE INDEX idx_import_history_started_at ON import_history(started_at DESC);
CREATE INDEX idx_import_progress_import_id ON import_progress(import_id);
CREATE INDEX idx_import_progress_timestamp ON import_progress(timestamp DESC);

-- Add RLS policies
ALTER TABLE import_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_progress ENABLE ROW LEVEL SECURITY;

-- Users can only view their own import history
CREATE POLICY "Users can view own import history" ON import_history
  FOR SELECT USING (auth.uid() = user_id);

-- Users can create their own import history
CREATE POLICY "Users can create own import history" ON import_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own import history
CREATE POLICY "Users can update own import history" ON import_history
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can view progress for their imports
CREATE POLICY "Users can view own import progress" ON import_progress
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM import_history
      WHERE import_history.id = import_progress.import_id
      AND import_history.user_id = auth.uid()
    )
  );

-- Service role can manage all import progress
CREATE POLICY "Service role can manage import progress" ON import_progress
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_import_history_updated_at BEFORE UPDATE
  ON import_history FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add function to clean up old import records (older than 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_imports()
RETURNS void AS $$
BEGIN
  DELETE FROM import_history
  WHERE completed_at IS NOT NULL 
  AND completed_at < NOW() - INTERVAL '30 days';
  
  DELETE FROM import_progress
  WHERE timestamp < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create scheduled job for cleanup (if using pg_cron extension)
-- SELECT cron.schedule('cleanup-old-imports', '0 2 * * *', 'SELECT cleanup_old_imports();');