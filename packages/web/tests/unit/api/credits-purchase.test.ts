/**
 * Tests for POST /api/credits/purchase
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
};
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));

const mockValidateCsrf = vi.fn(() => null);
vi.mock('@/lib/csrf', () => ({
  validateCsrf: (...args: unknown[]) => mockValidateCsrf(...args),
}));

vi.mock('@/lib/api/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue(null),
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
}));

vi.mock('@/lib/logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const mockCheckoutSessionsCreate = vi.fn();
vi.mock('@/lib/stripe/server', () => ({
  getStripeServer: () => ({
    checkout: { sessions: { create: (...args: unknown[]) => mockCheckoutSessionsCreate(...args) } },
  }),
}));

// ── Import after mocks ────────────────────────────────────────────────────────

const { POST } = await import('@/app/api/credits/purchase/route');

// ── Fixtures ──────────────────────────────────────────────────────────────────

const USER_ID = 'user_clerk123';
const CHECKOUT_URL = 'https://checkout.stripe.com/pay/cs_test_credits';

function makeRequest(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('https://example.com/api/credits/purchase', {
    method: 'POST',
    headers: { origin: 'https://app.storymagicapp.net', ...headers },
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/credits/purchase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockReturnValue({ userId: USER_ID });
    mockPrisma.profile.findUnique.mockResolvedValue({ id: USER_ID, email: 'user@example.com' });
    mockCheckoutSessionsCreate.mockResolvedValue({ url: CHECKOUT_URL });
  });

  it('returns Stripe checkout URL', async () => {
    const response = await POST(makeRequest());
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.url).toBe(CHECKOUT_URL);
  });

  it('creates checkout session with correct price and metadata', async () => {
    await POST(makeRequest());

    expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'payment',
        line_items: [
          expect.objectContaining({
            quantity: 1,
            price_data: expect.objectContaining({
              currency: 'usd',
              unit_amount: 999,
            }),
          }),
        ],
        metadata: expect.objectContaining({
          type: 'credit_purchase',
          userId: USER_ID,
          credits: '20',
        }),
      })
    );
  });

  it('prefills customer_email when profile has email', async () => {
    await POST(makeRequest());

    expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ customer_email: 'user@example.com' })
    );
  });

  it('omits customer_email when profile has no email', async () => {
    mockPrisma.profile.findUnique.mockResolvedValue({ id: USER_ID, email: null });

    await POST(makeRequest());

    const call = mockCheckoutSessionsCreate.mock.calls[0][0] as Record<string, unknown>;
    expect(call).not.toHaveProperty('customer_email');
  });

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockReturnValue({ userId: null });

    const response = await POST(makeRequest());
    expect(response.status).toBe(401);
  });

  it('returns 400 on CSRF failure', async () => {
    mockValidateCsrf.mockReturnValue('Origin not allowed');

    const response = await POST(makeRequest());
    expect(response.status).toBe(403);
  });
});
