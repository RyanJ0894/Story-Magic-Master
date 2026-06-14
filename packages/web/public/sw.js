// Story Magic Service Worker v5
// Cache strategy:
//   - Static assets (/_next/static/*, /logo.png, /manifest.webmanifest): cache-first
//   - API calls (/api/*): network-only (never serve stale generation data)
//   - Audio files (Supabase storage + orchestrator /audio/*): cache-first with background refresh
//   - Navigation failures while offline: serve /offline
//
// v5 (issue #244): R2-hosted episode.m4a fails to play with the SW active.
//     The previous AUDIO_PATTERNS matched any URL with `/audio/<…>.m4a`,
//     including R2 (`pub-…r2.dev/audio/<projectId>/episode.m4a`). R2 is
//     cross-origin and the SW's `fetch(request)` re-issues the request in
//     no-cors mode, producing an opaque response. Caching that response is
//     fine, but the browser cannot satisfy the audio element's HTTP Range
//     requests from an opaque body — so `<audio>` fails with ERR_FAILED
//     after 2–3 attempts and the play button does nothing.
//
//     Fix: only intercept SAME-ORIGIN audio paths (e.g. `/audio/...m4a` on
//     this Next.js app) and explicit orchestrator/Supabase audio. Anything
//     hosted on R2 (or any other cross-origin CDN) bypasses the SW entirely
//     so the browser handles Range natively.
//
// v3: updated CACHE_NAME so browser re-installs the SW and picks up the
//     updated Content-Security-Policy that adds story-magic-orchestrator.onrender.com
//     to connect-src (required for SW fetch() to reach cross-origin audio files).

// __BUILD_VERSION__ is replaced at build time by scripts/inject-sw-version.mjs
// with the deploy's commit SHA. Source stays at the placeholder so every
// deploy invalidates the prior cache automatically — no more manual v3 → v4
// → v5 bumps. See packages/web/scripts/inject-sw-version.mjs.
const CACHE_NAME = 'story-magic-__BUILD_VERSION__';
// JS chunks are excluded — they contain hardcoded server action IDs (e.g. Clerk
// keyless) and must always be fetched fresh so client IDs match the server.
// CSS and media are content-hashed and safe to serve cache-first for offline use.
const STATIC_PATTERNS = [/^\/_next\/static\/(css|media)\//, /^\/logo\.png$/, /^\/manifest\.webmanifest$/];
// Cross-origin audio hosts the SW is allowed to intercept. R2 is intentionally
// NOT here — see the v5 changelog above. Same-origin `/audio/...m4a` (served
// by the Next.js app's static handler or rewrites) is matched separately below.
const AUDIO_CROSS_ORIGIN_PATTERNS = [
  /supabase\.co\/storage\/v1\/object\/public\//,
  /onrender\.com\/audio\//,
];
const SAME_ORIGIN_AUDIO_PATH = /^\/audio\/.*\.(m4a|mp3|wav|ogg)$/i;

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

  // Audio assets: cache-first with background refresh. Two match conditions:
  //   1. Same-origin /audio/...m4a (orchestrator-proxied or local) — safe to
  //      intercept; same-origin fetch returns a non-opaque response that
  //      satisfies Range requests.
  //   2. Allowlisted cross-origin hosts (Supabase + orchestrator domain).
  //      R2 is NOT in this list (see v5 changelog) so cross-origin R2 audio
  //      flows past the SW to the browser's native media pipeline.
  //
  // The .catch() on networkFetch is critical: if fetch() rejects (e.g. the
  // file was deleted from disk, or a transient network error), we must not let
  // event.respondWith receive a rejected promise — that produces ERR_FAILED
  // and the <audio> element gets "NotSupportedError: no supported sources".
  // Instead we re-throw so the browser falls back to its own network error
  // handling, which is cleaner and retryable.
  const isSameOriginAudio = url.origin === self.location.origin && SAME_ORIGIN_AUDIO_PATH.test(url.pathname);
  const isAllowlistedCrossOriginAudio = AUDIO_CROSS_ORIGIN_PATTERNS.some((p) => p.test(request.url));
  if (isSameOriginAudio || isAllowlistedCrossOriginAudio) {
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
