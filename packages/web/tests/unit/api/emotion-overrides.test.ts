/**
 * Tests for Emotion Overrides API
 * Issue #37: Performance Direction UI
 *
 * Covers:
 * - GET /api/projects/[id]/emotion-overrides — current override map
 * - PUT /api/projects/[id]/emotion-overrides — save override map
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockAuth = vi.fn();
vi.mock('@clerk/nextjs/server', () => ({
  auth: () => mockAuth(),
}));

const mockProjectFindFirst = vi.fn();
const mockProjectUpdate = vi.fn();

vi.mock('@/lib/db', () => ({
  prisma: {
    project: {
      findFirst: (...args: unknown[]) => mockProjectFindFirst(...args),
      update: (...args: unknown[]) => mockProjectUpdate(...args),
    },
  },
}));

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

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

const { GET, PUT } = await import(
  '@/app/api/projects/[id]/emotion-overrides/route'
);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PROJECT_ID = '550e8400-e29b-41d4-a716-446655440000';
const USER_ID = 'user_clerk123';

const MOCK_PROJECT_NO_OVERRIDES = {
  id: PROJECT_ID,
  userId: USER_ID,
  teamShares: [],
  emotionOverrides: null,
};

const MOCK_PROJECT_WITH_OVERRIDES = {
  ...MOCK_PROJECT_NO_OVERRIDES,
  emotionOverrides: { line_001: 'WHISPERED', line_002: 'NERVOUS' },
};

function makeRequest(
  method: 'GET' | 'PUT',
  body?: Record<string, unknown>,
): NextRequest {
  return new NextRequest(
    `https://example.com/api/projects/${PROJECT_ID}/emotion-overrides`,
    {
      method,
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': 'ok' },
      body: body ? JSON.stringify(body) : undefined,
    },
  );
}

const ROUTE_PARAMS = { params: Promise.resolve({ id: PROJECT_ID }) };

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/projects/[id]/emotion-overrides', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockReturnValue({ userId: USER_ID });
  });

  it('returns empty object when project has no overrides', async () => {
    mockProjectFindFirst.mockResolvedValue(MOCK_PROJECT_NO_OVERRIDES);

    const response = await GET(makeRequest('GET'), ROUTE_PARAMS);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.overrides).toEqual({});
  });

  it('returns existing overrides map', async () => {
    mockProjectFindFirst.mockResolvedValue(MOCK_PROJECT_WITH_OVERRIDES);

    const response = await GET(makeRequest('GET'), ROUTE_PARAMS);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.overrides).toEqual({ line_001: 'WHISPERED', line_002: 'NERVOUS' });
  });

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockReturnValue({ userId: null });
    mockProjectFindFirst.mockResolvedValue(MOCK_PROJECT_NO_OVERRIDES);

    const response = await GET(makeRequest('GET'), ROUTE_PARAMS);

    expect(response.status).toBe(401);
  });

  it('returns 404 when project not found', async () => {
    mockProjectFindFirst.mockResolvedValue(null);

    const response = await GET(makeRequest('GET'), ROUTE_PARAMS);

    expect(response.status).toBe(404);
  });
});

describe('PUT /api/projects/[id]/emotion-overrides', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockReturnValue({ userId: USER_ID });
    mockProjectFindFirst.mockResolvedValue(MOCK_PROJECT_NO_OVERRIDES);
    mockProjectUpdate.mockResolvedValue({
      ...MOCK_PROJECT_NO_OVERRIDES,
      emotionOverrides: { line_001: 'WHISPERED' },
    });
  });

  it('saves emotion overrides and returns updated map', async () => {
    const response = await PUT(
      makeRequest('PUT', { overrides: { line_001: 'WHISPERED', line_003: 'EXCITED' } }),
      ROUTE_PARAMS,
    );

    expect(response.status).toBe(200);
    expect(mockProjectUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: PROJECT_ID },
        data: expect.objectContaining({
          emotionOverrides: { line_001: 'WHISPERED', line_003: 'EXCITED' },
        }),
      }),
    );
  });

  it('accepts empty overrides map (clears all overrides)', async () => {
    mockProjectUpdate.mockResolvedValue({
      ...MOCK_PROJECT_NO_OVERRIDES,
      emotionOverrides: {},
    });

    const response = await PUT(
      makeRequest('PUT', { overrides: {} }),
      ROUTE_PARAMS,
    );

    expect(response.status).toBe(200);
    expect(mockProjectUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ emotionOverrides: {} }),
      }),
    );
  });

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockReturnValue({ userId: null });

    const response = await PUT(
      makeRequest('PUT', { overrides: {} }),
      ROUTE_PARAMS,
    );

    expect(response.status).toBe(401);
  });

  it('returns 400 when overrides field is missing', async () => {
    const response = await PUT(makeRequest('PUT', {}), ROUTE_PARAMS);

    expect(response.status).toBe(400);
    expect(mockProjectUpdate).not.toHaveBeenCalled();
  });
});
