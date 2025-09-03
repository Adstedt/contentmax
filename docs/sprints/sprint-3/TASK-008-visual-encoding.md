# TASK-008: Visual Encoding Update

## Overview

**Priority**: P1 - High  
**Estimate**: 2 hours  
**Owner**: Frontend Developer  
**Dependencies**: Existing D3 visualization  
**Status**: Not Started

## Problem Statement

The current visualization doesn't follow the PRD's visual encoding specification for node colors and sizes. We need to update the visual representation to clearly indicate optimization status, product count, and traffic flow.

## Technical Requirements

### 1. Visual Theme Configuration

#### File: `lib/visualization/visual-theme.ts`

```typescript
/**
 * Visual encoding configuration for taxonomy visualization
 * Following Phase 1 PRD specifications
 */

export interface VisualTheme {
  colors: NodeColors;
  sizes: NodeSizes;
  edges: EdgeConfig;
  animations: AnimationConfig;
  darkMode: DarkModeConfig;
}

export interface NodeColors {
  optimized: string;
  needsWork: string;
  critical: string;
  noData: string;
  hover: {
    optimized: string;
    needsWork: string;
    critical: string;
    noData: string;
  };
  selected: {
    stroke: string;
    strokeWidth: number;
    glow: string;
  };
}

export interface NodeSizes {
  minRadius: number;
  maxRadius: number;
  scaleType: 'linear' | 'logarithmic' | 'sqrt';
  metricField: string;
  hoverScale: number;
  selectedScale: number;
}

export interface EdgeConfig {
  minWidth: number;
  maxWidth: number;
  opacity: number;
  color: string;
  flowAnimation: boolean;
  metricField: string;
}

// PRD-specified theme
export const DEFAULT_THEME: VisualTheme = {
  colors: {
    optimized: '#10B981', // Green - Tailwind emerald-500
    needsWork: '#F59E0B', // Yellow - Tailwind amber-500
    critical: '#EF4444', // Red - Tailwind red-500
    noData: '#9CA3AF', // Gray - Tailwind gray-400
    hover: {
      optimized: '#34D399', // Lighter green
      needsWork: '#FBBF24', // Lighter yellow
      critical: '#F87171', // Lighter red
      noData: '#D1D5DB', // Lighter gray
    },
    selected: {
      stroke: '#3B82F6', // Blue - Tailwind blue-500
      strokeWidth: 3,
      glow: 'rgba(59, 130, 246, 0.4)',
    },
  },
  sizes: {
    minRadius: 5,
    maxRadius: 30,
    scaleType: 'logarithmic',
    metricField: 'product_count',
    hoverScale: 1.2,
    selectedScale: 1.3,
  },
  edges: {
    minWidth: 0.5,
    maxWidth: 5,
    opacity: 0.3,
    color: '#6B7280', // Tailwind gray-500
    flowAnimation: true,
    metricField: 'traffic_flow',
  },
  animations: {
    duration: 300,
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
    stagger: 20,
  },
  darkMode: {
    background: '#0A0A0A',
    nodeStroke: '#1F2937',
    edgeColor: '#374151',
    textColor: '#F3F4F6',
  },
};

// Alternative high-contrast theme
export const HIGH_CONTRAST_THEME: VisualTheme = {
  ...DEFAULT_THEME,
  colors: {
    ...DEFAULT_THEME.colors,
    optimized: '#00FF00',
    needsWork: '#FFFF00',
    critical: '#FF0000',
    noData: '#808080',
  },
  edges: {
    ...DEFAULT_THEME.edges,
    opacity: 0.6,
    color: '#FFFFFF',
  },
};
```

### 2. Visual Encoder Implementation

#### File: `lib/visualization/visual-encoder.ts`

