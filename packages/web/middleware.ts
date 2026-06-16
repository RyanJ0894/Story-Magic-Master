import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { buildCsp } from '@/lib/security/csp';

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
  void nonce; // Reserved for future nonce-based CSP (see file header).
  const isDev = process.env.NODE_ENV === 'development';
  // Extract origin from AWS_S3_PUBLIC_URL (e.g. https://pub-xxx.r2.dev) for CSP allowlisting.
  // Falls back to empty string when S3 storage is not configured (local dev without R2).
  const s3PublicOrigin = (() => {
    try {
      const raw = process.env.AWS_S3_PUBLIC_URL;
      return raw ? new URL(raw).origin : '';
    } catch {
      return '';
    }
  })();
  const csp = buildCsp({ isDev, s3PublicOrigin });

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
