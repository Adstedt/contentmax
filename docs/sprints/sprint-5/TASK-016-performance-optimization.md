# TASK-016: Performance Optimization

## Overview

**Priority**: P0 - Blocker  
**Estimate**: 5 hours  
**Owner**: Full Stack Developer  
**Dependencies**: All core features complete  
**Status**: Not Started

## Problem Statement

We need to optimize the application for production performance to handle 3000+ nodes efficiently. This includes implementing React Query for data fetching, code splitting, bundle optimization, and ensuring the app meets Core Web Vitals requirements.

## Technical Requirements

### 1. React Query Implementation

#### File: `lib/react-query/queries.ts`

```typescript
import { useQuery, useMutation, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import { fetchWithRetry } from '@/lib/fetch/fetch-with-retry';

// Query keys factory
export const queryKeys = {
  all: ['contentmax'] as const,
  projects: () => [...queryKeys.all, 'projects'] as const,
  project: (id: string) => [...queryKeys.projects(), id] as const,
  nodes: (projectId: string) => [...queryKeys.project(projectId), 'nodes'] as const,
  node: (nodeId: string) => [...queryKeys.all, 'node', nodeId] as const,
  opportunities: (projectId: string, filters?: any) =>
    [...queryKeys.project(projectId), 'opportunities', filters] as const,
  metrics: (nodeId: string) => [...queryKeys.node(nodeId), 'metrics'] as const,
  insights: (projectId: string) => [...queryKeys.project(projectId), 'insights'] as const,
  jobs: () => [...queryKeys.all, 'jobs'] as const,
  job: (jobId: string) => [...queryKeys.jobs(), jobId] as const,
};

// Stale times
const STALE_TIMES = {
  STATIC: 1000 * 60 * 60, // 1 hour for static data
  DYNAMIC: 1000 * 60 * 5, // 5 minutes for dynamic data
  REALTIME: 1000 * 30, // 30 seconds for real-time data
};

/**
 * Fetch project nodes with caching
 */
export function useProjectNodes(projectId: string, options?: UseQueryOptions) {
  return useQuery({
    queryKey: queryKeys.nodes(projectId),
    queryFn: async () => {
      const response = await fetchWithRetry(`/api/projects/${projectId}/nodes`);
      return response.json();
    },
    staleTime: STALE_TIMES.DYNAMIC,
    cacheTime: 1000 * 60 * 30, // 30 minutes
    refetchOnWindowFocus: false,
    ...options,
  });
}

/**
 * Fetch opportunities with intelligent caching
 */
export function useOpportunities(
  projectId: string,
  filters?: {
    limit?: number;
    offset?: number;
    sortBy?: string;
    minScore?: number;
  }
) {
  return useQuery({
    queryKey: queryKeys.opportunities(projectId, filters),
    queryFn: async () => {
      const params = new URLSearchParams({
        projectId,
        ...Object.entries(filters || {}).reduce(
          (acc, [key, value]) => ({
            ...acc,
            [key]: String(value),
          }),
          {}
        ),
      });

      const response = await fetchWithRetry(`/api/insights/opportunities?${params}`);
      return response.json();
    },
    staleTime: STALE_TIMES.DYNAMIC,
    keepPreviousData: true, // For pagination
    refetchInterval: false,
    refetchOnMount: 'always',
  });
}

/**
 * Fetch node metrics with background refetching
 */
export function useNodeMetrics(nodeId: string) {
  return useQuery({
    queryKey: queryKeys.metrics(nodeId),
    queryFn: async () => {
      const response = await fetchWithRetry(`/api/nodes/${nodeId}/metrics`);
      return response.json();
    },
    staleTime: STALE_TIMES.REALTIME,
    refetchInterval: 1000 * 60 * 2, // Refetch every 2 minutes
    refetchIntervalInBackground: true,
  });
}

/**
 * Optimistic update for opportunity scoring
 */
export function useScoreOpportunity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (nodeId: string) => {
      const response = await fetchWithRetry(`/api/opportunities/${nodeId}/score`, {
        method: 'POST',
      });
      return response.json();
    },
    onMutate: async (nodeId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.node(nodeId) });

      // Optimistically update
      const previousData = queryClient.getQueryData(queryKeys.node(nodeId));

      queryClient.setQueryData(queryKeys.node(nodeId), (old: any) => ({
        ...old,
        scoring: true,
      }));

      return { previousData };
    },
    onError: (err, nodeId, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(queryKeys.node(nodeId), context.previousData);
      }
    },
    onSettled: (data, error, nodeId) => {
      // Refetch regardless of error or success
      queryClient.invalidateQueries({ queryKey: queryKeys.node(nodeId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.opportunities(nodeId) });
    },
  });
}

/**
 * Prefetch related data
 */
export function usePrefetchRelated(nodeId: string, parentId?: string) {
  const queryClient = useQueryClient();

  // Prefetch parent node
  if (parentId) {
    queryClient.prefetchQuery({
      queryKey: queryKeys.node(parentId),
      queryFn: async () => {
        const response = await fetchWithRetry(`/api/nodes/${parentId}`);
        return response.json();
      },
      staleTime: STALE_TIMES.STATIC,
    });
  }

  // Prefetch children nodes
  queryClient.prefetchQuery({
    queryKey: [...queryKeys.node(nodeId), 'children'],
    queryFn: async () => {
      const response = await fetchWithRetry(`/api/nodes/${nodeId}/children`);
      return response.json();
    },
    staleTime: STALE_TIMES.DYNAMIC,
  });
}
```

