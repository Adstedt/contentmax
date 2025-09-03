# TASK-007: Progressive Loading Optimization

## Overview

**Priority**: P1 - High  
**Estimate**: 4 hours  
**Owner**: Frontend Developer  
**Dependencies**: Existing D3 visualization  
**Status**: Not Started

## Problem Statement

The current visualization loads all nodes at once, causing performance issues with 3000+ nodes. We need progressive loading that renders nodes based on viewport and zoom level, maintaining 30+ FPS throughout.

## Technical Requirements

### 1. Progressive Loader Implementation

#### File: `lib/visualization/progressive-loader.ts`

```typescript
import { Node, Link } from '@/types/visualization.types';

export interface Viewport {
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
}

export interface LoadingLevel {
  level: number;
  name: string;
  maxNodes: number;
  criteria: (node: Node, viewport: Viewport) => boolean;
}

export interface LoaderConfig {
  levels: LoadingLevel[];
  batchSize: number;
  frameDelay: number;
  enableStreaming: boolean;
}

/**
 * ProgressiveLoader - Manages staged loading of nodes for performance
 */
export class ProgressiveLoader {
  private loadedNodes: Map<string, Node> = new Map();
  private pendingNodes: Node[] = [];
  private viewport: Viewport;
  private currentLevel: number = 0;
  private loadingInProgress: boolean = false;
  private frameCount: number = 0;
  private lastFrameTime: number = 0;

  private readonly DEFAULT_CONFIG: LoaderConfig = {
    levels: [
      {
        level: 1,
        name: 'core',
        maxNodes: 100,
        criteria: (node) => node.depth <= 1 || node.score >= 80,
      },
      {
        level: 2,
        name: 'viewport',
        maxNodes: 500,
        criteria: (node, viewport) => this.isInViewport(node, viewport),
      },
      {
        level: 3,
        name: 'connected',
        maxNodes: 1500,
        criteria: (node) => this.hasLoadedConnection(node),
      },
      {
        level: 4,
        name: 'all',
        maxNodes: Infinity,
        criteria: () => true,
      },
    ],
    batchSize: 50,
    frameDelay: 16, // ~60fps
    enableStreaming: true,
  };

  constructor(
    private allNodes: Node[],
    private config: Partial<LoaderConfig> = {}
  ) {
    this.config = { ...this.DEFAULT_CONFIG, ...config };
    this.viewport = {
      x: 0,
      y: 0,
      width: window.innerWidth,
      height: window.innerHeight,
      scale: 1,
    };
  }

  /**
   * Initialize with core nodes
   */
  async initialize(): Promise<Node[]> {
    console.log('[ProgressiveLoader] Initializing with core nodes');

    // Sort nodes by importance
    const sortedNodes = this.sortNodesByImportance(this.allNodes);

    // Load level 1 (core nodes)
    const coreNodes = this.selectNodesForLevel(sortedNodes, 1);

    coreNodes.forEach((node) => {
      this.loadedNodes.set(node.id, node);
    });

    // Store remaining nodes for progressive loading
    this.pendingNodes = sortedNodes.filter((node) => !this.loadedNodes.has(node.id));

    console.log(
      `[ProgressiveLoader] Loaded ${coreNodes.length} core nodes, ${this.pendingNodes.length} pending`
    );

    return coreNodes;
  }

  /**
   * Update viewport and trigger loading
   */
  updateViewport(viewport: Partial<Viewport>): void {
    this.viewport = { ...this.viewport, ...viewport };

    // Determine appropriate level based on zoom
    const newLevel = this.calculateLoadingLevel(this.viewport.scale);

    if (newLevel !== this.currentLevel) {
      console.log(`[ProgressiveLoader] Zoom level changed: ${this.currentLevel} → ${newLevel}`);
      this.currentLevel = newLevel;
      this.triggerProgressiveLoad();
    } else if (newLevel === 2) {
      // For viewport level, also trigger on pan
      this.triggerProgressiveLoad();
    }
  }

  /**
   * Progressive loading with streaming
   */
  private async triggerProgressiveLoad(): Promise<void> {
    if (this.loadingInProgress || this.pendingNodes.length === 0) {
      return;
    }

    this.loadingInProgress = true;
    const startTime = performance.now();

    try {
      const level = this.config.levels![this.currentLevel - 1];
      if (!level) return;

      const nodesToLoad = this.selectNodesForLevel(this.pendingNodes, this.currentLevel);

      if (nodesToLoad.length === 0) {
        return;
      }

      console.log(
        `[ProgressiveLoader] Loading ${nodesToLoad.length} nodes for level ${this.currentLevel}`
      );

      // Stream nodes in batches
      if (this.config.enableStreaming) {
        await this.streamNodes(nodesToLoad);
      } else {
        await this.loadNodesBatch(nodesToLoad);
      }

      const duration = performance.now() - startTime;
      console.log(`[ProgressiveLoader] Loaded in ${duration.toFixed(2)}ms`);
    } finally {
      this.loadingInProgress = false;
    }
  }

  /**
   * Stream nodes for smooth loading
   */
  private async streamNodes(nodes: Node[]): Promise<void> {
    const batches = this.createBatches(nodes, this.config.batchSize!);

    for (const batch of batches) {
      const frameStart = performance.now();

      // Add nodes to loaded set
      batch.forEach((node) => {
        this.loadedNodes.set(node.id, node);

        // Remove from pending
        const index = this.pendingNodes.findIndex((n) => n.id === node.id);
        if (index !== -1) {
          this.pendingNodes.splice(index, 1);
        }
      });

      // Emit batch loaded event
      this.emitBatchLoaded(batch);

      // Maintain frame rate
      const frameTime = performance.now() - frameStart;
      if (frameTime < this.config.frameDelay!) {
        await this.sleep(this.config.frameDelay! - frameTime);
      }

      // Check if we should continue (viewport might have changed)
      if (this.shouldStopLoading()) {
        break;
      }
    }
  }

  /**
   * Load nodes in a single batch
   */
  private async loadNodesBatch(nodes: Node[]): Promise<void> {
    nodes.forEach((node) => {
      this.loadedNodes.set(node.id, node);

      const index = this.pendingNodes.findIndex((n) => n.id === node.id);
      if (index !== -1) {
        this.pendingNodes.splice(index, 1);
      }
    });

    this.emitBatchLoaded(nodes);
  }

  /**
   * Select nodes for a specific loading level
   */
  private selectNodesForLevel(nodes: Node[], level: number): Node[] {
    const levelConfig = this.config.levels![level - 1];
    if (!levelConfig) return [];

    const selected: Node[] = [];

    for (const node of nodes) {
      if (selected.length >= levelConfig.maxNodes) {
        break;
      }

      if (levelConfig.criteria(node, this.viewport)) {
        selected.push(node);
      }
    }

    return selected;
  }

  /**
   * Calculate loading level based on zoom
   */
  private calculateLoadingLevel(scale: number): number {
    if (scale < 0.25) return 1; // Core only
    if (scale < 0.5) return 2; // Viewport
    if (scale < 1.0) return 3; // Connected
    return 4; // All
  }

  /**
   * Sort nodes by importance for loading priority
   */
  private sortNodesByImportance(nodes: Node[]): Node[] {
    return [...nodes].sort((a, b) => {
      // Priority order:
      // 1. Depth (lower is better)
      // 2. Score (higher is better)
      // 3. Product count (higher is better)

      if (a.depth !== b.depth) {
        return a.depth - b.depth;
      }

      if (a.score !== b.score) {
        return (b.score || 0) - (a.score || 0);
      }

      return (b.productCount || 0) - (a.productCount || 0);
    });
  }

  /**
   * Check if node is in viewport
   */
  private isInViewport(node: Node, viewport: Viewport): boolean {
    if (!node.x || !node.y) return false;

    const buffer = 100; // Load slightly outside viewport
    const scaledX = node.x * viewport.scale;
    const scaledY = node.y * viewport.scale;

    return (
      scaledX >= viewport.x - buffer &&
      scaledX <= viewport.x + viewport.width + buffer &&
      scaledY >= viewport.y - buffer &&
      scaledY <= viewport.y + viewport.height + buffer
    );
  }

  /**
   * Check if node has loaded connections
   */
  private hasLoadedConnection(node: Node): boolean {
    // Check if parent is loaded
    if (node.parentId && this.loadedNodes.has(node.parentId)) {
      return true;
    }

    // Check if any child is loaded
    if (node.children) {
      return node.children.some((childId) => this.loadedNodes.has(childId));
    }

    return false;
  }

  /**
   * Create batches from nodes array
   */
  private createBatches<T>(array: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < array.length; i += batchSize) {
      batches.push(array.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Check if loading should stop
   */
  private shouldStopLoading(): boolean {
    // Stop if viewport changed significantly
    // Stop if performance is degrading
    // Stop if user is interacting

    const fps = this.calculateFPS();
    if (fps < 20) {
      console.warn('[ProgressiveLoader] FPS dropped below 20, pausing load');
      return true;
    }

    return false;
  }

  /**
   * Calculate current FPS
   */
  private calculateFPS(): number {
    const now = performance.now();
    const delta = now - this.lastFrameTime;

    if (delta === 0) return 60;

    const fps = 1000 / delta;
    this.lastFrameTime = now;
    this.frameCount++;

    return fps;
  }

  /**
   * Emit event when batch is loaded
   */
  private emitBatchLoaded(nodes: Node[]): void {
    window.dispatchEvent(
      new CustomEvent('nodes-loaded', {
        detail: {
          nodes,
          totalLoaded: this.loadedNodes.size,
          remaining: this.pendingNodes.length,
          level: this.currentLevel,
        },
      })
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get loading statistics
   */
  getStats() {
    return {
      loaded: this.loadedNodes.size,
      pending: this.pendingNodes.length,
      total: this.allNodes.length,
      level: this.currentLevel,
      percentage: (this.loadedNodes.size / this.allNodes.length) * 100,
    };
  }

  /**
   * Get currently loaded nodes
   */
  getLoadedNodes(): Node[] {
    return Array.from(this.loadedNodes.values());
  }

  /**
   * Force load specific nodes
   */
  loadNodes(nodeIds: string[]): void {
    const nodesToLoad = this.pendingNodes.filter((n) => nodeIds.includes(n.id));
    nodesToLoad.forEach((node) => {
      this.loadedNodes.set(node.id, node);
    });

    // Remove from pending
    this.pendingNodes = this.pendingNodes.filter((n) => !nodeIds.includes(n.id));

    this.emitBatchLoaded(nodesToLoad);
  }

  /**
   * Reset loader
   */
  reset(): void {
    this.loadedNodes.clear();
    this.pendingNodes = [...this.allNodes];
    this.currentLevel = 0;
    this.loadingInProgress = false;
  }
}
```

