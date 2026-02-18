/**
 * Tests for Suggestions API Routes
 *
 * GET /api/projects/[id]/suggestions - List suggestions
 * POST /api/projects/[id]/suggestions - Generate new suggestions
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

const mockGenerateSuggestions = vi.fn();
const mockGetSuggestions = vi.fn();
const mockGetSuggestionStats = vi.fn();
vi.mock('@/lib/adviser', () => ({
  generateSuggestions: (...args: unknown[]) => mockGenerateSuggestions(...args),
  getSuggestions: (...args: unknown[]) => mockGetSuggestions(...args),
  getSuggestionStats: (...args: unknown[]) => mockGetSuggestionStats(...args),
  SUGGESTION_CATEGORIES: {
    dialogue: 'Dialogue',
    structure: 'Structure',
    pacing: 'Pacing',
    character: 'Character',
  },
}));

// Import after mocks
const { GET, POST } = await import('@/app/api/projects/[id]/suggestions/route');

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
  process.env.OPENAI_API_KEY = 'sk-test-key';
});

// =============================================================================
// GET /api/projects/[id]/suggestions
// =============================================================================

describe('GET /api/projects/[id]/suggestions', () => {
  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue({ userId: null });

    const req = createRequest(`http://localhost:22000/api/projects/${PROJECT_ID}/suggestions`);
    const res = await GET(req, routeParams(PROJECT_ID));

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.code).toBe('AUTH_REQUIRED');
  });

  it('returns 403 when feature is disabled', async () => {
    mockIsFeatureEnabled.mockReturnValue(false);

    const req = createRequest(`http://localhost:22000/api/projects/${PROJECT_ID}/suggestions`);
    const res = await GET(req, routeParams(PROJECT_ID));

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.code).toBe('FEATURE_DISABLED');
  });

  it('returns 404 when project not found', async () => {
    mockPrisma.project.findFirst.mockResolvedValue(null);

    const req = createRequest(`http://localhost:22000/api/projects/${PROJECT_ID}/suggestions`);
    const res = await GET(req, routeParams(PROJECT_ID));

    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.code).toBe('PROJECT_NOT_FOUND');
  });

  it('returns suggestions and stats', async () => {
    const mockSuggestions = [
      { id: 'sug-1', category: 'dialogue', text: 'Improve dialogue' },
      { id: 'sug-2', category: 'structure', text: 'Fix pacing' },
    ];
    const mockStats = { total: 2, pending: 2, accepted: 0 };

    mockGetSuggestions.mockResolvedValue(mockSuggestions);
    mockGetSuggestionStats.mockResolvedValue(mockStats);

    const req = createRequest(`http://localhost:22000/api/projects/${PROJECT_ID}/suggestions`);
    const res = await GET(req, routeParams(PROJECT_ID));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.suggestions).toHaveLength(2);
    expect(data.stats).toEqual(mockStats);
  });

  it('passes status filter from query params', async () => {
    mockGetSuggestions.mockResolvedValue([]);
    mockGetSuggestionStats.mockResolvedValue({ total: 0 });

    const req = createRequest(
      `http://localhost:22000/api/projects/${PROJECT_ID}/suggestions?status=pending`,
    );
    await GET(req, routeParams(PROJECT_ID));

    expect(mockGetSuggestions).toHaveBeenCalledWith(
      PROJECT_ID,
      expect.objectContaining({ status: 'pending' }),
    );
  });

  it('passes category filter from query params', async () => {
    mockGetSuggestions.mockResolvedValue([]);
    mockGetSuggestionStats.mockResolvedValue({ total: 0 });

    const req = createRequest(
      `http://localhost:22000/api/projects/${PROJECT_ID}/suggestions?category=dialogue`,
    );
    await GET(req, routeParams(PROJECT_ID));

    expect(mockGetSuggestions).toHaveBeenCalledWith(
      PROJECT_ID,
      expect.objectContaining({ category: 'dialogue' }),
    );
  });

  it('returns 400 for invalid status filter', async () => {
    const req = createRequest(
      `http://localhost:22000/api/projects/${PROJECT_ID}/suggestions?status=invalid`,
    );
    const res = await GET(req, routeParams(PROJECT_ID));

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.code).toBe('VALIDATION_ERROR');
  });

  it('returns 500 when fetch fails', async () => {
    mockGetSuggestions.mockRejectedValue(new Error('DB error'));

    const req = createRequest(`http://localhost:22000/api/projects/${PROJECT_ID}/suggestions`);
    const res = await GET(req, routeParams(PROJECT_ID));

    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.code).toBe('FETCH_ERROR');
  });
});

// =============================================================================
// POST /api/projects/[id]/suggestions
// =============================================================================

describe('POST /api/projects/[id]/suggestions', () => {
  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue({ userId: null });

    const req = createRequest(`http://localhost:22000/api/projects/${PROJECT_ID}/suggestions`, {
      method: 'POST',
      body: {},
    });
    const res = await POST(req, routeParams(PROJECT_ID));

    expect(res.status).toBe(401);
  });

  it('returns 403 when feature is disabled', async () => {
    mockIsFeatureEnabled.mockReturnValue(false);

    const req = createRequest(`http://localhost:22000/api/projects/${PROJECT_ID}/suggestions`, {
      method: 'POST',
      body: {},
    });
    const res = await POST(req, routeParams(PROJECT_ID));

    expect(res.status).toBe(403);
  });

  it('returns 400 when script text is too short', async () => {
    mockPrisma.project.findFirst.mockResolvedValue({
      ...mockProject,
      script_text: 'Short',
    });

    const req = createRequest(`http://localhost:22000/api/projects/${PROJECT_ID}/suggestions`, {
      method: 'POST',
      body: {},
    });
    const res = await POST(req, routeParams(PROJECT_ID));

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.code).toBe('SCRIPT_TOO_SHORT');
  });

  it('returns 400 for invalid request parameters', async () => {
    const req = createRequest(`http://localhost:22000/api/projects/${PROJECT_ID}/suggestions`, {
      method: 'POST',
      body: { maxSuggestions: 999 }, // exceeds max of 30
    });
    const res = await POST(req, routeParams(PROJECT_ID));

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.code).toBe('VALIDATION_ERROR');
  });

  it('returns 500 when OPENAI_API_KEY is not configured', async () => {
    delete process.env.OPENAI_API_KEY;

    const req = createRequest(`http://localhost:22000/api/projects/${PROJECT_ID}/suggestions`, {
      method: 'POST',
      body: {},
    });
    const res = await POST(req, routeParams(PROJECT_ID));

    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.code).toBe('CONFIG_ERROR');
  });

  it('generates suggestions successfully', async () => {
    const generatedSuggestions = [
      { id: 'sug-1', category: 'dialogue', text: 'Improve dialogue flow' },
    ];
    const stats = { total: 1, pending: 1, accepted: 0 };

    mockGenerateSuggestions.mockResolvedValue(generatedSuggestions);
    mockGetSuggestionStats.mockResolvedValue(stats);

    const req = createRequest(`http://localhost:22000/api/projects/${PROJECT_ID}/suggestions`, {
      method: 'POST',
      body: { maxSuggestions: 5 },
    });
    const res = await POST(req, routeParams(PROJECT_ID));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.suggestions).toEqual(generatedSuggestions);
    expect(data.stats).toEqual(stats);
  });

  it('returns 500 when generation fails', async () => {
    mockGenerateSuggestions.mockRejectedValue(new Error('AI error'));

    const req = createRequest(`http://localhost:22000/api/projects/${PROJECT_ID}/suggestions`, {
      method: 'POST',
      body: {},
    });
    const res = await POST(req, routeParams(PROJECT_ID));

    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.code).toBe('GENERATION_ERROR');
  });
});
