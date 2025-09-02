# Story 5.7: D3 Visualization Scale-up

## User Story

As a user,
I want to visualize and interact with up to 3,000 taxonomy nodes smoothly,
So that I can understand and navigate my complete content hierarchy.

## Size & Priority

- **Size**: M (4 hours) - Scaling from 1,000 to 3,000 nodes
- **Priority**: P2 - Medium
- **Sprint**: 5 (Adjusted)
- **Dependencies**: Story 3.1 (D3 Force Simulation - 1,000 nodes)

## Description

Scale the D3 visualization from 1,000 to 3,000 nodes with performance optimizations, level-of-detail rendering, and improved interaction patterns. This builds on the foundation established in Story 3.1.

## Implementation Steps

1. **Performance-optimized renderer**

   ```typescript
   // lib/visualization/optimized-renderer.ts
   import * as d3 from 'd3';

   export interface RenderOptimizations {
     useLOD: boolean; // Level of Detail
     useQuadtree: boolean; // Spatial indexing
     useWebWorker: boolean; // Offload calculations
     useVirtualization: boolean; // Render only visible nodes
     batchUpdates: boolean; // Batch DOM updates
   }

   export class OptimizedD3Renderer {
     private canvas: HTMLCanvasElement;
     private ctx: CanvasRenderingContext2D;
     private simulation: d3.Simulation<any, any>;
     private quadtree: d3.Quadtree<any> | null = null;
     private viewport: { x: number; y: number; width: number; height: number };
     private zoom: number = 1;
     private optimizations: RenderOptimizations;
     private frameTime = 0;
     private targetFPS = 60;
     private worker: Worker | null = null;

     constructor(canvas: HTMLCanvasElement, optimizations: Partial<RenderOptimizations> = {}) {
       this.canvas = canvas;
       this.ctx = canvas.getContext('2d', {
         alpha: false,
         desynchronized: true,
       })!;

       this.viewport = {
         x: 0,
         y: 0,
         width: canvas.width,
         height: canvas.height,
       };

       this.optimizations = {
         useLOD: optimizations.useLOD ?? true,
         useQuadtree: optimizations.useQuadtree ?? true,
         useWebWorker: optimizations.useWebWorker ?? true,
         useVirtualization: optimizations.useVirtualization ?? true,
         batchUpdates: optimizations.batchUpdates ?? true,
       };

       if (this.optimizations.useWebWorker) {
         this.initWebWorker();
       }
     }

     initializeSimulation(nodes: any[], links: any[]) {
       // Configure simulation for large datasets
       this.simulation = d3
         .forceSimulation(nodes)
         .force(
           'link',
           d3
             .forceLink(links)
             .id((d: any) => d.id)
             .distance(30)
             .strength(0.5)
         )
         .force(
           'charge',
           d3.forceManyBody().strength(-50).distanceMax(200) // Limit charge force range
         )
         .force('center', d3.forceCenter(this.canvas.width / 2, this.canvas.height / 2))
         .force(
           'collision',
           d3.forceCollide().radius(10).iterations(1) // Reduce collision detection iterations
         )
         .alphaDecay(0.02) // Faster stabilization
         .velocityDecay(0.4); // More damping

       // Build spatial index
       if (this.optimizations.useQuadtree) {
         this.buildQuadtree(nodes);
       }

       // Start render loop
       this.startRenderLoop();
     }

     private buildQuadtree(nodes: any[]) {
       this.quadtree = d3
         .quadtree()
         .x((d: any) => d.x)
         .y((d: any) => d.y)
         .addAll(nodes);
     }

     private initWebWorker() {
       const workerCode = `
         self.onmessage = function(e) {
           const { nodes, links, config } = e.data;
           
           // Perform force calculations
           for (let i = 0; i < config.iterations; i++) {
             // Apply forces
             applyLinkForce(nodes, links);
             applyChargeForce(nodes);
             applyCenterForce(nodes, config.center);
             
             // Update positions
             nodes.forEach(node => {
               node.vx = (node.vx || 0) * config.velocityDecay;
               node.vy = (node.vy || 0) * config.velocityDecay;
               node.x += node.vx;
               node.y += node.vy;
             });
           }
           
           self.postMessage({ nodes });
         };
         
         function applyLinkForce(nodes, links) {
           // Simplified link force calculation
           links.forEach(link => {
             const source = nodes.find(n => n.id === link.source);
             const target = nodes.find(n => n.id === link.target);
             if (source && target) {
               const dx = target.x - source.x;
               const dy = target.y - source.y;
               const distance = Math.sqrt(dx * dx + dy * dy);
               const force = (distance - 30) * 0.1;
               const fx = (dx / distance) * force;
               const fy = (dy / distance) * force;
               source.vx = (source.vx || 0) + fx;
               source.vy = (source.vy || 0) + fy;
               target.vx = (target.vx || 0) - fx;
               target.vy = (target.vy || 0) - fy;
             }
           });
         }
         
         function applyChargeForce(nodes) {
           // Simplified charge force calculation
           for (let i = 0; i < nodes.length; i++) {
             for (let j = i + 1; j < nodes.length; j++) {
               const dx = nodes[j].x - nodes[i].x;
               const dy = nodes[j].y - nodes[i].y;
               const distance = Math.sqrt(dx * dx + dy * dy);
               if (distance < 200) {
                 const force = -50 / (distance * distance);
                 const fx = (dx / distance) * force;
                 const fy = (dy / distance) * force;
                 nodes[i].vx = (nodes[i].vx || 0) - fx;
                 nodes[i].vy = (nodes[i].vy || 0) - fy;
                 nodes[j].vx = (nodes[j].vx || 0) + fx;
                 nodes[j].vy = (nodes[j].vy || 0) + fy;
               }
             }
           }
         }
         
         function applyCenterForce(nodes, center) {
           // Pull nodes toward center
           nodes.forEach(node => {
             const dx = center.x - node.x;
             const dy = center.y - node.y;
             node.vx = (node.vx || 0) + dx * 0.01;
             node.vy = (node.vy || 0) + dy * 0.01;
           });
         }
       `;

       const blob = new Blob([workerCode], { type: 'application/javascript' });
       this.worker = new Worker(URL.createObjectURL(blob));
     }

     private startRenderLoop() {
       let lastFrameTime = performance.now();

       const render = () => {
         const currentTime = performance.now();
         const deltaTime = currentTime - lastFrameTime;

         // Dynamic quality adjustment based on performance
         if (deltaTime > 1000 / 30) {
           // Below 30 FPS
           this.reduceQuality();
         } else if (deltaTime < 1000 / 60) {
           // Above 60 FPS
           this.increaseQuality();
         }

         this.renderFrame();

         lastFrameTime = currentTime;
         this.frameTime = deltaTime;

         requestAnimationFrame(render);
       };

       requestAnimationFrame(render);
     }

     private renderFrame() {
       const nodes = this.simulation.nodes();
       const links = this.simulation.force('link').links();

       // Clear canvas
       this.ctx.fillStyle = '#ffffff';
       this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

       // Apply transformations
       this.ctx.save();
       this.ctx.translate(this.viewport.x, this.viewport.y);
       this.ctx.scale(this.zoom, this.zoom);

       // Get visible nodes if virtualization is enabled
       const visibleNodes = this.optimizations.useVirtualization
         ? this.getVisibleNodes(nodes)
         : nodes;

       const visibleLinks = this.optimizations.useVirtualization
         ? this.getVisibleLinks(links, visibleNodes)
         : links;

       // Render based on LOD
       const lod = this.calculateLOD();

       // Render links
       this.renderLinks(visibleLinks, lod);

       // Render nodes
       this.renderNodes(visibleNodes, lod);

       this.ctx.restore();

       // Render UI overlay
       this.renderOverlay();
     }

     private getVisibleNodes(nodes: any[]): any[] {
       if (!this.optimizations.useQuadtree || !this.quadtree) {
         return nodes;
       }

       const visible: any[] = [];
       const padding = 50;

       // Convert viewport to world coordinates
       const worldBounds = {
         x1: -this.viewport.x / this.zoom - padding,
         y1: -this.viewport.y / this.zoom - padding,
         x2: (-this.viewport.x + this.viewport.width) / this.zoom + padding,
         y2: (-this.viewport.y + this.viewport.height) / this.zoom + padding,
       };

       // Use quadtree to find nodes in viewport
       this.quadtree.visit((node, x1, y1, x2, y2) => {
         if (node.data) {
           const d = node.data;
           if (
             d.x >= worldBounds.x1 &&
             d.x <= worldBounds.x2 &&
             d.y >= worldBounds.y1 &&
             d.y <= worldBounds.y2
           ) {
             visible.push(d);
           }
         }

         // Don't visit children if bounds don't intersect
         return (
           x1 > worldBounds.x2 || x2 < worldBounds.x1 || y1 > worldBounds.y2 || y2 < worldBounds.y1
         );
       });

       return visible;
     }

     private getVisibleLinks(links: any[], visibleNodes: any[]): any[] {
       const nodeSet = new Set(visibleNodes.map((n) => n.id));
       return links.filter((link) => nodeSet.has(link.source.id) || nodeSet.has(link.target.id));
     }

     private calculateLOD(): number {
       // Level of Detail: 0 = lowest, 3 = highest
       if (this.zoom < 0.5) return 0;
       if (this.zoom < 1) return 1;
       if (this.zoom < 2) return 2;
       return 3;
     }

     private renderLinks(links: any[], lod: number) {
       if (lod === 0) return; // Don't render links at lowest detail

       this.ctx.beginPath();
       this.ctx.strokeStyle = lod === 1 ? '#e0e0e0' : '#d0d0d0';
       this.ctx.lineWidth = lod === 1 ? 0.5 : 1;
       this.ctx.globalAlpha = lod === 1 ? 0.5 : 0.8;

       links.forEach((link) => {
         this.ctx.moveTo(link.source.x, link.source.y);
         this.ctx.lineTo(link.target.x, link.target.y);
       });

       this.ctx.stroke();
       this.ctx.globalAlpha = 1;
     }

     private renderNodes(nodes: any[], lod: number) {
       // Group nodes by type for batch rendering
       const nodesByType = this.groupNodesByType(nodes);

       Object.entries(nodesByType).forEach(([type, typeNodes]) => {
         this.renderNodeBatch(typeNodes, type, lod);
       });
     }

     private groupNodesByType(nodes: any[]): Record<string, any[]> {
       const groups: Record<string, any[]> = {};

       nodes.forEach((node) => {
         const type = node.type || 'default';
         if (!groups[type]) groups[type] = [];
         groups[type].push(node);
       });

       return groups;
     }

     private renderNodeBatch(nodes: any[], type: string, lod: number) {
       const color = this.getNodeColor(type);
       const size = this.getNodeSize(type, lod);

       // Batch render all nodes of same type
       this.ctx.fillStyle = color;

       if (lod <= 1) {
         // Low detail: render as squares for performance
         nodes.forEach((node) => {
           this.ctx.fillRect(node.x - size / 2, node.y - size / 2, size, size);
         });
       } else {
         // High detail: render as circles
         nodes.forEach((node) => {
           this.ctx.beginPath();
           this.ctx.arc(node.x, node.y, size / 2, 0, 2 * Math.PI);
           this.ctx.fill();
         });

         // Render labels at highest detail
         if (lod === 3) {
           this.ctx.font = '10px sans-serif';
           this.ctx.fillStyle = '#333';
           this.ctx.textAlign = 'center';

           nodes.forEach((node) => {
             if (node.label) {
               this.ctx.fillText(node.label, node.x, node.y + size / 2 + 12);
             }
           });
         }
       }
     }

     private getNodeColor(type: string): string {
       const colors: Record<string, string> = {
         category: '#4A90E2',
         product: '#7ED321',
         page: '#F5A623',
         post: '#BD10E0',
         default: '#9013FE',
       };

       return colors[type] || colors.default;
     }

     private getNodeSize(type: string, lod: number): number {
       const baseSizes: Record<string, number> = {
         category: 12,
         product: 10,
         page: 8,
         post: 8,
         default: 8,
       };

       const baseSize = baseSizes[type] || baseSizes.default;

       // Reduce size at lower detail levels
       return baseSize * (0.5 + (lod * 0.5) / 3);
     }

     private renderOverlay() {
       // Performance stats
       this.ctx.save();
       this.ctx.fillStyle = 'rgba(0,0,0,0.7)';
       this.ctx.fillRect(10, 10, 150, 60);

       this.ctx.fillStyle = '#fff';
       this.ctx.font = '12px monospace';
       this.ctx.fillText(`FPS: ${Math.round(1000 / this.frameTime)}`, 20, 30);
       this.ctx.fillText(`Nodes: ${this.simulation.nodes().length}`, 20, 45);
       this.ctx.fillText(`Zoom: ${this.zoom.toFixed(2)}x`, 20, 60);

       this.ctx.restore();
     }

     private reduceQuality() {
       // Dynamically reduce quality to maintain performance
       if (this.optimizations.useLOD) {
         console.log('Reducing render quality for performance');
       }
     }

     private increaseQuality() {
       // Restore quality when performance allows
       if (this.optimizations.useLOD) {
         console.log('Increasing render quality');
       }
     }

     // Public methods for interaction
     setZoom(zoom: number) {
       this.zoom = Math.max(0.1, Math.min(5, zoom));
     }

     pan(dx: number, dy: number) {
       this.viewport.x += dx;
       this.viewport.y += dy;
     }

     getNodeAtPosition(x: number, y: number): any {
       // Convert screen coordinates to world coordinates
       const worldX = (x - this.viewport.x) / this.zoom;
       const worldY = (y - this.viewport.y) / this.zoom;

       // Find closest node using quadtree
       if (this.quadtree) {
         let closest: any = null;
         let minDistance = Infinity;

         this.quadtree.visit((node, x1, y1, x2, y2) => {
           if (node.data) {
             const dx = node.data.x - worldX;
             const dy = node.data.y - worldY;
             const distance = Math.sqrt(dx * dx + dy * dy);

             if (distance < minDistance && distance < 20 / this.zoom) {
               closest = node.data;
               minDistance = distance;
             }
           }

           // Prune search
           return x1 > worldX + 20 || x2 < worldX - 20 || y1 > worldY + 20 || y2 < worldY - 20;
         });

         return closest;
       }

       return null;
     }
   }
   ```

