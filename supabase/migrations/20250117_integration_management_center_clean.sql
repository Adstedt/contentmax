-- Migration: Integration Management Center (Clean Install)
-- Story: STORY-026
-- Purpose: Centralized management for external data source connections

-- Drop existing tables if they exist (to handle partial migrations)
DROP TABLE IF EXISTS connection_usage_logs CASCADE;
DROP TABLE IF EXISTS data_source_connections CASCADE;

-- Create data_source_connections table
CREATE TABLE data_source_connections (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id UUID, -- Made nullable since users might not have organization_id
    user_id UUID NOT NULL REFERENCES auth.users(id),

    -- Connection identification
    service_type TEXT NOT NULL CHECK (service_type IN ('google_analytics', 'google_search_console', 'google_merchant_center', 'shopify', 'meta')),
    connection_name TEXT NOT NULL,
    account_id TEXT, -- External account identifier

    -- OAuth and credentials (encrypted)
    encrypted_access_token TEXT,
    encrypted_refresh_token TEXT,
    encrypted_api_key TEXT,
    token_expires_at TIMESTAMPTZ,

    -- Connection metadata
    is_active BOOLEAN DEFAULT true,
    last_sync_at TIMESTAMPTZ,
    last_error TEXT,
    connection_status TEXT DEFAULT 'pending' CHECK (connection_status IN ('pending', 'active', 'error', 'expired')),

    -- Configuration
    config JSONB DEFAULT '{}',
    permissions JSONB DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Ensure unique connections per user and service
    UNIQUE(user_id, service_type, account_id)
);

-- Create connection usage logs table
CREATE TABLE connection_usage_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    connection_id UUID NOT NULL REFERENCES data_source_connections(id) ON DELETE CASCADE,

    -- Usage tracking
    action TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('success', 'failure', 'partial')),
    error_message TEXT,

    -- Metrics
    records_processed INTEGER DEFAULT 0,
    duration_ms INTEGER,

    -- Metadata
    metadata JSONB DEFAULT '{}',

    -- Timestamp
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_connections_org_id ON data_source_connections(org_id) WHERE org_id IS NOT NULL;
CREATE INDEX idx_connections_user_id ON data_source_connections(user_id);
CREATE INDEX idx_connections_service_type ON data_source_connections(service_type);
CREATE INDEX idx_connections_status ON data_source_connections(connection_status);
CREATE INDEX idx_usage_logs_connection_id ON connection_usage_logs(connection_id);
CREATE INDEX idx_usage_logs_created_at ON connection_usage_logs(created_at DESC);

-- Enable Row Level Security
ALTER TABLE data_source_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE connection_usage_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for data_source_connections
CREATE POLICY "Users can view their own connections"
    ON data_source_connections
    FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can create their own connections"
    ON data_source_connections
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own connections"
    ON data_source_connections
    FOR UPDATE
    USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own connections"
    ON data_source_connections
    FOR DELETE
    USING (user_id = auth.uid());

-- RLS Policies for connection_usage_logs
CREATE POLICY "Users can view logs for their connections"
    ON connection_usage_logs
    FOR SELECT
    USING (
        connection_id IN (
            SELECT id FROM data_source_connections
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "System can insert usage logs"
    ON connection_usage_logs
    FOR INSERT
    WITH CHECK (
        connection_id IN (
            SELECT id FROM data_source_connections
            WHERE user_id = auth.uid()
        )
    );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER update_data_source_connections_updated_at
    BEFORE UPDATE ON data_source_connections
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE data_source_connections IS 'Stores encrypted credentials and configuration for external service connections';
COMMENT ON TABLE connection_usage_logs IS 'Tracks usage and performance metrics for each connection';
COMMENT ON COLUMN data_source_connections.encrypted_access_token IS 'AES-256 encrypted OAuth access token';
COMMENT ON COLUMN data_source_connections.encrypted_refresh_token IS 'AES-256 encrypted OAuth refresh token';
COMMENT ON COLUMN data_source_connections.encrypted_api_key IS 'AES-256 encrypted API key for non-OAuth services';