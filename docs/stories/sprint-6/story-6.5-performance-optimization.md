# Story 6.5: Performance Optimization

## User Story

As a user,
I want fast and responsive application performance,
So that I can work efficiently without delays or timeouts.

## Size & Priority

- **Size**: M (6 hours)
- **Priority**: P1 - High
- **Sprint**: 6
- **Dependencies**: All core features complete

## Description

Optimize application performance through caching strategies, database query optimization, code splitting, lazy loading, CDN integration, and performance monitoring to ensure sub-second response times.

## Implementation Steps

1. **Caching strategy implementation**

   ```typescript
   // lib/cache/cache-manager.ts
   import Redis from 'ioredis';
   import { LRUCache } from 'lru-cache';

   interface CacheConfig {
     ttl: number;
     maxSize?: number;
     staleWhileRevalidate?: boolean;
   }

   class CacheManager {
     private redis: Redis;
     private memoryCache: LRUCache<string, any>;
     private cacheConfigs: Map<string, CacheConfig>;

     constructor() {
       this.redis = new Redis(process.env.REDIS_URL!);
       this.memoryCache = new LRUCache({
         max: 500,
         ttl: 1000 * 60 * 5, // 5 minutes default
         updateAgeOnGet: true,
       });

       this.setupCacheConfigs();
     }

     private setupCacheConfigs() {
       this.cacheConfigs = new Map([
         ['user-session', { ttl: 3600, staleWhileRevalidate: true }],
         ['content-generation', { ttl: 86400 }], // 24 hours
         ['taxonomy-data', { ttl: 7200 }], // 2 hours
         ['api-response', { ttl: 300 }], // 5 minutes
         ['search-results', { ttl: 600 }], // 10 minutes
         ['analytics-data', { ttl: 1800 }], // 30 minutes
       ]);
     }

     async get<T>(key: string, options?: { skipMemory?: boolean }): Promise<T | null> {
       // Check memory cache first
       if (!options?.skipMemory) {
         const memoryResult = this.memoryCache.get(key);
         if (memoryResult !== undefined) {
           return memoryResult;
         }
       }

       // Check Redis
       const redisResult = await this.redis.get(key);
       if (redisResult) {
         const parsed = JSON.parse(redisResult);

         // Store in memory cache for faster subsequent access
         this.memoryCache.set(key, parsed);

         return parsed;
       }

       return null;
     }

     async set(
       key: string,
       value: any,
       options?: { ttl?: number; cacheType?: string }
     ): Promise<void> {
       const config = options?.cacheType
         ? this.cacheConfigs.get(options.cacheType)
         : { ttl: options?.ttl || 300 };

       const serialized = JSON.stringify(value);

       // Set in Redis with TTL
       await this.redis.setex(key, config.ttl, serialized);

       // Set in memory cache
       this.memoryCache.set(key, value);
     }

     async invalidate(pattern: string): Promise<number> {
       // Clear from memory cache
       const memoryKeys = Array.from(this.memoryCache.keys());
       let cleared = 0;

       for (const key of memoryKeys) {
         if (key.includes(pattern)) {
           this.memoryCache.delete(key);
           cleared++;
         }
       }

       // Clear from Redis
       const redisKeys = await this.redis.keys(pattern);
       if (redisKeys.length > 0) {
         await this.redis.del(...redisKeys);
         cleared += redisKeys.length;
       }

       return cleared;
     }

     // Implement cache-aside pattern
     async cacheable<T>(
       key: string,
       fetcher: () => Promise<T>,
       options?: CacheOptions
     ): Promise<T> {
       // Try to get from cache
       const cached = await this.get<T>(key);
       if (cached !== null) {
         // If stale-while-revalidate, update in background
         if (options?.staleWhileRevalidate) {
           this.revalidateInBackground(key, fetcher, options);
         }
         return cached;
       }

       // Fetch fresh data
       const fresh = await fetcher();

       // Store in cache
       await this.set(key, fresh, options);

       return fresh;
     }

     private async revalidateInBackground(
       key: string,
       fetcher: () => Promise<any>,
       options?: CacheOptions
     ) {
       // Don't await - let it run in background
       fetcher()
         .then((fresh) => {
           this.set(key, fresh, options);
         })
         .catch((error) => {
           console.error(`Background revalidation failed for ${key}:`, error);
         });
     }
   }

   // Edge caching with Cloudflare
   class EdgeCache {
     async cacheResponse(request: Request, response: Response): Promise<Response> {
       const cacheKey = this.getCacheKey(request);
       const cache = caches.default;

       // Clone response for caching
       const responseToCache = response.clone();

       // Add cache headers
       const headers = new Headers(responseToCache.headers);
       headers.set(
         'Cache-Control',
         'public, max-age=300, s-maxage=600, stale-while-revalidate=86400'
       );
       headers.set('CDN-Cache-Control', 'max-age=3600');

       const cachedResponse = new Response(responseToCache.body, {
         status: responseToCache.status,
         statusText: responseToCache.statusText,
         headers,
       });

       // Store in edge cache
       await cache.put(cacheKey, cachedResponse);

       return response;
     }

     async getCachedResponse(request: Request): Promise<Response | null> {
       const cacheKey = this.getCacheKey(request);
       const cache = caches.default;

       const cached = await cache.match(cacheKey);

       if (cached) {
         // Check if stale
         const age = this.getResponseAge(cached);
         const maxAge = this.getMaxAge(cached);

         if (age < maxAge) {
           return cached;
         }

         // Return stale while revalidating
         this.revalidate(request);
         return cached;
       }

       return null;
     }

     private getCacheKey(request: Request): string {
       const url = new URL(request.url);

       // Include important query parameters
       const importantParams = ['page', 'limit', 'sort', 'filter'];
       const params = new URLSearchParams();

       importantParams.forEach((param) => {
         const value = url.searchParams.get(param);
         if (value) params.set(param, value);
       });

       return `${url.origin}${url.pathname}?${params.toString()}`;
     }
   }
   ```

