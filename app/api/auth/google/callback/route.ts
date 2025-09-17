import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { IntegrationManager } from '@/lib/integration/integration-manager';
import { GoogleAnalyticsService } from '@/lib/integration/services/google-analytics-service';
import { GoogleSearchConsoleService } from '@/lib/integration/services/google-search-console-service';
import { GoogleMerchantCenterService } from '@/lib/integration/services/google-merchant-center-service';
import { logger } from '@/lib/integration/logger';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const integrationManager = new IntegrationManager(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  process.env.ENCRYPTION_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Handle OAuth errors
    if (error) {
      return NextResponse.redirect(
        new URL(`/dashboard/integrations?error=${encodeURIComponent(error)}`, request.url)
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL('/dashboard/integrations?error=Missing%20authorization%20code', request.url)
      );
    }

    // Parse state parameter
    const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
    const { connectionId, serviceType, userId } = stateData;

    // Verify the connection exists and belongs to the user
    const connection = await integrationManager.getConnection(connectionId);
    if (!connection || connection.user_id !== userId) {
      return NextResponse.redirect(
        new URL('/dashboard/integrations?error=Invalid%20connection', request.url)
      );
    }

    // Exchange code for tokens based on service type
    let tokens;
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback`;

    switch (serviceType) {
      case 'google_analytics': {
        const gaService = new GoogleAnalyticsService(
          process.env.GOOGLE_CLIENT_ID!,
          process.env.GOOGLE_CLIENT_SECRET!,
          redirectUri,
          integrationManager
        );
        tokens = await gaService.exchangeCode(code);
        break;
      }
      case 'google_search_console': {
        const gscService = new GoogleSearchConsoleService(
          process.env.GOOGLE_CLIENT_ID!,
          process.env.GOOGLE_CLIENT_SECRET!,
          redirectUri,
          integrationManager
        );
        tokens = await gscService.exchangeCode(code);
        break;
      }
      case 'google_merchant_center': {
        const gmcService = new GoogleMerchantCenterService(
          process.env.GOOGLE_CLIENT_ID!,
          process.env.GOOGLE_CLIENT_SECRET!,
          redirectUri,
          integrationManager
        );
        tokens = await gmcService.exchangeCode(code);
        break;
      }
      default:
        return NextResponse.redirect(
          new URL('/dashboard/integrations?error=Unknown%20service%20type', request.url)
        );
    }

    // Store the encrypted tokens
    await integrationManager.updateTokens(connectionId, tokens);

    // Log successful connection
    await integrationManager.logUsage(connectionId, 'oauth_connect', 'success', {
      service_type: serviceType,
    });

    // Redirect to property configuration page for GA4 and GSC
    // For other services, go directly to success page
    if (serviceType === 'google_analytics' || serviceType === 'google_search_console') {
      return NextResponse.redirect(
        new URL(
          `/dashboard/integrations/connect/${serviceType}/configure?connection_id=${connectionId}`,
          request.url
        )
      );
    } else {
      return NextResponse.redirect(
        new URL(`/dashboard/integrations/${connectionId}?success=true`, request.url)
      );
    }
  } catch (error) {
    logger.error('OAuth callback error', error);
    return NextResponse.redirect(
      new URL('/dashboard/integrations?error=Authentication%20failed', request.url)
    );
  }
}
