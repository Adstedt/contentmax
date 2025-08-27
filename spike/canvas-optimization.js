class OptimizedRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', {
      alpha: false,
      desynchronized: true, // Hint for better performance
    });

    // Create offscreen canvas for double buffering
    this.offscreenCanvas = new OffscreenCanvas(canvas.width, canvas.height);
    this.offscreenCtx = this.offscreenCanvas.getContext('2d');

    // Performance metrics
    this.frameTime = 0;
    this.drawCalls = 0;
  }

  renderFrame(nodes, links) {
    const startTime = performance.now();
    this.drawCalls = 0;

    // Clear offscreen canvas
    this.offscreenCtx.fillStyle = '#ffffff';
    this.offscreenCtx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.drawCalls++;

    // Batch render links
    this.renderLinks(links);

    // Batch render nodes by color
    this.renderNodesBatched(nodes);

    // Copy to visible canvas in one operation
    this.ctx.drawImage(this.offscreenCanvas, 0, 0);
    this.drawCalls++;

    this.frameTime = performance.now() - startTime;

    return {
      frameTime: this.frameTime,
      drawCalls: this.drawCalls,
    };
  }

  renderLinks(links) {
    // Render all links in a single path for performance
    this.offscreenCtx.strokeStyle = '#999999';
    this.offscreenCtx.globalAlpha = 0.6;
    this.offscreenCtx.lineWidth = 0.5;
    this.offscreenCtx.beginPath();

    links.forEach((link) => {
      this.offscreenCtx.moveTo(link.source.x, link.source.y);
      this.offscreenCtx.lineTo(link.target.x, link.target.y);
    });

    this.offscreenCtx.stroke();
    this.drawCalls++;
    this.offscreenCtx.globalAlpha = 1;
  }

  renderNodesBatched(nodes) {
    // Group nodes by color to minimize state changes
    const nodesByColor = this.groupNodesByColor(nodes);

    Object.entries(nodesByColor).forEach(([color, groupedNodes]) => {
      this.offscreenCtx.fillStyle = color;

      // Draw all nodes of the same color in one batch
      groupedNodes.forEach((node) => {
        this.offscreenCtx.beginPath();
        this.offscreenCtx.arc(node.x, node.y, 5, 0, 2 * Math.PI);
        this.offscreenCtx.fill();
      });

      this.drawCalls++;
    });
  }

  groupNodesByColor(nodes) {
    const nodesByColor = {};

    nodes.forEach((node) => {
      const color = d3.schemeCategory10[node.group % 10];
      if (!nodesByColor[color]) {
        nodesByColor[color] = [];
      }
      nodesByColor[color].push(node);
    });

    return nodesByColor;
  }

  // Alternative: render nodes as rectangles (faster than circles)
  renderNodesAsRects(nodes) {
    const nodesByColor = this.groupNodesByColor(nodes);

    Object.entries(nodesByColor).forEach(([color, groupedNodes]) => {
      this.offscreenCtx.fillStyle = color;

      groupedNodes.forEach((node) => {
        this.offscreenCtx.fillRect(node.x - 4, node.y - 4, 8, 8);
      });

      this.drawCalls++;
    });
  }

  // WebGL-style instanced rendering simulation
  renderNodesInstanced(nodes) {
    // Pre-calculate all positions
    const positions = new Float32Array(nodes.length * 2);
    const colors = new Uint8Array(nodes.length * 3);

    nodes.forEach((node, i) => {
      positions[i * 2] = node.x;
      positions[i * 2 + 1] = node.y;

      const color = d3.color(d3.schemeCategory10[node.group % 10]);
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    });

    // Simulate instanced drawing (still Canvas2D but optimized)
    for (let i = 0; i < nodes.length; i++) {
      const x = positions[i * 2];
      const y = positions[i * 2 + 1];
      const r = colors[i * 3];
      const g = colors[i * 3 + 1];
      const b = colors[i * 3 + 2];

      this.offscreenCtx.fillStyle = `rgb(${r},${g},${b})`;
      this.offscreenCtx.fillRect(x - 4, y - 4, 8, 8);
    }

    this.drawCalls++;
  }

  // Get performance statistics
  getStats() {
    return {
      frameTime: this.frameTime.toFixed(2),
      fps: (1000 / this.frameTime).toFixed(0),
      drawCalls: this.drawCalls,
    };
  }
}

// Comparison test between standard and optimized rendering
function runComparisonTest() {
  console.log('Running optimized renderer comparison test...');

  const canvas = document.getElementById('canvas');
  const optimizedRenderer = new OptimizedRenderer(canvas);

  // Generate test data
  const testSizes = [100, 500, 1000, 2000, 3000];
  const results = [];

  testSizes.forEach((size) => {
    const data = generateTestData(size);

    // Warm up
    for (let i = 0; i < 10; i++) {
      optimizedRenderer.renderFrame(data.nodes, data.links);
    }

    // Measure
    const times = [];
    for (let i = 0; i < 100; i++) {
      const stats = optimizedRenderer.renderFrame(data.nodes, data.links);
      times.push(stats.frameTime);
    }

    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    const avgFPS = 1000 / avgTime;

    results.push({
      nodes: size,
      avgRenderTime: avgTime.toFixed(2),
      avgFPS: avgFPS.toFixed(0),
      drawCalls: optimizedRenderer.drawCalls,
    });
  });

  console.log('Optimized Renderer Results:');
  console.table(results);

  return results;
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = OptimizedRenderer;
}
