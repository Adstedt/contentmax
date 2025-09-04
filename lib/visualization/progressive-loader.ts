import { Node, Link } from '@/components/taxonomy/D3Visualization/ForceSimulation';

export type LoadingLevel = 'core' | 'viewport' | 'connected' | 'all';

export interface ProgressiveLoaderConfig {
  coreNodeLimit: number;
  viewportNodeLimit: number;
  connectedNodeLimit: number;
  batchSize: number;
  frameInterval: number;
  minZoomForDetails: number;
}

export interface LoadingProgress {
  level: LoadingLevel;
  loaded: number;
  total: number;
  percentage: number;
  isComplete: boolean;
}

export interface ViewportBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  zoom: number;
}

export class ProgressiveLoader {
  private allNodes: Node[] = [];
  private allLinks: Link[] = [];
  private visibleNodes: Map<string, Node> = new Map();
  private visibleLinks: Link[] = [];
  private loadingLevel: LoadingLevel = 'core';
  private config: ProgressiveLoaderConfig;
  private loadingQueue: Node[] = [];
  private isLoading: boolean = false;
  private animationFrame: number | null = null;
  private lastFrameTime: number = 0;
  private onProgressCallback?: (progress: LoadingProgress) => void;
  private onNodesUpdateCallback?: (nodes: Node[], links: Link[]) => void;
  private viewport: ViewportBounds | null = null;
  private nodeImportance: Map<string, number> = new Map();

  constructor(config?: Partial<ProgressiveLoaderConfig>) {
    this.config = {
      coreNodeLimit: 100,
      viewportNodeLimit: 500,
      connectedNodeLimit: 1000,
      batchSize: 20,
      frameInterval: 16, // Target 60 FPS
      minZoomForDetails: 0.5,
      ...config,
    };
  }

  initialize(nodes: Node[], links: Link[]) {
    this.allNodes = nodes;
    this.allLinks = links;
    this.visibleNodes.clear();
    this.visibleLinks = [];

    // Calculate node importance based on connections and metrics
    this.calculateNodeImportance();

    // Sort nodes by importance for progressive loading
    this.allNodes.sort((a, b) => {
      const importanceA = this.nodeImportance.get(a.id) || 0;
      const importanceB = this.nodeImportance.get(b.id) || 0;
      return importanceB - importanceA;
    });

    // Start with core nodes
    this.loadCoreNodes();
  }

  private calculateNodeImportance() {
    // Calculate connection count for each node
    const connectionCount = new Map<string, number>();

    this.allLinks.forEach((link) => {
      const sourceId = typeof link.source === 'string' ? link.source : (link.source as Node).id;
      const targetId = typeof link.target === 'string' ? link.target : (link.target as Node).id;

      connectionCount.set(sourceId, (connectionCount.get(sourceId) || 0) + 1);
      connectionCount.set(targetId, (connectionCount.get(targetId) || 0) + 1);
    });

    // Calculate importance score combining multiple metrics
    this.allNodes.forEach((node) => {
      const connections = connectionCount.get(node.id) || 0;
      const depthScore = node.depth ? 10 - Math.min(node.depth, 10) : 5;
      const metricScore = (node.skuCount || 0) * 0.1 + (node.traffic || 0) * 0.01;
      const statusScore = node.status === 'optimized' ? 10 : 5;

      const importance = connections * 2 + depthScore + metricScore + statusScore;
      this.nodeImportance.set(node.id, importance);
    });
  }

  private loadCoreNodes() {
    this.loadingLevel = 'core';
    const coreNodes = this.allNodes.slice(0, this.config.coreNodeLimit);

    coreNodes.forEach((node) => {
      this.visibleNodes.set(node.id, node);
    });

    // Load links between core nodes
    this.updateVisibleLinks();

    // Notify progress
    this.reportProgress();

    // Trigger update
    this.notifyNodesUpdate();
  }

