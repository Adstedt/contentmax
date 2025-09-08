const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    headless: false,
    slowMo: 500,
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
  });

  const page = await context.newPage();

  console.log('Navigating to taxonomy visualization...');
  await page.goto('http://localhost:3000/dashboard/taxonomy', {
    waitUntil: 'networkidle',
  });

  // Wait for canvas to render
  await page.waitForTimeout(3000);
  console.log('Canvas loaded, taking initial screenshot...');
  await page.screenshot({ path: 'focus-mode-initial.png' });

  // Click the Focus Mode button
  const focusButton = await page.locator('button:has-text("Enable Focus")');
  await focusButton.click();
  console.log('Focus mode enabled');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'focus-mode-enabled.png' });

  // Zoom in to see the effect better
  const canvas = await page.locator('canvas').first();
  const canvasBounds = await canvas.boundingBox();

  if (canvasBounds) {
    // Zoom in with mouse wheel at center
    await page.mouse.move(
      canvasBounds.x + canvasBounds.width / 2,
      canvasBounds.y + canvasBounds.height / 2
    );

    for (let i = 0; i < 5; i++) {
      await page.mouse.wheel(0, -100);
      await page.waitForTimeout(300);
    }

    console.log('Zoomed in with focus mode');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'focus-mode-zoomed.png' });

    // Pan to different area to see focus change
    await page.mouse.down();
    await page.mouse.move(
      canvasBounds.x + canvasBounds.width / 2 - 200,
      canvasBounds.y + canvasBounds.height / 2
    );
    await page.mouse.up();

    console.log('Panned to different area');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'focus-mode-panned.png' });
  }

  // Toggle focus mode off
  const disableFocusButton = await page.locator('button:has-text("Disable Focus")');
  await disableFocusButton.click();
  console.log('Focus mode disabled');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'focus-mode-disabled.png' });

  console.log('Test completed! Check the screenshots.');
  await browser.close();
})();
