/**
 * Tests for Referral Upgrade API Route
 *
 * POST /api/referral/upgrade — validate a referral code and upgrade the user's tier
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

// 2026-06-14: route migrated to provisionTier which uses interactive
// $transaction(async (tx) => ...). The mock invokes the callback with our
// tx object so all sub-table calls land on the same mocks the assertions
// check.
const mockTx = {
  profile: { update: vi.fn() },
  subscription: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
};
const mockPrisma = {
  profile: mockTx.profile,
  subscription: mockTx.subscription,
  $transaction: vi.fn(),
};
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));

// Import after mocks
const { POST } = await import('@/app/api/referral/upgrade/route');

// =============================================================================
// Helpers
// =============================================================================

const USER_ID = 'user_referral456';

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/referral/upgrade', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// =============================================================================
// Tests
// =============================================================================

describe('POST /api/referral/upgrade', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.REFERRAL_CODES;
    mockTx.subscription.findFirst.mockResolvedValue(null);
    mockTx.subscription.create.mockResolvedValue({ id: 'sub-new' });
    mockTx.subscription.update.mockResolvedValue({ id: 'sub-existing' });
    mockTx.profile.update.mockResolvedValue({});
    mockPrisma.$transaction.mockImplementation(async (cb: (t: typeof mockTx) => Promise<unknown>) => cb(mockTx));
  });

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await POST(makeRequest({ code: 'SMPRO' }));
    expect(res.status).toBe(401);
  });

  it('returns 400 when no code is provided', async () => {
    mockAuth.mockResolvedValue({ userId: USER_ID });
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/required/i);
  });

  it('returns 400 for an invalid referral code', async () => {
    mockAuth.mockResolvedValue({ userId: USER_ID });
    const res = await POST(makeRequest({ code: 'NOTACODE' }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/invalid/i);
  });

  it.each([
    ['STORYMAGIC2026', 'creator'],
    ['SMCREATOR',      'creator'],
    ['SMPRO',          'pro'],
    ['SMSTUDIO',       'studio'],
    ['SMENTERPRISE',   'enterprise'],
  ])('accepts built-in code "%s" → tier "%s"', async (code, expectedTier) => {
    mockAuth.mockResolvedValue({ userId: USER_ID });
    mockPrisma.profile.update.mockResolvedValue({});

    const res = await POST(makeRequest({ code }));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.tier).toBe(expectedTier);
    expect(typeof json.tierName).toBe('string');
  });

  it('normalises code to uppercase before lookup', async () => {
    mockAuth.mockResolvedValue({ userId: USER_ID });
    mockPrisma.profile.update.mockResolvedValue({});

    const res = await POST(makeRequest({ code: 'smpro' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.tier).toBe('pro');
  });

  it('trims whitespace from code', async () => {
    mockAuth.mockResolvedValue({ userId: USER_ID });
    mockPrisma.profile.update.mockResolvedValue({});

    const res = await POST(makeRequest({ code: '  SMSTUDIO  ' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.tier).toBe('studio');
  });

  it('calls prisma.profile.update with correct data', async () => {
    mockAuth.mockResolvedValue({ userId: USER_ID });
    mockPrisma.profile.update.mockResolvedValue({});

    await POST(makeRequest({ code: 'SMPRO' }));

    expect(mockPrisma.profile.update).toHaveBeenCalledWith({
      where: { id: USER_ID },
      data: { subscriptionTier: 'pro', subscriptionStatus: 'active' },
    });
  });

  it('merges env REFERRAL_CODES with built-in codes', async () => {
    process.env.REFERRAL_CODES = JSON.stringify({ TESTCODE: 'enterprise' });
    mockAuth.mockResolvedValue({ userId: USER_ID });
    mockPrisma.profile.update.mockResolvedValue({});

    const res = await POST(makeRequest({ code: 'TESTCODE' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.tier).toBe('enterprise');
  });

  it('falls back to built-in codes when REFERRAL_CODES env is malformed JSON', async () => {
    process.env.REFERRAL_CODES = 'not-valid-json{{{';
    mockAuth.mockResolvedValue({ userId: USER_ID });
    mockPrisma.profile.update.mockResolvedValue({});

    // Built-in codes should still work
    const res = await POST(makeRequest({ code: 'SMPRO' }));
    expect(res.status).toBe(200);
  });
});
