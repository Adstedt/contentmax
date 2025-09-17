import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { IntegrationManager } from '@/lib/integration/integration-manager';
import { GoogleAnalyticsService } from '@/lib/integration/services/google-analytics-service';
import { GoogleSearchConsoleService } from '@/lib/integration/services/google-search-console-service';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
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
      .from('data_source_connections')
      .select('*')
      .eq('id', params.id)
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

    const tokens = await integrationManager.getDecryptedTokens(params.id);

    if (!tokens?.access_token) {
      return NextResponse.json({ error: 'No valid tokens found' }, { status: 400 });
    }

    let properties = [];

    // Fetch properties based on service type
    switch (connection.service_type) {
      case 'google_analytics':
        try {
          const ga4Service = new GoogleAnalyticsService(
            process.env.GOOGLE_CLIENT_ID!,
            process.env.GOOGLE_CLIENT_SECRET!,
            process.env.ENCRYPTION_KEY!
          );

          // Make direct API call to GA4 Admin API
          const response = await fetch('https://analyticsadmin.googleapis.com/v1beta/accounts', {
            headers: {
              Authorization: `Bearer ${tokens.access_token}`,
            },
          });

          if (!response.ok) {
            throw new Error(`GA4 API error: ${response.statusText}`);
          }

          const accountsData = await response.json();
          const accounts = accountsData.accounts || [];

          // For each account, get properties
          for (const account of accounts) {
            const propsResponse = await fetch(
              `https://analyticsadmin.googleapis.com/v1beta/${account.name}/properties`,
              {
                headers: {
                  Authorization: `Bearer ${tokens.access_token}`,
                },
              }
            );

            if (propsResponse.ok) {
              const propsData = await propsResponse.json();
              if (propsData.properties) {
                properties.push(...propsData.properties);
              }
            }
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
      connectionName: connection.connection_name,
      serviceType: connection.service_type,
    });
  } catch (error) {
    console.error('Error in properties API:', error);
    return NextResponse.json({ error: 'Failed to fetch properties' }, { status: 500 });
  }
}
