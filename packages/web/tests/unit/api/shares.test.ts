import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock Clerk auth
const mockAuth = vi.fn();
vi.mock('@clerk/nextjs/server', () => ({
  auth: () => mockAuth(),
}));

// Mock CSRF validation
vi.mock('@/lib/csrf', () => ({
  validateCsrf: vi.fn(() => null),
}));

// Mock nanoid
vi.mock('nanoid', () => ({
  nanoid: vi.fn(() => 'test-share-code'),
}));

// Mock password library
vi.mock('@/lib/password', () => ({
  hashPassword: vi.fn(() => Promise.resolve('$2b$12$mockedhash')),
  verifyPassword: vi.fn((password: string) => Promise.resolve(password === 'correct-password')),
  isBcryptHash: vi.fn((hash: string) => hash.startsWith('$2')),
}));

// Mock Prisma
const mockPrisma = {
  scriptShare: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  project: {
    findFirst: vi.fn(),
  },
  subscription: {
    findFirst: vi.fn(),
  },
};
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));

// Import after mocks
const { GET, POST } = await import('@/app/api/shares/route');

describe('Shares API', () => {
  const userId = 'user-123';
  const mockProject = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Test Script',
    userId: 'user-123',
  };
  const mockSubscription = { id: 'sub-123', status: 'active', userId: 'user-123' };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/shares', () => {
    it('returns 401 when user is not authenticated', async () => {
      mockAuth.mockResolvedValueOnce({ userId: null });

      const request = new NextRequest('http://localhost:22000/api/shares');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('returns shares for authenticated user', async () => {
      const mockShares = [
        { id: 'share-1', projectId: 'project-123', shareCode: 'abc123' },
        { id: 'share-2', projectId: 'project-456', shareCode: 'def456' },
      ];

      mockAuth.mockResolvedValueOnce({ userId });
      mockPrisma.scriptShare.findMany.mockResolvedValueOnce(mockShares);

      const request = new NextRequest('http://localhost:22000/api/shares');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.shares).toHaveLength(2);
    });

    it('filters by project_id when provided', async () => {
      mockAuth.mockResolvedValueOnce({ userId });
      mockPrisma.scriptShare.findMany.mockResolvedValueOnce([]);

      const request = new NextRequest('http://localhost:22000/api/shares?project_id=project-123');
      await GET(request);

      expect(mockPrisma.scriptShare.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            sharedBy: 'user-123',
            projectId: 'project-123',
          }),
        })
      );
    });
  });

  describe('POST /api/shares', () => {
    it('returns 400 when project_id is missing', async () => {
      mockAuth.mockResolvedValueOnce({ userId });

      const request = new NextRequest('http://localhost:22000/api/shares', {
        method: 'POST',
        headers: { origin: 'http://localhost:22000' },
        body: JSON.stringify({}),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid request parameters');
    });

    it('returns 400 when project_id is not a valid UUID', async () => {
      mockAuth.mockResolvedValueOnce({ userId });

      const request = new NextRequest('http://localhost:22000/api/shares', {
        method: 'POST',
        headers: { origin: 'http://localhost:22000' },
        body: JSON.stringify({ project_id: 'not-a-uuid' }),
      });
      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('returns 400 for invalid access_level', async () => {
      mockAuth.mockResolvedValueOnce({ userId });

      const request = new NextRequest('http://localhost:22000/api/shares', {
        method: 'POST',
        headers: { origin: 'http://localhost:22000' },
        body: JSON.stringify({
          project_id: '550e8400-e29b-41d4-a716-446655440000',
          access_level: 'invalid',
        }),
      });
      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('returns 400 for invalid email', async () => {
      mockAuth.mockResolvedValueOnce({ userId });

      const request = new NextRequest('http://localhost:22000/api/shares', {
        method: 'POST',
        headers: { origin: 'http://localhost:22000' },
        body: JSON.stringify({
          project_id: '550e8400-e29b-41d4-a716-446655440000',
          recipient_email: 'not-an-email',
        }),
      });
      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('returns 400 for password too short', async () => {
      mockAuth.mockResolvedValueOnce({ userId });

      const request = new NextRequest('http://localhost:22000/api/shares', {
        method: 'POST',
        headers: { origin: 'http://localhost:22000' },
        body: JSON.stringify({
          project_id: '550e8400-e29b-41d4-a716-446655440000',
          password: '12',
        }),
      });
      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('returns 404 when project not found', async () => {
      mockAuth.mockResolvedValueOnce({ userId });
      mockPrisma.project.findFirst.mockResolvedValueOnce(null);

      const request = new NextRequest('http://localhost:22000/api/shares', {
        method: 'POST',
        headers: { origin: 'http://localhost:22000' },
        body: JSON.stringify({ project_id: '550e8400-e29b-41d4-a716-446655440000' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Project not found');
    });

    it('returns 403 when user does not own the project', async () => {
      mockAuth.mockResolvedValueOnce({ userId });

      const otherUserProject = { ...mockProject, userId: 'other-user-456' };
      mockPrisma.project.findFirst.mockResolvedValueOnce(otherUserProject);

      const request = new NextRequest('http://localhost:22000/api/shares', {
        method: 'POST',
        headers: { origin: 'http://localhost:22000' },
        body: JSON.stringify({ project_id: '550e8400-e29b-41d4-a716-446655440000' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Not authorized to share this project');
    });

    it('returns 403 when user has no active subscription', async () => {
      mockAuth.mockResolvedValueOnce({ userId });

      mockPrisma.project.findFirst.mockResolvedValueOnce(mockProject);
      mockPrisma.subscription.findFirst.mockResolvedValueOnce(null);

      const request = new NextRequest('http://localhost:22000/api/shares', {
        method: 'POST',
        headers: { origin: 'http://localhost:22000' },
        body: JSON.stringify({ project_id: '550e8400-e29b-41d4-a716-446655440000' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Active subscription required to share scripts');
    });

    it('creates share successfully with default options', async () => {
      const createdShare = {
        id: 'share-new',
        projectId: '550e8400-e29b-41d4-a716-446655440000',
        shareCode: 'test-share-code',
        accessLevel: 'stream',
        isActive: true,
      };

      mockAuth.mockResolvedValueOnce({ userId });
      mockPrisma.project.findFirst.mockResolvedValueOnce(mockProject);
      mockPrisma.subscription.findFirst.mockResolvedValueOnce(mockSubscription);
      mockPrisma.scriptShare.create.mockResolvedValueOnce(createdShare);

      const request = new NextRequest('http://localhost:22000/api/shares', {
        method: 'POST',
        headers: { origin: 'http://localhost:22000' },
        body: JSON.stringify({ project_id: '550e8400-e29b-41d4-a716-446655440000' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.share).toEqual(createdShare);
      expect(data.shareCode).toBe('test-share-code');
      expect(data.shareUrl).toContain('/s/test-share-code');
    });

    it('creates share with password hashing', async () => {
      const createdShare = {
        id: 'share-new',
        projectId: '550e8400-e29b-41d4-a716-446655440000',
        shareCode: 'test-share-code',
        passwordHash: '$2b$12$mockedhash',
      };

      mockAuth.mockResolvedValueOnce({ userId });
      mockPrisma.project.findFirst.mockResolvedValueOnce(mockProject);
      mockPrisma.subscription.findFirst.mockResolvedValueOnce(mockSubscription);
      mockPrisma.scriptShare.create.mockResolvedValueOnce(createdShare);

      const request = new NextRequest('http://localhost:22000/api/shares', {
        method: 'POST',
        headers: { origin: 'http://localhost:22000' },
        body: JSON.stringify({
          project_id: '550e8400-e29b-41d4-a716-446655440000',
          password: 'secretpass',
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      // Verify hashPassword was called
      const { hashPassword } = await import('@/lib/password');
      expect(hashPassword).toHaveBeenCalledWith('secretpass');
    });
  });
});
