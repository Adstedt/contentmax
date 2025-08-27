# Story 3.1: D3.js Force Simulation Setup

## User Story

As a content strategist,
I want to see my site's taxonomy as an interactive visual map,
So that I can understand the structure and relationships at a glance.

## Size & Priority

- **Size**: L (8 hours)
- **Priority**: P0 - Critical
- **Sprint**: 3
- **Dependencies**: Sprint 2 complete

## Description

Implement D3.js force-directed graph with Canvas rendering for high-performance visualization of up to 3,000 taxonomy nodes.

## Implementation Steps

1. **Set up D3.js force simulation**

   ```typescript
   import * as d3 from 'd3';

   interface Node {
     id: string;
     url: string;
     title: string;
     x?: number;
     y?: number;
     vx?: number;
     vy?: number;
     fx?: number | null;
     fy?: number | null;
     radius: number;
     color: string;
     children: string[];
   }

   interface Link {
     source: string | Node;
     target: string | Node;
     strength: number;
   }

   class ForceSimulation {
     private simulation: d3.Simulation<Node, Link>;
     private nodes: Node[];
     private links: Link[];

     initialize(nodes: Node[], links: Link[]) {
       this.simulation = d3
         .forceSimulation(nodes)
         .force(
           'link',
           d3
             .forceLink(links)
             .id((d) => d.id)
             .distance(50)
         )
         .force('charge', d3.forceManyBody().strength(-100))
         .force('center', d3.forceCenter(width / 2, height / 2))
         .force(
           'collision',
           d3.forceCollide().radius((d) => d.radius + 2)
         );
     }
   }
   ```

2. **Canvas rendering system**

   ```typescript
   class CanvasRenderer {
     private canvas: HTMLCanvasElement;
     private ctx: CanvasRenderingContext2D;
     private transform: d3.ZoomTransform;

     constructor(canvas: HTMLCanvasElement) {
       this.canvas = canvas;
       this.ctx = canvas.getContext('2d')!;
       this.setupHighDPI();
     }

     render(nodes: Node[], links: Link[]) {
       this.clear();
       this.ctx.save();
       this.ctx.translate(this.transform.x, this.transform.y);
       this.ctx.scale(this.transform.k, this.transform.k);

       // Draw links
       this.drawLinks(links);

       // Draw nodes
       this.drawNodes(nodes);

       this.ctx.restore();
     }

     private drawNodes(nodes: Node[]) {
       nodes.forEach((node) => {
         // Draw circle
         this.ctx.beginPath();
         this.ctx.arc(node.x!, node.y!, node.radius, 0, 2 * Math.PI);
         this.ctx.fillStyle = node.color;
         this.ctx.fill();

         // Draw label if zoomed in enough
         if (this.transform.k > 0.5) {
           this.ctx.fillStyle = '#000';
           this.ctx.font = `${12 / this.transform.k}px sans-serif`;
           this.ctx.fillText(node.title, node.x! + node.radius + 5, node.y!);
         }
       });
     }
   }
   ```

3. **React component wrapper**

   ```typescript
   interface TaxonomyVisualizationProps {
     data: {
       nodes: TaxonomyNode[];
       links: TaxonomyLink[];
     };
     onNodeClick?: (node: TaxonomyNode) => void;
     onSelectionChange?: (nodes: TaxonomyNode[]) => void;
   }

   const TaxonomyVisualization: React.FC<TaxonomyVisualizationProps> = ({
     data,
     onNodeClick,
     onSelectionChange
   }) => {
     const canvasRef = useRef<HTMLCanvasElement>(null);
     const simulationRef = useRef<ForceSimulation>();
     const rendererRef = useRef<CanvasRenderer>();

     useEffect(() => {
       if (!canvasRef.current) return;

       // Initialize simulation
       simulationRef.current = new ForceSimulation();
       simulationRef.current.initialize(data.nodes, data.links);

       // Initialize renderer
       rendererRef.current = new CanvasRenderer(canvasRef.current);

       // Start animation loop
       simulationRef.current.on('tick', () => {
         rendererRef.current?.render(data.nodes, data.links);
       });
     }, [data]);

     return (
       <canvas
         ref={canvasRef}
         width={width}
         height={height}
         style={{ width: '100%', height: '100%' }}
       />
     );
   };
   ```

