/**
 * Regression coverage for #219 (enterprise signup CSRF) and the broader
 * CSP allowlist surface area.
 *
 * The bug: the browser blocked Clerk's hosted sign-up forms from POSTing
 * to *.clerk.com subdomains because form-action didn't allow them. Clerk
 * surfaces that as a "CSRF error" to the user. These tests pin every
 * directive entry that needs to be present so a future cleanup can't
 * silently drop one again.
 */

import { describe, it, expect } from 'vitest';
import { buildCsp, parseCsp } from '@/lib/security/csp';

const PROD = { isDev: false, s3PublicOrigin: 'https://pub-xxx.r2.dev' };

describe('buildCsp', () => {
  it('produces a single-line semicolon-joined directive list', () => {
    const csp = buildCsp(PROD);
    expect(csp).not.toContain('\n');
    expect(csp.split(';').length).toBeGreaterThan(10); // 13 directives currently
  });

  describe('form-action — #219 regression', () => {
    // Each entry in this list MUST be present in form-action. A missing one
    // breaks the enterprise sign-up flow.
    const REQUIRED_FORM_ACTION_SOURCES = [
      "'self'",
      'https://accounts.storymagicapp.net',
      'https://app.storymagicapp.net',
      'https://www.storymagicapp.net',
      'https://storymagicapp.net',
      'https://*.accounts.dev',
      'https://*.clerk.com', // The one that was missing pre-#219
      'https://*.clerk.accounts.dev',
      'https://checkout.stripe.com',
    ];

    it.each(REQUIRED_FORM_ACTION_SOURCES)(
      'includes %s in form-action',
      (source) => {
        const csp = buildCsp(PROD);
        const directives = parseCsp(csp);
        const sources = directives.get('form-action') ?? [];
        expect(sources).toContain(source);
      },
    );
  });

  describe('frame-src — Stripe checkout + Clerk forms', () => {
    const REQUIRED_FRAME_SRC_SOURCES = [
      "'self'",
      'https://checkout.stripe.com', // Was missing pre-#219
      'https://js.stripe.com',
      'https://hooks.stripe.com',
      'https://accounts.storymagicapp.net',
      'https://app.storymagicapp.net', // Was missing pre-#219
      'https://*.clerk.com',
      'https://*.clerk.accounts.dev', // Was missing pre-#219
      'https://challenges.cloudflare.com',
    ];

    it.each(REQUIRED_FRAME_SRC_SOURCES)(
      'includes %s in frame-src',
      (source) => {
        const csp = buildCsp(PROD);
        const directives = parseCsp(csp);
        const sources = directives.get('frame-src') ?? [];
        expect(sources).toContain(source);
      },
    );
  });

  describe('script-src — Clerk SDK requirements', () => {
    it("allows 'unsafe-eval' (Clerk SDK uses new Function during init)", () => {
      const csp = buildCsp(PROD);
      const directives = parseCsp(csp);
      const sources = directives.get('script-src') ?? [];
      expect(sources).toContain("'unsafe-eval'");
    });

    it('allows https://*.clerk.com in script-src', () => {
      const csp = buildCsp(PROD);
      const directives = parseCsp(csp);
      const sources = directives.get('script-src') ?? [];
      expect(sources).toContain('https://*.clerk.com');
    });
  });

  describe('connect-src — fetch/XHR allowlist', () => {
    it.each([
      'https://api.stripe.com',
      'https://api.elevenlabs.io',
      'https://api.openai.com',
      'https://story-magic-orchestrator.onrender.com',
      'https://*.clerk.com',
      'https://*.sentry.io',
    ])('includes %s in connect-src', (source) => {
      const csp = buildCsp(PROD);
      const directives = parseCsp(csp);
      const sources = directives.get('connect-src') ?? [];
      expect(sources).toContain(source);
    });

    it('includes the S3 public origin when provided', () => {
      const csp = buildCsp({ isDev: false, s3PublicOrigin: 'https://example-r2.dev' });
      const directives = parseCsp(csp);
      const sources = directives.get('connect-src') ?? [];
      expect(sources).toContain('https://example-r2.dev');
    });

    it('does NOT include the S3 public origin when empty', () => {
      const csp = buildCsp({ isDev: false, s3PublicOrigin: '' });
      const directives = parseCsp(csp);
      const sources = directives.get('connect-src') ?? [];
      // No empty-string source slipped in
      expect(sources.every((s) => s.length > 0)).toBe(true);
    });
  });

  describe('localhost dev mode', () => {
    it('adds localhost orchestrator to connect-src when isDev=true', () => {
      const csp = buildCsp({ isDev: true, s3PublicOrigin: '' });
      const directives = parseCsp(csp);
      const sources = directives.get('connect-src') ?? [];
      expect(sources).toContain('http://localhost:22002');
    });

    it('does NOT add localhost in production', () => {
      const csp = buildCsp(PROD);
      const directives = parseCsp(csp);
      const connect = (directives.get('connect-src') ?? []).join(' ');
      expect(connect).not.toContain('localhost');
    });
  });

  describe('hardening invariants', () => {
    it("frame-ancestors stays 'self' (clickjacking defence)", () => {
      const csp = buildCsp(PROD);
      const directives = parseCsp(csp);
      expect(directives.get('frame-ancestors')).toEqual(["'self'"]);
    });

    it("object-src is 'none' (plugin sandbox)", () => {
      const csp = buildCsp(PROD);
      const directives = parseCsp(csp);
      expect(directives.get('object-src')).toEqual(["'none'"]);
    });

    it('upgrade-insecure-requests is enabled', () => {
      const csp = buildCsp(PROD);
      expect(csp).toContain('upgrade-insecure-requests');
    });
  });
});
