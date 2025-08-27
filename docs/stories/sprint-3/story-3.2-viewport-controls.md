# Story 3.2: Viewport Controls & Interactions

## User Story
As a user navigating the taxonomy,
I want intuitive zoom, pan, and selection controls,
So that I can explore different parts of my site structure easily.

## Size & Priority
- **Size**: M (6 hours)
- **Priority**: P0 - Critical
- **Sprint**: 3
- **Dependencies**: Task 3.1

## Description
Implement zoom, pan, and selection controls for the taxonomy visualization with smooth interactions and hit detection for node selection.

## Implementation Steps

1. **Zoom and pan controls**
   ```typescript
   import * as d3 from 'd3';
   
   class ViewportController {
     private zoom: d3.ZoomBehavior<Element, unknown>;
     private transform: d3.ZoomTransform = d3.zoomIdentity;
     
     constructor(
       canvas: HTMLCanvasElement,
       onTransform: (transform: d3.ZoomTransform) => void
     ) {
       this.zoom = d3.zoom<HTMLCanvasElement, unknown>()
         .scaleExtent([0.1, 10])  // Min and max zoom levels
         .on('zoom', (event) => {
           this.transform = event.transform;
           onTransform(this.transform);
         });
       
       d3.select(canvas).call(this.zoom);
     }
     
     // Programmatic controls
     zoomIn() {
       this.zoom.scaleBy(d3.select(this.canvas), 1.2);
     }
     
     zoomOut() {
       this.zoom.scaleBy(d3.select(this.canvas), 0.8);
     }
     
     resetZoom() {
       this.zoom.transform(d3.select(this.canvas), d3.zoomIdentity);
     }
     
     fitToView(nodes: Node[]) {
       const bounds = this.calculateBounds(nodes);
       // Calculate transform to fit all nodes
       const scale = Math.min(width / bounds.width, height / bounds.height) * 0.9;
       const transform = d3.zoomIdentity
         .translate(width / 2, height / 2)
         .scale(scale)
         .translate(-bounds.centerX, -bounds.centerY);
       
       this.zoom.transform(d3.select(this.canvas), transform);
     }
   }
   ```

2. **Hit detection with quadtree**
   ```typescript
   class HitDetection {
     private quadtree: d3.Quadtree<Node>;
     
     buildQuadtree(nodes: Node[]) {
       this.quadtree = d3.quadtree<Node>()
         .x(d => d.x!)
         .y(d => d.y!)
         .addAll(nodes);
     }
     
     findNode(x: number, y: number, radius = 5): Node | undefined {
       // Transform mouse coordinates to world space
       const [worldX, worldY] = this.screenToWorld(x, y);
       
       // Find closest node within radius
       let closest: Node | undefined;
       let minDistance = radius;
       
       this.quadtree.visit((node, x0, y0, x1, y1) => {
         if (!node.length) {
           const d = node.data;
           const dx = d.x! - worldX;
           const dy = d.y! - worldY;
           const distance = Math.sqrt(dx * dx + dy * dy);
           
           if (distance < minDistance && distance < d.radius) {
             closest = d;
             minDistance = distance;
           }
         }
         
         // Stop searching this quadrant if it's too far away
         return x0 > worldX + radius || 
                x1 < worldX - radius || 
                y0 > worldY + radius || 
                y1 < worldY - radius;
       });
       
       return closest;
     }
   }
   ```

3. **Selection tools**
   ```typescript
   interface SelectionState {
     mode: 'single' | 'multi' | 'lasso';
     selectedNodes: Set<string>;
     lassoPath: Point[];
   }
   
   class SelectionManager {
     private state: SelectionState = {
       mode: 'single',
       selectedNodes: new Set(),
       lassoPath: []
     };
     
     // Single selection
     selectNode(node: Node, append = false) {
       if (!append && this.state.mode === 'single') {
         this.state.selectedNodes.clear();
       }
       this.state.selectedNodes.add(node.id);
       this.highlightNodes();
     }
     
     // Box selection
     selectBox(x1: number, y1: number, x2: number, y2: number) {
       const minX = Math.min(x1, x2);
       const maxX = Math.max(x1, x2);
       const minY = Math.min(y1, y2);
       const maxY = Math.max(y1, y2);
       
       nodes.forEach(node => {
         if (node.x! >= minX && node.x! <= maxX &&
             node.y! >= minY && node.y! <= maxY) {
           this.state.selectedNodes.add(node.id);
         }
       });
     }
     
     // Lasso selection
     selectLasso(path: Point[]) {
       nodes.forEach(node => {
         if (this.pointInPolygon(node, path)) {
           this.state.selectedNodes.add(node.id);
         }
       });
     }
   }
   ```

