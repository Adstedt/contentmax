# TASK-017: Monitoring & Analytics Setup

## Overview

**Priority**: P1 - Critical  
**Estimate**: 3 hours  
**Owner**: DevOps/Backend Developer  
**Dependencies**: Application deployed to staging  
**Status**: Not Started

## Problem Statement

We need comprehensive monitoring and analytics to track application health, user behavior, and business metrics in production. This includes error tracking with Sentry, product analytics with PostHog, and custom metrics dashboards.

## Technical Requirements

### 1. Sentry Error Tracking Setup

#### File: `lib/monitoring/sentry-config.ts`

```typescript
import * as Sentry from '@sentry/nextjs';
import { CaptureContext } from '@sentry/types';

export function initSentry() {
  const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;
  const environment = process.env.NEXT_PUBLIC_ENV || 'development';

  if (!SENTRY_DSN) {
    console.warn('Sentry DSN not configured');
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment,

    // Performance Monitoring
    tracesSampleRate: environment === 'production' ? 0.1 : 1.0,

    // Session Replay
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,

    // Release tracking
    release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,

    // Integrations
    integrations: [
      new Sentry.BrowserTracing({
        routingInstrumentation: Sentry.nextRouterInstrumentation,
        tracingOrigins: ['localhost', /^https:\/\/contentmax\.io/],
      }),
      new Sentry.Replay({
        maskAllText: false,
        blockAllMedia: false,

        // Privacy settings
        mask: ['.sensitive', '[data-private]'],
        block: ['.credit-card', '.ssn'],

        // Capture console and network
        networkDetailAllowUrls: ['/api'],
        networkCaptureBodies: true,
        networkRequestHeaders: ['X-Request-Id'],
      }),
    ],

    // Filtering
    beforeSend(event, hint) {
      // Filter out known non-issues
      if (event.exception?.values?.[0]?.type === 'ChunkLoadError') {
        return null;
      }

      // Redact sensitive data
      if (event.request?.cookies) {
        event.request.cookies = '[Redacted]';
      }

      // Add user context
      if (typeof window !== 'undefined') {
        event.contexts = {
          ...event.contexts,
          app: {
            viewport: `${window.innerWidth}x${window.innerHeight}`,
            screen: `${window.screen.width}x${window.screen.height}`,
            memory: (navigator as any).deviceMemory,
            connection: (navigator as any).connection?.effectiveType,
          },
        };
      }

      return event;
    },

    // Breadcrumbs configuration
    beforeBreadcrumb(breadcrumb) {
      // Filter out noisy breadcrumbs
      if (breadcrumb.category === 'console' && breadcrumb.level === 'debug') {
        return null;
      }

      // Enhance navigation breadcrumbs
      if (breadcrumb.category === 'navigation') {
        breadcrumb.data = {
          ...breadcrumb.data,
          timestamp: new Date().toISOString(),
        };
      }

      return breadcrumb;
    },

    // Error grouping
    beforeSendTransaction(transaction) {
      // Group similar transactions
      if (transaction.transaction?.startsWith('/api/nodes/')) {
        transaction.transaction = '/api/nodes/[nodeId]';
      }

      return transaction;
    },
  });
}

// Custom error capture with context
export function captureError(
  error: Error,
  context?: {
    tags?: Record<string, string>;
    extra?: Record<string, any>;
    user?: {
      id?: string;
      email?: string;
    };
    level?: 'fatal' | 'error' | 'warning' | 'info';
  }
) {
  const captureContext: CaptureContext = {
    level: context?.level || 'error',
    tags: {
      component: 'unknown',
      ...context?.tags,
    },
    extra: {
      timestamp: new Date().toISOString(),
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      ...context?.extra,
    },
  };

  if (context?.user) {
    captureContext.user = context.user;
  }

  Sentry.captureException(error, captureContext);
}

// Performance monitoring
export function measureTransaction<T>(
  name: string,
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  const transaction = Sentry.startTransaction({
    name,
    op: operation,
  });

  Sentry.getCurrentHub().configureScope((scope) => scope.setSpan(transaction));

  return fn()
    .then((result) => {
      transaction.setStatus('ok');
      return result;
    })
    .catch((error) => {
      transaction.setStatus('internal_error');
      throw error;
    })
    .finally(() => {
      transaction.finish();
    });
}
```

