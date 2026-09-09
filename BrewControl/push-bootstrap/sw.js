// Service worker for BrewControl push notifications.
//
// It does no caching and serves nothing — this page is not an offline app. Its
// only job is to exist so the browser has somewhere to deliver a push to, and
// to carry the click back to the device.

self.addEventListener('install', (event) => {
  // Skip the usual "wait for the old worker" dance: there is no old state to
  // keep consistent, and the user is standing in front of the setup page.
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'BrewControl', body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'BrewControl';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      // The device tags by source, so a second alert from the same sensor
      // replaces the first instead of stacking up.
      tag: data.tag || 'brewcontrol',
      renotify: true,
      icon: 'icon-192.png',
      badge: 'icon-192.png',
      data: data.data || {},
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  // The device puts its current address in here on every push, so a renamed or
  // readdressed device still lands in the right place.
  const url = event.notification.data && event.notification.data.url;
  if (!url) return;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      // Reuse a tab that is already on this device rather than piling up new ones.
      for (const client of list) {
        if (client.url.startsWith(url) && 'focus' in client) return client.focus();
      }
      // https -> http is fine here: this is a top-level navigation, not a fetch.
      return self.clients.openWindow(url);
    })
  );
});
