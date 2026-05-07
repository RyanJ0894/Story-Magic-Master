/**
 * Tests for Clerk Webhook Handler
 * TD-033: Test webhook signature verification and all event types
 *
 * Covers:
 * - POST /api/webhooks/clerk
 * - Signature verification via svix
 * - user.created event (creates profile)
 * - user.updated event (updates profile)
 * - user.deleted event (cleanup)
 * - Unknown event types (graceful handling)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks (must be declared before imports that use them)
// ---------------------------------------------------------------------------

// Mock Prisma
const mockProfileCreate = vi.fn().mockResolvedValue({ id: 'user_new123' });
const mockProfileUpdate = vi.fn().mockResolvedValue({});
const mockProfileDelete = vi.fn().mockResolvedValue({});

const mockCreditTransactionCreate = vi.fn().mockResolvedValue({});
vi.mock('@/lib/db', () => ({
  prisma: {
    profile: {
      create: (...args: unknown[]) => mockProfileCreate(...args),
      update: (...args: unknown[]) => mockProfileUpdate(...args),
      delete: (...args: unknown[]) => mockProfileDelete(...args),
    },
    creditTransaction: {
      create: (...args: unknown[]) => mockCreditTransactionCreate(...args),
    },
  },
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

// Mock svix Webhook
const mockVerify = vi.fn();
vi.mock('svix', () => {
  const MockWebhook = function() {
    return {
      verify: (...args: unknown[]) => mockVerify(...args),
    };
  };
  return { Webhook: MockWebhook };
});

// Mock next/headers
const mockHeadersGet = vi.fn();
vi.mock('next/headers', () => ({
  headers: vi.fn(() =>
    Promise.resolve({
      get: (name: string) => mockHeadersGet(name),
    }),
  ),
}));

// Set env before importing route
process.env.CLERK_WEBHOOK_SECRET = 'whsec_test_secret';

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

const { POST } = await import('@/app/api/webhooks/clerk/route');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createWebhookRequest(
  body: Record<string, unknown>,
  options?: { includeSvixHeaders?: boolean },
): Request {
  const { includeSvixHeaders = true } = options || {};

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (includeSvixHeaders) {
    headers['svix-id'] = 'msg_test123';
    headers['svix-timestamp'] = String(Math.floor(Date.now() / 1000));
    headers['svix-signature'] = 'v1,test_signature_base64';
  }

  return new Request('https://example.com/api/webhooks/clerk', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

function createClerkEvent(
  type: string,
  data: Record<string, unknown>,
): Record<string, unknown> {
  return { type, data };
}

function setupSvixHeaders(): void {
  mockHeadersGet.mockImplementation((name: string) => {
    switch (name) {
      case 'svix-id':
        return 'msg_test123';
      case 'svix-timestamp':
        return String(Math.floor(Date.now() / 1000));
      case 'svix-signature':
        return 'v1,test_signature_base64';
      default:
        return null;
    }
  });
}

function setupMissingSvixHeaders(): void {
  mockHeadersGet.mockReturnValue(null);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Clerk Webhook Handler (POST /api/webhooks/clerk)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CLERK_WEBHOOK_SECRET = 'whsec_test_secret';
    setupSvixHeaders();
  });

  describe('Signature verification', () => {
    it('rejects requests without svix headers', async () => {
      setupMissingSvixHeaders();

      const request = createWebhookRequest(
        { type: 'user.created', data: {} },
        { includeSvixHeaders: false },
      );
      const response = await POST(request);

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toBe('Missing svix headers');
    });

    it('rejects requests with invalid webhook signature', async () => {
      setupSvixHeaders();
      mockVerify.mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      const request = createWebhookRequest({ type: 'user.created', data: {} });
      const response = await POST(request);

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toBe('Invalid signature');
    });

    it('returns 500 when CLERK_WEBHOOK_SECRET is not configured', async () => {
      delete process.env.CLERK_WEBHOOK_SECRET;

      const request = createWebhookRequest({ type: 'user.created', data: {} });
      const response = await POST(request);

      expect(response.status).toBe(500);
      const json = await response.json();
      expect(json.error).toBe('Webhook secret not configured');
    });

    it('passes payload and headers to svix verify', async () => {
      const eventData = createClerkEvent('user.created', {
        id: 'user_abc',
        email_addresses: [{ email_address: 'test@example.com' }],
      });
      mockVerify.mockReturnValue(eventData);

      const request = createWebhookRequest(eventData);
      await POST(request);

      expect(mockVerify).toHaveBeenCalledWith(
        expect.any(String),
        {
          'svix-id': 'msg_test123',
          'svix-timestamp': expect.any(String),
          'svix-signature': 'v1,test_signature_base64',
        },
      );
    });
  });

  describe('user.created event', () => {
    it('creates a profile for a new user', async () => {
      const eventData = createClerkEvent('user.created', {
        id: 'user_new123',
        email_addresses: [{ email_address: 'newuser@example.com' }],
        first_name: 'Jane',
        last_name: 'Doe',
        image_url: 'https://img.clerk.com/avatar.jpg',
      });
      mockVerify.mockReturnValue(eventData);

      const request = createWebhookRequest(eventData);
      const response = await POST(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.received).toBe(true);

      expect(mockProfileCreate).toHaveBeenCalledWith({
        data: {
          id: 'user_new123',
          email: 'newuser@example.com',
          fullName: 'Jane Doe',
          avatarUrl: 'https://img.clerk.com/avatar.jpg',
          credits: 3,
        },
      });
    });

    it('handles user without email addresses', async () => {
      const eventData = createClerkEvent('user.created', {
        id: 'user_noemail',
        email_addresses: [],
        first_name: 'No',
        last_name: 'Email',
        image_url: null,
      });
      mockVerify.mockReturnValue(eventData);

      const request = createWebhookRequest(eventData);
      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(mockProfileCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id: 'user_noemail',
          email: null,
          avatarUrl: null,
        }),
      });
    });

    it('uses email as fullName when first_name and last_name are null', async () => {
      const eventData = createClerkEvent('user.created', {
        id: 'user_noname',
        email_addresses: [{ email_address: 'nameless@example.com' }],
        first_name: null,
        last_name: null,
        image_url: null,
      });
      mockVerify.mockReturnValue(eventData);

      const request = createWebhookRequest(eventData);
      await POST(request);

      expect(mockProfileCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          fullName: 'nameless@example.com',
        }),
      });
    });

    it('handles first name only', async () => {
      const eventData = createClerkEvent('user.created', {
        id: 'user_first',
        email_addresses: [{ email_address: 'test@example.com' }],
        first_name: 'Jane',
        last_name: null,
        image_url: null,
      });
      mockVerify.mockReturnValue(eventData);

      const request = createWebhookRequest(eventData);
      await POST(request);

      expect(mockProfileCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          fullName: 'Jane',
        }),
      });
    });
  });

  describe('user.updated event', () => {
    it('updates profile with new user data', async () => {
      const eventData = createClerkEvent('user.updated', {
        id: 'user_existing',
        email_addresses: [{ email_address: 'updated@example.com' }],
        first_name: 'Updated',
        last_name: 'Name',
        image_url: 'https://img.clerk.com/new-avatar.jpg',
      });
      mockVerify.mockReturnValue(eventData);

      const request = createWebhookRequest(eventData);
      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(mockProfileUpdate).toHaveBeenCalledWith({
        where: { id: 'user_existing' },
        data: {
          email: 'updated@example.com',
          fullName: 'Updated Name',
          avatarUrl: 'https://img.clerk.com/new-avatar.jpg',
        },
      });
    });

    it('updates profile with partial data (only email changes)', async () => {
      const eventData = createClerkEvent('user.updated', {
        id: 'user_existing',
        email_addresses: [{ email_address: 'newemail@example.com' }],
        first_name: 'Same',
        last_name: 'Name',
        image_url: 'https://img.clerk.com/same.jpg',
      });
      mockVerify.mockReturnValue(eventData);

      const request = createWebhookRequest(eventData);
      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(mockProfileUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user_existing' },
        }),
      );
    });
  });

  describe('user.deleted event', () => {
    it('deletes user profile', async () => {
      const eventData = createClerkEvent('user.deleted', {
        id: 'user_deleted',
      });
      mockVerify.mockReturnValue(eventData);

      const request = createWebhookRequest(eventData);
      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(mockProfileDelete).toHaveBeenCalledWith({
        where: { id: 'user_deleted' },
      });
    });

    it('handles already-deleted profile gracefully', async () => {
      const eventData = createClerkEvent('user.deleted', {
        id: 'user_gone',
      });
      mockVerify.mockReturnValue(eventData);
      mockProfileDelete.mockRejectedValue(new Error('Record not found'));

      const request = createWebhookRequest(eventData);
      const response = await POST(request);

      // Should not throw because delete error is caught
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.received).toBe(true);
    });
  });

  describe('Unknown event types', () => {
    it('returns 200 and acknowledges unknown event types', async () => {
      const eventData = createClerkEvent('organization.created', {
        id: 'org_123',
      });
      mockVerify.mockReturnValue(eventData);

      const request = createWebhookRequest(eventData);
      const response = await POST(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.received).toBe(true);

      // Should not call any profile mutations
      expect(mockProfileCreate).not.toHaveBeenCalled();
      expect(mockProfileUpdate).not.toHaveBeenCalled();
      expect(mockProfileDelete).not.toHaveBeenCalled();
    });

    it('returns 200 for session event types', async () => {
      const eventData = createClerkEvent('session.created', {
        id: 'sess_123',
      });
      mockVerify.mockReturnValue(eventData);

      const request = createWebhookRequest(eventData);
      const response = await POST(request);

      expect(response.status).toBe(200);
    });
  });
});