### 2. PostHog Product Analytics

#### File: `lib/monitoring/posthog-config.ts`

```typescript
import posthog from 'posthog-js';
import { PostHogProvider as Provider } from 'posthog-js/react';

export function initPostHog() {
  if (typeof window === 'undefined') return;

  const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com';

  if (!POSTHOG_KEY) {
    console.warn('PostHog key not configured');
    return;
  }

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,

    // Capture settings
    capture_pageview: true,
    capture_pageleave: true,
    autocapture: true,

    // Session recording
    session_recording: {
      enabled: true,
      recordCrossOriginIframes: false,
      maskAllInputs: false,
      maskInputOptions: {
        password: true,
        email: false,
      },
    },

    // Feature flags
    bootstrap: {
      featureFlags: {
        'new-dashboard': false,
        'advanced-scoring': false,
      },
    },

    // Privacy
    mask_all_text: false,
    mask_all_element_attributes: false,

    // Performance
    disable_session_recording: process.env.NODE_ENV === 'development',

    // Custom settings
    loaded: (posthog) => {
      // Set up super properties
      posthog.register({
        app_version: process.env.NEXT_PUBLIC_APP_VERSION,
        environment: process.env.NEXT_PUBLIC_ENV,
      });

      // Identify user if logged in
      const userId = getUserId();
      if (userId) {
        posthog.identify(userId, {
          email: getUserEmail(),
          created_at: getUserCreatedAt(),
        });
      }
    },
  });
}

// Event tracking helpers
export const analytics = {
  // Page views
  pageView(pageName: string, properties?: Record<string, any>) {
    posthog.capture('$pageview', {
      page_name: pageName,
      ...properties,
    });
  },

  // User actions
  track(event: string, properties?: Record<string, any>) {
    posthog.capture(event, properties);
  },

  // Opportunity scoring events
  scoreOpportunity(nodeId: string, score: number, factors: any) {
    posthog.capture('opportunity_scored', {
      node_id: nodeId,
      score,
      factors,
      timestamp: new Date().toISOString(),
    });
  },

  // Revenue tracking
  trackRevenue(amount: number, currency: string = 'USD', properties?: any) {
    posthog.capture('revenue', {
      amount,
      currency,
      ...properties,
    });
  },

  // Feature usage
  featureUsed(feature: string, properties?: any) {
    posthog.capture('feature_used', {
      feature_name: feature,
      ...properties,
    });
  },

  // Search events
  search(query: string, results: number, filters?: any) {
    posthog.capture('search', {
      query,
      results_count: results,
      filters,
      timestamp: new Date().toISOString(),
    });
  },

  // Error events
  trackError(error: string, context?: any) {
    posthog.capture('error_occurred', {
      error_message: error,
      context,
      timestamp: new Date().toISOString(),
    });
  },

  // Performance metrics
  trackPerformance(metric: string, value: number, tags?: any) {
    posthog.capture('performance_metric', {
      metric_name: metric,
      value,
      tags,
      timestamp: new Date().toISOString(),
    });
  },

  // A/B test exposure
  experimentViewed(experiment: string, variant: string) {
    posthog.capture('$experiment_viewed', {
      experiment_name: experiment,
      variant,
      timestamp: new Date().toISOString(),
    });
  },

  // User properties
  setUserProperties(properties: Record<string, any>) {
    posthog.people.set(properties);
  },

  // Feature flags
  isFeatureEnabled(flag: string): boolean {
    return posthog.isFeatureEnabled(flag) || false;
  },

  // Get all feature flags
  getFeatureFlags(): Record<string, boolean | string> {
    return posthog.getFeatureFlags() || {};
  },
};

// Helper functions
function getUserId(): string | null {
  // Implement based on your auth system
  return localStorage.getItem('userId');
}

function getUserEmail(): string | null {
  return localStorage.getItem('userEmail');
}

function getUserCreatedAt(): string | null {
  return localStorage.getItem('userCreatedAt');
}

export const PostHogProvider = Provider;
```

