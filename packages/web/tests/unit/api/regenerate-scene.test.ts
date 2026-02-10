/**
 * Tests for Regenerate Scene API Route
 *
 * POST /api/projects/:id/regenerate-scene
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { mockSupabaseClient, createChainableMock } from '../../setup';

// Mock CSRF validation
const mockValidateCsrf = vi.fn(() => null);
vi.mock('@/lib/csrf', () => ({
  validateCsrf: (...args: unknown[]) => mockValidateCsrf(...args),
}));

// Mock queue enqueue
const mockEnqueue = vi.fn();
vi.mock('@/lib/queue/service', () => ({
  enqueue: (...args: unknown[]) => mockEnqueue(...args),
}));

// Import after mocks
const { POST } = await import('@/app/api/projects/[id]/regenerate-scene/route');

// =============================================================================
// Helpers
// =============================================================================

const PROJECT_ID = '550e8400-e29b-41d4-a716-446655440000';
const USER_ID = 'user-123';

const mockDirectorJson = {
  scenes: [
    { scene_id: 'scene-1', summary: 'Opening scene', mood: 'tense' },
    { scene_id: 'scene-2', summary: 'Climax', mood: 'dramatic' },
    { scene_id: 'scene-3', summary: 'Resolution', mood: 'calm' },
  ],
};

function createRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest(
    `http://localhost:22000/api/projects/${PROJECT_ID}/regenerate-scene`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        origin: 'http://localhost:22000',
      },
      body: JSON.stringify(body),
    },
  );
}

function mockAuth(user = { id: USER_ID, email: 'writer@example.com' }) {
  mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
    data: { user },
    error: null,
  });
  mockSupabaseClient.auth.getSession.mockResolvedValueOnce({
    data: { session: { access_token: 'test-token' } },
    error: null,
  });
}

function mockProject(project: Record<string, unknown> | null) {
  mockSupabaseClient.from.mockReturnValueOnce(
    createChainableMock({
      data: project,
      error: project ? null : { message: 'not found' },
    }),
  );
}

const routeParams = { params: Promise.resolve({ id: PROJECT_ID }) };

// =============================================================================
// Tests
// =============================================================================

describe('Regenerate Scene API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateCsrf.mockReturnValue(null);
    mockEnqueue.mockResolvedValue({
      jobId: 'job-123',
      position: 1,
      estimatedWaitSeconds: 30,
    });
  });

  it('rejects unauthenticated requests with 401', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'Not authenticated' },
    });

    const response = await POST(createRequest({ sceneIndex: 0 }), routeParams);
    expect(response.status).toBe(401);
  });

  it('rejects CSRF failures with 403', async () => {
    mockValidateCsrf.mockReturnValueOnce('invalid origin');

    const response = await POST(createRequest({ sceneIndex: 0 }), routeParams);
    expect(response.status).toBe(403);
  });

  it('returns 404 when project not found', async () => {
    mockAuth();
    mockProject(null);

    const response = await POST(createRequest({ sceneIndex: 0 }), routeParams);
    expect(response.status).toBe(404);
  });

  it('returns 404 when project has no director_json', async () => {
    mockAuth();
    mockProject({
      id: PROJECT_ID,
      user_id: USER_ID,
      director_json: null,
    });

    const response = await POST(createRequest({ sceneIndex: 0 }), routeParams);
    expect(response.status).toBe(404);

    const data = await response.json();
    expect(data.code).toBe('NO_SCENES');
  });

  it('returns 400 for invalid sceneIndex', async () => {
    mockAuth();
    mockProject({
      id: PROJECT_ID,
      user_id: USER_ID,
      director_json: mockDirectorJson,
    });

    const response = await POST(createRequest({ sceneIndex: -1 }), routeParams);
    expect(response.status).toBe(400);
  });

  it('returns 400 for sceneIndex out of range', async () => {
    mockAuth();
    mockProject({
      id: PROJECT_ID,
      user_id: USER_ID,
      director_json: mockDirectorJson,
    });

    const response = await POST(createRequest({ sceneIndex: 5 }), routeParams);
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.code).toBe('SCENE_OUT_OF_RANGE');
  });

  it('enqueues scene_regeneration job on success', async () => {
    mockAuth();
    mockProject({
      id: PROJECT_ID,
      user_id: USER_ID,
      director_json: mockDirectorJson,
    });

    const response = await POST(createRequest({ sceneIndex: 1 }), routeParams);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.jobId).toBe('job-123');
    expect(data.status).toBe('queued');
    expect(data.sceneIndex).toBe(1);

    expect(mockEnqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: PROJECT_ID,
        userId: USER_ID,
        jobType: 'scene_regeneration',
        metadata: expect.objectContaining({
          sceneIndex: 1,
          scene: mockDirectorJson.scenes[1],
        }),
      }),
    );
  });

  it('returns 400 for non-numeric sceneIndex', async () => {
    mockAuth();
    mockProject({
      id: PROJECT_ID,
      user_id: USER_ID,
      director_json: mockDirectorJson,
    });

    const response = await POST(
      createRequest({ sceneIndex: 'abc' }),
      routeParams,
    );
    expect(response.status).toBe(400);
  });
});
