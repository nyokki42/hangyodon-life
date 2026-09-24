const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 430, height: 932 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    isMobile: true,
    hasTouch: true,
    locale: 'ja-JP',
    timezoneId: 'Asia/Tokyo'
  });
  const page = await context.newPage();
  await page.goto('http://localhost:8000', { waitUntil: 'networkidle', timeout: 30000 });

  await page.evaluate(() => {
    const bubble = document.getElementById('comment-bubble');
    bubble.textContent = 'お腹すいたよ〜';
    bubble.style.display = 'block';
  });

  const info = await page.evaluate(() => {
    const rect = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { top: r.top, left: r.left, width: r.width, height: r.height, bottom: r.bottom, right: r.right };
    };
    return {
      bubble: rect('#comment-bubble'),
      img: rect('.character-img'),
      character: rect('.character'),
      feed: rect('#feed-btn'),
      admin: rect('#admin-btn'),
      bodyScrollHeight: document.body.scrollHeight,
      bodyScrollWidth: document.body.scrollWidth,
      innerHeight: window.innerHeight,
      innerWidth: window.innerWidth
    };
  });

  console.log(JSON.stringify(info, null, 2));
  await browser.close();
})();
