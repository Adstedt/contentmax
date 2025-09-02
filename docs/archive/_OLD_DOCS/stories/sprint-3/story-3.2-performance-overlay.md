# Story 3.2: Performance Data Overlay

## User Story

As an SEO manager,
I want to see performance metrics directly on the taxonomy visualization,
So that I can instantly identify high-value optimization opportunities.

## Size & Priority

- **Size**: L (8 hours)
- **Priority**: P0 - Critical
- **Sprint**: 3
- **Dependencies**: Story 3.1, Sprint 4 data integration

## Description

Add real-time performance data overlay to the D3 visualization, showing impressions, CTR, position, and revenue potential directly on nodes with intelligent sizing and tooltips.

## Implementation Steps

### 1. Performance Data Integration

```typescript
// lib/visualization/performance-overlay.ts
interface NodePerformanceData {
  nodeId: string;
  url: string;
  impressions: number;
  clicks: number;
  ctr: number;
  position: number;
  revenue?: number;
  conversionRate?: number;
  opportunityScore?: number;
  benchmarkCTR?: number;
  ctrGap?: number;
}

class PerformanceOverlay {
  private performanceData: Map<string, NodePerformanceData> = new Map();
  private maxImpressions: number = 0;
  private maxRevenue: number = 0;

  async loadPerformanceData(projectId: string) {
    const response = await fetch(`/api/performance/categories?projectId=${projectId}`);
    const data = await response.json();

    data.forEach((item) => {
      this.performanceData.set(item.nodeId, item);
      this.maxImpressions = Math.max(this.maxImpressions, item.impressions);
      this.maxRevenue = Math.max(this.maxRevenue, item.revenue || 0);
    });
  }

  // Node sizing based on impressions/revenue
  getNodeRadius(node: Node): number {
    const perf = this.performanceData.get(node.id);
    if (!perf) return 8; // Default size

    // Size based on impressions (logarithmic scale)
    const impressionRatio = Math.log(perf.impressions + 1) / Math.log(this.maxImpressions + 1);
    return 8 + impressionRatio * 24; // 8-32px radius
  }

  // Color intensity based on opportunity
  getNodeOpacity(node: Node): number {
    const perf = this.performanceData.get(node.id);
    if (!perf) return 0.3;

    // Higher opacity for bigger opportunities
    const opportunityRatio = (perf.ctrGap || 0) / 0.1; // Normalize to 10% max gap
    return 0.3 + Math.min(opportunityRatio * 0.7, 0.7); // 0.3-1.0 opacity
  }
}
```

### 2. Enhanced Tooltip System

```typescript
// components/taxonomy/PerformanceTooltip.tsx
interface PerformanceTooltipProps {
  node: Node;
  performance: NodePerformanceData;
  position: { x: number; y: number };
}

export function PerformanceTooltip({ node, performance, position }: PerformanceTooltipProps) {
  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const ctrLift = performance.benchmarkCTR ?
    ((performance.benchmarkCTR - performance.ctr) / performance.ctr * 100).toFixed(0) :
    null;

  return (
    <div
      className="absolute z-50 bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-4 shadow-2xl"
      style={{
        left: position.x + 10,
        top: position.y - 10,
        minWidth: '280px'
      }}
    >
      <div className="text-white font-semibold text-sm mb-3">{node.label}</div>

      <div className="space-y-2 text-xs">
        {/* Performance Metrics */}
        <div className="flex justify-between">
          <span className="text-gray-400">Impressions:</span>
          <span className="text-white font-mono">{formatNumber(performance.impressions)}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-gray-400">CTR:</span>
          <div className="flex items-center gap-2">
            <span className="text-white font-mono">{(performance.ctr * 100).toFixed(2)}%</span>
            {ctrLift && (
              <span className="text-[#10a37f] text-xs">
                +{ctrLift}% potential
              </span>
            )}
          </div>
        </div>

        <div className="flex justify-between">
          <span className="text-gray-400">Position:</span>
          <span className="text-white font-mono">{performance.position.toFixed(1)}</span>
        </div>

        {performance.revenue && (
          <div className="flex justify-between">
            <span className="text-gray-400">Revenue:</span>
            <span className="text-white font-mono">${formatNumber(performance.revenue)}</span>
          </div>
        )}

        {/* Opportunity Score */}
        {performance.opportunityScore && (
          <div className="mt-3 pt-3 border-t border-[#1a1a1a]">
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Opportunity Score:</span>
              <div className="flex items-center gap-2">
                <div className="w-24 h-2 bg-[#1a1a1a] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#10a37f] to-[#0e906d]"
                    style={{ width: `${performance.opportunityScore}%` }}
                  />
                </div>
                <span className="text-[#10a37f] font-mono text-xs">
                  {performance.opportunityScore}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="mt-3 pt-3 border-t border-[#1a1a1a] flex gap-2">
        <button className="text-xs text-[#10a37f] hover:text-[#0e906d]">
          Optimize →
        </button>
        <button className="text-xs text-gray-400 hover:text-white">
          View Details
        </button>
      </div>
    </div>
  );
}
```

