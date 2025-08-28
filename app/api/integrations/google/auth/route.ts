import { NextRequest, NextResponse } from 'next/server';
import { GoogleOAuthClient } from '@/lib/integrations/google-oauth';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Initialize OAuth client
    const oauthClient = new GoogleOAuthClient();
    
    // Generate authorization URL
    const authUrl = oauthClient.generateAuthUrl(user.id);

    // Redirect to Google OAuth
    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('Error initiating Google OAuth:', error);
    
    return NextResponse.json(
      { error: 'Failed to initiate authentication' },
      { status: 500 }
    );
  }
}