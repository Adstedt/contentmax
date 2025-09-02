# Story 3.5: Performance Optimization

## User Story

As a user with a large taxonomy,
I want the visualization to remain responsive,
So that I can navigate smoothly even with 3,000 nodes.

## Size & Priority

- **Size**: M (4 hours)
- **Priority**: P1 - High
- **Sprint**: 3
- **Dependencies**: Tasks 3.1-3.4

## Description

Optimize the taxonomy visualization for smooth performance with 3,000 nodes through viewport culling, progressive rendering, and frame rate monitoring.

## Implementation Steps

1. **Viewport culling system**

   ```typescript
   class ViewportCuller {
     private visibilityCache = new Map<string, boolean>();
     private lastTransform: Transform | null = null;

     cullNodes(nodes: Node[], viewport: Viewport, padding = 100): Node[] {
       // Check if transform changed
       if (this.transformEquals(viewport.transform, this.lastTransform)) {
         // Use cached visibility
         return nodes.filter((n) => this.visibilityCache.get(n.id));
       }

       // Recalculate visibility
       this.visibilityCache.clear();
       this.lastTransform = { ...viewport.transform };

       const bounds = {
         left: -padding,
         right: viewport.width + padding,
         top: -padding,
         bottom: viewport.height + padding,
       };

       return nodes.filter((node) => {
         // Transform node position to screen space
         const screenX = node.x! * viewport.transform.k + viewport.transform.x;
         const screenY = node.y! * viewport.transform.k + viewport.transform.y;
         const screenRadius = node.radius * viewport.transform.k;

         const isVisible =
           screenX + screenRadius > bounds.left &&
           screenX - screenRadius < bounds.right &&
           screenY + screenRadius > bounds.top &&
           screenY - screenRadius < bounds.bottom;

         this.visibilityCache.set(node.id, isVisible);
         return isVisible;
       });
     }

     cullLinks(links: Link[], visibleNodes: Set<string>): Link[] {
       return links.filter((link) => {
         const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
         const targetId = typeof link.target === 'object' ? link.target.id : link.target;
         return visibleNodes.has(sourceId) || visibleNodes.has(targetId);
       });
     }
   }
   ```

2. **Progressive rendering**

   ```typescript
   class ProgressiveRenderer {
     private renderQueue: RenderItem[] = [];
     private framebudget = 16; // Target 60fps
     private batchSize = 100;

     async renderProgressive(ctx: CanvasRenderingContext2D, items: RenderItem[]) {
       // Sort by importance (larger, centered items first)
       const sorted = this.sortByImportance(items);

       // Split into batches
       const batches = this.createBatches(sorted, this.batchSize);

       for (const batch of batches) {
         const startTime = performance.now();

         // Render batch
         for (const item of batch) {
           this.renderItem(ctx, item);

           // Check frame budget
           if (performance.now() - startTime > this.framebudget * 0.8) {
             // Defer remaining items to next frame
             await this.nextFrame();
             break;
           }
         }

         // Allow other work between batches
         await this.nextFrame();
       }
     }

     private sortByImportance(items: RenderItem[]): RenderItem[] {
       return items.sort((a, b) => {
         // Prioritize by: size, distance from center, status
         const scoreA = this.calculateImportance(a);
         const scoreB = this.calculateImportance(b);
         return scoreB - scoreA;
       });
     }

     private calculateImportance(item: RenderItem): number {
       let score = 0;

       // Size contributes most
       score += item.radius * 10;

       // Distance from viewport center (closer is better)
       const distFromCenter = Math.sqrt(
         Math.pow(item.x - viewport.width / 2, 2) + Math.pow(item.y - viewport.height / 2, 2)
       );
       score += Math.max(0, 1000 - distFromCenter);

       // Critical status items get bonus
       if (item.contentStatus === ContentStatus.MISSING) {
         score += 500;
       }

       return score;
     }

     private nextFrame(): Promise<void> {
       return new Promise((resolve) => requestAnimationFrame(() => resolve()));
     }
   }
   ```

