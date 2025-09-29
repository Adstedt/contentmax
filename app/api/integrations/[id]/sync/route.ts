import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/external/supabase/server';
import { IntegrationManager } from '@/lib/external/integration-manager';
import { GoogleAnalyticsService } from '@/lib/external/google-analytics-service';
import { GoogleSearchConsoleService } from '@/lib/external/google-search-console-service';
import { GoogleMerchantCenterService } from '@/lib/external/google-merchant-center-service';
import { logger } from '@/lib/external/logger';

const integrationManager = new IntegrationManager(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  process.env.ENCRYPTION_KEY!
);

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Get connection ID from params
  const connectionId = (await params).id;

  try {
    // Create server Supabase client and check authentication
    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get connection details and verify ownership
    const { data: connection, error: connectionError } = await supabase
      .from('feed_config')
      .select('*')
      .eq('id', connectionId)
      .eq('user_id', user.id)
      .single();

    if (connectionError || !connection) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
    }

    // Perform sync based on service type
    const startTime = Date.now();
    let result;

    try {
      switch (connection.feed_type) {
        case 'google_analytics': {
          const gaService = new GoogleAnalyticsService(
            process.env.GOOGLE_CLIENT_ID!,
            process.env.GOOGLE_CLIENT_SECRET!,
            `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback`,
            integrationManager
          );

          // Validate connection first
          const isValid = await gaService.validateConnection(connectionId);
          if (!isValid) {
            throw new Error('Connection validation failed');
          }

          // Example: Fetch properties
          const properties = await gaService.listProperties(connectionId);

          result = {
            service: 'google_analytics',
            properties_found: properties.length,
            data: properties,
          };
          break;
        }

        case 'google_search_console': {
          const gscService = new GoogleSearchConsoleService(
            process.env.GOOGLE_CLIENT_ID!,
            process.env.GOOGLE_CLIENT_SECRET!,
            `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback`,
            integrationManager
          );

          // Validate connection
          const isValid = await gscService.validateConnection(connectionId);
          if (!isValid) {
            throw new Error('Connection validation failed');
          }

          // Example: Fetch sites
          const sites = await gscService.listSites(connectionId);

          result = {
            service: 'google_search_console',
            sites_found: sites.length,
            data: sites,
          };
          break;
        }

        case 'google_merchant_center': {
          const gmcService = new GoogleMerchantCenterService(
            process.env.GOOGLE_CLIENT_ID!,
            process.env.GOOGLE_CLIENT_SECRET!,
            `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback`,
            integrationManager
          );

          // Validate connection
          const isValid = await gmcService.validateConnection(connectionId);
          if (!isValid) {
            throw new Error('Connection validation failed');
          }

          // Example: Fetch account info
          const accountInfo = await gmcService.getAccountInfo(connectionId);

          result = {
            service: 'google_merchant_center',
            account: accountInfo,
            data: accountInfo,
          };
          break;
        }

        default:
          return NextResponse.json(
            { error: `Unsupported service type: ${connection.feed_type}` },
            { status: 400 }
          );
      }

      // Log successful sync
      const duration = Date.now() - startTime;
      await integrationManager.logUsage(connectionId, 'sync', 'success', {
        duration_ms: duration,
        records_processed: result.properties_found || result.sites_found || 1,
      });

      // Update last sync time
      await integrationManager.updateConnectionStatus(connectionId, 'active');

      return NextResponse.json({
        success: true,
        result,
        duration_ms: duration,
      });
    } catch (syncError) {
      // Log failed sync
      const duration = Date.now() - startTime;
      const errorMessage = syncError instanceof Error ? syncError.message : 'Unknown error';

      await integrationManager.logUsage(connectionId, 'sync', 'failure', {
        duration_ms: duration,
        error_message: errorMessage,
      });

      // Update connection status
      await integrationManager.updateConnectionStatus(connectionId, 'error', errorMessage);

      throw syncError;
    }
  } catch (error) {
    logger.error('Sync error', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    );
  }
}
