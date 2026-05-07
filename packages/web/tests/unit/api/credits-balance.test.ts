/**
 * Tests for GET /api/credits/balance
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockAuth = vi.fn();
vi.mock('@clerk/nextjs/server', () => ({
  auth: () => mockAuth(),
}));

const mockPrisma = {
  profile: { findUnique: vi.fn() },
  creditTransaction: { findMany: vi.fn() },
};
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));

vi.mock('@/lib/api/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue(null),
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
}));

vi.mock('@/lib/logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ── Import after mocks ────────────────────────────────────────────────────────

const { GET } = await import('@/app/api/credits/balance/route');

// ── Fixtures ──────────────────────────────────────────────────────────────────

const USER_ID = 'user_clerk123';

function makeRequest(): NextRequest {
  return new NextRequest('https://example.com/api/credits/balance', { method: 'GET' });
}

const MOCK_TRANSACTIONS = [
  { id: 'tx-1', profileId: USER_ID, amount: 3, reason: 'signup_bonus', createdAt: new Date('2026-05-01') },
  { id: 'tx-2', profileId: USER_ID, amount: -1, reason: 'scene_generation', createdAt: new Date('2026-05-02') },
];

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /api/credits/balance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockReturnValue({ userId: USER_ID });
    mockPrisma.profile.findUnique.mockResolvedValue({ id: USER_ID, credits: 2 });
    mockPrisma.creditTransaction.findMany.mockResolvedValue(MOCK_TRANSACTIONS);
  });

  it('returns credit balance and last 10 transactions', async () => {
    const response = await GET(makeRequest());
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.credits).toBe(2);
    expect(json.transactions).toHaveLength(2);
    expect(json.transactions[0].reason).toBe('signup_bonus');
  });

  it('queries transactions ordered by createdAt desc, limited to 10', async () => {
    await GET(makeRequest());

    expect(mockPrisma.creditTransaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { profileId: USER_ID },
        orderBy: { createdAt: 'desc' },
        take: 10,
      })
    );
  });

  it('returns credits 0 and empty transactions for new user', async () => {
    mockPrisma.profile.findUnique.mockResolvedValue({ id: USER_ID, credits: 0 });
    mockPrisma.creditTransaction.findMany.mockResolvedValue([]);

    const response = await GET(makeRequest());
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.credits).toBe(0);
    expect(json.transactions).toHaveLength(0);
  });

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockReturnValue({ userId: null });

    const response = await GET(makeRequest());
    expect(response.status).toBe(401);
  });

  it('returns 404 when profile not found', async () => {
    mockPrisma.profile.findUnique.mockResolvedValue(null);

    const response = await GET(makeRequest());
    expect(response.status).toBe(404);
  });
});
