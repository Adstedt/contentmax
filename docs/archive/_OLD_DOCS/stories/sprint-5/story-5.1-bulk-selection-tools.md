# Story 5.1: Bulk Selection Tools

## User Story

As a content manager handling multiple products,
I want powerful bulk selection tools in the visualization,
So that I can efficiently generate content for multiple items at once.

## Size & Priority

- **Size**: L (8 hours)
- **Priority**: P0 - Critical
- **Sprint**: 5
- **Dependencies**: Task 3.1 (D3 visualization complete)

## Description

Implement comprehensive bulk selection tools in the D3 visualization including lasso selection, shift-click multi-select, select all within cluster, and smart selection based on various criteria.

## Implementation Steps

1. **Lasso selection tool**

   ```typescript
   class LassoSelectionTool {
     private svg: d3.Selection<SVGGElement, unknown, null, undefined>;
     private points: [number, number][] = [];
     private line: d3.Line<[number, number]>;
     private lassoPath: d3.Selection<SVGPathElement, unknown, null, undefined> | null = null;
     private isActive = false;

     constructor(svg: d3.Selection<SVGGElement, unknown, null, undefined>) {
       this.svg = svg;
       this.line = d3
         .line<[number, number]>()
         .x((d) => d[0])
         .y((d) => d[1])
         .curve(d3.curveBasisClosed);

       this.initializeLasso();
     }

     private initializeLasso() {
       // Add lasso layer
       this.svg.append('g').attr('class', 'lasso-layer').style('pointer-events', 'none');

       // Mouse event handlers
       this.svg.on('mousedown', (event) => this.handleMouseDown(event));
       this.svg.on('mousemove', (event) => this.handleMouseMove(event));
       this.svg.on('mouseup', () => this.handleMouseUp());
     }

     private handleMouseDown(event: MouseEvent) {
       if (!event.shiftKey && !event.ctrlKey) return;

       this.isActive = true;
       this.points = [];
       const [x, y] = d3.pointer(event);
       this.points.push([x, y]);

       // Create lasso path
       const lassoLayer = this.svg.select('.lasso-layer');
       this.lassoPath = lassoLayer
         .append('path')
         .attr('class', 'lasso')
         .style('fill', 'rgba(59, 130, 246, 0.1)')
         .style('stroke', '#3b82f6')
         .style('stroke-width', 2)
         .style('stroke-dasharray', '5,5');
     }

     private handleMouseMove(event: MouseEvent) {
       if (!this.isActive || !this.lassoPath) return;

       const [x, y] = d3.pointer(event);
       this.points.push([x, y]);

       // Update lasso path
       this.lassoPath.attr('d', this.line(this.points));
     }

     private handleMouseUp() {
       if (!this.isActive) return;

       this.isActive = false;
       const selectedNodes = this.getNodesInLasso();

       // Trigger selection event
       this.svg.dispatch('lassoend', {
         detail: { nodes: selectedNodes },
       });

       // Clean up lasso
       if (this.lassoPath) {
         this.lassoPath.remove();
         this.lassoPath = null;
       }
       this.points = [];
     }

     private getNodesInLasso(): string[] {
       if (this.points.length < 3) return [];

       const selectedIds: string[] = [];
       const nodes = this.svg.selectAll<SVGCircleElement, TaxonomyNode>('.node');

       nodes.each((d, i, nodes) => {
         const element = nodes[i];
         const x = +element.getAttribute('cx')!;
         const y = +element.getAttribute('cy')!;

         if (this.isPointInPolygon([x, y], this.points)) {
           selectedIds.push(d.id);
         }
       });

       return selectedIds;
     }

     private isPointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
       const [x, y] = point;
       let inside = false;

       for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
         const [xi, yi] = polygon[i];
         const [xj, yj] = polygon[j];

         const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;

         if (intersect) inside = !inside;
       }

       return inside;
     }
   }
   ```