  private updateVisibleLinks() {
    const visibleNodeIds = new Set(this.visibleNodes.keys());

    this.visibleLinks = this.allLinks.filter((link) => {
      const sourceId = typeof link.source === 'string' ? link.source : (link.source as Node).id;
      const targetId = typeof link.target === 'string' ? link.target : (link.target as Node).id;
      return visibleNodeIds.has(sourceId) && visibleNodeIds.has(targetId);
    });
  }

  loadViewportNodes(viewport: ViewportBounds) {
    this.viewport = viewport;

    if (this.loadingLevel === 'all') return;

    this.loadingLevel = 'viewport';

    // Cancel any ongoing loading
    this.stopLoading();

    // Find nodes within viewport bounds with padding
    const padding = 100;
    const expandedBounds: ViewportBounds = {
      x: viewport.x - padding,
      y: viewport.y - padding,
      width: viewport.width + padding * 2,
      height: viewport.height + padding * 2,
      zoom: viewport.zoom,
    };

    const viewportNodes: Node[] = [];

    this.allNodes.forEach((node) => {
      if (this.visibleNodes.has(node.id)) return;

      // Check if node would be in viewport (estimate position if not yet positioned)
      if (node.x !== undefined && node.y !== undefined) {
        if (this.isNodeInBounds(node, expandedBounds)) {
          viewportNodes.push(node);
        }
      } else {
        // For unpositioned nodes, add based on importance up to limit
        if (viewportNodes.length < this.config.viewportNodeLimit - this.visibleNodes.size) {
          viewportNodes.push(node);
        }
      }
    });

    // Start batch loading
    this.loadingQueue = viewportNodes.slice(
      0,
      this.config.viewportNodeLimit - this.visibleNodes.size
    );
    this.startBatchLoading();
  }

  private isNodeInBounds(node: Node, bounds: ViewportBounds): boolean {
    if (node.x === undefined || node.y === undefined) return false;

    return (
      node.x >= bounds.x &&
      node.x <= bounds.x + bounds.width &&
      node.y >= bounds.y &&
      node.y <= bounds.y + bounds.height
    );
  }

  loadConnectedNodes(sourceNodeId: string, depth: number = 1) {
    if (this.loadingLevel === 'all') return;

    this.loadingLevel = 'connected';

    // Cancel any ongoing loading
    this.stopLoading();

    const connectedNodes: Set<string> = new Set();
    const visited: Set<string> = new Set();
    const queue: Array<{ id: string; currentDepth: number }> = [
      { id: sourceNodeId, currentDepth: 0 },
    ];

    while (queue.length > 0) {
      const { id, currentDepth } = queue.shift()!;

      if (visited.has(id) || currentDepth > depth) continue;
      visited.add(id);

      // Find connected nodes
      this.allLinks.forEach((link) => {
        const sourceId = typeof link.source === 'string' ? link.source : (link.source as Node).id;
        const targetId = typeof link.target === 'string' ? link.target : (link.target as Node).id;

        if (sourceId === id && !visited.has(targetId)) {
          connectedNodes.add(targetId);
          if (currentDepth < depth) {
            queue.push({ id: targetId, currentDepth: currentDepth + 1 });
          }
        } else if (targetId === id && !visited.has(sourceId)) {
          connectedNodes.add(sourceId);
          if (currentDepth < depth) {
            queue.push({ id: sourceId, currentDepth: currentDepth + 1 });
          }
        }
      });
    }

    // Add connected nodes to loading queue
    const nodesToLoad: Node[] = [];
    connectedNodes.forEach((nodeId) => {
      if (!this.visibleNodes.has(nodeId)) {
        const node = this.allNodes.find((n) => n.id === nodeId);
        if (node) {
          nodesToLoad.push(node);
        }
      }
    });

    this.loadingQueue = nodesToLoad.slice(
      0,
      this.config.connectedNodeLimit - this.visibleNodes.size
    );
    this.startBatchLoading();
  }