### 3. Performance Indicators on Nodes

```typescript
// lib/visualization/node-indicators.ts
class NodeIndicators {
  renderPerformanceIndicators(
    ctx: CanvasRenderingContext2D,
    node: Node,
    performance: NodePerformanceData
  ) {
    // Traffic indicator (top-right)
    if (performance.impressions > 1000) {
      this.renderTrafficBadge(ctx, node, performance.impressions);
    }

    // CTR gap indicator (bottom-right)
    if (performance.ctrGap && performance.ctrGap > 0.01) {
      this.renderOpportunityBadge(ctx, node, performance.ctrGap);
    }

    // Position indicator (top-left)
    if (performance.position <= 3) {
      this.renderPositionBadge(ctx, node, performance.position);
    }

    // Revenue indicator (bottom-left)
    if (performance.revenue && performance.revenue > 1000) {
      this.renderRevenueBadge(ctx, node, performance.revenue);
    }
  }

  private renderTrafficBadge(ctx: CanvasRenderingContext2D, node: Node, impressions: number) {
    const badgeX = node.x! + node.radius * 0.7;
    const badgeY = node.y! - node.radius * 0.7;

    // Badge background
    ctx.beginPath();
    ctx.arc(badgeX, badgeY, 6, 0, 2 * Math.PI);
    ctx.fillStyle = '#1a1a1a';
    ctx.fill();

    // Traffic icon (arrow up)
    ctx.strokeStyle = '#10a37f';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(badgeX, badgeY - 3);
    ctx.lineTo(badgeX, badgeY + 3);
    ctx.moveTo(badgeX - 2, badgeY - 1);
    ctx.lineTo(badgeX, badgeY - 3);
    ctx.lineTo(badgeX + 2, badgeY - 1);
    ctx.stroke();
  }

  private renderOpportunityBadge(ctx: CanvasRenderingContext2D, node: Node, ctrGap: number) {
    const badgeX = node.x! + node.radius * 0.7;
    const badgeY = node.y! + node.radius * 0.7;

    // Pulsing effect for high opportunity
    const pulse = Math.sin(Date.now() * 0.003) * 0.3 + 0.7;

    ctx.beginPath();
    ctx.arc(badgeX, badgeY, 6, 0, 2 * Math.PI);
    ctx.fillStyle = `rgba(16, 163, 127, ${pulse})`;
    ctx.fill();

    // Dollar sign for opportunity
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$', badgeX, badgeY);
  }
}
```

### 4. Real-time Data Updates