```typescript
import * as d3 from 'd3';
import { Node, Edge } from '@/types/visualization.types';
import { VisualTheme, DEFAULT_THEME } from './visual-theme';

export class VisualEncoder {
  private theme: VisualTheme;
  private sizeScale: d3.ScaleType;
  private edgeScale: d3.ScaleType;
  private colorCache: Map<string, string> = new Map();

  constructor(theme: VisualTheme = DEFAULT_THEME) {
    this.theme = theme;
    this.initializeScales();
  }

  /**
   * Initialize D3 scales for size and edge width
   */
  private initializeScales(): void {
    const { sizes, edges } = this.theme;

    // Create size scale based on type
    switch (sizes.scaleType) {
      case 'logarithmic':
        this.sizeScale = d3
          .scaleLog()
          .domain([1, 10000])
          .range([sizes.minRadius, sizes.maxRadius])
          .clamp(true);
        break;

      case 'sqrt':
        this.sizeScale = d3
          .scaleSqrt()
          .domain([0, 10000])
          .range([sizes.minRadius, sizes.maxRadius])
          .clamp(true);
        break;

      default: // linear
        this.sizeScale = d3
          .scaleLinear()
          .domain([0, 10000])
          .range([sizes.minRadius, sizes.maxRadius])
          .clamp(true);
    }

    // Edge width scale
    this.edgeScale = d3
      .scaleLinear()
      .domain([0, 1000])
      .range([edges.minWidth, edges.maxWidth])
      .clamp(true);
  }

  /**
   * Get node color based on optimization status
   */
  getNodeColor(node: Node, state: 'normal' | 'hover' | 'selected' = 'normal'): string {
    const cacheKey = `${node.id}_${node.optimization_status}_${state}`;

    if (this.colorCache.has(cacheKey)) {
      return this.colorCache.get(cacheKey)!;
    }

    let color: string;
    const status = node.optimization_status || 'no_data';

    if (state === 'hover') {
      color = this.theme.colors.hover[status] || this.theme.colors.hover.noData;
    } else {
      color = this.theme.colors[status] || this.theme.colors.noData;
    }

    this.colorCache.set(cacheKey, color);
    return color;
  }

  /**
   * Calculate node radius based on metric
   */
  getNodeRadius(node: Node, state: 'normal' | 'hover' | 'selected' = 'normal'): number {
    const metricValue = node[this.theme.sizes.metricField] || 1;
    const baseRadius = this.sizeScale(metricValue);

    switch (state) {
      case 'hover':
        return baseRadius * this.theme.sizes.hoverScale;
      case 'selected':
        return baseRadius * this.theme.sizes.selectedScale;
      default:
        return baseRadius;
    }
  }

  /**
   * Get edge width based on traffic flow
   */
  getEdgeWidth(edge: Edge): number {
    const metricValue = edge[this.theme.edges.metricField] || 0;
    return this.edgeScale(metricValue);
  }

  /**
   * Get edge color with opacity
   */
  getEdgeColor(edge: Edge, highlighted: boolean = false): string {
    const baseColor = this.theme.edges.color;
    const opacity = highlighted ? 0.8 : this.theme.edges.opacity;

    // Convert hex to rgba
    const rgb = this.hexToRgb(baseColor);
    if (!rgb) return baseColor;

    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`;
  }

  /**
   * Apply visual encoding to canvas context
   */
  applyNodeStyle(
    ctx: CanvasRenderingContext2D,
    node: Node,
    state: 'normal' | 'hover' | 'selected' = 'normal'
  ): void {
    const radius = this.getNodeRadius(node, state);
    const color = this.getNodeColor(node, state);

    // Fill node
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(node.x!, node.y!, radius, 0, 2 * Math.PI);
    ctx.fill();

    // Add stroke for selected nodes
    if (state === 'selected') {
      ctx.strokeStyle = this.theme.colors.selected.stroke;
      ctx.lineWidth = this.theme.colors.selected.strokeWidth;
      ctx.stroke();

      // Add glow effect
      this.addGlowEffect(ctx, node.x!, node.y!, radius);
    }

    // Add subtle border for all nodes
    ctx.strokeStyle = this.theme.darkMode.nodeStroke;
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }

  /**
   * Apply edge styling
   */
  applyEdgeStyle(
    ctx: CanvasRenderingContext2D,
    edge: Edge,
    source: Node,
    target: Node,
    highlighted: boolean = false
  ): void {
    const width = this.getEdgeWidth(edge);
    const color = this.getEdgeColor(edge, highlighted);

    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(source.x!, source.y!);
    ctx.lineTo(target.x!, target.y!);
    ctx.stroke();

    // Add flow animation if enabled
    if (this.theme.edges.flowAnimation && highlighted) {
      this.drawFlowAnimation(ctx, source, target, width);
    }
  }

  /**
   * Add glow effect for selected nodes
   */
  private addGlowEffect(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number): void {
    const gradient = ctx.createRadialGradient(x, y, radius, x, y, radius * 2);
    gradient.addColorStop(0, this.theme.colors.selected.glow);
    gradient.addColorStop(1, 'transparent');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius * 2, 0, 2 * Math.PI);
    ctx.fill();
  }

  /**
   * Draw flow animation on edges
   */
  private drawFlowAnimation(
    ctx: CanvasRenderingContext2D,
    source: Node,
    target: Node,
    width: number
  ): void {
    const gradient = ctx.createLinearGradient(source.x!, source.y!, target.x!, target.y!);

    // Animated gradient (would need to be called in animation loop)
    const offset = (Date.now() % 1000) / 1000;
    gradient.addColorStop(Math.max(0, offset - 0.1), 'transparent');
    gradient.addColorStop(offset, this.theme.edges.color);
    gradient.addColorStop(Math.min(1, offset + 0.1), 'transparent');

    ctx.strokeStyle = gradient;
    ctx.lineWidth = width * 1.5;
    ctx.globalAlpha = 0.6;

    ctx.beginPath();
    ctx.moveTo(source.x!, source.y!);
    ctx.lineTo(target.x!, target.y!);
    ctx.stroke();

    ctx.globalAlpha = 1;
  }

  /**
   * Get status badge color for UI elements
   */
  getStatusBadgeStyle(status: string): {
    background: string;
    color: string;
    border: string;
  } {
    const bgColors = {
      optimized: 'bg-green-500',
      needs_work: 'bg-amber-500',
      critical: 'bg-red-500',
      no_data: 'bg-gray-400',
    };

    return {
      background: bgColors[status] || bgColors.no_data,
      color: 'text-white',
      border: 'border-transparent',
    };
  }

  /**
   * Generate legend items
   */
  getLegendItems(): Array<{
    label: string;
    color: string;
    description: string;
  }> {
    return [
      {
        label: 'Optimized',
        color: this.theme.colors.optimized,
        description: 'Score > 80',
      },
      {
        label: 'Needs Work',
        color: this.theme.colors.needsWork,
        description: 'Score 50-80',
      },
      {
        label: 'Critical',
        color: this.theme.colors.critical,
        description: 'Score < 50',
      },
      {
        label: 'No Data',
        color: this.theme.colors.noData,
        description: 'Metrics unavailable',
      },
    ];
  }

  /**
   * Update theme dynamically
   */
  updateTheme(updates: Partial<VisualTheme>): void {
    this.theme = { ...this.theme, ...updates };
    this.initializeScales();
    this.colorCache.clear();
  }

  /**
   * Utility: Convert hex to RGB
   */
  private hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : null;
  }
}
```

### 3. Integration with Canvas Renderer

#### File: `components/taxonomy/D3Visualization/CanvasRenderer.ts` (update)

```typescript
import { VisualEncoder } from '@/lib/visualization/visual-encoder';

