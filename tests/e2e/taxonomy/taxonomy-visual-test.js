const { chromium } = require('playwright');

async function testTaxonomyVisualization() {
  const browser = await chromium.launch({
    headless: false, // Show the browser so we can see what's happening
    slowMo: 500, // Slow down actions to observe behavior
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
  });

  const page = await context.newPage();

  console.log('1. Navigating to login page...');
  await page.goto('http://localhost:3000/auth/login');

  // Wait for login form
  await page.waitForSelector('input[type="email"]', { timeout: 10000 });

  console.log('2. Logging in...');
  await page.fill('input[type="email"]', 'alexander.adstedt+2@kontorab.se');
  await page.fill('input[type="password"]', 'KBty8611');

  // Click login button
  await page.click('button[type="submit"]');

  // Wait for redirect to dashboard
  await page.waitForURL('**/dashboard', { timeout: 10000 });

  console.log('3. Navigating to taxonomy page...');
  await page.goto('http://localhost:3000/dashboard/taxonomy');

  // Wait for initial page load
  await page.waitForTimeout(1000);

  // Take screenshot of initial state (likely black screen)
  console.log('4. Taking screenshot of initial state...');
  await page.screenshot({
    path: 'taxonomy-initial.png',
    fullPage: false,
  });

  // Wait for visualization container
  console.log('5. Waiting for visualization to appear...');
  await page.waitForSelector('canvas', { timeout: 10000 });

  // Take screenshot after canvas appears
  await page.waitForTimeout(2000);
  console.log('6. Taking screenshot after canvas loads...');
  await page.screenshot({
    path: 'taxonomy-canvas-loaded.png',
    fullPage: false,
  });

  // Wait for animation to potentially settle
  console.log('7. Waiting for animation to settle...');
  await page.waitForTimeout(5000);

  console.log('8. Taking screenshot after animation...');
  await page.screenshot({
    path: 'taxonomy-after-animation.png',
    fullPage: false,
  });

  // Test interactivity
  console.log('9. Testing zoom interaction...');
  await page.mouse.wheel(0, -100); // Zoom in
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: 'taxonomy-zoomed.png',
    fullPage: false,
  });

  // Check for console errors
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.log('Console error:', msg.text());
    }
  });

  // Get page metrics
  const performance = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    return {
      canvasExists: !!canvas,
      canvasWidth: canvas?.width,
      canvasHeight: canvas?.height,
      canvasStyle: canvas ? window.getComputedStyle(canvas).cssText : null,
    };
  });

  console.log('Canvas info:', performance);

  // Keep browser open for observation
  console.log('\n10. Browser staying open for manual inspection...');
  console.log(
    'Check the screenshots: taxonomy-initial.png, taxonomy-canvas-loaded.png, taxonomy-after-animation.png'
  );

  // Wait for manual close
  await page.waitForTimeout(30000);

  await browser.close();
}

testTaxonomyVisualization().catch(console.error);
