/**
 * Tests for Enterprise Upgrade Route
 *
 * POST /api/enterprise/upgrade
 *
 * Verifies the shared gate password and upgrades subscriptionTier to 'enterprise'.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockAuth = vi.fn();
vi.mock('@clerk/nextjs/server', () => ({
  auth: () => mockAuth(),
}));

vi.mock('@/lib/csrf', () => ({
  validateCsrf: vi.fn(() => null),
}));

vi.mock('@/lib/api/rate-limit', () => ({
  rateLimit: vi.fn(() => Promise.resolve(null)),
  getClientIp: vi.fn(() => '127.0.0.1'),
}));

vi.mock('@/lib/logger', () => ({
  log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

const mockPrisma = {
  profile: {
    update: vi.fn().mockResolvedValue({ subscriptionTier: 'enterprise' }),
  },
};
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));

// ---------------------------------------------------------------------------
// Import route (after mocks)
// ---------------------------------------------------------------------------

const { POST } = await import('@/app/api/enterprise/upgrade/route');

const BASE_URL = 'http://localhost:22000';

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest(`${BASE_URL}/api/enterprise/upgrade`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', origin: BASE_URL },
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/enterprise/upgrade', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ userId: 'user-123' });
    process.env.ENTERPRISE_GATE_PASSWORD = 'test-secret';
  });

  describe('Auth', () => {
    it('returns 401 when not authenticated', async () => {
      mockAuth.mockResolvedValue({ userId: null });
      const res = await POST(makeRequest({ password: 'test-secret' }));
      expect(res.status).toBe(401);
    });
  });

  describe('Input validation', () => {
    it('returns 400 for missing password', async () => {
      const res = await POST(makeRequest({}));
      expect(res.status).toBe(400);
    });

    it('returns 400 for empty password string', async () => {
      const res = await POST(makeRequest({ password: '' }));
      expect(res.status).toBe(400);
    });
  });

  describe('Password gate', () => {
    it('returns 401 for incorrect password', async () => {
      const res = await POST(makeRequest({ password: 'wrong-password' }));
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.code).toBe('WRONG_PASSWORD');
    });

    it('returns 503 when ENTERPRISE_GATE_PASSWORD is not configured', async () => {
      delete process.env.ENTERPRISE_GATE_PASSWORD;
      const res = await POST(makeRequest({ password: 'any' }));
      expect(res.status).toBe(503);
      const json = await res.json();
      expect(json.code).toBe('NOT_CONFIGURED');
    });
  });

  describe('Success', () => {
    it('upgrades user to enterprise tier on correct password', async () => {
      const res = await POST(makeRequest({ password: 'test-secret' }));
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.tier).toBe('enterprise');
    });

    it('calls prisma.profile.update with enterprise tier', async () => {
      await POST(makeRequest({ password: 'test-secret' }));
      expect(mockPrisma.profile.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { subscriptionTier: 'enterprise' },
      });
    });
  });
});
