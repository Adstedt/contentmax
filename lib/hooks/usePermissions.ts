import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

type Role = 'owner' | 'admin' | 'editor' | 'viewer';

interface PermissionsState {
  isLoading: boolean;
  userRole: Role | null;
  workspaceId: string | null;
  canEdit: boolean;
  canAdmin: boolean;
  isOwner: boolean;
  canInviteMembers: boolean;
  canManageTeam: boolean;
  canDeleteWorkspace: boolean;
  canManageBilling: boolean;
  canViewAnalytics: boolean;
}

const roleHierarchy: Record<Role, number> = {
  owner: 4,
  admin: 3,
  editor: 2,
  viewer: 1,
};

export function usePermissions(): PermissionsState {
  const [state, setState] = useState<PermissionsState>({
    isLoading: true,
    userRole: null,
    workspaceId: null,
    canEdit: false,
    canAdmin: false,
    isOwner: false,
    canInviteMembers: false,
    canManageTeam: false,
    canDeleteWorkspace: false,
    canManageBilling: false,
    canViewAnalytics: false,
  });

  useEffect(() => {
    loadPermissions();
  }, []);

  const loadPermissions = async () => {
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setState((prev) => ({ ...prev, isLoading: false }));
        return;
      }

      // Get user's workspace membership
      const { data: memberData, error } = await supabase
        .from('workspace_members')
        .select('workspace_id, role')
        .eq('user_id', user.id)
        .single();

      if (error || !memberData) {
        setState((prev) => ({ ...prev, isLoading: false }));
        return;
      }

      const role = memberData.role as Role;
      const roleLevel = roleHierarchy[role];

      setState({
        isLoading: false,
        userRole: role,
        workspaceId: memberData.workspace_id,
        canEdit: roleLevel >= roleHierarchy.editor,
        canAdmin: roleLevel >= roleHierarchy.admin,
        isOwner: role === 'owner',
        canInviteMembers: roleLevel >= roleHierarchy.admin,
        canManageTeam: roleLevel >= roleHierarchy.admin,
        canDeleteWorkspace: role === 'owner',
        canManageBilling: role === 'owner',
        canViewAnalytics: roleLevel >= roleHierarchy.editor,
      });
    } catch (error) {
      console.error('Error loading permissions:', error);
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  };

  return state;
}

export function hasPermission(userRole: Role | null, requiredRole: Role): boolean {
  if (!userRole) return false;
  return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
}