2. **Multi-select manager**

   ```typescript
   class SelectionManager {
     private selectedNodes = new Set<string>();
     private lastSelectedNode: string | null = null;
     private visualization: TaxonomyVisualization;

     constructor(visualization: TaxonomyVisualization) {
       this.visualization = visualization;
       this.initializeEventHandlers();
     }

     private initializeEventHandlers() {
       // Node click handler
       this.visualization.on('nodeclick', (event: CustomEvent) => {
         const { node, ctrlKey, shiftKey } = event.detail;

         if (ctrlKey) {
           // Toggle selection
           this.toggleNode(node.id);
         } else if (shiftKey && this.lastSelectedNode) {
           // Range selection
           this.selectRange(this.lastSelectedNode, node.id);
         } else {
           // Single selection
           this.selectSingle(node.id);
         }

         this.lastSelectedNode = node.id;
         this.updateVisualization();
       });

       // Lasso selection
       this.visualization.on('lassoend', (event: CustomEvent) => {
         const { nodes } = event.detail;
         this.addNodes(nodes);
         this.updateVisualization();
       });
     }

     selectSingle(nodeId: string) {
       this.selectedNodes.clear();
       this.selectedNodes.add(nodeId);
     }

     toggleNode(nodeId: string) {
       if (this.selectedNodes.has(nodeId)) {
         this.selectedNodes.delete(nodeId);
       } else {
         this.selectedNodes.add(nodeId);
       }
     }

     addNodes(nodeIds: string[]) {
       nodeIds.forEach((id) => this.selectedNodes.add(id));
     }

     removeNodes(nodeIds: string[]) {
       nodeIds.forEach((id) => this.selectedNodes.delete(id));
     }

     selectRange(fromId: string, toId: string) {
       const path = this.visualization.findShortestPath(fromId, toId);
       path.forEach((nodeId) => this.selectedNodes.add(nodeId));
     }

     selectAll() {
       const allNodes = this.visualization.getAllNodes();
       allNodes.forEach((node) => this.selectedNodes.add(node.id));
       this.updateVisualization();
     }

     clearSelection() {
       this.selectedNodes.clear();
       this.updateVisualization();
     }

     selectCluster(clusterId: string) {
       const clusterNodes = this.visualization.getNodesInCluster(clusterId);
       clusterNodes.forEach((node) => this.selectedNodes.add(node.id));
       this.updateVisualization();
     }

     selectByAttribute(attribute: string, value: any) {
       const matchingNodes = this.visualization.getNodesWhere((node) => node[attribute] === value);
       matchingNodes.forEach((node) => this.selectedNodes.add(node.id));
       this.updateVisualization();
     }

     getSelectedNodes(): string[] {
       return Array.from(this.selectedNodes);
     }

     getSelectedCount(): number {
       return this.selectedNodes.size;
     }

     private updateVisualization() {
       // Update node appearance
       this.visualization.updateNodeStyles((node) => ({
         selected: this.selectedNodes.has(node.id),
         opacity: this.selectedNodes.size === 0 ? 1 : this.selectedNodes.has(node.id) ? 1 : 0.3,
       }));

       // Emit selection change event
       this.visualization.dispatch('selectionchange', {
         detail: {
           selected: this.getSelectedNodes(),
           count: this.getSelectedCount(),
         },
       });
     }
   }
   ```

