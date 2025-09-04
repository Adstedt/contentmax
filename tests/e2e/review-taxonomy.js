const { chromium } = require('playwright');

async function reviewTaxonomyUI() {
  const browser = await chromium.launch({
    headless: false,
    slowMo: 500,
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
  });

  const page = await context.newPage();

  console.log('🎨 Starting Taxonomy UI Review...\n');

  // Navigate to the app
  await page.goto('http://localhost:3000');
  await page.waitForLoadState('networkidle');

  // Handle authentication
  console.log('🔐 Logging in...');

  // Look for email input
  const emailInput = await page
    .locator('input[type="email"], input[name="email"], input[id="email"]')
    .first();
  if (await emailInput.isVisible()) {
    await emailInput.fill('Alexander.adstedt+2@kontorab.se');

    // Find password input
    const passwordInput = await page
      .locator('input[type="password"], input[name="password"]')
      .first();
    await passwordInput.fill('KBty8611');

    // Click login button
    const loginButton = await page
      .locator('button[type="submit"], button:has-text("Sign in"), button:has-text("Log in")')
      .first();
    await loginButton.click();

    // Wait for navigation after login
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    console.log('✅ Logged in successfully\n');
  }

  // Take screenshot of landing page after auth
  await page.screenshot({ path: 'taxonomy-review-1-landing.png' });
  console.log('✅ Captured landing page\n');

  // Navigate to taxonomy map
  console.log('📍 Navigating to Taxonomy Map...');

  // Try to find and click the taxonomy link/button
  const taxonomyLink = await page
    .locator('a[href*="taxonomy"], button:has-text("Taxonomy"), [class*="taxonomy"]')
    .first();
  if (await taxonomyLink.isVisible()) {
    await taxonomyLink.click();
    await page.waitForLoadState('networkidle');
  } else {
    // Direct navigation if link not found
    await page.goto('http://localhost:3000/dashboard/taxonomy');
    await page.waitForLoadState('networkidle');
  }

  await page.screenshot({ path: 'taxonomy-review-2-main.png' });
  console.log('✅ Captured taxonomy main view\n');

  // Wait for visualization to load
  await page.waitForTimeout(2000);

  // Check for cards/nodes
  const cards = await page.locator('[class*="card"], [class*="node"], [data-testid*="taxonomy"]');
  const cardCount = await cards.count();
  console.log(`📊 Found ${cardCount} taxonomy elements\n`);

  // Try to interact with a category
  if (cardCount > 0) {
    console.log('🔍 Examining category structure...');

    // Click on first category
    const firstCard = cards.first();
    await firstCard.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'taxonomy-review-3-category.png' });
    console.log('✅ Captured category view\n');

    // Look for subcategories or products
    const subcategories = await page.locator(
      '[class*="subcategor"], [class*="child"], [class*="product"]'
    );
    const subCount = await subcategories.count();

    if (subCount > 0) {
      console.log(`📦 Found ${subCount} subcategories/products`);

      // Navigate deeper to find products
      await subcategories.first().click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'taxonomy-review-4-deeper.png' });

      // Continue drilling down to product level
      const deeperElements = await page.locator(
        '[class*="product"], [class*="item"], [class*="leaf"]'
      );
      if ((await deeperElements.count()) > 0) {
        await deeperElements.first().click();
        await page.waitForTimeout(1000);
        await page.screenshot({ path: 'taxonomy-review-5-product.png' });
        console.log('✅ Reached product level\n');
      }
    }
  }

  // Analyze Sprint 4 features
  console.log('🚀 Checking Sprint 4 Features Integration:');

  // Check for opportunity scores
  const scores = await page.locator('[class*="score"], [class*="health"], [class*="opportunity"]');
  console.log(`- Opportunity Scores: ${(await scores.count()) > 0 ? '✅ Found' : '❌ Not found'}`);

  // Check for revenue indicators
  const revenue = await page.locator(
    '[class*="revenue"], [class*="value"], [class*="dollar"], text=/\\$|revenue/i'
  );
  console.log(`- Revenue Indicators: ${(await revenue.count()) > 0 ? '✅ Found' : '❌ Not found'}`);

  // Check for recommendations
  const recommendations = await page.locator(
    '[class*="recommend"], [class*="suggestion"], [class*="insight"]'
  );
  console.log(
    `- Recommendations: ${(await recommendations.count()) > 0 ? '✅ Found' : '❌ Not found'}`
  );

  // Check for priority indicators
  const priority = await page.locator(
    '[class*="priority"], [class*="badge"], [class*="indicator"]'
  );
  console.log(
    `- Priority Indicators: ${(await priority.count()) > 0 ? '✅ Found' : '❌ Not found'}`
  );

  console.log('\n📸 Review complete! Screenshots saved.');

  // Keep browser open for manual inspection
  console.log('\n👀 Browser will remain open for manual inspection...');
  console.log('Press Ctrl+C to close when done reviewing.');

  // Wait indefinitely
  await page.waitForTimeout(300000);

  await browser.close();
}

reviewTaxonomyUI().catch(console.error);
