const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on('console', msg => console.log('BROWSER LOG:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  page.on('response', resp => {
    if (resp.url().includes('supabase')) {
      console.log('NETWORK', resp.status(), resp.url());
    }
  });

  try {
    await page.goto('http://localhost:60526', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    console.log('BEFORE', await page.locator('#money-value').textContent(), await page.locator('#inventory-list').textContent());
    await page.locator('#shop button[data-item="onigiri"]').click();
    await page.waitForTimeout(500);
    console.log('AFTER BUY', await page.locator('#money-value').textContent(), await page.locator('#inventory-list').textContent());
    await page.locator('#feed-btn').click();
    await page.waitForTimeout(500);
    console.log('AFTER FEED MENU', await page.locator('#inventory-list').textContent(), await page.locator('#feed-options').textContent());
    const buttons = page.locator('#feed-options button');
    console.log('COUNT', await buttons.count());
    if (await buttons.count()) {
      await buttons.first().click();
    }
    await page.waitForTimeout(2000);
    console.log('AFTER FEED', await page.locator('#money-value').textContent(), await page.locator('#inventory-list').textContent());
    const KEY = 'sb_publishable_jmt7PPVYn_L7MNDBJ69otg_s6u_ulGy';
    const res = await fetch('https://otyfyfucfqbdboltelsw.supabase.co/rest/v1/hangyodon?id=eq.1', {
      headers: {
        apikey: KEY,
        Authorization: 'Bearer ' + KEY,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    });
    console.log('FETCH_STATUS', res.status, res.statusText);
    const text = await res.text();
    console.log('FETCH_BODY', text.slice(0, 1500));
  } catch (e) {
    console.error('TOP_ERROR', e);
  } finally {
    await browser.close();
  }
})();
