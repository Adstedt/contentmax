-- Create import_jobs table for tracking import tasks
CREATE TABLE IF NOT EXISTS import_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type VARCHAR(50) NOT NULL,
  config JSONB NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  retry_count INTEGER DEFAULT 0,
  next_retry_at TIMESTAMP,
  error_message TEXT,
  result JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for import_jobs
CREATE INDEX idx_import_jobs_status ON import_jobs(status);
CREATE INDEX idx_import_jobs_user_id ON import_jobs(user_id);
CREATE INDEX idx_import_jobs_created_at ON import_jobs(created_at DESC);
CREATE INDEX idx_import_jobs_next_retry ON import_jobs(next_retry_at) WHERE status = 'retrying';

-- Create dead_letter_queue for failed jobs
CREATE TABLE IF NOT EXISTS dead_letter_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID REFERENCES import_jobs(id) ON DELETE CASCADE,
  error_message TEXT,
  error_stack TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create system_alerts table for monitoring
CREATE TABLE IF NOT EXISTS system_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  level VARCHAR(20) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  error TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for system_alerts
CREATE INDEX idx_system_alerts_level ON system_alerts(level);
CREATE INDEX idx_system_alerts_created_at ON system_alerts(created_at DESC);

-- Add RLS policies for import_jobs
ALTER TABLE import_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own import jobs"
  ON import_jobs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own import jobs"
  ON import_jobs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own import jobs"
  ON import_jobs FOR UPDATE
  USING (auth.uid() = user_id);

-- Add RLS policies for dead_letter_queue
ALTER TABLE dead_letter_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view dead letter entries for their jobs"
  ON dead_letter_queue FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM import_jobs
      WHERE import_jobs.id = dead_letter_queue.job_id
      AND import_jobs.user_id = auth.uid()
    )
  );

-- Add RLS policies for system_alerts (admin only)
ALTER TABLE system_alerts ENABLE ROW LEVEL SECURITY;

-- For now, only allow service role to access system_alerts
-- You may want to add an admin check here
CREATE POLICY "Service role can manage system alerts"
  ON system_alerts FOR ALL
  USING (auth.role() = 'service_role');

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for import_jobs
CREATE TRIGGER update_import_jobs_updated_at
  BEFORE UPDATE ON import_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();