import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { GoogleMerchantClient } from '@/lib/integrations/google-merchant';
import { ProductFeedParser } from '@/lib/parsers/product-feed-parser';
import { ProductSyncServiceImpl } from '@/lib/services/product-sync-service';
import { feedScheduler } from '@/lib/jobs/product-feed-job';
import { z } from 'zod';
import { SupabaseClient } from '@supabase/supabase-js';

const FeedConfigSchema = z.object({
  merchantId: z.string().min(1),
  accountId: z.string().optional(),
  feedId: z.string().optional(),
  updateFrequency: z.enum(['hourly', 'daily', 'weekly']).default('daily'),
  deltaSync: z.boolean().default(true),
  autoSync: z.boolean().default(true),
});

const AuthSchema = z.object({
  code: z.string().optional(),
  refreshToken: z.string().optional(),
});

// GET - Get feed status and configuration
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get feed configurations
    const { data: feeds, error: feedError } = await supabase
      .from('feed_config')
      .select('*')
      .eq('feed_type', 'google_merchant');

    if (feedError) {
      return NextResponse.json({ error: feedError.message }, { status: 500 });
    }

    // Get sync history
    const { data: history, error: historyError } = await supabase
      .from('feed_sync_history')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (historyError) {
      return NextResponse.json({ error: historyError.message }, { status: 500 });
    }

    // Get product stats
    const { data: productStats } = await supabase
      .from('products')
      .select('id', { count: 'exact', head: true });

    const { data: inStockStats } = await supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('availability', 'in stock');

    return NextResponse.json({
      feeds,
      history,
      stats: {
        totalProducts: productStats?.length || 0,
        inStockProducts: inStockStats?.length || 0,
      },
    });
  } catch (error) {
    console.error('Failed to get feed status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Configure and/or sync feed
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'authenticate':
        return handleAuthentication(body, supabase);
      case 'configure':
        return handleConfiguration(body, supabase);
      case 'sync':
        return handleSync(body, supabase);
      case 'test':
        return handleTest(body, supabase);
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Feed operation failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

async function handleAuthentication(body: Record<string, unknown>, supabase: SupabaseClient) {
  const { code } = AuthSchema.parse(body);

  const merchantClient = new GoogleMerchantClient({
    merchantId: '',
    accountId: '',
    feedSettings: {
      primaryFeedId: '',
      updateFrequency: 'daily',
      deltaSync: true,
    },
  });

  if (code) {
    // Exchange code for tokens
    const credentials = await merchantClient.getTokenFromCode(code);
    
    // Store credentials securely
    const { error } = await supabase
      .from('feed_config')
      .upsert({
        feed_name: 'Google Merchant Center',
        feed_type: 'google_merchant',
        auth_credentials: credentials,
        updated_at: new Date().toISOString(),
      });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true,
      hasRefreshToken: !!credentials.refreshToken,
    });
  } else {
    // Generate auth URL
    const authUrl = await merchantClient.getAuthUrl();
    return NextResponse.json({ authUrl });
  }
}

async function handleConfiguration(body: Record<string, unknown>, supabase: SupabaseClient) {
  const config = FeedConfigSchema.parse(body);

  // Get stored credentials
  const { data: feedConfig } = await supabase
    .from('feed_config')
    .select('auth_credentials')
    .eq('feed_type', 'google_merchant')
    .single();

  if (!feedConfig?.auth_credentials) {
    return NextResponse.json(
      { error: 'Not authenticated. Please authenticate first.' },
      { status: 401 }
    );
  }

  // Update configuration
  const { error } = await supabase
    .from('feed_config')
    .update({
      merchant_id: config.merchantId,
      account_id: config.accountId || config.merchantId,
      sync_frequency: config.updateFrequency,
      delta_sync_enabled: config.deltaSync,
      auto_sync_enabled: config.autoSync,
      metadata: {
        feedId: config.feedId,
      },
      updated_at: new Date().toISOString(),
    })
    .eq('feed_type', 'google_merchant');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Register with scheduler if auto-sync enabled
  if (config.autoSync) {
    feedScheduler.registerFeed({
      feedId: config.feedId || 'primary',
      feedName: 'Google Merchant Center',
      merchantId: config.merchantId,
      accountId: config.accountId,
      format: 'api',
      authCredentials: feedConfig.auth_credentials,
      deltaSync: config.deltaSync,
      updateFrequency: config.updateFrequency,
    });

    feedScheduler.schedule(config.feedId || 'primary', config.updateFrequency);
  }

  return NextResponse.json({ success: true });
}

