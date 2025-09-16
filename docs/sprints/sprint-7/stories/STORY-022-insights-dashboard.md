# STORY-022: Insights Dashboard

**Status:** Ready for Development
**Sprint:** Sprint 7
**Points:** 5
**Priority:** P2
**Dependencies:** All metrics integrations (STORY-010, STORY-011, STORY-012, STORY-021)

## Story

**As an** e-commerce executive
**I want to** see a high-level dashboard of optimization opportunities and performance metrics
**So that** I can quickly understand where to focus efforts and track progress

## Acceptance Criteria

### Must Have
1. Executive summary dashboard page
2. Top 10 opportunities by score
3. Pricing position distribution chart
4. Revenue by category treemap
5. Traffic trend charts
6. Key metrics summary cards
7. Export to PDF/CSV capability

### Should Have
8. Customizable date ranges
9. Saved views/filters
10. Scheduled email reports
11. Comparison to previous period
12. Goal tracking

### Could Have
13. Custom KPI definitions
14. Annotations on charts
15. Predictive analytics

## Tasks / Subtasks

- [ ] Create insights dashboard route (AC: 1)
  - [ ] Create `/app/dashboard/insights/page.tsx`
  - [ ] Set up responsive grid layout
  - [ ] Add navigation and breadcrumbs
  - [ ] Implement loading states

- [ ] Build KPI summary cards component (AC: 6)
  - [ ] Create `/components/insights/KPICards.tsx`
  - [ ] Display total revenue with change indicator
  - [ ] Show organic traffic metrics
  - [ ] Add pricing position summary
  - [ ] Include conversion rate metrics

- [ ] Implement opportunities list (AC: 2)
  - [ ] Create `/components/insights/OpportunitiesList.tsx`
  - [ ] Fetch top 10 opportunities from API
  - [ ] Display score, type, and impact
  - [ ] Add drill-down capability to taxonomy

- [ ] Create pricing distribution chart (AC: 3)
  - [ ] Create `/components/insights/PricingDistributionChart.tsx`
  - [ ] Use Recharts for donut chart
  - [ ] Color code by price position
  - [ ] Add interactive tooltips

- [ ] Build revenue treemap visualization (AC: 4)
  - [ ] Create `/components/insights/RevenueTreemap.tsx`
  - [ ] Implement D3.js treemap or use Recharts
  - [ ] Size by revenue contribution
  - [ ] Add click-through to categories

- [ ] Implement traffic trend charts (AC: 5)
  - [ ] Create `/components/insights/TrafficTrendChart.tsx`
  - [ ] Show 30/60/90 day trends
  - [ ] Include clicks, impressions, CTR
  - [ ] Add comparison to previous period

- [ ] Create data aggregation API (AC: 1, 6)
  - [ ] Create `/app/api/insights/summary/route.ts`
  - [ ] Aggregate KPI metrics
  - [ ] Calculate period comparisons
  - [ ] Cache results for performance

- [ ] Add date range selector (AC: 8)
  - [ ] Create `/components/insights/DateRangeSelector.tsx`
  - [ ] Support preset ranges (7d, 30d, 90d)
  - [ ] Custom date picker option
  - [ ] Update all components on change

- [ ] Implement PDF export (AC: 7)
  - [ ] Create `/lib/export/pdf-exporter.ts`
  - [ ] Use jsPDF or similar library
  - [ ] Convert charts to images
  - [ ] Format data tables

- [ ] Implement CSV export (AC: 7)
  - [ ] Create `/lib/export/csv-exporter.ts`
  - [ ] Export opportunities list
  - [ ] Export raw metrics data
  - [ ] Include all KPI values

- [ ] Add comparison features (AC: 11)
  - [ ] Create `/lib/insights/comparisons.ts`
  - [ ] Calculate period-over-period changes
  - [ ] Show trend arrows and percentages
  - [ ] Highlight significant changes

- [ ] Create conversion funnel visualization
  - [ ] Create `/components/insights/ConversionFunnel.tsx`
  - [ ] Show impressions → clicks → sessions → conversions
  - [ ] Calculate drop-off rates
  - [ ] Identify bottlenecks

- [ ] Add loading states and error handling
  - [ ] Implement skeleton loaders
  - [ ] Add error boundaries
  - [ ] Create retry mechanisms
  - [ ] Show helpful error messages

- [ ] Write comprehensive tests
  - [ ] Unit tests for calculations in `/tests/unit/insights/`
  - [ ] Component tests for charts
  - [ ] Integration tests for data aggregation
  - [ ] E2E test for export functionality

## Dev Notes