### 3. Custom Metrics Dashboard

#### File: `app/api/metrics/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const MetricSchema = z.object({
  metric: z.string(),
  value: z.number(),
  timestamp: z.number(),
  url: z.string().optional(),
  userAgent: z.string().optional(),
  tags: z.record(z.any()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const metric = MetricSchema.parse(body);

    // Store in database
    const supabase = await createClient();

    await supabase.from('metrics').insert({
      name: metric.metric,
      value: metric.value,
      timestamp: new Date(metric.timestamp),
      metadata: {
        url: metric.url,
        userAgent: metric.userAgent,
        tags: metric.tags,
      },
    });

    // Send to monitoring service (e.g., Datadog, CloudWatch)
    await forwardToMonitoring(metric);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Metrics API error:', error);
    return NextResponse.json({ error: 'Failed to record metric' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '24h';
    const metric = searchParams.get('metric');

    const supabase = await createClient();

    // Calculate time range
    const now = new Date();
    const periodMs = parsePeriod(period);
    const startTime = new Date(now.getTime() - periodMs);

    // Build query
    let query = supabase
      .from('metrics')
      .select('*')
      .gte('timestamp', startTime.toISOString())
      .order('timestamp', { ascending: false });

    if (metric) {
      query = query.eq('name', metric);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Aggregate metrics
    const aggregated = aggregateMetrics(data);

    return NextResponse.json({
      period,
      metrics: aggregated,
      raw: data,
    });
  } catch (error) {
    console.error('Metrics fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch metrics' }, { status: 500 });
  }
}

function parsePeriod(period: string): number {
  const units: Record<string, number> = {
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000,
    m: 30 * 24 * 60 * 60 * 1000,
  };

  const match = period.match(/^(\d+)([hdwm])$/);
  if (!match) return 24 * 60 * 60 * 1000; // Default 24h

  const [, num, unit] = match;
  return parseInt(num) * units[unit];
}

function aggregateMetrics(metrics: any[]): any {
  const grouped = metrics.reduce(
    (acc, metric) => {
      if (!acc[metric.name]) {
        acc[metric.name] = {
          count: 0,
          sum: 0,
          min: Infinity,
          max: -Infinity,
          values: [],
        };
      }

      const group = acc[metric.name];
      group.count++;
      group.sum += metric.value;
      group.min = Math.min(group.min, metric.value);
      group.max = Math.max(group.max, metric.value);
      group.values.push(metric.value);

      return acc;
    },
    {} as Record<string, any>
  );

  // Calculate statistics
  Object.values(grouped).forEach((group: any) => {
    group.average = group.sum / group.count;
    group.median = calculateMedian(group.values);
    group.p95 = calculatePercentile(group.values, 95);
    group.p99 = calculatePercentile(group.values, 99);
    delete group.values; // Remove raw values to reduce payload
  });

  return grouped;
}

function calculateMedian(values: number[]): number {
  const sorted = values.sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }

  return sorted[mid];
}

function calculatePercentile(values: number[], percentile: number): number {
  const sorted = values.sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[index];
}

async function forwardToMonitoring(metric: any) {
  // Example: Send to Datadog
  if (process.env.DATADOG_API_KEY) {
    await fetch('https://api.datadoghq.com/api/v1/series', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'DD-API-KEY': process.env.DATADOG_API_KEY,
      },
      body: JSON.stringify({
        series: [
          {
            metric: `contentmax.${metric.metric}`,
            points: [[metric.timestamp / 1000, metric.value]],
            tags: Object.entries(metric.tags || {}).map(([k, v]) => `${k}:${v}`),
          },
        ],
      }),
    }).catch(console.error);
  }
}
```

### 4. Health Check Endpoints

#### File: `app/api/health/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { Redis } from '@upstash/redis';