2. **React component for 3,000 node visualization**

   ```typescript
   // components/visualization/ScaledTaxonomyVisualization.tsx
   import { useEffect, useRef, useState } from 'react';
   import { OptimizedD3Renderer } from '@/lib/visualization/optimized-renderer';

   export function ScaledTaxonomyVisualization({
     data,
     onNodeClick,
     onNodeHover,
   }: {
     data: { nodes: any[]; links: any[] };
     onNodeClick?: (node: any) => void;
     onNodeHover?: (node: any) => void;
   }) {
     const canvasRef = useRef<HTMLCanvasElement>(null);
     const rendererRef = useRef<OptimizedD3Renderer | null>(null);
     const [stats, setStats] = useState({
       nodeCount: 0,
       fps: 0,
       renderTime: 0,
     });

     useEffect(() => {
       if (!canvasRef.current || !data) return;

       // Initialize renderer
       const renderer = new OptimizedD3Renderer(canvasRef.current, {
         useLOD: true,
         useQuadtree: true,
         useWebWorker: false, // Can enable for more performance
         useVirtualization: true,
         batchUpdates: true,
       });

       rendererRef.current = renderer;

       // Initialize with data
       renderer.initializeSimulation(data.nodes, data.links);

       // Set up interaction handlers
       const handleWheel = (e: WheelEvent) => {
         e.preventDefault();
         const delta = e.deltaY > 0 ? 0.9 : 1.1;
         renderer.setZoom(renderer.zoom * delta);
       };

       const handleMouseMove = (e: MouseEvent) => {
         if (e.buttons === 1) { // Left mouse button
           renderer.pan(e.movementX, e.movementY);
         } else {
           const node = renderer.getNodeAtPosition(e.offsetX, e.offsetY);
           if (node && onNodeHover) {
             onNodeHover(node);
           }
         }
       };

       const handleClick = (e: MouseEvent) => {
         const node = renderer.getNodeAtPosition(e.offsetX, e.offsetY);
         if (node && onNodeClick) {
           onNodeClick(node);
         }
       };

       canvasRef.current.addEventListener('wheel', handleWheel);
       canvasRef.current.addEventListener('mousemove', handleMouseMove);
       canvasRef.current.addEventListener('click', handleClick);

       // Update stats periodically
       const statsInterval = setInterval(() => {
         setStats({
           nodeCount: data.nodes.length,
           fps: renderer.currentFPS,
           renderTime: renderer.frameTime,
         });
       }, 1000);

       return () => {
         canvasRef.current?.removeEventListener('wheel', handleWheel);
         canvasRef.current?.removeEventListener('mousemove', handleMouseMove);
         canvasRef.current?.removeEventListener('click', handleClick);
         clearInterval(statsInterval);
         renderer.destroy();
       };
     }, [data, onNodeClick, onNodeHover]);

     return (
       <div className="relative w-full h-full">
         <canvas
           ref={canvasRef}
           width={1920}
           height={1080}
           className="w-full h-full"
           style={{ cursor: 'grab' }}
         />

         {/* Controls overlay */}
         <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-4">
           <h3 className="font-semibold mb-2">Controls</h3>
           <div className="space-y-1 text-sm">
             <div>Scroll: Zoom</div>
             <div>Drag: Pan</div>
             <div>Click: Select</div>
           </div>
         </div>

         {/* Performance monitor */}
         <div className="absolute bottom-4 left-4 bg-black bg-opacity-70 text-white rounded p-2 text-xs font-mono">
           <div>Nodes: {stats.nodeCount}</div>
           <div>FPS: {stats.fps}</div>
           <div>Frame: {stats.renderTime.toFixed(1)}ms</div>
         </div>
       </div>
     );
   }
   ```