2. **Database query optimization**

   ```typescript
   // lib/performance/query-optimizer.ts
   import { SupabaseClient } from '@supabase/supabase-js';

   class QueryOptimizer {
     private supabase: SupabaseClient;
     private queryCache = new Map<string, any>();

     constructor(supabase: SupabaseClient) {
       this.supabase = supabase;
     }

     // Batch queries to reduce round trips
     async batchQuery<T>(queries: QueryDefinition[]): Promise<T[]> {
       const results = await Promise.all(queries.map((query) => this.executeQuery(query)));
       return results;
     }

     // Use database views for complex queries
     async getOptimizedContentList(filters: ContentFilters) {
       // Use materialized view instead of complex joins
       const { data } = await this.supabase
         .from('content_list_view')
         .select('*')
         .match(filters)
         .order('created_at', { ascending: false })
         .limit(50);

       return data;
     }

     // Implement cursor-based pagination
     async paginateWithCursor<T>(
       table: string,
       cursor?: string,
       limit = 20
     ): Promise<PaginatedResult<T>> {
       let query = this.supabase
         .from(table)
         .select('*')
         .order('id', { ascending: true })
         .limit(limit + 1); // Fetch one extra to determine if there's more

       if (cursor) {
         query = query.gt('id', cursor);
       }

       const { data } = await query;

       const hasMore = data && data.length > limit;
       const items = hasMore ? data.slice(0, -1) : data || [];
       const nextCursor = hasMore ? items[items.length - 1].id : null;

       return {
         items,
         nextCursor,
         hasMore,
       };
     }

     // Optimize N+1 queries with DataLoader pattern
     createDataLoader<T>(batchFn: (ids: string[]) => Promise<T[]>): DataLoader<string, T> {
       const loader = new Map<string, Promise<T>>();
       const batch: string[] = [];
       let batchPromise: Promise<void> | null = null;

       return {
         load: async (id: string): Promise<T> => {
           if (!loader.has(id)) {
             batch.push(id);

             if (!batchPromise) {
               batchPromise = Promise.resolve().then(async () => {
                 const ids = [...batch];
                 batch.length = 0;
                 batchPromise = null;

                 const results = await batchFn(ids);
                 const resultMap = new Map(results.map((r: any) => [r.id, r]));

                 ids.forEach((id) => {
                   const result = resultMap.get(id);
                   if (result) {
                     loader.set(id, Promise.resolve(result));
                   }
                 });
               });
             }

             await batchPromise;
           }

           return loader.get(id)!;
         },
       };
     }

     // Query result caching with invalidation
     async cachedQuery<T>(
       queryKey: string,
       queryFn: () => Promise<T>,
       ttl = 300000 // 5 minutes
     ): Promise<T> {
       const cached = this.queryCache.get(queryKey);

       if (cached && Date.now() - cached.timestamp < ttl) {
         return cached.data;
       }

       const result = await queryFn();

       this.queryCache.set(queryKey, {
         data: result,
         timestamp: Date.now(),
       });

       return result;
     }

     // Optimize aggregate queries
     async getAggregatedStats(timeRange: TimeRange): Promise<Stats> {
       // Use pre-calculated aggregates table
       const { data } = await this.supabase
         .from('hourly_stats')
         .select('*')
         .gte('hour', timeRange.start)
         .lte('hour', timeRange.end);

       // Aggregate the hourly data
       return this.aggregateHourlyStats(data);
     }
   }

   // Database indexing strategy
   class DatabaseIndexManager {
     async createOptimalIndexes() {
       const indexes = [
         // Composite index for common query patterns
         `CREATE INDEX idx_content_status_created 
          ON content(status, created_at DESC) 
          WHERE deleted_at IS NULL`,

         // Partial index for active users
         `CREATE INDEX idx_users_active 
          ON users(last_active_at DESC) 
          WHERE is_active = true`,

         // GIN index for full-text search
         `CREATE INDEX idx_content_search 
          ON content USING gin(to_tsvector('english', title || ' ' || description))`,

         // BRIN index for time-series data
         `CREATE INDEX idx_analytics_time 
          ON analytics USING brin(timestamp)`,

         // Hash index for exact matches
         `CREATE INDEX idx_api_keys_hash 
          ON api_keys USING hash(key)`,
       ];

       for (const index of indexes) {
         await this.supabase.rpc('execute_sql', { sql: index });
       }
     }
   }
   ```

