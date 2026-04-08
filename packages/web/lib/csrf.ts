/**
 * CSRF Protection Utilities
 *
 * Validates that requests originate from the same site by checking
 * the Origin header against allowed origins.
 */

const ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_APP_URL,
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
  process.env.RENDER_EXTERNAL_URL, // Render.com sets this automatically
  // Production custom domain — hardcoded so CSRF works even if NEXT_PUBLIC_APP_URL is misconfigured
  'https://app.storymagicapp.net',
  'https://story-magic-web.onrender.com',
  // Local development
  'http://localhost:22000',
  'http://localhost:3000',
].filter(Boolean) as string[];

/**
 * Validates that a request's Origin header matches an allowed origin.
 * Returns null if valid, or an error message if invalid.
 *
 * @param request - The incoming request
 * @returns null if valid, error message string if invalid
 */
export function validateCsrf(request: Request): string | null {
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');

  // For same-origin requests without CORS, origin may be null
  // In this case, check referer
  if (!origin && !referer) {
    // When both Origin and Referer are missing, require X-Requested-With header.
    // Server-side fetch calls set this header. Browser form submissions and
    // cross-origin requests cannot set custom headers without CORS preflight,
    // so this blocks CSRF via header-stripping attacks.
    const xRequestedWith = request.headers.get('x-requested-with');
    if (xRequestedWith === 'story-magic') {
      return null;
    }
    // Also allow service-to-service calls authenticated via SERVICE_SECRET_KEY
    const serviceKey = request.headers.get('x-service-key');
    if (serviceKey && serviceKey === process.env.SERVICE_SECRET_KEY) {
      return null;
    }
    return 'Missing Origin/Referer header and no X-Requested-With: story-magic';
  }

  const requestOrigin = origin || (referer ? new URL(referer).origin : null);

  if (!requestOrigin) {
    return 'Could not determine request origin';
  }

  // Check if the origin is in our allowed list (exact match only)
  const isAllowed = ALLOWED_ORIGINS.some((allowed) => {
    if (!allowed) return false;
    return requestOrigin === allowed;
  });

  if (!isAllowed) {
    // Structured logging import would add a circular dep risk here,
    // so keep a simple console.warn — this is a security event visible in logs
    console.warn(`CSRF validation failed: origin ${requestOrigin} not in allowed list`);
    return `Origin ${requestOrigin} is not allowed`;
  }

  return null;
}

/**
 * Higher-order function to wrap API route handlers with CSRF protection.
 * Only validates POST, PUT, PATCH, DELETE requests.
 */
export function withCsrfProtection<T>(
  handler: (request: Request) => Promise<T>
): (request: Request) => Promise<T | Response> {
  return async (request: Request) => {
    const method = request.method.toUpperCase();

    // Only validate state-changing methods
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      const error = validateCsrf(request);
      if (error) {
        return new Response(JSON.stringify({ error: 'CSRF validation failed', details: error }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    return handler(request);
  };
}
