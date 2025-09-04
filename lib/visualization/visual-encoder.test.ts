import { VisualEncoder } from './visual-encoder';
import { ThemeManager } from './visual-theme';
import { Node, Link } from '@/components/taxonomy/D3Visualization/ForceSimulation';

describe('VisualEncoder', () => {
  let encoder: VisualEncoder;
  let themeManager: ThemeManager;
  let mockNodes: Node[];
  let mockLinks: Link[];

  beforeEach(() => {
    themeManager = ThemeManager.getInstance();
    themeManager.setTheme('dark');

    encoder = new VisualEncoder({
      sizeField: 'skuCount',
      sizeScale: 'log',
      minSize: 5,
      maxSize: 30,
      colorField: 'status',
      edgeWidthField: 'traffic',
    });

    mockNodes = [
      {
        id: 'node-1',
        url: '/page-1',
        title: 'Page 1',
        radius: 10,
        color: '#10a37f',
        children: [],
        x: 100,
        y: 100,
        status: 'optimized',
        skuCount: 1000,
        traffic: 500,
      },
      {
        id: 'node-2',
        url: '/page-2',
        title: 'Page 2',
        radius: 5,
        color: '#f59e0b',
        children: [],
        x: 200,
        y: 200,
        status: 'outdated',
        skuCount: 100,
        traffic: 50,
      },
      {
        id: 'node-3',
        url: '/page-3',
        title: 'Page 3',
        radius: 8,
        color: '#ef4444',
        children: [],
        x: 300,
        y: 300,
        status: 'missing',
        skuCount: 10,
        traffic: 5,
      },
    ];

    mockLinks = [
      { source: 'node-1', target: 'node-2', strength: 0.8 },
      { source: 'node-2', target: 'node-3', strength: 0.3 },
    ];
  });

  afterEach(() => {
    encoder.destroy();
  });

  describe('Color Encoding', () => {
    it('should return correct colors for optimization status', () => {
      encoder.updateScales(mockNodes, mockLinks);

      const optimizedColor = encoder.getNodeColor(mockNodes[0]);
      const outdatedColor = encoder.getNodeColor(mockNodes[1]);
      const missingColor = encoder.getNodeColor(mockNodes[2]);

      expect(optimizedColor).toBe('#10a37f');
      expect(outdatedColor).toBe('#f59e0b');
      expect(missingColor).toBe('#ef4444');
    });

    it('should return hover colors when state is hover', () => {
      encoder.updateScales(mockNodes, mockLinks);

      const hoverColor = encoder.getNodeColor(mockNodes[0], 'hover');
      expect(hoverColor).toBe('#14d39a');
    });

    it('should return selected colors when state is selected', () => {
      encoder.updateScales(mockNodes, mockLinks);

      const selectedColor = encoder.getNodeColor(mockNodes[0], 'selected');
      expect(selectedColor).toBe('#0e906d');
    });
  });

  describe('Size Encoding', () => {
    it('should scale node sizes based on SKU count', () => {
      encoder.updateScales(mockNodes, mockLinks);

      const size1 = encoder.getNodeSize(mockNodes[0]); // 1000 SKUs
      const size2 = encoder.getNodeSize(mockNodes[1]); // 100 SKUs
      const size3 = encoder.getNodeSize(mockNodes[2]); // 10 SKUs

      // Sizes should be in descending order
      expect(size1).toBeGreaterThan(size2);
      expect(size2).toBeGreaterThan(size3);

      // Should be within configured range
      expect(size1).toBeLessThanOrEqual(30);
      expect(size3).toBeGreaterThanOrEqual(5);
    });

    it('should handle zero and negative values for log scale', () => {
      const nodeWithZero = { ...mockNodes[0], skuCount: 0 };
      const nodeWithNegative = { ...mockNodes[0], skuCount: -10 };

      encoder.updateScales([nodeWithZero, nodeWithNegative], []);

      const sizeZero = encoder.getNodeSize(nodeWithZero);
      const sizeNegative = encoder.getNodeSize(nodeWithNegative);

      // Should return minimum size for invalid values
      expect(sizeZero).toBe(5);
      expect(sizeNegative).toBe(5);
    });

    it('should support different scale types', () => {
      const linearEncoder = new VisualEncoder({ sizeScale: 'linear' });
      const sqrtEncoder = new VisualEncoder({ sizeScale: 'sqrt' });

      linearEncoder.updateScales(mockNodes, mockLinks);
      sqrtEncoder.updateScales(mockNodes, mockLinks);

      const linearSize = linearEncoder.getNodeSize(mockNodes[0]);
      const sqrtSize = sqrtEncoder.getNodeSize(mockNodes[0]);

      // Different scales should produce different results
      expect(linearSize).not.toBe(sqrtSize);

      linearEncoder.destroy();
      sqrtEncoder.destroy();
    });
  });

  describe('Edge Encoding', () => {
    it('should scale edge widths based on traffic', () => {
      // Add traffic data to links
      const linksWithTraffic = [
        { ...mockLinks[0], traffic: 1000 },
        { ...mockLinks[1], traffic: 100 },
      ];

      encoder.updateScales(mockNodes, linksWithTraffic);

      const width1 = encoder.getEdgeWidth(linksWithTraffic[0]);
      const width2 = encoder.getEdgeWidth(linksWithTraffic[1]);

      expect(width1).toBeGreaterThan(width2);
      expect(width1).toBeLessThanOrEqual(5);
      expect(width2).toBeGreaterThanOrEqual(0.5);
    });

    it('should color edges based on traffic levels', () => {
      const highTrafficLink = { ...mockLinks[0], traffic: 900 };
      const lowTrafficLink = { ...mockLinks[1], traffic: 10 };

      encoder.updateScales(mockNodes, [highTrafficLink, lowTrafficLink]);

      const highColor = encoder.getEdgeColor(highTrafficLink);
      const lowColor = encoder.getEdgeColor(lowTrafficLink);

      expect(highColor).toBe('#2a2a2a'); // High traffic color
      expect(lowColor).toBe('#0f0f0f'); // Low traffic color
    });
  });

  describe('Theme Support', () => {
    it('should update colors when theme changes', () => {
      encoder.updateScales(mockNodes, mockLinks);

      const darkColor = encoder.getNodeColor(mockNodes[0]);

      // Change to light theme
      themeManager.setTheme('light');

      const lightColor = encoder.getNodeColor(mockNodes[0]);

      // Colors should be different for different themes
      expect(darkColor).not.toBe(lightColor);
      expect(lightColor).toBe('#059669'); // Light theme optimized color
    });

    it('should provide colorblind-safe colors', () => {
      themeManager.setTheme('colorblind');

      encoder.updateScales(mockNodes, mockLinks);

      const optimizedColor = encoder.getNodeColor(mockNodes[0]);
      const outdatedColor = encoder.getNodeColor(mockNodes[1]);
      const missingColor = encoder.getNodeColor(mockNodes[2]);

      // Colorblind theme uses different colors
      expect(optimizedColor).toBe('#0173B2'); // Blue instead of green
      expect(outdatedColor).toBe('#ECE133'); // Yellow
      expect(missingColor).toBe('#CC79A7'); // Pink instead of red
    });
  });

  describe('Accessibility', () => {
    it('should meet WCAG AA contrast requirements', () => {
      const theme = themeManager.getTheme();

      // Check contrast for all status colors against background
      const contrastOptimized = themeManager.checkContrast(
        theme.colors.optimized,
        theme.background
      );
      const contrastOutdated = themeManager.checkContrast(theme.colors.outdated, theme.background);
      const contrastMissing = themeManager.checkContrast(theme.colors.missing, theme.background);

      // WCAG AA requires contrast ratio of at least 4.5:1 for normal text
      expect(contrastOptimized).toBeGreaterThanOrEqual(4.5);
      expect(contrastOutdated).toBeGreaterThanOrEqual(4.5);
      expect(contrastMissing).toBeGreaterThanOrEqual(4.5);
    });

    it('should provide sufficient contrast in light theme', () => {
      themeManager.setTheme('light');
      const theme = themeManager.getTheme();

      const contrastOptimized = themeManager.checkContrast(
        theme.colors.optimized,
        theme.background
      );
      const contrastOutdated = themeManager.checkContrast(theme.colors.outdated, theme.background);
      const contrastMissing = themeManager.checkContrast(theme.colors.missing, theme.background);

      expect(contrastOptimized).toBeGreaterThanOrEqual(4.5);
      expect(contrastOutdated).toBeGreaterThanOrEqual(4.5);
      expect(contrastMissing).toBeGreaterThanOrEqual(4.5);
    });
  });

  describe('Transitions', () => {
    it('should interpolate values during transitions', () => {
      encoder.updateConfig({ enableTransitions: true, transitionDuration: 300 });
      encoder.updateScales(mockNodes, mockLinks);

      const startTime = performance.now();
      const node = mockNodes[0];

      // Start a transition
      encoder.startTransition(node.id, startTime);

      // Get values at different times
      const values1 = encoder.getInterpolatedValues(node, startTime);
      const values2 = encoder.getInterpolatedValues(node, startTime + 150); // Halfway
      const values3 = encoder.getInterpolatedValues(node, startTime + 300); // Complete

      // Values should change over time
      expect(values1.size).toBeDefined();
      expect(values2.size).toBeDefined();
      expect(values3.size).toBeDefined();
    });

    it('should disable transitions when configured', () => {
      encoder.updateConfig({ enableTransitions: false });
      encoder.updateScales(mockNodes, mockLinks);

      const node = mockNodes[0];
      const values = encoder.getInterpolatedValues(node, performance.now());

      // Should return immediate values without interpolation
      expect(values.color).toBe(encoder.getNodeColor(node));
      expect(values.size).toBe(encoder.getNodeSize(node));
    });
  });

  describe('Legend Generation', () => {
    it('should generate legend data for current encoding', () => {
      encoder.updateScales(mockNodes, mockLinks);

      const legend = encoder.getLegendData();

      // Should have color legend entries
      expect(legend.colors).toHaveLength(4);
      expect(legend.colors[0]).toEqual({
        label: 'Optimized',
        color: '#10a37f',
      });

      // Should have size legend entries
      expect(legend.sizes).toHaveLength(3);
      expect(legend.sizes[0].size).toBe(5); // Min size
      expect(legend.sizes[2].size).toBe(30); // Max size
    });
  });

  describe('Performance', () => {
    it('should cache color calculations', () => {
      encoder.updateScales(mockNodes, mockLinks);

      // Call getNodeColor multiple times for same node
      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        encoder.getNodeColor(mockNodes[0]);
      }
      const duration = performance.now() - start;

      // Should be very fast due to caching
      expect(duration).toBeLessThan(10); // Less than 10ms for 1000 calls
    });

    it('should clear cache on theme change', () => {
      encoder.updateScales(mockNodes, mockLinks);

      const color1 = encoder.getNodeColor(mockNodes[0]);

      // Clear cache
      encoder.clearColorCache();

      const color2 = encoder.getNodeColor(mockNodes[0]);

      // Should return same color (just not from cache)
      expect(color1).toBe(color2);
    });
  });
});