3. **Smart selection filters**

   ```typescript
   interface SelectionFilter {
     id: string;
     name: string;
     description: string;
     icon: string;
     filter: (node: TaxonomyNode) => boolean;
   }

   class SmartSelectionFilters {
     private filters: SelectionFilter[] = [
       {
         id: 'no-content',
         name: 'No Content',
         description: 'Select items without generated content',
         icon: 'document-x',
         filter: (node) => !node.hasContent,
       },
       {
         id: 'high-priority',
         name: 'High Priority',
         description: 'Select high-traffic items',
         icon: 'star',
         filter: (node) => node.searchVolume > 1000,
       },
       {
         id: 'competitor-gap',
         name: 'Competitor Gap',
         description: 'Items where competitors have content',
         icon: 'target',
         filter: (node) => node.competitorCount > 0 && !node.hasContent,
       },
       {
         id: 'trending',
         name: 'Trending',
         description: 'Recently popular items',
         icon: 'trending-up',
         filter: (node) => node.trendScore > 0.7,
       },
       {
         id: 'seasonal',
         name: 'Seasonal',
         description: 'Season-specific items',
         icon: 'calendar',
         filter: (node) => node.seasonality !== null,
       },
       {
         id: 'conversion-ready',
         name: 'Conversion Ready',
         description: 'Items with high conversion potential',
         icon: 'shopping-cart',
         filter: (node) => node.conversionScore > 0.8,
       },
       {
         id: 'seo-opportunity',
         name: 'SEO Opportunity',
         description: 'Low competition, high volume',
         icon: 'search',
         filter: (node) => node.difficulty < 30 && node.searchVolume > 500,
       },
       {
         id: 'brand-pages',
         name: 'Brand Pages',
         description: 'Select all brand pages',
         icon: 'building',
         filter: (node) => node.type === 'brand',
       },
       {
         id: 'categories',
         name: 'Categories',
         description: 'Select all category pages',
         icon: 'folder',
         filter: (node) => node.type === 'category',
       },
       {
         id: 'products',
         name: 'Products',
         description: 'Select all product pages',
         icon: 'box',
         filter: (node) => node.type === 'product',
       },
     ];

     constructor(private selectionManager: SelectionManager) {}

     getFilters(): SelectionFilter[] {
       return this.filters;
     }

     applyFilter(filterId: string, additive = false) {
       const filter = this.filters.find((f) => f.id === filterId);
       if (!filter) return;

       const matchingNodes = this.getMatchingNodes(filter.filter);

       if (additive) {
         this.selectionManager.addNodes(matchingNodes);
       } else {
         this.selectionManager.clearSelection();
         this.selectionManager.addNodes(matchingNodes);
       }
     }

     applyMultipleFilters(filterIds: string[], operator: 'AND' | 'OR' = 'OR') {
       const filters = filterIds
         .map((id) => this.filters.find((f) => f.id === id))
         .filter(Boolean) as SelectionFilter[];

       if (filters.length === 0) return;

       const matchingNodes = this.getMatchingNodesMultiple(filters, operator);
       this.selectionManager.clearSelection();
       this.selectionManager.addNodes(matchingNodes);
     }

     private getMatchingNodes(filter: (node: TaxonomyNode) => boolean): string[] {
       const nodes = this.visualization.getAllNodes();
       return nodes.filter(filter).map((n) => n.id);
     }

     private getMatchingNodesMultiple(
       filters: SelectionFilter[],
       operator: 'AND' | 'OR'
     ): string[] {
       const nodes = this.visualization.getAllNodes();

       return nodes
         .filter((node) => {
           const results = filters.map((f) => f.filter(node));
           return operator === 'AND' ? results.every((r) => r) : results.some((r) => r);
         })
         .map((n) => n.id);
     }
   }
   ```

