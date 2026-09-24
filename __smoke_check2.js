const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on('console', msg => console.log('BROWSER:', msg.text()));
  page.on('pageerror', err => console.log('PAGEERROR:', err.message));

  await page.goto('http://localhost:4173', { waitUntil: 'load' });
  await page.evaluate(() => {
    localStorage.setItem('hangyodonSave', JSON.stringify({
      hunger: 60, mood: 40, level: 1, exp: 0, money: 1000,
      inventory: { onigiri: 2, pan: 1 }, sleeping: false,
      sleep_start_at: null, sleep_end_at: null, sleep_schedule_date: null,
      game_over: false, meetingDate: new Date().toISOString(),
      lastBathDate: null, lastHungerNotificationDate: null, lastJobTime: 0,
      sleepStartHour: 22, wakeUpHour: 6
    }));
    localStorage.setItem('jobLastTime', '0');
  });
  await page.reload({ waitUntil: 'load' });
  console.log('before click');
  try {
    await page.click('#feed-btn', { timeout: 5000 });
    console.log('after click success');
  } catch (e) {
    console.log('click error:', e.message);
  }
  console.log('before menu query');
  try {
    const menu = await page.waitForSelector('#feed-menu', { state: 'visible', timeout: 5000 });
    console.log('menu visible', !!menu);
  } catch (e) {
    console.log('menu wait error:', e.message);
  }
  await browser.close();
  console.log('closed');
})();
