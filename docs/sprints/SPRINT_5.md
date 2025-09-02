# Sprint 5: Polish & Production

## Weeks 5-6 - MVP Completion & Deployment

### Sprint Goal

Polish the application, optimize performance, implement comprehensive error handling, and deploy the production-ready MVP to Vercel.

### Success Criteria

- [ ] All performance targets met
- [ ] Error handling comprehensive
- [ ] Production deployment successful
- [ ] Documentation complete
- [ ] Onboarding flow implemented

---

## Technical Tasks

### 5.1 UI/UX Polish

**Priority**: P0 - Critical
**Estimate**: 8 hours

```typescript
// components/ui/improvements.tsx

// Loading states
export function NodeLoadingSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-8 bg-gray-200 rounded w-1/4 mb-4" />
      <div className="grid grid-cols-3 gap-4">
        {[...Array(9)].map((_, i) => (
          <div key={i} className="h-24 bg-gray-200 rounded" />
        ))}
      </div>
    </div>
  );
}

// Empty states
export function EmptyOpportunities() {
  return (
    <div className="text-center py-12">
      <Trophy className="mx-auto h-12 w-12 text-gray-400" />
      <h3 className="mt-2 text-sm font-semibold text-gray-900">
        No opportunities found
      </h3>
      <p className="mt-1 text-sm text-gray-500">
        Import your sitemap to start identifying opportunities
      </p>
      <Button className="mt-4" onClick={() => router.push('/import')}>
        Import Sitemap
      </Button>
    </div>
  );
}

// Progress indicators
export function SyncProgress({ progress }: { progress: number }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span>Syncing metrics...</span>
        <span>{Math.round(progress)}%</span>
      </div>
      <Progress value={progress} className="h-2" />
      <p className="text-xs text-gray-500">
        This may take a few minutes for large sites
      </p>
    </div>
  );
}

// Animated transitions
export function OpportunityCard({ opportunity, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delay * 0.1 }}
      className="p-4 border rounded-lg hover:shadow-lg transition-shadow"
    >
      {/* Card content */}
    </motion.div>
  );
}
```

### 5.2 Performance Optimization

**Priority**: P0 - Critical
**Estimate**: 10 hours

```typescript
// lib/performance/optimizations.ts

// 1. React Query for data fetching
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function useNodes() {
  return useQuery({
    queryKey: ['nodes'],
    queryFn: fetchNodes,
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
  });
}

// 2. Virtual scrolling for large lists
import { useVirtual } from '@tanstack/react-virtual';

export function VirtualOpportunityList({ opportunities }) {
  const parentRef = useRef();
  const virtualizer = useVirtual({
    size: opportunities.length,
    parentRef,
    estimateSize: useCallback(() => 100, []),
    overscan: 5,
  });

  return (
    <div ref={parentRef} className="h-[600px] overflow-auto">
      <div style={{ height: virtualizer.totalSize }}>
        {virtualizer.virtualItems.map(virtualRow => (
          <div
            key={virtualRow.index}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: virtualRow.size,
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            <OpportunityCard opportunity={opportunities[virtualRow.index]} />
          </div>
        ))}
      </div>
    </div>
  );
}

// 3. Code splitting
const VisualizationCanvas = dynamic(
  () => import('@/components/visualization/Canvas'),
  {
    loading: () => <CanvasLoadingSkeleton />,
    ssr: false,
  }
);

// 4. Image optimization
export function NodeIcon({ category, size = 24 }) {
  return (
    <Image
      src={`/icons/${category}.svg`}
      alt={category}
      width={size}
      height={size}
      loading="lazy"
      placeholder="blur"
      blurDataURL={shimmerBase64}
    />
  );
}

// 5. Database query optimization
export async function getOptimizedNodes() {
  // Use materialized view for complex queries
  const nodes = await db.query(`
    SELECT * FROM category_nodes_materialized
    WHERE updated_at > NOW() - INTERVAL '1 hour'
  `);

  // Parallel fetch for metrics
  const [gscMetrics, ga4Metrics] = await Promise.all([
    fetchGSCMetrics(nodes.map(n => n.id)),
    fetchGA4Metrics(nodes.map(n => n.id))
  ]);

  // Merge in memory
  return mergeMetrics(nodes, gscMetrics, ga4Metrics);
}
```

