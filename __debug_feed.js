const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on('console', msg => console.log('BROWSER:', msg.text()));
  page.on('pageerror', err => console.log('PAGEERROR:', err.message));

  await page.goto('http://localhost:4173');
  await page.evaluate(() => {
    localStorage.setItem('hangyodonSave', JSON.stringify({
      hunger: 60,
      mood: 40,
      level: 1,
      exp: 0,
      money: 1000,
      inventory: { onigiri: 2, pan: 1 },
      sleeping: false,
      sleep_start_at: null,
      sleep_end_at: null,
      sleep_schedule_date: null,
      game_over: false,
      meetingDate: new Date().toISOString(),
      lastBathDate: null,
      lastHungerNotificationDate: null,
      lastJobTime: 0,
      sleepStartHour: 22,
      wakeUpHour: 6
    }));
    localStorage.setItem('jobLastTime', '0');
  });
  await page.reload();
  await page.waitForTimeout(500);
  const result = await page.evaluate(() => {
    const btn = document.getElementById('feed-btn');
    btn.click();
    return {
      disabled: btn.disabled,
      menuDisplay: document.getElementById('feed-menu').style.display,
      optionsCount: document.querySelectorAll('#feed-options button').length
    };
  });
  console.log('RESULT', result);
  await browser.close();
})();
