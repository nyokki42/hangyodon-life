self.addEventListener('push', (event) => {
  const payload = event.data && event.data.json ? event.data.json() : {
    title: '🍙 ハンギョドン∞ライフ',
    body: 'ハンギョドンがお腹すいてるよ！',
    icon: './hangyo_open.png',
    tag: 'hangyodon-hunger-low'
  };

  const options = {
    body: payload.body || '🍙 ハンギョドンがお腹すいてるよ！',
    icon: payload.icon || './hangyo_open.png',
    badge: payload.badge || './hangyo_open.png',
    tag: payload.tag || 'hangyodon-hunger-low',
    requireInteraction: true,
    vibrate: [200, 100, 200],
    data: {
      url: payload.url || new URL('./', self.registration.scope).toString()
    }
  };

  event.waitUntil(self.registration.showNotification(payload.title || '🍙 ハンギョドン∞ライフ', options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data && event.notification.data.url
    ? event.notification.data.url
    : new URL('./', self.registration.scope).toString();

  event.waitUntil(clients.openWindow(targetUrl));
});
