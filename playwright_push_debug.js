const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ permissions: ['notifications'] });
  const page = await context.newPage();

  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  page.on('requestfailed', req => console.log('REQUEST FAILED:', req.url(), req.failure()?.errorText));

  await page.addInitScript(() => {
    const originalAdd = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function (type, listener, options) {
      if (type === 'click' && this && this.id) {
        console.log('EVENTLISTENER REGISTERED:', this.id, type);
      }
      return originalAdd.call(this, type, listener, options);
    };

    Object.defineProperty(Notification, 'permission', {
      configurable: true,
      get: () => 'default'
    });

    if (window.Notification) {
      const originalReq = Notification.requestPermission.bind(Notification);
      Notification.requestPermission = function (...args) {
        console.log('NOTIFICATION REQUEST PERMISSION CALLED');
        return Promise.resolve('granted').then((value) => {
          Object.defineProperty(Notification, 'permission', {
            configurable: true,
            get: () => 'granted'
          });
          return value;
        });
      };
    }

    if (navigator.serviceWorker) {
      const originalRegister = navigator.serviceWorker.register.bind(navigator.serviceWorker);
      navigator.serviceWorker.register = function (...args) {
        console.log('SERVICEWORKER REGISTER CALLED', args[0], args[1]);
        return originalRegister(...args).then((registration) => {
          const originalSubscribe = registration.pushManager.subscribe.bind(registration.pushManager);
          registration.pushManager.subscribe = function (...subscribeArgs) {
            console.log('PUSHMANAGER.SUBSCRIBE CALLED', subscribeArgs[0]);
            return originalSubscribe(...subscribeArgs);
          };
          return registration;
        });
      };
    }
  });

  console.log('OPENING URL');
  await page.goto('http://localhost:63953', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  const info = await page.evaluate(() => {
    const btn = document.getElementById('enable-push-btn');
    const hasBtn = !!btn;
    const btnText = btn ? btn.textContent : null;
    const btnDisplay = btn ? getComputedStyle(btn).display : null;
    const pointerEvents = btn ? getComputedStyle(btn).pointerEvents : null;
    const hasBtnClickListener = !!btn && !!btn.onclick;
    const sw = !!navigator.serviceWorker;
    const notificationPermission = 'Notification' in window ? Notification.permission : 'unsupported';
    return {
      hasBtn,
      btnText,
      btnDisplay,
      pointerEvents,
      hasBtnClickListener,
      sw,
      notificationPermission,
      hasEnableFn: typeof window.enablePushNotifications,
      hasRegisterFn: typeof window.registerPushNotificationHandlers,
      hasPushSupported: typeof window.isPushSupported === 'function' ? window.isPushSupported() : 'missing',
      serviceWorkerReady: !!navigator.serviceWorker,
    };
  });

  console.log('INFO BEFORE CLICK', JSON.stringify(info, null, 2));

  const btn = page.locator('#enable-push-btn');
  console.log('BTN COUNT', await btn.count());
  await btn.click({ timeout: 20000 });
  await page.waitForTimeout(3000);

  const after = await page.evaluate(async () => {
    const registration = navigator.serviceWorker ? await navigator.serviceWorker.getRegistration() : null;
    const ready = navigator.serviceWorker ? await navigator.serviceWorker.ready : null;
    const sub = ready ? await ready.pushManager.getSubscription() : null;
    const permission = 'Notification' in window ? Notification.permission : 'unsupported';
    return {
      permission,
      registrationExists: !!registration,
      pushManagerSupported: 'PushManager' in window,
      subscriptionExists: !!sub,
      subEndpoint: sub ? sub.endpoint : null,
      swRegs: navigator.serviceWorker ? (await navigator.serviceWorker.getRegistrations()).length : 0,
      localStoragePushEnabled: localStorage.getItem('hangyodonPushEnabled'),
      statusText: document.getElementById('status-message') ? document.getElementById('status-message').textContent : null,
      helpText: document.getElementById('push-help-text') ? document.getElementById('push-help-text').textContent : null,
    };
  });

  console.log('AFTER CLICK STATE', JSON.stringify(after, null, 2));

  await browser.close();
})();
