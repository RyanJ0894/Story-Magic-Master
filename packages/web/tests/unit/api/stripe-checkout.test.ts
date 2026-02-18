/**
 * Tests for Stripe Checkout and Portal Routes
 * Covers POST /api/stripe/checkout and POST /api/stripe/portal
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Mocks (must be declared before imports that use them)
// ---------------------------------------------------------------------------

// Mock Clerk auth
const mockAuth = vi.fn();
vi.mock('@clerk/nextjs/server', () => ({
  auth: () => mockAuth(),
}));

// Mock Prisma
const mockProfileFindUnique = vi.fn();
vi.mock('@/lib/db', () => ({
  prisma: {
    profile: {
      findUnique: (...args: unknown[]) => mockProfileFindUnique(...args),
    },
  },
}));

// Mock CSRF validation
const mockValidateCsrf = vi.fn(() => null);
vi.mock('@/lib/csrf', () => ({
  validateCsrf: (...args: unknown[]) => mockValidateCsrf(...args),
}));

// Mock rate limit
vi.mock('@/lib/api/rate-limit', () => ({
  rateLimit: vi.fn(() => Promise.resolve(null)),
  getClientIp: vi.fn(() => '127.0.0.1'),
}));

// Mock Stripe server functions
const mockCreateCheckoutSession = vi.fn();
const mockCreatePortalSession = vi.fn();
vi.mock('@/lib/stripe/server', () => ({
  createCheckoutSession: (...args: unknown[]) => mockCreateCheckoutSession(...args),
  createPortalSession: (...args: unknown[]) => mockCreatePortalSession(...args),
}));

// Mock Stripe config
vi.mock('@/lib/stripe/config', () => ({
  STRIPE_CONFIG: {
    prices: {
      creator: { monthly: 'price_creator_monthly', yearly: 'price_creator_yearly' },
      pro: { monthly: 'price_pro_monthly', yearly: 'price_pro_yearly' },
      studio: { monthly: 'price_studio_monthly', yearly: 'price_studio_yearly' },
    },
  },
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { POST as checkoutPOST } from '@/app/api/stripe/checkout/route';
import { POST as portalPOST } from '@/app/api/stripe/portal/route';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE_URL = 'http://localhost:22000';

function createCheckoutRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest(`${BASE_URL}/api/stripe/checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      origin: BASE_URL,
    },
    body: JSON.stringify(body),
  });
}

function createPortalRequest(): NextRequest {
  return new NextRequest(`${BASE_URL}/api/stripe/portal`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      origin: BASE_URL,
    },
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Stripe Checkout Route (POST /api/stripe/checkout)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: authenticated user
    mockAuth.mockResolvedValue({ userId: 'user-123' });
    mockValidateCsrf.mockReturnValue(null);
    mockProfileFindUnique.mockResolvedValue({ email: 'test@example.com' });
    mockCreateCheckoutSession.mockResolvedValue({
      id: 'cs_test_session_id',
      url: 'https://checkout.stripe.com/pay/cs_test_session_id',
    });
  });

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue({ userId: null });

    const request = createCheckoutRequest({ tier: 'pro', interval: 'monthly' });
    const response = await checkoutPOST(request);

    expect(response.status).toBe(401);
    const json = await response.json();
    expect(json.error).toBe('Unauthorized');
    expect(json.code).toBe('AUTH_REQUIRED');
  });

  it('returns 400 for invalid tier', async () => {
    const request = createCheckoutRequest({ tier: 'enterprise', interval: 'monthly' });
    const response = await checkoutPOST(request);

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe('Invalid request parameters');
  });

  it('returns 400 for missing tier', async () => {
    const request = createCheckoutRequest({ interval: 'monthly' });
    const response = await checkoutPOST(request);

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe('Invalid request parameters');
  });

  it('returns 400 for invalid interval', async () => {
    const request = createCheckoutRequest({ tier: 'pro', interval: 'weekly' });
    const response = await checkoutPOST(request);

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe('Invalid request parameters');
  });

  it('returns 400 for missing interval', async () => {
    const request = createCheckoutRequest({ tier: 'pro' });
    const response = await checkoutPOST(request);

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe('Invalid request parameters');
  });

  it('returns 200 with sessionId and url on success', async () => {
    const request = createCheckoutRequest({ tier: 'pro', interval: 'monthly' });
    const response = await checkoutPOST(request);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.sessionId).toBe('cs_test_session_id');
    expect(json.url).toBe('https://checkout.stripe.com/pay/cs_test_session_id');
  });

  it('creates checkout session with correct parameters', async () => {
    const request = createCheckoutRequest({ tier: 'studio', interval: 'yearly' });
    await checkoutPOST(request);

    expect(mockCreateCheckoutSession).toHaveBeenCalledWith({
      priceId: 'price_studio_yearly',
      userId: 'user-123',
      userEmail: 'test@example.com',
      successUrl: `${BASE_URL}/billing?success=true`,
      cancelUrl: `${BASE_URL}/pricing?canceled=true`,
    });
  });

  it('passes correct priceId for each tier and interval combination', async () => {
    const combos = [
      { tier: 'creator', interval: 'monthly', expected: 'price_creator_monthly' },
      { tier: 'creator', interval: 'yearly', expected: 'price_creator_yearly' },
      { tier: 'pro', interval: 'monthly', expected: 'price_pro_monthly' },
      { tier: 'pro', interval: 'yearly', expected: 'price_pro_yearly' },
    ];

    for (const { tier, interval, expected } of combos) {
      vi.clearAllMocks();
      mockAuth.mockResolvedValue({ userId: 'user-123' });
      mockValidateCsrf.mockReturnValue(null);
      mockProfileFindUnique.mockResolvedValue({ email: 'test@example.com' });
      mockCreateCheckoutSession.mockResolvedValue({ id: 'cs_id', url: 'https://stripe.com' });

      const request = createCheckoutRequest({ tier, interval });
      await checkoutPOST(request);

      expect(mockCreateCheckoutSession).toHaveBeenCalledWith(
        expect.objectContaining({ priceId: expected }),
      );
    }
  });

  it('handles missing email gracefully by passing empty string', async () => {
    mockProfileFindUnique.mockResolvedValue(null);

    const request = createCheckoutRequest({ tier: 'pro', interval: 'monthly' });
    await checkoutPOST(request);

    expect(mockCreateCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({ userEmail: '' }),
    );
  });

  it('returns 500 when Stripe createCheckoutSession throws', async () => {
    mockCreateCheckoutSession.mockRejectedValue(new Error('Stripe API error'));

    const request = createCheckoutRequest({ tier: 'pro', interval: 'monthly' });
    const response = await checkoutPOST(request);

    expect(response.status).toBe(500);
    const json = await response.json();
    expect(json.error).toBe('Failed to create checkout session');
  });
});

describe('Stripe Portal Route (POST /api/stripe/portal)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: authenticated user with Stripe customer ID
    mockAuth.mockResolvedValue({ userId: 'user-123' });
    mockValidateCsrf.mockReturnValue(null);
    mockProfileFindUnique.mockResolvedValue({
      stripeCustomerId: 'cus_test_customer_id',
    });
    mockCreatePortalSession.mockResolvedValue({
      url: 'https://billing.stripe.com/p/session/test_session',
    });
  });

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue({ userId: null });

    const request = createPortalRequest();
    const response = await portalPOST(request);

    expect(response.status).toBe(401);
    const json = await response.json();
    expect(json.error).toBe('Unauthorized');
    expect(json.code).toBe('AUTH_REQUIRED');
  });

  it('returns 400 when user has no stripeCustomerId', async () => {
    mockProfileFindUnique.mockResolvedValue({ stripeCustomerId: null });

    const request = createPortalRequest();
    const response = await portalPOST(request);

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe('No subscription found');
  });

  it('returns 400 when profile is not found', async () => {
    mockProfileFindUnique.mockResolvedValue(null);

    const request = createPortalRequest();
    const response = await portalPOST(request);

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe('No subscription found');
  });

  it('returns 200 with portal URL on success', async () => {
    const request = createPortalRequest();
    const response = await portalPOST(request);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.url).toBe('https://billing.stripe.com/p/session/test_session');
  });

  it('calls createPortalSession with correct parameters', async () => {
    const request = createPortalRequest();
    await portalPOST(request);

    expect(mockCreatePortalSession).toHaveBeenCalledWith({
      customerId: 'cus_test_customer_id',
      returnUrl: `${BASE_URL}/billing`,
    });
  });

  it('returns 500 when Stripe createPortalSession throws', async () => {
    mockCreatePortalSession.mockRejectedValue(new Error('Stripe API error'));

    const request = createPortalRequest();
    const response = await portalPOST(request);

    expect(response.status).toBe(500);
    const json = await response.json();
    expect(json.error).toBe('Failed to create portal session');
  });
});
