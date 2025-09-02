# Story 3.4: Opportunity Heat Map Colors

## User Story

As an SEO manager,
I want to see opportunity scores visualized as a heat map,
So that I can instantly identify which categories have the highest revenue potential.

## Size & Priority

- **Size**: M (6 hours)
- **Priority**: P0 - Critical
- **Sprint**: 3
- **Dependencies**: Story 3.1, Sprint 4 opportunity scoring

## Description

Implement a heat map color system that visualizes opportunity scores, making it immediately obvious which categories represent quick wins vs long-term projects.

## Implementation Steps

### 1. Opportunity Color Mapping

```typescript
// lib/visualization/opportunity-heat-map.ts
interface OpportunityConfig {
  // Score thresholds
  thresholds: {
    critical: 80; // Red hot - immediate action
    high: 60; // Orange - high priority
    medium: 40; // Yellow - good opportunity
    low: 20; // Green - optimized/low opportunity
    minimal: 0; // Dark gray - little opportunity
  };

  // Visual encoding
  encoding: {
    useGradient: boolean;
    pulseHighOpportunities: boolean;
    dimLowOpportunities: boolean;
  };
}

class OpportunityHeatMap {
  private readonly colors = {
    critical: '#ef4444', // Red - Immediate action needed
    high: '#f97316', // Orange - High opportunity
    medium: '#eab308', // Yellow - Medium opportunity
    low: '#22c55e', // Green - Well optimized
    minimal: '#1a1a1a', // Dark gray - No opportunity

    // Gradient colors for smooth transitions
    gradient: [
      { stop: 0, color: '#1a1a1a' }, // No opportunity
      { stop: 0.2, color: '#22c55e' }, // Low
      { stop: 0.4, color: '#eab308' }, // Medium
      { stop: 0.6, color: '#f97316' }, // High
      { stop: 0.8, color: '#ef4444' }, // Critical
      { stop: 1, color: '#dc2626' }, // Maximum opportunity
    ],
  };

  getNodeColor(opportunityScore: number): string {
    if (!this.config.encoding.useGradient) {
      // Discrete colors based on thresholds
      if (opportunityScore >= this.config.thresholds.critical) return this.colors.critical;
      if (opportunityScore >= this.config.thresholds.high) return this.colors.high;
      if (opportunityScore >= this.config.thresholds.medium) return this.colors.medium;
      if (opportunityScore >= this.config.thresholds.low) return this.colors.low;
      return this.colors.minimal;
    } else {
      // Smooth gradient based on score
      return this.interpolateColor(opportunityScore / 100);
    }
  }

  private interpolateColor(value: number): string {
    // Find the two stops to interpolate between
    const gradient = this.colors.gradient;
    let lower = gradient[0];
    let upper = gradient[gradient.length - 1];

    for (let i = 0; i < gradient.length - 1; i++) {
      if (value >= gradient[i].stop && value <= gradient[i + 1].stop) {
        lower = gradient[i];
        upper = gradient[i + 1];
        break;
      }
    }

    // Linear interpolation
    const range = upper.stop - lower.stop;
    const position = (value - lower.stop) / range;

    return this.lerpColor(lower.color, upper.color, position);
  }
}
```

### 2. Quick Win Indicators

```typescript
// lib/visualization/quick-win-badges.ts
interface QuickWin {
  nodeId: string;
  score: number;
  effort: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  timeToValue: number; // days
}

class QuickWinIndicator {
  identifyQuickWins(nodes: Node[], performance: Map<string, NodePerformanceData>): QuickWin[] {
    return nodes
      .map((node) => {
        const perf = performance.get(node.id);
        if (!perf) return null;

        // Quick win criteria:
        // 1. High CTR gap (>2%)
        // 2. Good existing traffic (>1000 impressions)
        // 3. Position 4-10 (easier to improve)
        // 4. Low competition
        const ctrGap = perf.benchmarkCTR - perf.ctr;
        const isQuickWin =
          ctrGap > 0.02 && perf.impressions > 1000 && perf.position >= 4 && perf.position <= 10;

        if (!isQuickWin) return null;

        return {
          nodeId: node.id,
          score: this.calculateQuickWinScore(perf),
          effort: this.estimateEffort(perf),
          impact: this.estimateImpact(perf),
          timeToValue: this.estimateTimeToValue(perf),
        };
      })
      .filter(Boolean)
      .sort((a, b) => b!.score - a!.score)
      .slice(0, 10); // Top 10 quick wins
  }

  renderQuickWinBadge(ctx: CanvasRenderingContext2D, node: Node, quickWin: QuickWin) {
    const badgeX = node.x! - node.radius - 10;
    const badgeY = node.y! - node.radius - 10;

    // Lightning bolt icon for quick wins
    ctx.save();

    // Pulsing glow effect
    const pulse = Math.sin(Date.now() * 0.005) * 0.3 + 0.7;
    ctx.shadowColor = '#fbbf24';
    ctx.shadowBlur = 10 * pulse;

    // Badge background
    ctx.beginPath();
    ctx.arc(badgeX, badgeY, 8, 0, 2 * Math.PI);
    ctx.fillStyle = '#fbbf24';
    ctx.fill();

    // Lightning icon
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(badgeX - 2, badgeY - 4);
    ctx.lineTo(badgeX + 1, badgeY);
    ctx.lineTo(badgeX - 1, badgeY);
    ctx.lineTo(badgeX + 2, badgeY + 4);
    ctx.stroke();

    ctx.restore();
  }
}
```

