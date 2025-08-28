import { Node } from '@/components/taxonomy/D3Visualization/ForceSimulation';

export interface NodeRenderOptions {
  ctx: CanvasRenderingContext2D;
  node: Node;
  transform: { k: number };
  isSelected: boolean;
  isHovered: boolean;
  performanceMode: boolean;
  theme: 'dark' | 'light';
}

export class NodeRenderer {
  private static readonly cache = new Map<string, ImageData>();
  
  static render(options: NodeRenderOptions) {
    const { ctx, node, transform, isSelected, isHovered, performanceMode, theme } = options;
    
    if (!node.x || !node.y) return;
    
    // Performance optimization: skip off-screen nodes
    if (this.isOffScreen(node, ctx.canvas, transform)) {
      return;
    }
    
    // Choose render method based on performance mode
    if (performanceMode) {
      this.renderSimple(ctx, node, transform, isSelected, isHovered, theme);
    } else {
      this.renderDetailed(ctx, node, transform, isSelected, isHovered, theme);
    }
  }
  
  private static renderSimple(
    ctx: CanvasRenderingContext2D,
    node: Node,
    transform: { k: number },
    isSelected: boolean,
    isHovered: boolean,
    theme: 'dark' | 'light'
  ) {
    // Simple circle without shadows or gradients
    ctx.beginPath();
    ctx.arc(node.x!, node.y!, node.radius, 0, 2 * Math.PI);
    
    // Fill
    ctx.fillStyle = node.color;
    ctx.fill();
    
    // Stroke only if selected or hovered
    if (isSelected || isHovered) {
      ctx.strokeStyle = isSelected ? '#10a37f' : '#0e906d';
      ctx.lineWidth = 2 / transform.k;
      ctx.stroke();
    }
  }
  
  private static renderDetailed(
    ctx: CanvasRenderingContext2D,
    node: Node,
    transform: { k: number },
    isSelected: boolean,
    isHovered: boolean,
    theme: 'dark' | 'light'
  ) {
    const x = node.x!;
    const y = node.y!;
    
    // Shadow for depth (dark theme only)
    if (theme === 'dark') {
      ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
      ctx.shadowBlur = 5;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 2;
    }
    
    // Gradient fill for more visual depth
    const gradient = ctx.createRadialGradient(
      x - node.radius / 3,
      y - node.radius / 3,
      0,
      x,
      y,
      node.radius
    );
    
    const baseColor = node.color;
    gradient.addColorStop(0, this.lightenColor(baseColor, 20));
    gradient.addColorStop(1, baseColor);
    
    // Draw main circle
    ctx.beginPath();
    ctx.arc(x, y, node.radius, 0, 2 * Math.PI);
    ctx.fillStyle = gradient;
    ctx.fill();
    
    // Reset shadow
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    
    // Stroke
    let strokeColor = theme === 'dark' ? '#2a2a2a' : '#e5e5e5';
    let strokeWidth = 2;
    
    if (isSelected) {
      strokeColor = '#10a37f';
      strokeWidth = 3;
    } else if (isHovered) {
      strokeColor = '#0e906d';
      strokeWidth = 3;
    }
    
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth / transform.k;
    ctx.stroke();
    
    // Status indicator
    if (node.status) {
      this.renderStatusIndicator(ctx, node, transform);
    }
    
    // Inner highlight for important nodes
    if (node.radius > 10) {
      ctx.beginPath();
      ctx.arc(
        x - node.radius / 4,
        y - node.radius / 4,
        node.radius / 4,
        0,
        2 * Math.PI
      );
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.fill();
    }
  }
  
  private static renderStatusIndicator(
    ctx: CanvasRenderingContext2D,
    node: Node,
    transform: { k: number }
  ) {
    if (!node.x || !node.y || !node.status) return;
    
    const indicatorRadius = 3 / transform.k;
    const indicatorOffset = node.radius - indicatorRadius;
    
    const angle = -Math.PI / 4;
    const indicatorX = node.x + indicatorOffset * Math.cos(angle);
    const indicatorY = node.y + indicatorOffset * Math.sin(angle);
    
    const statusColors = {
      optimized: '#10a37f',
      outdated: '#f59e0b',
      missing: '#ef4444',
      noContent: '#666666',
    };
    
    // Outer ring
    ctx.beginPath();
    ctx.arc(indicatorX, indicatorY, indicatorRadius + 1 / transform.k, 0, 2 * Math.PI);
    ctx.fillStyle = '#000000';
    ctx.fill();
    
    // Inner dot
    ctx.beginPath();
    ctx.arc(indicatorX, indicatorY, indicatorRadius, 0, 2 * Math.PI);
    ctx.fillStyle = statusColors[node.status] || '#666666';
    ctx.fill();
  }
  
  private static isOffScreen(
    node: Node,
    canvas: HTMLCanvasElement,
    transform: { k: number; x?: number; y?: number }
  ): boolean {
    if (!node.x || !node.y) return true;
    
    const x = node.x * transform.k + (transform.x || 0);
    const y = node.y * transform.k + (transform.y || 0);
    const radius = node.radius * transform.k;
    
    return (
      x + radius < 0 ||
      x - radius > canvas.width ||
      y + radius < 0 ||
      y - radius > canvas.height
    );
  }
  
  private static lightenColor(color: string, percent: number): string {
    // Convert hex to RGB
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const G = (num >> 8 & 0x00FF) + amt;
    const B = (num & 0x0000FF) + amt;
    
    return '#' + (
      0x1000000 +
      (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
      (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
      (B < 255 ? B < 1 ? 0 : B : 255)
    ).toString(16).slice(1);
  }
}