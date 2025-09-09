-- Migration: Multi-User Workspace Support
-- Description: Adds comprehensive multi-user support with enhanced roles, invitations, and team management
-- Author: ContentMax Team
-- Date: 2025-01-09

-- ============================================
-- 1. ENHANCE USER ROLES
-- ============================================

-- First, update the existing role check constraint to include more granular roles
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check 
  CHECK (role IN ('owner', 'admin', 'editor', 'viewer'));

-- Update existing users to have 'owner' role if they're currently 'admin'
UPDATE users SET role = 'owner' WHERE role = 'admin';

-- Add additional user profile fields
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'UTC';
ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{
  "email": {
    "invitations": true,
    "content_updates": true,
    "team_updates": true,
    "product_imports": true
  },
  "in_app": {
    "invitations": true,
    "content_updates": true,
    "team_updates": true,
    "product_imports": true
  }
}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarded_at TIMESTAMP WITH TIME ZONE;

-- ============================================
-- 2. CREATE WORKSPACE MEMBERS TABLE
-- ============================================

-- This links users to organizations with specific roles
CREATE TABLE IF NOT EXISTS workspace_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'editor', 'viewer')),
    invited_by UUID REFERENCES users(id),
    invited_at TIMESTAMP WITH TIME ZONE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    permissions JSONB DEFAULT '{}', -- For custom permission overrides
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(workspace_id, user_id)
);

-- Create indexes for performance
CREATE INDEX idx_workspace_members_workspace ON workspace_members(workspace_id);
CREATE INDEX idx_workspace_members_user ON workspace_members(user_id);
CREATE INDEX idx_workspace_members_role ON workspace_members(role);

-- ============================================
-- 3. CREATE INVITATIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS workspace_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'editor', 'viewer')),
    token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
    invited_by UUID NOT NULL REFERENCES users(id),
    message TEXT, -- Optional personal message from inviter
    accepted BOOLEAN DEFAULT FALSE,
    accepted_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days'),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_workspace_invitations_workspace ON workspace_invitations(workspace_id);
CREATE INDEX idx_workspace_invitations_email ON workspace_invitations(email);
CREATE INDEX idx_workspace_invitations_token ON workspace_invitations(token);
CREATE INDEX idx_workspace_invitations_expires ON workspace_invitations(expires_at);

-- ============================================
-- 4. CREATE USER ACTIVITY LOG
-- ============================================

CREATE TABLE IF NOT EXISTS user_activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    workspace_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    action TEXT NOT NULL, -- e.g., 'login', 'create_content', 'invite_user', 'update_taxonomy'
    resource_type TEXT, -- e.g., 'content', 'taxonomy', 'product', 'user'
    resource_id UUID,
    details JSONB DEFAULT '{}', -- Additional context about the action
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX idx_activity_logs_user ON user_activity_logs(user_id);
CREATE INDEX idx_activity_logs_workspace ON user_activity_logs(workspace_id);
CREATE INDEX idx_activity_logs_action ON user_activity_logs(action);
CREATE INDEX idx_activity_logs_created ON user_activity_logs(created_at DESC);
CREATE INDEX idx_activity_logs_resource ON user_activity_logs(resource_type, resource_id);

-- ============================================
-- 5. CREATE DATA SOURCE CONNECTIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS data_source_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('google_merchant', 'shopify', 'api', 'csv', 'database', 'webhook')),
    status TEXT NOT NULL CHECK (status IN ('active', 'paused', 'error', 'disconnected')) DEFAULT 'active',
    config JSONB NOT NULL DEFAULT '{}', -- Encrypted connection details
    last_sync_at TIMESTAMP WITH TIME ZONE,
    last_sync_status TEXT,
    last_sync_error TEXT,
    sync_frequency TEXT CHECK (sync_frequency IN ('manual', 'hourly', 'daily', 'weekly', 'monthly')),
    next_sync_at TIMESTAMP WITH TIME ZONE,
    total_items_synced INTEGER DEFAULT 0,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_data_sources_workspace ON data_source_connections(workspace_id);