3. **Frame rate monitoring**

   ```typescript
   class FrameRateMonitor {
     private samples: number[] = [];
     private maxSamples = 60;
     private lastFrameTime = 0;
     private currentFPS = 60;
     private targetFPS = 30;

     measureFrame() {
       const now = performance.now();
       if (this.lastFrameTime) {
         const delta = now - this.lastFrameTime;
         const fps = 1000 / delta;

         this.samples.push(fps);
         if (this.samples.length > this.maxSamples) {
           this.samples.shift();
         }

         // Calculate moving average
         this.currentFPS = this.samples.reduce((a, b) => a + b, 0) / this.samples.length;
       }
       this.lastFrameTime = now;
     }

     getFPS(): number {
       return Math.round(this.currentFPS);
     }

     isPerformanceGood(): boolean {
       return this.currentFPS >= this.targetFPS;
     }

     getQualityLevel(): 'high' | 'medium' | 'low' {
       if (this.currentFPS >= 50) return 'high';
       if (this.currentFPS >= 30) return 'medium';
       return 'low';
     }

     getRecommendations(): PerformanceRecommendations {
       if (this.currentFPS < 20) {
         return {
           reduceNodes: true,
           disableAnimations: true,
           simplifyRendering: true,
           enableClustering: true,
         };
       }
       if (this.currentFPS < 30) {
         return {
           reduceNodes: false,
           disableAnimations: true,
           simplifyRendering: true,
           enableClustering: true,
         };
       }
       return {
         reduceNodes: false,
         disableAnimations: false,
         simplifyRendering: false,
         enableClustering: false,
       };
     }
   }
   ```

4. **Memory optimization**

   ```typescript
   class MemoryOptimizer {
     private objectPool = new Map<string, any[]>();
     private canvasPool: HTMLCanvasElement[] = [];

     // Object pooling for frequently created objects
     getPooledObject<T>(type: string, factory: () => T): T {
       if (!this.objectPool.has(type)) {
         this.objectPool.set(type, []);
       }

       const pool = this.objectPool.get(type)!;
       if (pool.length > 0) {
         return pool.pop() as T;
       }

       return factory();
     }

     returnToPool(type: string, obj: any) {
       const pool = this.objectPool.get(type);
       if (pool && pool.length < 100) {
         // Reset object state
         this.resetObject(obj);
         pool.push(obj);
       }
     }

     // Canvas layer management
     getOffscreenCanvas(width: number, height: number): HTMLCanvasElement {
       let canvas = this.canvasPool.find(
         (c) => c.width === width && c.height === height && !c.dataset.inUse
       );

       if (!canvas) {
         canvas = document.createElement('canvas');
         canvas.width = width;
         canvas.height = height;
         this.canvasPool.push(canvas);
       }

       canvas.dataset.inUse = 'true';
       return canvas;
     }

     releaseCanvas(canvas: HTMLCanvasElement) {
       canvas.dataset.inUse = 'false';
       const ctx = canvas.getContext('2d');
       ctx?.clearRect(0, 0, canvas.width, canvas.height);
     }

     // Periodic cleanup
     cleanup() {
       // Clear unused pool objects
       this.objectPool.forEach((pool, type) => {
         if (pool.length > 50) {
           pool.splice(50);
         }
       });

       // Remove excess canvases
       this.canvasPool = this.canvasPool.filter((canvas, i) => i < 5);
     }
   }
   ```

5. **Render optimization techniques**

   ```typescript
   class RenderOptimizer {
     private renderCanvas: HTMLCanvasElement;
     private renderContext: CanvasRenderingContext2D;
     private isDirty = true;
     private rafId: number | null = null;

     constructor(canvas: HTMLCanvasElement) {
       this.renderCanvas = canvas;
       this.renderContext = canvas.getContext('2d', {
         alpha: true,
         desynchronized: true, // Better performance
         willReadFrequently: false,
       })!;

       // Enable image smoothing for better performance
       this.renderContext.imageSmoothingEnabled = true;
       this.renderContext.imageSmoothingQuality = 'low';
     }

     requestRender() {
       this.isDirty = true;

       if (!this.rafId) {
         this.rafId = requestAnimationFrame(() => this.render());
       }
     }

     private render() {
       this.rafId = null;

       if (!this.isDirty) return;
       this.isDirty = false;

       const quality = this.frameMonitor.getQualityLevel();

       // Adjust rendering based on performance
       if (quality === 'low') {
         this.renderLowQuality();
       } else if (quality === 'medium') {
         this.renderMediumQuality();
       } else {
         this.renderHighQuality();
       }

       this.frameMonitor.measureFrame();
     }

     private renderLowQuality() {
       // Skip animations, reduce details
       this.renderContext.save();

       // Disable shadows for performance
       this.renderContext.shadowBlur = 0;

       // Use simpler shapes
       this.renderSimplifiedNodes();

       this.renderContext.restore();
     }

     private batchSimilarOperations() {
       // Group nodes by color to reduce state changes
       const nodesByColor = new Map<string, Node[]>();

       nodes.forEach((node) => {
         const color = this.getNodeColor(node);
         if (!nodesByColor.has(color)) {
           nodesByColor.set(color, []);
         }
         nodesByColor.get(color)!.push(node);
       });

       // Render each color group together
       nodesByColor.forEach((nodes, color) => {
         this.renderContext.fillStyle = color;
         nodes.forEach((node) => {
           this.renderContext.beginPath();
           this.renderContext.arc(node.x!, node.y!, node.radius, 0, Math.PI * 2);
           this.renderContext.fill();
         });
       });
     }
   }
   ```

