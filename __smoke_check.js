const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  console.log('browser started');

  await page.goto('http://localhost:4173');
  console.log('page loaded');

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
  console.log('reloaded');

  await page.waitForSelector('#feed-btn');
  console.log('feed-btn found');
  await page.click('#feed-btn');
  console.log('feed-btn clicked');
  await page.waitForSelector('#feed-options button');
  console.log('feed-menu visible');

  await browser.close();
  console.log('browser closed');
})();