4. **Selection UI controls**

   ```tsx
   interface BulkSelectionControlsProps {
     visualization: TaxonomyVisualization;
     onSelectionChange: (selected: string[]) => void;
   }

   const BulkSelectionControls: React.FC<BulkSelectionControlsProps> = ({
     visualization,
     onSelectionChange,
   }) => {
     const [selectedCount, setSelectedCount] = useState(0);
     const [filters, setFilters] = useState<SelectionFilter[]>([]);
     const [activeFilters, setActiveFilters] = useState<string[]>([]);
     const selectionManager = useRef<SelectionManager>();
     const smartFilters = useRef<SmartSelectionFilters>();

     useEffect(() => {
       selectionManager.current = new SelectionManager(visualization);
       smartFilters.current = new SmartSelectionFilters(selectionManager.current);
       setFilters(smartFilters.current.getFilters());

       // Listen for selection changes
       visualization.on('selectionchange', (event: CustomEvent) => {
         setSelectedCount(event.detail.count);
         onSelectionChange(event.detail.selected);
       });
     }, [visualization]);

     const handleSelectAll = () => {
       selectionManager.current?.selectAll();
     };

     const handleClearSelection = () => {
       selectionManager.current?.clearSelection();
     };

     const handleFilterToggle = (filterId: string) => {
       const isActive = activeFilters.includes(filterId);

       if (isActive) {
         setActiveFilters(activeFilters.filter((f) => f !== filterId));
       } else {
         setActiveFilters([...activeFilters, filterId]);
       }

       // Apply filters
       if (activeFilters.length > 0) {
         smartFilters.current?.applyMultipleFilters(
           isActive ? activeFilters.filter((f) => f !== filterId) : [...activeFilters, filterId],
           'OR'
         );
       }
     };

     return (
       <div className="bulk-selection-controls">
         <div className="selection-header">
           <h3>Selection Tools</h3>
           <span className="selection-count">{selectedCount} items selected</span>
         </div>

         <div className="selection-actions">
           <button onClick={handleSelectAll} className="btn btn-secondary">
             Select All
           </button>
           <button onClick={handleClearSelection} className="btn btn-secondary">
             Clear Selection
           </button>
           <button className="btn btn-secondary">Invert Selection</button>
         </div>

         <div className="selection-tips">
           <p>Tips:</p>
           <ul>
             <li>Hold Shift and drag to lasso select</li>
             <li>Ctrl+Click to add/remove individual items</li>
             <li>Shift+Click to select range</li>
             <li>Double-click cluster to select all items in it</li>
           </ul>
         </div>

         <div className="smart-filters">
           <h4>Smart Filters</h4>
           <div className="filter-grid">
             {filters.map((filter) => (
               <button
                 key={filter.id}
                 className={`filter-btn ${activeFilters.includes(filter.id) ? 'active' : ''}`}
                 onClick={() => handleFilterToggle(filter.id)}
                 title={filter.description}
               >
                 <span className="filter-icon">{filter.icon}</span>
                 <span className="filter-name">{filter.name}</span>
               </button>
             ))}
           </div>
         </div>

         {selectedCount > 0 && (
           <div className="selection-summary">
             <h4>Selection Summary</h4>
             <div className="summary-stats">
               <div className="stat">
                 <span>Total Search Volume:</span>
                 <span>{calculateTotalVolume(selected)}</span>
               </div>
               <div className="stat">
                 <span>Avg. Difficulty:</span>
                 <span>{calculateAvgDifficulty(selected)}</span>
               </div>
               <div className="stat">
                 <span>Est. Generation Time:</span>
                 <span>{estimateGenerationTime(selected)}</span>
               </div>
             </div>
           </div>
         )}
       </div>
     );
   };
   ```

