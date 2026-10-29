self.addEventListener('push', (event) => {
  event.waitUntil(
    (async () => {
      let data;
      try {
        data = event.data?.json();
      } catch {
        return;
      }
      if (!data || typeof data.id !== 'string') return;
      await self.registration.showNotification('Forest Flow', {
        body:
          typeof data.body === 'string'
            ? data.body
            : 'Há uma atualização para você no Forest Flow.',
        icon: '/favicon.svg',
        badge: '/favicon.svg',
        tag: 'forest-flow-' + data.id,
        data: { url: '/?notification=' + encodeURIComponent(data.id) },
      });
    })(),
  );
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const url = new URL(
        event.notification.data?.url || '/',
        self.location.origin,
      );
      if (url.origin !== self.location.origin) return;
      const windows = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });
      for (const window of windows) {
        if (new URL(window.url).origin === url.origin) {
          await window.navigate(url.href);
          await window.focus();
          return;
        }
      }
      await self.clients.openWindow(url.href);
    })(),
  );
});
