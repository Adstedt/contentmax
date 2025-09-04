import * as d3 from 'd3';
import { ThemeManager, VisualTheme, OptimizationStatus } from './visual-theme';
import { Node, Link } from '@/components/taxonomy/D3Visualization/ForceSimulation';

export interface EncodingConfig {
  // Size encoding
  sizeField: 'skuCount' | 'traffic' | 'revenue';
  sizeScale: 'linear' | 'log' | 'sqrt' | 'pow';
  minSize: number;
  maxSize: number;

  // Color encoding
  colorField: 'status' | 'depth' | 'traffic';

  // Edge encoding
  edgeWidthField: 'traffic' | 'strength' | 'none';
  minEdgeWidth: number;
  maxEdgeWidth: number;

  // Animation
  transitionDuration: number;
  enableTransitions: boolean;
}

export class VisualEncoder {
  private theme: VisualTheme;
  private themeManager: ThemeManager;
  private config: EncodingConfig;
  private sizeScale:
    | d3.ScaleLogarithmic<number, number>
    | d3.ScaleLinear<number, number>
    | d3.ScalePower<number, number>;
  private edgeScale: d3.ScaleLinear<number, number>;
  private colorCache: Map<string, string> = new Map();
  private previousStates: Map<string, { color: string; size: number }> = new Map();
  private animationStartTime: Map<string, number> = new Map();

  constructor(config?: Partial<EncodingConfig>) {
    this.themeManager = ThemeManager.getInstance();
    this.theme = this.themeManager.getTheme();

    this.config = {
      sizeField: 'skuCount',
      sizeScale: 'log',
      minSize: 5,
      maxSize: 30,
      colorField: 'status',
      edgeWidthField: 'traffic',
      minEdgeWidth: 0.5,
      maxEdgeWidth: 5,
      transitionDuration: 300,
      enableTransitions: true,
      ...config,
    };

    // Initialize scales
    this.sizeScale = this.createSizeScale();
    this.edgeScale = this.createEdgeScale();

    // Subscribe to theme changes
    this.themeManager.subscribe((theme) => {
      this.theme = theme;
      this.clearColorCache();
    });
  }

  private createSizeScale():
    | d3.ScaleLogarithmic<number, number>
    | d3.ScaleLinear<number, number>
    | d3.ScalePower<number, number> {
    const { sizeScale, minSize, maxSize } = this.config;

    switch (sizeScale) {
      case 'log':
        return d3
          .scaleLog()
          .domain([1, 10000]) // Domain will be updated with actual data
          .range([minSize, maxSize])
          .clamp(true);

      case 'sqrt':
        return d3.scaleSqrt().domain([0, 10000]).range([minSize, maxSize]).clamp(true);

      case 'pow':
        return d3.scalePow().exponent(0.5).domain([0, 10000]).range([minSize, maxSize]).clamp(true);

      case 'linear':
      default:
        return d3.scaleLinear().domain([0, 10000]).range([minSize, maxSize]).clamp(true);
    }
  }

  private createEdgeScale(): d3.ScaleLinear<number, number> {
    return d3
      .scaleLinear()
      .domain([0, 1000]) // Will be updated with actual data
      .range([this.config.minEdgeWidth, this.config.maxEdgeWidth])
      .clamp(true);
  }

  // Update scale domains based on actual data
  updateScales(nodes: Node[], links: Link[]): void {
    // Update size scale domain
    const sizeValues = nodes.map((n) => this.getSizeValue(n)).filter((v) => v > 0);
    if (sizeValues.length > 0) {
      const minValue = Math.min(...sizeValues);
      const maxValue = Math.max(...sizeValues);

      if (this.config.sizeScale === 'log') {
        // Log scale needs positive values
        this.sizeScale.domain([Math.max(1, minValue), maxValue]);
      } else {
        this.sizeScale.domain([minValue, maxValue]);
      }
    }

    // Update edge scale domain
    if (this.config.edgeWidthField !== 'none') {
      const edgeValues = links.map((l) => this.getEdgeValue(l)).filter((v) => v > 0);
      if (edgeValues.length > 0) {
        this.edgeScale.domain([Math.min(...edgeValues), Math.max(...edgeValues)]);
      }
    }
  }

  private getSizeValue(node: Node): number {
    switch (this.config.sizeField) {
      case 'skuCount':
        return node.skuCount || 1;
      case 'traffic':
        return node.traffic || 1;
      case 'revenue':
        return node.revenue || 1;
      default:
        return 1;
    }
  }

  private getEdgeValue(link: Link): number {
    if (this.config.edgeWidthField === 'none') {
      return 1;
    }

    // Access traffic data from link or connected nodes
    if (this.config.edgeWidthField === 'traffic') {
      // If link has traffic data
      if ('traffic' in link) {
        return (link as any).traffic || 1;
      }

      // Otherwise, use average of connected nodes' traffic
      const source = link.source as Node;
      const target = link.target as Node;
      const sourceTraffic = source.traffic || 0;
      const targetTraffic = target.traffic || 0;
      return (sourceTraffic + targetTraffic) / 2 || 1;
    }

    return link.strength || 1;
  }

