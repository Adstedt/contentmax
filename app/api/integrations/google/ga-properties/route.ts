import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/external/supabase/server';
import { google } from 'googleapis';
import { decrypt } from '@/lib/external/encryption';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get Google integration
    const { data: integration, error: intError } = await supabase
      .from('google_integrations')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (intError || !integration) {
      return NextResponse.json({ error: 'No Google integration found' }, { status: 404 });
    }

    // Decrypt tokens
    const accessToken = decrypt(integration.access_token);
    const refreshToken = integration.refresh_token ? decrypt(integration.refresh_token) : null;

    // Set up OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/google/callback`
    );

    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    // Initialize GA Admin API
    const analyticsAdmin = google.analyticsadmin({
      version: 'v1beta',
      auth: oauth2Client,
    });

    // List all GA4 accounts
    const accountsResponse = await analyticsAdmin.accounts.list();
    const accounts = accountsResponse.data.accounts || [];

    // For each account, get properties
    const propertiesPromises = accounts.map(async (account) => {
      if (!account.name) return { account, properties: [] };

      try {
        const propertiesResponse = await analyticsAdmin.properties.list({
          filter: `parent:${account.name}`,
        });

        return {
          account: {
            name: account.name,
            displayName: account.displayName,
          },
          properties: propertiesResponse.data.properties || [],
        };
      } catch (error) {
        console.error(`Error fetching properties for account ${account.name}:`, error);
        return { account, properties: [] };
      }
    });

    const results = await Promise.all(propertiesPromises);

    // Format the response
    const formattedResults = results.map(({ account, properties }) => ({
      account: {
        id: account.name?.split('/')[1],
        displayName: account.displayName,
      },
      properties: properties.map((prop: any) => ({
        id: prop.name?.split('/')[1],
        displayName: prop.displayName,
        propertyType: prop.propertyType,
        timeZone: prop.timeZone,
        currencyCode: prop.currencyCode,
        industryCategory: prop.industryCategory,
        createTime: prop.createTime,
      })),
    }));

    return NextResponse.json({
      accounts: formattedResults,
      totalProperties: formattedResults.reduce((sum, acc) => sum + acc.properties.length, 0),
    });
  } catch (error: any) {
    console.error('Error fetching GA properties:', error);

    // Handle token refresh if needed
    if (error.message?.includes('invalid_grant') || error.response?.status === 401) {
      // Token might be expired, you could trigger a refresh here
      return NextResponse.json(
        {
          error: 'Authentication expired. Please reconnect your Google account.',
          code: 'AUTH_EXPIRED',
        },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        error: 'Failed to fetch GA properties',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
