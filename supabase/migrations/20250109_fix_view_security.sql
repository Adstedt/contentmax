-- Migration: Fix View Security
-- Description: Properly secures the views created in multi-user migration
-- Author: ContentMax Team
-- Date: 2025-01-09

-- ============================================
-- FIX VIEW SECURITY
-- ============================================

-- Drop existing views to recreate them with proper security
DROP VIEW IF EXISTS user_workspaces CASCADE;
DROP VIEW IF EXISTS workspace_member_details CASCADE;

-- ============================================
-- RECREATE VIEWS AS SECURITY DEFINER FUNCTIONS
-- ============================================

-- Function to get user's workspaces (secure)
CREATE OR REPLACE FUNCTION get_user_workspaces()
RETURNS TABLE (
    user_id UUID,
    workspace_id UUID,
    workspace_name TEXT,
    workspace_slug TEXT,
    role TEXT,
    joined_at TIMESTAMP WITH TIME ZONE,
    last_active_at TIMESTAMP WITH TIME ZONE,
    member_count BIGINT
) 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        wm.user_id,
        wm.workspace_id,
        o.name as workspace_name,
        o.slug as workspace_slug,
        wm.role,
        wm.joined_at,
        wm.last_active_at,
        (SELECT COUNT(*) FROM workspace_members WHERE workspace_members.workspace_id = wm.workspace_id) as member_count
    FROM workspace_members wm
    JOIN organizations o ON o.id = wm.workspace_id
    WHERE o.deleted_at IS NULL
    AND wm.user_id = auth.uid();  -- Only return workspaces for the current user
END;
$$ LANGUAGE plpgsql;

-- Function to get workspace member details (secure)
CREATE OR REPLACE FUNCTION get_workspace_member_details(p_workspace_id UUID)
RETURNS TABLE (
    id UUID,
    workspace_id UUID,
    user_id UUID,
    role TEXT,
    invited_by UUID,
    invited_at TIMESTAMP WITH TIME ZONE,
    joined_at TIMESTAMP WITH TIME ZONE,
    last_active_at TIMESTAMP WITH TIME ZONE,
    permissions JSONB,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    email TEXT,
    full_name TEXT,
    avatar_url TEXT,
    last_seen_at TIMESTAMP WITH TIME ZONE
)
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Check if user has permission to view this workspace's members
    IF NOT user_has_permission(auth.uid(), p_workspace_id, 'viewer') THEN
        RAISE EXCEPTION 'Insufficient permissions to view workspace members';
    END IF;
    
    RETURN QUERY
    SELECT 
        wm.id,
        wm.workspace_id,
        wm.user_id,
        wm.role,
        wm.invited_by,
        wm.invited_at,
        wm.joined_at,
        wm.last_active_at,
        wm.permissions,
        wm.created_at,
        wm.updated_at,
        u.email,
        u.full_name,
        u.avatar_url,
        u.last_seen_at
    FROM workspace_members wm
    JOIN users u ON u.id = wm.user_id
    WHERE wm.workspace_id = p_workspace_id
    AND u.deleted_at IS NULL;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- CREATE SECURE VIEWS (Optional, for convenience)
-- ============================================

-- These views use the secure functions and are restricted by them
CREATE OR REPLACE VIEW my_workspaces AS
SELECT * FROM get_user_workspaces();

CREATE OR REPLACE VIEW current_workspace_members AS
SELECT * FROM get_workspace_member_details(
    (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() LIMIT 1)
);

-- ============================================
-- GRANT PERMISSIONS
-- ============================================

-- Grant execute permissions on the secure functions
GRANT EXECUTE ON FUNCTION get_user_workspaces TO authenticated;
GRANT EXECUTE ON FUNCTION get_workspace_member_details TO authenticated;

-- Grant select on the convenience views
GRANT SELECT ON my_workspaces TO authenticated;
GRANT SELECT ON current_workspace_members TO authenticated;

-- ============================================
-- REVOKE DIRECT TABLE ACCESS (OPTIONAL)
-- ============================================

-- For extra security, you might want to revoke direct access and force use of functions
-- Uncomment these lines if you want to enforce function-only access:
-- REVOKE SELECT ON workspace_members FROM authenticated;
-- REVOKE SELECT ON workspace_member_details FROM authenticated;

-- ============================================
-- ADD RLS TO ORGANIZATIONS TABLE IF NOT PRESENT
-- ============================================

-- Enable RLS on organizations table
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists and recreate
DROP POLICY IF EXISTS organizations_select ON organizations;

-- Policy for organizations - users can only see organizations they're members of
CREATE POLICY organizations_select ON organizations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM workspace_members 
            WHERE workspace_members.workspace_id = organizations.id 
            AND workspace_members.user_id = auth.uid()
        )
    );

-- ============================================
-- MIGRATION COMPLETE
-- ============================================

-- Add migration record
INSERT INTO migrations (name, executed_at) 
VALUES ('20250109_fix_view_security', NOW())
ON CONFLICT DO NOTHING;