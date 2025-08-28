import { Node, Link } from './ForceSimulation';
import * as d3 from 'd3';

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

  constructor(canvas: HTMLCanvasElement, config?: Partial<RenderConfig>) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.transform = d3.zoomIdentity;
    
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
      ...config,
    };
    
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
    this.ctx.strokeStyle = this.config.linkColor;
    this.ctx.lineWidth = this.config.linkWidth / this.transform.k;
    this.ctx.globalAlpha = 0.6;
    
    this.ctx.beginPath();
    
    links.forEach(link => {
      const source = link.source as Node;
      const target = link.target as Node;
      
      if (!source.x || !source.y || !target.x || !target.y) return;
      
      this.ctx.moveTo(source.x, source.y);
      this.ctx.lineTo(target.x, target.y);
    });
    
    this.ctx.stroke();
    this.ctx.globalAlpha = 1;
  }

  private drawNodes(nodes: Node[]) {
    nodes.forEach(node => {
      if (!node.x || !node.y) return;
      
      // Determine node color based on state
      let fillColor = node.color;
      let strokeColor = this.config.nodeStrokeColor;
      let strokeWidth = this.config.nodeStrokeWidth;
      
      if (this.selectedNodes.has(node.id)) {
        strokeColor = this.config.selectedNodeColor;
        strokeWidth = 3;
      } else if (this.hoveredNode === node) {
        strokeColor = this.config.hoveredNodeColor;
        strokeWidth = 3;
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
      this.ctx.arc(node.x, node.y, node.radius, 0, 2 * Math.PI);
      
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
    
    const indicatorRadius = 3 / this.transform.k;
    const indicatorOffset = node.radius - indicatorRadius;
    
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
    
    nodes.forEach(node => {
      if (!node.x || !node.y) return;
      
      // Only show labels for larger nodes or selected/hovered nodes
      const showLabel = 
        node.radius > 8 || 
        this.selectedNodes.has(node.id) || 
        this.hoveredNode === node;
      
      if (!showLabel) return;
      
      const labelX = node.x + node.radius + 5 / this.transform.k;
      const labelY = node.y;
      
      // Truncate long labels
      const maxLength = 20;
      const label = node.title.length > maxLength 
        ? node.title.substring(0, maxLength) + '...' 
        : node.title;
      
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

  destroy() {
    this.clear();
    this.hoveredNode = null;
    this.selectedNodes.clear();
  }
}