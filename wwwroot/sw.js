// TaskNest service worker: app-shell precache, API caching and Background Sync.
const CACHE_VERSION = 'v2';
const SHELL_CACHE = `tasknest-shell-${CACHE_VERSION}`;
const API_CACHE = `tasknest-api-${CACHE_VERSION}`;

const APP_SHELL = [
  '/',
  '/index.html',
  '/login.html',
  '/register.html',
  '/focus.html',
  '/stats.html',
  '/offline.html',
  '/css/styles.css',
  '/js/theme-init.js',
  '/js/api.js',
  '/js/auth.js',
  '/js/db.js',
  '/js/app.js',
  '/js/focus.js',
  '/js/stats.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== SHELL_CACHE && key !== API_CACHE)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;

  // Mutations are never cached; they are replayed by the page's offline queue.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Auth responses must never be stored.
  if (url.pathname.startsWith('/api/auth')) return;

  if (url.pathname === '/api/tasks' || url.pathname === '/api/stats') {
    event.respondWith(networkFirst(request));
    return;
  }

  // Other API reads are left to the network.
  if (url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(navigationFallback(request));
    return;
  }

  event.respondWith(cacheFirst(request));
});

async function networkFirst(request) {
  const cache = await caches.open(API_CACHE);

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;

    return new Response(
      JSON.stringify({ message: 'You are offline and this data is not cached yet.' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

async function navigationFallback(request) {
  try {
    return await fetch(request);
  } catch {
    const cache = await caches.open(SHELL_CACHE);
    return (await caches.match(request))
      || (await cache.match('/index.html'))
      || (await cache.match('/offline.html'))
      || Response.error();
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(SHELL_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cache = await caches.open(SHELL_CACHE);
    return (await cache.match('/offline.html')) || Response.error();
  }
}

// Background Sync support: ask any open page to replay its IndexedDB queue.
// Safari/Firefox do not support this; the page's "online" event is the fallback.
self.addEventListener('sync', event => {
  if (event.tag !== 'tasknest-sync') return;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clients => {
        clients.forEach(client => client.postMessage({ type: 'flush-queue' }));
      })
  );
});
