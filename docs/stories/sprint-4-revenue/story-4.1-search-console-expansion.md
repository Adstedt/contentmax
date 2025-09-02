# Story 4.1: Enhance Search Console Integration for URL Metrics

## User Story

As an SEO manager,
I want to see detailed performance metrics for each category page,
So that I can identify which specific pages have the most optimization potential.

## Size & Priority

- **Size**: L (8 hours)
- **Priority**: P0 - Critical
- **Sprint**: 4
- **Dependencies**: Existing GSC integration

## Technical Implementation

### 1. Expand GSC API Integration

```typescript
// lib/integrations/google-search-console-enhanced.ts
interface URLPerformanceQuery {
  startDate: string;
  endDate: string;
  dimensions: ['page'];
  dimensionFilterGroups: [
    {
      filters: [
        {
          dimension: 'page';
          operator: 'contains';
          expression: string; // category URL pattern
        },
      ];
    },
  ];
  rowLimit: number;
  startRow: number;
}

class EnhancedSearchConsoleService {
  async getCategoryPerformance(
    projectId: string,
    categoryUrls: string[]
  ): Promise<CategoryPerformance[]> {
    const results = [];

    // Batch requests to avoid rate limits
    for (const batch of chunk(categoryUrls, 25)) {
      const response = await this.searchConsole.searchanalytics.query({
        siteUrl: this.siteUrl,
        requestBody: {
          startDate: subDays(new Date(), 90).toISOString(),
          endDate: new Date().toISOString(),
          dimensions: ['page'],
          dimensionFilterGroups: [
            {
              filters: batch.map((url) => ({
                dimension: 'page',
                operator: 'equals',
                expression: url,
              })),
            },
          ],
          rowLimit: 1000,
        },
      });

      results.push(...this.processResponse(response));
    }

    return results;
  }

  async getHistoricalTrends(url: string, months: number = 6): Promise<TrendData[]> {
    const trends = [];

    for (let i = 0; i < months; i++) {
      const startDate = subMonths(new Date(), i + 1);
      const endDate = subMonths(new Date(), i);

      const data = await this.getURLMetrics(url, startDate, endDate);
      trends.push({
        month: format(startDate, 'yyyy-MM'),
        ...data,
      });
    }

    return trends;
  }
}
```

### 2. Data Processing Pipeline

```typescript
// lib/services/performance-data-processor.ts
class PerformanceDataProcessor {
  async processAndStore(projectId: string, rawData: GSCResponse[]): Promise<void> {
    const processed = rawData.map((item) => ({
      projectId,
      url: this.normalizeURL(item.keys[0]),
      date: new Date(),
      impressions: item.impressions,
      clicks: item.clicks,
      ctr: item.ctr,
      position: item.position,
      // Calculate additional metrics
      estimatedTrafficValue: this.calculateTrafficValue(item),
      ctrBenchmark: this.getCTRBenchmark(item.position),
      ctrGap: this.getCTRBenchmark(item.position) - item.ctr,
    }));

    // Bulk upsert to database
    await this.bulkUpsertPerformance(processed);

    // Trigger opportunity score recalculation
    await this.triggerScoreRecalculation(projectId);
  }

  private calculateTrafficValue(data: GSCData): number {
    // Estimate value based on clicks and average order value
    const avgOrderValue = 150; // Get from config or calculate
    const conversionRate = 0.02; // Industry average or specific
    return data.clicks * avgOrderValue * conversionRate;
  }

  private getCTRBenchmark(position: number): number {
    // Industry standard CTR by position
    const benchmarks = {
      1: 0.285,
      2: 0.157,
      3: 0.103,
      4: 0.071,
      5: 0.051,
      6: 0.038,
      7: 0.029,
      8: 0.023,
      9: 0.018,
      10: 0.015,
    };

    const rounded = Math.round(position);
    return benchmarks[rounded] || 0.01;
  }
}
```

### 3. Category Aggregation

```typescript
// lib/services/category-aggregator.ts
class CategoryAggregator {
  async aggregateMetrics(projectId: string, categoryId: string): Promise<AggregatedMetrics> {
    // Get all URLs for this category (including children)
    const urls = await this.getCategoryURLs(categoryId);

    // Fetch performance data
    const performance = await this.getPerformanceData(urls);

    return {
      totalImpressions: sum(performance, 'impressions'),
      totalClicks: sum(performance, 'clicks'),
      avgCTR: average(performance, 'ctr'),
      avgPosition: average(performance, 'position'),
      topQueries: await this.getTopQueries(urls),
      trendDirection: this.calculateTrend(performance),
      childPerformance: this.groupByChild(performance),
    };
  }
}
```

### 4. API Endpoints

```typescript
// app/api/performance/categories/route.ts
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');

  if (!projectId) {
    return NextResponse.json({ error: 'Project ID required' }, { status: 400 });
  }

  try {
    const performance = await db
      .from('category_performance')
      .select('*')
      .eq('project_id', projectId)
      .gte('date', subDays(new Date(), 30));

    return NextResponse.json({ data: performance });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch performance' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { projectId, refresh } = await request.json();

  if (refresh) {
    // Trigger fresh data pull from GSC
    await queue.enqueue('fetch-gsc-data', { projectId });
  }

  return NextResponse.json({ status: 'Processing' });
}
```

## Acceptance Criteria

- [ ] URL-level metrics retrieved for all category pages
- [ ] Data includes impressions, CTR, clicks, and position
- [ ] Historical data for 6 months is available
- [ ] Data updates daily automatically
- [ ] Category-level aggregation shows combined metrics
- [ ] API rate limits are respected (max 1200 queries/minute)
- [ ] Data processing completes within 5 minutes for 1000 URLs

## Testing Requirements

- [ ] Unit tests for data processing functions
- [ ] Integration tests for GSC API calls
- [ ] Load test with 1000+ URLs
- [ ] Verify rate limit handling
- [ ] Test data aggregation accuracy
- [ ] Validate historical trend calculations

## UI Components

```typescript
// components/performance/CategoryMetrics.tsx
interface CategoryMetricsProps {
  categoryId: string;
  metrics: CategoryPerformance;
}

export function CategoryMetrics({ categoryId, metrics }: CategoryMetricsProps) {
  return (
    <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-4">
      <div className="grid grid-cols-4 gap-4">
        <MetricCard
          label="Impressions"
          value={metrics.impressions.toLocaleString()}
          change={metrics.impressionChange}
        />
        <MetricCard
          label="CTR"
          value={`${(metrics.ctr * 100).toFixed(2)}%`}
          benchmark={`${(metrics.benchmarkCTR * 100).toFixed(2)}%`}
        />
        <MetricCard
          label="Position"
          value={metrics.position.toFixed(1)}
          change={metrics.positionChange}
        />
        <MetricCard
          label="Est. Value"
          value={`$${metrics.estimatedValue.toLocaleString()}`}
        />
      </div>

      <TrendChart data={metrics.historicalTrend} />
    </div>
  );
}
```

## Dependencies

- Google Search Console API access
- Existing authentication system
- Database schema updates
- Queue system for batch processing
