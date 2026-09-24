const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const pageA = await context.newPage();
  const pageB = await context.newPage();

  const URL = 'https://otyfyfucfqbdboltelsw.supabase.co/rest/v1/hangyodon?id=eq.1';
  const KEY = 'sb_publishable_jmt7PPVYn_L7MNDBJ69otg_s6u_ulGy';

  const fetchRow = async () => {
    const res = await fetch(URL, {
      headers: {
        apikey: KEY,
        Authorization: 'Bearer ' + KEY,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    });
    const text = await res.text();
    return JSON.parse(text)[0];
  };

  await pageA.goto('http://localhost:60526', { waitUntil: 'domcontentloaded' });
  await pageA.waitForTimeout(2500);
  await pageB.goto('http://localhost:60526', { waitUntil: 'domcontentloaded' });
  await pageB.waitForTimeout(2500);

  console.log('START_A', await pageA.locator('#inventory-list').textContent());
  console.log('START_B', await pageB.locator('#inventory-list').textContent());

  await pageA.locator('#shop button[data-item="onigiri"]').click();
  await pageA.locator('#feed-btn').click();
  const feedButtons = pageA.locator('#feed-options button');
  const count = await feedButtons.count();
  console.log('FEED_COUNT', count);
  if (count > 0) {
    await feedButtons.first().click();
  }
  await pageA.waitForTimeout(2500);

  const rowAfter = await fetchRow();
  console.log('ROW_AFTER', JSON.stringify(rowAfter));

  await pageB.reload({ waitUntil: 'domcontentloaded' });
  await pageB.waitForTimeout(2500);
  console.log('B_AFTER_RELOAD', await pageB.locator('#inventory-list').textContent());

  await browser.close();
})();