### Project Structure Context
Based on `/docs/architecture/source-tree.md`:
```
contentmax/
├── app/
│   ├── api/
│   │   └── insights/
│   │       └── summary/
│   │           └── route.ts        # Aggregation endpoint
│   └── dashboard/
│       └── insights/
│           └── page.tsx            # Main dashboard page
├── components/
│   └── insights/
│       ├── KPICards.tsx           # Metric cards
│       ├── OpportunitiesList.tsx  # Top opportunities
│       ├── PricingDistributionChart.tsx
│       ├── RevenueTreemap.tsx    # Revenue visualization
│       ├── TrafficTrendChart.tsx # Traffic trends
│       ├── ConversionFunnel.tsx  # Funnel chart
│       └── DateRangeSelector.tsx # Date picker
├── lib/
│   ├── export/
│   │   ├── pdf-exporter.ts       # PDF generation
│   │   └── csv-exporter.ts       # CSV export
│   └── insights/
│       ├── calculations.ts       # KPI calculations
│       └── comparisons.ts        # Period comparisons
├── hooks/
│   └── use-insights-data.ts      # Data fetching hook
└── tests/
    ├── unit/
    │   └── insights/              # Calculation tests
    └── e2e/
        └── insights-dashboard.spec.ts
```

### Dashboard Layout

```tsx
// app/dashboard/insights/page.tsx
export default function InsightsDashboard() {
  return (
    <div className="grid grid-cols-12 gap-6 p-6">
      {/* KPI Cards - Full Width */}
      <div className="col-span-12">
        <KPICards />
      </div>

      {/* Top Opportunities - Left Side */}
      <div className="col-span-12 lg:col-span-6">
        <OpportunitiesList limit={10} />
      </div>

      {/* Pricing Distribution - Right Side */}
      <div className="col-span-12 lg:col-span-6">
        <PricingDistributionChart />
      </div>

      {/* Revenue Treemap - Full Width */}
      <div className="col-span-12">
        <RevenueTreemap />
      </div>

      {/* Traffic Trends - Left */}
      <div className="col-span-12 lg:col-span-6">
        <TrafficTrendChart />
      </div>

      {/* Conversion Funnel - Right */}
      <div className="col-span-12 lg:col-span-6">
        <ConversionFunnel />
      </div>
    </div>
  );
}
```

### Key Metrics Components

1. **KPI Summary Cards**
```typescript
interface KPIMetrics {
  totalRevenue: number;
  revenueChange: number;
  totalTraffic: number;
  trafficChange: number;
  avgPricePosition: number;
  priceOpportunities: number;
  conversionRate: number;
  conversionChange: number;
}

export function KPICards({ metrics }: { metrics: KPIMetrics }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <MetricCard
        title="Total Revenue"
        value={formatCurrency(metrics.totalRevenue)}
        change={metrics.revenueChange}
        icon={DollarSign}
      />
      <MetricCard
        title="Organic Traffic"
        value={formatNumber(metrics.totalTraffic)}
        change={metrics.trafficChange}
        icon={TrendingUp}
      />
      <MetricCard
        title="Price Position"
        value={metrics.avgPricePosition}
        subtitle={`${metrics.priceOpportunities} opportunities`}
        icon={Target}
      />
      <MetricCard
        title="Conversion Rate"
        value={formatPercent(metrics.conversionRate)}
        change={metrics.conversionChange}
        icon={ShoppingCart}
      />
    </div>
  );
}
```

2. **Top Opportunities List**
```typescript
export function OpportunitiesList({ limit = 10 }) {
  const opportunities = useTopOpportunities(limit);

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Top Optimization Opportunities</CardTitle>
        <CardDescription>
          Categories with highest impact potential
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {opportunities.map((opp, index) => (
            <OpportunityRow
              key={opp.id}
              rank={index + 1}
              category={opp.title}
              score={opp.score}
              type={opp.opportunityType}
              projectedImpact={opp.projectedImpact}
              factors={opp.factors}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
```

3. **Pricing Distribution Chart**
```typescript
export function PricingDistributionChart() {
  const data = usePricingDistribution();

  // Donut chart showing distribution
  const chartData = [
    { name: 'Below Market', value: data.belowMarket, color: '#22c55e' },
    { name: 'At Market', value: data.atMarket, color: '#eab308' },
    { name: 'Above Market', value: data.aboveMarket, color: '#ef4444' },
    { name: 'No Data', value: data.noData, color: '#6b7280' }
  ];

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Pricing Position Distribution</CardTitle>
        <CardDescription>
          How your products compare to market prices
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={2}
              dataKey="value"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
        <div className="mt-4 text-sm text-muted-foreground">
          <p>{data.belowMarket} products may have margin opportunity</p>
          <p>{data.aboveMarket} products may be overpriced</p>
        </div>
      </CardContent>
    </Card>
  );
}
```

