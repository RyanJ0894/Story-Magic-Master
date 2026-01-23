import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { validateCsrf, withCsrfProtection } from '@/lib/csrf';

describe('CSRF Protection', () => {
  // Save original env
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset env before each test
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('validateCsrf', () => {
    it('should allow requests without origin or referer (server-side calls)', () => {
      const request = new Request('https://example.com/api/test', {
        method: 'POST',
        headers: {},
      });
      const result = validateCsrf(request);
      expect(result).toBeNull();
    });

    it('should allow requests from localhost in development', () => {
      const request = new Request('https://example.com/api/test', {
        method: 'POST',
        headers: {
          origin: 'http://localhost:22000',
        },
      });
      const result = validateCsrf(request);
      expect(result).toBeNull();
    });

    it('should allow requests from localhost:3000', () => {
      const request = new Request('https://example.com/api/test', {
        method: 'POST',
        headers: {
          origin: 'http://localhost:3000',
        },
      });
      const result = validateCsrf(request);
      expect(result).toBeNull();
    });

    it('should allow requests from vercel.app domains', () => {
      const request = new Request('https://example.com/api/test', {
        method: 'POST',
        headers: {
          origin: 'https://my-app-abc123.vercel.app',
        },
      });
      const result = validateCsrf(request);
      expect(result).toBeNull();
    });

    it('should reject requests from unknown origins', () => {
      const request = new Request('https://example.com/api/test', {
        method: 'POST',
        headers: {
          origin: 'https://malicious-site.com',
        },
      });
      const result = validateCsrf(request);
      expect(result).not.toBeNull();
      expect(result).toContain('not allowed');
    });

    it('should check referer if origin is missing', () => {
      const request = new Request('https://example.com/api/test', {
        method: 'POST',
        headers: {
          referer: 'http://localhost:22000/some/page',
        },
      });
      const result = validateCsrf(request);
      expect(result).toBeNull();
    });
  });

  describe('withCsrfProtection', () => {
    it('should pass through GET requests without validation', async () => {
      const handler = vi.fn().mockResolvedValue({ success: true });
      const protectedHandler = withCsrfProtection(handler);

      const request = new Request('https://example.com/api/test', {
        method: 'GET',
        headers: {
          origin: 'https://malicious-site.com',
        },
      });

      await protectedHandler(request);
      expect(handler).toHaveBeenCalledWith(request);
    });

    it('should validate POST requests', async () => {
      const handler = vi.fn().mockResolvedValue({ success: true });
      const protectedHandler = withCsrfProtection(handler);

      const request = new Request('https://example.com/api/test', {
        method: 'POST',
        headers: {
          origin: 'https://malicious-site.com',
        },
      });

      const response = await protectedHandler(request);
      expect(handler).not.toHaveBeenCalled();
      expect(response).toBeInstanceOf(Response);
      expect((response as Response).status).toBe(403);
    });

    it('should validate PUT requests', async () => {
      const handler = vi.fn().mockResolvedValue({ success: true });
      const protectedHandler = withCsrfProtection(handler);

      const request = new Request('https://example.com/api/test', {
        method: 'PUT',
        headers: {
          origin: 'https://malicious-site.com',
        },
      });

      const response = await protectedHandler(request);
      expect(handler).not.toHaveBeenCalled();
      expect((response as Response).status).toBe(403);
    });

    it('should validate DELETE requests', async () => {
      const handler = vi.fn().mockResolvedValue({ success: true });
      const protectedHandler = withCsrfProtection(handler);

      const request = new Request('https://example.com/api/test', {
        method: 'DELETE',
        headers: {
          origin: 'https://malicious-site.com',
        },
      });

      const response = await protectedHandler(request);
      expect(handler).not.toHaveBeenCalled();
      expect((response as Response).status).toBe(403);
    });

    it('should allow valid POST requests through', async () => {
      const handler = vi.fn().mockResolvedValue({ success: true });
      const protectedHandler = withCsrfProtection(handler);

      const request = new Request('https://example.com/api/test', {
        method: 'POST',
        headers: {
          origin: 'http://localhost:22000',
        },
      });

      await protectedHandler(request);
      expect(handler).toHaveBeenCalledWith(request);
    });
  });
});
