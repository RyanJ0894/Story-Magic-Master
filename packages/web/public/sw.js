// Story Magic Service Worker v3
// Cache strategy:
//   - Static assets (/_next/static/*, /logo.png, /manifest.webmanifest): cache-first
//   - API calls (/api/*): network-only (never serve stale generation data)
//   - Audio files (Supabase storage + orchestrator /audio/*): cache-first with background refresh
//   - Navigation failures while offline: serve /offline
//
// v3: updated CACHE_NAME so browser re-installs the SW and picks up the
//     updated Content-Security-Policy that adds story-magic-orchestrator.onrender.com
//     to connect-src (required for SW fetch() to reach cross-origin audio files).

const CACHE_NAME = 'story-magic-v3';
const STATIC_PATTERNS = [/^\/_next\/static\//, /^\/logo\.png$/, /^\/manifest\.webmanifest$/];
const AUDIO_PATTERNS = [
  /supabase\.co\/storage\/v1\/object\/public\//,
  /\/audio\/.*\.(m4a|mp3|wav|ogg)$/i,
  /onrender\.com\/audio\//,
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(['/manifest.webmanifest', '/logo.png', '/offline'])
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

  // API calls: network-only (always fresh)
  if (url.pathname.startsWith('/api/')) return;

  // Static assets: cache-first
  if (STATIC_PATTERNS.some((p) => p.test(url.pathname))) {
    event.respondWith(
      caches.match(request).then((cached) =>
        cached ??
        fetch(request).then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(request, clone));
          return res;
        })
      )
    );
    return;
  }

  // Audio assets: cache-first with background refresh.
  // The .catch() on networkFetch is critical: if fetch() rejects (e.g. the
  // file was deleted from disk, or a transient network error), we must not let
  // event.respondWith receive a rejected promise — that produces ERR_FAILED
  // and the <audio> element gets "NotSupportedError: no supported sources".
  // Instead we re-throw so the browser falls back to its own network error
  // handling, which is cleaner and retryable.
  if (AUDIO_PATTERNS.some((p) => p.test(request.url))) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const networkFetch = fetch(request)
          .then((res) => {
            // Only cache successful responses — don't cache 4xx/5xx
            if (res.ok) {
              const clone = res.clone();
              caches.open(CACHE_NAME).then((c) => c.put(request, clone));
            }
            return res;
          })
          .catch((err) => {
            // fetch() itself rejected (network error, CSP block, etc.)
            // If we have a cached copy, use it. Otherwise propagate the error.
            if (cached) return cached;
            throw err;
          });
        return cached ?? networkFetch;
      })
    );
    return;
  }

  // Navigation requests: network with offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/offline').then((r) => r ?? new Response('Offline', { status: 503 })))
    );
  }
});
