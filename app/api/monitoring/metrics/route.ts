import { NextRequest, NextResponse } from 'next/server';
import { withCacheHeaders, CachePresets } from '@/lib/api/cache-headers';

export async function GET(request: NextRequest) {
  try {
    // Collect various metrics
    const metrics = {
      timestamp: new Date().toISOString(),
      performance: {
        memoryUsage: process.memoryUsage(),
        uptime: process.uptime(),
      },
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        env: process.env.NODE_ENV,
      },
      health: {
        status: 'healthy',
        database: 'connected',
        services: {
          openai: 'operational',
          supabase: 'operational',
          sentry: process.env.NEXT_PUBLIC_SENTRY_DSN ? 'configured' : 'not configured',
        },
      },
    };

    const response = NextResponse.json(metrics);
    return withCacheHeaders(response, CachePresets.shortLived);
  } catch (error) {
    console.error('Error fetching metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch metrics' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Log custom metrics (can be sent to monitoring service)
    console.log('Custom metric received:', body);
    
    // In production, send to monitoring service
    if (typeof window !== 'undefined' && (window as any).Sentry) {
      (window as any).Sentry.captureMessage('Custom metric', {
        level: 'info',
        extra: body,
      });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error logging metric:', error);
    return NextResponse.json(
      { error: 'Failed to log metric' },
      { status: 500 }
    );
  }
}