```typescript
// hooks/usePerformanceData.ts
export function usePerformanceData(projectId: string) {
  const [performanceData, setPerformanceData] = useState<Map<string, NodePerformanceData>>(
    new Map()
  );
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/performance/categories?projectId=${projectId}`);
        const data = await response.json();

        const perfMap = new Map<string, NodePerformanceData>();
        data.forEach((item) => perfMap.set(item.nodeId, item));

        setPerformanceData(perfMap);
        setLastUpdate(new Date());
      } catch (error) {
        console.error('Failed to fetch performance data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Refresh every 5 minutes
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [projectId]);

  return { performanceData, loading, lastUpdate };
}
```

### 5. Performance Legend

```typescript
// components/taxonomy/PerformanceLegend.tsx
export function PerformanceLegend({ stats }: { stats: PerformanceStats }) {
  return (
    <div className="absolute top-4 right-4 bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-4">
      <h3 className="text-white text-sm font-semibold mb-3">Performance Overview</h3>

      <div className="space-y-3">
        {/* Node Size Legend */}
        <div>
          <div className="text-gray-400 text-xs mb-1">Node Size = Traffic Volume</div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-[#10a37f] rounded-full opacity-30" />
            <span className="text-xs text-gray-500">Low</span>
            <div className="w-6 h-6 bg-[#10a37f] rounded-full opacity-60" />
            <span className="text-xs text-gray-500">Med</span>
            <div className="w-8 h-8 bg-[#10a37f] rounded-full opacity-90" />
            <span className="text-xs text-gray-500">High</span>
          </div>
        </div>

        {/* Color Intensity Legend */}
        <div>
          <div className="text-gray-400 text-xs mb-1">Color Intensity = Opportunity</div>
          <div className="flex items-center gap-2">
            <div className="w-16 h-2 bg-gradient-to-r from-[#10a37f]/30 to-[#10a37f]" />
            <span className="text-xs text-gray-500">CTR Gap</span>
          </div>
        </div>

        {/* Statistics */}
        <div className="pt-3 border-t border-[#1a1a1a] space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-gray-400">Total Impressions:</span>
            <span className="text-white font-mono">{stats.totalImpressions.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-400">Avg CTR:</span>
            <span className="text-white font-mono">{(stats.avgCTR * 100).toFixed(2)}%</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-400">Revenue Potential:</span>
            <span className="text-[#10a37f] font-mono">${stats.revenuePotential.toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
```

## Files to Create/Modify

- `lib/visualization/performance-overlay.ts` - Performance data overlay logic
- `lib/visualization/node-indicators.ts` - Visual indicators on nodes
- `components/taxonomy/PerformanceTooltip.tsx` - Enhanced tooltip with metrics
- `components/taxonomy/PerformanceLegend.tsx` - Performance legend
- `hooks/usePerformanceData.ts` - Real-time data fetching
- `lib/api/performance-client.ts` - API client for performance data
- `types/performance.types.ts` - Performance-related types

## Acceptance Criteria

- [ ] Node size reflects traffic volume (impressions)
- [ ] Node color intensity shows opportunity score
- [ ] Tooltips display key performance metrics
- [ ] Real-time data updates every 5 minutes
- [ ] Performance indicators visible on high-value nodes
- [ ] Legend explains visual encoding
- [ ] CTR gap clearly highlighted
- [ ] Revenue potential displayed
- [ ] Loading states during data fetch
- [ ] Error handling for failed API calls

## Performance Requirements

- Data overlay adds <10ms to render time
- Smooth 60fps with performance data
- Tooltip appears within 100ms
- Data updates don't freeze UI
- Memory efficient for 3000+ nodes

## Testing Requirements

- [ ] Test with various data ranges
- [ ] Test real-time updates
- [ ] Test tooltip accuracy
- [ ] Test performance with max nodes
- [ ] Test error states
- [ ] Test mobile responsiveness
- [ ] Verify calculations are correct

## Definition of Done

- [ ] Code complete and committed
- [ ] Performance data integrated
- [ ] Visual indicators working
- [ ] Tooltips showing metrics
- [ ] Real-time updates functional
- [ ] Legend implemented
- [ ] Tests written and passing
- [ ] Documentation updated
- [ ] Peer review completed