async function handleSync(body: Record<string, unknown>, supabase: SupabaseClient) {
  const { feedId = 'primary' } = body;

  // Get configuration
  const { data: feedConfig } = await supabase
    .from('feed_config')
    .select('*')
    .eq('feed_type', 'google_merchant')
    .single();

  if (!feedConfig) {
    return NextResponse.json(
      { error: 'Feed not configured' },
      { status: 400 }
    );
  }

  // Initialize merchant client
  const merchantClient = new GoogleMerchantClient({
    merchantId: feedConfig.merchant_id,
    accountId: feedConfig.account_id || feedConfig.merchant_id,
    credentials: feedConfig.auth_credentials,
    feedSettings: {
      primaryFeedId: feedId as string,
      updateFrequency: feedConfig.sync_frequency || 'daily',
      deltaSync: feedConfig.delta_sync_enabled ?? true,
    },
  });

  try {
    // Authenticate
    if (feedConfig.auth_credentials?.refreshToken) {
      await merchantClient.authenticate(feedConfig.auth_credentials.refreshToken);
    } else {
      return NextResponse.json(
        { error: 'No refresh token available. Please re-authenticate.' },
        { status: 401 }
      );
    }

    // Fetch products
    const productFeed = await merchantClient.getAllProducts(feedId as string);

    // Parse feed
    const parser = new ProductFeedParser();
    const parsed = await parser.parseFeed(productFeed, 'api');

    // Sync to database
    const syncService = new ProductSyncServiceImpl(supabase);
    const syncResult = await syncService.syncProducts(parsed);

    // Update last sync time
    await supabase
      .from('feed_config')
      .update({
        last_sync_at: new Date().toISOString(),
        next_sync_at: calculateNextSync(feedConfig.sync_frequency),
      })
      .eq('feed_type', 'google_merchant');

    return NextResponse.json({
      success: true,
      result: syncResult,
      summary: {
        totalProducts: parsed.totalCount,
        categories: parsed.categories.size,
        brands: parsed.brands.size,
        inserted: syncResult.inserted,
        updated: syncResult.updated,
        deleted: syncResult.deleted,
        failed: syncResult.failed,
        duration: `${syncResult.duration}ms`,
      },
    });
  } catch (error) {
    console.error('Sync failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    );
  }
}

async function handleTest(body: Record<string, unknown>, supabase: SupabaseClient) {
  // Get configuration
  const { data: feedConfig } = await supabase
    .from('feed_config')
    .select('*')
    .eq('feed_type', 'google_merchant')
    .single();

  if (!feedConfig) {
    return NextResponse.json(
      { error: 'Feed not configured' },
      { status: 400 }
    );
  }

  const merchantClient = new GoogleMerchantClient({
    merchantId: feedConfig.merchant_id,
    accountId: feedConfig.account_id || feedConfig.merchant_id,
    credentials: feedConfig.auth_credentials,
    feedSettings: {
      primaryFeedId: 'primary',
      updateFrequency: 'daily',
      deltaSync: true,
    },
  });

  try {
    // Authenticate
    if (feedConfig.auth_credentials?.refreshToken) {
      await merchantClient.authenticate(feedConfig.auth_credentials.refreshToken);
    } else {
      return NextResponse.json(
        { error: 'No refresh token available. Please re-authenticate.' },
        { status: 401 }
      );
    }

    // Test connection
    const isConnected = await merchantClient.testConnection();

    if (isConnected) {
      // Fetch a sample of products
      const sample = await merchantClient.getProductFeed(undefined, undefined, 5);
      
      return NextResponse.json({
        success: true,
        connected: true,
        sampleProducts: sample.products.length,
        products: sample.products.map(p => ({
          id: p.id,
          title: p.title,
          price: p.price,
          availability: p.availability,
          brand: p.brand,
        })),
      });
    } else {
      return NextResponse.json({
        success: false,
        connected: false,
        error: 'Connection test failed',
      });
    }
  } catch (error) {
    return NextResponse.json({
      success: false,
      connected: false,
      error: error instanceof Error ? error.message : 'Test failed',
    });
  }
}

function calculateNextSync(frequency: string): string {
  const now = new Date();
  switch (frequency) {
    case 'hourly':
      now.setHours(now.getHours() + 1);
      break;
    case 'weekly':
      now.setDate(now.getDate() + 7);
      break;
    case 'daily':
    default:
      now.setDate(now.getDate() + 1);
      break;
  }
  return now.toISOString();
}