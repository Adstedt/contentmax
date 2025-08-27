# Story 3.3: Node Clustering & Level of Detail

## User Story
As a user viewing a large taxonomy,
I want dense areas to be intelligently clustered,
So that I can navigate complex hierarchies without visual clutter.

## Size & Priority
- **Size**: M (6 hours)
- **Priority**: P1 - High
- **Sprint**: 3
- **Dependencies**: Task 3.1

## Description
Implement clustering for dense node areas and level-of-detail rendering to maintain performance and readability at different zoom levels.

## Implementation Steps

1. **Clustering algorithm**
   ```typescript
   interface Cluster {
     id: string;
     nodes: Node[];
     x: number;
     y: number;
     radius: number;
     count: number;
     representative: Node; // Most important node in cluster
   }
   
   class NodeClusterer {
     private clusters: Map<string, Cluster> = new Map();
     
     clusterNodes(
       nodes: Node[], 
       zoom: number, 
       viewport: Viewport
     ): (Node | Cluster)[] {
       // Clear previous clusters
       this.clusters.clear();
       
       // Calculate clustering threshold based on zoom
       const threshold = this.calculateThreshold(zoom);
       
       // Build spatial index
       const quadtree = d3.quadtree<Node>()
         .x(d => d.x!)
         .y(d => d.y!)
         .addAll(nodes);
       
       const clustered = new Set<string>();
       const result: (Node | Cluster)[] = [];
       
       nodes.forEach(node => {
         if (clustered.has(node.id)) return;
         
         // Find nearby nodes
         const nearby = this.findNearbyNodes(quadtree, node, threshold);
         
         if (nearby.length > 1) {
           // Create cluster
           const cluster = this.createCluster(nearby);
           this.clusters.set(cluster.id, cluster);
           result.push(cluster);
           nearby.forEach(n => clustered.add(n.id));
         } else {
           // Keep as individual node
           result.push(node);
         }
       });
       
       return result;
     }
     
     private calculateThreshold(zoom: number): number {
       // Larger threshold at lower zoom levels
       return Math.max(20, 100 / zoom);
     }
     
     private createCluster(nodes: Node[]): Cluster {
       const centerX = d3.mean(nodes, d => d.x!) || 0;
       const centerY = d3.mean(nodes, d => d.y!) || 0;
       const maxRadius = d3.max(nodes, d => d.radius) || 10;
       
       return {
         id: `cluster-${nodes.map(n => n.id).join('-')}`,
         nodes,
         x: centerX,
         y: centerY,
         radius: Math.sqrt(nodes.length) * 10, // Size based on count
         count: nodes.length,
         representative: nodes.reduce((a, b) => 
           (a.metadata?.importance || 0) > (b.metadata?.importance || 0) ? a : b
         )
       };
     }
   }
   ```