CREATE INDEX idx_data_sources_type ON data_source_connections(type);
CREATE INDEX idx_data_sources_status ON data_source_connections(status);
CREATE INDEX idx_data_sources_next_sync ON data_source_connections(next_sync_at);

-- ============================================
-- 6. CREATE WORKSPACE SETTINGS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS workspace_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    category TEXT NOT NULL, -- e.g., 'general', 'security', 'notifications', 'integrations'
    settings JSONB NOT NULL DEFAULT '{}',
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(workspace_id, category)
);

-- ============================================
-- 7. MIGRATE EXISTING DATA
-- ============================================

-- Create workspace_members entries for existing users
INSERT INTO workspace_members (workspace_id, user_id, role, joined_at)
SELECT 
    u.organization_id,
    u.id,
    CASE 
        WHEN u.role = 'owner' THEN 'owner'
        WHEN u.role = 'admin' THEN 'admin'
        WHEN u.role = 'editor' THEN 'editor'
        ELSE 'viewer'
    END,
    u.created_at
FROM users u
WHERE u.organization_id IS NOT NULL
ON CONFLICT (workspace_id, user_id) DO NOTHING;

-- ============================================
-- 8. CREATE HELPER FUNCTIONS
-- ============================================

-- Function to check if a user has permission in a workspace
CREATE OR REPLACE FUNCTION user_has_permission(
    p_user_id UUID,
    p_workspace_id UUID,
    p_required_role TEXT DEFAULT 'viewer'
) RETURNS BOOLEAN AS $$
DECLARE
    v_user_role TEXT;
    v_role_hierarchy JSONB := '{
        "owner": 4,
        "admin": 3,
        "editor": 2,
        "viewer": 1
    }'::JSONB;
BEGIN
    SELECT role INTO v_user_role
    FROM workspace_members
    WHERE user_id = p_user_id 
    AND workspace_id = p_workspace_id;
    
    IF v_user_role IS NULL THEN
        RETURN FALSE;
    END IF;
    
    RETURN (v_role_hierarchy->v_user_role)::INTEGER >= (v_role_hierarchy->p_required_role)::INTEGER;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log user activity
CREATE OR REPLACE FUNCTION log_user_activity(
    p_user_id UUID,
    p_workspace_id UUID,
    p_action TEXT,
    p_resource_type TEXT DEFAULT NULL,
    p_resource_id UUID DEFAULT NULL,
    p_details JSONB DEFAULT '{}'::JSONB
) RETURNS UUID AS $$
DECLARE
    v_log_id UUID;
BEGIN
    INSERT INTO user_activity_logs (
        user_id, workspace_id, action, resource_type, resource_id, details
    ) VALUES (
        p_user_id, p_workspace_id, p_action, p_resource_type, p_resource_id, p_details
    ) RETURNING id INTO v_log_id;
    
    -- Update last_active_at in workspace_members
    UPDATE workspace_members 
    SET last_active_at = NOW()
    WHERE user_id = p_user_id AND workspace_id = p_workspace_id;
    
    -- Update last_seen_at in users
    UPDATE users 
    SET last_seen_at = NOW()
    WHERE id = p_user_id;
    
    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 9. CREATE ROW LEVEL SECURITY POLICIES
-- ============================================

-- Enable RLS on new tables
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_source_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_settings ENABLE ROW LEVEL SECURITY;

-- Workspace Members policies
CREATE POLICY workspace_members_select ON workspace_members
    FOR SELECT USING (
        auth.uid() = user_id OR 
        user_has_permission(auth.uid(), workspace_id, 'admin')
    );

CREATE POLICY workspace_members_insert ON workspace_members
    FOR INSERT WITH CHECK (
        user_has_permission(auth.uid(), workspace_id, 'admin')
    );

CREATE POLICY workspace_members_update ON workspace_members
    FOR UPDATE USING (
        user_has_permission(auth.uid(), workspace_id, 'admin')
    );

CREATE POLICY workspace_members_delete ON workspace_members
    FOR DELETE USING (
        user_has_permission(auth.uid(), workspace_id, 'owner')
    );

