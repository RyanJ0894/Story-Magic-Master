/**
 * Tests for Projects API Routes
 *
 * GET /api/projects - List user's projects
 * POST /api/projects - Create a new project
 * GET /api/projects/[id] - Get a single project
 * PATCH /api/projects/[id] - Update a project
 * DELETE /api/projects/[id] - Delete a project
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock Clerk auth
const mockAuth = vi.fn();
vi.mock('@clerk/nextjs/server', () => ({
  auth: () => mockAuth(),
}));

// Mock Prisma
const mockPrisma = {
  project: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
};
vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

// Mock CSRF validation
const mockValidateCsrf = vi.fn(() => null);
vi.mock('@/lib/csrf', () => ({
  validateCsrf: (...args: unknown[]) => mockValidateCsrf(...args),
}));

// Import after mocks
const { GET: listProjects, POST: createProject } = await import(
  '@/app/api/projects/route'
);
const {
  GET: getProject,
  PATCH: updateProject,
  DELETE: deleteProject,
} = await import('@/app/api/projects/[id]/route');

// =============================================================================
// Helpers
// =============================================================================

const VALID_PROJECT_ID = '550e8400-e29b-41d4-a716-446655440000';
const OTHER_PROJECT_ID = '770e8400-e29b-41d4-a716-446655440002';

const mockProject = {
  id: VALID_PROJECT_ID,
  userId: 'user_test123',
  name: 'My Screenplay',
  scriptText: 'FADE IN: A dark room...',
  pageCount: 45,
  voiceAssignments: [],
  createdAt: new Date('2026-01-15T10:00:00Z'),
  updatedAt: new Date('2026-01-20T14:30:00Z'),
};

function createRequest(
  url: string,
  options: {
    method?: string;
    body?: Record<string, unknown>;
    headers?: Record<string, string>;
  } = {}
): NextRequest {
  const init: RequestInit = {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      origin: 'http://localhost:22000',
      ...(options.headers || {}),
    },
  };

  if (options.body) {
    init.body = JSON.stringify(options.body);
  }

  return new NextRequest(url, init);
}

// =============================================================================
// Tests: GET /api/projects (list)
// =============================================================================

describe('Projects API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateCsrf.mockReturnValue(null);
  });

  describe('GET /api/projects - List projects', () => {
    it('returns 401 when user is not authenticated', async () => {
      mockAuth.mockResolvedValueOnce({ userId: null });

      const request = createRequest('http://localhost:22000/api/projects');
      const response = await listProjects(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
      expect(data.code).toBe('AUTH_REQUIRED');
    });

    it('returns list of user projects', async () => {
      const mockProjects = [
        { ...mockProject },
        { ...mockProject, id: OTHER_PROJECT_ID, name: 'Second Script' },
      ];

      mockAuth.mockResolvedValueOnce({ userId: 'user_test123' });
      mockPrisma.project.findMany.mockResolvedValueOnce(mockProjects);

      const request = createRequest('http://localhost:22000/api/projects');
      const response = await listProjects(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.projects).toHaveLength(2);
      expect(data.projects[0].name).toBe('My Screenplay');
      expect(data.projects[1].name).toBe('Second Script');
    });

    it('returns empty array when user has no projects', async () => {
      mockAuth.mockResolvedValueOnce({ userId: 'user_test123' });
      mockPrisma.project.findMany.mockResolvedValueOnce([]);

      const request = createRequest('http://localhost:22000/api/projects');
      const response = await listProjects(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.projects).toEqual([]);
    });
  });

  // ===========================================================================
  // Tests: POST /api/projects (create)
  // ===========================================================================

  describe('POST /api/projects - Create project', () => {
    it('creates a new project and returns 201', async () => {
      mockAuth.mockResolvedValueOnce({ userId: 'user_test123' });

      const createdProject = { ...mockProject, name: 'New Script' };
      mockPrisma.project.create.mockResolvedValueOnce(createdProject);

      const request = createRequest('http://localhost:22000/api/projects', {
        method: 'POST',
        body: { name: 'New Script' },
      });
      const response = await createProject(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.project.name).toBe('New Script');
    });

    it('returns 400 when name is missing', async () => {
      mockAuth.mockResolvedValueOnce({ userId: 'user_test123' });

      const request = createRequest('http://localhost:22000/api/projects', {
        method: 'POST',
        body: {},
      });
      const response = await createProject(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe('VALIDATION_ERROR');
      expect(data.details).toHaveProperty('name');
    });

    it('returns 401 when not authenticated', async () => {
      mockAuth.mockResolvedValueOnce({ userId: null });

      const request = createRequest('http://localhost:22000/api/projects', {
        method: 'POST',
        body: { name: 'Test' },
      });
      const response = await createProject(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.code).toBe('AUTH_REQUIRED');
    });
  });

  // ===========================================================================
  // Tests: GET /api/projects/[id] (single)
  // ===========================================================================

  describe('GET /api/projects/[id] - Get single project', () => {
    it('returns the project for the authenticated owner', async () => {
      mockAuth.mockResolvedValueOnce({ userId: 'user_test123' });
      mockPrisma.project.findFirst.mockResolvedValueOnce(mockProject);

      const request = createRequest(
        `http://localhost:22000/api/projects/${VALID_PROJECT_ID}`
      );
      const response = await getProject(request, {
        params: Promise.resolve({ id: VALID_PROJECT_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.project.id).toBe(VALID_PROJECT_ID);
      expect(data.project.name).toBe('My Screenplay');
    });

    it('returns 404 for non-existent project', async () => {
      mockAuth.mockResolvedValueOnce({ userId: 'user_test123' });
      mockPrisma.project.findFirst.mockResolvedValueOnce(null);

      const request = createRequest(
        `http://localhost:22000/api/projects/${VALID_PROJECT_ID}`
      );
      const response = await getProject(request, {
        params: Promise.resolve({ id: VALID_PROJECT_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.code).toBe('PROJECT_NOT_FOUND');
    });

    it('prevents accessing another user project (returns 404)', async () => {
      mockAuth.mockResolvedValueOnce({ userId: 'user_test123' });
      // Prisma findFirst with userId filter returns null for non-matching user
      mockPrisma.project.findFirst.mockResolvedValueOnce(null);

      const request = createRequest(
        `http://localhost:22000/api/projects/${OTHER_PROJECT_ID}`
      );
      const response = await getProject(request, {
        params: Promise.resolve({ id: OTHER_PROJECT_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.code).toBe('PROJECT_NOT_FOUND');
    });
  });

  // ===========================================================================
  // Tests: PATCH /api/projects/[id] (update)
  // ===========================================================================

  describe('PATCH /api/projects/[id] - Update project', () => {
    it('updates project name and returns updated project', async () => {
      mockAuth.mockResolvedValueOnce({ userId: 'user_test123' });

      // First call: findFirst to check existence
      mockPrisma.project.findFirst.mockResolvedValueOnce({ id: VALID_PROJECT_ID });
      // Second call: update
      const updatedProject = { ...mockProject, name: 'Renamed Script' };
      mockPrisma.project.update.mockResolvedValueOnce(updatedProject);

      const request = createRequest(
        `http://localhost:22000/api/projects/${VALID_PROJECT_ID}`,
        {
          method: 'PATCH',
          body: { name: 'Renamed Script' },
        }
      );
      const response = await updateProject(request, {
        params: Promise.resolve({ id: VALID_PROJECT_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.project.name).toBe('Renamed Script');
    });

    it('returns 404 when updating non-existent project', async () => {
      mockAuth.mockResolvedValueOnce({ userId: 'user_test123' });
      mockPrisma.project.findFirst.mockResolvedValueOnce(null);

      const request = createRequest(
        `http://localhost:22000/api/projects/${VALID_PROJECT_ID}`,
        {
          method: 'PATCH',
          body: { name: 'Updated' },
        }
      );
      const response = await updateProject(request, {
        params: Promise.resolve({ id: VALID_PROJECT_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.code).toBe('PROJECT_NOT_FOUND');
    });

    it('returns 400 for invalid update payload', async () => {
      mockAuth.mockResolvedValueOnce({ userId: 'user_test123' });

      const request = createRequest(
        `http://localhost:22000/api/projects/${VALID_PROJECT_ID}`,
        {
          method: 'PATCH',
          body: { page_count: -5 },
        }
      );
      const response = await updateProject(request, {
        params: Promise.resolve({ id: VALID_PROJECT_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe('VALIDATION_ERROR');
    });
  });

  // ===========================================================================
  // Tests: DELETE /api/projects/[id]
  // ===========================================================================

  describe('DELETE /api/projects/[id] - Delete project', () => {
    it('deletes project and returns success', async () => {
      mockAuth.mockResolvedValueOnce({ userId: 'user_test123' });

      // Check existence
      mockPrisma.project.findFirst.mockResolvedValueOnce({ id: VALID_PROJECT_ID });
      // Delete operation
      mockPrisma.project.delete.mockResolvedValueOnce({});

      const request = createRequest(
        `http://localhost:22000/api/projects/${VALID_PROJECT_ID}`,
        { method: 'DELETE' }
      );
      const response = await deleteProject(request, {
        params: Promise.resolve({ id: VALID_PROJECT_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.deleted).toBe(VALID_PROJECT_ID);
    });

    it('returns 404 when deleting non-existent project', async () => {
      mockAuth.mockResolvedValueOnce({ userId: 'user_test123' });
      mockPrisma.project.findFirst.mockResolvedValueOnce(null);

      const request = createRequest(
        `http://localhost:22000/api/projects/${VALID_PROJECT_ID}`,
        { method: 'DELETE' }
      );
      const response = await deleteProject(request, {
        params: Promise.resolve({ id: VALID_PROJECT_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.code).toBe('PROJECT_NOT_FOUND');
    });

    it('returns 401 when not authenticated', async () => {
      mockAuth.mockResolvedValueOnce({ userId: null });

      const request = createRequest(
        `http://localhost:22000/api/projects/${VALID_PROJECT_ID}`,
        { method: 'DELETE' }
      );
      const response = await deleteProject(request, {
        params: Promise.resolve({ id: VALID_PROJECT_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.code).toBe('AUTH_REQUIRED');
    });
  });
});