### 3. Heat Map Legend

```typescript
// components/taxonomy/OpportunityLegend.tsx
interface OpportunityLegendProps {
  quickWins: QuickWin[];
  averageScore: number;
  totalOpportunityValue: number;
}

export function OpportunityLegend({
  quickWins,
  averageScore,
  totalOpportunityValue
}: OpportunityLegendProps) {
  return (
    <div className="absolute bottom-4 left-4 bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-4 max-w-xs">
      <h3 className="text-white text-sm font-semibold mb-3">Opportunity Heat Map</h3>

      {/* Color Scale */}
      <div className="mb-4">
        <div className="text-gray-400 text-xs mb-2">Revenue Opportunity</div>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-3 rounded-full bg-gradient-to-r from-[#1a1a1a] via-[#22c55e] via-[#eab308] via-[#f97316] to-[#ef4444]" />
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>Low</span>
          <span>High</span>
        </div>
      </div>

      {/* Quick Wins */}
      {quickWins.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
            <div className="w-4 h-4 bg-[#fbbf24] rounded-full flex items-center justify-center">
              <span className="text-black text-[8px]">⚡</span>
            </div>
            <span>Quick Wins ({quickWins.length})</span>
          </div>
          <div className="text-[#fbbf24] text-sm font-mono">
            +${(quickWins.reduce((sum, qw) => sum + (qw.score * 1000), 0)).toLocaleString()}
          </div>
          <div className="text-xs text-gray-500">potential monthly revenue</div>
        </div>
      )}

      {/* Summary Stats */}
      <div className="space-y-2 pt-3 border-t border-[#1a1a1a]">
        <div className="flex justify-between text-xs">
          <span className="text-gray-400">Avg Opportunity:</span>
          <span className="text-white font-mono">{averageScore.toFixed(0)}/100</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-gray-400">Total Potential:</span>
          <span className="text-[#10a37f] font-mono">
            ${totalOpportunityValue.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Action Hint */}
      <div className="mt-3 pt-3 border-t border-[#1a1a1a]">
        <div className="text-xs text-gray-500">
          Click any node to see optimization options
        </div>
      </div>
    </div>
  );
}
```

### 4. Visual Effects

```typescript
// lib/visualization/opportunity-effects.ts
class OpportunityEffects {
  private animations: Map<string, number> = new Map();

  applyHeatMapEffects(ctx: CanvasRenderingContext2D, node: Node, opportunityScore: number) {
    // High opportunity nodes get special effects
    if (opportunityScore >= 80) {
      this.applyPulsingGlow(ctx, node, opportunityScore);
    } else if (opportunityScore >= 60) {
      this.applySubtleGlow(ctx, node, opportunityScore);
    }

    // Dim low opportunity nodes
    if (opportunityScore < 20 && this.config.encoding.dimLowOpportunities) {
      ctx.globalAlpha = 0.4;
    }
  }

  private applyPulsingGlow(ctx: CanvasRenderingContext2D, node: Node, score: number) {
    const animationKey = `pulse_${node.id}`;
    let phase = this.animations.get(animationKey) || 0;
    phase += 0.05;
    this.animations.set(animationKey, phase);

    const pulse = Math.sin(phase) * 0.3 + 0.7;

    ctx.save();
    ctx.shadowColor = this.heatMap.getNodeColor(score);
    ctx.shadowBlur = 15 + pulse * 10;
    ctx.globalAlpha = 0.9 + pulse * 0.1;
    ctx.restore();
  }

  renderHeatMapOverlay(ctx: CanvasRenderingContext2D, nodes: Node[]) {
    // Create gradient overlay for entire canvas
    const gradient = ctx.createRadialGradient(
      ctx.canvas.width / 2,
      ctx.canvas.height / 2,
      0,
      ctx.canvas.width / 2,
      ctx.canvas.height / 2,
      Math.max(ctx.canvas.width, ctx.canvas.height) / 2
    );

    // Add subtle vignette effect
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(0.7, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.3)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  }
}
```

