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

// Mock Prisma
const mockPrisma = {
  readerLibrary: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    // #331 (2026-06-17): position route reads pre-update completed state
    // so it can fire emitListenComplete only on the false→true transition.
    findUnique: vi.fn().mockResolvedValue({ completed: false }),
    update: vi.fn(),
    create: vi.fn(),
  },
  subscription: {
    findMany: vi.fn(),
  },
  audioOutput: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
  },
  contentAccessLog: {
    create: vi.fn(),
  },
  // #331: producer dependency — resolveProjectMaster needs project.findUnique.
  // Returns null so emitListenComplete short-circuits in these tests.
  project: {
    findUnique: vi.fn().mockResolvedValue(null),
  },
};
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));

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
  const userId = 'user-123';

  const mockLibraryEntry = {
    id: 'entry-123',
    readerId: 'user-123',
    projectId: 'project-123',
    source: 'received',
    shareId: null,
    status: 'active',
    isFavorited: false,
    notes: null,
    tags: null,
    lastPlayedAt: null,
    playPositionSeconds: 120,
    completed: false,
    createdAt: new Date('2026-01-15T10:00:00Z'),
    updatedAt: new Date('2026-01-20T14:30:00Z'),
    project: {
      id: 'project-123',
      name: 'Test Script',
      pageCount: 90,
      status: 'active',
      userId: 'writer-456',
      user: {
        fullName: 'Test Writer',
        writerCode: 'WRT123',
      },
    },
    share: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/reader/library', () => {
    it('returns 401 when not authenticated', async () => {
      mockAuth.mockResolvedValueOnce({ userId: null });

      const request = new NextRequest('http://localhost:22000/api/reader/library');
      const response = await getLibrary(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('returns library entries with writer subscription status', async () => {
      mockAuth.mockResolvedValueOnce({ userId });

      mockPrisma.readerLibrary.findMany.mockResolvedValueOnce([mockLibraryEntry]);
      mockPrisma.subscription.findMany.mockResolvedValueOnce([{ userId: 'writer-456' }]);
      mockPrisma.audioOutput.findMany.mockResolvedValueOnce([
        { projectId: 'project-123', durationSeconds: 5400 },
      ]);

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
      mockAuth.mockResolvedValueOnce({ userId });

      mockPrisma.readerLibrary.findMany.mockResolvedValueOnce([mockLibraryEntry]);
      mockPrisma.subscription.findMany.mockResolvedValueOnce([]);
      mockPrisma.audioOutput.findMany.mockResolvedValueOnce([]);

      const request = new NextRequest('http://localhost:22000/api/reader/library');
      const response = await getLibrary(request);
      const data = await response.json();

      expect(data.entries[0].status).toBe('archived');
      expect(data.entries[0].writer_subscribed).toBe(false);
    });

    it('filters by source when provided', async () => {
      mockAuth.mockResolvedValueOnce({ userId });

      mockPrisma.readerLibrary.findMany.mockResolvedValueOnce([]);
      mockPrisma.subscription.findMany.mockResolvedValueOnce([]);
      mockPrisma.audioOutput.findMany.mockResolvedValueOnce([]);

      const request = new NextRequest('http://localhost:22000/api/reader/library?source=uploaded');
      await getLibrary(request);

      expect(mockPrisma.readerLibrary.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ source: 'uploaded' }),
        })
      );
    });
  });

  describe('GET /api/reader/library/[entryId]', () => {
    it('returns entry with audio details', async () => {
      mockAuth.mockResolvedValueOnce({ userId });

      mockPrisma.readerLibrary.findFirst.mockResolvedValueOnce(mockLibraryEntry);
      mockPrisma.audioOutput.findFirst.mockResolvedValueOnce({
        filePath: 'https://storage.test.com/audio.m4a',
        durationSeconds: 5400,
      });

      const request = new NextRequest('http://localhost:22000/api/reader/library/entry-123');
      const response = await getEntry(request, { params: Promise.resolve({ entryId: 'entry-123' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.entry).toBeDefined();
      expect(data.audio.durationSeconds).toBe(5400);
    });

    it('returns 404 for non-existent entry', async () => {
      mockAuth.mockResolvedValueOnce({ userId });

      mockPrisma.readerLibrary.findFirst.mockResolvedValueOnce(null);

      const request = new NextRequest('http://localhost:22000/api/reader/library/nonexistent');
      const response = await getEntry(request, { params: Promise.resolve({ entryId: 'nonexistent' }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Entry not found');
    });
  });

  describe('PATCH /api/reader/library/[entryId]', () => {
    it('updates entry notes and tags', async () => {
      mockAuth.mockResolvedValueOnce({ userId });

      // Ownership check
      mockPrisma.readerLibrary.findFirst.mockResolvedValueOnce({
        id: 'entry-123',
        readerId: 'user-123',
      });
      // Update
      mockPrisma.readerLibrary.update.mockResolvedValueOnce({
        ...mockLibraryEntry,
        notes: 'Great script!',
      });

      const request = new NextRequest('http://localhost:22000/api/reader/library/entry-123', {
        method: 'PATCH',
        headers: { origin: 'http://localhost:22000' },
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
      mockAuth.mockResolvedValueOnce({ userId });

      // Ownership check
      mockPrisma.readerLibrary.findFirst.mockResolvedValueOnce({
        id: 'entry-123',
        readerId: 'user-123',
      });
      // Update (soft delete)
      mockPrisma.readerLibrary.update.mockResolvedValueOnce({
        ...mockLibraryEntry,
        status: 'removed',
      });

      const request = new NextRequest('http://localhost:22000/api/reader/library/entry-123', {
        method: 'DELETE',
        headers: { origin: 'http://localhost:22000' },
      });
      const response = await deleteEntry(request, { params: Promise.resolve({ entryId: 'entry-123' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockPrisma.readerLibrary.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'removed' } })
      );
    });
  });

  describe('POST /api/reader/library/[entryId]/favorite', () => {
    it('toggles favorite status', async () => {
      mockAuth.mockResolvedValueOnce({ userId });

      // Ownership check
      mockPrisma.readerLibrary.findFirst.mockResolvedValueOnce({
        id: 'entry-123',
        readerId: 'user-123',
        isFavorited: false,
      });
      // Update
      mockPrisma.readerLibrary.update.mockResolvedValueOnce({
        ...mockLibraryEntry,
        isFavorited: true,
      });

      const request = new NextRequest('http://localhost:22000/api/reader/library/entry-123/favorite', {
        method: 'POST',
        headers: { origin: 'http://localhost:22000' },
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
      mockAuth.mockResolvedValueOnce({ userId });

      // Ownership check
      mockPrisma.readerLibrary.findFirst.mockResolvedValueOnce({
        id: 'entry-123',
        readerId: 'user-123',
        projectId: 'project-123',
      });
      // Update
      mockPrisma.readerLibrary.update.mockResolvedValueOnce({
        ...mockLibraryEntry,
        playPositionSeconds: 300,
        completed: false,
      });
      // Log access
      mockPrisma.contentAccessLog.create.mockResolvedValueOnce({});

      const request = new NextRequest('http://localhost:22000/api/reader/library/entry-123/position', {
        method: 'POST',
        headers: { origin: 'http://localhost:22000' },
        body: JSON.stringify({ position: 300, duration: 5400 }),
      });
      const response = await updatePosition(request, { params: Promise.resolve({ entryId: 'entry-123' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.position).toBe(300);
    });

    it('marks as completed when near end', async () => {
      mockAuth.mockResolvedValueOnce({ userId });

      // Ownership check
      mockPrisma.readerLibrary.findFirst.mockResolvedValueOnce({
        id: 'entry-123',
        readerId: 'user-123',
        projectId: 'project-123',
      });
      // Update
      mockPrisma.readerLibrary.update.mockResolvedValueOnce({
        ...mockLibraryEntry,
        playPositionSeconds: 5380,
        completed: true,
      });
      // Log access
      mockPrisma.contentAccessLog.create.mockResolvedValueOnce({});

      const request = new NextRequest('http://localhost:22000/api/reader/library/entry-123/position', {
        method: 'POST',
        headers: { origin: 'http://localhost:22000' },
        body: JSON.stringify({ position: 5380, duration: 5400 }),
      });
      const response = await updatePosition(request, { params: Promise.resolve({ entryId: 'entry-123' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.completed).toBe(true);
    });
  });
});
