/**
 * Tests for StoryScore API Routes
 *
 * GET /api/projects/[id]/score - Get latest score
 * GET /api/projects/[id]/score?history=true - Get score history
 * POST /api/projects/[id]/score - Generate a new score
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

const mockGenerateScore = vi.fn();
const mockGetLatestScore = vi.fn();
const mockGetScoreHistory = vi.fn();
vi.mock('@/lib/scoring', () => ({
  generateScore: (...args: unknown[]) => mockGenerateScore(...args),
  getLatestScore: (...args: unknown[]) => mockGetLatestScore(...args),
  getScoreHistory: (...args: unknown[]) => mockGetScoreHistory(...args),
}));

// Import after mocks
const { GET, POST } = await import('@/app/api/projects/[id]/score/route');

// =============================================================================
// Helpers
// =============================================================================

const PROJECT_ID = '550e8400-e29b-41d4-a716-446655440000';

const mockProject = {
  id: PROJECT_ID,
  userId: 'user_test123',
  name: 'Test Script',
  script_text: 'A'.repeat(200), // >100 chars
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
  process.env.OPENAI_API_KEY = 'sk-test-key';
});

// =============================================================================
// GET /api/projects/[id]/score
// =============================================================================

describe('GET /api/projects/[id]/score', () => {
  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue({ userId: null });

    const req = createRequest(`http://localhost:22000/api/projects/${PROJECT_ID}/score`);
    const res = await GET(req, routeParams(PROJECT_ID));

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.code).toBe('AUTH_REQUIRED');
  });

  it('returns 403 when feature is disabled', async () => {
    mockIsFeatureEnabled.mockReturnValue(false);

    const req = createRequest(`http://localhost:22000/api/projects/${PROJECT_ID}/score`);
    const res = await GET(req, routeParams(PROJECT_ID));

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.code).toBe('FEATURE_DISABLED');
  });

  it('returns 404 when project not found', async () => {
    mockPrisma.project.findFirst.mockResolvedValue(null);

    const req = createRequest(`http://localhost:22000/api/projects/${PROJECT_ID}/score`);
    const res = await GET(req, routeParams(PROJECT_ID));

    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.code).toBe('PROJECT_NOT_FOUND');
  });

  it('returns latest score when it exists', async () => {
    const mockScore = {
      id: 'score-1',
      projectId: PROJECT_ID,
      overall: 78,
      categories: { dialogue: 85, structure: 72 },
    };
    mockGetLatestScore.mockResolvedValue(mockScore);

    const req = createRequest(`http://localhost:22000/api/projects/${PROJECT_ID}/score`);
    const res = await GET(req, routeParams(PROJECT_ID));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.score).toEqual(mockScore);
  });

  it('returns null score with message when no score exists', async () => {
    mockGetLatestScore.mockResolvedValue(null);

    const req = createRequest(`http://localhost:22000/api/projects/${PROJECT_ID}/score`);
    const res = await GET(req, routeParams(PROJECT_ID));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.score).toBeNull();
    expect(data.message).toBe('No score exists for this project');
  });

  it('returns score history when ?history=true', async () => {
    const mockScores = [
      { id: 'score-1', overall: 78 },
      { id: 'score-2', overall: 82 },
    ];
    mockGetScoreHistory.mockResolvedValue(mockScores);

    const req = createRequest(
      `http://localhost:22000/api/projects/${PROJECT_ID}/score?history=true`,
    );
    const res = await GET(req, routeParams(PROJECT_ID));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.scores).toHaveLength(2);
    expect(mockGetScoreHistory).toHaveBeenCalledWith(PROJECT_ID);
  });

  it('returns 500 when score fetch fails', async () => {
    mockGetLatestScore.mockRejectedValue(new Error('DB error'));

    const req = createRequest(`http://localhost:22000/api/projects/${PROJECT_ID}/score`);
    const res = await GET(req, routeParams(PROJECT_ID));

    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.code).toBe('FETCH_ERROR');
  });
});

// =============================================================================
// POST /api/projects/[id]/score
// =============================================================================

describe('POST /api/projects/[id]/score', () => {
  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue({ userId: null });

    const req = createRequest(`http://localhost:22000/api/projects/${PROJECT_ID}/score`, {
      method: 'POST',
      body: {},
    });
    const res = await POST(req, routeParams(PROJECT_ID));

    expect(res.status).toBe(401);
  });

  it('returns 403 when feature is disabled', async () => {
    mockIsFeatureEnabled.mockReturnValue(false);

    const req = createRequest(`http://localhost:22000/api/projects/${PROJECT_ID}/score`, {
      method: 'POST',
      body: {},
    });
    const res = await POST(req, routeParams(PROJECT_ID));

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.code).toBe('FEATURE_DISABLED');
  });

  it('returns 400 when script text is too short', async () => {
    mockPrisma.project.findFirst.mockResolvedValue({
      ...mockProject,
      script_text: 'Short',
    });

    const req = createRequest(`http://localhost:22000/api/projects/${PROJECT_ID}/score`, {
      method: 'POST',
      body: {},
    });
    const res = await POST(req, routeParams(PROJECT_ID));

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.code).toBe('SCRIPT_TOO_SHORT');
  });

  it('returns 400 for invalid model parameter', async () => {
    const req = createRequest(`http://localhost:22000/api/projects/${PROJECT_ID}/score`, {
      method: 'POST',
      body: { model: 'invalid-model' },
    });
    const res = await POST(req, routeParams(PROJECT_ID));

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.code).toBe('VALIDATION_ERROR');
  });

  it('returns 500 when OPENAI_API_KEY is not configured', async () => {
    delete process.env.OPENAI_API_KEY;

    const req = createRequest(`http://localhost:22000/api/projects/${PROJECT_ID}/score`, {
      method: 'POST',
      body: {},
    });
    const res = await POST(req, routeParams(PROJECT_ID));

    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.code).toBe('CONFIG_ERROR');
  });

  it('generates score successfully', async () => {
    const generatedScore = {
      id: 'score-new',
      overall: 85,
      categories: { dialogue: 90, structure: 80 },
    };
    mockGenerateScore.mockResolvedValue(generatedScore);

    const req = createRequest(`http://localhost:22000/api/projects/${PROJECT_ID}/score`, {
      method: 'POST',
      body: { title: 'My Script', genre: 'Drama' },
    });
    const res = await POST(req, routeParams(PROJECT_ID));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.score).toEqual(generatedScore);
    expect(mockGenerateScore).toHaveBeenCalledWith(
      PROJECT_ID,
      mockProject.script_text,
      expect.objectContaining({ title: 'My Script', genre: 'Drama' }),
    );
  });

  it('returns 500 when score generation fails', async () => {
    mockGenerateScore.mockRejectedValue(new Error('AI error'));

    const req = createRequest(`http://localhost:22000/api/projects/${PROJECT_ID}/score`, {
      method: 'POST',
      body: {},
    });
    const res = await POST(req, routeParams(PROJECT_ID));

    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toBe('AI error');
  });
});
