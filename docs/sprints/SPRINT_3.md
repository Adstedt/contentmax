# Sprint 3: Visualization Core

## Week 3 - D3.js Force-Directed Graph

### Sprint Goal

Build the interactive D3.js force-directed graph visualization that can handle 3000+ nodes with smooth performance and intuitive interactions.

### Success Criteria

- [ ] Render 3000+ nodes at 30+ FPS
- [ ] Zoom/pan controls working smoothly
- [ ] Node interactions (hover, click) responsive
- [ ] Visual encoding matches spec
- [ ] Progressive loading implemented

---

## Technical Tasks

### 3.1 D3.js Setup & Canvas

**Priority**: P0 - Blocker
**Estimate**: 4 hours

```typescript
// components/visualization/ForceGraph.tsx
import * as d3 from 'd3';
import { useEffect, useRef } from 'react';

export function ForceGraph({ nodes, links }: GraphData) {
  const svgRef = useRef<SVGSVGElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Initialize D3 force simulation
    const simulation = d3.forceSimulation(nodes)
      .force('charge', d3.forceManyBody().strength(-300))
      .force('link', d3.forceLink(links).distance(100))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(d => d.radius + 5));

    // Set up rendering loop
  }, [nodes, links]);

  return (
    <div className="relative w-full h-full">
      <canvas ref={canvasRef} className="absolute inset-0" />
      <svg ref={svgRef} className="absolute inset-0 pointer-events-none" />
    </div>
  );
}
```

### 3.2 Force Simulation Configuration

**Priority**: P0 - Critical
**Estimate**: 6 hours

```typescript
// lib/visualization/forces.ts
export const forceConfig = {
  simulation: {
    alphaMin: 0.001,
    alphaDecay: 0.02,
    velocityDecay: 0.4,
  },

  forces: {
    charge: {
      strength: (d: Node) => -Math.pow(d.radius, 2.0) * 0.03,
      distanceMin: 20,
      distanceMax: 500,
    },

    link: {
      distance: (l: Link) => 100 + l.source.level * 20,
      strength: (l: Link) => 1 / Math.min(l.source.degree, l.target.degree),
      iterations: 2,
    },

    collision: {
      radius: (d: Node) => d.radius + 5,
      strength: 0.7,
      iterations: 2,
    },

    center: {
      strength: 0.05,
    },
  },
};

export function createSimulation(nodes: Node[], links: Link[]) {
  const sim = d3
    .forceSimulation(nodes)
    .alphaMin(forceConfig.simulation.alphaMin)
    .alphaDecay(forceConfig.simulation.alphaDecay)
    .velocityDecay(forceConfig.simulation.velocityDecay);

  // Apply all forces
  Object.entries(forceConfig.forces).forEach(([name, config]) => {
    // Configure each force based on config
  });

  return sim;
}
```

### 3.3 Node Rendering & Visual Encoding

**Priority**: P0 - Critical
**Estimate**: 6 hours

```typescript
// lib/visualization/renderer.ts
export class CanvasRenderer {
  private context: CanvasRenderingContext2D;
  private transform: d3.ZoomTransform;

  renderNodes(nodes: Node[]) {
    const ctx = this.context;

    nodes.forEach((node) => {
      const [x, y] = this.transform.apply([node.x, node.y]);

      // Skip if outside viewport
      if (!this.isInViewport(x, y, node.radius)) return;

      // Draw node
      ctx.beginPath();
      ctx.arc(x, y, node.radius, 0, 2 * Math.PI);

      // Color based on optimization status
      ctx.fillStyle = this.getNodeColor(node);
      ctx.fill();

      // Draw border
      ctx.strokeStyle = node.selected ? '#3B82F6' : '#E5E7EB';
      ctx.lineWidth = node.selected ? 3 : 1;
      ctx.stroke();

      // Draw label if zoomed in enough
      if (this.transform.k > 0.5) {
        this.renderLabel(node, x, y);
      }
    });
  }

  getNodeColor(node: Node): string {
    const colors = {
      optimized: '#10B981', // Green
      needs_work: '#F59E0B', // Yellow
      critical: '#EF4444', // Red
      no_data: '#9CA3AF', // Gray
    };
    return colors[node.status] || colors.no_data;
  }

  getNodeRadius(node: Node): number {
    // Logarithmic scale based on product count
    const minRadius = 5;
    const maxRadius = 30;
    const scale = d3.scaleLog().domain([1, 10000]).range([minRadius, maxRadius]);
    return scale(Math.max(1, node.product_count));
  }
}
```

