/**
 * Tests for Webhook Endpoints API
 *
 * GET  /api/webhook-endpoints  — list user's endpoints (no secrets)
 * POST /api/webhook-endpoints  — create endpoint, return secret once
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockAuth = vi.fn();
vi.mock('@clerk/nextjs/server', () => ({
  auth: () => mockAuth(),
}));

const mockPrisma = {
  webhookEndpoint: { findMany: vi.fn(), count: vi.fn(), create: vi.fn() },
};
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));

vi.mock('@/lib/logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// CSRF validation — null = no error = valid
const mockValidateCsrf = vi.fn(() => null);
vi.mock('@/lib/csrf', () => ({
  validateCsrf: (...args: unknown[]) => mockValidateCsrf(...args),
}));

// Rate limiting — always pass in tests
vi.mock('@/lib/api/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue(null),
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
}));

// ── Imports after mocks ───────────────────────────────────────────────────────

const { GET, POST } = await import('@/app/api/webhook-endpoints/route');

// ── Fixtures ──────────────────────────────────────────────────────────────────

const USER_ID = 'user_clerk123';
const ENDPOINT_ID = '550e8400-e29b-41d4-a716-446655440000';

const MOCK_ENDPOINT = {
  id: ENDPOINT_ID,
  url: 'https://api.example.com/webhook',
  events: ['job.completed', 'job.failed'],
  createdAt: new Date('2026-05-07T00:00:00Z'),
};

function makeReq(method: string, url: string, body?: unknown): NextRequest {
  return new NextRequest(url, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': 'valid' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /api/webhook-endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockReturnValue({ userId: USER_ID });
    mockPrisma.webhookEndpoint.findMany.mockResolvedValue([MOCK_ENDPOINT]);
  });

  it('returns user endpoints without secrets', async () => {
    const res = await GET(makeReq('GET', 'https://app.com/api/webhook-endpoints'), {});
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.endpoints).toHaveLength(1);
    expect(json.endpoints[0].id).toBe(ENDPOINT_ID);
    // Secret must NOT be in the response
    expect(json.endpoints[0].secret).toBeUndefined();
  });

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockReturnValue({ userId: null });
    const res = await GET(makeReq('GET', 'https://app.com/api/webhook-endpoints'), {});
    expect(res.status).toBe(401);
  });

  it('returns empty array when user has no endpoints', async () => {
    mockPrisma.webhookEndpoint.findMany.mockResolvedValue([]);
    const res = await GET(makeReq('GET', 'https://app.com/api/webhook-endpoints'), {});
    const json = await res.json();
    expect(json.endpoints).toHaveLength(0);
  });
});

describe('POST /api/webhook-endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockReturnValue({ userId: USER_ID });
    mockPrisma.webhookEndpoint.count.mockResolvedValue(0);
    mockPrisma.webhookEndpoint.create.mockResolvedValue(MOCK_ENDPOINT);
  });

  it('creates endpoint and returns secret once', async () => {
    const res = await POST(
      makeReq('POST', 'https://app.com/api/webhook-endpoints', {
        url: 'https://api.example.com/webhook',
        events: ['job.completed'],
      }),
      {}
    );
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.endpoint.id).toBe(ENDPOINT_ID);
    // Secret is returned once on creation
    expect(typeof json.endpoint.secret).toBe('string');
    expect(json.endpoint.secret.length).toBeGreaterThan(0);
  });

  it('rejects non-HTTPS URLs', async () => {
    const res = await POST(
      makeReq('POST', 'https://app.com/api/webhook-endpoints', {
        url: 'http://insecure.example.com/webhook',
        events: ['job.completed'],
      }),
      {}
    );
    expect(res.status).toBe(400);
  });

  it('returns 422 when user has 5 endpoints already', async () => {
    mockPrisma.webhookEndpoint.count.mockResolvedValue(5);

    const res = await POST(
      makeReq('POST', 'https://app.com/api/webhook-endpoints', {
        url: 'https://api.example.com/webhook',
        events: ['job.completed'],
      }),
      {}
    );
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error).toMatch(/maximum/i);
  });

  it('returns 400 for missing URL', async () => {
    const res = await POST(
      makeReq('POST', 'https://app.com/api/webhook-endpoints', {
        events: ['job.completed'],
      }),
      {}
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid event type', async () => {
    const res = await POST(
      makeReq('POST', 'https://app.com/api/webhook-endpoints', {
        url: 'https://api.example.com/webhook',
        events: ['unknown.event'],
      }),
      {}
    );
    expect(res.status).toBe(400);
  });

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockReturnValue({ userId: null });
    const res = await POST(
      makeReq('POST', 'https://app.com/api/webhook-endpoints', {
        url: 'https://api.example.com/webhook',
        events: ['job.completed'],
      }),
      {}
    );
    expect(res.status).toBe(401);
  });
});
