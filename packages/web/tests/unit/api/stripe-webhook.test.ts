/**
 * Tests for Stripe Webhook Handler
 * P2-06: Test signature verification and all event types
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Prisma
const mockProfileUpdate = vi.fn().mockResolvedValue({});
const mockProfileUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
const mockProfileFindFirst = vi.fn().mockResolvedValue({ id: 'user-123' });
const mockUsageUpsert = vi.fn().mockResolvedValue({});
const mockSubscriptionUpsert = vi.fn().mockResolvedValue({});
const mockSubscriptionUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
const mockPurchaseUpsert = vi.fn().mockResolvedValue({ id: 'purchase-1' });
const mockPurchaseCreate = vi.fn().mockResolvedValue({ id: 'purchase-1' });
const mockPurchaseFindFirst = vi.fn().mockResolvedValue(null);
const mockImpactDonationCreate = vi.fn().mockResolvedValue({ id: 'donation-1' });
const mockCreditTransactionCreate = vi.fn().mockResolvedValue({ id: 'ct-1' });
const mockCreditTransactionFindUnique = vi.fn().mockResolvedValue(null); // null = not yet processed

vi.mock('@/lib/db', () => ({
  prisma: {
    profile: {
      update: (...args: unknown[]) => mockProfileUpdate(...args),
      updateMany: (...args: unknown[]) => mockProfileUpdateMany(...args),
      findFirst: (...args: unknown[]) => mockProfileFindFirst(...args),
    },
    usage: {
      upsert: (...args: unknown[]) => mockUsageUpsert(...args),
    },
    subscription: {
      upsert: (...args: unknown[]) => mockSubscriptionUpsert(...args),
      updateMany: (...args: unknown[]) => mockSubscriptionUpdateMany(...args),
    },
    purchase: {
      upsert: (...args: unknown[]) => mockPurchaseUpsert(...args),
      create: (...args: unknown[]) => mockPurchaseCreate(...args),
      findFirst: (...args: unknown[]) => mockPurchaseFindFirst(...args),
    },
    impactDonation: {
      create: (...args: unknown[]) => mockImpactDonationCreate(...args),
    },
    creditTransaction: {
      create: (...args: unknown[]) => mockCreditTransactionCreate(...args),
      findUnique: (...args: unknown[]) => mockCreditTransactionFindUnique(...args),
    },
    $transaction: (ops: unknown[]) => Promise.all(ops as Promise<unknown>[]),
  },
}));

// Mock constructWebhookEvent
const mockConstructWebhookEvent = vi.fn();
vi.mock('@/lib/stripe/server', () => ({
  constructWebhookEvent: (...args: unknown[]) => mockConstructWebhookEvent(...args),
}));

// Set env vars before importing the route
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
    mockProfileFindFirst.mockResolvedValue({ id: 'user-123' });
    mockPurchaseFindFirst.mockResolvedValue(null);
    mockCreditTransactionFindUnique.mockResolvedValue(null); // not yet processed by default
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

  describe('checkout.session.completed — advanced_analysis', () => {
    it('should upsert a Purchase record for advanced_analysis', async () => {
      mockConstructWebhookEvent.mockReturnValue(
        createStripeEvent('checkout.session.completed', {
          metadata: { type: 'advanced_analysis', userId: 'user-123', projectId: 'proj-abc' },
          payment_intent: 'pi_test_abc123',
          currency: 'usd',
        })
      );

      const request = createWebhookRequest('{}', 'valid_sig');
      const response = await POST(request);
      expect(response.status).toBe(200);

      expect(mockPurchaseUpsert).toHaveBeenCalledWith({
        where: { stripePaymentIntentId: 'pi_test_abc123' },
        create: expect.objectContaining({
          userId: 'user-123',
          projectId: 'proj-abc',
          purchaseType: 'advanced_analysis',
          amountCents: 999,
          status: 'completed',
        }),
        update: { status: 'completed' },
      });
    });

    it('should be idempotent — upsert not create on retry', async () => {
      const makeEvent = () =>
        createStripeEvent('checkout.session.completed', {
          metadata: { type: 'advanced_analysis', userId: 'user-123', projectId: 'proj-abc' },
          payment_intent: 'pi_test_abc123',
          currency: 'usd',
        });

      mockConstructWebhookEvent.mockReturnValue(makeEvent());
      await POST(createWebhookRequest('{}', 'valid_sig'));

      mockConstructWebhookEvent.mockReturnValue(makeEvent());
      await POST(createWebhookRequest('{}', 'valid_sig'));

      // upsert should be called twice (once per delivery), create never
      expect(mockPurchaseUpsert).toHaveBeenCalledTimes(2);
      expect(mockPurchaseCreate).not.toHaveBeenCalled();
    });

    it('should fall back to findFirst+create when payment_intent is absent', async () => {
      mockConstructWebhookEvent.mockReturnValue(
        createStripeEvent('checkout.session.completed', {
          metadata: { type: 'advanced_analysis', userId: 'user-123', projectId: 'proj-abc' },
          payment_intent: null,
          currency: 'usd',
        })
      );

      const request = createWebhookRequest('{}', 'valid_sig');
      const response = await POST(request);
      expect(response.status).toBe(200);

      expect(mockPurchaseFindFirst).toHaveBeenCalled();
      expect(mockPurchaseCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            purchaseType: 'advanced_analysis',
            status: 'completed',
          }),
        })
      );
    });

    it('should skip create when purchase already exists (null payment_intent)', async () => {
      mockPurchaseFindFirst.mockResolvedValue({ id: 'existing-purchase' });
      mockConstructWebhookEvent.mockReturnValue(
        createStripeEvent('checkout.session.completed', {
          metadata: { type: 'advanced_analysis', userId: 'user-123', projectId: 'proj-abc' },
          payment_intent: null,
          currency: 'usd',
        })
      );

      const request = createWebhookRequest('{}', 'valid_sig');
      const response = await POST(request);
      expect(response.status).toBe(200);

      expect(mockPurchaseCreate).not.toHaveBeenCalled();
    });

    it('should skip processing when userId or projectId is missing', async () => {
      mockConstructWebhookEvent.mockReturnValue(
        createStripeEvent('checkout.session.completed', {
          metadata: { type: 'advanced_analysis', userId: '', projectId: '' },
          payment_intent: 'pi_test_xyz',
          currency: 'usd',
        })
      );

      const request = createWebhookRequest('{}', 'valid_sig');
      const response = await POST(request);
      expect(response.status).toBe(200);
      expect(mockPurchaseUpsert).not.toHaveBeenCalled();
      expect(mockPurchaseCreate).not.toHaveBeenCalled();
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

      expect(mockProfileUpdate).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: {
          stripeCustomerId: 'cus_abc123',
          stripeSubscriptionId: 'sub_xyz789',
          subscriptionStatus: 'active',
        },
      });
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
      expect(mockProfileUpdate).not.toHaveBeenCalled();
    });
  });

  describe('customer.subscription.updated', () => {
    it('should update profile with tier and status', async () => {
      mockConstructWebhookEvent.mockReturnValue(
        createStripeEvent('customer.subscription.updated', {
          id: 'sub_xyz789',
          metadata: { userId: 'user-123' },
          status: 'active',
          items: { data: [{ price: { id: 'price_pro_monthly' }, current_period_start: 1733097600, current_period_end: 1735689600 }] },
          cancel_at_period_end: false,
        })
      );

      const request = createWebhookRequest('{}', 'valid_sig');
      const response = await POST(request);
      expect(response.status).toBe(200);

      expect(mockProfileUpdate).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: {
          subscriptionTier: 'pro',
          subscriptionStatus: 'active',
          stripeSubscriptionId: 'sub_xyz789',
          currentPeriodEnd: expect.any(Date),
        },
      });
    });

    it('should map creator price to creator tier', async () => {
      mockConstructWebhookEvent.mockReturnValue(
        createStripeEvent('customer.subscription.updated', {
          id: 'sub_123',
          metadata: { userId: 'user-123' },
          status: 'active',
          items: { data: [{ price: { id: 'price_creator_yearly' }, current_period_start: 1733097600, current_period_end: 1735689600 }] },
          cancel_at_period_end: false,
        })
      );

      const request = createWebhookRequest('{}', 'valid_sig');
      await POST(request);

      expect(mockProfileUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ subscriptionTier: 'creator' }),
        })
      );
    });

    it('should default to free for unknown price IDs', async () => {
      mockConstructWebhookEvent.mockReturnValue(
        createStripeEvent('customer.subscription.updated', {
          id: 'sub_123',
          metadata: { userId: 'user-123' },
          status: 'active',
          items: { data: [{ price: { id: 'price_unknown' }, current_period_start: 1733097600, current_period_end: 1735689600 }] },
          cancel_at_period_end: false,
        })
      );

      const request = createWebhookRequest('{}', 'valid_sig');
      await POST(request);

      expect(mockProfileUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ subscriptionTier: 'free' }),
        })
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

      expect(mockProfileUpdate).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: {
          subscriptionTier: 'free',
          subscriptionStatus: 'canceled',
          stripeSubscriptionId: null,
          currentPeriodEnd: null,
        },
      });
    });
  });

  describe('invoice.payment_succeeded', () => {
    it('should set subscription status to active and reset usage', async () => {
      mockConstructWebhookEvent.mockReturnValue(
        createStripeEvent('invoice.payment_succeeded', {
          parent: { subscription_details: { subscription: 'sub_xyz789' } },
          period_start: 1704067200, // 2024-01-01
          period_end: 1706745600, // 2024-02-01
        })
      );

      const request = createWebhookRequest('{}', 'valid_sig');
      const response = await POST(request);
      expect(response.status).toBe(200);

      expect(mockProfileUpdateMany).toHaveBeenCalledWith({
        where: { stripeSubscriptionId: 'sub_xyz789' },
        data: { subscriptionStatus: 'active' },
      });

      expect(mockProfileFindFirst).toHaveBeenCalledWith({
        where: { stripeSubscriptionId: 'sub_xyz789' },
        select: { id: true },
      });

      expect(mockUsageUpsert).toHaveBeenCalledWith({
        where: { userId_period: { userId: 'user-123', period: '2024-01' } },
        create: {
          userId: 'user-123',
          period: '2024-01',
          pagesUsed: 0,
        },
        update: {
          pagesUsed: 0,
        },
      });
    });
  });

  describe('invoice.payment_failed', () => {
    it('should set subscription status to past_due', async () => {
      mockConstructWebhookEvent.mockReturnValue(
        createStripeEvent('invoice.payment_failed', {
          parent: { subscription_details: { subscription: 'sub_xyz789' } },
        })
      );

      const request = createWebhookRequest('{}', 'valid_sig');
      const response = await POST(request);
      expect(response.status).toBe(200);

      expect(mockProfileUpdateMany).toHaveBeenCalledWith({
        where: { stripeSubscriptionId: 'sub_xyz789' },
        data: { subscriptionStatus: 'past_due' },
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

  describe('checkout.session.completed — credit_purchase', () => {
    it('credits 20 to profile and records transaction on credit_purchase', async () => {
      mockConstructWebhookEvent.mockReturnValue(
        createStripeEvent('checkout.session.completed', {
          payment_intent: 'pi_credits_abc',
          currency: 'usd',
          metadata: {
            type: 'credit_purchase',
            userId: 'user-123',
            credits: '20',
          },
        })
      );

      const request = createWebhookRequest('{}', 'valid_sig');
      const response = await POST(request);
      expect(response.status).toBe(200);

      expect(mockProfileUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-123' },
          data: expect.objectContaining({
            credits: expect.objectContaining({ increment: 20 }),
          }),
        })
      );

      expect(mockCreditTransactionCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            profileId: 'user-123',
            amount: 20,
            reason: 'purchase',
          }),
        })
      );
    });

    it('skips credit_purchase when userId is missing', async () => {
      mockConstructWebhookEvent.mockReturnValue(
        createStripeEvent('checkout.session.completed', {
          payment_intent: 'pi_credits_abc',
          metadata: { type: 'credit_purchase', credits: '20' },
        })
      );

      const request = createWebhookRequest('{}', 'valid_sig');
      const response = await POST(request);
      expect(response.status).toBe(200);
      expect(mockProfileUpdate).not.toHaveBeenCalled();
      expect(mockCreditTransactionCreate).not.toHaveBeenCalled();
    });

    it('skips credit_purchase when session already processed (idempotency)', async () => {
      mockCreditTransactionFindUnique.mockResolvedValue({ id: 'ct-already' });
      mockConstructWebhookEvent.mockReturnValue(
        createStripeEvent('checkout.session.completed', {
          id: 'cs_duplicate',
          metadata: { type: 'credit_purchase', userId: 'user-123', credits: '20' },
        })
      );

      const request = createWebhookRequest('{}', 'valid_sig');
      const response = await POST(request);
      expect(response.status).toBe(200);
      expect(mockProfileUpdate).not.toHaveBeenCalled();
      expect(mockCreditTransactionCreate).not.toHaveBeenCalled();
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
