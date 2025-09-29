import { NextRequest, NextResponse } from 'next/server';
import { generateAuthUrl, isOAuthConfigured, getMissingConfig } from '@/lib/external/google/oauth-config';
import { createClient } from '@/lib/external/supabase/server';

/**
 * GET /api/integrations/google/auth
 * 
 * Initiates the Google OAuth flow
 * Redirects user to Google's consent screen
 */
export async function GET(request: NextRequest) {
  try {
    // Check if OAuth is configured
    if (!isOAuthConfigured()) {
      const missing = getMissingConfig();
      return NextResponse.json(
        { 
          error: 'OAuth not configured',
          missing: missing,
          message: 'Please configure Google OAuth credentials. See docs/setup/google-oauth-setup.md'
        },
        { status: 500 }
      );
    }

    // Get the current user session
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in first.' },
        { status: 401 }
      );
    }

    // Generate state parameter for CSRF protection
    const state = Buffer.from(JSON.stringify({
      userId: user.id,
      timestamp: Date.now(),
      returnUrl: request.nextUrl.searchParams.get('returnUrl') || '/settings/integrations'
    })).toString('base64');

    // Generate the authorization URL
    const authUrl = generateAuthUrl(state);

    // Redirect to Google OAuth
    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('OAuth initialization error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to initialize OAuth',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}