### 5.3 Error Handling & Recovery

**Priority**: P0 - Critical
**Estimate**: 6 hours

```typescript
// lib/error-handling/error-boundary.tsx
export class GlobalErrorBoundary extends Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log to Sentry
    Sentry.captureException(error, {
      contexts: { react: errorInfo },
      tags: {
        component: 'GlobalErrorBoundary',
        severity: 'critical'
      }
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorFallback
          error={this.state.error}
          resetError={() => this.setState({ hasError: false })}
        />
      );
    }
    return this.props.children;
  }
}

// API error handling
export async function apiCall<T>(
  fn: () => Promise<T>,
  options: { retries?: number; delay?: number } = {}
): Promise<T> {
  const { retries = 3, delay = 1000 } = options;

  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      const isLast = i === retries - 1;

      // Don't retry on client errors
      if (error.status >= 400 && error.status < 500) {
        throw error;
      }

      if (isLast) {
        throw error;
      }

      // Exponential backoff
      await new Promise(resolve =>
        setTimeout(resolve, delay * Math.pow(2, i))
      );
    }
  }
}

// Graceful degradation
export function useMetricsWithFallback(nodeId: string) {
  const { data, error } = useQuery({
    queryKey: ['metrics', nodeId],
    queryFn: () => fetchMetrics(nodeId),
    retry: 2,
  });

  if (error) {
    // Return cached or estimated data
    return getCachedMetrics(nodeId) || estimateMetrics(nodeId);
  }

  return data;
}
```

### 5.4 Production Deployment

**Priority**: P0 - Critical
**Estimate**: 4 hours

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - run: npm ci
      - run: npm run test
      - run: npm run lint
      - run: npm run type-check

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
```

```typescript
// next.config.js - Production optimizations
module.exports = {
  swcMinify: true,
  compress: true,

  images: {
    domains: ['contentmax.io'],
    formats: ['image/avif', 'image/webp'],
  },

  experimental: {
    optimizeCss: true,
  },

  headers: async () => [
    {
      source: '/:path*',
      headers: [
        {
          key: 'X-Frame-Options',
          value: 'DENY',
        },
        {
          key: 'X-Content-Type-Options',
          value: 'nosniff',
        },
        {
          key: 'Referrer-Policy',
          value: 'strict-origin-when-cross-origin',
        },
      ],
    },
  ],
};
```

### 5.5 Monitoring & Analytics

**Priority**: P1 - High
**Estimate**: 4 hours

```typescript
// lib/monitoring/setup.ts
import * as Sentry from '@sentry/nextjs';
import { PostHog } from 'posthog-node';

// Sentry configuration
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  beforeSend(event) {
    // Filter out non-critical errors
    if (event.level === 'warning') return null;
    return event;
  },
});

// PostHog analytics
export const posthog = new PostHog(process.env.POSTHOG_API_KEY, {
  host: 'https://app.posthog.com',
});

// Custom metrics tracking
export function trackPerformance(metric: string, value: number) {
  // Send to monitoring service
  posthog.capture({
    distinctId: 'system',
    event: 'performance_metric',
    properties: {
      metric,
      value,
      timestamp: Date.now(),
    },
  });

  // Alert if threshold exceeded
  const thresholds = {
    'api.response_time': 1000,
    'visualization.render_time': 2000,
    'import.processing_time': 30000,
  };

  if (thresholds[metric] && value > thresholds[metric]) {
    Sentry.captureMessage(`Performance threshold exceeded: ${metric}`, 'warning');
  }
}
```

### 5.6 Documentation & Onboarding

**Priority**: P1 - High
**Estimate**: 6 hours

```typescript
// components/onboarding/Tour.tsx
import { driver } from 'driver.js';

