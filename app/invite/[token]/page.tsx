'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/external/supabase/client';
import { Loader2, CheckCircle, XCircle, Users } from 'lucide-react';

export default function AcceptInvitationPage({ params }: { params: { token: string } }) {
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'expired'>('loading');
  const [message, setMessage] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    acceptInvitation();
  }, []);

  const acceptInvitation = async () => {
    try {
      // Check if user is authenticated
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        // Redirect to login with return URL
        sessionStorage.setItem('inviteToken', params.token);
        router.push(`/auth/login?redirectTo=/invite/${params.token}`);
        return;
      }

      // Get invitation details
      const { data: invitation, error: inviteError } = await supabase
        .from('workspace_invitations')
        .select(
          `
          *,
          workspace:organizations(name)
        `
        )
        .eq('token', params.token)
        .single();

      if (inviteError || !invitation) {
        setStatus('error');
        setMessage('Invitation not found');
        return;
      }

      // Check if invitation is expired
      if (new Date(invitation.expires_at) < new Date()) {
        setStatus('expired');
        setMessage('This invitation has expired');
        return;
      }

      // Check if user is already a member
      const { data: existingMember } = await supabase
        .from('workspace_members')
        .select('id')
        .eq('workspace_id', invitation.workspace_id)
        .eq('user_id', user.id)
        .single();

      if (existingMember) {
        setStatus('success');
        setMessage('You are already a member of this workspace');
        setWorkspaceName(invitation.workspace?.name || 'the workspace');
        setTimeout(() => router.push('/dashboard'), 2000);
        return;
      }

      // Add user to workspace
      const { error: memberError } = await supabase.from('workspace_members').insert({
        workspace_id: invitation.workspace_id,
        user_id: user.id,
        role: invitation.role,
      });

      if (memberError) {
        console.error('Error adding member:', memberError);
        setStatus('error');
        setMessage('Failed to join workspace');
        return;
      }

      // Delete the invitation
      await supabase.from('workspace_invitations').delete().eq('id', invitation.id);

      setStatus('success');
      setWorkspaceName(invitation.workspace?.name || 'the workspace');
      setMessage(`Successfully joined ${invitation.workspace?.name || 'the workspace'}`);

      // Redirect to dashboard after 2 seconds
      setTimeout(() => router.push('/dashboard'), 2000);
    } catch (error) {
      console.error('Error accepting invitation:', error);
      setStatus('error');
      setMessage('An unexpected error occurred');
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-[#1a1a1a] rounded-lg p-8 border border-[#2a2a2a]">
          {status === 'loading' && (
            <div className="text-center">
              <Loader2 className="h-12 w-12 animate-spin text-[#10a37f] mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-white mb-2">Processing Invitation</h2>
              <p className="text-[#999]">Please wait while we verify your invitation...</p>
            </div>
          )}

          {status === 'success' && (
            <div className="text-center">
              <CheckCircle className="h-12 w-12 text-[#10a37f] mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-white mb-2">Welcome!</h2>
              <p className="text-[#999] mb-4">{message}</p>
              <div className="flex items-center justify-center gap-2 text-sm text-[#666]">
                <Users className="h-4 w-4" />
                <span>Redirecting to dashboard...</span>
              </div>
            </div>
          )}

          {status === 'expired' && (
            <div className="text-center">
              <XCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-white mb-2">Invitation Expired</h2>
              <p className="text-[#999] mb-6">{message}</p>
              <p className="text-sm text-[#666] mb-4">
                Please contact the workspace administrator for a new invitation.
              </p>
              <button
                onClick={() => router.push('/auth/login')}
                className="px-4 py-2 bg-[#10a37f] hover:bg-[#0e8a65] text-white rounded-md transition-colors"
              >
                Go to Login
              </button>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center">
              <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-white mb-2">Error</h2>
              <p className="text-[#999] mb-6">{message}</p>
              <button
                onClick={() => router.push('/auth/login')}
                className="px-4 py-2 bg-[#10a37f] hover:bg-[#0e8a65] text-white rounded-md transition-colors"
              >
                Go to Login
              </button>
            </div>
          )}
        </div>

        <div className="text-center mt-6">
          <p className="text-sm text-[#666]">
            Having trouble? Contact support at{' '}
            <a href="mailto:support@contentmax.app" className="text-[#10a37f] hover:text-[#0e8a65]">
              support@contentmax.app
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