### 2. Code Splitting & Lazy Loading

#### File: `components/lazy/lazy-components.ts`

```typescript
import dynamic from 'next/dynamic';
import { ComponentType, lazy } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

// Loading components
const ChartSkeleton = () => (
  <div className="space-y-2">
    <Skeleton className="h-8 w-32" />
    <Skeleton className="h-64 w-full" />
  </div>
);

const VisualizationSkeleton = () => (
  <div className="relative w-full h-full">
    <Skeleton className="absolute inset-0" />
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="text-muted-foreground">Loading visualization...</div>
    </div>
  </div>
);

// Dynamic imports with loading states
export const TaxonomyVisualization = dynamic(
  () => import('@/components/taxonomy/taxonomy-visualization').then(mod => mod.TaxonomyVisualization),
  {
    loading: () => <VisualizationSkeleton />,
    ssr: false // D3 doesn't work with SSR
  }
);

export const RevenueChart = dynamic(
  () => import('@/components/charts/revenue-chart').then(mod => mod.RevenueChart),
  {
    loading: () => <ChartSkeleton />
  }
);

export const OpportunityScoreChart = dynamic(
  () => import('@/components/charts/opportunity-score-chart').then(mod => mod.OpportunityScoreChart),
  {
    loading: () => <ChartSkeleton />
  }
);

export const MetricsTable = dynamic(
  () => import('@/components/tables/metrics-table').then(mod => mod.MetricsTable),
  {
    loading: () => (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    )
  }
);

// Route-based code splitting
export const routes = {
  dashboard: dynamic(() => import('@/app/dashboard/page')),
  opportunities: dynamic(() => import('@/app/opportunities/page')),
  visualization: dynamic(() => import('@/app/visualization/page')),
  settings: dynamic(() => import('@/app/settings/page'))
};

// Utility for preloading components
export function preloadComponent(component: ComponentType<any>) {
  if ('preload' in component) {
    (component as any).preload();
  }
}
```

### 3. Bundle Optimization

#### File: `next.config.js`

