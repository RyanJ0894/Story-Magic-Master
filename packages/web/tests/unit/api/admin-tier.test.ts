/**
 * Tests for POST /api/admin/tier
 *
 * Admin-only route that sets a user's subscriptionTier directly (Option A
 * enterprise provisioning). Replaces the insecure shared-password gate from #106.
 *
 * Covers:
 * - 401 unauthenticated
 * - 403 non-admin user
 * - 404 target user not found
 * - 400 invalid tier value
 * - 200 happy path — tier updated, audit logged
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockAuth = vi.fn();
vi.mock('@clerk/nextjs/server', () => ({
  auth: () => mockAuth(),
}));

const mockPrisma = {
  profile: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  subscription: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  // 2026-06-14: admin/tier migrated to provisionTier which uses interactive
  // $transaction. Detect the two forms — array (legacy) vs callback (new) —
  // and route the callback to mockPrisma so existing per-table assertions
  // continue to work.
  $transaction: vi.fn((opsOrCb: Promise<unknown>[] | ((tx: typeof mockPrisma) => Promise<unknown>)) => {
    if (typeof opsOrCb === 'function') {
      return opsOrCb(mockPrisma);
    }
    return Promise.all(opsOrCb);
  }),
  auditLog: {
    create: vi.fn(),
  },
};
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));

vi.mock('@/lib/api/rate-limit', () => ({
  rateLimit: vi.fn(() => Promise.resolve(null)),
  getClientIp: vi.fn(() => '127.0.0.1'),
}));

vi.mock('@/lib/logger', () => ({
  log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

const mockLogAuditEvent = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/api/audit', () => ({
  logAuditEvent: (...args: unknown[]) => mockLogAuditEvent(...args),
  extractRequestInfo: vi.fn(() => ({ ip_address: '127.0.0.1', user_agent: 'test' })),
  AuditActions: { ADMIN_CREDIT_GRANT: 'admin.credit_grant' },
  ResourceTypes: { USER: 'user' },
}));

// ── Import after mocks ────────────────────────────────────────────────────────

const { POST } = await import('@/app/api/admin/tier/route');

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ADMIN_ID = 'admin_user_123';
const TARGET_ID = 'target_user_456';

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/admin/tier', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', origin: 'http://localhost:22000' },
    body: JSON.stringify(body),
  });
}

function setupAdmin() {
  mockAuth.mockResolvedValue({ userId: ADMIN_ID });
  mockPrisma.profile.findUnique.mockResolvedValue({ id: ADMIN_ID, userType: 'admin' });
}

function setupRegularUser() {
  mockAuth.mockResolvedValue({ userId: 'regular_123' });
  mockPrisma.profile.findUnique.mockResolvedValue({ id: 'regular_123', userType: 'writer' });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/admin/tier', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Auth', () => {
    it('returns 401 when not authenticated', async () => {
      mockAuth.mockResolvedValue({ userId: null });
      const res = await POST(makeRequest({ userId: TARGET_ID, tier: 'enterprise' }));
      expect(res.status).toBe(401);
    });

    it('returns 403 for non-admin users', async () => {
      setupRegularUser();
      const res = await POST(makeRequest({ userId: TARGET_ID, tier: 'enterprise' }));
      expect(res.status).toBe(403);
    });
  });

  describe('Input validation', () => {
    it('returns 400 for missing userId', async () => {
      setupAdmin();
      mockPrisma.profile.findUnique
        .mockResolvedValueOnce({ id: ADMIN_ID, userType: 'admin' });
      const res = await POST(makeRequest({ tier: 'enterprise' }));
      expect(res.status).toBe(400);
    });

    it('returns 400 for invalid tier value', async () => {
      setupAdmin();
      mockPrisma.profile.findUnique
        .mockResolvedValueOnce({ id: ADMIN_ID, userType: 'admin' });
      const res = await POST(makeRequest({ userId: TARGET_ID, tier: 'superadmin' }));
      expect(res.status).toBe(400);
    });
  });

  describe('Target user', () => {
    it('returns 404 when target user does not exist', async () => {
      mockAuth.mockResolvedValue({ userId: ADMIN_ID });
      mockPrisma.profile.findUnique
        .mockResolvedValueOnce({ id: ADMIN_ID, userType: 'admin' })
        .mockResolvedValueOnce(null);
      const res = await POST(makeRequest({ userId: TARGET_ID, tier: 'enterprise' }));
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.code).toBe('NOT_FOUND');
    });
  });

  describe('Success', () => {
    beforeEach(() => {
      mockAuth.mockResolvedValue({ userId: ADMIN_ID });
      mockPrisma.profile.findUnique
        .mockResolvedValueOnce({ id: ADMIN_ID, userType: 'admin' })
        .mockResolvedValueOnce({ id: TARGET_ID, fullName: 'Ryan Jae', email: 'ryan@example.com', subscriptionTier: 'creator' });
      mockPrisma.profile.update.mockResolvedValue({ id: TARGET_ID, subscriptionTier: 'enterprise' });
      mockPrisma.subscription.findFirst.mockResolvedValue(null);
      mockPrisma.subscription.create.mockResolvedValue({});
      mockPrisma.subscription.update.mockResolvedValue({});
      mockPrisma.$transaction.mockImplementation(((opsOrCb: Promise<unknown>[] | ((tx: typeof mockPrisma) => Promise<unknown>)) => typeof opsOrCb === 'function' ? opsOrCb(mockPrisma) : Promise.all(opsOrCb)) as never);
    });

    it('returns 200 with previous and new tier', async () => {
      const res = await POST(makeRequest({ userId: TARGET_ID, tier: 'enterprise' }));
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.newTier).toBe('enterprise');
      expect(json.previousTier).toBe('creator');
      expect(json.userId).toBe(TARGET_ID);
    });

    it('calls prisma.profile.update with the correct tier', async () => {
      await POST(makeRequest({ userId: TARGET_ID, tier: 'enterprise' }));
      expect(mockPrisma.profile.update).toHaveBeenCalledWith({
        where: { id: TARGET_ID },
        data: { subscriptionTier: 'enterprise' },
      });
    });

    it('logs an audit event', async () => {
      await POST(makeRequest({ userId: TARGET_ID, tier: 'enterprise' }));
      expect(mockLogAuditEvent).toHaveBeenCalledOnce();
      const call = mockLogAuditEvent.mock.calls[0][0];
      expect(call.details.tier).toBe('enterprise');
      expect(call.details.previous_tier).toBe('creator');
    });

    it('accepts all valid tiers', async () => {
      const tiers = ['creator', 'pro', 'studio', 'enterprise'] as const;
      for (const tier of tiers) {
        vi.clearAllMocks();
        mockAuth.mockResolvedValue({ userId: ADMIN_ID });
        mockPrisma.profile.findUnique
          .mockResolvedValueOnce({ id: ADMIN_ID, userType: 'admin' })
          .mockResolvedValueOnce({ id: TARGET_ID, fullName: 'Test', email: 'test@example.com', subscriptionTier: 'creator' });
        mockPrisma.profile.update.mockResolvedValue({ id: TARGET_ID, subscriptionTier: tier });
        mockPrisma.subscription.findFirst.mockResolvedValue(null);
        mockPrisma.subscription.create.mockResolvedValue({});
        mockPrisma.$transaction.mockImplementation(((opsOrCb: Promise<unknown>[] | ((tx: typeof mockPrisma) => Promise<unknown>)) => typeof opsOrCb === 'function' ? opsOrCb(mockPrisma) : Promise.all(opsOrCb)) as never);
        const res = await POST(makeRequest({ userId: TARGET_ID, tier }));
        expect(res.status).toBe(200);
      }
    });
  });
});