-- Workspace Invitations policies
CREATE POLICY invitations_select ON workspace_invitations
    FOR SELECT USING (
        user_has_permission(auth.uid(), workspace_id, 'viewer') OR
        email = (SELECT email FROM users WHERE id = auth.uid())
    );

CREATE POLICY invitations_insert ON workspace_invitations
    FOR INSERT WITH CHECK (
        user_has_permission(auth.uid(), workspace_id, 'admin')
    );

CREATE POLICY invitations_update ON workspace_invitations
    FOR UPDATE USING (
        user_has_permission(auth.uid(), workspace_id, 'admin') OR
        email = (SELECT email FROM users WHERE id = auth.uid())
    );

-- Activity Logs policies (read-only for most users)
CREATE POLICY activity_logs_select ON user_activity_logs
    FOR SELECT USING (
        user_id = auth.uid() OR
        user_has_permission(auth.uid(), workspace_id, 'admin')
    );

CREATE POLICY activity_logs_insert ON user_activity_logs
    FOR INSERT WITH CHECK (
        user_id = auth.uid()
    );

-- Data Source Connections policies
CREATE POLICY data_sources_select ON data_source_connections
    FOR SELECT USING (
        user_has_permission(auth.uid(), workspace_id, 'viewer')
    );

CREATE POLICY data_sources_insert ON data_source_connections
    FOR INSERT WITH CHECK (
        user_has_permission(auth.uid(), workspace_id, 'editor')
    );

CREATE POLICY data_sources_update ON data_source_connections
    FOR UPDATE USING (
        user_has_permission(auth.uid(), workspace_id, 'editor')
    );

CREATE POLICY data_sources_delete ON data_source_connections
    FOR DELETE USING (
        user_has_permission(auth.uid(), workspace_id, 'admin')
    );

-- Workspace Settings policies
CREATE POLICY settings_select ON workspace_settings
    FOR SELECT USING (
        user_has_permission(auth.uid(), workspace_id, 'viewer')
    );

CREATE POLICY settings_modify ON workspace_settings
    FOR ALL USING (
        user_has_permission(auth.uid(), workspace_id, 'admin')
    );

-- ============================================
-- 10. CREATE TRIGGERS FOR UPDATED_AT
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_workspace_members_updated_at
    BEFORE UPDATE ON workspace_members
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_invitations_updated_at
    BEFORE UPDATE ON workspace_invitations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_data_sources_updated_at
    BEFORE UPDATE ON data_source_connections
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_settings_updated_at
    BEFORE UPDATE ON workspace_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 11. CREATE VIEWS FOR COMMON QUERIES
-- ============================================

-- View for user's workspaces with their roles
CREATE OR REPLACE VIEW user_workspaces AS
SELECT 
    wm.user_id,
    wm.workspace_id,
    o.name as workspace_name,
    o.slug as workspace_slug,
    wm.role,
    wm.joined_at,
    wm.last_active_at,
    (SELECT COUNT(*) FROM workspace_members WHERE workspace_id = wm.workspace_id) as member_count
FROM workspace_members wm
JOIN organizations o ON o.id = wm.workspace_id
WHERE o.deleted_at IS NULL;

-- View for workspace member details
CREATE OR REPLACE VIEW workspace_member_details AS
SELECT 
    wm.*,
    u.email,
    u.full_name,
    u.avatar_url,
    u.last_seen_at
FROM workspace_members wm
JOIN users u ON u.id = wm.user_id
WHERE u.deleted_at IS NULL;

-- ============================================
-- 12. GRANT PERMISSIONS
-- ============================================

-- Grant necessary permissions to authenticated users
GRANT SELECT ON user_workspaces TO authenticated;
GRANT SELECT ON workspace_member_details TO authenticated;
GRANT EXECUTE ON FUNCTION user_has_permission TO authenticated;
GRANT EXECUTE ON FUNCTION log_user_activity TO authenticated;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================

-- Create migrations table if it doesn't exist
CREATE TABLE IF NOT EXISTS migrations (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add migration record
INSERT INTO migrations (name, executed_at) 
VALUES ('20250109_multi_user_workspaces', NOW())
ON CONFLICT DO NOTHING;