```javascript
/** @type {import('next').NextConfig} */
const { withSentryConfig } = require('@sentry/nextjs');
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,

  // Optimize images
  images: {
    domains: ['contentmax.io', 'localhost'],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
  },

  // Optimize fonts
  optimizeFonts: true,

  // Compression
  compress: true,

  // Production optimizations
  compiler: {
    removeConsole:
      process.env.NODE_ENV === 'production'
        ? {
            exclude: ['error', 'warn'],
          }
        : false,
  },

  // Webpack optimizations
  webpack: (config, { dev, isServer }) => {
    // Tree shaking
    config.optimization.usedExports = true;

    // Split chunks optimization
    if (!dev && !isServer) {
      config.optimization.splitChunks = {
        chunks: 'all',
        minSize: 20000,
        maxSize: 244000,
        minChunks: 1,
        maxAsyncRequests: 30,
        maxInitialRequests: 30,
        cacheGroups: {
          default: false,
          vendors: false,
          // Vendor splitting
          framework: {
            name: 'framework',
            chunks: 'all',
            test: /[\\/]node_modules[\\/](react|react-dom|scheduler|prop-types|use-sync-external-store)[\\/]/,
            priority: 40,
            enforce: true,
          },
          lib: {
            test: /[\\/]node_modules[\\/]/,
            name(module) {
              const packageName = module.context.match(/[\\/]node_modules[\\/](.*?)([\\/]|$)/)[1];
              return `lib.${packageName.replace('@', '')}`;
            },
            priority: 30,
            minChunks: 1,
            reuseExistingChunk: true,
          },
          commons: {
            name: 'commons',
            minChunks: 2,
            priority: 20,
          },
          shared: {
            name: 'shared',
            test: /[\\/]components[\\/]|[\\/]lib[\\/]|[\\/]hooks[\\/]/,
            priority: 10,
            reuseExistingChunk: true,
          },
        },
      };

      // Minimize main bundle
      config.optimization.runtimeChunk = {
        name: 'runtime',
      };
    }

    // Module federation for micro-frontends (future)
    config.experiments = {
      ...config.experiments,
      topLevelAwait: true,
    };

    return config;
  },

  // Experimental features
  experimental: {
    optimizeCss: true,
    legacyBrowsers: false,
    browsersListForSwc: true,
    serverComponentsExternalPackages: ['@prisma/client', 'bcrypt'],
  },

  // Headers for caching
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
        ],
      },
      {
        source: '/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
};

// Sentry configuration
const sentryWebpackPluginOptions = {
  silent: true,
  org: 'contentmax',
  project: 'contentmax-app',
};

module.exports = withBundleAnalyzer(
  process.env.NODE_ENV === 'production'
    ? withSentryConfig(nextConfig, sentryWebpackPluginOptions)
    : nextConfig
);
```

### 4. Performance Monitoring

#### File: `lib/performance/performance-monitor.ts`