### 3.4 Zoom & Pan Controls

**Priority**: P0 - Critical
**Estimate**: 4 hours

```typescript
// lib/visualization/controls.ts
export function setupZoomBehavior(canvas: HTMLCanvasElement, simulation: d3.Simulation) {
  const zoom = d3
    .zoom()
    .scaleExtent([0.1, 10])
    .on('zoom', (event) => {
      const transform = event.transform;

      // Update canvas transform
      const ctx = canvas.getContext('2d');
      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.translate(transform.x, transform.y);
      ctx.scale(transform.k, transform.k);

      // Re-render with new transform
      renderer.setTransform(transform);
      renderer.render();

      ctx.restore();
    });

  // Apply zoom behavior to canvas
  d3.select(canvas).call(zoom);

  // Programmatic controls
  return {
    zoomIn: () => zoom.scaleBy(d3.select(canvas), 1.2),
    zoomOut: () => zoom.scaleBy(d3.select(canvas), 0.8),
    reset: () => zoom.transform(d3.select(canvas), d3.zoomIdentity),
    fitToView: () => {
      const bounds = calculateBounds(nodes);
      const scale = Math.min(canvas.width / bounds.width, canvas.height / bounds.height) * 0.9;
      zoom.transform(
        d3.select(canvas),
        d3.zoomIdentity.translate(canvas.width / 2, canvas.height / 2).scale(scale)
      );
    },
  };
}
```

### 3.5 Progressive Loading Strategy

**Priority**: P1 - High
**Estimate**: 6 hours

```typescript
// lib/visualization/progressive-loader.ts
export class ProgressiveLoader {
  private loadedNodes = new Set<string>();
  private viewport: Viewport;
  private zoomLevel: number;

  async loadVisibleNodes(allNodes: Node[]): Promise<Node[]> {
    const levels = this.getLoadingLevels();
    const nodesToLoad: Node[] = [];

    // Level 1: Core nodes (top level + high importance)
    if (levels >= 1) {
      nodesToLoad.push(...this.getCoreNodes(allNodes));
    }

    // Level 2: Viewport nodes
    if (levels >= 2) {
      nodesToLoad.push(...this.getViewportNodes(allNodes));
    }

    // Level 3: Connected nodes
    if (levels >= 3) {
      nodesToLoad.push(...this.getConnectedNodes(nodesToLoad, allNodes));
    }

    // Level 4: All remaining
    if (levels >= 4) {
      nodesToLoad.push(...allNodes);
    }

    return this.deduplicateNodes(nodesToLoad);
  }

  getLoadingLevels(): number {
    if (this.zoomLevel < 0.25) return 1; // Minimal
    if (this.zoomLevel < 0.5) return 2; // Viewport only
    if (this.zoomLevel < 1.0) return 3; // With connections
    return 4; // Everything
  }

  streamNodes(nodes: Node[], batchSize = 100): AsyncGenerator<Node[]> {
    return async function* () {
      for (let i = 0; i < nodes.length; i += batchSize) {
        yield nodes.slice(i, i + batchSize);
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
    };
  }
}
```

### 3.6 Interaction Handlers

**Priority**: P1 - High
**Estimate**: 4 hours

