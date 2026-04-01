// ════════════════════════════════════════════════════════
//  BodyLens Service Worker  v1
//  - Offline shell caching
//  - Background sync for API calls
//  - Push notification handling
// ════════════════════════════════════════════════════════

const CACHE_NAME = 'bodylens-v3';
const CACHE_DURATION_DAYS = 7;

// Shell files — cached on install for offline fallback only
// Navigation uses network-first, so these are the offline fallback copies
const SHELL_FILES = [
  '/',
  '/index.html',
  '/bodylens-login.html',
  '/style.css',
  '/nav.js',
  '/coach.js',
  '/profile-inject.js',
  '/bodylens-dailyplan.html',
  '/bodylens-week.html',
  '/bodylens-instructions.html',
  '/bodylens-food.html',
  '/bodylens-programme.html',
  '/bodylens-science.html',
  '/bodylens-guide.html',
  '/bodylens-accelerators.html',
  '/bodylens-checkin.html',
  '/manifest.json',
];

// ── INSTALL ──────────────────────────────────────────────
self.addEventListener('install', evt => {
  evt.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL_FILES.map(url => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
      .catch(err => console.warn('[SW] Install cache failed:', err))
  );
});

// ── ACTIVATE ─────────────────────────────────────────────
self.addEventListener('activate', evt => {
  evt.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys
        .filter(k => k !== CACHE_NAME)
        .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH ─────────────────────────────────────────────────
self.addEventListener('fetch', evt => {
  const url = new URL(evt.request.url);

  // Never intercept API calls — always go to network
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // For navigation requests — network-first so HTML is always fresh.
  // Falls back to cache only when offline.
  if (evt.request.mode === 'navigate') {
    evt.respondWith(
      fetch(evt.request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(c => c.put(evt.request, clone));
        }
        return response;
      }).catch(() =>
        caches.match(evt.request)
          .then(cached => cached || caches.match('/bodylens-dailyplan.html'))
      )
    );
    return;
  }

  // For static assets — cache-first
  if (['style', 'script', 'font', 'image'].includes(evt.request.destination)) {
    evt.respondWith(
      caches.match(evt.request).then(cached => {
        if (cached) return cached;
        return fetch(evt.request).then(response => {
          if (response && response.status === 200 && url.origin === self.location.origin) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(c => c.put(evt.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }
});

// ── PUSH NOTIFICATIONS ────────────────────────────────────
self.addEventListener('push', evt => {
  if (!evt.data) return;

  let data;
  try {
    data = evt.data.json();
  } catch(e) {
    data = { title: 'BodyLens', body: evt.data.text() };
  }

  const options = {
    body:    data.body    || '',
    icon:    data.icon    || '/icons/icon-192.png',
    badge:   data.badge   || '/icons/icon-192.png',
    tag:     data.tag     || 'bodylens',
    data:    data.url     ? { url: data.url } : {},
    actions: data.actions || [],
    requireInteraction: data.requireInteraction || false,
    silent:  data.silent  || false,
  };

  evt.waitUntil(
    self.registration.showNotification(data.title || 'BodyLens', options)
  );
});

// ── NOTIFICATION CLICK ────────────────────────────────────
self.addEventListener('notificationclick', evt => {
  evt.notification.close();
  const targetUrl = (evt.notification.data && evt.notification.data.url)
    ? evt.notification.data.url
    : '/bodylens-dailyplan.html';

  evt.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});

// ── BACKGROUND SYNC (for future use) ─────────────────────
self.addEventListener('sync', evt => {
  if (evt.tag === 'bodylens-nudge') {
    // Future: generate daily nudge in background
    evt.waitUntil(Promise.resolve());
  }
});

// ── MESSAGE FROM PAGE ─────────────────────────────────────
self.addEventListener('message', evt => {
  if (evt.data && evt.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (evt.data && evt.data.type === 'GET_VERSION') {
    evt.ports[0].postMessage({ version: CACHE_NAME });
  }
});
