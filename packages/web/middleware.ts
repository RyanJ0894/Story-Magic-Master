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
]);

// =============================================================================
// Security Headers
// =============================================================================
function addSecurityHeaders(response: NextResponse): void {
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://*.accounts.dev https://*.clerk.com",
    "style-src 'self' 'unsafe-inline'", // Tailwind requires unsafe-inline
    "img-src 'self' data: blob: https://img.clerk.com https://api.dicebear.com",
    "font-src 'self' data:",
    "connect-src 'self' https://api.stripe.com https://api.elevenlabs.io https://api.openai.com https://*.sentry.io https://*.accounts.dev https://*.clerk.com https://*.clerk.dev",
    "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://*.accounts.dev https://*.clerk.com",
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

  const response = NextResponse.next();
  addSecurityHeaders(response);
  return response;
});

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
