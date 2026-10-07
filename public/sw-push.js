// EDITOK Push Notification Service Worker
// Handles push events and notification taps for Customer and Admin mobile apps.

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let payload = { title: 'EDITOK', body: 'You have a new notification', data: {} };
  try {
    if (event.data) {
      payload = event.data.json();
    }
  } catch {
    payload = { title: 'EDITOK', body: event.data ? event.data.text() : 'New notification', data: {} };
  }

  const options = {
    body: payload.body,
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    data: payload.data || {},
    vibrate: [100, 50, 100],
    requireInteraction: false,
  actions: [
      { action: 'open', title: 'Open' },
    ],
  };

  const channel = new BroadcastChannel('editok-push');
  channel.postMessage(payload);
  channel.close();

  event.waitUntil(
    self.registration.showNotification(payload.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const targetPage = data.page || '';
  const targetParams = data.params ? `?params=${encodeURIComponent(JSON.stringify(data.params))}` : '';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          if (targetPage) {
            client.postMessage({ type: 'NAVIGATE', page: targetPage, params: data.params });
          }
          return client.focus();
        }
      }
      const url = targetPage ? `/#${targetPage}${targetParams}` : '/';
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'NAVIGATE') {
    const targetPage = event.data.page || '';
    const targetParams = event.data.params ? `?params=${encodeURIComponent(JSON.stringify(event.data.params))}` : '';
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(targetPage ? `/#${targetPage}${targetParams}` : '/');
          return client.focus();
        }
      }
    });
  }
});
