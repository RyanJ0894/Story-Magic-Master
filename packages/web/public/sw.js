// Story Magic Service Worker
// Cache strategy:
//   - Static assets (/_next/static/*, /logo.png, /manifest.webmanifest): cache-first
//   - API calls (/api/*): network-only (never serve stale generation data)
//   - Audio files (Supabase storage URLs): cache-first with 7-day TTL

const CACHE_NAME = 'story-magic-v1';
const STATIC_PATTERNS = [/^\/_next\/static\//, /^\/logo\.png$/, /^\/manifest\.webmanifest$/];
const AUDIO_PATTERNS = [/supabase\.co\/storage\/v1\/object\/public\//];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(['/manifest.webmanifest', '/logo.png'])
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // API calls: network-only
  if (url.pathname.startsWith('/api/')) return;

  // Static assets: cache-first
  if (STATIC_PATTERNS.some((p) => p.test(url.pathname))) {
    event.respondWith(
      caches.match(request).then((cached) => cached ?? fetch(request).then((res) => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(request, clone));
        return res;
      }))
    );
    return;
  }

  // Audio assets: cache-first with background refresh
  if (AUDIO_PATTERNS.some((p) => p.test(request.url))) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const networkFetch = fetch(request).then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(request, clone));
          return res;
        });
        return cached ?? networkFetch;
      })
    );
  }
});
