// Service worker: precache everything the app needs, serve cache-first, work fully offline.
// Bump CACHE_VERSION (and APP_VERSION in app/version.js) whenever any file below changes.
const CACHE_VERSION = 'coach-v-1.2';

const PRECACHE = [
  './',
  'index.html',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
  'data/program.json',
  'data/days.json',
  'data/days-block-1r.json',
  'data/library.json',
  'data/footwork.json',
  'src/pose-renderer.js',
  'app/main.js',
  'app/data.js',
  'app/db.js',
  'app/validate.js',
  'app/schedule.js',
  'app/util.js',
  'app/icons.js',
  'app/version.js',
  'app/components/pose-player.js',
  'app/components/footwork.js',
  'app/components/timer.js',
  'app/views/session.js',
  'app/views/today.js',
  'app/views/week.js',
  'app/views/library.js',
  'app/views/log.js',
  'app/views/settings.js',
  'app/views/print.js',
  'app/styles/app.css',
  'app/styles/print.css',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      // cache: 'reload' bypasses the HTTP cache so a new version never precaches stale files.
      .then((cache) => cache.addAll(PRECACHE.map((u) => new Request(u, { cache: 'reload' }))))
  );
  // First install activates immediately; updates wait for the page to ask (see main.js).
  if (!self.registration.active) self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== CACHE_VERSION) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => { if (event.data === 'skipWaiting') self.skipWaiting(); });

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_VERSION);
    // App navigations always get the cached shell (routing is in the hash).
    const path = new URL(req.url).pathname;
    if (req.mode === 'navigate' && (path.endsWith('/') || path.endsWith('/index.html'))) {
      return (await cache.match('index.html')) || fetch(req);
    }
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res.ok && res.type === 'basic') cache.put(req, res.clone());
      return res;
    } catch (e) {
      return new Response('Offline and not cached', { status: 503, statusText: 'Offline' });
    }
  })());
});