2. **Level of Detail (LOD) rendering**
   ```typescript
   enum DetailLevel {
     MINIMAL = 0,    // Just dots
     BASIC = 1,      // Dots with colors
     STANDARD = 2,   // Add labels for large nodes
     DETAILED = 3,   // All labels and icons
     FULL = 4        // Everything including metadata
   }
   
   class LODRenderer {
     private detailLevel: DetailLevel = DetailLevel.STANDARD;
     
     determineDetailLevel(zoom: number, nodeCount: number): DetailLevel {
       if (zoom < 0.3) return DetailLevel.MINIMAL;
       if (zoom < 0.6) return DetailLevel.BASIC;
       if (zoom < 1.5) return DetailLevel.STANDARD;
       if (zoom < 3.0) return DetailLevel.DETAILED;
       return DetailLevel.FULL;
     }
     
     renderNode(
       ctx: CanvasRenderingContext2D,
       node: Node,
       detailLevel: DetailLevel,
       transform: Transform
     ) {
       const screenRadius = node.radius * transform.k;
       
       // Always render the circle
       ctx.beginPath();
       ctx.arc(node.x!, node.y!, node.radius, 0, 2 * Math.PI);
       
       if (detailLevel >= DetailLevel.BASIC) {
         // Add color based on status
         ctx.fillStyle = this.getNodeColor(node);
         ctx.fill();
         
         if (detailLevel >= DetailLevel.STANDARD && screenRadius > 15) {
           // Add label for larger nodes
           this.renderLabel(ctx, node, transform);
           
           if (detailLevel >= DetailLevel.DETAILED) {
             // Add icon
             this.renderIcon(ctx, node);
             
             if (detailLevel >= DetailLevel.FULL) {
               // Add metadata badges
               this.renderMetadata(ctx, node);
             }
           }
         }
       } else {
         // Minimal rendering - just outline
         ctx.strokeStyle = '#ccc';
         ctx.stroke();
       }
     }
     
     renderCluster(
       ctx: CanvasRenderingContext2D,
       cluster: Cluster,
       detailLevel: DetailLevel
     ) {
       // Cluster visualization
       ctx.beginPath();
       ctx.arc(cluster.x, cluster.y, cluster.radius, 0, 2 * Math.PI);
       
       // Gradient fill to show it's a cluster
       const gradient = ctx.createRadialGradient(
         cluster.x, cluster.y, 0,
         cluster.x, cluster.y, cluster.radius
       );
       gradient.addColorStop(0, 'rgba(59, 130, 246, 0.6)');
       gradient.addColorStop(1, 'rgba(59, 130, 246, 0.1)');
       ctx.fillStyle = gradient;
       ctx.fill();
       
       // Show count
       if (detailLevel >= DetailLevel.BASIC) {
         ctx.fillStyle = '#1e40af';
         ctx.font = 'bold 14px sans-serif';
         ctx.textAlign = 'center';
         ctx.fillText(cluster.count.toString(), cluster.x, cluster.y);
       }
     }
   }
   ```

3. **Adaptive rendering pipeline**
   ```typescript
   class AdaptiveRenderer {
     private clusterer: NodeClusterer;
     private lodRenderer: LODRenderer;
     private frameTime = 16; // Target 60 FPS
     
     render(
       ctx: CanvasRenderingContext2D,
       nodes: Node[],
       links: Link[],
       viewport: Viewport
     ) {
       const startTime = performance.now();
       
       // Determine detail level based on zoom and performance
       const detailLevel = this.lodRenderer.determineDetailLevel(
         viewport.zoom,
         nodes.length
       );
       
       // Cluster if needed
       let renderables = nodes;
       if (viewport.zoom < 0.5 && nodes.length > 500) {
         renderables = this.clusterer.clusterNodes(
           nodes,
           viewport.zoom,
           viewport
         );
       }
       
       // Cull off-screen elements
       const visible = this.cullOffScreen(renderables, viewport);
       
       // Render in order of importance
       const sorted = this.sortByImportance(visible);
       
       // Render with appropriate detail
       sorted.forEach(item => {
         if (this.isCluster(item)) {
           this.lodRenderer.renderCluster(ctx, item as Cluster, detailLevel);
         } else {
           this.lodRenderer.renderNode(ctx, item as Node, detailLevel, viewport.transform);
         }
         
         // Check frame budget
         if (performance.now() - startTime > this.frameTime * 0.8) {
           // Running out of time, reduce detail for remaining items
           detailLevel = Math.max(DetailLevel.MINIMAL, detailLevel - 1);
         }
       });
     }
     
     private cullOffScreen(items: any[], viewport: Viewport): any[] {
       const padding = 100; // Keep items slightly off-screen
       return items.filter(item => {
         const x = item.x * viewport.transform.k + viewport.transform.x;
         const y = item.y * viewport.transform.k + viewport.transform.y;
         const r = (item.radius || 10) * viewport.transform.k;
         
         return x + r > -padding &&
                x - r < viewport.width + padding &&
                y + r > -padding &&
                y - r < viewport.height + padding;
       });
     }
   }
   ```