## Files to Create

- `lib/visualization/viewport-culler.ts` - Viewport culling logic
- `lib/visualization/progressive-renderer.ts` - Progressive rendering
- `lib/visualization/frame-monitor.ts` - FPS monitoring
- `lib/visualization/memory-optimizer.ts` - Memory management
- `lib/visualization/render-optimizer.ts` - Render optimizations
- `lib/visualization/performance-profiler.ts` - Performance profiling
- `components/taxonomy/PerformanceOverlay.tsx` - FPS display
- `hooks/usePerformance.ts` - Performance monitoring hook

## Performance Targets

```typescript
interface PerformanceTargets {
  fps: {
    minimum: 30;
    target: 60;
    measurement: 'moving average over 1 second';
  };
  renderTime: {
    initial: 2000; // ms for first render
    frame: 16; // ms per frame
    interaction: 100; // ms for user interaction response
  };
  memory: {
    maximum: 500; // MB
    nodeOverhead: 1; // KB per node
    canvasLimit: 5; // Maximum offscreen canvases
  };
  nodes: {
    visible: 500; // Maximum visible at once
    total: 3000; // Total supported
    clustered: 100; // When clustered
  };
}
```

## Optimization Strategies

### Level 1 - Basic (Always On)

- Viewport culling
- Object pooling
- Batch similar draw operations

### Level 2 - Adaptive (When FPS < 50)

- Enable clustering for dense areas
- Reduce shadow effects
- Simplify node rendering

### Level 3 - Aggressive (When FPS < 30)

- Progressive rendering
- Disable animations
- Minimize detail level
- Increase clustering threshold

## Acceptance Criteria

- [ ] Maintains 30+ FPS with 3,000 nodes
- [ ] Viewport culling removes off-screen nodes
- [ ] Progressive rendering for initial load
- [ ] Frame rate monitor shows current FPS
- [ ] Automatic quality adjustment based on performance
- [ ] Memory usage stays under 500MB
- [ ] No memory leaks over time
- [ ] Smooth interaction even under load

## Profiling Metrics

```typescript
interface PerformanceMetrics {
  fps: number;
  frameTime: number;
  renderTime: number;
  cullingTime: number;
  visibleNodes: number;
  totalNodes: number;
  memoryUsage: number;
  canvasCount: number;
  pooledObjects: number;
}
```

## Testing Requirements

- [ ] Load test with 100, 1000, 3000 nodes
- [ ] Stress test with rapid zoom/pan
- [ ] Memory leak test over 30 minutes
- [ ] Performance on low-end devices
- [ ] Test quality degradation
- [ ] Test recovery from low FPS
- [ ] Profile with Chrome DevTools
- [ ] Test on different browsers

## Browser Compatibility

- Chrome 90+: Full feature support
- Firefox 88+: Full feature support
- Safari 14+: May need WebGL fallback
- Edge 90+: Full feature support

## Definition of Done

- [ ] Code complete and committed
- [ ] Performance targets met
- [ ] Culling system working
- [ ] Progressive rendering implemented
- [ ] Frame monitoring active
- [ ] Memory optimizations in place
- [ ] Quality adaptation functional
- [ ] Tests written and passing
- [ ] Performance profiled
- [ ] Peer review completed
