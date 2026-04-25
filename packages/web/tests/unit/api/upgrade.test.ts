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

const mockPrisma = {
  profile: { update: vi.fn() },
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
    mockPrisma.profile.update.mockResolvedValue({});

    await POST(makeRequest({ tier: 'studio' }));

    expect(mockPrisma.profile.update).toHaveBeenCalledWith({
      where: { id: USER_ID },
      data: { subscriptionTier: 'studio', subscriptionStatus: 'active' },
    });
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