### 2. Integration with ForceGraph Component

#### File: `components/taxonomy/D3Visualization/ForceGraph.tsx` (update)

```typescript
import { ProgressiveLoader } from '@/lib/visualization/progressive-loader';

export function ForceGraph({ data, ...props }: ForceGraphProps) {
  const progressiveLoaderRef = useRef<ProgressiveLoader | null>(null);
  const [loadedNodes, setLoadedNodes] = useState<Node[]>([]);
  const [loadingStats, setLoadingStats] = useState<any>(null);

  // Initialize progressive loader
  useEffect(() => {
    const loader = new ProgressiveLoader(data.nodes, {
      batchSize: 50,
      enableStreaming: true
    });

    progressiveLoaderRef.current = loader;

    // Initial load
    loader.initialize().then(coreNodes => {
      setLoadedNodes(coreNodes);
      setLoadingStats(loader.getStats());
    });

    // Listen for batch loaded events
    const handleBatchLoaded = (event: CustomEvent) => {
      setLoadedNodes(loader.getLoadedNodes());
      setLoadingStats(loader.getStats());
    };

    window.addEventListener('nodes-loaded', handleBatchLoaded as any);

    return () => {
      window.removeEventListener('nodes-loaded', handleBatchLoaded as any);
    };
  }, [data.nodes]);

  // Update viewport on zoom/pan
  const handleZoom = useCallback((transform: d3.ZoomTransform) => {
    if (progressiveLoaderRef.current) {
      progressiveLoaderRef.current.updateViewport({
        x: -transform.x,
        y: -transform.y,
        scale: transform.k
      });
    }
  }, []);

  // Loading indicator
  const LoadingIndicator = () => {
    if (!loadingStats || loadingStats.percentage === 100) return null;

    return (
      <div className="absolute top-4 right-4 bg-black/80 rounded-lg p-4">
        <div className="text-sm text-gray-300 mb-2">
          Loading nodes: {loadingStats.loaded} / {loadingStats.total}
        </div>
        <div className="w-48 bg-gray-700 rounded-full h-2">
          <div
            className="bg-green-500 h-2 rounded-full transition-all"
            style={{ width: `${loadingStats.percentage}%` }}
          />
        </div>
        <div className="text-xs text-gray-400 mt-1">
          Level {loadingStats.level} - {['Core', 'Viewport', 'Connected', 'All'][loadingStats.level - 1]}
        </div>
      </div>
    );
  };

  return (
    <div className="relative">
      <LoadingIndicator />
      {/* Rest of visualization */}
    </div>
  );
}
```