  loadAllNodes() {
    if (this.loadingLevel === 'all' && this.visibleNodes.size === this.allNodes.length) {
      return;
    }

    this.loadingLevel = 'all';

    // Cancel any ongoing loading
    this.stopLoading();

    // Add all remaining nodes to queue
    const remainingNodes: Node[] = [];
    this.allNodes.forEach((node) => {
      if (!this.visibleNodes.has(node.id)) {
        remainingNodes.push(node);
      }
    });

    this.loadingQueue = remainingNodes;
    this.startBatchLoading();
  }

  private startBatchLoading() {
    if (this.isLoading || this.loadingQueue.length === 0) return;

    this.isLoading = true;
    this.lastFrameTime = performance.now();
    this.processBatch();
  }

  private processBatch() {
    const now = performance.now();
    const deltaTime = now - this.lastFrameTime;

    // Only process if enough time has passed (maintain frame rate)
    if (deltaTime >= this.config.frameInterval) {
      // Process a batch of nodes
      const batch = this.loadingQueue.splice(0, this.config.batchSize);

      batch.forEach((node) => {
        this.visibleNodes.set(node.id, node);
      });

      if (batch.length > 0) {
        // Update links for new nodes
        this.updateVisibleLinks();

        // Report progress
        this.reportProgress();

        // Notify update
        this.notifyNodesUpdate();
      }

      this.lastFrameTime = now;
    }

    // Continue loading if there are more nodes
    if (this.loadingQueue.length > 0) {
      this.animationFrame = requestAnimationFrame(() => this.processBatch());
    } else {
      this.isLoading = false;
      this.reportProgress();
    }
  }

  private stopLoading() {
    if (this.animationFrame !== null) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
    this.isLoading = false;
    this.loadingQueue = [];
  }

  private reportProgress() {
    if (!this.onProgressCallback) return;

    const progress: LoadingProgress = {
      level: this.loadingLevel,
      loaded: this.visibleNodes.size,
      total: this.allNodes.length,
      percentage: Math.round((this.visibleNodes.size / this.allNodes.length) * 100),
      isComplete: this.visibleNodes.size === this.allNodes.length,
    };

    this.onProgressCallback(progress);
  }

  private notifyNodesUpdate() {
    if (!this.onNodesUpdateCallback) return;

    const visibleNodesArray = Array.from(this.visibleNodes.values());
    this.onNodesUpdateCallback(visibleNodesArray, this.visibleLinks);
  }

  onProgress(callback: (progress: LoadingProgress) => void) {
    this.onProgressCallback = callback;
  }

  onNodesUpdate(callback: (nodes: Node[], links: Link[]) => void) {
    this.onNodesUpdateCallback = callback;
  }

  updateViewport(viewport: ViewportBounds) {
    this.viewport = viewport;

    // Trigger viewport loading if zoom level changed significantly
    if (viewport.zoom > this.config.minZoomForDetails) {
      this.loadViewportNodes(viewport);
    }
  }

  getVisibleNodes(): Node[] {
    return Array.from(this.visibleNodes.values());
  }

  getVisibleLinks(): Link[] {
    return this.visibleLinks;
  }

  getLoadingProgress(): LoadingProgress {
    return {
      level: this.loadingLevel,
      loaded: this.visibleNodes.size,
      total: this.allNodes.length,
      percentage: Math.round((this.visibleNodes.size / this.allNodes.length) * 100),
      isComplete: this.visibleNodes.size === this.allNodes.length,
    };
  }

  isNodeVisible(nodeId: string): boolean {
    return this.visibleNodes.has(nodeId);
  }

  updateConfig(config: Partial<ProgressiveLoaderConfig>) {
    this.config = { ...this.config, ...config };
  }

  reset() {
    this.stopLoading();
    this.visibleNodes.clear();
    this.visibleLinks = [];
    this.loadingLevel = 'core';
    this.loadingQueue = [];
    this.viewport = null;
  }

  destroy() {
    this.stopLoading();
    this.reset();
    this.onProgressCallback = undefined;
    this.onNodesUpdateCallback = undefined;
  }
}