### 5. Interactive Filters

```typescript
// components/taxonomy/OpportunityFilters.tsx
export function OpportunityFilters({
  onFilterChange
}: {
  onFilterChange: (filters: OpportunityFilters) => void
}) {
  const [filters, setFilters] = useState({
    minScore: 0,
    maxScore: 100,
    showQuickWins: true,
    showLowOpportunity: false,
    effortLevel: 'all' as 'all' | 'low' | 'medium' | 'high'
  });

  return (
    <div className="absolute top-4 left-4 bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-4">
      <h3 className="text-white text-sm font-semibold mb-3">Filter Opportunities</h3>

      {/* Score Range Slider */}
      <div className="mb-4">
        <label className="text-xs text-gray-400 block mb-2">
          Opportunity Score: {filters.minScore} - {filters.maxScore}
        </label>
        <input
          type="range"
          min="0"
          max="100"
          value={filters.minScore}
          onChange={(e) => {
            const newFilters = { ...filters, minScore: Number(e.target.value) };
            setFilters(newFilters);
            onFilterChange(newFilters);
          }}
          className="w-full"
        />
      </div>

      {/* Quick Wins Toggle */}
      <div className="mb-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={filters.showQuickWins}
            onChange={(e) => {
              const newFilters = { ...filters, showQuickWins: e.target.checked };
              setFilters(newFilters);
              onFilterChange(newFilters);
            }}
            className="rounded border-gray-600"
          />
          <span className="text-xs text-gray-400">Show Quick Wins Only</span>
        </label>
      </div>

      {/* Effort Level */}
      <div>
        <label className="text-xs text-gray-400 block mb-2">Effort Level</label>
        <select
          value={filters.effortLevel}
          onChange={(e) => {
            const newFilters = { ...filters, effortLevel: e.target.value as any };
            setFilters(newFilters);
            onFilterChange(newFilters);
          }}
          className="w-full bg-[#1a1a1a] text-white text-xs rounded border border-gray-700 px-2 py-1"
        >
          <option value="all">All</option>
          <option value="low">Low Effort</option>
          <option value="medium">Medium Effort</option>
          <option value="high">High Effort</option>
        </select>
      </div>
    </div>
  );
}
```

## Files to Create/Modify

- `lib/visualization/opportunity-heat-map.ts` - Heat map color logic
- `lib/visualization/quick-win-badges.ts` - Quick win identification
- `lib/visualization/opportunity-effects.ts` - Visual effects
- `components/taxonomy/OpportunityLegend.tsx` - Heat map legend
- `components/taxonomy/OpportunityFilters.tsx` - Filter controls
- `types/opportunity.types.ts` - Opportunity-related types

## Visual Specifications

### Color Palette

```css
/* Opportunity Heat Map Colors */
--opportunity-critical: #ef4444; /* Red - 80-100 score */
--opportunity-high: #f97316; /* Orange - 60-80 score */
--opportunity-medium: #eab308; /* Yellow - 40-60 score */
--opportunity-low: #22c55e; /* Green - 20-40 score */
--opportunity-minimal: #1a1a1a; /* Dark - 0-20 score */

/* Quick Win Indicator */
--quick-win: #fbbf24; /* Gold - Lightning bolt */
--quick-win-glow: rgba(251, 191, 36, 0.5);
```

## Acceptance Criteria

- [ ] Nodes colored by opportunity score
- [ ] Smooth gradient or discrete colors (configurable)
- [ ] Quick wins marked with lightning badges
- [ ] High opportunity nodes pulse/glow
- [ ] Legend shows color scale
- [ ] Filters work correctly
- [ ] Total opportunity value displayed
- [ ] Performance maintained at 60fps

## Performance Requirements

- Heat map calculation: <5ms for 3000 nodes
- Color interpolation: <1ms per node
- Quick win identification: <50ms
- Smooth animations at 60fps
- No memory leaks from animations

## Testing Requirements

- [ ] Test color mapping accuracy
- [ ] Test quick win identification logic
- [ ] Test filter functionality
- [ ] Test performance with max nodes
- [ ] Test animation smoothness
- [ ] Verify opportunity calculations
- [ ] Test colorblind accessibility

## Definition of Done

- [ ] Code complete and committed
- [ ] Heat map colors implemented
- [ ] Quick wins identified and marked
- [ ] Legend and filters functional
- [ ] Visual effects working
- [ ] Performance targets met
- [ ] Tests written and passing
- [ ] Documentation updated
- [ ] Peer review completed
