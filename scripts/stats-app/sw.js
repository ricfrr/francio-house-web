// Keeps the dashboard's shell available. Data always comes from the network first; if the background
// service is off, the last numbers are shown and marked as old (the page reads the X-Stale header).
const CACHE = 'stats-v1';
const SHELL = ['/', '/manifest.webmanifest', '/icon.svg', '/icon-192.png', '/icon-512.png', '/fonts/bricolage.woff2', '/fonts/mono-400.woff2', '/fonts/mono-700.woff2', '/fonts/marker.woff2'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;

  // fonts and icons never change: cache first
  if (url.pathname.startsWith('/fonts/') || /\.(png|svg|webmanifest)$/.test(url.pathname)) {
    e.respondWith(
      caches.match(e.request).then(
        (hit) =>
          hit ||
          fetch(e.request).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
            return res;
          }),
      ),
    );
    return;
  }

  // the page and the numbers: network first, last copy as a fallback
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(async () => {
        const hit = await caches.match(e.request, { ignoreSearch: url.pathname === '/' });
        if (!hit) return new Response('Il servizio non è acceso.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
        if (url.pathname === '/api/data') {
          const headers = new Headers(hit.headers);
          headers.set('X-Stale', '1');
          return new Response(await hit.text(), { headers });
        }
        return hit;
      }),
  );
});
