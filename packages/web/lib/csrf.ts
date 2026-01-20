/**
 * CSRF Protection Utilities
 *
 * Validates that requests originate from the same site by checking
 * the Origin header against allowed origins.
 */

const ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_APP_URL,
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
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
    // API calls from server components won't have origin/referer
    // Allow these through as they're not from browser forms
    return null;
  }

  const requestOrigin = origin || (referer ? new URL(referer).origin : null);

  if (!requestOrigin) {
    return null; // Allow requests without origin (non-browser)
  }

  // Check if the origin is in our allowed list
  const isAllowed = ALLOWED_ORIGINS.some((allowed) => {
    if (!allowed) return false;
    // Handle both exact match and subdomain match for Vercel preview URLs
    return requestOrigin === allowed || requestOrigin.endsWith('.vercel.app');
  });

  if (!isAllowed) {
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
