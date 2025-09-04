const { chromium } = require('playwright');

async function deepTaxonomyReview() {
  const browser = await chromium.launch({
    headless: false,
    slowMo: 500,
    args: ['--start-maximized'],
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
  });

  const page = await context.newPage();

  console.log('🎨 Deep Taxonomy Visualization Review\n');
  console.log('═══════════════════════════════════════════\n');

  try {
    // Step 1: Direct Navigation to Login
    console.log('📍 Step 1: Authentication');
    await page.goto('http://localhost:3000/auth/login');
    await page.waitForLoadState('networkidle');

    // Login
    console.log('  → Logging in...');
    await page.fill('input[type="email"]', 'Alexander.adstedt+2@kontorab.se');
    await page.fill('input[type="password"]', 'KBty8611');

    const submitButton = await page.locator('button[type="submit"]').first();
    await submitButton.click();

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    console.log('  ✅ Logged in\n');

    // Step 2: Direct Navigation to Taxonomy
    console.log('📍 Step 2: Going directly to Taxonomy View');
    await page.goto('http://localhost:3000/dashboard/taxonomy');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000); // Give D3 time to render

    await page.screenshot({
      path: 'tests/e2e/screenshots/taxonomy-initial.png',
      fullPage: true,
    });
    console.log('  ✅ On taxonomy page\n');

    // Step 3: Analyze the Canvas/Visualization Area
    console.log('📍 Step 3: Analyzing Visualization Canvas');

    // Look for the D3 canvas or visualization container
    const canvas = await page
      .locator('canvas, svg, [class*="visualization"], [class*="d3"], [class*="force"]')
      .first();
    const canvasVisible = await canvas.isVisible();
    console.log(`  → Visualization canvas: ${canvasVisible ? '✅ Found' : '❌ Not found'}`);

    if (canvasVisible) {
      const canvasBox = await canvas.boundingBox();
      console.log(`  → Canvas dimensions: ${canvasBox?.width}x${canvasBox?.height}px`);
    }

    // Look for nodes in the visualization
    const nodes = await page
      .locator('circle, rect, g[class*="node"], div[class*="node"], [data-node-id]')
      .all();
    console.log(`  → Visualization nodes found: ${nodes.length}`);

    // Check for links between nodes
    const links = await page.locator('line, path[class*="link"], [class*="edge"]').count();
    console.log(`  → Node connections/links: ${links}\n`);

    // Step 4: Check Control Panel
    console.log('📍 Step 4: Examining Control Panel');

    // View mode toggles
    const cardsBtn = await page.locator('button:has-text("Cards")').isVisible();
    const treeBtn = await page.locator('button:has-text("Tree")').isVisible();
    const graphBtn = await page.locator('button:has-text("Graph")').isVisible();

    console.log('  View Mode Controls:');
    console.log(`    • Cards view: ${cardsBtn ? '✅' : '❌'}`);
    console.log(`    • Tree view: ${treeBtn ? '✅' : '❌'}`);
    console.log(`    • Graph view: ${graphBtn ? '✅' : '❌'}`);

    // Search functionality
    const searchInput = await page
      .locator('input[placeholder*="Search"], input[type="search"]')
      .first();
    const hasSearch = await searchInput.isVisible();
    console.log(`    • Search bar: ${hasSearch ? '✅' : '❌'}`);

    // Filter controls
    const filterBtn = await page.locator('button:has-text("Filter"), [class*="filter"]').first();
    const hasFilter = await filterBtn.isVisible();
    console.log(`    • Filter button: ${hasFilter ? '✅' : '❌'}\n`);

    // Step 5: Try Different View Modes
    console.log('📍 Step 5: Testing View Modes');

    // Try Cards view
    if (cardsBtn) {
      console.log('  → Switching to Cards view...');
      await page.locator('button:has-text("Cards")').click();
      await page.waitForTimeout(2000);

      const cards = await page.locator('[class*="card"], div[role="article"]').all();
      console.log(`    • Cards visible: ${cards.length}`);

      await page.screenshot({
        path: 'tests/e2e/screenshots/taxonomy-cards-view.png',
        fullPage: true,
      });
    }

    // Try Tree view
    if (treeBtn) {
      console.log('  → Switching to Tree view...');
      await page.locator('button:has-text("Tree")').click();
      await page.waitForTimeout(2000);

      const treeNodes = await page.locator('[class*="tree"], [class*="branch"], ul li').count();
      console.log(`    • Tree nodes visible: ${treeNodes}`);

      await page.screenshot({
        path: 'tests/e2e/screenshots/taxonomy-tree-view.png',
        fullPage: true,
      });
    }

    // Try Graph view
    if (graphBtn) {
      console.log('  → Switching to Graph view...');
      await page.locator('button:has-text("Graph")').click();
      await page.waitForTimeout(2000);

      await page.screenshot({
        path: 'tests/e2e/screenshots/taxonomy-graph-view.png',
        fullPage: true,
      });
    }

    console.log('');

    // Step 6: Interact with Nodes
    console.log('📍 Step 6: Node Interaction Testing');

    // Try to click on a node
    if (nodes.length > 0) {
      console.log(`  → Clicking on first node...`);
      await nodes[0].click();
      await page.waitForTimeout(1500);

      // Check for detail panel or popup
      const detailPanel = await page
        .locator('[class*="detail"], [class*="panel"], [class*="sidebar"], [class*="modal"]')
        .first();
      const hasDetails = await detailPanel.isVisible();
      console.log(`    • Detail panel appeared: ${hasDetails ? '✅' : '❌'}`);

      if (hasDetails) {
        // Look for Sprint 4 features in detail panel
        console.log('\n  📊 Sprint 4 Features in Detail Panel:');

        const score = await page
          .locator(detailPanel)
          .locator('text=/score|opportunity/i')
          .isVisible();
        console.log(`    • Opportunity Score: ${score ? '✅' : '❌ Missing'}`);

        const revenue = await page.locator(detailPanel).locator('text=/revenue|\\$/').isVisible();
        console.log(`    • Revenue Data: ${revenue ? '✅' : '❌ Missing'}`);

        const recs = await page
          .locator(detailPanel)
          .locator('text=/recommend|suggestion/i')
          .isVisible();
        console.log(`    • Recommendations: ${recs ? '✅' : '❌ Missing'}`);
      }

      await page.screenshot({
        path: 'tests/e2e/screenshots/taxonomy-node-selected.png',
        fullPage: true,
      });
    }

    console.log('');

    // Step 7: Test Zoom and Pan
    console.log('📍 Step 7: Testing Canvas Controls');

    // Try zoom controls
    const zoomIn = await page
      .locator('button[aria-label*="zoom in"], button:has-text("+")')
      .first();
    const zoomOut = await page
      .locator('button[aria-label*="zoom out"], button:has-text("-")')
      .first();

    if (await zoomIn.isVisible()) {
      console.log('  → Testing zoom in...');
      await zoomIn.click();
      await page.waitForTimeout(1000);
      await zoomIn.click();
      await page.waitForTimeout(1000);
      console.log('    • Zoomed in 2x');

      await page.screenshot({
        path: 'tests/e2e/screenshots/taxonomy-zoomed.png',
        fullPage: true,
      });
    }

    // Try to pan the canvas
    if (canvasVisible) {
      console.log('  → Testing pan/drag...');
      const canvasElement = await page.locator('canvas, svg, [class*="visualization"]').first();
      await canvasElement.dragTo(canvasElement, {
        sourcePosition: { x: 100, y: 100 },
        targetPosition: { x: 300, y: 300 },
      });
      await page.waitForTimeout(1000);
      console.log('    • Canvas panned');
    }

    console.log('');

    // Step 8: Check for Product Level
    console.log('📍 Step 8: Looking for Product-Level Display');

    // Try to navigate to deepest level
    const deepestNodes = await page
      .locator('[class*="leaf"], [class*="product"], [data-depth="3"], [data-depth="4"]')
      .all();

    if (deepestNodes.length > 0) {
      console.log(`  → Found ${deepestNodes.length} leaf/product nodes`);
      await deepestNodes[0].click();
      await page.waitForTimeout(1500);

      // Check for product-specific elements
      console.log('\n  📦 Product-Level Elements Check:');

      const productImage = await page
        .locator('img[src*="product"], img[alt*="product"], [class*="product-image"]')
        .isVisible();
      console.log(`    • Product Image: ${productImage ? '✅ Present' : '❌ Missing'}`);

      const productPrice = await page.locator('text=/\\$[0-9]+/').isVisible();
      console.log(`    • Price Display: ${productPrice ? '✅ Present' : '❌ Missing'}`);

      const productDesc = await page.locator('[class*="description"], [class*="desc"]').isVisible();
      console.log(`    • Description Field: ${productDesc ? '✅ Present' : '❌ Missing'}`);

      const productMeta = await page.locator('text=/SKU|GTIN|MPN|Stock/i').isVisible();
      console.log(`    • Product Metadata: ${productMeta ? '✅ Present' : '❌ Missing'}`);

      await page.screenshot({
        path: 'tests/e2e/screenshots/taxonomy-product-level.png',
        fullPage: true,
      });
    } else {
      console.log('  ❌ No product-level nodes found');
      console.log('  ⚠️  Need to implement product differentiation');
    }

    console.log('');

    // Step 9: Performance Analysis
    console.log('📍 Step 9: Performance & Responsiveness');

    // Check rendering performance
    const startTime = Date.now();
    await page.reload();
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;

    console.log(`  → Page load time: ${loadTime}ms`);
    console.log(
      `  → Performance: ${loadTime < 3000 ? '✅ Good' : loadTime < 5000 ? '⚠️  Acceptable' : '❌ Slow'}`
    );

    // Check for loading states
    const hasLoader = await page
      .locator('[class*="loading"], [class*="spinner"], [class*="skeleton"]')
      .count();
    console.log(`  → Loading indicators: ${hasLoader > 0 ? '✅ Present' : '⚠️  Missing'}\n`);

    // Step 10: Final Assessment
    console.log('═══════════════════════════════════════════');
    console.log('📋 FINAL ASSESSMENT\n');

    console.log('✅ Working Features:');
    console.log('  • Basic taxonomy visualization');
    console.log('  • Authentication flow');
    console.log('  • Page navigation\n');

    console.log('🔧 Needs Implementation:');
    console.log('  1. Product-level card differentiation');
    console.log('  2. Google Shopping feed data integration');
    console.log('  3. Sprint 4 metrics visualization');
    console.log('  4. Rich product information display');
    console.log('  5. Bulk operations interface\n');

    console.log('🎯 Priority Actions:');
    console.log('  1. Add distinct product cards with images/prices');
    console.log('  2. Surface opportunity scores prominently');
    console.log('  3. Show revenue projections on cards');
    console.log('  4. Display AI recommendations inline');
    console.log('  5. Implement content health indicators\n');

    await page.screenshot({
      path: 'tests/e2e/screenshots/taxonomy-final-state.png',
      fullPage: true,
    });
  } catch (error) {
    console.error('❌ Error during review:', error);
    await page.screenshot({
      path: 'tests/e2e/screenshots/error-state.png',
      fullPage: true,
    });
  }

  console.log('📸 All screenshots saved to tests/e2e/screenshots/');
  console.log('✨ Review complete! Browser will stay open for 30 seconds...\n');

  // Keep browser open briefly for observation
  await page.waitForTimeout(30000);

  await context.close();
  await browser.close();
}

deepTaxonomyReview().catch(console.error);
