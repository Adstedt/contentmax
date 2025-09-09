-- Migration: Cleanup Unrestricted Views
-- Description: Remove convenience views that show as unrestricted and rely on secure functions instead
-- Author: ContentMax Team
-- Date: 2025-01-09

-- ============================================
-- DROP CONVENIENCE VIEWS
-- ============================================

-- These views show as "unrestricted" in Supabase dashboard
-- We'll use the secure functions directly instead
DROP VIEW IF EXISTS my_workspaces CASCADE;
DROP VIEW IF EXISTS current_workspace_members CASCADE;

-- ============================================
-- SECURE THE MIGRATIONS TABLE
-- ============================================

-- Enable RLS on migrations table
ALTER TABLE migrations ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read migrations (for debugging/info)
-- But only superusers can insert/update/delete
CREATE POLICY migrations_select ON migrations
    FOR SELECT 
    USING (true);  -- All authenticated users can view migration history

CREATE POLICY migrations_admin ON migrations
    FOR ALL 
    USING (false)  -- Only superuser can modify (this will be bypassed by superuser)
    WITH CHECK (false);

-- ============================================
-- CREATE HELPER FUNCTIONS FOR EASY ACCESS
-- ============================================

-- Function to get current user's ID (convenience)
CREATE OR REPLACE FUNCTION get_current_user_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT auth.uid();
$$;

-- Function to get current user's default workspace
CREATE OR REPLACE FUNCTION get_current_workspace_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
    v_workspace_id UUID;
BEGIN
    -- Get the first workspace the user belongs to (or their most recently active)
    SELECT workspace_id INTO v_workspace_id
    FROM workspace_members
    WHERE user_id = auth.uid()
    ORDER BY last_active_at DESC NULLS LAST
    LIMIT 1;
    
    RETURN v_workspace_id;
END;
$$;

-- Function to switch active workspace (for multi-workspace users)
CREATE OR REPLACE FUNCTION switch_workspace(p_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Check if user has access to this workspace
    IF NOT user_has_permission(auth.uid(), p_workspace_id, 'viewer') THEN
        RAISE EXCEPTION 'Access denied to workspace';
    END IF;
    
    -- Update last_active_at for this workspace
    UPDATE workspace_members
    SET last_active_at = NOW()
    WHERE user_id = auth.uid() 
    AND workspace_id = p_workspace_id;
    
    RETURN TRUE;
END;
$$;

-- ============================================
-- GRANT PERMISSIONS
-- ============================================

GRANT EXECUTE ON FUNCTION get_current_user_id TO authenticated;
GRANT EXECUTE ON FUNCTION get_current_workspace_id TO authenticated;
GRANT EXECUTE ON FUNCTION switch_workspace TO authenticated;

-- ============================================
-- USAGE DOCUMENTATION
-- ============================================

COMMENT ON FUNCTION get_user_workspaces IS 
'Returns all workspaces for the current authenticated user. Use: SELECT * FROM get_user_workspaces();';

COMMENT ON FUNCTION get_workspace_member_details IS 
'Returns all members of a specific workspace if the current user has permission. Use: SELECT * FROM get_workspace_member_details(workspace_id);';

COMMENT ON FUNCTION get_current_workspace_id IS 
'Returns the current/default workspace ID for the authenticated user.';

COMMENT ON FUNCTION switch_workspace IS 
'Switches the active workspace for the current user. Returns true on success.';

-- ============================================
-- MIGRATION COMPLETE
-- ============================================

-- Add migration record
INSERT INTO migrations (name, executed_at) 
VALUES ('20250109_cleanup_views', NOW())
ON CONFLICT DO NOTHING;