export class CanvasRenderer {
  private encoder: VisualEncoder;

  constructor(canvas: HTMLCanvasElement, config?: RenderConfig) {
    // ... existing code ...
    this.encoder = new VisualEncoder(config?.theme);
  }

  renderNodes(nodes: Node[]): void {
    const ctx = this.context;

    // Clear canvas
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Apply dark mode background
    ctx.fillStyle = this.encoder.theme.darkMode.background;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Render edges first (behind nodes)
    this.renderEdges(this.edges);

    // Render nodes
    nodes.forEach((node) => {
      ctx.save();

      // Determine node state
      let state: 'normal' | 'hover' | 'selected' = 'normal';
      if (this.selectedNodes.has(node.id)) {
        state = 'selected';
      } else if (this.hoveredNode?.id === node.id) {
        state = 'hover';
      }

      // Apply visual encoding
      this.encoder.applyNodeStyle(ctx, node, state);

      // Render label if needed
      if (this.shouldRenderLabel(node)) {
        this.renderNodeLabel(ctx, node);
      }

      ctx.restore();
    });
  }

  renderEdges(edges: Edge[]): void {
    const ctx = this.context;

    edges.forEach((edge) => {
      const source = this.getNodeById(edge.source);
      const target = this.getNodeById(edge.target);

      if (!source || !target) return;

      const highlighted =
        this.hoveredNode?.id === source.id ||
        this.hoveredNode?.id === target.id ||
        this.selectedNodes.has(source.id) ||
        this.selectedNodes.has(target.id);

      this.encoder.applyEdgeStyle(ctx, edge, source, target, highlighted);
    });
  }