### 3. Testing Suite

#### File: `lib/visualization/progressive-loader.test.ts`

```typescript
import { ProgressiveLoader } from './progressive-loader';

describe('ProgressiveLoader', () => {
  let loader: ProgressiveLoader;
  let testNodes: Node[];

  beforeEach(() => {
    testNodes = Array.from({ length: 3000 }, (_, i) => ({
      id: `node-${i}`,
      x: Math.random() * 1000,
      y: Math.random() * 1000,
      depth: Math.floor(i / 1000),
      score: Math.random() * 100,
      productCount: Math.random() * 1000,
    }));

    loader = new ProgressiveLoader(testNodes);
  });

  describe('initialization', () => {
    it('should load core nodes first', async () => {
      const coreNodes = await loader.initialize();

      expect(coreNodes.length).toBeLessThanOrEqual(100);
      expect(coreNodes.every((n) => n.depth <= 1 || n.score >= 80)).toBe(true);
    });

    it('should track pending nodes', async () => {
      await loader.initialize();
      const stats = loader.getStats();

      expect(stats.loaded + stats.pending).toBe(testNodes.length);
    });
  });

  describe('viewport loading', () => {
    it('should load nodes in viewport at zoom level 2', () => {
      loader.updateViewport({
        x: 0,
        y: 0,
        width: 800,
        height: 600,
        scale: 0.4,
      });

      // Wait for loading
      setTimeout(() => {
        const loaded = loader.getLoadedNodes();
        const inViewport = loaded.filter(
          (n) => n.x! >= -100 && n.x! <= 900 && n.y! >= -100 && n.y! <= 700
        );

        expect(inViewport.length).toBeGreaterThan(0);
      }, 1000);
    });
  });

  describe('performance', () => {
    it('should maintain 30+ FPS during loading', async () => {
      const startTime = performance.now();
      await loader.initialize();

      loader.updateViewport({ scale: 2 }); // Trigger full load

      // Monitor FPS
      let frameCount = 0;
      const measureFPS = setInterval(() => {
        frameCount++;
      }, 16); // 60fps target

      // Wait for loading to complete
      await new Promise((resolve) => setTimeout(resolve, 2000));

      clearInterval(measureFPS);
      const elapsed = performance.now() - startTime;
      const expectedFrames = elapsed / 16.67;
      const actualFPS = (frameCount / elapsed) * 1000;

      expect(actualFPS).toBeGreaterThan(30);
    });
  });

  describe('streaming', () => {
    it('should stream nodes in batches', (done) => {
      let batchCount = 0;

      window.addEventListener('nodes-loaded', (event: any) => {
        batchCount++;
        expect(event.detail.nodes.length).toBeLessThanOrEqual(50);

        if (event.detail.remaining === 0) {
          expect(batchCount).toBeGreaterThan(1);
          done();
        }
      });

      loader.initialize().then(() => {
        loader.updateViewport({ scale: 5 }); // Load all
      });
    });
  });
});
```

## Acceptance Criteria

- [ ] Initial render displays <100 core nodes in <1 second
- [ ] Smooth transitions between loading levels
- [ ] No frame drops (<30 FPS) during progressive loading
- [ ] Visual loading indicators show progress
- [ ] Viewport-based loading at medium zoom levels
- [ ] All nodes loaded at high zoom levels
- [ ] Memory usage stays below 200MB
- [ ] Loading can be interrupted on viewport change
- [ ] Works with existing D3 force simulation
- [ ] Unit test coverage >80%

## Implementation Steps

1. **Hour 1**: Core loader implementation
2. **Hour 2**: Viewport detection and level management
3. **Hour 3**: Streaming and batching logic
4. **Hour 4**: Integration with ForceGraph and testing

## Performance Metrics

- Level 1 (Core): <100 nodes, <500ms load
- Level 2 (Viewport): <500 nodes, <1s load
- Level 3 (Connected): <1500 nodes, <2s load
- Level 4 (All): 3000+ nodes, <5s load

## Notes

- Consider using Web Workers for heavy calculations
- May need RequestIdleCallback for better scheduling
- Could add predictive loading based on pan direction
- Consider using IndexedDB for caching loaded states
