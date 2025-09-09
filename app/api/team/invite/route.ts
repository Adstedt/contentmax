import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { email, role, message, workspaceId } = await request.json();

    // Verify user has permission to invite
    const { data: memberData, error: memberError } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single();

    if (memberError || !memberData) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    if (memberData.role !== 'owner' && memberData.role !== 'admin') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Check if user is already a member
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      const { data: memberCheck } = await supabase
        .from('workspace_members')
        .select('id')
        .eq('workspace_id', workspaceId)
        .eq('user_id', existingUser.id)
        .single();

      if (memberCheck) {
        return NextResponse.json({ error: 'User is already a member' }, { status: 400 });
      }
    }

    // Check for existing invitation
    const { data: existingInvite } = await supabase
      .from('workspace_invitations')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('email', email)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (existingInvite) {
      return NextResponse.json({ error: 'Invitation already sent' }, { status: 400 });
    }

    // Create invitation
    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const { data: invitation, error: inviteError } = await supabase
      .from('workspace_invitations')
      .insert({
        workspace_id: workspaceId,
        email,
        role,
        token,
        expires_at: expiresAt.toISOString(),
        invited_by: user.id,
      })
      .select()
      .single();

    if (inviteError) {
      console.error('Error creating invitation:', inviteError);
      return NextResponse.json({ error: 'Failed to create invitation' }, { status: 500 });
    }

    // Get workspace details
    const { data: workspace } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', workspaceId)
      .single();

    // Get inviter details
    const { data: inviter } = await supabase
      .from('users')
      .select('full_name, email')
      .eq('id', user.id)
      .single();

    // In a production app, you would send the email here using Resend or similar service
    // For now, we'll just return the invitation link
    const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL}/invite/${token}`;

    // TODO: Send email with Resend
    // await resend.emails.send({
    //   from: 'ContentMax <noreply@contentmax.app>',
    //   to: email,
    //   subject: `You've been invited to join ${workspace?.name || 'a workspace'}`,
    //   html: generateInvitationEmail({
    //     inviterName: inviter?.full_name || inviter?.email || 'A team member',
    //     workspaceName: workspace?.name || 'ContentMax workspace',
    //     role,
    //     message,
    //     inviteLink,
    //   }),
    // });

    return NextResponse.json({
      success: true,
      inviteLink, // In production, don't return this
      message: 'Invitation sent successfully',
    });
  } catch (error) {
    console.error('Error in invite API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
