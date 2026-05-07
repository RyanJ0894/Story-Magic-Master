/**
 * Tests for Advanced Analysis API Route
 *
 * GET  /api/projects/[id]/advanced-analysis — check purchase status
 * POST /api/projects/[id]/advanced-analysis — create Stripe checkout session
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockAuth = vi.fn();
vi.mock('@clerk/nextjs/server', () => ({
  auth: () => mockAuth(),
}));

const mockPrisma = {
  project: { findFirst: vi.fn() },
  purchase: { findFirst: vi.fn() },
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

// ── Imports after mocks ───────────────────────────────────────────────────────

const { GET, POST } = await import(
  '@/app/api/projects/[id]/advanced-analysis/route'
);

// ── Fixtures ──────────────────────────────────────────────────────────────────

const PROJECT_ID = '550e8400-e29b-41d4-a716-446655440000';
const USER_ID = 'user_clerk123';

const MOCK_PROJECT = { id: PROJECT_ID, userId: USER_ID };

function makeRequest(method: 'GET' | 'POST', headers?: Record<string, string>): NextRequest {
  return new NextRequest(
    `https://example.com/api/projects/${PROJECT_ID}/advanced-analysis`,
    { method, headers }
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Advanced Analysis API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockReturnValue({ userId: USER_ID });
    mockPrisma.project.findFirst.mockResolvedValue(MOCK_PROJECT);
    mockPrisma.purchase.findFirst.mockResolvedValue(null);
    mockPrisma.profile.findUnique.mockResolvedValue({ email: 'user@example.com' });
    mockCheckoutSessionsCreate.mockResolvedValue({
      url: 'https://checkout.stripe.com/pay/cs_test_abc',
    });
  });

  describe('GET — purchase status', () => {
    it('returns purchased: false when no purchase exists', async () => {
      mockPrisma.purchase.findFirst.mockResolvedValue(null);

      const response = await GET(makeRequest('GET'), { params: Promise.resolve({ id: PROJECT_ID }) });
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.purchased).toBe(false);
      expect(json.price).toBe(999);
    });

    it('returns purchased: true when completed purchase exists', async () => {
      mockPrisma.purchase.findFirst.mockResolvedValue({ id: 'purchase-1' });

      const response = await GET(makeRequest('GET'), { params: Promise.resolve({ id: PROJECT_ID }) });
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.purchased).toBe(true);
    });

    it('returns 401 when not authenticated', async () => {
      mockAuth.mockReturnValue({ userId: null });

      const response = await GET(makeRequest('GET'), { params: Promise.resolve({ id: PROJECT_ID }) });
      expect(response.status).toBe(401);
    });

    it('returns 404 when project does not belong to user', async () => {
      mockPrisma.project.findFirst.mockResolvedValue(null);

      const response = await GET(makeRequest('GET'), { params: Promise.resolve({ id: PROJECT_ID }) });
      expect(response.status).toBe(404);
    });
  });

  describe('POST — create checkout session', () => {
    it('returns checkout URL when no existing purchase', async () => {
      const response = await POST(makeRequest('POST'), { params: Promise.resolve({ id: PROJECT_ID }) });
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.url).toBe('https://checkout.stripe.com/pay/cs_test_abc');
    });

    it('returns alreadyOwned: true when purchase already completed', async () => {
      mockPrisma.purchase.findFirst.mockResolvedValue({ id: 'existing-purchase' });

      const response = await POST(makeRequest('POST'), { params: Promise.resolve({ id: PROJECT_ID }) });
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.purchased).toBe(true);
      expect(json.alreadyOwned).toBe(true);
      expect(mockCheckoutSessionsCreate).not.toHaveBeenCalled();
    });

    it('creates checkout session with correct metadata', async () => {
      const request = new NextRequest(
        `https://example.com/api/projects/${PROJECT_ID}/advanced-analysis`,
        { method: 'POST', headers: { origin: 'https://app.storymagicapp.net' } }
      );

      await POST(request, { params: Promise.resolve({ id: PROJECT_ID }) });

      expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'payment',
          metadata: expect.objectContaining({
            type: 'advanced_analysis',
            userId: USER_ID,
            projectId: PROJECT_ID,
          }),
        })
      );
    });

    it('prefills customer_email when profile has email', async () => {
      await POST(makeRequest('POST'), { params: Promise.resolve({ id: PROJECT_ID }) });

      expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({ customer_email: 'user@example.com' })
      );
    });

    it('omits customer_email when profile has no email', async () => {
      mockPrisma.profile.findUnique.mockResolvedValue({ email: null });

      await POST(makeRequest('POST'), { params: Promise.resolve({ id: PROJECT_ID }) });

      const call = mockCheckoutSessionsCreate.mock.calls[0][0] as Record<string, unknown>;
      expect(call).not.toHaveProperty('customer_email');
    });

    it('returns 401 when not authenticated', async () => {
      mockAuth.mockReturnValue({ userId: null });

      const response = await POST(makeRequest('POST'), { params: Promise.resolve({ id: PROJECT_ID }) });
      expect(response.status).toBe(401);
    });

    it('returns 404 when project does not belong to user', async () => {
      mockPrisma.project.findFirst.mockResolvedValue(null);

      const response = await POST(makeRequest('POST'), { params: Promise.resolve({ id: PROJECT_ID }) });
      expect(response.status).toBe(404);
    });
  });
});
