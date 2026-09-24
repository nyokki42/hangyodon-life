const { chromium } = require('@playwright/test');

const URL = 'https://otyfyfucfqbdboltelsw.supabase.co/rest/v1/hangyodon?id=eq.1';
const KEY = 'sb_publishable_jmt7PPVYn_L7MNDBJ69otg_s6u_ulGy';

async function fetchRow() {
  const res = await fetch(URL, {
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
  });
  const text = await res.text();
  return { status: res.status, row: JSON.parse(text)[0] };
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const pageA = await browser.newPage();
  const pageB = await browser.newPage();

  const rowBefore = await fetchRow();
  console.log('ROW_BEFORE', JSON.stringify(rowBefore));

  await pageA.goto('http://localhost:60526', { waitUntil: 'domcontentloaded' });
  await pageA.waitForTimeout(3000);
  const aState = {
    money: await pageA.locator('#money-value').textContent(),
    level: await pageA.locator('#level-value').textContent(),
    status: await pageA.locator('#status-message').textContent(),
  };
  console.log('PAGE_A', JSON.stringify(aState));

  await pageA.reload({ waitUntil: 'domcontentloaded' });
  await pageA.waitForTimeout(3000);
  const aReloadState = {
    money: await pageA.locator('#money-value').textContent(),
    level: await pageA.locator('#level-value').textContent(),
    status: await pageA.locator('#status-message').textContent(),
  };
  console.log('PAGE_A_RELOAD', JSON.stringify(aReloadState));

  await pageB.goto('http://localhost:60526', { waitUntil: 'domcontentloaded' });
  await pageB.waitForTimeout(3000);
  const bState = {
    money: await pageB.locator('#money-value').textContent(),
    level: await pageB.locator('#level-value').textContent(),
    status: await pageB.locator('#status-message').textContent(),
  };
  console.log('PAGE_B', JSON.stringify(bState));

  const rowAfter = await fetchRow();
  console.log('ROW_AFTER', JSON.stringify(rowAfter));

  await browser.close();
})();
