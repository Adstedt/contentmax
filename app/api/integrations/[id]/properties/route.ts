import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/external/supabase/server';
import { IntegrationManager } from '@/lib/external/integration-manager';
import { GoogleAnalyticsService } from '@/lib/external/google-analytics-service';
import { GoogleSearchConsoleService } from '@/lib/external/google-search-console-service';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createServerSupabaseClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get connection details
    const { data: connection, error: connectionError } = await supabase
      .from('feed_config')
      .select('*')
      .eq('id', (await params).id)
      .eq('user_id', user.id)
      .single();

    if (connectionError || !connection) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
    }

    // Initialize integration manager to decrypt tokens
    const integrationManager = new IntegrationManager(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!,
      process.env.ENCRYPTION_KEY!
    );

    const tokens = await integrationManager.getDecryptedTokens((await params).id);

    if (!tokens?.access_token) {
      return NextResponse.json({ error: 'No valid tokens found' }, { status: 400 });
    }

    let properties = [];

    // Fetch properties based on service type
    switch (connection.feed_type) {
      case 'google_analytics':
        try {
          // Note: We don't actually need the service instance, just making direct API calls

          // Make direct API call to GA4 Admin API v1beta
          const response = await fetch('https://analyticsadmin.googleapis.com/v1beta/accounts', {
            headers: {
              Authorization: `Bearer ${tokens.access_token}`,
            },
          });

          console.log('GA4 Accounts response status:', response.status);

          if (!response.ok) {
            const errorText = await response.text();
            console.error('GA4 API error:', errorText);
            throw new Error(`GA4 API error: ${response.statusText}`);
          }

          const accountsData = await response.json();
          console.log('GA4 Accounts data:', accountsData);
          const accounts = accountsData.accounts || [];

          // Get all properties (GA4 Admin API requires a filter parameter)
          // Use a filter that matches all properties (parent filter for all accounts)
          const filter =
            accounts.map((acc) => `parent:${acc.name}`).join(' OR ') || 'parent:accounts/*';
          const propsResponse = await fetch(
            `https://analyticsadmin.googleapis.com/v1beta/properties?filter=${encodeURIComponent(filter)}`,
            {
              headers: {
                Authorization: `Bearer ${tokens.access_token}`,
              },
            }
          );

          console.log('Properties response status:', propsResponse.status);

          if (propsResponse.ok) {
            const propsData = await propsResponse.json();
            console.log('Properties data:', propsData);
            properties = propsData.properties || [];
          } else {
            const errorText = await propsResponse.text();
            console.error('Properties fetch error:', errorText);
          }
        } catch (error) {
          console.error('Error fetching GA4 properties:', error);
          // Return empty array instead of error to allow manual entry
        }
        break;

      case 'google_search_console':
        try {
          const response = await fetch('https://www.googleapis.com/webmasters/v3/sites', {
            headers: {
              Authorization: `Bearer ${tokens.access_token}`,
            },
          });

          if (response.ok) {
            const data = await response.json();
            properties = data.siteEntry || [];
          }
        } catch (error) {
          console.error('Error fetching GSC properties:', error);
        }
        break;

      case 'google_merchant_center':
        // Merchant Center doesn't have multiple properties to select
        properties = [
          {
            name: 'default',
            displayName: 'Google Merchant Center',
          },
        ];
        break;
    }

    return NextResponse.json({
      properties,
      connectionName: connection.feed_name,
      serviceType: connection.feed_type,
    });
  } catch (error) {
    console.error('Error in properties API:', error);
    return NextResponse.json({ error: 'Failed to fetch properties' }, { status: 500 });
  }
}
