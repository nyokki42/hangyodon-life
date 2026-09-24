const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('http://localhost:60526', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  console.log('B_MONEY', await page.locator('#money-value').textContent());
  console.log('B_LEVEL', await page.locator('#level-value').textContent());
  console.log('B_STATUS', await page.locator('#status-message').textContent());
  await browser.close();
})();