4. **Cluster interaction**
   ```typescript
   class ClusterInteraction {
     expandCluster(cluster: Cluster, animated = true) {
       if (animated) {
         // Animate expansion
         const duration = 300;
         const startPositions = cluster.nodes.map(n => ({ x: cluster.x, y: cluster.y }));
         
         d3.transition()
           .duration(duration)
           .tween('expand', () => {
             return (t: number) => {
               cluster.nodes.forEach((node, i) => {
                 node.x = startPositions[i].x + (node.targetX - startPositions[i].x) * t;
                 node.y = startPositions[i].y + (node.targetY - startPositions[i].y) * t;
               });
               this.renderer.requestRender();
             };
           });
       } else {
         // Instant expansion
         cluster.nodes.forEach(node => {
           node.x = node.targetX;
           node.y = node.targetY;
         });
       }
       
       // Remove cluster from render list
       this.clusters.delete(cluster.id);
     }
     
     collapseToCluster(nodes: Node[], animated = true) {
       const cluster = this.createCluster(nodes);
       
       if (animated) {
         // Animate collapse
         // Similar to expand but in reverse
       }
       
       this.clusters.set(cluster.id, cluster);
     }
   }
   ```

## Files to Create

- `lib/visualization/clustering.ts` - Clustering algorithm
- `lib/visualization/lod-renderer.ts` - Level of detail rendering
- `lib/visualization/adaptive-renderer.ts` - Adaptive rendering pipeline
- `lib/visualization/cluster-interaction.ts` - Cluster expand/collapse
- `lib/visualization/quadtree-manager.ts` - Spatial indexing
- `lib/visualization/viewport-culler.ts` - Off-screen culling
- `types/clustering.types.ts` - TypeScript interfaces

## Clustering Configuration

```typescript
interface ClusteringConfig {
  enabled: boolean;
  minZoomForClustering: number;  // Don't cluster above this zoom
  maxClusterRadius: number;       // Maximum cluster size in pixels
  minNodesForCluster: number;     // Minimum nodes to form cluster
  clusterByProperty?: string;     // Group by category, brand, etc.
  animateTransitions: boolean;
  
  // Visual settings
  clusterStyle: {
    fillColor: string;
    strokeColor: string;
    opacity: number;
    showCount: boolean;
    showPreview: boolean;  // Show mini nodes inside
  };
}
```

## Acceptance Criteria

- [ ] Dense areas automatically cluster at low zoom
- [ ] Clusters show node count clearly
- [ ] Clusters expand on zoom in or click
- [ ] Detail level adjusts with zoom
- [ ] Labels only shown when readable
- [ ] Off-screen nodes not rendered
- [ ] Performance maintained with clustering
- [ ] Smooth transitions between cluster states

## Performance Metrics

- Clustering calculation: <50ms for 3,000 nodes
- LOD determination: <5ms
- Viewport culling: <10ms
- Maintain 30+ FPS with clustering
- Memory usage stable with LOD changes

## Visual Guidelines

### Cluster Appearance
- Semi-transparent circle with gradient
- Size proportional to node count
- Number badge in center
- Subtle pulsing animation on hover
- Different colors for different cluster types

### Detail Levels
- **Level 0**: Gray dots only
- **Level 1**: Colored dots by status
- **Level 2**: + Labels for nodes > 15px
- **Level 3**: + Icons and connection lines
- **Level 4**: + Metadata badges and tooltips

## Testing Requirements

- [ ] Test clustering with various densities
- [ ] Test LOD transitions at different zooms
- [ ] Test cluster expand/collapse
- [ ] Test performance with max nodes
- [ ] Test viewport culling accuracy
- [ ] Test interaction with clusters
- [ ] Test animation smoothness
- [ ] Test memory usage over time

## Definition of Done

- [ ] Code complete and committed
- [ ] Clustering algorithm working
- [ ] LOD rendering implemented
- [ ] Viewport culling functional
- [ ] Performance targets met
- [ ] Cluster interactions smooth
- [ ] Visual guidelines followed
- [ ] Tests written and passing
- [ ] Peer review completed