  renderNodeLabel(ctx: CanvasRenderingContext2D, node: Node): void {
    const radius = this.encoder.getNodeRadius(node);

    ctx.fillStyle = this.encoder.theme.darkMode.textColor;
    ctx.font = '12px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Add text shadow for readability
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 4;

    // Truncate label if too long
    const maxWidth = radius * 4;
    const label = this.truncateLabel(node.title, ctx, maxWidth);

    ctx.fillText(label, node.x!, node.y! + radius + 15);

    // Reset shadow
    ctx.shadowBlur = 0;
  }
}
```

### 4. Legend Component

#### File: `components/taxonomy/Legend.tsx`

```typescript
import React from 'react';
import { VisualEncoder } from '@/lib/visualization/visual-encoder';

export function VisualizationLegend() {
  const encoder = new VisualEncoder();
  const legendItems = encoder.getLegendItems();

  return (
    <div className="absolute bottom-4 left-4 bg-black/80 rounded-lg p-4 space-y-2">
      <h3 className="text-sm font-medium text-gray-300 uppercase tracking-wider mb-3">
        Optimization Status
      </h3>

      {legendItems.map(item => (
        <div key={item.label} className="flex items-center space-x-2">
          <div
            className="w-4 h-4 rounded-full"
            style={{ backgroundColor: item.color }}
          />
          <div className="text-xs">
            <span className="text-gray-200 font-medium">{item.label}</span>
            <span className="text-gray-400 ml-1">({item.description})</span>
          </div>
        </div>
      ))}

      <div className="border-t border-gray-700 pt-2 mt-3">
        <h4 className="text-xs font-medium text-gray-400 mb-1">Node Size</h4>
        <div className="flex items-center space-x-2">
          <div className="flex space-x-1">
            <div className="w-2 h-2 rounded-full bg-gray-500" />
            <div className="w-3 h-3 rounded-full bg-gray-500" />
            <div className="w-4 h-4 rounded-full bg-gray-500" />
          </div>
          <span className="text-xs text-gray-400">Product count</span>
        </div>
      </div>
    </div>
  );
}
```

## Acceptance Criteria

- [ ] Node colors match PRD specification exactly
- [ ] Node sizes scale logarithmically with product count
- [ ] Hover state shows 20% scale increase
- [ ] Selected nodes have blue stroke and glow
- [ ] Edge thickness represents traffic flow
- [ ] Legend displays color meanings
- [ ] Dark theme properly applied
- [ ] Smooth color transitions on state change
- [ ] Performance: <10ms render time per frame
- [ ] Works with existing D3 simulation

## Implementation Steps

1. **Hour 1**: Theme configuration and encoder implementation
2. **Hour 2**: Integration with canvas renderer and testing

## Notes

- Consider color-blind friendly alternatives
- May need to adjust colors for better contrast
- Animation performance crucial for smooth UX
- Consider adding theme switcher in settings
