// Service worker — offline (Lot 5).
// - précache la coquille + icônes
// - runtime cache (cache-first) des GET same-origin (assets Vite hashés inclus)
// - fallback navigation : hors-ligne, toute navigation sert l'app depuis le cache
const CACHE = 'ram-shell-v2';
const CORE = [
  '/', '/index.html', '/manifest.webmanifest',
  '/icon.svg', '/icon-192.png', '/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET' || new URL(request.url).origin !== location.origin) return;

  // Navigations (changement de page/app) : réseau d'abord, sinon coquille en cache.
  if (request.mode === 'navigate') {
    e.respondWith(fetch(request).catch(() => caches.match('/index.html')));
    return;
  }

  // Reste : cache-first avec mise en cache runtime.
  e.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    try {
      const res = await fetch(request);
      const cache = await caches.open(CACHE);
      cache.put(request, res.clone());
      return res;
    } catch {
      return cached || Response.error();
    }
  })());
});