4. **Force configuration**

   ```typescript
   interface ForceConfig {
     link: {
       distance: number; // Target distance between linked nodes
       strength: number; // Link force strength (0-1)
     };
     charge: {
       strength: number; // Repulsion between nodes
       distanceMax: number; // Maximum distance for charge force
     };
     collision: {
       radius: (d: Node) => number; // Collision detection radius
       strength: number; // Collision force strength
     };
     center: {
       x: number; // Center X coordinate
       y: number; // Center Y coordinate
       strength: number; // Centering force strength
     };
   }

   const defaultConfig: ForceConfig = {
     link: { distance: 50, strength: 0.5 },
     charge: { strength: -100, distanceMax: 500 },
     collision: { radius: (d) => d.radius + 2, strength: 1 },
     center: { x: width / 2, y: height / 2, strength: 0.1 },
   };
   ```

5. **Performance optimizations**
   ```typescript
   class PerformanceMonitor {
     private frameCount = 0;
     private lastTime = performance.now();
     private fps = 60;

     measureFPS(): number {
       const now = performance.now();
       const delta = now - this.lastTime;

       if (delta >= 1000) {
         this.fps = (this.frameCount * 1000) / delta;
         this.frameCount = 0;
         this.lastTime = now;
       }

       this.frameCount++;
       return this.fps;
     }

     shouldSimplifyRendering(): boolean {
       return this.fps < 30;
     }
   }
   ```

## Files to Create

- `components/taxonomy/D3Visualization/ForceGraph.tsx` - Main component
- `components/taxonomy/D3Visualization/ForceSimulation.ts` - D3 simulation
- `components/taxonomy/D3Visualization/CanvasRenderer.ts` - Canvas rendering
- `components/taxonomy/D3Visualization/useForceSimulation.ts` - React hook
- `lib/visualization/force-config.ts` - Force configuration
- `lib/visualization/node-renderer.ts` - Node rendering logic
- `lib/visualization/link-renderer.ts` - Link rendering logic
- `lib/visualization/performance-monitor.ts` - FPS monitoring

## Node Visual Encoding

```typescript
interface NodeVisualEncoding {
  // Size based on importance
  radius: {
    min: 5;
    max: 20;
    scale: 'linear' | 'sqrt' | 'log';
    property: 'skuCount' | 'traffic' | 'revenue';
  };

  // Color based on status
  color: {
    optimized: '#10b981'; // Green
    outdated: '#f59e0b'; // Yellow
    missing: '#ef4444'; // Red
    noContent: '#9ca3af'; // Gray
  };

  // Opacity for depth
  opacity: {
    min: 0.3;
    max: 1.0;
    byDepth: true;
  };
}
```

## Acceptance Criteria

- [ ] Force simulation renders 3,000 nodes smoothly
- [ ] Canvas rendering maintains 30+ FPS
- [ ] Node colors reflect content status
- [ ] Node sizes reflect importance metrics
- [ ] Links show parent-child relationships
- [ ] Simulation reaches equilibrium within 5 seconds
- [ ] Memory usage stays under 500MB
- [ ] Component responds to data updates

## Performance Requirements

- Initial render: <2 seconds for 3,000 nodes
- Steady state: >30 FPS with all nodes visible
- Interaction response: <100ms
- Memory usage: <500MB
- CPU usage: <60% on average hardware

## Canvas Optimization Techniques

- Use requestAnimationFrame for smooth animation
- Implement viewport culling (don't render off-screen nodes)
- Level-of-detail rendering based on zoom level
- Batch similar draw operations
- Use object pooling for frequently created objects
- Implement spatial indexing with quadtree

## Testing Requirements

- [ ] Test with 100, 1000, 3000 nodes
- [ ] Test performance on various devices
- [ ] Test memory usage over time
- [ ] Test force simulation convergence
- [ ] Test node interaction hit detection
- [ ] Test zoom/pan performance
- [ ] Test data update handling
- [ ] Test responsive canvas sizing

## Definition of Done

- [ ] Code complete and committed
- [ ] Force simulation working smoothly
- [ ] Canvas rendering optimized
- [ ] Performance targets met
- [ ] Visual encoding implemented
- [ ] React component integrated
- [ ] Tests written and passing
- [ ] Documentation complete
- [ ] Peer review completed