4. **Control UI components**
   ```typescript
   const ZoomControls: React.FC<{ controller: ViewportController }> = ({ controller }) => {
     return (
       <div className="absolute top-4 right-4 flex flex-col gap-2">
         <button
           onClick={() => controller.zoomIn()}
           className="p-2 bg-white rounded shadow hover:bg-gray-50"
           aria-label="Zoom in"
         >
           <PlusIcon className="w-5 h-5" />
         </button>
         <button
           onClick={() => controller.zoomOut()}
           className="p-2 bg-white rounded shadow hover:bg-gray-50"
           aria-label="Zoom out"
         >
           <MinusIcon className="w-5 h-5" />
         </button>
         <button
           onClick={() => controller.resetZoom()}
           className="p-2 bg-white rounded shadow hover:bg-gray-50"
           aria-label="Reset zoom"
         >
           <HomeIcon className="w-5 h-5" />
         </button>
         <button
           onClick={() => controller.fitToView()}
           className="p-2 bg-white rounded shadow hover:bg-gray-50"
           aria-label="Fit to view"
         >
           <ExpandIcon className="w-5 h-5" />
         </button>
       </div>
     );
   };
   ```

5. **Mouse and touch interactions**
   ```typescript
   class InteractionHandler {
     private isDragging = false;
     private isSelecting = false;
     private startPoint: Point | null = null;
     
     handleMouseDown(event: MouseEvent) {
       const point = { x: event.offsetX, y: event.offsetY };
       const node = this.hitDetection.findNode(point.x, point.y);
       
       if (node) {
         // Node interaction
         if (event.shiftKey) {
           this.selection.selectNode(node, true); // Add to selection
         } else {
           this.selection.selectNode(node, false); // Replace selection
         }
       } else {
         // Start pan or selection
         this.startPoint = point;
         if (event.altKey) {
           this.isSelecting = true;
         } else {
           this.isDragging = true;
         }
       }
     }
     
     handleMouseMove(event: MouseEvent) {
       if (this.isDragging) {
         // Pan viewport
         const dx = event.offsetX - this.startPoint!.x;
         const dy = event.offsetY - this.startPoint!.y;
         this.viewport.pan(dx, dy);
       } else if (this.isSelecting) {
         // Draw selection box
         this.drawSelectionBox(this.startPoint!, { x: event.offsetX, y: event.offsetY });
       } else {
         // Hover effects
         const node = this.hitDetection.findNode(event.offsetX, event.offsetY);
         this.handleHover(node);
       }
     }
     
     handleWheel(event: WheelEvent) {
       event.preventDefault();
       const scale = event.deltaY > 0 ? 0.95 : 1.05;
       this.viewport.zoomAtPoint(event.offsetX, event.offsetY, scale);
     }
   }
   ```

## Files to Create

- `components/taxonomy/controls/ZoomControls.tsx` - Zoom button UI
- `components/taxonomy/controls/SelectionTools.tsx` - Selection mode UI
- `components/taxonomy/controls/MiniMap.tsx` - Overview minimap
- `lib/visualization/viewport-controller.ts` - Viewport management
- `lib/visualization/hit-detection.ts` - Node hit detection
- `lib/visualization/selection-manager.ts` - Selection state
- `lib/visualization/interaction-handler.ts` - Mouse/touch events
- `hooks/useViewport.ts` - React hook for viewport

## Interaction Modes

```typescript
enum InteractionMode {
  PAN = 'pan',           // Default - click and drag to pan
  SELECT = 'select',     // Click to select nodes
  LASSO = 'lasso',       // Draw freeform selection
  BOX = 'box',          // Draw box selection
  ZOOM = 'zoom'         // Click to zoom in/out
}

interface InteractionConfig {
  mode: InteractionMode;
  multiSelect: boolean;  // Allow multiple selection
  zoomOnScroll: boolean;
  panOnDrag: boolean;
  selectOnClick: boolean;
  showTooltips: boolean;
}
```

## Acceptance Criteria

- [ ] Smooth zoom in/out with mouse wheel
- [ ] Pan by clicking and dragging
- [ ] Zoom controls buttons functional
- [ ] Fit-to-view centers all nodes
- [ ] Single click selects node
- [ ] Shift-click adds to selection
- [ ] Box selection with alt-drag
- [ ] Hit detection accurate for all node sizes
- [ ] Touch gestures working on mobile
- [ ] Keyboard shortcuts implemented

## Keyboard Shortcuts

- `+` / `-` : Zoom in/out
- `0` : Reset zoom
- `F` : Fit to view
- `Arrow keys` : Pan viewport
- `Ctrl+A` : Select all
- `Esc` : Clear selection
- `Delete` : Hide selected nodes
- `Space` : Toggle pan/select mode

## Performance Requirements

- Pan/zoom at 60 FPS
- Hit detection <10ms
- Selection update <50ms
- No lag with 3,000 nodes
- Smooth transitions

## Accessibility

- [ ] Keyboard navigation for all controls
- [ ] Focus indicators on buttons
- [ ] ARIA labels for controls
- [ ] Announce selection changes
- [ ] High contrast mode support

## Testing Requirements

- [ ] Test zoom limits (0.1x to 10x)
- [ ] Test pan boundaries
- [ ] Test selection accuracy
- [ ] Test multi-selection
- [ ] Test touch gestures
- [ ] Test keyboard shortcuts
- [ ] Test with 3,000 nodes
- [ ] Test on mobile devices

## Definition of Done

- [ ] Code complete and committed
- [ ] All interaction modes working
- [ ] Controls responsive and intuitive
- [ ] Performance targets met
- [ ] Accessibility requirements met
- [ ] Mobile gestures functional
- [ ] Tests written and passing
- [ ] Documentation complete
- [ ] Peer review completed