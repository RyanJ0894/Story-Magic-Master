import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { mockSupabaseClient } from '../../setup';

// Mock nanoid
vi.mock('nanoid', () => ({
  nanoid: vi.fn(() => 'test-share-code'),
}));

// Import after mocks
const { GET, POST } = await import('@/app/api/shares/route');

describe('Shares API', () => {
  const mockUser = { id: 'user-123', email: 'test@example.com' };
  const mockProject = { id: 'project-123', name: 'Test Script', user_id: 'user-123' };
  const mockSubscription = { id: 'sub-123', status: 'active' };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/shares', () => {
    it('returns 401 when user is not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: { message: 'Not authenticated' },
      });

      const request = new NextRequest('http://localhost:22000/api/shares');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('returns shares for authenticated user', async () => {
      const mockShares = [
        { id: 'share-1', project_id: 'project-123', share_code: 'abc123' },
        { id: 'share-2', project_id: 'project-456', share_code: 'def456' },
      ];

      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: mockUser },
        error: null,
      });

      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockShares, error: null }),
      };
      mockSupabaseClient.from.mockReturnValue(mockQuery);

      const request = new NextRequest('http://localhost:22000/api/shares');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.shares).toHaveLength(2);
    });

    it('filters by project_id when provided', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: mockUser },
        error: null,
      });

      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      };
      mockSupabaseClient.from.mockReturnValue(mockQuery);

      const request = new NextRequest('http://localhost:22000/api/shares?project_id=project-123');
      await GET(request);

      expect(mockQuery.eq).toHaveBeenCalledWith('shared_by', 'user-123');
    });
  });

  describe('POST /api/shares', () => {
    it('returns 400 when project_id is missing', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: mockUser },
        error: null,
      });

      const request = new NextRequest('http://localhost:22000/api/shares', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('project_id is required');
    });

    it('returns 404 when project not found', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: mockUser },
        error: null,
      });

      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
      };
      mockSupabaseClient.from.mockReturnValue(mockQuery);

      const request = new NextRequest('http://localhost:22000/api/shares', {
        method: 'POST',
        body: JSON.stringify({ project_id: 'nonexistent' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Project not found');
    });

    it('returns 403 when user does not own the project', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: mockUser },
        error: null,
      });

      const otherUserProject = { ...mockProject, user_id: 'other-user-456' };
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: otherUserProject, error: null }),
      };
      mockSupabaseClient.from.mockReturnValue(mockQuery);

      const request = new NextRequest('http://localhost:22000/api/shares', {
        method: 'POST',
        body: JSON.stringify({ project_id: 'project-123' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Not authorized to share this project');
    });

    it('returns 403 when user has no active subscription', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: mockUser },
        error: null,
      });

      // First call for project check
      const projectQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockProject, error: null }),
      };

      // Second call for subscription check
      const subscriptionQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      mockSupabaseClient.from
        .mockReturnValueOnce(projectQuery)
        .mockReturnValueOnce(subscriptionQuery);

      const request = new NextRequest('http://localhost:22000/api/shares', {
        method: 'POST',
        body: JSON.stringify({ project_id: 'project-123' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Active subscription required to share scripts');
    });

    it('creates share successfully with default options', async () => {
      const createdShare = {
        id: 'share-new',
        project_id: 'project-123',
        share_code: 'test-share-code',
        access_level: 'stream',
        is_active: true,
      };

      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: mockUser },
        error: null,
      });

      const projectQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockProject, error: null }),
      };

      const subscriptionQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockSubscription, error: null }),
      };

      const insertQuery = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: createdShare, error: null }),
      };

      mockSupabaseClient.from
        .mockReturnValueOnce(projectQuery)
        .mockReturnValueOnce(subscriptionQuery)
        .mockReturnValueOnce(insertQuery);

      const request = new NextRequest('http://localhost:22000/api/shares', {
        method: 'POST',
        body: JSON.stringify({ project_id: 'project-123' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.share).toEqual(createdShare);
      expect(data.shareCode).toBe('test-share-code');
      expect(data.shareUrl).toContain('/s/test-share-code');
    });

    it('creates share with custom access level and expiration', async () => {
      const createdShare = {
        id: 'share-new',
        project_id: 'project-123',
        share_code: 'test-share-code',
        access_level: 'download',
        expires_at: '2026-02-01T00:00:00Z',
      };

      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: mockUser },
        error: null,
      });

      const projectQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockProject, error: null }),
      };

      const subscriptionQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockSubscription, error: null }),
      };

      const insertQuery = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: createdShare, error: null }),
      };

      mockSupabaseClient.from
        .mockReturnValueOnce(projectQuery)
        .mockReturnValueOnce(subscriptionQuery)
        .mockReturnValueOnce(insertQuery);

      const request = new NextRequest('http://localhost:22000/api/shares', {
        method: 'POST',
        body: JSON.stringify({
          project_id: 'project-123',
          access_level: 'download',
          expires_at: '2026-02-01T00:00:00Z',
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.share.access_level).toBe('download');
    });
  });
});