  // Get node color based on status and state
  getNodeColor(node: Node, state: 'default' | 'hover' | 'selected' = 'default'): string {
    const cacheKey = `${node.id}-${state}-${this.theme.mode}`;

    if (this.colorCache.has(cacheKey)) {
      return this.colorCache.get(cacheKey)!;
    }

    let color: string;

    if (this.config.colorField === 'status') {
      const status = (node.status as OptimizationStatus) || 'unknown';
      color = this.themeManager.getStatusColor(status, state);
    } else if (this.config.colorField === 'depth') {
      // Use depth-based coloring
      const depth = node.depth || 0;
      const depthScale = d3.scaleSequential(d3.interpolateViridis).domain([0, 10]);
      color = depthScale(depth);
    } else if (this.config.colorField === 'traffic') {
      // Use traffic-based coloring
      const traffic = node.traffic || 0;
      const trafficScale = d3.scaleSequential(d3.interpolateOranges).domain([0, 1000]);
      color = trafficScale(traffic);
    } else {
      color = this.theme.colors.unknown;
    }

    this.colorCache.set(cacheKey, color);
    return color;
  }

  // Get node size based on configured field
  getNodeSize(node: Node): number {
    const value = this.getSizeValue(node);

    // Handle log scale with zero/negative values
    if (this.config.sizeScale === 'log' && value <= 0) {
      return this.config.minSize;
    }

    return this.sizeScale(value);
  }

  // Get edge width based on configured field
  getEdgeWidth(link: Link): number {
    if (this.config.edgeWidthField === 'none') {
      return 1;
    }

    const value = this.getEdgeValue(link);
    return this.edgeScale(value);
  }

  // Get edge color based on traffic or theme
  getEdgeColor(link: Link): string {
    const value = this.getEdgeValue(link);
    const maxValue = this.edgeScale.domain()[1];

    if (value > maxValue * 0.7) {
      return this.theme.edges.highTraffic;
    } else if (value < maxValue * 0.3) {
      return this.theme.edges.lowTraffic;
    }

    return this.theme.edges.default;
  }

  // Get interpolated values for smooth transitions
  getInterpolatedValues(node: Node, currentTime: number): { color: string; size: number } {
    if (!this.config.enableTransitions) {
      return {
        color: this.getNodeColor(node),
        size: this.getNodeSize(node),
      };
    }

    const nodeId = node.id;
    const targetColor = this.getNodeColor(node);
    const targetSize = this.getNodeSize(node);

    if (!this.previousStates.has(nodeId)) {
      this.previousStates.set(nodeId, { color: targetColor, size: targetSize });
      return { color: targetColor, size: targetSize };
    }

    const startTime = this.animationStartTime.get(nodeId) || currentTime;
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / this.config.transitionDuration, 1);

    const previous = this.previousStates.get(nodeId)!;

    if (progress >= 1) {
      this.previousStates.set(nodeId, { color: targetColor, size: targetSize });
      this.animationStartTime.delete(nodeId);
      return { color: targetColor, size: targetSize };
    }

    // Interpolate size
    const interpolatedSize = previous.size + (targetSize - previous.size) * progress;

    // For color, we'll switch at 50% for simplicity (color interpolation is complex)
    const interpolatedColor = progress < 0.5 ? previous.color : targetColor;

    return {
      color: interpolatedColor,
      size: interpolatedSize,
    };
  }

  // Start transition for a node
  startTransition(nodeId: string, currentTime: number): void {
    if (this.config.enableTransitions) {
      this.animationStartTime.set(nodeId, currentTime);
    }
  }

  // Clear color cache (e.g., on theme change)
  clearColorCache(): void {
    this.colorCache.clear();
  }

  // Update configuration
  updateConfig(config: Partial<EncodingConfig>): void {
    this.config = { ...this.config, ...config };

    // Recreate scales if needed
    if (config.sizeScale || config.minSize || config.maxSize) {
      this.sizeScale = this.createSizeScale();
    }

    if (config.minEdgeWidth || config.maxEdgeWidth) {
      this.edgeScale = this.createEdgeScale();
    }

    // Clear cache if color field changed
    if (config.colorField) {
      this.clearColorCache();
    }
  }

  // Get legend data for current encoding
  getLegendData(): {
    colors: Array<{ label: string; color: string }>;
    sizes: Array<{ label: string; size: number }>;
  } {
    const colors: Array<{ label: string; color: string }> = [];
    const sizes: Array<{ label: string; size: number }> = [];

    // Color legend based on status
    if (this.config.colorField === 'status') {
      colors.push(
        { label: 'Optimized', color: this.theme.colors.optimized },
        { label: 'Outdated', color: this.theme.colors.outdated },
        { label: 'Missing', color: this.theme.colors.missing },
        { label: 'No Content', color: this.theme.colors.noContent }
      );
    }

    // Size legend
    const sizeDomain = this.sizeScale.domain();
    const sizeFieldLabel =
      this.config.sizeField === 'skuCount'
        ? 'Products'
        : this.config.sizeField === 'traffic'
          ? 'Traffic'
          : 'Revenue';

    sizes.push(
      { label: `${Math.round(sizeDomain[0])} ${sizeFieldLabel}`, size: this.config.minSize },
      {
        label: `${Math.round((sizeDomain[0] + sizeDomain[1]) / 2)} ${sizeFieldLabel}`,
        size: (this.config.minSize + this.config.maxSize) / 2,
      },
      { label: `${Math.round(sizeDomain[1])} ${sizeFieldLabel}`, size: this.config.maxSize }
    );

    return { colors, sizes };
  }

  // Cleanup
  destroy(): void {
    this.clearColorCache();
    this.previousStates.clear();
    this.animationStartTime.clear();
  }
}
