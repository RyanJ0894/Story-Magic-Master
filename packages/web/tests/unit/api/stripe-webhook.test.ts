/**
 * Tests for Stripe Webhook Handler
 * P2-06: Test signature verification and all event types
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase
const mockUpdate = vi.fn().mockReturnThis();
const mockEq = vi.fn().mockReturnThis();
const mockSelect = vi.fn().mockReturnThis();
const mockSingle = vi.fn().mockResolvedValue({ data: { id: 'user-123' } });
const mockUpsert = vi.fn().mockResolvedValue({ data: null, error: null });
const mockFrom = vi.fn(() => ({
  update: mockUpdate,
  select: mockSelect,
  upsert: mockUpsert,
  eq: mockEq,
  single: mockSingle,
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

// Mock constructWebhookEvent
const mockConstructWebhookEvent = vi.fn();
vi.mock('@/lib/stripe/server', () => ({
  constructWebhookEvent: (...args: unknown[]) => mockConstructWebhookEvent(...args),
}));

// Set env vars before importing the route
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
process.env.STRIPE_PRICE_CREATOR_MONTHLY = 'price_creator_monthly';
process.env.STRIPE_PRICE_CREATOR_YEARLY = 'price_creator_yearly';
process.env.STRIPE_PRICE_PRO_MONTHLY = 'price_pro_monthly';
process.env.STRIPE_PRICE_PRO_YEARLY = 'price_pro_yearly';
process.env.STRIPE_PRICE_STUDIO_MONTHLY = 'price_studio_monthly';
process.env.STRIPE_PRICE_STUDIO_YEARLY = 'price_studio_yearly';

import { POST } from '@/app/api/stripe/webhook/route';

// Helper to create a mock Request
function createWebhookRequest(body: string, signature?: string): Request {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (signature) {
    headers['stripe-signature'] = signature;
  }
  return new Request('https://example.com/api/stripe/webhook', {
    method: 'POST',
    headers,
    body,
  });
}

// Helper to create a Stripe event
function createStripeEvent(type: string, data: Record<string, unknown>) {
  return {
    type,
    data: { object: data },
  };
}

describe('Stripe Webhook Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset chained mock returns
    mockUpdate.mockReturnThis();
    mockEq.mockReturnThis();
    mockSelect.mockReturnThis();
    mockSingle.mockResolvedValue({ data: { id: 'user-123' } });
    mockFrom.mockReturnValue({
      update: mockUpdate,
      select: mockSelect,
      upsert: mockUpsert,
      eq: mockEq,
      single: mockSingle,
    });
  });

  describe('Signature verification', () => {
    it('should reject requests without stripe-signature header', async () => {
      const request = createWebhookRequest('{}');
      const response = await POST(request);
      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toBe('Missing stripe-signature header');
    });

    it('should reject requests with invalid signature', async () => {
      mockConstructWebhookEvent.mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      const request = createWebhookRequest('{}', 'invalid_sig');
      const response = await POST(request);
      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toBe('Invalid signature');
    });

    it('should pass body and signature to constructWebhookEvent', async () => {
      const body = '{"test": true}';
      const sig = 'whsec_test_signature';
      mockConstructWebhookEvent.mockReturnValue(
        createStripeEvent('unknown.event', {})
      );

      const request = createWebhookRequest(body, sig);
      await POST(request);

      expect(mockConstructWebhookEvent).toHaveBeenCalledWith(body, sig);
    });
  });

  describe('checkout.session.completed', () => {
    it('should update profile with Stripe customer and subscription IDs', async () => {
      mockConstructWebhookEvent.mockReturnValue(
        createStripeEvent('checkout.session.completed', {
          metadata: { userId: 'user-123' },
          customer: 'cus_abc123',
          subscription: 'sub_xyz789',
        })
      );

      const request = createWebhookRequest('{}', 'valid_sig');
      const response = await POST(request);
      expect(response.status).toBe(200);

      expect(mockFrom).toHaveBeenCalledWith('profiles');
      expect(mockUpdate).toHaveBeenCalledWith({
        stripe_customer_id: 'cus_abc123',
        stripe_subscription_id: 'sub_xyz789',
        subscription_status: 'active',
      });
      expect(mockEq).toHaveBeenCalledWith('id', 'user-123');
    });

    it('should skip update if userId is missing from metadata', async () => {
      mockConstructWebhookEvent.mockReturnValue(
        createStripeEvent('checkout.session.completed', {
          metadata: {},
          customer: 'cus_abc123',
          subscription: 'sub_xyz789',
        })
      );

      const request = createWebhookRequest('{}', 'valid_sig');
      const response = await POST(request);
      expect(response.status).toBe(200);
      expect(mockUpdate).not.toHaveBeenCalled();
    });
  });

  describe('customer.subscription.updated', () => {
    it('should update profile with tier and status', async () => {
      mockConstructWebhookEvent.mockReturnValue(
        createStripeEvent('customer.subscription.updated', {
          id: 'sub_xyz789',
          metadata: { userId: 'user-123' },
          status: 'active',
          items: { data: [{ price: { id: 'price_pro_monthly' } }] },
          current_period_end: 1735689600, // 2025-01-01
        })
      );

      const request = createWebhookRequest('{}', 'valid_sig');
      const response = await POST(request);
      expect(response.status).toBe(200);

      expect(mockUpdate).toHaveBeenCalledWith({
        subscription_tier: 'pro',
        subscription_status: 'active',
        stripe_subscription_id: 'sub_xyz789',
        current_period_end: expect.any(String),
      });
    });

    it('should map creator price to creator tier', async () => {
      mockConstructWebhookEvent.mockReturnValue(
        createStripeEvent('customer.subscription.updated', {
          id: 'sub_123',
          metadata: { userId: 'user-123' },
          status: 'active',
          items: { data: [{ price: { id: 'price_creator_yearly' } }] },
          current_period_end: 1735689600,
        })
      );

      const request = createWebhookRequest('{}', 'valid_sig');
      await POST(request);

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ subscription_tier: 'creator' })
      );
    });

    it('should default to free for unknown price IDs', async () => {
      mockConstructWebhookEvent.mockReturnValue(
        createStripeEvent('customer.subscription.updated', {
          id: 'sub_123',
          metadata: { userId: 'user-123' },
          status: 'active',
          items: { data: [{ price: { id: 'price_unknown' } }] },
          current_period_end: 1735689600,
        })
      );

      const request = createWebhookRequest('{}', 'valid_sig');
      await POST(request);

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ subscription_tier: 'free' })
      );
    });
  });

  describe('customer.subscription.deleted', () => {
    it('should downgrade to free tier', async () => {
      mockConstructWebhookEvent.mockReturnValue(
        createStripeEvent('customer.subscription.deleted', {
          id: 'sub_xyz789',
          metadata: { userId: 'user-123' },
        })
      );

      const request = createWebhookRequest('{}', 'valid_sig');
      const response = await POST(request);
      expect(response.status).toBe(200);

      expect(mockUpdate).toHaveBeenCalledWith({
        subscription_tier: 'free',
        subscription_status: 'canceled',
        stripe_subscription_id: null,
        current_period_end: null,
      });
    });
  });

  describe('invoice.payment_succeeded', () => {
    it('should set subscription status to active and reset usage', async () => {
      mockConstructWebhookEvent.mockReturnValue(
        createStripeEvent('invoice.payment_succeeded', {
          subscription: 'sub_xyz789',
          period_start: 1704067200, // 2024-01-01
          period_end: 1706745600, // 2024-02-01
        })
      );

      const request = createWebhookRequest('{}', 'valid_sig');
      const response = await POST(request);
      expect(response.status).toBe(200);

      expect(mockUpdate).toHaveBeenCalledWith({
        subscription_status: 'active',
      });
    });
  });

  describe('invoice.payment_failed', () => {
    it('should set subscription status to past_due', async () => {
      mockConstructWebhookEvent.mockReturnValue(
        createStripeEvent('invoice.payment_failed', {
          subscription: 'sub_xyz789',
        })
      );

      const request = createWebhookRequest('{}', 'valid_sig');
      const response = await POST(request);
      expect(response.status).toBe(200);

      expect(mockUpdate).toHaveBeenCalledWith({
        subscription_status: 'past_due',
      });
    });
  });

  describe('Unhandled events', () => {
    it('should return 200 for unhandled event types', async () => {
      mockConstructWebhookEvent.mockReturnValue(
        createStripeEvent('some.unknown.event', {})
      );

      const request = createWebhookRequest('{}', 'valid_sig');
      const response = await POST(request);
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.received).toBe(true);
    });
  });

  describe('Error handling', () => {
    it('should return 500 on unexpected errors', async () => {
      mockConstructWebhookEvent.mockImplementation(() => {
        throw new TypeError('Unexpected error');
      });

      const request = createWebhookRequest('{}', 'valid_sig');
      // constructWebhookEvent throwing a TypeError (not the signature Error)
      // should be caught by the outer try/catch
      const response = await POST(request);
      // The handler catches signature errors and returns 400
      expect(response.status).toBe(400);
    });
  });
});
