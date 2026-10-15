const CACHE_NAME = 'telegrand-v1';
const RUNTIME_CACHE = 'telegrand-runtime';

// Файлы для кеша при установке
const PRECACHE_URLS = [
  '/tg/',
  '/tg/index.html',
  '/tg/manifest.json'
];

// Установка SW
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// Активация SW
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME && name !== RUNTIME_CACHE)
          .map(name => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Стратегия: Network first, fallback к кешу
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Пропускаем запросы к Supabase (всегда в сеть)
  if (url.hostname.includes('supabase.co')) {
    return;
  }

  // Только GET
  if (request.method !== 'GET') return;

  event.respondWith(
    fetch(request)
      .then(response => {
        // Кешируем ответ
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(RUNTIME_CACHE).then(cache => {
            cache.put(request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Офлайн — берём из кеша
        return caches.match(request).then(cached => {
          if (cached) return cached;
          // Если это HTML — вернуть index
          if (request.headers.get('accept')?.includes('text/html')) {
            return caches.match('/tg/index.html');
          }
        });
      })
  );
});

// Push-уведомления
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Telegrand';
  const options = {
    body: data.body || 'Новое сообщение',
    icon: '/tg/icon-192.png',
    badge: '/tg/icon-192.png',
    vibrate: [200, 100, 200],
    tag: data.tag || 'message',
    data: data.url || '/tg/'
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Клик на уведомление
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data || '/tg/';
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(windowClients => {
      for (let client of windowClients) {
        if (client.url.includes('/tg/') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});