export async function GET() {
  const checks = {
    api: 'healthy',
    database: 'unknown',
    cache: 'unknown',
    external: 'unknown',
  };

  const errors: string[] = [];

  // Check database
  try {
    const supabase = await createClient();
    const { error } = await supabase.from('projects').select('id').limit(1);

    if (error) throw error;
    checks.database = 'healthy';
  } catch (error) {
    checks.database = 'unhealthy';
    errors.push(`Database: ${error.message}`);
  }

  // Check cache (Redis/Upstash)
  try {
    const redis = Redis.fromEnv();
    await redis.ping();
    checks.cache = 'healthy';
  } catch (error) {
    checks.cache = 'degraded';
    errors.push(`Cache: ${error.message}`);
  }

  // Check external services (GSC, GA4)
  try {
    // Quick connectivity check
    const response = await fetch('https://www.googleapis.com/discovery/v1/apis', {
      method: 'HEAD',
      signal: AbortSignal.timeout(5000),
    });

    checks.external = response.ok ? 'healthy' : 'degraded';
  } catch (error) {
    checks.external = 'degraded';
    errors.push(`External APIs: ${error.message}`);
  }

  // Overall health
  const allHealthy = Object.values(checks).every((status) => status === 'healthy');
  const hasUnhealthy = Object.values(checks).some((status) => status === 'unhealthy');

  const overall = hasUnhealthy ? 'unhealthy' : allHealthy ? 'healthy' : 'degraded';

  return NextResponse.json(
    {
      status: overall,
      checks,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.NEXT_PUBLIC_APP_VERSION,
    },
    {
      status: overall === 'unhealthy' ? 503 : 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    }
  );
}
```

### 5. Monitoring Dashboard Component

#### File: `components/monitoring/metrics-dashboard.tsx`

```typescript
'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity, AlertCircle, CheckCircle, Clock, TrendingUp, Users } from 'lucide-react';