```typescript
import { getCLS, getFID, getLCP, getFCP, getTTFB } from 'web-vitals';

export interface PerformanceMetrics {
  cls: number | null;
  fid: number | null;
  lcp: number | null;
  fcp: number | null;
  ttfb: number | null;
  customMetrics: Record<string, number>;
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics = {
    cls: null,
    fid: null,
    lcp: null,
    fcp: null,
    ttfb: null,
    customMetrics: {},
  };

  private observers: Set<(metrics: PerformanceMetrics) => void> = new Set();

  constructor() {
    if (typeof window !== 'undefined') {
      this.initializeWebVitals();
      this.initializeCustomMetrics();
    }
  }

  private initializeWebVitals() {
    getCLS((metric) => {
      this.metrics.cls = metric.value;
      this.notifyObservers();
      this.reportMetric('CLS', metric.value);
    });

    getFID((metric) => {
      this.metrics.fid = metric.value;
      this.notifyObservers();
      this.reportMetric('FID', metric.value);
    });

    getLCP((metric) => {
      this.metrics.lcp = metric.value;
      this.notifyObservers();
      this.reportMetric('LCP', metric.value);
    });

    getFCP((metric) => {
      this.metrics.fcp = metric.value;
      this.notifyObservers();
      this.reportMetric('FCP', metric.value);
    });

    getTTFB((metric) => {
      this.metrics.ttfb = metric.value;
      this.notifyObservers();
      this.reportMetric('TTFB', metric.value);
    });
  }

  private initializeCustomMetrics() {
    // Navigation timing
    if (window.performance && window.performance.timing) {
      const timing = window.performance.timing;
      const navigationStart = timing.navigationStart;

      // Time to interactive
      const tti = timing.loadEventEnd - navigationStart;
      this.addCustomMetric('TTI', tti);

      // DOM Content Loaded
      const dcl = timing.domContentLoadedEventEnd - navigationStart;
      this.addCustomMetric('DCL', dcl);
    }

    // Resource timing
    this.measureResourceLoading();

    // Long tasks
    this.observeLongTasks();
  }

  private measureResourceLoading() {
    if (!window.performance || !window.performance.getEntriesByType) return;

    const resources = window.performance.getEntriesByType('resource');

    // Group by type
    const byType = resources.reduce(
      (acc, resource) => {
        const type = this.getResourceType(resource.name);
        if (!acc[type]) {
          acc[type] = {
            count: 0,
            totalSize: 0,
            totalDuration: 0,
          };
        }

        acc[type].count++;
        acc[type].totalDuration += resource.duration;

        // Estimate size from timing (rough approximation)
        const size = resource.transferSize || resource.encodedBodySize || 0;
        acc[type].totalSize += size;

        return acc;
      },
      {} as Record<string, any>
    );

    Object.entries(byType).forEach(([type, stats]) => {
      this.addCustomMetric(`resources_${type}_count`, stats.count);
      this.addCustomMetric(`resources_${type}_duration`, stats.totalDuration);
      this.addCustomMetric(`resources_${type}_size`, stats.totalSize);
    });
  }

  private observeLongTasks() {
    if (!window.PerformanceObserver) return;

    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (entry.duration > 50) {
            this.addCustomMetric('long_task', entry.duration);
            console.warn('Long task detected:', entry.duration, 'ms');
          }
        });
      });

      observer.observe({ entryTypes: ['longtask'] });
    } catch (e) {
      // Long task observer not supported
    }
  }

  private getResourceType(url: string): string {
    if (url.match(/\.(js|mjs)$/)) return 'script';
    if (url.match(/\.css$/)) return 'style';
    if (url.match(/\.(jpg|jpeg|png|gif|svg|webp|avif)$/)) return 'image';
    if (url.match(/\.(woff|woff2|ttf|otf)$/)) return 'font';
    if (url.match(/\.json$/)) return 'json';
    return 'other';
  }

  private reportMetric(name: string, value: number) {
    // Send to analytics
    if (window.gtag) {
      window.gtag('event', name, {
        value: Math.round(value),
        metric_value: value,
        metric_delta: value,
      });
    }

    // Send to custom monitoring
    if (process.env.NODE_ENV === 'production') {
      fetch('/api/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metric: name,
          value,
          timestamp: Date.now(),
          url: window.location.href,
          userAgent: navigator.userAgent,
        }),
      }).catch(() => {
        // Fail silently
      });
    }
  }

  public addCustomMetric(name: string, value: number) {
    this.metrics.customMetrics[name] = value;
    this.notifyObservers();
    this.reportMetric(`custom_${name}`, value);
  }

  public measureAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now();

    return fn().finally(() => {
      const duration = performance.now() - start;
      this.addCustomMetric(name, duration);
    });
  }

  public measure<T>(name: string, fn: () => T): T {
    const start = performance.now();

    try {
      return fn();
    } finally {
      const duration = performance.now() - start;
      this.addCustomMetric(name, duration);
    }
  }

  public subscribe(callback: (metrics: PerformanceMetrics) => void) {
    this.observers.add(callback);

    // Return unsubscribe function
    return () => {
      this.observers.delete(callback);
    };
  }

  private notifyObservers() {
    this.observers.forEach((callback) => callback(this.metrics));
  }

  public getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  public reset() {
    this.metrics = {
      cls: null,
      fid: null,
      lcp: null,
      fcp: null,
      ttfb: null,
      customMetrics: {},
    };
    this.notifyObservers();
  }
}

export const performanceMonitor = new PerformanceMonitor();
```

### 5. Image Optimization

#### File: `components/optimized/optimized-image.tsx`

