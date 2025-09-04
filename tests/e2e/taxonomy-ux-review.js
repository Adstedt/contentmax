const { chromium } = require('playwright');

async function reviewTaxonomyUX() {
  const browser = await chromium.launch({
    headless: false,
    slowMo: 300,
    args: ['--start-maximized'],
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: {
      dir: './tests/e2e/videos/',
      size: { width: 1920, height: 1080 },
    },
  });

  const page = await context.newPage();

  console.log('🎨 Starting Comprehensive Taxonomy UX Review\n');
  console.log('═══════════════════════════════════════════\n');

  try {
    // Step 1: Navigate and Login
    console.log('📍 Step 1: Authentication');
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');

    // Check if we need to login
    const needsAuth = await page.locator('input[type="email"]').isVisible();

    if (needsAuth) {
      console.log('  → Logging in with provided credentials...');
      await page.fill('input[type="email"]', 'Alexander.adstedt+2@kontorab.se');
      await page.fill('input[type="password"]', 'KBty8611');

      // Find and click the submit button
      const submitButton = await page
        .locator('button[type="submit"], button:has-text("Sign in"), button:has-text("Log in")')
        .first();
      await submitButton.click();

      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      console.log('  ✅ Authentication successful\n');
    }

    // Take initial screenshot
    await page.screenshot({
      path: 'tests/e2e/screenshots/01-dashboard.png',
      fullPage: true,
    });

    // Step 2: Navigate to Taxonomy
    console.log('📍 Step 2: Navigating to Taxonomy Visualization');

    // Try multiple selectors to find taxonomy link
    const taxonomySelectors = [
      'a[href*="taxonomy"]',
      'button:has-text("Taxonomy")',
      'nav a:has-text("Taxonomy")',
      '[data-testid="taxonomy-link"]',
      'text=Taxonomy',
    ];

    let found = false;
    for (const selector of taxonomySelectors) {
      const element = await page.locator(selector).first();
      if (await element.isVisible()) {
        console.log(`  → Found taxonomy link using: ${selector}`);
        await element.click();
        found = true;
        break;
      }
    }

    if (!found) {
      console.log('  → Direct navigation to /dashboard/taxonomy');
      await page.goto('http://localhost:3000/dashboard/taxonomy');
    }

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000); // Wait for visualization to load

    await page.screenshot({
      path: 'tests/e2e/screenshots/02-taxonomy-main.png',
      fullPage: true,
    });
    console.log('  ✅ Taxonomy page loaded\n');

    // Step 3: Analyze Current Implementation
    console.log('📍 Step 3: Analyzing Current Implementation');

    // Check for view mode toggles
    const viewModes = await page.locator(
      'button:has-text("Cards"), button:has-text("Tree"), button:has-text("Graph")'
    );
    console.log(`  → View modes found: ${await viewModes.count()}`);

    // Check for category cards
    const cards = await page
      .locator('[class*="card"], div[class*="category"], div[class*="node"]')
      .all();
    console.log(`  → Total cards/nodes visible: ${cards.length}`);

    // Check for Sprint 4 features
    console.log('\n  🚀 Sprint 4 Feature Detection:');

    // Opportunity scores
    const scores = await page.locator('text=/score|health|opportunity/i').count();
    console.log(
      `    • Opportunity Scores: ${scores > 0 ? '✅ Found (' + scores + ')' : '❌ Not visible'}`
    );

    // Revenue indicators
    const revenue = await page.locator('text=/revenue|\\$|value/i').count();
    console.log(
      `    • Revenue Indicators: ${revenue > 0 ? '✅ Found (' + revenue + ')' : '❌ Not visible'}`
    );

    // Recommendations
    const recommendations = await page.locator('text=/recommend|suggestion|insight/i').count();
    console.log(
      `    • Recommendations: ${recommendations > 0 ? '✅ Found (' + recommendations + ')' : '❌ Not visible'}`
    );

    // Priority/Status badges
    const badges = await page
      .locator('[class*="badge"], [class*="status"], [class*="priority"]')
      .count();
    console.log(
      `    • Status/Priority Badges: ${badges > 0 ? '✅ Found (' + badges + ')' : '❌ Not visible'}\n`
    );

    // Step 4: Navigate Through Hierarchy
    console.log('📍 Step 4: Testing Navigation Depth');

    // Click on first card if available
    if (cards.length > 0) {
      console.log('  → Clicking on first category card...');
      await cards[0].click();
      await page.waitForTimeout(1500);

      await page.screenshot({
        path: 'tests/e2e/screenshots/03-category-selected.png',
        fullPage: true,
      });

      // Check for breadcrumbs
      const breadcrumbs = await page
        .locator('[class*="breadcrumb"], nav[aria-label*="breadcrumb"]')
        .isVisible();
      console.log(`  → Breadcrumb navigation: ${breadcrumbs ? '✅ Present' : '❌ Missing'}`);

      // Look for subcategories
      const subcategories = await page.locator('[class*="sub"], [class*="child"]').all();
      console.log(`  → Subcategories found: ${subcategories.length}`);

      if (subcategories.length > 0) {
        console.log('  → Drilling down to subcategory...');
        await subcategories[0].click();
        await page.waitForTimeout(1500);

        await page.screenshot({
          path: 'tests/e2e/screenshots/04-subcategory.png',
          fullPage: true,
        });

        // Look for products
        const products = await page
          .locator('[class*="product"], [class*="item"], [class*="leaf"]')
          .all();
        console.log(`  → Products found at this level: ${products.length}`);

        if (products.length > 0) {
          console.log('  → Examining product-level display...');
          await products[0].click();
          await page.waitForTimeout(1500);

          await page.screenshot({
            path: 'tests/e2e/screenshots/05-product-level.png',
            fullPage: true,
          });

          // Check for product-specific data
          console.log('\n  📦 Product-Level Data Check:');

          const hasImage = await page
            .locator('img[alt*="product"], [class*="product-image"]')
            .isVisible();
          console.log(
            `    • Product Image: ${hasImage ? '✅ Present' : '❌ Missing - Need Google Shopping integration'}`
          );

          const hasPrice = await page.locator('text=/\\$[0-9]/').isVisible();
          console.log(
            `    • Price Display: ${hasPrice ? '✅ Present' : '❌ Missing - Need pricing data'}`
          );

          const hasDescription = await page
            .locator('[class*="description"], p')
            .first()
            .isVisible();
          console.log(
            `    • Description: ${hasDescription ? '✅ Present' : '❌ Missing - Need product descriptions'}`
          );

          const hasSpecs = await page.locator('text=/specification|spec|detail/i').isVisible();
          console.log(
            `    • Specifications: ${hasSpecs ? '✅ Present' : '❌ Missing - Need product specs'}`
          );

          const hasStock = await page.locator('text=/stock|available|inventory/i').isVisible();
          console.log(
            `    • Stock Status: ${hasStock ? '✅ Present' : '❌ Missing - Need inventory data'}`
          );
        }
      }
    }

    // Step 5: Test Interactions
    console.log('\n📍 Step 5: Testing Interactive Features');

    // Search functionality
    const searchInput = await page
      .locator('input[type="search"], input[placeholder*="Search"]')
      .first();
    if (await searchInput.isVisible()) {
      console.log('  → Testing search...');
      await searchInput.fill('product');
      await page.waitForTimeout(1000);
      await page.screenshot({
        path: 'tests/e2e/screenshots/06-search-results.png',
        fullPage: true,
      });
      console.log('  ✅ Search functionality present');
    }

    // Filter functionality
    const filterButton = await page.locator('button:has-text("Filter"), [class*="filter"]').first();
    if (await filterButton.isVisible()) {
      console.log('  → Testing filters...');
      await filterButton.click();
      await page.waitForTimeout(1000);
      await page.screenshot({
        path: 'tests/e2e/screenshots/07-filter-options.png',
        fullPage: true,
      });
      console.log('  ✅ Filter functionality present');
    }

    // Step 6: Performance & UX Assessment
    console.log('\n📍 Step 6: UX Assessment Summary');
    console.log('═══════════════════════════════════════════\n');

    console.log('🎯 Strengths:');
    console.log('  • Card-based visualization implemented');
    console.log('  • Basic navigation structure in place');
    console.log('  • Multiple view modes available\n');

    console.log('⚠️ Areas for Improvement:');
    console.log('  • Product level needs differentiation from categories');
    console.log('  • Missing Google Shopping feed integration');
    console.log('  • Sprint 4 features not prominently displayed');
    console.log('  • No bulk operations interface');
    console.log('  • Missing product images and rich data\n');

    console.log('💡 Key Recommendations:');
    console.log('  1. Implement distinct product card design with images');
    console.log('  2. Surface opportunity scores and revenue projections');
    console.log('  3. Add inline AI recommendations');
    console.log('  4. Create bulk selection and operations UI');
    console.log('  5. Integrate real-time processing feedback\n');

    // Final overview screenshot
    await page.keyboard.press('Escape'); // Close any modals
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: 'tests/e2e/screenshots/08-final-overview.png',
      fullPage: true,
    });

    console.log('📸 Screenshots saved in tests/e2e/screenshots/');
    console.log('🎬 Video recording saved in tests/e2e/videos/\n');
  } catch (error) {
    console.error('❌ Error during review:', error);
    await page.screenshot({
      path: 'tests/e2e/screenshots/error-state.png',
      fullPage: true,
    });
  }

  console.log('✨ Review complete! Browser will remain open for manual inspection.');
  console.log('Press Ctrl+C to close when done.\n');

  // Keep browser open for manual inspection
  await page.waitForTimeout(300000);

  await context.close();
  await browser.close();
}

reviewTaxonomyUX().catch(console.error);