5. **Keyboard shortcuts**

   ```typescript
   class SelectionKeyboardShortcuts {
     private shortcuts: Map<string, () => void> = new Map();

     constructor(
       private selectionManager: SelectionManager,
       private visualization: TaxonomyVisualization
     ) {
       this.registerShortcuts();
       this.attachEventListeners();
     }

     private registerShortcuts() {
       // Ctrl+A: Select all
       this.shortcuts.set('ctrl+a', () => {
         this.selectionManager.selectAll();
       });

       // Ctrl+Shift+A: Clear selection
       this.shortcuts.set('ctrl+shift+a', () => {
         this.selectionManager.clearSelection();
       });

       // Ctrl+I: Invert selection
       this.shortcuts.set('ctrl+i', () => {
         this.invertSelection();
       });

       // Delete: Remove selected from view
       this.shortcuts.set('delete', () => {
         this.removeSelectedFromView();
       });

       // Ctrl+G: Group selected
       this.shortcuts.set('ctrl+g', () => {
         this.groupSelected();
       });

       // Ctrl+E: Expand selection
       this.shortcuts.set('ctrl+e', () => {
         this.expandSelection();
       });

       // Ctrl+Shift+C: Select cluster
       this.shortcuts.set('ctrl+shift+c', () => {
         this.selectCurrentCluster();
       });
     }

     private attachEventListeners() {
       document.addEventListener('keydown', (event) => {
         const key = this.getShortcutKey(event);
         const handler = this.shortcuts.get(key);

         if (handler) {
           event.preventDefault();
           handler();
         }
       });
     }

     private getShortcutKey(event: KeyboardEvent): string {
       const parts = [];
       if (event.ctrlKey || event.metaKey) parts.push('ctrl');
       if (event.shiftKey) parts.push('shift');
       if (event.altKey) parts.push('alt');
       parts.push(event.key.toLowerCase());
       return parts.join('+');
     }

     private invertSelection() {
       const allNodes = this.visualization.getAllNodes();
       const selected = this.selectionManager.getSelectedNodes();
       const inverted = allNodes.filter((n) => !selected.includes(n.id)).map((n) => n.id);

       this.selectionManager.clearSelection();
       this.selectionManager.addNodes(inverted);
     }

     private expandSelection() {
       // Select neighbors of currently selected nodes
       const selected = this.selectionManager.getSelectedNodes();
       const neighbors = new Set<string>();

       selected.forEach((nodeId) => {
         const nodeNeighbors = this.visualization.getNeighbors(nodeId);
         nodeNeighbors.forEach((n) => neighbors.add(n));
       });

       this.selectionManager.addNodes(Array.from(neighbors));
     }

     private selectCurrentCluster() {
       const selected = this.selectionManager.getSelectedNodes();
       if (selected.length === 0) return;

       const firstNode = this.visualization.getNode(selected[0]);
       if (firstNode?.clusterId) {
         this.selectionManager.selectCluster(firstNode.clusterId);
       }
     }

     private groupSelected() {
       const selected = this.selectionManager.getSelectedNodes();
       if (selected.length < 2) return;

       this.visualization.createTemporaryGroup(selected);
     }

     private removeSelectedFromView() {
       const selected = this.selectionManager.getSelectedNodes();
       this.visualization.hideNodes(selected);
       this.selectionManager.clearSelection();
     }
   }
   ```

## Files to Create

- `lib/visualization/selection/LassoSelectionTool.ts` - Lasso selection implementation
- `lib/visualization/selection/SelectionManager.ts` - Central selection management
- `lib/visualization/selection/SmartSelectionFilters.ts` - Pre-defined filters
- `lib/visualization/selection/SelectionKeyboardShortcuts.ts` - Keyboard controls
- `components/visualization/BulkSelectionControls.tsx` - Selection UI
- `components/visualization/SelectionSummary.tsx` - Selection statistics
- `hooks/useSelection.ts` - React hook for selection
- `types/selection.types.ts` - Selection TypeScript types

## Acceptance Criteria

- [ ] Lasso selection tool working with shift+drag
- [ ] Multi-select with Ctrl+Click functional
- [ ] Range selection with Shift+Click
- [ ] Select all within cluster on double-click
- [ ] Smart filters for common selections
- [ ] Keyboard shortcuts implemented
- [ ] Selection count and summary displayed
- [ ] Selection persists across view changes
- [ ] Performance with 3,000 nodes selected

## Performance Targets

- Lasso selection: < 50ms for 3,000 nodes
- Filter application: < 100ms
- Selection update: < 16ms (60fps)
- Multi-select: No lag with 1,000+ items

## Testing Requirements

- [ ] Test lasso selection accuracy
- [ ] Test multi-select combinations
- [ ] Test filter logic correctness
- [ ] Test keyboard shortcuts
- [ ] Test performance with max nodes
- [ ] Test selection persistence
- [ ] Test undo/redo functionality
- [ ] Cross-browser compatibility

## Definition of Done

- [ ] Code complete and committed
- [ ] All selection methods working
- [ ] Smart filters functional
- [ ] Keyboard shortcuts active
- [ ] UI controls responsive
- [ ] Performance targets met
- [ ] Tests written and passing
- [ ] Documentation updated
- [ ] Peer review completed
