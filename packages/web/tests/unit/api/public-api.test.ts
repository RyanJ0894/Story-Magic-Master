import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { generateApiKey } from '@/lib/api-keys';

// =============================================================================
// Mocks
// =============================================================================

const { raw: VALID_KEY, hash: VALID_KEY_HASH } = generateApiKey();
const USER_ID = 'user_test_pub_001';
const KEY_ID = 'key-uuid-001';

const mockPrisma = {
  apiKey: {
    findUnique: vi.fn(),
    update: vi.fn().mockResolvedValue({}),
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    deleteMany: vi.fn(),
  },
  webhookEndpoint: {
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    deleteMany: vi.fn(),
  },
  job: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  project: {
    findFirst: vi.fn(),
  },
};
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));

const mockAuth = vi.fn();
vi.mock('@clerk/nextjs/server', () => ({ auth: () => mockAuth() }));

const mockValidateCsrf = vi.fn(() => null);
vi.mock('@/lib/csrf', () => ({ validateCsrf: (...args: unknown[]) => mockValidateCsrf(...args) }));

vi.mock('@/lib/api/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue(null),
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
}));

vi.mock('@/lib/logger', () => ({ log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

const { GET: GetJobs } = await import('@/app/api/v1/jobs/[id]/route');
const { POST: PostGenerate } = await import('@/app/api/v1/generate/route');
const { GET: GetKeys, POST: PostKeys } = await import('@/app/api/api-keys/route');
const { GET: GetEndpoints, POST: PostEndpoints } = await import('@/app/api/webhook-endpoints/route');

// =============================================================================
// Helpers
// =============================================================================

function apiKeyRequest(method: string, url: string, body?: unknown): NextRequest {
  return new NextRequest(url, {
    method,
    headers: { Authorization: `Bearer ${VALID_KEY}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function authedApiKey() {
  mockPrisma.apiKey.findUnique.mockResolvedValue({ id: KEY_ID, userId: USER_ID });
}

function clerkAuthed() {
  mockAuth.mockReturnValue({ userId: USER_ID });
}

// =============================================================================
// Public API — API key auth
// =============================================================================

describe('API key authentication', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects requests without a Bearer token', async () => {
    const req = new NextRequest('http://localhost/api/v1/generate', { method: 'POST' });
    const res = await PostGenerate(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(401);
  });

  it('rejects invalid API key hash', async () => {
    mockPrisma.apiKey.findUnique.mockResolvedValue(null);
    const req = apiKeyRequest('POST', 'http://localhost/api/v1/generate', { projectId: 'uuid-1234-5678-0000-000000000001' });
    const res = await PostGenerate(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/generate', () => {
  beforeEach(() => { vi.clearAllMocks(); authedApiKey(); });

  it('returns 400 for missing projectId', async () => {
    const req = apiKeyRequest('POST', 'http://localhost/api/v1/generate', {});
    const res = await PostGenerate(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(400);
  });

  it('returns 404 when project not found or not owned', async () => {
    mockPrisma.project.findFirst.mockResolvedValue(null);
    const req = apiKeyRequest('POST', 'http://localhost/api/v1/generate', {
      projectId: '00000000-0000-0000-0000-000000000001',
    });
    const res = await PostGenerate(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(404);
  });

  it('returns 422 when project has no script', async () => {
    mockPrisma.project.findFirst.mockResolvedValue({ id: 'proj-1', scriptText: '', pageCount: 0 });
    const req = apiKeyRequest('POST', 'http://localhost/api/v1/generate', {
      projectId: '00000000-0000-0000-0000-000000000001',
    });
    const res = await PostGenerate(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(422);
  });

  it('returns 202 and jobId on success', async () => {
    mockPrisma.project.findFirst.mockResolvedValue({ id: 'proj-1', scriptText: 'INT. HOUSE - DAY', pageCount: 2 });
    mockPrisma.job.create.mockResolvedValue({ id: 'job-uuid-001', status: 'queued', createdAt: new Date() });

    const req = apiKeyRequest('POST', 'http://localhost/api/v1/generate', {
      projectId: '00000000-0000-0000-0000-000000000001',
    });
    const res = await PostGenerate(req, { params: Promise.resolve({}) });
    const body = await res.json();

    expect(res.status).toBe(202);
    expect(body.jobId).toBe('job-uuid-001');
    expect(body.status).toBe('queued');
  });
});

describe('GET /api/v1/jobs/[id]', () => {
  beforeEach(() => { vi.clearAllMocks(); authedApiKey(); });

  it('returns 404 for unknown job', async () => {
    mockPrisma.job.findFirst.mockResolvedValue(null);
    const req = apiKeyRequest('GET', 'http://localhost/api/v1/jobs/job-abc');
    const res = await GetJobs(req, { params: Promise.resolve({ id: 'job-abc' }) });
    expect(res.status).toBe(404);
  });

  it('returns job status for valid job', async () => {
    const job = { id: 'job-abc', status: 'completed', progress: {}, error: null, createdAt: new Date(), completedAt: new Date(), projectId: 'proj-1' };
    mockPrisma.job.findFirst.mockResolvedValue(job);

    const req = apiKeyRequest('GET', 'http://localhost/api/v1/jobs/job-abc');
    const res = await GetJobs(req, { params: Promise.resolve({ id: 'job-abc' }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.job.status).toBe('completed');
  });
});

// =============================================================================
// API key management (Clerk auth)
// =============================================================================

describe('GET /api/api-keys', () => {
  beforeEach(() => { vi.clearAllMocks(); clerkAuthed(); });

  it('returns the user keys list', async () => {
    mockPrisma.apiKey.findMany.mockResolvedValue([{ id: 'k1', name: 'Test', keyPrefix: 'sm_live_ab', lastUsedAt: null, createdAt: new Date() }]);
    const req = new NextRequest('http://localhost/api/api-keys');
    const res = await GetKeys(req, { params: Promise.resolve({}) });
    const body = await res.json();
    expect(body.keys).toHaveLength(1);
  });
});

describe('POST /api/api-keys', () => {
  beforeEach(() => { vi.clearAllMocks(); clerkAuthed(); mockValidateCsrf.mockReturnValue(null); });

  it('returns 422 at the 10-key limit', async () => {
    mockPrisma.apiKey.count.mockResolvedValue(10);
    const req = new NextRequest('http://localhost/api/api-keys', {
      method: 'POST',
      body: JSON.stringify({ name: 'New Key' }),
    });
    const res = await PostKeys(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(422);
  });

  it('creates key and returns raw value once', async () => {
    mockPrisma.apiKey.count.mockResolvedValue(0);
    mockPrisma.apiKey.create.mockResolvedValue({ id: 'new-k', name: 'My Key', keyPrefix: 'sm_live_ab', createdAt: new Date() });

    const req = new NextRequest('http://localhost/api/api-keys', {
      method: 'POST',
      body: JSON.stringify({ name: 'My Key' }),
    });
    const res = await PostKeys(req, { params: Promise.resolve({}) });
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.key.raw).toMatch(/^sm_live_/);
  });
});

// =============================================================================
// Webhook endpoint management (Clerk auth)
// =============================================================================

describe('POST /api/webhook-endpoints', () => {
  beforeEach(() => { vi.clearAllMocks(); clerkAuthed(); mockValidateCsrf.mockReturnValue(null); });

  it('returns 400 for non-https URL', async () => {
    mockPrisma.webhookEndpoint.count.mockResolvedValue(0);
    const req = new NextRequest('http://localhost/api/webhook-endpoints', {
      method: 'POST',
      body: JSON.stringify({ url: 'http://evil.com/hook', events: ['job.completed'] }),
    });
    const res = await PostEndpoints(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(400);
  });

  it('creates endpoint and returns secret once', async () => {
    mockPrisma.webhookEndpoint.count.mockResolvedValue(0);
    mockPrisma.webhookEndpoint.create.mockResolvedValue({
      id: 'ep-1', url: 'https://example.com/hook', events: ['job.completed'], createdAt: new Date(),
    });

    const req = new NextRequest('http://localhost/api/webhook-endpoints', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://example.com/hook', events: ['job.completed'] }),
    });
    const res = await PostEndpoints(req, { params: Promise.resolve({}) });
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(typeof body.endpoint.secret).toBe('string');
    expect(body.endpoint.secret).toHaveLength(64); // 32 bytes hex
  });
});
