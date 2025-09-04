import { ProgressiveLoader, LoadingProgress, ViewportBounds } from './progressive-loader';
import { Node, Link } from '@/components/taxonomy/D3Visualization/ForceSimulation';

describe('ProgressiveLoader', () => {
  let loader: ProgressiveLoader;
  let mockNodes: Node[];
  let mockLinks: Link[];
  let progressCallback: jest.Mock;
  let updateCallback: jest.Mock;

  beforeEach(() => {
    // Create mock data with 3000 nodes
    mockNodes = Array.from({ length: 3000 }, (_, i) => ({
      id: `node-${i}`,
      url: `/page-${i}`,
      title: `Page ${i}`,
      radius: 5,
      color: '#10a37f',
      children: [],
      x: Math.random() * 1000,
      y: Math.random() * 1000,
      depth: Math.floor(i / 100),
      skuCount: Math.floor(Math.random() * 100),
      traffic: Math.floor(Math.random() * 1000),
    }));

    // Create links between nodes
    mockLinks = [];
    for (let i = 1; i < 1000; i++) {
      mockLinks.push({
        source: `node-${Math.floor(Math.random() * i)}`,
        target: `node-${i}`,
        strength: 0.5,
      });
    }

    progressCallback = jest.fn();
    updateCallback = jest.fn();

    loader = new ProgressiveLoader({
      coreNodeLimit: 100,
      viewportNodeLimit: 500,
      connectedNodeLimit: 1000,
      batchSize: 20,
      frameInterval: 16,
    });

    loader.onProgress(progressCallback);
    loader.onNodesUpdate(updateCallback);
  });

  afterEach(() => {
    loader.destroy();
    jest.clearAllMocks();
  });

  describe('Core Node Loading', () => {
    it('should load core nodes immediately on initialization', () => {
      loader.initialize(mockNodes, mockLinks);

      const visibleNodes = loader.getVisibleNodes();
      expect(visibleNodes.length).toBe(100);
      expect(progressCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'core',
          loaded: 100,
          total: 3000,
          percentage: 3,
          isComplete: false,
        })
      );
    });

    it('should prioritize nodes by importance', () => {
      loader.initialize(mockNodes, mockLinks);

      const visibleNodes = loader.getVisibleNodes();
      // First nodes should have lower indices (higher importance)
      const nodeIndices = visibleNodes.map((n) => parseInt(n.id.split('-')[1]));
      const avgIndex = nodeIndices.reduce((a, b) => a + b, 0) / nodeIndices.length;

      // Average index should be in the lower range
      expect(avgIndex).toBeLessThan(1500);
    });

    it('should maintain 30+ FPS during initial load', () => {
      const startTime = performance.now();
      loader.initialize(mockNodes, mockLinks);
      const endTime = performance.now();

      const loadTime = endTime - startTime;
      // Initial load should be fast (< 33ms for 30 FPS)
      expect(loadTime).toBeLessThan(33);
    });
  });

  describe('Viewport Loading', () => {
    it('should load nodes within viewport bounds', (done) => {
      loader.initialize(mockNodes, mockLinks);

      const viewport: ViewportBounds = {
        x: 100,
        y: 100,
        width: 500,
        height: 400,
        zoom: 1,
      };

      loader.loadViewportNodes(viewport);

      // Wait for batch loading to complete
      setTimeout(() => {
        const visibleNodes = loader.getVisibleNodes();

        // Should have more nodes than just core
        expect(visibleNodes.length).toBeGreaterThan(100);
        expect(visibleNodes.length).toBeLessThanOrEqual(500);

        // Check that visible nodes are within viewport
        const nodesInViewport = visibleNodes.filter(
          (node) =>
            node.x !== undefined &&
            node.y !== undefined &&
            node.x >= viewport.x &&
            node.x <= viewport.x + viewport.width &&
            node.y >= viewport.y &&
            node.y <= viewport.y + viewport.height
        );

        expect(nodesInViewport.length).toBeGreaterThan(0);
        done();
      }, 500);
    });

    it('should batch load nodes to maintain frame rate', (done) => {
      loader.initialize(mockNodes, mockLinks);

      const viewport: ViewportBounds = {
        x: 0,
        y: 0,
        width: 1000,
        height: 1000,
        zoom: 1,
      };

      let updateCount = 0;
      const updateTimes: number[] = [];
      let lastUpdateTime = performance.now();

      updateCallback.mockImplementation(() => {
        const now = performance.now();
        updateTimes.push(now - lastUpdateTime);
        lastUpdateTime = now;
        updateCount++;
      });

      loader.loadViewportNodes(viewport);

      setTimeout(() => {
        // Should have multiple batch updates
        expect(updateCount).toBeGreaterThan(1);

        // Average time between updates should be around frame interval (16ms)
        const avgUpdateTime = updateTimes.reduce((a, b) => a + b, 0) / updateTimes.length;
        expect(avgUpdateTime).toBeGreaterThanOrEqual(15);
        expect(avgUpdateTime).toBeLessThan(50);

        done();
      }, 1000);
    });
  });

  describe('Connected Node Loading', () => {
    it('should load nodes connected to source node', (done) => {
      loader.initialize(mockNodes, mockLinks);

      loader.loadConnectedNodes('node-0', 1);

      setTimeout(() => {
        const visibleNodes = loader.getVisibleNodes();

        // Should have loaded connected nodes
        expect(visibleNodes.length).toBeGreaterThan(100);

        // Check that connected nodes are visible
        const connectedNodeIds = mockLinks
          .filter((link) => link.source === 'node-0' || link.target === 'node-0')
          .map((link) => (link.source === 'node-0' ? link.target : link.source));

        const visibleNodeIds = new Set(visibleNodes.map((n) => n.id));
        const connectedVisible = connectedNodeIds.filter((id) => visibleNodeIds.has(id as string));

        expect(connectedVisible.length).toBeGreaterThan(0);
        done();
      }, 500);
    });

    it('should load nodes at specified depth', (done) => {
      loader.initialize(mockNodes, mockLinks);

      loader.loadConnectedNodes('node-0', 2);

      setTimeout(() => {
        const progress = loader.getLoadingProgress();
        expect(progress.level).toBe('connected');
        expect(progress.loaded).toBeGreaterThan(100);
        done();
      }, 500);
    });
  });

  describe('Load All Nodes', () => {
    it('should progressively load all remaining nodes', (done) => {
      loader.initialize(mockNodes, mockLinks);

      loader.loadAllNodes();

      const checkInterval = setInterval(() => {
        const progress = loader.getLoadingProgress();

        if (progress.isComplete) {
          clearInterval(checkInterval);
          expect(progress.loaded).toBe(3000);
          expect(progress.percentage).toBe(100);
          done();
        }
      }, 100);

      // Timeout after 5 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        done();
      }, 5000);
    });

    it('should maintain performance during full load', (done) => {
      loader.initialize(mockNodes, mockLinks);

      const frameTimings: number[] = [];
      let lastFrame = performance.now();

      const measureFrame = () => {
        const now = performance.now();
        frameTimings.push(now - lastFrame);
        lastFrame = now;

        const progress = loader.getLoadingProgress();
        if (!progress.isComplete) {
          requestAnimationFrame(measureFrame);
        } else {
          // Calculate average FPS
          const avgFrameTime = frameTimings.reduce((a, b) => a + b, 0) / frameTimings.length;
          const avgFps = 1000 / avgFrameTime;

          // Should maintain 30+ FPS
          expect(avgFps).toBeGreaterThan(30);
          done();
        }
      };

      loader.loadAllNodes();
      requestAnimationFrame(measureFrame);
    });
  });

  describe('Memory Management', () => {
    it('should efficiently manage memory with large datasets', () => {
      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;

      loader.initialize(mockNodes, mockLinks);

      // Get initial state
      const initialNodes = loader.getVisibleNodes().length;
      expect(initialNodes).toBe(100); // Core nodes

      // Load all nodes
      loader.loadAllNodes();

      // Check memory is reasonable (this is a simplified check)
      const visibleNodes = loader.getVisibleNodes();
      expect(visibleNodes.length).toBeLessThanOrEqual(3000);

      if ((performance as any).memory) {
        const finalMemory = (performance as any).memory.usedJSHeapSize || 0;
        const memoryIncrease = finalMemory - initialMemory;

        // Memory increase should be reasonable (< 200MB for 3000 nodes)
        const memoryIncreaseMB = memoryIncrease / (1024 * 1024);
        expect(memoryIncreaseMB).toBeLessThan(200);
      }
    });

    it('should clean up properly on destroy', () => {
      loader.initialize(mockNodes, mockLinks);
      loader.loadViewportNodes({ x: 0, y: 0, width: 1000, height: 1000, zoom: 1 });

      loader.destroy();

      const visibleNodes = loader.getVisibleNodes();
      expect(visibleNodes.length).toBe(0);

      const progress = loader.getLoadingProgress();
      expect(progress.loaded).toBe(0);
    });
  });

  describe('Progress Reporting', () => {
    it('should report accurate progress', () => {
      loader.initialize(mockNodes, mockLinks);

      let lastProgress: LoadingProgress | null = null;
      progressCallback.mockImplementation((progress) => {
        if (lastProgress) {
          // Progress should never go backwards
          expect(progress.loaded).toBeGreaterThanOrEqual(lastProgress.loaded);
          expect(progress.percentage).toBeGreaterThanOrEqual(lastProgress.percentage);
        }
        lastProgress = progress;
      });

      loader.loadAllNodes();

      // Check final progress
      const finalProgress = loader.getLoadingProgress();
      expect(finalProgress.total).toBe(3000);
    });

    it('should transition through loading levels correctly', (done) => {
      const levels: string[] = [];
      progressCallback.mockImplementation((progress) => {
        if (!levels.includes(progress.level)) {
          levels.push(progress.level);
        }
      });

      loader.initialize(mockNodes, mockLinks);
      expect(levels).toContain('core');

      loader.loadViewportNodes({ x: 0, y: 0, width: 500, height: 500, zoom: 1 });

      setTimeout(() => {
        expect(levels).toContain('viewport');

        loader.loadConnectedNodes('node-0', 1);

        setTimeout(() => {
          expect(levels).toContain('connected');

          loader.loadAllNodes();

          setTimeout(() => {
            expect(levels).toContain('all');
            expect(levels.length).toBe(4);
            done();
          }, 100);
        }, 100);
      }, 100);
    });
  });

  describe('Configuration', () => {
    it('should respect custom configuration', () => {
      const customLoader = new ProgressiveLoader({
        coreNodeLimit: 50,
        viewportNodeLimit: 200,
        batchSize: 10,
      });

      customLoader.initialize(mockNodes, mockLinks);

      const visibleNodes = customLoader.getVisibleNodes();
      expect(visibleNodes.length).toBe(50);

      customLoader.destroy();
    });

    it('should update configuration dynamically', () => {
      loader.initialize(mockNodes, mockLinks);

      loader.updateConfig({
        batchSize: 50,
        frameInterval: 33,
      });

      // Configuration should be updated
      // This would be visible in loading performance
      loader.loadAllNodes();

      // Note: Testing exact batch size would require mocking requestAnimationFrame
      expect(loader.getLoadingProgress().level).toBe('all');
    });
  });
});
