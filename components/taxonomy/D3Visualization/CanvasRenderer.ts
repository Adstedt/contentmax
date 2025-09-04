import { Node, Link } from './ForceSimulation';
import * as d3 from 'd3';
import { VisualEncoder, EncodingConfig } from '@/lib/visualization/visual-encoder';
import { ThemeManager } from '@/lib/visualization/visual-theme';

export interface RenderConfig {
  backgroundColor: string;
  linkColor: string;
  linkWidth: number;
  nodeStrokeColor: string;
  nodeStrokeWidth: number;
  labelColor: string;
  labelFont: string;
  minZoomForLabels: number;
  selectedNodeColor: string;
  hoveredNodeColor: string;
  theme: 'dark' | 'light';
  useVisualEncoding?: boolean;
  encodingConfig?: Partial<EncodingConfig>;
}

export class CanvasRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private transform: d3.ZoomTransform;
  private hoveredNode: Node | null = null;
  private selectedNodes: Set<string> = new Set();
  private config: RenderConfig;
  private dpi: number;
  private performanceMode: boolean = false;
  private visualEncoder: VisualEncoder | null = null;
  private themeManager: ThemeManager;

  constructor(canvas: HTMLCanvasElement, config?: Partial<RenderConfig>) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.transform = d3.zoomIdentity;
    this.themeManager = ThemeManager.getInstance();

    // Dark theme configuration matching dashboard
    this.config = {
      backgroundColor: '#000000',
      linkColor: '#1a1a1a',
      linkWidth: 1,
      nodeStrokeColor: '#2a2a2a',
      nodeStrokeWidth: 2,
      labelColor: '#999999',
      labelFont: 'Inter, system-ui, -apple-system, sans-serif',
      minZoomForLabels: 0.5,
      selectedNodeColor: '#10a37f',
      hoveredNodeColor: '#0e906d',
      theme: 'dark',
      useVisualEncoding: true,
      ...config,
    };

    // Initialize visual encoder if enabled
    if (this.config.useVisualEncoding) {
      this.visualEncoder = new VisualEncoder(this.config.encodingConfig);
    }

    // Subscribe to theme changes
    this.themeManager.subscribe((theme) => {
      this.updateThemeColors(theme);
    });

    this.setupHighDPI();
    this.clear();
  }

  private setupHighDPI() {
    // Get device pixel ratio
    this.dpi = window.devicePixelRatio || 1;

    // Get the size of the canvas in CSS pixels
    const rect = this.canvas.getBoundingClientRect();

    // Set the internal size to match the high DPI screen
    this.canvas.width = rect.width * this.dpi;
    this.canvas.height = rect.height * this.dpi;

    // Scale the context to ensure correct drawing operations
    this.ctx.scale(this.dpi, this.dpi);

    // Set canvas CSS size
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;
  }

  render(nodes: Node[], links: Link[]) {
    // Update visual encoder scales if enabled
    if (this.visualEncoder) {
      this.visualEncoder.updateScales(nodes, links);
    }

    this.clear();

    this.ctx.save();

    // Apply zoom transform
    this.ctx.translate(this.transform.x, this.transform.y);
    this.ctx.scale(this.transform.k, this.transform.k);

    // Draw in layers for better performance
    this.drawLinks(links);
    this.drawNodes(nodes);

    // Draw labels only if zoomed in enough and not in performance mode
    if (this.transform.k > this.config.minZoomForLabels && !this.performanceMode) {
      this.drawLabels(nodes);
    }

    this.ctx.restore();

    // Draw UI overlay (not affected by transform)
    this.drawOverlay();
  }

  private clear() {
    this.ctx.fillStyle = this.config.backgroundColor;
    this.ctx.fillRect(0, 0, this.canvas.width / this.dpi, this.canvas.height / this.dpi);
  }

  private drawLinks(links: Link[]) {
    if (this.visualEncoder) {
      // Use visual encoder for edge styling
      const theme = this.themeManager.getTheme();
      this.ctx.globalAlpha = theme.edges.opacity;

      links.forEach((link) => {
        const source = link.source as Node;
        const target = link.target as Node;

        if (!source.x || !source.y || !target.x || !target.y) return;

        const edgeWidth = this.visualEncoder.getEdgeWidth(link);
        const edgeColor = this.visualEncoder.getEdgeColor(link);

        this.ctx.strokeStyle = edgeColor;
        this.ctx.lineWidth = edgeWidth / this.transform.k;

        this.ctx.beginPath();
        this.ctx.moveTo(source.x, source.y);
        this.ctx.lineTo(target.x, target.y);
        this.ctx.stroke();
      });

      this.ctx.globalAlpha = 1;
    } else {
      // Fallback to default rendering
      this.ctx.strokeStyle = this.config.linkColor;
      this.ctx.lineWidth = this.config.linkWidth / this.transform.k;
      this.ctx.globalAlpha = 0.6;

      this.ctx.beginPath();

      links.forEach((link) => {
        const source = link.source as Node;
        const target = link.target as Node;

        if (!source.x || !source.y || !target.x || !target.y) return;

        this.ctx.moveTo(source.x, source.y);
        this.ctx.lineTo(target.x, target.y);
      });

      this.ctx.stroke();
      this.ctx.globalAlpha = 1;
    }
  }

  private drawNodes(nodes: Node[]) {
    const currentTime = performance.now();

    nodes.forEach((node) => {
      if (!node.x || !node.y) return;

      // Determine node properties based on visual encoder or defaults
      let fillColor: string;
      let nodeRadius: number;
      let strokeColor = this.config.nodeStrokeColor;
      let strokeWidth = this.config.nodeStrokeWidth;

      if (this.visualEncoder) {
        // Determine state for color encoding
        const state = this.selectedNodes.has(node.id)
          ? 'selected'
          : this.hoveredNode === node
            ? 'hover'
            : 'default';

        // Get encoded values with transitions
        const encodedValues = this.visualEncoder.getInterpolatedValues(node, currentTime);
        fillColor = encodedValues.color;
        nodeRadius = encodedValues.size;

        // Update stroke for selected/hovered states
        if (state === 'selected') {
          const theme = this.themeManager.getTheme();
          const status = node.status || 'unknown';
          strokeColor =
            theme.colors.selected[status as keyof typeof theme.colors.selected] ||
            this.config.selectedNodeColor;
          strokeWidth = 3;
        } else if (state === 'hover') {
          const theme = this.themeManager.getTheme();
          const status = node.status || 'unknown';
          strokeColor =
            theme.colors.hover[status as keyof typeof theme.colors.hover] ||
            this.config.hoveredNodeColor;
          strokeWidth = 3;
        }
      } else {
        // Fallback to default rendering
        fillColor = node.color;
        nodeRadius = node.radius;

        if (this.selectedNodes.has(node.id)) {
          strokeColor = this.config.selectedNodeColor;
          strokeWidth = 3;
        } else if (this.hoveredNode === node) {
          strokeColor = this.config.hoveredNodeColor;
          strokeWidth = 3;
        }
      }

      // Draw node shadow for depth
      if (!this.performanceMode) {
        this.ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
        this.ctx.shadowBlur = 5;
        this.ctx.shadowOffsetX = 0;
        this.ctx.shadowOffsetY = 2;
      }

      // Draw node circle
      this.ctx.beginPath();
      this.ctx.arc(node.x, node.y, nodeRadius, 0, 2 * Math.PI);

      // Fill
      this.ctx.fillStyle = fillColor;
      this.ctx.fill();

      // Reset shadow
      this.ctx.shadowColor = 'transparent';
      this.ctx.shadowBlur = 0;
      this.ctx.shadowOffsetX = 0;
      this.ctx.shadowOffsetY = 0;

      // Stroke
      this.ctx.strokeStyle = strokeColor;
      this.ctx.lineWidth = strokeWidth / this.transform.k;
      this.ctx.stroke();

      // Draw status indicator
      if (node.status && !this.performanceMode) {
        this.drawStatusIndicator(node);
      }
    });
  }

  private drawStatusIndicator(node: Node) {
    if (!node.x || !node.y) return;

    // Get node radius from visual encoder if available
    const nodeRadius = this.visualEncoder ? this.visualEncoder.getNodeSize(node) : node.radius;
    const indicatorRadius = 3 / this.transform.k;
    const indicatorOffset = nodeRadius - indicatorRadius;

    const indicatorX = node.x + indicatorOffset * Math.cos(-Math.PI / 4);
    const indicatorY = node.y + indicatorOffset * Math.sin(-Math.PI / 4);

    // Status colors matching dashboard theme
    const statusColors = {
      optimized: '#10a37f',
      outdated: '#f59e0b',
      missing: '#ef4444',
      noContent: '#666666',
    };

    this.ctx.beginPath();
    this.ctx.arc(indicatorX, indicatorY, indicatorRadius, 0, 2 * Math.PI);
    this.ctx.fillStyle = statusColors[node.status] || '#666666';
    this.ctx.fill();
    this.ctx.strokeStyle = this.config.backgroundColor;
    this.ctx.lineWidth = 1 / this.transform.k;
    this.ctx.stroke();
  }

  private drawLabels(nodes: Node[]) {
    // Calculate adaptive font size based on zoom
    const fontSize = Math.max(10, Math.min(14, 12 * this.transform.k)) / this.transform.k;
    this.ctx.font = `${fontSize}px ${this.config.labelFont}`;
    this.ctx.fillStyle = this.config.labelColor;
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'middle';

    nodes.forEach((node) => {
      if (!node.x || !node.y) return;

      // Get node radius from visual encoder if available
      const nodeRadius = this.visualEncoder ? this.visualEncoder.getNodeSize(node) : node.radius;

      // Only show labels for larger nodes or selected/hovered nodes
      const showLabel =
        nodeRadius > 8 || this.selectedNodes.has(node.id) || this.hoveredNode === node;

      if (!showLabel) return;

      const labelX = node.x + nodeRadius + 5 / this.transform.k;
      const labelY = node.y;

      // Truncate long labels
      const maxLength = 20;
      const label =
        node.title.length > maxLength ? node.title.substring(0, maxLength) + '...' : node.title;

      // Draw text background for better readability
      const metrics = this.ctx.measureText(label);
      const padding = 2 / this.transform.k;

      this.ctx.fillStyle = `${this.config.backgroundColor}cc`;
      this.ctx.fillRect(
        labelX - padding,
        labelY - fontSize / 2 - padding,
        metrics.width + padding * 2,
        fontSize + padding * 2
      );

      // Draw text
      this.ctx.fillStyle = this.config.labelColor;
      this.ctx.fillText(label, labelX, labelY);
    });
  }

  private drawOverlay() {
    // Draw performance metrics if in debug mode
    if (this.performanceMode) {
      this.ctx.fillStyle = '#10a37f';
      this.ctx.font = '12px monospace';
      this.ctx.textAlign = 'left';
      this.ctx.fillText('Performance Mode', 10, 20);
    }

    // Draw zoom level
    const zoomPercent = Math.round(this.transform.k * 100);
    this.ctx.fillStyle = '#666666';
    this.ctx.font = '11px ' + this.config.labelFont;
    this.ctx.textAlign = 'right';
    this.ctx.fillText(`${zoomPercent}%`, this.canvas.width / this.dpi - 10, 20);
  }

  setTransform(transform: d3.ZoomTransform) {
    this.transform = transform;
  }

  setHoveredNode(node: Node | null) {
    this.hoveredNode = node;
  }

  setSelectedNodes(nodes: Set<string>) {
    this.selectedNodes = nodes;
  }

  addSelectedNode(nodeId: string) {
    this.selectedNodes.add(nodeId);
  }

  removeSelectedNode(nodeId: string) {
    this.selectedNodes.delete(nodeId);
  }

  clearSelection() {
    this.selectedNodes.clear();
  }

  setPerformanceMode(enabled: boolean) {
    this.performanceMode = enabled;
  }

  updateConfig(config: Partial<RenderConfig>) {
    this.config = { ...this.config, ...config };
  }

  resize() {
    this.setupHighDPI();
  }

  private updateThemeColors(theme: any) {
    // Update config colors based on theme
    this.config.backgroundColor = theme.background;
    this.config.linkColor = theme.edges.default;
    this.config.nodeStrokeColor = theme.node.strokeColor;
    this.config.labelColor = theme.text.secondary;
  }

  setVisualEncoder(encoder: VisualEncoder | null) {
    this.visualEncoder = encoder;
  }

  destroy() {
    this.clear();
    this.hoveredNode = null;
    this.selectedNodes.clear();
    if (this.visualEncoder) {
      this.visualEncoder.destroy();
    }
  }
}
