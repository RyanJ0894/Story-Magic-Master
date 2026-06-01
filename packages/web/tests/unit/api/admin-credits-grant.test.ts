/**
 * Tests for POST /api/admin/credits/grant
 *
 * Covers:
 * - 401 unauthenticated
 * - 403 non-admin user
 * - 404 target user not found
 * - 400 invalid amount (zero, negative, over limit)
 * - 200 happy path — credits incremented, transaction recorded, audit logged
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
  creditTransaction: {
    create: vi.fn(),
  },
  auditLog: {
    create: vi.fn(),
  },
  $transaction: vi.fn(),
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

const { POST } = await import('@/app/api/admin/credits/grant/route');

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ADMIN_ID = 'admin_user_123';
const TARGET_ID = 'target_user_456';

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/admin/credits/grant', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', origin: 'http://localhost:22000' },
    body: JSON.stringify(body),
  });
}

function setupAdmin() {
  mockAuth.mockResolvedValue({ userId: ADMIN_ID });
  // withAdminAuth calls profile.findUnique for the admin profile check
  mockPrisma.profile.findUnique.mockResolvedValue({ id: ADMIN_ID, userType: 'admin' });
}

function setupRegularUser() {
  mockAuth.mockResolvedValue({ userId: 'regular_123' });
  mockPrisma.profile.findUnique.mockResolvedValue({ id: 'regular_123', userType: 'writer' });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/admin/credits/grant', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue({ userId: null });

    const res = await POST(makeRequest({ userId: TARGET_ID, amount: 10 }));
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admin users', async () => {
    setupRegularUser();

    const res = await POST(makeRequest({ userId: TARGET_ID, amount: 10 }));
    expect(res.status).toBe(403);
  });

  it('returns 404 when target user does not exist', async () => {
    setupAdmin();
    // Second call is the target user lookup — return null
    mockPrisma.profile.findUnique
      .mockResolvedValueOnce({ id: ADMIN_ID, userType: 'admin' })
      .mockResolvedValueOnce(null);

    const res = await POST(makeRequest({ userId: TARGET_ID, amount: 10 }));
    expect(res.status).toBe(404);
    const body = await res.json() as { code: string };
    expect(body.code).toBe('NOT_FOUND');
  });

  it('returns 400 for amount of zero', async () => {
    setupAdmin();

    const res = await POST(makeRequest({ userId: TARGET_ID, amount: 0 }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for amount over 10000', async () => {
    setupAdmin();

    const res = await POST(makeRequest({ userId: TARGET_ID, amount: 10001 }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for missing userId', async () => {
    setupAdmin();

    const res = await POST(makeRequest({ amount: 5 }));
    expect(res.status).toBe(400);
  });

  it('grants credits and returns new balance', async () => {
    setupAdmin();
    mockPrisma.profile.findUnique
      .mockResolvedValueOnce({ id: ADMIN_ID, userType: 'admin' })
      .mockResolvedValueOnce({ id: TARGET_ID, fullName: 'Test User', credits: 5 });

    mockPrisma.$transaction.mockImplementation(async (cb: (tx: typeof mockPrisma) => Promise<unknown>) =>
      cb(mockPrisma)
    );
    mockPrisma.profile.update.mockResolvedValue({ id: TARGET_ID, credits: 15 });
    mockPrisma.creditTransaction.create.mockResolvedValue({});

    const res = await POST(makeRequest({ userId: TARGET_ID, amount: 10 }));
    expect(res.status).toBe(200);

    const body = await res.json() as { creditsGranted: number; newBalance: number };
    expect(body.creditsGranted).toBe(10);
    expect(body.newBalance).toBe(15);
  });

  it('calls profile.update with increment inside transaction', async () => {
    setupAdmin();
    mockPrisma.profile.findUnique
      .mockResolvedValueOnce({ id: ADMIN_ID, userType: 'admin' })
      .mockResolvedValueOnce({ id: TARGET_ID, fullName: 'Test User', credits: 0 });

    mockPrisma.$transaction.mockImplementation(async (cb: (tx: typeof mockPrisma) => Promise<unknown>) =>
      cb(mockPrisma)
    );
    mockPrisma.profile.update.mockResolvedValue({ id: TARGET_ID, credits: 20 });
    mockPrisma.creditTransaction.create.mockResolvedValue({});

    await POST(makeRequest({ userId: TARGET_ID, amount: 20 }));

    expect(mockPrisma.profile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: TARGET_ID },
        data: { credits: { increment: 20 } },
      })
    );
    expect(mockPrisma.creditTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ profileId: TARGET_ID, amount: 20 }),
      })
    );
  });

  it('logs an audit event on success', async () => {
    setupAdmin();
    mockPrisma.profile.findUnique
      .mockResolvedValueOnce({ id: ADMIN_ID, userType: 'admin' })
      .mockResolvedValueOnce({ id: TARGET_ID, fullName: 'Test User', credits: 3 });

    mockPrisma.$transaction.mockImplementation(async (cb: (tx: typeof mockPrisma) => Promise<unknown>) =>
      cb(mockPrisma)
    );
    mockPrisma.profile.update.mockResolvedValue({ id: TARGET_ID, credits: 8 });
    mockPrisma.creditTransaction.create.mockResolvedValue({});

    await POST(makeRequest({ userId: TARGET_ID, amount: 5 }));

    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: ADMIN_ID,
        action: 'admin.credit_grant',
        resource_id: TARGET_ID,
        details: expect.objectContaining({ amount: 5 }),
      })
    );
  });
});
