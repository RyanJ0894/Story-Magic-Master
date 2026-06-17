/**
 * Tests for the redirect-URL resolution logic on /login and /signup.
 *
 * Pins #322 (2026-06-17) — invite flow passes `?redirect_url=/invite/...`
 * (Clerk convention), but the login page previously only read `?redirect=`
 * and signup ignored search params entirely. Both pages now accept either
 * name and validate the path is relative.
 */

import { describe, it, expect } from 'vitest';

// Helper that mirrors the inline logic on both /login/[[...rest]]/page.tsx
// and /signup/[[...rest]]/page.tsx. Kept here as the system-under-test so a
// future deduplication into a shared helper has a stable test contract.
function resolveAuthFallbackUrl(params: { redirect?: string; redirect_url?: string }): string {
  const raw = params.redirect_url ?? params.redirect ?? '';
  const rawRedirect = raw ? decodeURIComponent(raw) : '';
  const isSafeRelative =
    rawRedirect.startsWith('/') && !rawRedirect.startsWith('//');
  return isSafeRelative ? rawRedirect : '/dashboard';
}

describe('resolveAuthFallbackUrl (#322)', () => {
  describe('happy path — invite flow', () => {
    it('honors redirect_url to /invite/<token>', () => {
      expect(resolveAuthFallbackUrl({ redirect_url: '/invite/abc123' })).toBe('/invite/abc123');
    });

    it('honors URL-encoded redirect_url', () => {
      expect(resolveAuthFallbackUrl({ redirect_url: encodeURIComponent('/invite/xyz') })).toBe('/invite/xyz');
    });
  });

  describe('back-compat — older redirect param', () => {
    it('honors `redirect` when `redirect_url` absent', () => {
      expect(resolveAuthFallbackUrl({ redirect: '/projects/123' })).toBe('/projects/123');
    });

    it('redirect_url WINS when both params provided', () => {
      expect(
        resolveAuthFallbackUrl({ redirect: '/old', redirect_url: '/new' })
      ).toBe('/new');
    });
  });

  describe('default behavior', () => {
    it('falls back to /dashboard when neither param is set', () => {
      expect(resolveAuthFallbackUrl({})).toBe('/dashboard');
    });

    it('falls back to /dashboard for empty string', () => {
      expect(resolveAuthFallbackUrl({ redirect_url: '' })).toBe('/dashboard');
    });
  });

  describe('open-redirect prevention', () => {
    it('rejects absolute http URL', () => {
      expect(resolveAuthFallbackUrl({ redirect_url: 'http://evil.com/steal' })).toBe('/dashboard');
    });

    it('rejects absolute https URL', () => {
      expect(resolveAuthFallbackUrl({ redirect_url: 'https://evil.com' })).toBe('/dashboard');
    });

    it('rejects protocol-relative URL (//evil.com → open redirect)', () => {
      expect(resolveAuthFallbackUrl({ redirect_url: '//evil.com/steal' })).toBe('/dashboard');
    });

    it('rejects URL-encoded protocol-relative URL', () => {
      expect(resolveAuthFallbackUrl({ redirect_url: encodeURIComponent('//evil.com') })).toBe('/dashboard');
    });

    it('rejects scheme-relative javascript:', () => {
      expect(resolveAuthFallbackUrl({ redirect_url: 'javascript:alert(1)' })).toBe('/dashboard');
    });

    it('rejects bare path segments without leading slash', () => {
      expect(resolveAuthFallbackUrl({ redirect_url: 'invite/abc' })).toBe('/dashboard');
    });
  });
});