```typescript
'use client';

import Image from 'next/image';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  priority?: boolean;
  className?: string;
  sizes?: string;
  quality?: number;
  placeholder?: 'blur' | 'empty';
  blurDataURL?: string;
  onLoad?: () => void;
}

export function OptimizedImage({
  src,
  alt,
  width,
  height,
  priority = false,
  className,
  sizes = '100vw',
  quality = 75,
  placeholder = 'blur',
  blurDataURL,
  onLoad
}: OptimizedImageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  // Generate blur placeholder if not provided
  const placeholderUrl = blurDataURL || generateBlurDataURL();

  return (
    <div className={cn('relative overflow-hidden', className)}>
      {/* Loading skeleton */}
      {isLoading && !error && (
        <div className="absolute inset-0 bg-muted animate-pulse" />
      )}

      {/* Error state */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted">
          <span className="text-muted-foreground text-sm">Failed to load image</span>
        </div>
      )}

      {/* Optimized image */}
      {!error && (
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          sizes={sizes}
          quality={quality}
          priority={priority}
          placeholder={placeholder}
          blurDataURL={placeholderUrl}
          className={cn(
            'duration-700 ease-in-out',
            isLoading ? 'scale-110 blur-lg' : 'scale-100 blur-0',
            className
          )}
          onLoadingComplete={() => {
            setIsLoading(false);
            onLoad?.();
          }}
          onError={() => {
            setError(true);
            setIsLoading(false);
          }}
        />
      )}
    </div>
  );
}

function generateBlurDataURL(): string {
  // Simple SVG blur placeholder
  const svg = `
    <svg width="10" height="10" xmlns="http://www.w3.org/2000/svg">
      <filter id="blur">
        <feGaussianBlur stdDeviation="1" />
      </filter>
      <rect width="10" height="10" fill="#888" filter="url(#blur)" />
    </svg>
  `;

  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}
```

### 6. Virtual Scrolling for Lists

#### File: `components/virtual/virtual-list.tsx`

```typescript
'use client';

import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface VirtualListProps<T> {
  items: T[];
  height: number;
  itemHeight: number | ((index: number) => number);
  renderItem: (item: T, index: number) => React.ReactNode;
  className?: string;
  overscan?: number;
  gap?: number;
  onScroll?: (scrollTop: number) => void;
}

export function VirtualList<T>({
  items,
  height,
  itemHeight,
  renderItem,
  className,
  overscan = 5,
  gap = 0,
  onScroll
}: VirtualListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: useCallback(
      (index: number) => {
        if (typeof itemHeight === 'function') {
          return itemHeight(index) + gap;
        }
        return itemHeight + gap;
      },
      [itemHeight, gap]
    ),
    overscan,
  });

  const handleScroll = useCallback(() => {
    if (parentRef.current && onScroll) {
      onScroll(parentRef.current.scrollTop);
    }
  }, [onScroll]);

  return (
    <div
      ref={parentRef}
      className={cn('overflow-auto', className)}
      style={{ height }}
      onScroll={handleScroll}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <div
            key={virtualItem.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualItem.size - gap}px`,
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            {renderItem(items[virtualItem.index], virtualItem.index)}
          </div>
        ))}
      </div>
    </div>
  );
}
```

## Acceptance Criteria

- [ ] React Query implemented for all data fetching
- [ ] Code splitting reduces initial bundle by 40%
- [ ] Lazy loading for all heavy components
- [ ] Core Web Vitals: LCP < 2.5s, FID < 100ms, CLS < 0.1
- [ ] Bundle size < 200KB gzipped for initial load
- [ ] Image optimization with Next.js Image component
- [ ] Virtual scrolling for lists > 100 items
- [ ] Performance monitoring dashboard
- [ ] 90+ Lighthouse performance score
- [ ] <3s initial page load on 3G

## Implementation Steps

1. **Hour 1**: React Query setup and queries
2. **Hour 2**: Code splitting and lazy loading
3. **Hour 3**: Bundle optimization configuration
4. **Hour 4**: Performance monitoring
5. **Hour 5**: Testing and optimization

## Testing

```typescript
describe('Performance', () => {
  it('should meet Core Web Vitals', async () => {
    const metrics = await measureWebVitals('/dashboard');

    expect(metrics.lcp).toBeLessThan(2500);
    expect(metrics.fid).toBeLessThan(100);
    expect(metrics.cls).toBeLessThan(0.1);
  });

  it('should lazy load heavy components', () => {
    const { container } = render(<TaxonomyVisualization />);

    // Should show loading state initially
    expect(container.querySelector('.skeleton')).toBeInTheDocument();
  });

  it('should cache API responses', async () => {
    const fetch1 = await fetchProjectNodes('test-id');
    const fetch2 = await fetchProjectNodes('test-id');

    // Second fetch should be from cache
    expect(fetch2.fromCache).toBe(true);
  });
});
```

## Notes

- Monitor bundle size regularly with bundle analyzer
- Consider Service Worker for offline support
- Implement progressive enhancement
- Add performance budgets to CI/CD pipeline