export function startOnboardingTour() {
  const driverObj = driver({
    showProgress: true,
    steps: [
      {
        element: '#import-button',
        popover: {
          title: 'Welcome to ContentMax!',
          description: 'Start by importing your sitemap to analyze your content taxonomy',
          position: 'bottom',
        },
      },
      {
        element: '#visualization-canvas',
        popover: {
          title: 'Interactive Visualization',
          description: 'Your site structure appears here as an interactive network. Zoom, pan, and click nodes to explore.',
          position: 'center',
        },
      },
      {
        element: '#opportunities-panel',
        popover: {
          title: 'Revenue Opportunities',
          description: 'We identify and rank pages with the highest revenue potential',
          position: 'left',
        },
      },
      {
        element: '#filters-sidebar',
        popover: {
          title: 'Filter & Search',
          description: 'Use filters to focus on specific segments of your taxonomy',
          position: 'right',
        },
      },
    ],
    onDestroyed: () => {
      // Mark onboarding as complete
      localStorage.setItem('onboarding_completed', 'true');
      posthog.capture({
        distinctId: getUserId(),
        event: 'onboarding_completed',
      });
    },
  });

  driverObj.drive();
}

// In-app help system
export function HelpWidget() {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-4 right-4">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="icon" className="rounded-full">
            <HelpCircle className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80">
          <div className="space-y-2">
            <h4 className="font-medium">Need help?</h4>
            <div className="space-y-1">
              <Link href="/docs" className="block p-2 hover:bg-gray-50 rounded">
                📚 Documentation
              </Link>
              <button onClick={startOnboardingTour} className="block w-full text-left p-2 hover:bg-gray-50 rounded">
                🎯 Restart Tour
              </button>
              <Link href="/support" className="block p-2 hover:bg-gray-50 rounded">
                💬 Contact Support
              </Link>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
```

---

## Testing Checklist

### Pre-Production Tests

- [ ] Load test with 5000+ nodes
- [ ] API rate limit testing
- [ ] Browser compatibility (Chrome, Firefox, Safari, Edge)
- [ ] Mobile responsiveness
- [ ] Error recovery scenarios
- [ ] Data import edge cases
- [ ] Security audit

### Performance Benchmarks

| Metric               | Target | Actual |
| -------------------- | ------ | ------ |
| Initial Load         | <2s    | -      |
| Visualization Render | <1s    | -      |
| API Response         | <200ms | -      |
| Import 1000 nodes    | <30s   | -      |
| Memory Usage         | <200MB | -      |
| Lighthouse Score     | >90    | -      |

---

## Production Checklist

### Environment Setup

- [ ] Environment variables configured in Vercel
- [ ] Database migrations applied
- [ ] SSL certificates active
- [ ] CDN configured
- [ ] Domain verified

### Security

- [ ] API keys rotated
- [ ] Rate limiting enabled
- [ ] CORS configured
- [ ] CSP headers set
- [ ] Input validation comprehensive

### Monitoring

- [ ] Sentry error tracking active
- [ ] PostHog analytics configured
- [ ] Uptime monitoring set
- [ ] Performance alerts configured
- [ ] Database backups scheduled

---

## Definition of Done

- [ ] All features working in production
- [ ] Performance targets met
- [ ] No critical bugs
- [ ] Documentation complete
- [ ] Onboarding flow tested
- [ ] Monitoring active
- [ ] Team trained on deployment
- [ ] Customer feedback collected

---

## Launch Plan

### Soft Launch (Week 5)

1. Deploy to production
2. Internal team testing
3. Fix critical issues
4. Performance optimization

### Beta Launch (Week 6)

1. Invite 5-10 beta users
2. Collect feedback
3. Iterate on UX
4. Prepare for public launch

### Success Metrics

- Zero critical errors in 48 hours
- <2% error rate
- 90% of users complete onboarding
- Average session >5 minutes
- NPS score >7

---

## Post-Launch Support

### Week 1 Priorities

- Monitor error logs hourly
- Respond to user feedback
- Fix critical bugs immediately
- Daily standup on metrics

### Documentation Deliverables

- User guide
- API documentation
- Troubleshooting guide
- Video tutorials

---

## Handoff to Phase 2

### Technical Debt

- Refactor opportunity scoring for scale
- Optimize database queries
- Improve test coverage to 90%
- Add E2E test suite

### Feature Backlog

- AI content generation
- A/B testing framework
- Multi-language support
- Advanced filtering
- Export functionality

### Lessons Learned

- Document architecture decisions
- Performance optimization techniques
- Integration challenges
- User feedback themes
