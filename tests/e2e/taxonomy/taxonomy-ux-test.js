const { chromium } = require('playwright');

async function testTaxonomyUX() {
  const browser = await chromium.launch({
    headless: false,
    slowMo: 300, // Slow down to observe interactions
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
  });

  const page = await context.newPage();

  console.log('1. Logging in...');
  await page.goto('http://localhost:3000/auth/login');
  await page.waitForSelector('input[type="email"]', { timeout: 10000 });
  await page.fill('input[type="email"]', 'alexander.adstedt+2@kontorab.se');
  await page.fill('input[type="password"]', 'KBty8611');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 10000 });

  console.log('2. Navigating to taxonomy visualization...');
  await page.goto('http://localhost:3000/dashboard/taxonomy');
  await page.waitForSelector('canvas', { timeout: 10000 });

  // Wait for initial render
  await page.waitForTimeout(3000);

  console.log('3. Testing initial view...');
  await page.screenshot({ path: 'taxonomy-ux-initial.png' });

  // Get canvas element
  const canvas = await page.locator('canvas');
  const box = await canvas.boundingBox();

  if (!box) {
    console.error('Canvas not found');
    return;
  }

  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;

  console.log('4. Testing zoom levels...');

  // Zoom in slightly (1.5x)
  await page.mouse.move(centerX, centerY);
  await page.mouse.wheel(0, -200);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'taxonomy-ux-zoom-1.5x.png' });

  // Zoom in more (2.5x)
  await page.mouse.wheel(0, -300);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'taxonomy-ux-zoom-2.5x.png' });

  // Pan to explore different areas
  console.log('5. Testing panning to different categories...');
  await page.mouse.down();
  await page.mouse.move(centerX + 200, centerY);
  await page.mouse.up();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'taxonomy-ux-panned.png' });

  // Test product toggle
  console.log('6. Testing product toggle...');
  const productToggle = await page.locator('button:has-text("Show Products")').first();
  if (await productToggle.isVisible()) {
    await productToggle.click();
    await page.waitForTimeout(2000);

    // Zoom in further for products
    await page.mouse.wheel(0, -400);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'taxonomy-ux-products.png' });
  }

  // Reset zoom
  console.log('7. Testing zoom out to overview...');
  await page.mouse.wheel(0, 800);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'taxonomy-ux-overview.png' });

  // Test interactions with nodes
  console.log('8. Testing node interactions...');
  await page.mouse.move(centerX - 100, centerY);
  await page.mouse.click(centerX - 100, centerY);
  await page.waitForTimeout(1000);

  // Observe for visual issues
  console.log('\n=== UX Observations ===');
  console.log('Check screenshots for:');
  console.log('- Node overlap at different zoom levels');
  console.log('- Label clarity and readability');
  console.log('- Smooth transitions between zoom levels');
  console.log('- Parent-child clustering effectiveness');
  console.log('- Overall visual hierarchy');

  console.log('\nKeeping browser open for manual inspection...');
  await page.waitForTimeout(30000);

  await browser.close();
}

testTaxonomyUX().catch(console.error);
