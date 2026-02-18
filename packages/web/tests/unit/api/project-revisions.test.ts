/**
 * Tests for Revisions API Routes
 *
 * GET /api/projects/[id]/revisions - List revisions
 * GET /api/projects/[id]/revisions?timeline=true - Get revision timeline
 * POST /api/projects/[id]/revisions - Create a new revision
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// =============================================================================
// Mocks
// =============================================================================

const mockAuth = vi.fn();
vi.mock('@clerk/nextjs/server', () => ({
  auth: () => mockAuth(),
}));

const mockPrisma = {
  project: {
    findFirst: vi.fn(),
  },
};
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));

vi.mock('@/lib/csrf', () => ({
  validateCsrf: vi.fn(() => null),
}));

vi.mock('@/lib/api/rate-limit', () => ({
  rateLimit: vi.fn(() => Promise.resolve(null)),
  getClientIp: vi.fn(() => '127.0.0.1'),
}));

vi.mock('@/lib/logger', () => ({
  log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

const mockIsFeatureEnabled = vi.fn();
vi.mock('@/lib/features', () => ({
  isFeatureEnabled: (flag: string) => mockIsFeatureEnabled(flag),
}));

const mockGetRevisions = vi.fn();
const mockGetRevisionTimeline = vi.fn();
const mockCreateRevision = vi.fn();
vi.mock('@/lib/revisions', () => ({
  getRevisions: (...args: unknown[]) => mockGetRevisions(...args),
  getRevisionTimeline: (...args: unknown[]) => mockGetRevisionTimeline(...args),
  createRevision: (...args: unknown[]) => mockCreateRevision(...args),
}));

// Import after mocks
const { GET, POST } = await import('@/app/api/projects/[id]/revisions/route');

// =============================================================================
// Helpers
// =============================================================================

const PROJECT_ID = '550e8400-e29b-41d4-a716-446655440000';

const mockProject = {
  id: PROJECT_ID,
  userId: 'user_test123',
  name: 'Test Script',
  script_text: 'A'.repeat(200),
  createdAt: new Date(),
  updatedAt: new Date(),
};

function createRequest(
  url: string,
  options: {
    method?: string;
    body?: Record<string, unknown>;
  } = {},
): NextRequest {
  const init: RequestInit = {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      origin: 'http://localhost:22000',
    },
  };
  if (options.body) {
    init.body = JSON.stringify(options.body);
  }
  return new NextRequest(url, init);
}

function routeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

// =============================================================================
// Setup
// =============================================================================

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ userId: 'user_test123' });
  mockIsFeatureEnabled.mockReturnValue(true);
  mockPrisma.project.findFirst.mockResolvedValue(mockProject);
});

// =============================================================================
// GET /api/projects/[id]/revisions
// =============================================================================

describe('GET /api/projects/[id]/revisions', () => {
  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue({ userId: null });

    const req = createRequest(`http://localhost:22000/api/projects/${PROJECT_ID}/revisions`);
    const res = await GET(req, routeParams(PROJECT_ID));

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.code).toBe('AUTH_REQUIRED');
  });

  it('returns 403 when feature is disabled', async () => {
    mockIsFeatureEnabled.mockReturnValue(false);

    const req = createRequest(`http://localhost:22000/api/projects/${PROJECT_ID}/revisions`);
    const res = await GET(req, routeParams(PROJECT_ID));

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.code).toBe('FEATURE_DISABLED');
  });

  it('returns 404 when project not found', async () => {
    mockPrisma.project.findFirst.mockResolvedValue(null);

    const req = createRequest(`http://localhost:22000/api/projects/${PROJECT_ID}/revisions`);
    const res = await GET(req, routeParams(PROJECT_ID));

    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.code).toBe('PROJECT_NOT_FOUND');
  });

  it('returns list of revisions', async () => {
    const mockRevisions = [
      { id: 'rev-1', label: 'Draft 1', createdAt: new Date().toISOString() },
      { id: 'rev-2', label: 'Draft 2', createdAt: new Date().toISOString() },
    ];
    mockGetRevisions.mockResolvedValue(mockRevisions);

    const req = createRequest(`http://localhost:22000/api/projects/${PROJECT_ID}/revisions`);
    const res = await GET(req, routeParams(PROJECT_ID));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.revisions).toHaveLength(2);
    expect(mockGetRevisions).toHaveBeenCalledWith(PROJECT_ID);
  });

  it('returns timeline when ?timeline=true', async () => {
    const mockTimeline = [
      { revisionId: 'rev-1', label: 'Draft 1', score: 75 },
      { revisionId: 'rev-2', label: 'Draft 2', score: 82 },
    ];
    mockGetRevisionTimeline.mockResolvedValue(mockTimeline);

    const req = createRequest(
      `http://localhost:22000/api/projects/${PROJECT_ID}/revisions?timeline=true`,
    );
    const res = await GET(req, routeParams(PROJECT_ID));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.timeline).toHaveLength(2);
    expect(mockGetRevisionTimeline).toHaveBeenCalledWith(PROJECT_ID);
  });

  it('returns 500 when fetch fails', async () => {
    mockGetRevisions.mockRejectedValue(new Error('DB error'));

    const req = createRequest(`http://localhost:22000/api/projects/${PROJECT_ID}/revisions`);
    const res = await GET(req, routeParams(PROJECT_ID));

    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.code).toBe('FETCH_ERROR');
  });
});

// =============================================================================
// POST /api/projects/[id]/revisions
// =============================================================================

describe('POST /api/projects/[id]/revisions', () => {
  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue({ userId: null });

    const req = createRequest(`http://localhost:22000/api/projects/${PROJECT_ID}/revisions`, {
      method: 'POST',
      body: { scriptText: 'some script text' },
    });
    const res = await POST(req, routeParams(PROJECT_ID));

    expect(res.status).toBe(401);
  });

  it('returns 403 when feature is disabled', async () => {
    mockIsFeatureEnabled.mockReturnValue(false);

    const req = createRequest(`http://localhost:22000/api/projects/${PROJECT_ID}/revisions`, {
      method: 'POST',
      body: { scriptText: 'some script text' },
    });
    const res = await POST(req, routeParams(PROJECT_ID));

    expect(res.status).toBe(403);
  });

  it('returns 400 when scriptText is missing', async () => {
    const req = createRequest(`http://localhost:22000/api/projects/${PROJECT_ID}/revisions`, {
      method: 'POST',
      body: {},
    });
    const res = await POST(req, routeParams(PROJECT_ID));

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.code).toBe('VALIDATION_ERROR');
    expect(data.details).toHaveProperty('scriptText');
  });

  it('returns 400 when scriptText is empty string', async () => {
    const req = createRequest(`http://localhost:22000/api/projects/${PROJECT_ID}/revisions`, {
      method: 'POST',
      body: { scriptText: '' },
    });
    const res = await POST(req, routeParams(PROJECT_ID));

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.code).toBe('VALIDATION_ERROR');
  });

  it('creates revision successfully', async () => {
    const newRevision = {
      id: 'rev-new',
      projectId: PROJECT_ID,
      label: 'Draft 3',
      createdAt: new Date().toISOString(),
    };
    mockCreateRevision.mockResolvedValue(newRevision);

    const req = createRequest(`http://localhost:22000/api/projects/${PROJECT_ID}/revisions`, {
      method: 'POST',
      body: { scriptText: 'Updated script text here', label: 'Draft 3' },
    });
    const res = await POST(req, routeParams(PROJECT_ID));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.revision).toEqual(newRevision);
    expect(mockCreateRevision).toHaveBeenCalledWith(
      PROJECT_ID,
      'Updated script text here',
      expect.objectContaining({ label: 'Draft 3', userId: 'user_test123' }),
    );
  });

  it('creates revision with autoScore option', async () => {
    mockCreateRevision.mockResolvedValue({ id: 'rev-new' });

    const req = createRequest(`http://localhost:22000/api/projects/${PROJECT_ID}/revisions`, {
      method: 'POST',
      body: { scriptText: 'Script text', autoScore: true },
    });
    await POST(req, routeParams(PROJECT_ID));

    expect(mockCreateRevision).toHaveBeenCalledWith(
      PROJECT_ID,
      'Script text',
      expect.objectContaining({ autoScore: true }),
    );
  });

  it('returns 500 when creation fails', async () => {
    mockCreateRevision.mockRejectedValue(new Error('DB error'));

    const req = createRequest(`http://localhost:22000/api/projects/${PROJECT_ID}/revisions`, {
      method: 'POST',
      body: { scriptText: 'Some valid script text' },
    });
    const res = await POST(req, routeParams(PROJECT_ID));

    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.code).toBe('CREATION_ERROR');
  });
});