export function MetricsDashboard() {
  const { data: health } = useQuery({
    queryKey: ['health'],
    queryFn: async () => {
      const res = await fetch('/api/health');
      return res.json();
    },
    refetchInterval: 30000 // Every 30 seconds
  });

  const { data: metrics } = useQuery({
    queryKey: ['metrics', '24h'],
    queryFn: async () => {
      const res = await fetch('/api/metrics?period=24h');
      return res.json();
    },
    refetchInterval: 60000 // Every minute
  });

  return (
    <div className="space-y-6">
      {/* Health Status */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">API Health</CardTitle>
            {health?.checks.api === 'healthy' ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-500" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{health?.checks.api || 'Unknown'}</div>
            <p className="text-xs text-muted-foreground">
              Uptime: {formatUptime(health?.uptime)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Database</CardTitle>
            {health?.checks.database === 'healthy' ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-500" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{health?.checks.database || 'Unknown'}</div>
            <p className="text-xs text-muted-foreground">
              PostgreSQL via Supabase
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cache</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{health?.checks.cache || 'Unknown'}</div>
            <p className="text-xs text-muted-foreground">
              Redis/Upstash
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">External APIs</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{health?.checks.external || 'Unknown'}</div>
            <p className="text-xs text-muted-foreground">
              GSC, GA4, Shopify
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Metrics Tabs */}
      <Tabs defaultValue="performance" className="space-y-4">
        <TabsList>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="errors">Errors</TabsTrigger>
          <TabsTrigger value="usage">Usage</TabsTrigger>
          <TabsTrigger value="business">Business</TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="space-y-4">
          <PerformanceMetrics data={metrics?.metrics} />
        </TabsContent>

        <TabsContent value="errors" className="space-y-4">
          <ErrorMetrics data={metrics?.metrics} />
        </TabsContent>

        <TabsContent value="usage" className="space-y-4">
          <UsageMetrics data={metrics?.metrics} />
        </TabsContent>

        <TabsContent value="business" className="space-y-4">
          <BusinessMetrics data={metrics?.metrics} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PerformanceMetrics({ data }: { data: any }) {
  // Transform data for charts
  const webVitals = [
    { name: 'LCP', value: data?.LCP?.average || 0, target: 2500 },
    { name: 'FID', value: data?.FID?.average || 0, target: 100 },
    { name: 'CLS', value: data?.CLS?.average || 0, target: 0.1 },
    { name: 'TTFB', value: data?.TTFB?.average || 0, target: 800 }
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Core Web Vitals</CardTitle>
        <CardDescription>Average performance metrics over last 24 hours</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={webVitals}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="value" fill="#8884d8" />
            <Bar dataKey="target" fill="#82ca9d" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function ErrorMetrics({ data }: { data: any }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Error Rate</CardTitle>
        <CardDescription>Errors per hour</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">
          {data?.errors?.count || 0}
        </div>
        <p className="text-muted-foreground">
          Total errors in last 24 hours
        </p>
      </CardContent>
    </Card>
  );
}

function UsageMetrics({ data }: { data: any }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>API Usage</CardTitle>
        <CardDescription>Requests per endpoint</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span>Total Requests</span>
            <span className="font-bold">{data?.api_requests?.count || 0}</span>
          </div>
          <div className="flex justify-between">
            <span>Avg Response Time</span>
            <span className="font-bold">{data?.api_response_time?.average?.toFixed(0) || 0}ms</span>
          </div>
          <div className="flex justify-between">
            <span>P95 Response Time</span>
            <span className="font-bold">{data?.api_response_time?.p95?.toFixed(0) || 0}ms</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function BusinessMetrics({ data }: { data: any }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Business Metrics</CardTitle>
        <CardDescription>Key business indicators</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span>Opportunities Scored</span>
            <span className="font-bold">{data?.opportunities_scored?.count || 0}</span>
          </div>
          <div className="flex justify-between">
            <span>Revenue Calculated</span>
            <span className="font-bold">${data?.revenue_calculated?.sum?.toFixed(0) || 0}</span>
          </div>
          <div className="flex justify-between">
            <span>Active Projects</span>
            <span className="font-bold">{data?.active_projects?.count || 0}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function formatUptime(seconds?: number): string {
  if (!seconds) return 'Unknown';

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  return `${days}d ${hours}h ${minutes}m`;
}
```

## Acceptance Criteria

- [ ] Sentry error tracking configured and capturing errors
- [ ] PostHog analytics tracking user behavior
- [ ] Custom metrics API storing performance data
- [ ] Health check endpoint monitoring all services
- [ ] Monitoring dashboard displaying real-time metrics
- [ ] Alert rules configured for critical errors
- [ ] Session replay enabled for debugging
- [ ] Performance metrics tracked automatically
- [ ] Business KPIs tracked and visualized
- [ ] Documentation for accessing monitoring tools

## Implementation Steps

1. **Hour 1**: Sentry setup and error tracking
2. **Hour 2**: PostHog analytics integration
3. **Hour 3**: Custom metrics and health checks

## Testing

```typescript
describe('Monitoring', () => {
  it('should track errors to Sentry', () => {
    const error = new Error('Test error');
    captureError(error, { tags: { test: 'true' } });

    expect(Sentry.captureException).toHaveBeenCalledWith(
      error,
      expect.objectContaining({
        tags: expect.objectContaining({ test: 'true' }),
      })
    );
  });

  it('should track analytics events', () => {
    analytics.track('test_event', { value: 123 });

    expect(posthog.capture).toHaveBeenCalledWith('test_event', {
      value: 123,
    });
  });

  it('should report health status', async () => {
    const response = await fetch('/api/health');
    const data = await response.json();

    expect(data.status).toBeDefined();
    expect(data.checks).toBeDefined();
  });
});
```

## Notes

- Set up alerts for error rate thresholds
- Create runbooks for common issues
- Implement SLOs and error budgets
- Consider adding distributed tracing
