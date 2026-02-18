/**
 * Tests for Reader Upload Routes
 * TD-032: Test reader upload create-payment + process routes
 *
 * Covers:
 * - POST /api/reader/upload/create-payment (Stripe checkout for uploads)
 * - POST /api/reader/upload/process (PDF upload processing)
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

// Mock logger
vi.mock('@/lib/logger', () => ({
  log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

// Mock Stripe
const mockCheckoutSessionsCreate = vi.fn();
vi.mock('stripe', () => {
  const MockStripe = function() {
    return {
      checkout: {
        sessions: {
          create: (...args: unknown[]) => mockCheckoutSessionsCreate(...args),
        },
      },
    };
  };
  return { default: MockStripe };
});

// Mock Prisma
const mockPrisma = {
  purchase: {
    create: vi.fn().mockResolvedValue({ id: 'test-purchase-id' }),
  },
  project: {
    create: vi.fn().mockResolvedValue({ id: 'test-project-id' }),
    update: vi.fn().mockResolvedValue({}),
  },
  readerLibrary: {
    create: vi.fn().mockResolvedValue({ id: 'test-reader-library-id' }),
  },
  job: {
    create: vi.fn().mockResolvedValue({ id: 'test-job-id' }),
    update: vi.fn().mockResolvedValue({}),
  },
};
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));

// Mock nanoid
vi.mock('nanoid', () => ({
  nanoid: () => 'mock-nanoid-123',
}));

// Mock fs
const mockMkdirSync = vi.fn();
const mockWriteFileSync = vi.fn();
vi.mock('fs', () => ({
  default: {
    mkdirSync: (...args: unknown[]) => mockMkdirSync(...args),
    writeFileSync: (...args: unknown[]) => mockWriteFileSync(...args),
    readFileSync: vi.fn(() => Buffer.from('mock pdf content for testing purposes that is long enough')),
    unlinkSync: vi.fn(),
    readdirSync: vi.fn(() => []),
    rmdirSync: vi.fn(),
  },
  mkdirSync: (...args: unknown[]) => mockMkdirSync(...args),
  writeFileSync: (...args: unknown[]) => mockWriteFileSync(...args),
}));

// Set required env vars before importing routes
process.env.STRIPE_SECRET_KEY = 'sk_test_fake_key';
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:22000';

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

const { POST: createPaymentPOST } = await import(
  '@/app/api/reader/upload/create-payment/route'
);
const { POST: processPOST } = await import(
  '@/app/api/reader/upload/process/route'
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE_URL = 'http://localhost:22000';

function createPaymentRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest(`${BASE_URL}/api/reader/upload/create-payment`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      origin: BASE_URL,
    },
    body: JSON.stringify(body),
  });
}

function createProcessRequest(
  file: File | null,
  name: string | null,
  needsOCR = false,
): NextRequest {
  const formData = new FormData();
  if (file) formData.append('file', file);
  if (name) formData.append('name', name);
  formData.append('needsOCR', String(needsOCR));

  return new NextRequest(`${BASE_URL}/api/reader/upload/process`, {
    method: 'POST',
    headers: {
      origin: BASE_URL,
    },
    body: formData,
  });
}

function createPDFFile(name = 'test-script.pdf'): File {
  return new File(['%PDF-1.4 mock content'], name, {
    type: 'application/pdf',
  });
}

// ---------------------------------------------------------------------------
// Tests: Create Payment Route
// ---------------------------------------------------------------------------

describe('Reader Upload Create Payment (POST /api/reader/upload/create-payment)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ userId: 'user-123' });
    mockValidateCsrf.mockReturnValue(null);
    mockCheckoutSessionsCreate.mockResolvedValue({
      id: 'cs_test_session_id',
      url: 'https://checkout.stripe.com/pay/cs_test_session_id',
    });
  });

  describe('Auth checks', () => {
    it('returns 401 when not authenticated', async () => {
      mockAuth.mockResolvedValue({ userId: null });

      const request = createPaymentRequest({ price: 5, needsOCR: false });
      const response = await createPaymentPOST(request);

      expect(response.status).toBe(401);
      const json = await response.json();
      expect(json.error).toBe('Unauthorized');
      expect(json.code).toBe('AUTH_REQUIRED');
    });
  });

  describe('Input validation', () => {
    it('returns 400 for invalid price value', async () => {
      const request = createPaymentRequest({ price: 10, needsOCR: false });
      const response = await createPaymentPOST(request);

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toBe('Invalid request parameters');
    });

    it('returns 400 for missing price', async () => {
      const request = createPaymentRequest({ needsOCR: false });
      const response = await createPaymentPOST(request);

      expect(response.status).toBe(400);
    });

    it('returns 400 for missing needsOCR', async () => {
      const request = createPaymentRequest({ price: 5 });
      const response = await createPaymentPOST(request);

      expect(response.status).toBe(400);
    });

    it('returns 400 when price does not match OCR selection (OCR price with needsOCR=false)', async () => {
      const request = createPaymentRequest({ price: 8, needsOCR: false });
      const response = await createPaymentPOST(request);

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toBe('Invalid price');
    });

    it('returns 400 when price does not match OCR selection (standard price with needsOCR=true)', async () => {
      const request = createPaymentRequest({ price: 5, needsOCR: true });
      const response = await createPaymentPOST(request);

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toBe('Invalid price');
    });

    it('returns 400 for non-numeric price', async () => {
      const request = createPaymentRequest({ price: 'five', needsOCR: false });
      const response = await createPaymentPOST(request);

      expect(response.status).toBe(400);
    });

    it('returns 400 for invalid JSON body', async () => {
      const request = new NextRequest(
        `${BASE_URL}/api/reader/upload/create-payment`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            origin: BASE_URL,
          },
          body: 'not json',
        },
      );
      const response = await createPaymentPOST(request);
      expect(response.status).toBe(400);
    });
  });

  describe('Success cases', () => {
    it('creates checkout session for standard upload ($5)', async () => {
      const request = createPaymentRequest({
        price: 5,
        needsOCR: false,
        scriptName: 'My Script',
      });
      const response = await createPaymentPOST(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.url).toBe(
        'https://checkout.stripe.com/pay/cs_test_session_id',
      );
    });

    it('creates checkout session for OCR upload ($8)', async () => {
      const request = createPaymentRequest({
        price: 8,
        needsOCR: true,
        scriptName: 'Scanned Script',
      });
      const response = await createPaymentPOST(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.url).toBeDefined();
    });

    it('calls Stripe with correct line item for standard upload', async () => {
      const request = createPaymentRequest({
        price: 5,
        needsOCR: false,
        scriptName: 'Test Script',
      });
      await createPaymentPOST(request);

      expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'payment',
          line_items: [
            expect.objectContaining({
              price_data: expect.objectContaining({
                unit_amount: 500,
                product_data: expect.objectContaining({
                  name: 'Script Processing: Test Script',
                  description: 'Standard processing',
                }),
              }),
              quantity: 1,
            }),
          ],
          metadata: expect.objectContaining({
            userId: 'user-123',
            type: 'reader_upload',
            needsOCR: 'false',
          }),
        }),
      );
    });

    it('calls Stripe with correct line item for OCR upload', async () => {
      const request = createPaymentRequest({
        price: 8,
        needsOCR: true,
        scriptName: 'OCR Script',
      });
      await createPaymentPOST(request);

      expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          line_items: [
            expect.objectContaining({
              price_data: expect.objectContaining({
                unit_amount: 800,
                product_data: expect.objectContaining({
                  description: 'OCR + standard processing',
                }),
              }),
            }),
          ],
          metadata: expect.objectContaining({
            needsOCR: 'true',
          }),
        }),
      );
    });

    it('records purchase intent in database', async () => {
      const request = createPaymentRequest({
        price: 5,
        needsOCR: false,
      });
      await createPaymentPOST(request);

      expect(mockPrisma.purchase.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-123',
          purchaseType: 'upload',
          amountCents: 500,
          stripePaymentIntentId: 'cs_test_session_id',
          status: 'pending',
        },
      });
    });

    it('records OCR purchase type when needsOCR is true', async () => {
      const request = createPaymentRequest({
        price: 8,
        needsOCR: true,
      });
      await createPaymentPOST(request);

      expect(mockPrisma.purchase.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            purchaseType: 'upload_ocr',
            amountCents: 800,
          }),
        }),
      );
    });

    it('uses default script name when not provided', async () => {
      const request = createPaymentRequest({
        price: 5,
        needsOCR: false,
      });
      await createPaymentPOST(request);

      expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          line_items: [
            expect.objectContaining({
              price_data: expect.objectContaining({
                product_data: expect.objectContaining({
                  name: 'Script Processing: Upload',
                }),
              }),
            }),
          ],
        }),
      );
    });
  });

  describe('Error handling', () => {
    it('returns 500 when Stripe throws an error', async () => {
      mockCheckoutSessionsCreate.mockRejectedValue(
        new Error('Stripe API error'),
      );

      const request = createPaymentRequest({ price: 5, needsOCR: false });
      const response = await createPaymentPOST(request);

      expect(response.status).toBe(500);
      const json = await response.json();
      expect(json.error).toBe('Failed to create payment');
    });
  });
});

// ---------------------------------------------------------------------------
// Tests: Process Upload Route
// ---------------------------------------------------------------------------

describe('Reader Upload Process (POST /api/reader/upload/process)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ userId: 'user-123' });
    mockValidateCsrf.mockReturnValue(null);
    mockPrisma.project.create.mockResolvedValue({ id: 'mock-nanoid-123' });
    mockPrisma.job.create.mockResolvedValue({ id: 'test-job-id' });
    mockPrisma.readerLibrary.create.mockResolvedValue({
      id: 'test-reader-library-id',
    });
  });

  describe('Auth checks', () => {
    it('returns 401 when not authenticated', async () => {
      mockAuth.mockResolvedValue({ userId: null });

      const request = createProcessRequest(createPDFFile(), 'Test Script');
      const response = await processPOST(request);

      expect(response.status).toBe(401);
      const json = await response.json();
      expect(json.error).toBe('Unauthorized');
      expect(json.code).toBe('AUTH_REQUIRED');
    });
  });

  describe('Input validation', () => {
    it('returns 400 when no file is provided', async () => {
      const request = createProcessRequest(null, 'Test Script');
      const response = await processPOST(request);

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toBe('File required');
    });

    it('returns 400 when no name is provided', async () => {
      const request = createProcessRequest(createPDFFile(), null);
      const response = await processPOST(request);

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toBe('Name required');
    });

    it('returns 400 for non-PDF files', async () => {
      const textFile = new File(['hello world'], 'test.txt', {
        type: 'text/plain',
      });
      const request = createProcessRequest(textFile, 'Test Script');
      const response = await processPOST(request);

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toBe('Only PDF files accepted');
    });
  });

  describe('Success cases', () => {
    it('creates project, library entry, and job on successful upload', async () => {
      const request = createProcessRequest(
        createPDFFile(),
        'My Script',
        false,
      );
      const response = await processPOST(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.projectId).toBeDefined();
      expect(json.jobId).toBe('test-job-id');
      expect(json.status).toBe('processing');
    });

    it('creates project record with correct data', async () => {
      const request = createProcessRequest(
        createPDFFile(),
        'My Script',
        false,
      );
      await processPOST(request);

      expect(mockPrisma.project.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-123',
          name: 'My Script',
          status: 'processing',
        }),
      });
    });

    it('adds entry to reader library', async () => {
      const request = createProcessRequest(
        createPDFFile(),
        'My Script',
        false,
      );
      await processPOST(request);

      expect(mockPrisma.readerLibrary.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          readerId: 'user-123',
          source: 'uploaded',
          status: 'active',
        }),
      });
    });

    it('creates job with pdf_extract type for standard upload', async () => {
      const request = createProcessRequest(
        createPDFFile(),
        'My Script',
        false,
      );
      await processPOST(request);

      expect(mockPrisma.job.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-123',
          jobType: 'pdf_extract',
          status: 'queued',
        }),
      });
    });

    it('creates job with ocr_extract type for OCR upload', async () => {
      const request = createProcessRequest(
        createPDFFile(),
        'My Script',
        true,
      );
      await processPOST(request);

      expect(mockPrisma.job.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          jobType: 'ocr_extract',
        }),
      });
    });

    it('saves uploaded file to disk', async () => {
      const request = createProcessRequest(
        createPDFFile(),
        'My Script',
        false,
      );
      await processPOST(request);

      expect(mockMkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('uploads'),
        { recursive: true },
      );
      expect(mockWriteFileSync).toHaveBeenCalled();
    });
  });

  describe('Error handling', () => {
    it('returns 500 when project creation fails', async () => {
      mockPrisma.project.create.mockRejectedValue(
        new Error('Database error'),
      );

      const request = createProcessRequest(
        createPDFFile(),
        'My Script',
        false,
      );
      const response = await processPOST(request);

      expect(response.status).toBe(500);
      const json = await response.json();
      expect(json.error).toBe('Failed to process upload');
    });

    it('continues if library entry creation fails', async () => {
      mockPrisma.readerLibrary.create.mockRejectedValue(
        new Error('Duplicate entry'),
      );

      const request = createProcessRequest(
        createPDFFile(),
        'My Script',
        false,
      );
      const response = await processPOST(request);

      // Should still succeed because library error is caught
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.projectId).toBeDefined();
    });
  });
});
