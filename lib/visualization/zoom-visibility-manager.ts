import { Node } from '@/components/taxonomy/D3Visualization/ForceSimulation';

export interface VisibilityConfig {
  mainCategoryDepth: number;
  subcategoryDepth: number;
  productDepth: number;

  zoomThresholds: {
    subcategory: number;
    product: number;
  };

  fadeRanges: {
    subcategory: [number, number];
    product: [number, number];
  };
}

export interface ViewportInfo {
  x: number;
  y: number;
  width: number;
  height: number;
  zoom: number;
}

export class ZoomVisibilityManager {
  private config: VisibilityConfig;
  private showProducts: boolean = false;
  private currentZoom: number = 1;
  private visibilityCache: Map<string, number> = new Map();
  private viewport: ViewportInfo | null = null;
  private nodePositions: Map<string, { x: number; y: number }> = new Map();
  private nodeRelationships: Map<string, { parent?: string; children: string[] }> = new Map();
  private focusedNodes: Set<string> = new Set();
  private focusedBranch: Set<string> = new Set(); // All nodes in focused branch
  private focusMode: boolean = false;
  private manualFocusMode: boolean = false; // Manual override for focus mode

  constructor(config?: Partial<VisibilityConfig>) {
    this.config = {
      mainCategoryDepth: 1,
      subcategoryDepth: 10, // Support many levels of subcategories
      productDepth: 15, // Products can be very deep

      zoomThresholds: {
        subcategory: 2.0,
        product: 4.0,
      },

      fadeRanges: {
        subcategory: [1.8, 2.5],
        product: [3.5, 5.0],
      },

      ...config,
    };
  }

  setZoomLevel(zoom: number) {
    this.currentZoom = zoom;
    this.visibilityCache.clear();
  }

  setFocusMode(enabled: boolean) {
    this.manualFocusMode = enabled;
    this.focusMode = enabled;
    this.visibilityCache.clear();

    // If manually enabling focus mode, build focus for current viewport
    if (enabled && this.nodePositions.size > 0) {
      const nodes = Array.from(this.nodePositions.entries()).map(([id, pos]) => ({
        id,
        x: pos.x,
        y: pos.y,
      })) as Node[];
      this.updateFocusedNodes(nodes);
    }
  }

  updateViewport(viewport: ViewportInfo) {
    this.viewport = viewport;
    this.visibilityCache.clear();
  }

  updateNodePositions(nodes: Node[]) {
    this.nodePositions.clear();
    nodes.forEach((node) => {
      if (node.x !== undefined && node.y !== undefined) {
        this.nodePositions.set(node.id, { x: node.x, y: node.y });
      }
    });

    // Update focused nodes based on viewport and zoom
    this.updateFocusedNodes(nodes);
  }

  setNodeRelationships(relationships: Map<string, { parent?: string; children: string[] }>) {
    this.nodeRelationships = relationships;
  }

  private updateFocusedNodes(nodes: Node[]) {
    this.focusedNodes.clear();
    this.focusedBranch.clear();

    // If manual focus mode is on, always use focus mode
    if (this.manualFocusMode) {
      this.focusMode = true;
    } else if (!this.viewport || this.currentZoom < 1.5) {
      this.focusMode = false;
      return;
    }

    // Find the most central node in viewport
    const viewportCenterX = this.viewport.x + this.viewport.width / 2;
    const viewportCenterY = this.viewport.y + this.viewport.height / 2;
    let closestNode: Node | null = null;
    let minDistance = Infinity;

    // Determine focus depth based on zoom level
    const focusDepth = Math.floor(this.currentZoom / 2); // Higher zoom = deeper focus

    nodes.forEach((node) => {
      if (!node.x || !node.y) return;
      const depth = node.depth || 0;

      // Only consider nodes at appropriate depth for current zoom
      if (depth <= focusDepth && node.x && node.y) {
        const distance = Math.sqrt(
          Math.pow(node.x - viewportCenterX, 2) + Math.pow(node.y - viewportCenterY, 2)
        );

        if (distance < minDistance) {
          minDistance = distance;
          closestNode = node;
        }
      }
    });

    // If we found a focus node and zoom is high enough (or manual mode), enable focus mode
    if (
      closestNode &&
      closestNode.id &&
      (this.manualFocusMode || minDistance < 100 / this.currentZoom)
    ) {
      this.focusMode = true;
      this.buildFocusedBranch(closestNode.id);
    } else if (!this.manualFocusMode) {
      this.focusMode = false;
    }
  }

