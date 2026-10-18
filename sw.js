/* Telegrand Service Worker v2.0 — офлайн-кэш */
const CACHE_NAME = 'telegrand-v3';
const APP_SHELL = ['./index.html', './manifest.json', './icon-192.png'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(c => c.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Supabase API: network-first, при офлайне — из кэша
  if (url.hostname.includes('supabase.co')) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Статика: cache-first с обновлением в фоне
  if (e.request.method === 'GET') {
    e.respondWith(
      caches.match(e.request).then(cached => {
        const network = fetch(e.request).then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
          }
          return res;
        }).catch(() => cached);
        return cached || network;
      })
    );
  }
});

// Push-уведомления (заготовка)
self.addEventListener('push', e => {
  let data = {};
  try { data = e.data.json(); } catch(_) { data = { title: 'Telegrand', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(
    self.registration.showNotification(data.title || 'Telegrand', {
      body: data.body || 'Новое сообщение',
      icon: 'icon-192.png',
      badge: 'icon-192.png'
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then(cs => {
    if (cs.length) return cs[0].focus();
    return self.clients.openWindow('./index.html');
  }));
});