```typescript
// lib/visualization/interactions.ts
export class InteractionHandler {
  private hoveredNode: Node | null = null;
  private selectedNodes: Set<Node> = new Set();

  setupEventListeners(canvas: HTMLCanvasElement, nodes: Node[]) {
    // Mouse move - hover effects
    canvas.addEventListener('mousemove', (e) => {
      const point = this.getTransformedPoint(e);
      const node = this.findNodeAtPoint(point, nodes);

      if (node !== this.hoveredNode) {
        this.handleHoverChange(this.hoveredNode, node);
        this.hoveredNode = node;
      }
    });

    // Click - selection
    canvas.addEventListener('click', (e) => {
      const point = this.getTransformedPoint(e);
      const node = this.findNodeAtPoint(point, nodes);

      if (node) {
        if (e.shiftKey) {
          this.toggleSelection(node);
        } else {
          this.selectSingle(node);
        }
        this.onNodeSelect?.(node);
      } else {
        this.clearSelection();
      }
    });

    // Double click - zoom to node
    canvas.addEventListener('dblclick', (e) => {
      const point = this.getTransformedPoint(e);
      const node = this.findNodeAtPoint(point, nodes);

      if (node) {
        this.zoomToNode(node);
      }
    });
  }

  handleHoverChange(oldNode: Node | null, newNode: Node | null) {
    // Remove hover state from old node
    if (oldNode) {
      oldNode.hovered = false;
      this.updateConnectedNodes(oldNode, false);
    }

    // Add hover state to new node
    if (newNode) {
      newNode.hovered = true;
      this.updateConnectedNodes(newNode, true);
      this.showTooltip(newNode);
    } else {
      this.hideTooltip();
    }

    // Trigger re-render
    this.requestRender();
  }
}
```

---

## Performance Optimization

### 3.7 WebGL Renderer (Fallback)

**Priority**: P2 - Medium
**Estimate**: 8 hours

```typescript
// lib/visualization/webgl-renderer.ts
export class WebGLRenderer {
  private gl: WebGLRenderingContext;
  private program: WebGLProgram;

  // Vertex shader for nodes
  private vertexShader = `
    attribute vec2 position;
    attribute float radius;
    attribute vec3 color;
    uniform mat3 transform;
    varying vec3 vColor;
    
    void main() {
      vec3 transformed = transform * vec3(position, 1.0);
      gl_Position = vec4(transformed.xy, 0.0, 1.0);
      gl_PointSize = radius * 2.0;
      vColor = color;
    }
  `;

  // Fragment shader
  private fragmentShader = `
    precision mediump float;
    varying vec3 vColor;
    
    void main() {
      vec2 coord = gl_PointCoord - vec2(0.5);
      if (length(coord) > 0.5) discard;
      gl_FragColor = vec4(vColor, 1.0);
    }
  `;

  renderNodes(nodes: Node[]) {
    // Convert nodes to buffer data
    // Upload to GPU
    // Draw with single call
  }
}
```

---

## Testing Requirements

### Performance Tests

```typescript
describe('Visualization Performance', () => {
  test('renders 3000 nodes at 30+ FPS', async () => {
    const nodes = generateTestNodes(3000);
    const fps = await measureFPS(() => renderer.render(nodes));
    expect(fps).toBeGreaterThan(30);
  });

  test('zoom maintains smooth performance', async () => {
    const responseTime = await measureInteractionTime('zoom');
    expect(responseTime).toBeLessThan(16); // 60fps
  });

  test('progressive loading completes in stages', async () => {
    const stages = await trackLoadingStages(5000);
    expect(stages).toEqual([100, 500, 1500, 3000, 5000]);
  });
});
```

---

## Browser Compatibility

- Chrome 90+ ✅ (Primary)
- Firefox 88+ ✅
- Safari 14+ ✅
- Edge 90+ ✅
- Mobile Safari ⚠️ (Limited to 1000 nodes)
- Chrome Mobile ⚠️ (Limited to 1000 nodes)

---

## Definition of Done

- [ ] 3000+ nodes rendering smoothly
- [ ] Zoom/pan controls responsive
- [ ] Visual encoding matches spec
- [ ] Hover/click interactions working
- [ ] Progressive loading implemented
- [ ] Performance targets met
- [ ] Memory usage < 200MB
- [ ] Cross-browser tested

---

## Sprint Review Prep

**Demo Script**:

1. Load visualization with 3000+ nodes
2. Demonstrate smooth zoom/pan
3. Show hover tooltips
4. Click to select nodes
5. Double-click to zoom
6. Show performance metrics

**Metrics to Share**:

- Max nodes rendered: 3000+
- Frame rate: 30-60 FPS
- Initial load time: <2s
- Interaction latency: <16ms
- Memory usage: ~150MB

---

## Next Sprint Preview

Sprint 4 will focus on:

- Opportunity scoring algorithm
- Revenue potential calculations
- Priority ranking system
- Insights generation

**Handoff Requirements**:

- Visualization rendering smoothly
- Interaction handlers complete
- Performance optimized
- Ready for data integration
