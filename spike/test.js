const canvas = document.getElementById('canvas');
const context = canvas.getContext('2d');

// Performance monitoring
let lastTime = performance.now();
let fps = 0;
let frameCount = 0;
let fpsHistory = [];
let renderTimes = [];

// Test results storage
const testResults = [];

function generateTestData(nodeCount) {
  const nodes = Array.from({length: nodeCount}, (_, i) => ({
    id: `node-${i}`,
    group: Math.floor(Math.random() * 10),
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    vx: 0,
    vy: 0
  }));
  
  const links = [];
  // Create a more realistic network structure
  for (let i = 0; i < nodeCount * 2; i++) {
    const source = nodes[Math.floor(Math.random() * nodeCount)];
    const target = nodes[Math.floor(Math.random() * nodeCount)];
    if (source !== target) {
      links.push({
        source: source,
        target: target
      });
    }
  }
  
  return { nodes, links };
}

function runPerformanceTest(nodeCount) {
  const startTime = performance.now();
  const data = generateTestData(nodeCount);
  
  // Update UI
  document.getElementById('nodeCount').textContent = nodeCount;
  document.getElementById('linkCount').textContent = data.links.length;
  document.getElementById('currentTest').textContent = `${nodeCount} nodes`;
  document.getElementById('status').textContent = 'Running simulation...';
  
  // Reset metrics
  fpsHistory = [];
  renderTimes = [];
  frameCount = 0;
  
  const simulation = d3.forceSimulation(data.nodes)
    .force('link', d3.forceLink(data.links).id(d => d.id).distance(30))
    .force('charge', d3.forceManyBody().strength(-30))
    .force('center', d3.forceCenter(canvas.width / 2, canvas.height / 2))
    .force('collision', d3.forceCollide().radius(5))
    .alphaDecay(0.01) // Slower decay for better observation
    .velocityDecay(0.4);
  
  let animationId;
  
  function render() {
    const renderStart = performance.now();
    
    // Clear canvas
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw links
    context.beginPath();
    context.strokeStyle = '#999';
    context.globalAlpha = 0.6;
    context.lineWidth = 0.5;
    
    data.links.forEach(link => {
      context.moveTo(link.source.x, link.source.y);
      context.lineTo(link.target.x, link.target.y);
    });
    context.stroke();
    
    // Draw nodes (batched by color)
    context.globalAlpha = 1;
    const nodesByColor = {};
    
    data.nodes.forEach(node => {
      const color = d3.schemeCategory10[node.group % 10];
      if (!nodesByColor[color]) nodesByColor[color] = [];
      nodesByColor[color].push(node);
    });
    
    Object.entries(nodesByColor).forEach(([color, nodes]) => {
      context.fillStyle = color;
      nodes.forEach(node => {
        context.beginPath();
        context.arc(node.x, node.y, 5, 0, 2 * Math.PI);
        context.fill();
      });
    });
    
    // Calculate metrics
    const renderEnd = performance.now();
    const renderTime = renderEnd - renderStart;
    renderTimes.push(renderTime);
    
    const currentTime = performance.now();
    const deltaTime = currentTime - lastTime;
    
    frameCount++;
    if (frameCount % 10 === 0) { // Update FPS every 10 frames
      fps = Math.round(1000 / deltaTime);
      fpsHistory.push(fps);
      document.getElementById('fps').textContent = fps;
      document.getElementById('renderTime').textContent = renderTime.toFixed(2);
    }
    
    lastTime = currentTime;
    
    // Update memory if available
    if (performance.memory) {
      const memoryMB = Math.round(performance.memory.usedJSHeapSize / 1048576);
      document.getElementById('memory').textContent = memoryMB;
    }
    
    if (simulation.alpha() > simulation.alphaMin()) {
      animationId = requestAnimationFrame(render);
    } else {
      // Simulation complete
      const endTime = performance.now();
      const stabilizationTime = ((endTime - startTime) / 1000).toFixed(2);
      
      // Calculate average metrics
      const avgFPS = Math.round(fpsHistory.reduce((a, b) => a + b, 0) / fpsHistory.length);
      const avgRenderTime = (renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length).toFixed(2);
      const memoryUsage = performance.memory ? 
        Math.round(performance.memory.usedJSHeapSize / 1048576) : 'N/A';
      
      const result = {
        nodeCount,
        avgFPS,
        avgRenderTime,
        memoryUsage,
        stabilizationTime,
        minFPS: Math.min(...fpsHistory),
        maxFPS: Math.max(...fpsHistory)
      };
      
      testResults.push(result);
      console.log('Test complete:', result);
      
      document.getElementById('status').textContent = 
        `Complete - Avg FPS: ${avgFPS}, Time: ${stabilizationTime}s`;
    }
  }
  
  simulation.on('tick', render);
  
  return {
    simulation,
    stop: () => {
      simulation.stop();
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    }
  };
}

// Test scenarios
const testScenarios = [100, 500, 1000, 2000, 3000];
let currentTestIndex = 0;
let currentSimulation = null;

function runNextTest() {
  if (currentTestIndex < testScenarios.length) {
    const nodeCount = testScenarios[currentTestIndex];
    console.log(`Starting test with ${nodeCount} nodes...`);
    
    if (currentSimulation) {
      currentSimulation.stop();
    }
    
    currentSimulation = runPerformanceTest(nodeCount);
    
    // Run for 10 seconds then move to next test
    setTimeout(() => {
      currentSimulation.stop();
      currentTestIndex++;
      
      if (currentTestIndex < testScenarios.length) {
        // Wait 2 seconds between tests
        setTimeout(runNextTest, 2000);
      } else {
        completeAllTests();
      }
    }, 10000);
  }
}

function completeAllTests() {
  console.log('All tests complete!');
  console.log('Results:', testResults);
  
  // Generate report
  generateReport();
  
  document.getElementById('status').textContent = 'All tests complete!';
  document.getElementById('currentTest').textContent = 'Finished';
}

function generateReport() {
  console.log('\n=== D3 Visualization Performance Results ===\n');
  console.table(testResults);
  
  // Determine recommendation
  const can1000At60 = testResults.find(r => r.nodeCount === 1000)?.avgFPS >= 55;
  const can3000At30 = testResults.find(r => r.nodeCount === 3000)?.avgFPS >= 30;
  const memoryUnder200 = testResults.every(r => 
    r.memoryUsage === 'N/A' || r.memoryUsage < 200
  );
  
  const recommendation = (can1000At60 && can3000At30 && memoryUnder200) ?
    '✅ PROCEED - Canvas approach viable for 3,000 nodes' :
    '⚠️ CONCERNS - Performance may not meet requirements';
  
  console.log('\nRecommendation:', recommendation);
}

// Start tests after page load
window.addEventListener('load', () => {
  setTimeout(runNextTest, 1000);
});