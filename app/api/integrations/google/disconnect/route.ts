import { NextRequest, NextResponse } from 'next/server';
import { GoogleOAuthClient } from '@/lib/integrations/google-oauth';
import { createClient } from '@/lib/supabase/server';
import { getGSCCache } from '@/lib/integrations/gsc-cache';

export async function POST(request: NextRequest) {
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
    
    // Get current integration details for audit log
    const integration = await oauthClient.getStoredTokens(user.id);
    const email = integration?.email || 'unknown';

    // Revoke access and remove integration
    await oauthClient.revokeAccess(user.id);

    // Clear cache for this user
    const cache = getGSCCache();
    await cache.clear(); // In production, you'd want to clear only user-specific cache

    // Log disconnection
    await supabase
      .from('audit_logs')
      .insert({
        user_id: user.id,
        action: 'google_integration_disconnected',
        details: {
          email,
          timestamp: new Date().toISOString(),
        },
      });

    return NextResponse.json({
      success: true,
      message: 'Google integration disconnected successfully',
    });
  } catch (error) {
    console.error('Error disconnecting Google integration:', error);
    
    return NextResponse.json(
      { error: 'Failed to disconnect integration' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  // Alias for POST
  return POST(request);
}