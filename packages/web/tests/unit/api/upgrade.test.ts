/**
 * Tests for Direct Upgrade API Route
 *
 * POST /api/upgrade — upgrade the current user's subscription tier directly
 * (no Stripe). Gated by ALLOW_DIRECT_UPGRADE=true env var.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// =============================================================================
// Mocks
// =============================================================================

const mockAuth = vi.fn();
vi.mock('@clerk/nextjs/server', () => ({
  auth: () => mockAuth(),
}));

// 2026-06-14: /api/upgrade was migrated from a direct prisma.profile.update
// to provisionTier(prisma, ...), which uses interactive $transaction. The
// mock now exposes both the outer prisma and the inner tx surface — we
// invoke the callback with the inner tx so the route's downstream code sees
// the same mocked tables.
const mockTx = {
  profile: { update: vi.fn() },
  subscription: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
};
const mockPrisma = {
  // expose profile.update on the outer too so the legacy assertions still pass
  profile: mockTx.profile,
  subscription: mockTx.subscription,
  $transaction: vi.fn(),
};
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));

// Import after mocks
const { POST } = await import('@/app/api/upgrade/route');

// =============================================================================
// Helpers
// =============================================================================

const USER_ID = 'user_upgrade123';

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/upgrade', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// =============================================================================
// Tests
// =============================================================================

describe('POST /api/upgrade', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.ALLOW_DIRECT_UPGRADE;
    // Default $transaction behavior: invoke the callback with our mocked
    // tx. By default no existing subscription row.
    mockTx.subscription.findFirst.mockResolvedValue(null);
    mockTx.subscription.create.mockResolvedValue({ id: 'sub-new' });
    mockTx.subscription.update.mockResolvedValue({ id: 'sub-existing' });
    mockTx.profile.update.mockResolvedValue({});
    mockPrisma.$transaction.mockImplementation(async (cb: (t: typeof mockTx) => Promise<unknown>) => cb(mockTx));
  });

  it('returns 403 when ALLOW_DIRECT_UPGRADE is not set', async () => {
    mockAuth.mockResolvedValue({ userId: USER_ID });
    const res = await POST(makeRequest({ tier: 'pro' }));
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toMatch(/not enabled/i);
  });

  it('returns 403 when ALLOW_DIRECT_UPGRADE is false', async () => {
    process.env.ALLOW_DIRECT_UPGRADE = 'false';
    mockAuth.mockResolvedValue({ userId: USER_ID });
    const res = await POST(makeRequest({ tier: 'pro' }));
    expect(res.status).toBe(403);
  });

  it('returns 401 when not authenticated', async () => {
    process.env.ALLOW_DIRECT_UPGRADE = 'true';
    mockAuth.mockResolvedValue({ userId: null });
    const res = await POST(makeRequest({ tier: 'pro' }));
    expect(res.status).toBe(401);
  });

  it('returns 400 for an invalid tier', async () => {
    process.env.ALLOW_DIRECT_UPGRADE = 'true';
    mockAuth.mockResolvedValue({ userId: USER_ID });
    const res = await POST(makeRequest({ tier: 'diamond' }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/invalid tier/i);
  });

  it('returns 400 for missing tier', async () => {
    process.env.ALLOW_DIRECT_UPGRADE = 'true';
    mockAuth.mockResolvedValue({ userId: USER_ID });
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it.each(['creator', 'pro', 'studio', 'enterprise', 'university'])(
    'upgrades to valid tier "%s" and returns 200',
    async (tier) => {
      process.env.ALLOW_DIRECT_UPGRADE = 'true';
      mockAuth.mockResolvedValue({ userId: USER_ID });
      mockPrisma.profile.update.mockResolvedValue({});

      const res = await POST(makeRequest({ tier }));
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.tier).toBe(tier);
      expect(typeof json.tierName).toBe('string');
    }
  );

  it('calls prisma.profile.update with correct data', async () => {
    process.env.ALLOW_DIRECT_UPGRADE = 'true';
    mockAuth.mockResolvedValue({ userId: USER_ID });

    await POST(makeRequest({ tier: 'studio' }));

    expect(mockTx.profile.update).toHaveBeenCalledWith({
      where: { id: USER_ID },
      data: { subscriptionTier: 'studio', subscriptionStatus: 'active' },
    });
  });

  it('also writes a subscription row (DT-30-M-1 regression)', async () => {
    process.env.ALLOW_DIRECT_UPGRADE = 'true';
    mockAuth.mockResolvedValue({ userId: USER_ID });

    await POST(makeRequest({ tier: 'studio' }));

    // The pre-2026-06-14 bug was that /api/upgrade only touched profile,
    // leaving cost rollups blind to the user. Either create (no existing
    // row) or update (existing row) must be called.
    const wrote =
      mockTx.subscription.create.mock.calls.length +
      mockTx.subscription.update.mock.calls.length;
    expect(wrote).toBeGreaterThan(0);
  });

  it('normalises tier to lowercase before validation', async () => {
    process.env.ALLOW_DIRECT_UPGRADE = 'true';
    mockAuth.mockResolvedValue({ userId: USER_ID });
    mockPrisma.profile.update.mockResolvedValue({});

    const res = await POST(makeRequest({ tier: 'PRO' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.tier).toBe('pro');
  });
});