## Files to Create

- `lib/visualization/optimized-renderer.ts` - Performance-optimized renderer
- `lib/visualization/spatial-index.ts` - Quadtree implementation
- `lib/visualization/web-worker.ts` - Web Worker for calculations
- `components/visualization/ScaledTaxonomyVisualization.tsx` - React component
- `lib/visualization/performance-monitor.ts` - Performance tracking

## Acceptance Criteria

- [ ] Can render 3,000 nodes at 30+ FPS
- [ ] Smooth zoom and pan interactions
- [ ] Level-of-detail rendering working
- [ ] Virtualization only renders visible nodes
- [ ] Web Worker option available
- [ ] Memory usage under 500MB
- [ ] Click detection accurate
- [ ] Performance stats displayed

## Testing Requirements

- [ ] Test with exactly 3,000 nodes
- [ ] Test FPS at different zoom levels
- [ ] Test memory usage over time
- [ ] Test interaction responsiveness
- [ ] Test on different devices/browsers
- [ ] Test with various node densities
- [ ] Verify quadtree performance
- [ ] Test graceful degradation

## Definition of Done

- [ ] 3,000 nodes rendering smoothly
- [ ] All optimizations implemented
- [ ] Performance targets met (30+ FPS)
- [ ] Interactions responsive
- [ ] Memory usage acceptable
- [ ] Tests passing
- [ ] Documentation updated
- [ ] Ready for production use
