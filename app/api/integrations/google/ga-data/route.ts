import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/external/supabase/server';
import { google } from 'googleapis';
import { decrypt } from '@/lib/external/encryption';

export async function POST(request: NextRequest) {
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

    // Parse request body
    const body = await request.json();
    const { propertyId, startDate, endDate, metrics, dimensions } = body;

    if (!propertyId) {
      return NextResponse.json({ error: 'Property ID is required' }, { status: 400 });
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

    // Initialize GA4 Data API
    const analyticsData = google.analyticsdata({
      version: 'v1beta',
      auth: oauth2Client,
    });

    // Default date range: last 30 days
    const endDateValue = endDate || 'today';
    const startDateValue = startDate || '30daysAgo';

    // Default metrics if not specified
    const metricsToFetch = metrics || [
      { name: 'activeUsers' },
      { name: 'newUsers' },
      { name: 'sessions' },
      { name: 'screenPageViews' },
      { name: 'averageSessionDuration' },
      { name: 'bounceRate' },
      { name: 'eventCount' },
    ];

    // Default dimensions if not specified
    const dimensionsToFetch = dimensions || [{ name: 'date' }];

    // Fetch GA4 data
    const response = await analyticsData.properties.runReport({
      property: `properties/${propertyId}`,
      requestBody: {
        dateRanges: [{ startDate: startDateValue, endDate: endDateValue }],
        metrics: metricsToFetch,
        dimensions: dimensionsToFetch,
        limit: 1000,
      },
    });

    // Also fetch real-time data
    const realtimeResponse = await analyticsData.properties.runRealtimeReport({
      property: `properties/${propertyId}`,
      requestBody: {
        metrics: [{ name: 'activeUsers' }],
        dimensions: [{ name: 'country' }, { name: 'deviceCategory' }],
        limit: 10,
      },
    });

    // Format the response
    const formattedData = {
      property: propertyId,
      dateRange: {
        startDate: startDateValue,
        endDate: endDateValue,
      },
      metrics: response.data.metricHeaders?.map((header) => ({
        name: header.name,
        type: header.type,
      })),
      dimensions: response.data.dimensionHeaders?.map((header) => header.name),
      rows:
        response.data.rows?.map((row) => ({
          dimensions: row.dimensionValues?.map((dim) => dim.value),
          metrics: row.metricValues?.map((metric) => ({
            value: metric.value,
            formattedValue: formatMetricValue(metric.value, metric.value),
          })),
        })) || [],
      totals: response.data.totals?.[0]?.metricValues?.map((metric, index) => ({
        name: response.data.metricHeaders?.[index]?.name,
        value: metric.value,
        formattedValue: formatMetricValue(metric.value, response.data.metricHeaders?.[index]?.name),
      })),
      realtime: {
        activeUsers: realtimeResponse.data.rows?.[0]?.metricValues?.[0]?.value || '0',
        topCountries: realtimeResponse.data.rows
          ?.filter((row) => row.dimensionValues?.[1]?.value === row.dimensionValues?.[1]?.value)
          .map((row) => ({
            country: row.dimensionValues?.[0]?.value,
            activeUsers: row.metricValues?.[0]?.value,
          }))
          .slice(0, 5),
        topDevices: realtimeResponse.data.rows
          ?.map((row) => ({
            device: row.dimensionValues?.[1]?.value,
            activeUsers: row.metricValues?.[0]?.value,
          }))
          .slice(0, 3),
      },
      rowCount: response.data.rowCount || 0,
    };

    return NextResponse.json(formattedData);
  } catch (error: any) {
    console.error('Error fetching GA data:', error);

    if (error.message?.includes('invalid_grant') || error.response?.status === 401) {
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
        error: 'Failed to fetch GA data',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

// Helper function to format metric values
function formatMetricValue(value: string | undefined, metricName: string | undefined): string {
  if (!value) return '0';

  const numValue = parseFloat(value);

  if (metricName?.includes('Rate') || metricName?.includes('rate')) {
    return `${(numValue * 100).toFixed(2)}%`;
  }

  if (metricName?.includes('Duration') || metricName?.includes('duration')) {
    const minutes = Math.floor(numValue / 60);
    const seconds = Math.floor(numValue % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  if (numValue >= 1000000) {
    return `${(numValue / 1000000).toFixed(1)}M`;
  }

  if (numValue >= 1000) {
    return `${(numValue / 1000).toFixed(1)}K`;
  }

  return numValue.toFixed(0);
}