3. **Frontend performance optimization**

   ```typescript
   // lib/performance/frontend-optimizer.ts

   // Dynamic imports and code splitting
   const loadHeavyComponent = () => {
     return import(
       /* webpackChunkName: "heavy-component" */
       /* webpackPrefetch: true */
       '../components/HeavyComponent'
     );
   };

   // Image optimization
   class ImageOptimizer {
     optimizeImage(src: string, options: ImageOptions): string {
       const params = new URLSearchParams({
         w: options.width?.toString() || '',
         h: options.height?.toString() || '',
         q: options.quality?.toString() || '75',
         fm: options.format || 'webp',
         fit: options.fit || 'cover',
       });

       return `${process.env.NEXT_PUBLIC_IMAGE_CDN}/${src}?${params}`;
     }

     generateSrcSet(src: string, sizes: number[]): string {
       return sizes
         .map((size) => `${this.optimizeImage(src, { width: size })} ${size}w`)
         .join(', ');
     }

     lazyLoadImage(element: HTMLImageElement) {
       const observer = new IntersectionObserver(
         (entries) => {
           entries.forEach((entry) => {
             if (entry.isIntersecting) {
               const img = entry.target as HTMLImageElement;
               img.src = img.dataset.src!;
               img.srcset = img.dataset.srcset || '';
               observer.unobserve(img);
             }
           });
         },
         {
           rootMargin: '50px',
         }
       );

       observer.observe(element);
     }
   }

   // Virtual scrolling for large lists
   class VirtualScroller {
     private container: HTMLElement;
     private itemHeight: number;
     private items: any[];
     private visibleItems: any[] = [];

     constructor(container: HTMLElement, itemHeight: number, items: any[]) {
       this.container = container;
       this.itemHeight = itemHeight;
       this.items = items;

       this.init();
     }

     private init() {
       // Set container height
       const totalHeight = this.items.length * this.itemHeight;
       this.container.style.height = `${totalHeight}px`;

       // Handle scroll
       this.container.addEventListener('scroll', this.handleScroll.bind(this));

       // Initial render
       this.updateVisibleItems();
     }

     private handleScroll() {
       requestAnimationFrame(() => {
         this.updateVisibleItems();
       });
     }

     private updateVisibleItems() {
       const scrollTop = this.container.scrollTop;
       const containerHeight = this.container.clientHeight;

       const startIndex = Math.floor(scrollTop / this.itemHeight);
       const endIndex = Math.ceil((scrollTop + containerHeight) / this.itemHeight);

       // Add buffer for smooth scrolling
       const bufferSize = 5;
       const bufferedStart = Math.max(0, startIndex - bufferSize);
       const bufferedEnd = Math.min(this.items.length, endIndex + bufferSize);

       this.visibleItems = this.items.slice(bufferedStart, bufferedEnd);
       this.renderVisibleItems(bufferedStart);
     }

     private renderVisibleItems(startIndex: number) {
       // Clear and render only visible items
       const fragment = document.createDocumentFragment();

       this.visibleItems.forEach((item, index) => {
         const element = this.renderItem(item);
         element.style.position = 'absolute';
         element.style.top = `${(startIndex + index) * this.itemHeight}px`;
         fragment.appendChild(element);
       });

       this.container.innerHTML = '';
       this.container.appendChild(fragment);
     }

     private renderItem(item: any): HTMLElement {
       // Override in subclass
       const div = document.createElement('div');
       div.textContent = item.toString();
       return div;
     }
   }

   // Web Worker for heavy computations
   class ComputationWorker {
     private worker: Worker;

     constructor() {
       this.worker = new Worker(new URL('./computation.worker.ts', import.meta.url));
     }

     async processLargeDataset(data: any[]): Promise<any> {
       return new Promise((resolve, reject) => {
         this.worker.postMessage({ type: 'process', data });

         this.worker.onmessage = (e) => {
           if (e.data.type === 'result') {
             resolve(e.data.result);
           } else if (e.data.type === 'error') {
             reject(new Error(e.data.error));
           }
         };
       });
     }
   }
   ```

