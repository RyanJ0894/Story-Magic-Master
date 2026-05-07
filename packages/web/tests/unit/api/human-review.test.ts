/**
 * Tests for Human Review API Routes
 *
 * GET/POST /api/projects/[id]/human-review
 * GET      /api/admin/review-queue
 * PATCH    /api/admin/review-queue/[id]
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockAuth = vi.fn();
vi.mock('@clerk/nextjs/server', () => ({
  auth: () => mockAuth(),
}));

const mockPrisma = {
  project: { findFirst: vi.fn(), findUnique: vi.fn() },
  purchase: { findFirst: vi.fn() },
  profile: { findUnique: vi.fn() },
  humanReview: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
  audioOutput: { findFirst: vi.fn() },
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

const mockCheckoutCreate = vi.fn();
vi.mock('@/lib/stripe/server', () => ({
  getStripeServer: () => ({
    checkout: { sessions: { create: (...args: unknown[]) => mockCheckoutCreate(...args) } },
  }),
}));

const mockSendDecisionEmail = vi.fn().mockResolvedValue({ success: true, id: 'email-1' });
vi.mock('@/lib/email/resend', () => ({
  sendHumanReviewDecisionEmail: (...args: unknown[]) => mockSendDecisionEmail(...args),
}));

// ── Imports after mocks ───────────────────────────────────────────────────────

const { GET: projectGET, POST: projectPOST } = await import(
  '@/app/api/projects/[id]/human-review/route'
);
const { GET: queueGET } = await import('@/app/api/admin/review-queue/route');
const { PATCH: queuePATCH } = await import('@/app/api/admin/review-queue/[id]/route');

// ── Fixtures ──────────────────────────────────────────────────────────────────

const PROJECT_ID = '550e8400-e29b-41d4-a716-446655440000';
const USER_ID = 'user_clerk123';
const REVIEW_ID = '660e8400-e29b-41d4-a716-446655440001';
const JOB_ID = '770e8400-e29b-41d4-a716-446655440002';

const MOCK_PROJECT = { id: PROJECT_ID, userId: USER_ID };

function makeReq(method: string, url: string, body?: unknown): NextRequest {
  return new NextRequest(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Project Human Review Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockReturnValue({ userId: USER_ID });
    mockPrisma.project.findFirst.mockResolvedValue(MOCK_PROJECT);
    mockPrisma.purchase.findFirst.mockResolvedValue(null);
    mockPrisma.profile.findUnique.mockResolvedValue({ email: 'user@example.com' });
    mockCheckoutCreate.mockResolvedValue({ url: 'https://checkout.stripe.com/pay/cs_hr' });
  });

  it('GET returns purchased: false when no purchase', async () => {
    const res = await projectGET(
      makeReq('GET', `https://app.com/api/projects/${PROJECT_ID}/human-review`),
      { params: Promise.resolve({ id: PROJECT_ID }) },
    );
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.purchased).toBe(false);
    expect(json.price).toBe(9900);
  });

  it('GET returns purchased: true when completed purchase exists', async () => {
    mockPrisma.purchase.findFirst.mockResolvedValue({ id: 'p1' });
    const res = await projectGET(
      makeReq('GET', `https://app.com/api/projects/${PROJECT_ID}/human-review`),
      { params: Promise.resolve({ id: PROJECT_ID }) },
    );
    expect((await res.json()).purchased).toBe(true);
  });

  it('GET returns 401 when not authenticated', async () => {
    mockAuth.mockReturnValue({ userId: null });
    const res = await projectGET(
      makeReq('GET', `https://app.com/api/projects/${PROJECT_ID}/human-review`),
      { params: Promise.resolve({ id: PROJECT_ID }) },
    );
    expect(res.status).toBe(401);
  });

  it('POST creates checkout session with correct metadata', async () => {
    const res = await projectPOST(
      makeReq('POST', `https://app.com/api/projects/${PROJECT_ID}/human-review`),
      { params: Promise.resolve({ id: PROJECT_ID }) },
    );
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.url).toBe('https://checkout.stripe.com/pay/cs_hr');
    expect(mockCheckoutCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ type: 'human_review', projectId: PROJECT_ID }),
      }),
    );
  });

  it('POST returns alreadyOwned when already purchased', async () => {
    mockPrisma.purchase.findFirst.mockResolvedValue({ id: 'existing' });
    const res = await projectPOST(
      makeReq('POST', `https://app.com/api/projects/${PROJECT_ID}/human-review`),
      { params: Promise.resolve({ id: PROJECT_ID }) },
    );
    const json = await res.json();
    expect(json.alreadyOwned).toBe(true);
    expect(mockCheckoutCreate).not.toHaveBeenCalled();
  });
});

describe('Admin Review Queue Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockReturnValue({ userId: 'admin_user' });
    mockPrisma.profile.findUnique.mockResolvedValue({ userType: 'admin', fullName: 'Admin', email: 'admin@test.com' });
    mockPrisma.humanReview.findMany.mockResolvedValue([]);
  });

  it('GET returns empty reviews list', async () => {
    const res = await queueGET();
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.reviews).toHaveLength(0);
  });

  it('GET returns 403 for non-admin', async () => {
    mockPrisma.profile.findUnique.mockResolvedValue({ userType: 'user' });
    const res = await queueGET();
    expect(res.status).toBe(403);
  });

  it('GET returns 403 when not authenticated', async () => {
    mockAuth.mockReturnValue({ userId: null });
    const res = await queueGET();
    expect(res.status).toBe(403);
  });
});

describe('Admin Review Decision Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockReturnValue({ userId: 'admin_user' });
    mockPrisma.profile.findUnique.mockImplementation(({ where }: { where: { id: string } }) => {
      if (where.id === 'admin_user') return Promise.resolve({ userType: 'admin' });
      return Promise.resolve({ email: 'customer@test.com', fullName: 'Customer' });
    });
    mockPrisma.humanReview.findUnique.mockResolvedValue({
      id: REVIEW_ID,
      status: 'pending',
      userId: USER_ID,
      projectId: PROJECT_ID,
      jobId: JOB_ID,
    });
    mockPrisma.humanReview.update.mockResolvedValue({});
    mockPrisma.project.findUnique.mockResolvedValue({ name: 'Test Project' });
    mockPrisma.audioOutput.findFirst.mockResolvedValue({ filePath: 'audio/test.mp3' });
  });

  it('PATCH approves a review and sends email', async () => {
    const req = makeReq(
      'PATCH',
      `https://app.com/api/admin/review-queue/${REVIEW_ID}`,
      { decision: 'approved', reviewerNotes: 'Sounds great!' },
    );
    const res = await queuePATCH(req, { params: Promise.resolve({ id: REVIEW_ID }) });
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.decision).toBe('approved');
    expect(mockPrisma.humanReview.update).toHaveBeenCalled();
    expect(mockSendDecisionEmail).toHaveBeenCalledWith(
      expect.objectContaining({ decision: 'approved', reviewerNotes: 'Sounds great!' }),
    );
  });

  it('PATCH rejects a review', async () => {
    const req = makeReq(
      'PATCH',
      `https://app.com/api/admin/review-queue/${REVIEW_ID}`,
      { decision: 'rejected' },
    );
    const res = await queuePATCH(req, { params: Promise.resolve({ id: REVIEW_ID }) });
    const json = await res.json();
    expect(json.decision).toBe('rejected');
  });

  it('PATCH returns 400 for invalid decision', async () => {
    const req = makeReq(
      'PATCH',
      `https://app.com/api/admin/review-queue/${REVIEW_ID}`,
      { decision: 'maybe' },
    );
    const res = await queuePATCH(req, { params: Promise.resolve({ id: REVIEW_ID }) });
    expect(res.status).toBe(400);
  });

  it('PATCH returns 404 when review not found', async () => {
    mockPrisma.humanReview.findUnique.mockResolvedValue(null);
    const req = makeReq(
      'PATCH',
      `https://app.com/api/admin/review-queue/${REVIEW_ID}`,
      { decision: 'approved' },
    );
    const res = await queuePATCH(req, { params: Promise.resolve({ id: REVIEW_ID }) });
    expect(res.status).toBe(404);
  });

  it('PATCH returns 409 for already-resolved review', async () => {
    mockPrisma.humanReview.findUnique.mockResolvedValue({
      id: REVIEW_ID,
      status: 'approved',
      userId: USER_ID,
      projectId: PROJECT_ID,
      jobId: JOB_ID,
    });
    const req = makeReq(
      'PATCH',
      `https://app.com/api/admin/review-queue/${REVIEW_ID}`,
      { decision: 'rejected' },
    );
    const res = await queuePATCH(req, { params: Promise.resolve({ id: REVIEW_ID }) });
    expect(res.status).toBe(409);
  });

  it('PATCH returns 403 for non-admin', async () => {
    mockPrisma.profile.findUnique.mockImplementation(() =>
      Promise.resolve({ userType: 'user' }),
    );
    const req = makeReq(
      'PATCH',
      `https://app.com/api/admin/review-queue/${REVIEW_ID}`,
      { decision: 'approved' },
    );
    const res = await queuePATCH(req, { params: Promise.resolve({ id: REVIEW_ID }) });
    expect(res.status).toBe(403);
  });
});
