/**
 * CSP builder, pulled out of middleware.ts so we can unit-test the directive
 * shape without booting Clerk's middleware HOC.
 *
 * Extracted as part of #219 — the enterprise signup flow surfaced a "CSRF
 * error" when the browser blocked Clerk's hosted sign-up form from POSTing
 * to a cross-subdomain Clerk endpoint because form-action didn't allow it.
 * Pinning the allowlist in tests prevents the directive from quietly losing
 * an origin again.
 */

export interface CspInputs {
  /** When true, allow http://localhost:22002 in connect-src / media-src. */
  isDev: boolean;
  /**
   * Origin of the S3-compatible storage bucket the app reads media from
   * (e.g. https://pub-…r2.dev). Empty string when not configured.
   */
  s3PublicOrigin: string;
}

/**
 * Build the Content-Security-Policy header string. Returns a single
 * semicolon-joined directive list ready for `response.headers.set('Content-Security-Policy', csp)`.
 *
 * Directives, with the rationale for each non-obvious entry:
 *
 *  - script-src 'unsafe-eval' — required by Clerk's JS SDK during init
 *    (it uses `new Function`); not our code.
 *  - style-src 'unsafe-inline' — Tailwind ships inline styles.
 *  - connect-src story-magic-orchestrator.onrender.com — the service
 *    worker fetch()es audio from there; fetch() is bound by connect-src
 *    in addition to media-src.
 *  - form-action allowlist — Clerk's hosted sign-up forms POST across
 *    subdomains; without the *.clerk.com family entry the browser blocks
 *    the POST and Clerk reports it as a CSRF error (issue #219).
 */
export function buildCsp({ isDev, s3PublicOrigin }: CspInputs): string {
  const localhostOrchestrator = isDev ? ' http://localhost:22002' : '';
  const s3CspEntry = s3PublicOrigin ? ` ${s3PublicOrigin}` : '';

  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://clerk.storymagicapp.net https://*.accounts.dev https://*.clerk.com https://challenges.cloudflare.com`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://img.clerk.com https://api.dicebear.com https://eleven-public-cdn.elevenlabs.io",
    "font-src 'self' data:",
    `connect-src 'self' https://api.stripe.com https://api.elevenlabs.io https://api.openai.com https://*.sentry.io https://clerk.storymagicapp.net https://accounts.storymagicapp.net https://www.storymagicapp.net https://storymagicapp.net https://*.accounts.dev https://*.clerk.com https://*.clerk.dev https://clerk-telemetry.com https://story-magic-orchestrator.onrender.com${localhostOrchestrator}${s3CspEntry}`,
    "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://checkout.stripe.com https://accounts.storymagicapp.net https://app.storymagicapp.net https://www.storymagicapp.net https://storymagicapp.net https://*.accounts.dev https://*.clerk.com https://*.clerk.accounts.dev https://challenges.cloudflare.com",
    `media-src 'self' blob: https://story-magic-orchestrator.onrender.com${localhostOrchestrator}${s3CspEntry}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    // #219 — see file header
    "form-action 'self' https://accounts.storymagicapp.net https://app.storymagicapp.net https://www.storymagicapp.net https://storymagicapp.net https://*.accounts.dev https://*.clerk.com https://*.clerk.accounts.dev https://checkout.stripe.com",
    "frame-ancestors 'self'",
    "upgrade-insecure-requests",
  ].join('; ');
}

/**
 * Extract the directive map from a CSP header string for test assertions.
 * Returns a Map of directive name → array of source values.
 */
export function parseCsp(header: string): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const directive of header.split(';').map((d) => d.trim()).filter(Boolean)) {
    const [name, ...sources] = directive.split(/\s+/);
    out.set(name, sources);
  }
  return out;
}