4. **Performance monitoring**

   ```typescript
   // lib/performance/performance-monitor.ts
   class PerformanceMonitor {
     private metrics: PerformanceMetrics = {
       fcp: 0,
       lcp: 0,
       fid: 0,
       cls: 0,
       ttfb: 0,
     };

     constructor() {
       this.observeWebVitals();
       this.trackResourceTiming();
       this.trackLongTasks();
     }

     private observeWebVitals() {
       // First Contentful Paint
       new PerformanceObserver((list) => {
         for (const entry of list.getEntries()) {
           if (entry.name === 'first-contentful-paint') {
             this.metrics.fcp = entry.startTime;
             this.reportMetric('FCP', entry.startTime);
           }
         }
       }).observe({ entryTypes: ['paint'] });

       // Largest Contentful Paint
       new PerformanceObserver((list) => {
         const entries = list.getEntries();
         const lastEntry = entries[entries.length - 1];
         this.metrics.lcp = lastEntry.renderTime || lastEntry.loadTime;
         this.reportMetric('LCP', this.metrics.lcp);
       }).observe({ entryTypes: ['largest-contentful-paint'] });

       // First Input Delay
       new PerformanceObserver((list) => {
         for (const entry of list.getEntries()) {
           const fid = entry.processingStart - entry.startTime;
           this.metrics.fid = fid;
           this.reportMetric('FID', fid);
         }
       }).observe({ entryTypes: ['first-input'] });

       // Cumulative Layout Shift
       let clsValue = 0;
       let clsEntries: any[] = [];

       new PerformanceObserver((list) => {
         for (const entry of list.getEntries()) {
           if (!entry.hadRecentInput) {
             clsValue += entry.value;
             clsEntries.push(entry);
           }
         }
         this.metrics.cls = clsValue;
         this.reportMetric('CLS', clsValue);
       }).observe({ entryTypes: ['layout-shift'] });
     }

     private trackResourceTiming() {
       new PerformanceObserver((list) => {
         for (const entry of list.getEntries()) {
           const resource = entry as PerformanceResourceTiming;

           if (resource.duration > 1000) {
             console.warn(`Slow resource: ${resource.name} took ${resource.duration}ms`);

             this.reportSlowResource({
               url: resource.name,
               duration: resource.duration,
               type: resource.initiatorType,
               transferSize: resource.transferSize,
             });
           }
         }
       }).observe({ entryTypes: ['resource'] });
     }

     private trackLongTasks() {
       new PerformanceObserver((list) => {
         for (const entry of list.getEntries()) {
           if (entry.duration > 50) {
             console.warn(`Long task detected: ${entry.duration}ms`);

             this.reportLongTask({
               duration: entry.duration,
               startTime: entry.startTime,
               attribution: (entry as any).attribution,
             });
           }
         }
       }).observe({ entryTypes: ['longtask'] });
     }

     private reportMetric(name: string, value: number) {
       // Send to analytics
       if (window.gtag) {
         window.gtag('event', name, {
           value: Math.round(value),
           metric_name: name,
           metric_value: value,
         });
       }

       // Send to monitoring service
       fetch('/api/metrics', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ name, value, timestamp: Date.now() }),
       });
     }

     measureApiCall(endpoint: string): PerformanceTimer {
       const startTime = performance.now();

       return {
         end: () => {
           const duration = performance.now() - startTime;
           this.reportApiTiming(endpoint, duration);
           return duration;
         },
       };
     }
   }
   ```

