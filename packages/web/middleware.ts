import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

// =============================================================================
// Protected Route Matchers
// =============================================================================
const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/projects(.*)',
  '/settings(.*)',
  '/admin(.*)',
  '/billing(.*)',
  '/writer(.*)',
  '/reader(.*)',
  '/impact/build(.*)',
]);

// =============================================================================
// Security Headers
// =============================================================================

/**
 * Add security headers including a CSP.
 *
 * Note: nonce-based CSP would be stronger, but Next.js App Router inline
 * hydration scripts don't receive the nonce automatically, so CSP3 browsers
 * block them. We use 'unsafe-inline' + strict domain allowlist instead.
 * A future improvement is to fully wire the nonce through generateMetadata.
 */
function addSecurityHeaders(response: NextResponse, nonce: string): void {
  const isDev = process.env.NODE_ENV === 'development';
  const localhostOrchestrator = isDev ? ' http://localhost:22002' : '';
  const csp = [
    "default-src 'self'",
    // unsafe-eval required by Clerk JS SDK (uses new Function during init — CSP policy, not our code).
    `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://clerk.storymagicapp.net https://*.accounts.dev https://*.clerk.com https://challenges.cloudflare.com`,
    "style-src 'self' 'unsafe-inline'", // Tailwind requires unsafe-inline
    "img-src 'self' data: blob: https://img.clerk.com https://api.dicebear.com",
    "font-src 'self' data:",
    // story-magic-orchestrator.onrender.com required in connect-src so the
    // service worker can fetch() audio files (fetch is governed by connect-src,
    // not media-src — both are needed).
    `connect-src 'self' https://api.stripe.com https://api.elevenlabs.io https://api.openai.com https://*.sentry.io https://clerk.storymagicapp.net https://accounts.storymagicapp.net https://*.accounts.dev https://*.clerk.com https://*.clerk.dev https://clerk-telemetry.com https://story-magic-orchestrator.onrender.com${localhostOrchestrator}`,
    "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://accounts.storymagicapp.net https://*.accounts.dev https://*.clerk.com https://challenges.cloudflare.com",
    `media-src 'self' blob: https://story-magic-orchestrator.onrender.com${localhostOrchestrator}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self' https://accounts.storymagicapp.net https://*.accounts.dev",
    "frame-ancestors 'self'",
    "upgrade-insecure-requests",
  ].join('; ');

  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'SAMEORIGIN'); // nosemgrep: x-frame-options-misconfiguration — value is a hardcoded literal, not user input; rule mis-tagged as express (this is Next.js)
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
}

export default clerkMiddleware(async (auth, request) => {
  if (isProtectedRoute(request)) {
    await auth.protect();
  }

  // Generate a per-request nonce and forward it in the request headers so
  // layout.tsx can pass it to ClerkProvider / Script tags.
  const nonce = btoa(crypto.randomUUID());
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  addSecurityHeaders(response, nonce);
  return response;
});

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
