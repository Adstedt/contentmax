'use client';

import { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  MoreVertical,
  Mail,
  Shield,
  Clock,
  Loader2,
  ChevronDown,
  X,
  Send,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

interface TeamMember {
  id: string;
  user_id: string;
  workspace_id: string;
  role: 'owner' | 'admin' | 'editor' | 'viewer';
  joined_at: string;
  user: {
    id: string;
    email: string;
    full_name: string | null;
    last_sign_in_at: string | null;
  };
}

interface WorkspaceInvitation {
  id: string;
  workspace_id: string;
  email: string;
  role: 'admin' | 'editor' | 'viewer';
  token: string;
  expires_at: string;
  created_at: string;
  invited_by: string;
  inviter?: {
    full_name: string | null;
    email: string;
  };
}

const inviteSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  role: z.enum(['admin', 'editor', 'viewer'], {
    required_error: 'Please select a role',
  }),
  message: z.string().max(500, 'Message must be less than 500 characters').optional(),
});

type InviteFormData = z.infer<typeof inviteSchema>;

const roleConfig = {
  owner: { label: 'Owner', color: 'bg-purple-500/10 text-purple-500 border-purple-500/20' },
  admin: { label: 'Admin', color: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
  editor: { label: 'Editor', color: 'bg-green-500/10 text-green-500 border-green-500/20' },
  viewer: { label: 'Viewer', color: 'bg-gray-500/10 text-gray-500 border-gray-500/20' },
};

export function TeamTab() {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<WorkspaceInvitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [showRoleMenu, setShowRoleMenu] = useState<string | null>(null);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string>('viewer');
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const supabase = createClient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<InviteFormData>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      email: '',
      role: 'editor',
      message: '',
    },
  });

  useEffect(() => {
    loadTeamData();
  }, []);

  const loadTeamData = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Get user's workspace and role
      const { data: memberData, error: memberError } = await supabase
        .from('workspace_members')
        .select('workspace_id, role')
        .eq('user_id', user.id)
        .single();

      if (memberError) throw memberError;
      if (!memberData) return;

      setWorkspaceId(memberData.workspace_id);
      setCurrentUserRole(memberData.role);

      // Get all workspace members
      const { data: members, error: membersError } = await supabase
        .from('workspace_members')
        .select(
          `
          *,
          user:users(
            id,
            email,
            full_name,
            last_sign_in_at
          )
        `
        )
        .eq('workspace_id', memberData.workspace_id)
        .order('joined_at', { ascending: true });

      if (membersError) throw membersError;
      setTeamMembers(members || []);

      // Get pending invitations
      const { data: invites, error: invitesError } = await supabase
        .from('workspace_invitations')
        .select(
          `
          *,
          inviter:users!workspace_invitations_invited_by_fkey(
            full_name,
            email
          )
        `
        )
        .eq('workspace_id', memberData.workspace_id)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (invitesError) throw invitesError;
      setInvitations(invites || []);
    } catch (error) {
      console.error('Error loading team data:', error);
      toast.error('Failed to load team members');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInviteMember = async (data: InviteFormData) => {
    if (!workspaceId) return;
    setIsSendingInvite(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      // Check if user is already a member
      const { data: existingMember } = await supabase
        .from('users')
        .select('id')
        .eq('email', data.email)
        .single();

      if (existingMember) {
        const { data: memberCheck } = await supabase
          .from('workspace_members')
          .select('id')
          .eq('workspace_id', workspaceId)
          .eq('user_id', existingMember.id)
          .single();

        if (memberCheck) {
          toast.error('This user is already a member of the workspace');
          return;
        }
      }

      // Check for existing invitation
      const { data: existingInvite } = await supabase
        .from('workspace_invitations')
        .select('id')
        .eq('workspace_id', workspaceId)
        .eq('email', data.email)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (existingInvite) {
        toast.error('An invitation has already been sent to this email');
        return;
      }

      // Send invitation via API
      const response = await fetch('/api/team/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: data.email,
          role: data.role,
          message: data.message,
          workspaceId,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to send invitation');
      }

      toast.success(`Invitation sent to ${data.email}`);

      setShowInviteModal(false);
      reset();
      await loadTeamData();
    } catch (error) {
      console.error('Error sending invitation:', error);
      toast.error('Failed to send invitation');
    } finally {
      setIsSendingInvite(false);
    }
  };

  const handleRoleChange = async (memberId: string, newRole: string) => {
    setIsUpdating(memberId);
    try {
      const { error } = await supabase
        .from('workspace_members')
        .update({
          role: newRole,
          updated_at: new Date().toISOString(),
        })
        .eq('id', memberId);

      if (error) throw error;

      setTeamMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, role: newRole as any } : m))
      );

      toast.success('Role updated successfully');
    } catch (error) {
      console.error('Error updating role:', error);
      toast.error('Failed to update role');
    } finally {
      setIsUpdating(null);
      setShowRoleMenu(null);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    try {
      const { error } = await supabase.from('workspace_members').delete().eq('id', memberId);

      if (error) throw error;

      setTeamMembers((prev) => prev.filter((m) => m.id !== memberId));
      setShowRemoveConfirm(null);
      toast.success('Member removed from workspace');
    } catch (error) {
      console.error('Error removing member:', error);
      toast.error('Failed to remove member');
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    try {
      const { error } = await supabase
        .from('workspace_invitations')
        .delete()
        .eq('id', invitationId);

      if (error) throw error;

      setInvitations((prev) => prev.filter((i) => i.id !== invitationId));
      toast.success('Invitation cancelled');
    } catch (error) {
      console.error('Error cancelling invitation:', error);
      toast.error('Failed to cancel invitation');
    }
  };

  const handleResendInvitation = async (invitation: WorkspaceInvitation) => {
    try {
      // Update expiry date
      const newExpiresAt = new Date();
      newExpiresAt.setDate(newExpiresAt.getDate() + 7);

      const { error } = await supabase
        .from('workspace_invitations')
        .update({
          expires_at: newExpiresAt.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', invitation.id);

      if (error) throw error;

      // In a real app, resend email here
      toast.success(`Invitation resent to ${invitation.email}`);
      await loadTeamData();
    } catch (error) {
      console.error('Error resending invitation:', error);
      toast.error('Failed to resend invitation');
    }
  };

  const formatLastActive = (lastSignIn: string | null) => {
    if (!lastSignIn) return 'Never';
    const date = new Date(lastSignIn);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins} ${diffMins === 1 ? 'minute' : 'minutes'} ago`;
    if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
    if (diffDays < 7) return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
    return date.toLocaleDateString();
  };

  const canManageTeam = currentUserRole === 'owner' || currentUserRole === 'admin';
  const canChangeRoles = currentUserRole === 'owner' || currentUserRole === 'admin';
  const canRemoveMembers = currentUserRole === 'owner' || currentUserRole === 'admin';

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#666]" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold">Team Members</h2>
          <p className="text-[#999] text-sm mt-1">Manage who has access to your workspace</p>
        </div>
        {canManageTeam && (
          <button
            onClick={() => setShowInviteModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#10a37f] hover:bg-[#0e8a65] text-white rounded-md transition-colors"
          >
            <UserPlus className="h-4 w-4" />
            Invite Member
          </button>
        )}
      </div>

      {/* Team Members List */}
      <div className="space-y-4">
        {teamMembers.map((member) => {
          const roleStyle = roleConfig[member.role];

          return (
            <div
              key={member.id}
              className="bg-[#1a1a1a] rounded-lg p-4 border border-[#2a2a2a] hover:border-[#3a3a3a] transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {/* Avatar */}
                  <div className="h-10 w-10 rounded-full bg-[#2a2a2a] flex items-center justify-center">
                    <span className="text-white font-medium">
                      {member.user.full_name
                        ? member.user.full_name
                            .split(' ')
                            .map((n) => n[0])
                            .join('')
                        : member.user.email[0].toUpperCase()}
                    </span>
                  </div>

                  {/* Member Info */}
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="font-medium text-white">
                        {member.user.full_name || member.user.email}
                      </h3>
                      <span
                        className={`px-2 py-0.5 text-xs font-medium rounded-full border ${roleStyle.color}`}
                      >
                        {roleStyle.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-1">
                      <span className="text-sm text-[#999] flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {member.user.email}
                      </span>
                      <span className="text-sm text-[#666] flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Active {formatLastActive(member.user.last_sign_in_at)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                {member.role !== 'owner' && canManageTeam && (
                  <div className="relative">
                    <button
                      onClick={() => setShowRoleMenu(showRoleMenu === member.id ? null : member.id)}
                      className="p-2 hover:bg-[#2a2a2a] rounded-md transition-colors"
                    >
                      <MoreVertical className="h-4 w-4 text-[#666]" />
                    </button>

                    {showRoleMenu === member.id && (
                      <div className="absolute right-0 top-10 bg-[#1a1a1a] border border-[#2a2a2a] rounded-md shadow-lg z-10 min-w-[160px]">
                        {canChangeRoles && (
                          <div className="p-1 border-b border-[#2a2a2a]">
                            <p className="text-xs text-[#666] px-2 py-1">Change Role</p>
                            {['admin', 'editor', 'viewer'].map((role) => (
                              <button
                                key={role}
                                onClick={() => handleRoleChange(member.id, role)}
                                disabled={member.role === role || isUpdating === member.id}
                                className="w-full text-left px-2 py-1.5 text-sm hover:bg-[#2a2a2a] disabled:opacity-50 disabled:cursor-not-allowed rounded capitalize"
                              >
                                {isUpdating === member.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin inline mr-2" />
                                ) : null}
                                {role}
                              </button>
                            ))}
                          </div>
                        )}
                        {canRemoveMembers && (
                          <div className="p-1">
                            {showRemoveConfirm === member.id ? (
                              <div className="p-2">
                                <p className="text-sm text-white mb-2">Remove member?</p>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleRemoveMember(member.id)}
                                    className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-500 rounded text-xs"
                                  >
                                    Remove
                                  </button>
                                  <button
                                    onClick={() => setShowRemoveConfirm(null)}
                                    className="px-3 py-1 bg-[#2a2a2a] hover:bg-[#3a3a3a] text-white rounded text-xs"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => setShowRemoveConfirm(member.id)}
                                className="w-full text-left px-2 py-1.5 text-sm text-red-500 hover:bg-red-500/10 rounded"
                              >
                                Remove from workspace
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Pending Invitations */}
      {invitations.length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-medium mb-4">Pending Invitations</h3>
          <div className="space-y-3">
            {invitations.map((invitation) => {
              const daysUntilExpiry = Math.ceil(
                (new Date(invitation.expires_at).getTime() - new Date().getTime()) / 86400000
              );
              const roleStyle = roleConfig[invitation.role];

              return (
                <div
                  key={invitation.id}
                  className="bg-[#1a1a1a] rounded-lg p-4 border border-[#2a2a2a]"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-[#2a2a2a] flex items-center justify-center">
                        <Mail className="h-5 w-5 text-[#666]" />
                      </div>
                      <div>
                        <p className="text-white">{invitation.email}</p>
                        <p className="text-sm text-[#999]">
                          Invited as{' '}
                          <span
                            className={`px-1.5 py-0.5 text-xs font-medium rounded border ${roleStyle.color}`}
                          >
                            {roleStyle.label}
                          </span>{' '}
                          • Expires in {daysUntilExpiry} {daysUntilExpiry === 1 ? 'day' : 'days'}
                        </p>
                      </div>
                    </div>
                    {canManageTeam && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleResendInvitation(invitation)}
                          className="px-3 py-1 text-sm text-[#10a37f] hover:text-[#0e8a65] transition-colors"
                        >
                          Resend
                        </button>
                        <button
                          onClick={() => handleCancelInvitation(invitation.id)}
                          className="px-3 py-1 text-sm text-red-500 hover:text-red-400 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Workspace Info */}
      <div className="mt-8 p-4 bg-[#1a1a1a] rounded-lg border border-[#2a2a2a]">
        <div className="flex items-center gap-2 mb-2">
          <Shield className="h-4 w-4 text-[#10a37f]" />
          <h4 className="font-medium text-white">Workspace Security</h4>
        </div>
        <p className="text-sm text-[#999]">
          Your workspace is protected with role-based access control. Only invited members can
          access your data.
        </p>
        <div className="mt-3 text-xs text-[#666]">
          Your role: <span className="text-[#999] capitalize">{currentUserRole}</span>
        </div>
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#1a1a1a] rounded-lg p-6 border border-[#2a2a2a] max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium">Invite Team Member</h3>
              <button
                onClick={() => {
                  setShowInviteModal(false);
                  reset();
                }}
                className="p-1 hover:bg-[#2a2a2a] rounded transition-colors"
              >
                <X className="h-5 w-5 text-[#666]" />
              </button>
            </div>

            <form onSubmit={handleSubmit(handleInviteMember)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white mb-1">Email Address</label>
                <input
                  {...register('email')}
                  type="email"
                  className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded px-3 py-2 text-white focus:outline-none focus:border-[#10a37f]"
                  placeholder="colleague@example.com"
                />
                {errors.email && (
                  <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-1">Role</label>
                <select
                  {...register('role')}
                  className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded px-3 py-2 text-white focus:outline-none focus:border-[#10a37f]"
                >
                  <option value="admin">Admin - Can manage team and content</option>
                  <option value="editor">Editor - Can create and edit content</option>
                  <option value="viewer">Viewer - Can only view content</option>
                </select>
                {errors.role && <p className="text-red-500 text-sm mt-1">{errors.role.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-1">
                  Personal Message (Optional)
                </label>
                <textarea
                  {...register('message')}
                  className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded px-3 py-2 text-white focus:outline-none focus:border-[#10a37f] resize-none"
                  rows={3}
                  placeholder="Add a personal message to the invitation..."
                />
                {errors.message && (
                  <p className="text-red-500 text-sm mt-1">{errors.message.message}</p>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowInviteModal(false);
                    reset();
                  }}
                  className="flex-1 px-4 py-2 bg-[#2a2a2a] hover:bg-[#3a3a3a] text-white rounded-md transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSendingInvite}
                  className="flex-1 px-4 py-2 bg-[#10a37f] hover:bg-[#0e8a65] disabled:opacity-50 text-white rounded-md transition-colors flex items-center justify-center gap-2"
                >
                  {isSendingInvite ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  Send Invitation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
