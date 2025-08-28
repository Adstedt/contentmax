import { NextRequest, NextResponse } from 'next/server';
import { GoogleOAuthClient } from '@/lib/integrations/google-oauth';
import { createClient } from '@/lib/supabase/server';
import { GSCError } from '@/types/google.types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Check for OAuth errors
    if (error) {
      console.error('OAuth error:', error);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=${encodeURIComponent(error)}`
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=invalid_request`
      );
    }

    // Initialize OAuth client
    const oauthClient = new GoogleOAuthClient();
    
    // Handle callback and exchange code for tokens
    const { tokens, email } = await oauthClient.handleCallback(code, state);

    // Get user ID from state (already verified in handleCallback)
    const decodedState = Buffer.from(state, 'base64').toString();
    const userId = decodedState.split(':')[0];

    // Verify user is authenticated
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user || user.id !== userId) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=unauthorized`
      );
    }

    // Store tokens
    await oauthClient.storeTokens(userId, tokens, email);

    // Log successful connection
    await supabase
      .from('audit_logs')
      .insert({
        user_id: userId,
        action: 'google_integration_connected',
        entity_type: 'integration',
        new_values: {
          email,
          timestamp: new Date().toISOString(),
        },
      });

    // Redirect to settings page with success
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?success=google_connected`
    );
  } catch (error) {
    console.error('Error in Google OAuth callback:', error);
    
    let errorMessage = 'authentication_failed';
    if (error instanceof GSCError) {
      errorMessage = error.code.toLowerCase();
    }

    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=${errorMessage}`
    );
  }
}