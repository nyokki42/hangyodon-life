const { chromium } = require('@playwright/test');

const URL = 'https://otyfyfucfqbdboltelsw.supabase.co/rest/v1/hangyodon?id=eq.1';
const KEY = 'sb_publishable_jmt7PPVYn_L7MNDBJ69otg_s6u_ulGy';

async function fetchCurrentRow() {
  const res = await fetch(URL, {
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
  });
  const text = await res.text();
  return {
    status: res.status,
    statusText: res.statusText,
    body: text,
    row: text ? JSON.parse(text)[0] : null,
  };
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const pageA = await context.newPage();
  const pageB = await context.newPage();

  pageA.on('console', msg => console.log('A LOG:', msg.type(), msg.text()));
  pageB.on('console', msg => console.log('B LOG:', msg.type(), msg.text()));
  pageA.on('pageerror', err => console.log('A PAGE ERROR:', err.message));
  pageB.on('pageerror', err => console.log('B PAGE ERROR:', err.message));

  console.log('OPEN A');
  await pageA.goto('http://localhost:60526', { waitUntil: 'domcontentloaded' });
  await pageA.waitForTimeout(2500);

  const initial = {
    money: await pageA.locator('#money-value').textContent(),
    hunger: await pageA.locator('#hunger-bar').evaluate(el => getComputedStyle(el).width),
    status: await pageA.locator('#status-message').textContent(),
  };
  console.log('INITIAL', JSON.stringify(initial));

  const rowBefore = await fetchCurrentRow();
  console.log('ROW_BEFORE', JSON.stringify(rowBefore));

  console.log('BUY ONIGIRI');
  await pageA.locator('#shop button[data-item="onigiri"]').click();
  await pageA.waitForTimeout(500);

  console.log('CLICK FEED');
  await pageA.locator('#feed-btn').click();
  await pageA.waitForTimeout(500);
  const feedButtons = pageA.locator('#feed-options button');
  console.log('FEED_BUTTONS', await feedButtons.count());
  if ((await feedButtons.count()) > 0) {
    await feedButtons.first().click();
  }
  await pageA.waitForTimeout(2000);

  const afterAction = await fetchCurrentRow();
  console.log('AFTER_ACTION', JSON.stringify(afterAction));

  console.log('RELOAD A');
  await pageA.reload({ waitUntil: 'domcontentloaded' });
  await pageA.waitForTimeout(2500);
  const aAfterReload = {
    money: await pageA.locator('#money-value').textContent(),
    hunger: await pageA.locator('#hunger-bar').evaluate(el => getComputedStyle(el).width),
    status: await pageA.locator('#status-message').textContent(),
  };
  console.log('A_AFTER_RELOAD', JSON.stringify(aAfterReload));

  console.log('OPEN B');
  await pageB.goto('http://localhost:60526', { waitUntil: 'domcontentloaded' });
  await pageB.waitForTimeout(2500);
  const bData = {
    money: await pageB.locator('#money-value').textContent(),
    hunger: await pageB.locator('#hunger-bar').evaluate(el => getComputedStyle(el).width),
    status: await pageB.locator('#status-message').textContent(),
  };
  console.log('B_STATE', JSON.stringify(bData));

  await browser.close();
})();
