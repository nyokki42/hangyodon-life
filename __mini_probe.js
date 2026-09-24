const { chromium } = require('playwright');
(async () => {
  console.log('start');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('http://localhost:4173');
  console.log('loaded');
  await page.waitForSelector('#feed-btn');
  console.log('button found');
  await browser.close();
  console.log('done');
})();
