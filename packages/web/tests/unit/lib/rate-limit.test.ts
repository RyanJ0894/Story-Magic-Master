import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock logger to prevent console output in tests
vi.mock('@/lib/logger', () => ({
  log: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    api: vi.fn(),
  },
}));

import { InMemoryRateLimiter, rateLimit, getClientIp } from '@/lib/api/rate-limit';

describe('InMemoryRateLimiter', () => {
  let limiter: InMemoryRateLimiter;

  afterEach(() => {
    limiter?.destroy();
  });

  it('should allow requests within the limit', () => {
    limiter = new InMemoryRateLimiter(5, 60_000);
    for (let i = 0; i < 5; i++) {
      const result = limiter.limit('test-user');
      expect(result.success).toBe(true);
    }
  });

  it('should block requests that exceed the limit', () => {
    limiter = new InMemoryRateLimiter(3, 60_000);
    // Exhaust the limit
    for (let i = 0; i < 3; i++) {
      const result = limiter.limit('test-user');
      expect(result.success).toBe(true);
    }
    // 4th request should be blocked
    const blocked = limiter.limit('test-user');
    expect(blocked.success).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it('should track different identifiers independently', () => {
    limiter = new InMemoryRateLimiter(2, 60_000);
    // User A uses 2 requests
    limiter.limit('user-a');
    limiter.limit('user-a');
    // User A is blocked
    expect(limiter.limit('user-a').success).toBe(false);
    // User B still has quota
    expect(limiter.limit('user-b').success).toBe(true);
  });

  it('should report remaining tokens accurately', () => {
    limiter = new InMemoryRateLimiter(5, 60_000);
    const r1 = limiter.limit('test');
    expect(r1.remaining).toBe(4);

    const r2 = limiter.limit('test');
    expect(r2.remaining).toBe(3);
  });

  it('should refill tokens over time', async () => {
    limiter = new InMemoryRateLimiter(2, 1_000); // 2 per second for fast test
    // Exhaust
    limiter.limit('test');
    limiter.limit('test');
    expect(limiter.limit('test').success).toBe(false);

    // Wait for refill (slightly more than 500ms for 1 token)
    await new Promise((r) => setTimeout(r, 600));

    // Should have refilled at least 1 token
    expect(limiter.limit('test').success).toBe(true);
  });
});

describe('rateLimit()', () => {
  beforeEach(() => {
    vi.stubEnv('RATE_LIMIT_DISABLED', '');
    vi.stubEnv('UPSTASH_REDIS_REST_URL', '');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '');
  });

  it('should return null when RATE_LIMIT_DISABLED is true', async () => {
    vi.stubEnv('RATE_LIMIT_DISABLED', 'true');
    const result = await rateLimit('test-id', 'strict');
    expect(result).toBeNull();
  });

  it('should return null when within limit (in-memory fallback)', async () => {
    const result = await rateLimit('rate-limit-test-a', 'loose');
    expect(result).toBeNull();
  });

  it('should return 429 response when rate limited', async () => {
    // strict = 5 per minute — exhaust via in-memory
    for (let i = 0; i < 5; i++) {
      await rateLimit(`rate-limit-test-b-${Date.now()}:${i}:exhaust`, 'strict');
    }
    // Use a fresh identifier but one that has been used
    const id = 'rate-limit-test-b-fixed';
    for (let i = 0; i < 5; i++) {
      await rateLimit(id, 'strict');
    }
    const blocked = await rateLimit(id, 'strict');
    expect(blocked).not.toBeNull();
    expect(blocked!.status).toBe(429);
    const body = await blocked!.json();
    expect(body.code).toBe('RATE_LIMITED');
    expect(body.error).toBe('Too many requests');
  });
});

describe('getClientIp()', () => {
  it('should extract IP from x-forwarded-for header', () => {
    const request = new Request('https://example.com', {
      headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' },
    });
    expect(getClientIp(request)).toBe('1.2.3.4');
  });

  it('should fall back to x-real-ip', () => {
    const request = new Request('https://example.com', {
      headers: { 'x-real-ip': '9.8.7.6' },
    });
    expect(getClientIp(request)).toBe('9.8.7.6');
  });

  it('should return "unknown" when no IP headers present', () => {
    const request = new Request('https://example.com');
    expect(getClientIp(request)).toBe('unknown');
  });
});