4. **Revenue Treemap**
```typescript
export function RevenueTreemap() {
  const data = useRevenueByCategory();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Revenue by Category</CardTitle>
        <CardDescription>
          Visual breakdown of revenue contribution
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <Treemap
            data={data}
            dataKey="revenue"
            aspectRatio={4/3}
            stroke="#1a1a1a"
            fill="#10a37f"
          >
            <Tooltip
              content={({ payload }) => (
                <div className="bg-[#0a0a0a] p-2 rounded">
                  <p>{payload[0]?.name}</p>
                  <p className="font-bold">
                    {formatCurrency(payload[0]?.value)}
                  </p>
                  <p className="text-sm text-muted">
                    {payload[0]?.payload.percentage}% of total
                  </p>
                </div>
              )}
            />
          </Treemap>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
```

### Data Aggregation API

```typescript
// app/api/insights/summary/route.ts
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const dateRange = searchParams.get('range') || '30d';

  const [
    kpis,
    opportunities,
    pricingDist,
    revenueByCategory,
    trafficTrends
  ] = await Promise.all([
    getKPIMetrics(dateRange),
    getTopOpportunities(10),
    getPricingDistribution(),
    getRevenueByCategory(),
    getTrafficTrends(dateRange)
  ]);

  return NextResponse.json({
    kpis,
    opportunities,
    pricingDist,
    revenueByCategory,
    trafficTrends,
    generatedAt: new Date().toISOString()
  });
}
```

### Export Functionality

```typescript
// lib/export/dashboard-export.ts
export async function exportDashboardPDF(data: DashboardData) {
  const doc = new jsPDF();

  // Title
  doc.setFontSize(20);
  doc.text('ContentMax Insights Report', 20, 20);

  // Date
  doc.setFontSize(10);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 20, 30);

  // KPIs
  doc.setFontSize(14);
  doc.text('Key Performance Indicators', 20, 45);
  // ... add KPI data

  // Charts (convert to images)
  const charts = await generateChartImages(data);
  charts.forEach((chart, index) => {
    doc.addPage();
    doc.addImage(chart, 'PNG', 20, 20, 170, 100);
  });

  doc.save('contentmax-insights.pdf');
}

export async function exportDashboardCSV(data: DashboardData) {
  const csv = Papa.unparse({
    fields: ['Category', 'Score', 'Revenue', 'Traffic', 'Price Position'],
    data: data.opportunities.map(opp => [
      opp.category,
      opp.score,
      opp.revenue,
      opp.traffic,
      opp.pricePosition
    ])
  });

  downloadCSV(csv, 'contentmax-insights.csv');
}
```

### Configuration Requirements
- All metrics integrations must be complete
- Recharts library for standard charts
- D3.js for complex visualizations (treemap)
- jsPDF for PDF export
- Papa Parse for CSV export

### Performance Requirements
- Dashboard initial load < 2 seconds
- Chart interactions < 100ms response
- Export generation < 5 seconds
- Data refresh < 3 seconds

### Error Handling Strategy
- API failures: Show cached data with warning
- Chart errors: Display fallback table view
- Export failures: Retry with notification
- Missing data: Show informative empty states

## Testing

### Testing Standards (from `/docs/architecture/coding-standards.md`)
- Test framework: Vitest for unit tests, Playwright for E2E
- Test coverage: Minimum 80% for new code
- Mock API responses for component tests
- Use real data samples for integration tests

### Test Scenarios
1. **Dashboard Loading Tests**
   - All components load correctly
   - Data fetches successfully
   - Loading states display
   - Error states handle gracefully

2. **Chart Rendering Tests**
   - Charts render with data
   - Tooltips work correctly
   - Interactions responsive
   - Resize handling works

3. **Export Tests**
   - PDF generation successful
   - CSV format correct
   - Large datasets handled
   - File downloads work

4. **Performance Tests**
   - Initial load time < 2s
   - Chart updates smooth
   - Memory usage stable
   - No data leaks

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2025-01-16 | 1.0 | Initial story creation | Sarah (PO) |
| 2025-01-16 | 1.1 | Updated to Ready for Development status | Sarah (PO) |

## Dev Agent Record

**Agent Model Used:** claude-3-5-sonnet-20241022

**Debug Log References:**
- [ ] Dashboard loads quickly (<2s)
- [ ] All charts render correctly
- [ ] Export functions working
- [ ] Data accuracy verified

**Completion Notes:**
-

**File List:**
-

**QA Results**
-