5. **Bundle optimization**
   ```javascript
   // next.config.js
   module.exports = {
     webpack: (config, { isServer, dev }) => {
       // Production optimizations
       if (!dev) {
         // Tree shaking
         config.optimization.usedExports = true;
         config.optimization.sideEffects = false;

         // Code splitting
         config.optimization.splitChunks = {
           chunks: 'all',
           cacheGroups: {
             default: false,
             vendors: false,
             vendor: {
               name: 'vendor',
               chunks: 'all',
               test: /node_modules/,
               priority: 20,
             },
             common: {
               name: 'common',
               minChunks: 2,
               chunks: 'all',
               priority: 10,
               reuseExistingChunk: true,
               enforce: true,
             },
           },
         };

         // Minimize
         config.optimization.minimize = true;

         // Module concatenation
         config.optimization.concatenateModules = true;
       }

       // Bundle analyzer
       if (process.env.ANALYZE === 'true') {
         const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
         config.plugins.push(
           new BundleAnalyzerPlugin({
             analyzerMode: 'static',
             reportFilename: './analyze.html',
             openAnalyzer: true,
           })
         );
       }

       return config;
     },

     // Image optimization
     images: {
       domains: ['cdn.contentmax.app'],
       deviceSizes: [640, 768, 1024, 1280, 1920],
       imageSizes: [16, 32, 48, 64, 96, 128, 256],
       formats: ['image/webp', 'image/avif'],
     },

     // Compression
     compress: true,

     // Production optimizations
     productionBrowserSourceMaps: false,
     swcMinify: true,
   };
   ```

## Files to Create

- `lib/cache/cache-manager.ts` - Caching implementation
- `lib/cache/edge-cache.ts` - CDN edge caching
- `lib/performance/query-optimizer.ts` - Database optimization
- `lib/performance/frontend-optimizer.ts` - Frontend optimizations
- `lib/performance/performance-monitor.ts` - Performance monitoring
- `workers/computation.worker.ts` - Web worker for computations
- `components/VirtualList.tsx` - Virtual scrolling component
- `hooks/useIntersectionObserver.ts` - Lazy loading hook

## Performance Targets

- Time to First Byte (TTFB): < 200ms
- First Contentful Paint (FCP): < 1s
- Largest Contentful Paint (LCP): < 2.5s
- First Input Delay (FID): < 100ms
- Cumulative Layout Shift (CLS): < 0.1
- API response time (p95): < 500ms
- Database query time (p95): < 100ms

## Optimization Checklist

- [ ] Redis caching implemented
- [ ] Edge caching with CDN
- [ ] Database queries optimized
- [ ] Indexes created
- [ ] Code splitting implemented
- [ ] Lazy loading for images
- [ ] Virtual scrolling for lists
- [ ] Web workers for heavy tasks
- [ ] Bundle size optimized
- [ ] Performance monitoring active

## Testing Requirements

- [ ] Load testing (1000+ concurrent users)
- [ ] Stress testing
- [ ] Performance regression tests
- [ ] Cache invalidation tests
- [ ] Database query performance tests
- [ ] Bundle size monitoring
- [ ] Core Web Vitals monitoring
- [ ] API response time tests

## Definition of Done

- [ ] Code complete and committed
- [ ] Performance targets met
- [ ] Caching strategy implemented
- [ ] Database optimized
- [ ] Frontend optimized
- [ ] Monitoring in place
- [ ] Load testing passed
- [ ] Documentation updated