  private buildFocusedBranch(nodeId: string) {
    // Add the focused node
    this.focusedBranch.add(nodeId);
    this.focusedNodes.add(nodeId);

    // Add all ancestors
    let currentId = nodeId;
    while (currentId) {
      const rel = this.nodeRelationships.get(currentId);
      if (rel && rel.parent) {
        this.focusedBranch.add(rel.parent);
        currentId = rel.parent;
      } else {
        break;
      }
    }

    // Add all descendants recursively
    const addDescendants = (id: string) => {
      const rel = this.nodeRelationships.get(id);
      if (rel && rel.children) {
        rel.children.forEach((childId) => {
          this.focusedBranch.add(childId);
          addDescendants(childId);
        });
      }
    };
    addDescendants(nodeId);
  }

  private hasParentInFocus(nodeId: string): boolean {
    const relationship = this.nodeRelationships.get(nodeId);
    if (!relationship || !relationship.parent) return false;

    return this.focusedNodes.has(relationship.parent);
  }

  private isNodeInViewport(node: Node): boolean {
    if (!this.viewport || !node.x || !node.y) return true;

    const margin = 100; // Add margin around viewport
    return (
      node.x >= this.viewport.x - margin &&
      node.x <= this.viewport.x + this.viewport.width + margin &&
      node.y >= this.viewport.y - margin &&
      node.y <= this.viewport.y + this.viewport.height + margin
    );
  }

  toggleProducts(show?: boolean) {
    this.showProducts = show !== undefined ? show : !this.showProducts;
    this.visibilityCache.clear();
  }

  isProductsEnabled(): boolean {
    return this.showProducts;
  }

  getNodeVisibility(node: Node): number {
    if (this.visibilityCache.has(node.id)) {
      return this.visibilityCache.get(node.id)!;
    }

    const depth = node.depth || 0;
    let opacity = 1;

    // Focus mode: fade out nodes not in focused branch
    if (this.focusMode && !this.focusedBranch.has(node.id)) {
      opacity = 0.1; // Very faded for non-focused nodes
      this.visibilityCache.set(node.id, opacity);
      return opacity;
    }

    // Main categories - always visible
    if (depth <= this.config.mainCategoryDepth) {
      opacity = 1;
    }
    // Subcategories - show based on zoom level and focus
    else if (depth <= this.config.subcategoryDepth) {
      // Dynamic thresholds based on depth
      const depthOffset = (depth - 2) * 1.5; // Each level needs more zoom
      const minZoom = this.config.fadeRanges.subcategory[0] + depthOffset;
      const maxZoom = this.config.fadeRanges.subcategory[1] + depthOffset;

      if (!this.hasParentInFocus(node.id) || !this.isNodeInViewport(node)) {
        opacity = 0;
      } else if (this.currentZoom < minZoom) {
        opacity = 0;
      } else if (this.currentZoom < maxZoom) {
        const range = maxZoom - minZoom;
        const progress = (this.currentZoom - minZoom) / range;
        opacity = progress;
      } else {
        opacity = 1;
      }
    }
    // Products - only show if parent subcategory is focused
    else {
      // Must have products enabled, parent in focus, and be in viewport
      if (!this.showProducts || !this.hasParentInFocus(node.id) || !this.isNodeInViewport(node)) {
        opacity = 0;
      } else if (this.currentZoom < this.config.fadeRanges.product[0]) {
        opacity = 0;
      } else if (this.currentZoom < this.config.fadeRanges.product[1]) {
        const range = this.config.fadeRanges.product[1] - this.config.fadeRanges.product[0];
        const progress = (this.currentZoom - this.config.fadeRanges.product[0]) / range;
        opacity = progress * 0.8;
      } else {
        opacity = 0.8;
      }
    }

    this.visibilityCache.set(node.id, opacity);

    return opacity;
  }

  shouldRenderNode(node: Node): boolean {
    return this.getNodeVisibility(node) > 0.01;
  }

  getVisibleNodes(nodes: Node[]): Node[] {
    return nodes.filter((node) => this.shouldRenderNode(node));
  }

  getLabelVisibility(node: Node): number {
    const nodeOpacity = this.getNodeVisibility(node);
    const depth = node.depth || 0;

    // In focus mode, only show labels for focused branch
    if (this.focusMode && !this.focusedBranch.has(node.id)) {
      return 0;
    }

    // Dynamic label thresholds based on depth
    const labelZoomThreshold = 0.5 + depth * 0.5;

    if (this.currentZoom >= labelZoomThreshold) {
      return nodeOpacity;
    }
    return 0;
  }

  getEdgeVisibility(sourceNode: Node, targetNode: Node): number {
    const sourceVis = this.getNodeVisibility(sourceNode);
    const targetVis = this.getNodeVisibility(targetNode);

    return Math.min(sourceVis, targetVis) * 0.5;
  }
}
