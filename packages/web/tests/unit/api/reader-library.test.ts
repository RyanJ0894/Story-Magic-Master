import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { mockSupabaseClient, createChainableMock } from '../../setup';

// Import after mocks
const { GET: getLibrary } = await import('@/app/api/reader/library/route');
const { GET: getEntry, PATCH: updateEntry, DELETE: deleteEntry } = await import(
  '@/app/api/reader/library/[entryId]/route'
);
const { POST: toggleFavorite } = await import(
  '@/app/api/reader/library/[entryId]/favorite/route'
);
const { POST: updatePosition } = await import(
  '@/app/api/reader/library/[entryId]/position/route'
);

describe('Reader Library API', () => {
  const mockUser = { id: 'user-123', email: 'reader@example.com' };

  const mockLibraryEntry = {
    id: 'entry-123',
    reader_id: 'user-123',
    project_id: 'project-123',
    source: 'received',
    status: 'active',
    is_favorited: false,
    play_position_seconds: 120,
    completed: false,
    projects: {
      id: 'project-123',
      name: 'Test Script',
      page_count: 90,
      user_id: 'writer-456',
      profiles: {
        full_name: 'Test Writer',
        writer_code: 'WRT123',
      },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/reader/library', () => {
    it('returns 401 when not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: { message: 'Not authenticated' },
      });

      const request = new NextRequest('http://localhost:22000/api/reader/library');
      const response = await getLibrary(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('returns library entries with writer subscription status', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: mockUser },
        error: null,
      });

      // Library entries query
      const libraryQuery = createChainableMock({ data: [mockLibraryEntry], error: null });

      // Subscriptions query - needs double .in() chain
      const subscriptionsQuery = createChainableMock({
        data: [{ user_id: 'writer-456' }],
        error: null,
      });

      // Audio outputs query
      const audioQuery = createChainableMock({
        data: [{ project_id: 'project-123', duration_seconds: 5400 }],
        error: null,
      });

      mockSupabaseClient.from
        .mockReturnValueOnce(libraryQuery)
        .mockReturnValueOnce(subscriptionsQuery)
        .mockReturnValueOnce(audioQuery);

      const request = new NextRequest('http://localhost:22000/api/reader/library');
      const response = await getLibrary(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.entries).toHaveLength(1);
      expect(data.entries[0].script_name).toBe('Test Script');
      expect(data.entries[0].writer_name).toBe('Test Writer');
      expect(data.entries[0].writer_subscribed).toBe(true);
      expect(data.entries[0].duration_seconds).toBe(5400);
    });

    it('marks entries as archived when writer is not subscribed', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: mockUser },
        error: null,
      });

      const libraryQuery = createChainableMock({ data: [mockLibraryEntry], error: null });
      const subscriptionsQuery = createChainableMock({ data: [], error: null });
      const audioQuery = createChainableMock({ data: [], error: null });

      mockSupabaseClient.from
        .mockReturnValueOnce(libraryQuery)
        .mockReturnValueOnce(subscriptionsQuery)
        .mockReturnValueOnce(audioQuery);

      const request = new NextRequest('http://localhost:22000/api/reader/library');
      const response = await getLibrary(request);
      const data = await response.json();

      expect(data.entries[0].status).toBe('archived');
      expect(data.entries[0].writer_subscribed).toBe(false);
    });

    it('filters by source when provided', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: mockUser },
        error: null,
      });

      const libraryQuery = createChainableMock({ data: [], error: null });
      const subscriptionsQuery = createChainableMock({ data: [], error: null });
      const audioQuery = createChainableMock({ data: [], error: null });

      mockSupabaseClient.from
        .mockReturnValueOnce(libraryQuery)
        .mockReturnValueOnce(subscriptionsQuery)
        .mockReturnValueOnce(audioQuery);

      const request = new NextRequest('http://localhost:22000/api/reader/library?source=uploaded');
      await getLibrary(request);

      expect(libraryQuery.eq).toHaveBeenCalledWith('source', 'uploaded');
    });
  });

  describe('GET /api/reader/library/[entryId]', () => {
    it('returns entry with audio details', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: mockUser },
        error: null,
      });

      const entryQuery = createChainableMock({ data: mockLibraryEntry, error: null });
      const audioQuery = createChainableMock({
        data: { file_url: 'https://storage.test.com/audio.m4a', duration_seconds: 5400 },
        error: null,
      });

      mockSupabaseClient.from
        .mockReturnValueOnce(entryQuery)
        .mockReturnValueOnce(audioQuery);

      const request = new NextRequest('http://localhost:22000/api/reader/library/entry-123');
      const response = await getEntry(request, { params: Promise.resolve({ entryId: 'entry-123' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.entry).toBeDefined();
      expect(data.audio.duration_seconds).toBe(5400);
    });

    it('returns 404 for non-existent entry', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: mockUser },
        error: null,
      });

      const entryQuery = createChainableMock({ data: null, error: { message: 'Not found' } });

      mockSupabaseClient.from.mockReturnValueOnce(entryQuery);

      const request = new NextRequest('http://localhost:22000/api/reader/library/nonexistent');
      const response = await getEntry(request, { params: Promise.resolve({ entryId: 'nonexistent' }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Entry not found');
    });
  });

  describe('PATCH /api/reader/library/[entryId]', () => {
    it('updates entry notes and tags', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: mockUser },
        error: null,
      });

      const existingQuery = createChainableMock({ data: mockLibraryEntry, error: null });
      const updateQuery = createChainableMock({
        data: { ...mockLibraryEntry, notes: 'Great script!' },
        error: null,
      });

      mockSupabaseClient.from
        .mockReturnValueOnce(existingQuery)
        .mockReturnValueOnce(updateQuery);

      const request = new NextRequest('http://localhost:22000/api/reader/library/entry-123', {
        method: 'PATCH',
        body: JSON.stringify({ notes: 'Great script!' }),
      });
      const response = await updateEntry(request, { params: Promise.resolve({ entryId: 'entry-123' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.entry.notes).toBe('Great script!');
    });
  });

  describe('DELETE /api/reader/library/[entryId]', () => {
    it('soft deletes entry by setting status to removed', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: mockUser },
        error: null,
      });

      const existingQuery = createChainableMock({ data: mockLibraryEntry, error: null });
      const updateQuery = createChainableMock({ data: null, error: null });

      mockSupabaseClient.from
        .mockReturnValueOnce(existingQuery)
        .mockReturnValueOnce(updateQuery);

      const request = new NextRequest('http://localhost:22000/api/reader/library/entry-123', {
        method: 'DELETE',
      });
      const response = await deleteEntry(request, { params: Promise.resolve({ entryId: 'entry-123' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(updateQuery.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'removed' })
      );
    });
  });

  describe('POST /api/reader/library/[entryId]/favorite', () => {
    it('toggles favorite status', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: mockUser },
        error: null,
      });

      const existingQuery = createChainableMock({
        data: { ...mockLibraryEntry, is_favorited: false },
        error: null,
      });
      const updateQuery = createChainableMock({
        data: { ...mockLibraryEntry, is_favorited: true },
        error: null,
      });

      mockSupabaseClient.from
        .mockReturnValueOnce(existingQuery)
        .mockReturnValueOnce(updateQuery);

      const request = new NextRequest('http://localhost:22000/api/reader/library/entry-123/favorite', {
        method: 'POST',
        body: JSON.stringify({ is_favorited: true }),
      });
      const response = await toggleFavorite(request, { params: Promise.resolve({ entryId: 'entry-123' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.is_favorited).toBe(true);
    });
  });

  describe('POST /api/reader/library/[entryId]/position', () => {
    it('updates playback position', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: mockUser },
        error: null,
      });

      // 1. Ownership check
      const existingQuery = createChainableMock({
        data: { id: 'entry-123', reader_id: 'user-123' },
        error: null,
      });
      // 2. Update query
      const updateQuery = createChainableMock({
        data: { ...mockLibraryEntry, play_position_seconds: 300 },
        error: null,
      });
      // 3. Log query
      const logQuery = createChainableMock({ data: null, error: null });

      mockSupabaseClient.from
        .mockReturnValueOnce(existingQuery)
        .mockReturnValueOnce(updateQuery)
        .mockReturnValueOnce(logQuery);

      const request = new NextRequest('http://localhost:22000/api/reader/library/entry-123/position', {
        method: 'POST',
        body: JSON.stringify({ position: 300, duration: 5400 }),
      });
      const response = await updatePosition(request, { params: Promise.resolve({ entryId: 'entry-123' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.position).toBe(300);
    });

    it('marks as completed when near end', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: mockUser },
        error: null,
      });

      // 1. Ownership check
      const existingQuery = createChainableMock({
        data: { id: 'entry-123', reader_id: 'user-123' },
        error: null,
      });
      // 2. Update query
      const updateQuery = createChainableMock({
        data: { ...mockLibraryEntry, play_position_seconds: 5380, completed: true },
        error: null,
      });
      // 3. Log query
      const logQuery = createChainableMock({ data: null, error: null });

      mockSupabaseClient.from
        .mockReturnValueOnce(existingQuery)
        .mockReturnValueOnce(updateQuery)
        .mockReturnValueOnce(logQuery);

      const request = new NextRequest('http://localhost:22000/api/reader/library/entry-123/position', {
        method: 'POST',
        body: JSON.stringify({ position: 5380, duration: 5400 }),
      });
      const response = await updatePosition(request, { params: Promise.resolve({ entryId: 'entry-123' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.completed).toBe(true);
    });
  });
});
