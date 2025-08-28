import { Link, Node } from '@/components/taxonomy/D3Visualization/ForceSimulation';

export interface LinkRenderOptions {
  ctx: CanvasRenderingContext2D;
  links: Link[];
  transform: { k: number };
  performanceMode: boolean;
  theme: 'dark' | 'light';
  selectedNodes?: Set<string>;
}

export class LinkRenderer {
  private static readonly BATCH_SIZE = 100;
  
  static render(options: LinkRenderOptions) {
    const { ctx, links, transform, performanceMode, theme, selectedNodes } = options;
    
    if (performanceMode) {
      this.renderSimple(ctx, links, transform, theme);
    } else {
      this.renderDetailed(ctx, links, transform, theme, selectedNodes);
    }
  }
  
  private static renderSimple(
    ctx: CanvasRenderingContext2D,
    links: Link[],
    transform: { k: number },
    theme: 'dark' | 'light'
  ) {
    // Batch rendering for performance
    ctx.strokeStyle = theme === 'dark' ? '#1a1a1a' : '#e5e5e5';
    ctx.lineWidth = 1 / transform.k;
    ctx.globalAlpha = 0.4;
    
    ctx.beginPath();
    
    for (let i = 0; i < links.length; i++) {
      const link = links[i];
      const source = link.source as Node;
      const target = link.target as Node;
      
      if (!source.x || !source.y || !target.x || !target.y) continue;
      
      ctx.moveTo(source.x, source.y);
      ctx.lineTo(target.x, target.y);
      
      // Batch stroke every BATCH_SIZE links
      if ((i + 1) % this.BATCH_SIZE === 0) {
        ctx.stroke();
        ctx.beginPath();
      }
    }
    
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  
  private static renderDetailed(
    ctx: CanvasRenderingContext2D,
    links: Link[],
    transform: { k: number },
    theme: 'dark' | 'light',
    selectedNodes?: Set<string>
  ) {
    // Group links by type
    const normalLinks: Link[] = [];
    const highlightedLinks: Link[] = [];
    
    links.forEach(link => {
      const source = link.source as Node;
      const target = link.target as Node;
      
      if (selectedNodes && (selectedNodes.has(source.id) || selectedNodes.has(target.id))) {
        highlightedLinks.push(link);
      } else {
        normalLinks.push(link);
      }
    });
    
    // Draw normal links
    this.drawLinkGroup(ctx, normalLinks, {
      color: theme === 'dark' ? '#1a1a1a' : '#e5e5e5',
      width: 1 / transform.k,
      alpha: 0.4,
      dash: null,
    });
    
    // Draw highlighted links
    if (highlightedLinks.length > 0) {
      this.drawLinkGroup(ctx, highlightedLinks, {
        color: '#10a37f',
        width: 2 / transform.k,
        alpha: 0.8,
        dash: null,
      });
    }
  }
  
  private static drawLinkGroup(
    ctx: CanvasRenderingContext2D,
    links: Link[],
    style: {
      color: string;
      width: number;
      alpha: number;
      dash: number[] | null;
    }
  ) {
    if (links.length === 0) return;
    
    ctx.strokeStyle = style.color;
    ctx.lineWidth = style.width;
    ctx.globalAlpha = style.alpha;
    
    if (style.dash) {
      ctx.setLineDash(style.dash);
    }
    
    // Draw curved links for better visibility
    links.forEach(link => {
      const source = link.source as Node;
      const target = link.target as Node;
      
      if (!source.x || !source.y || !target.x || !target.y) return;
      
      ctx.beginPath();
      
      // Calculate control point for slight curve
      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance > 100) {
        // Add slight curve for long links
        const midX = (source.x + target.x) / 2;
        const midY = (source.y + target.y) / 2;
        const perpX = -dy / distance * 10;
        const perpY = dx / distance * 10;
        
        ctx.moveTo(source.x, source.y);
        ctx.quadraticCurveTo(
          midX + perpX,
          midY + perpY,
          target.x,
          target.y
        );
      } else {
        // Straight line for short links
        ctx.moveTo(source.x, source.y);
        ctx.lineTo(target.x, target.y);
      }
      
      ctx.stroke();
    });
    
    // Reset
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }
  
  static renderArrows(
    ctx: CanvasRenderingContext2D,
    links: Link[],
    transform: { k: number },
    theme: 'dark' | 'light'
  ) {
    const arrowSize = 5 / transform.k;
    ctx.fillStyle = theme === 'dark' ? '#666666' : '#999999';
    
    links.forEach(link => {
      const source = link.source as Node;
      const target = link.target as Node;
      
      if (!source.x || !source.y || !target.x || !target.y) return;
      
      // Calculate arrow position
      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance === 0) return;
      
      const unitX = dx / distance;
      const unitY = dy / distance;
      
      // Position arrow at edge of target node
      const arrowX = target.x - unitX * (target.radius + arrowSize);
      const arrowY = target.y - unitY * (target.radius + arrowSize);
      
      // Draw arrow
      ctx.save();
      ctx.translate(arrowX, arrowY);
      ctx.rotate(Math.atan2(dy, dx));
      
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-arrowSize, -arrowSize / 2);
      ctx.lineTo(-arrowSize, arrowSize / 2);
      ctx.closePath();
      ctx.fill();
      
      ctx.restore();
    });
  }
}