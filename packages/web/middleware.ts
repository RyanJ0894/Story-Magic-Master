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
 * Add security headers including a nonce-based CSP.
 *
 * Nonce strategy: a per-request base64 nonce is set both here (response CSP)
 * and in the x-nonce request header so layout.tsx can forward it to
 * ClerkProvider and next/script tags. CSP Level 2+ browsers ignore
 * 'unsafe-inline' when a nonce is present; older browsers fall back to it.
 */
function addSecurityHeaders(response: NextResponse, nonce: string): void {
  const csp = [
    "default-src 'self'",
    // unsafe-eval removed — Stripe redirect-only checkout and Clerk prebuilt components don't need it.
    // If Stripe Elements or Clerk custom flows break, add 'unsafe-eval' back and track upstream fix.
    // 'nonce-...' is the primary guard; 'unsafe-inline' is the CSP2 fallback (ignored when nonce present).
    `script-src 'self' 'unsafe-inline' 'nonce-${nonce}' https://js.stripe.com https://*.accounts.dev https://*.clerk.com https://challenges.cloudflare.com`,
    "style-src 'self' 'unsafe-inline'", // Tailwind requires unsafe-inline
    "img-src 'self' data: blob: https://img.clerk.com https://api.dicebear.com",
    "font-src 'self' data:",
    "connect-src 'self' https://api.stripe.com https://api.elevenlabs.io https://api.openai.com https://*.sentry.io https://*.accounts.dev https://*.clerk.com https://*.clerk.dev https://clerk-telemetry.com",
    "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://*.accounts.dev https://*.clerk.com https://challenges.cloudflare.com",
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self' https://*.accounts.dev",
    "frame-ancestors 'self'",
    "upgrade-insecure-requests",
  ].join('; ');

  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
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
