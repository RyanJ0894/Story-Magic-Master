/**
 * Tests for GET /api/exchange
 * Browse public exchange listings (paginated, genre-filterable)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Prisma
const mockPrisma = {
  project: {
    findMany: vi.fn(),
    count: vi.fn(),
  },
};
vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

// Import after mocks
const { GET: getExchange } = await import('@/app/api/exchange/route');

// =============================================================================
// Helpers
// =============================================================================

function createRequest(
  url: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
  } = {}
): Request {
  return new Request(url, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      origin: 'http://localhost:22000',
      ...(options.headers || {}),
    },
  });
}

const mockListing = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  exchangeSlug: 'dark-room-550e84',
  name: 'Dark Room',
  exchangeTagline: 'A noir thriller set in the 1940s',
  exchangeGenre: 'thriller',
  exchangeListedAt: new Date('2026-01-10T12:00:00Z'),
  pageCount: 92,
  page1PreviewUrl: 'https://example.com/preview.jpg',
  userId: 'user_writer1',
  user: { id: 'user_writer1', fullName: 'Jane Doe', avatarUrl: null },
  _count: { scriptReviews: 3 },
};

const mockListing2 = {
  id: '660e8400-e29b-41d4-a716-446655440001',
  exchangeSlug: 'summer-lights-660e84',
  name: 'Summer Lights',
  exchangeTagline: 'A coming-of-age comedy',
  exchangeGenre: 'comedy',
  exchangeListedAt: new Date('2026-01-08T09:00:00Z'),
  pageCount: 105,
  page1PreviewUrl: null,
  userId: 'user_writer2',
  user: { id: 'user_writer2', fullName: 'John Smith', avatarUrl: null },
  _count: { scriptReviews: 0 },
};

// =============================================================================
// Tests
// =============================================================================

describe('GET /api/exchange', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns paginated listings with correct shape', async () => {
    mockPrisma.project.findMany
      .mockResolvedValueOnce([mockListing, mockListing2]) // listings query
      .mockResolvedValueOnce([                             // genres query
        { exchangeGenre: 'thriller' },
        { exchangeGenre: 'comedy' },
      ]);
    mockPrisma.project.count.mockResolvedValueOnce(2);

    const request = createRequest('http://localhost:22000/api/exchange');
    const response = await getExchange(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.listings).toHaveLength(2);

    const first = data.listings[0];
    expect(first.id).toBe(mockListing.id);
    expect(first.slug).toBe('dark-room-550e84');
    expect(first.name).toBe('Dark Room');
    expect(first.tagline).toBe('A noir thriller set in the 1940s');
    expect(first.genre).toBe('thriller');
    expect(first.reviewCount).toBe(3);
    expect(first.hasPreview).toBe(true);
    expect(first.writer).toEqual({ id: 'user_writer1', fullName: 'Jane Doe', avatarUrl: null });

    expect(data.listings[1].hasPreview).toBe(false);
  });

  it('returns correct pagination metadata', async () => {
    mockPrisma.project.findMany
      .mockResolvedValueOnce([mockListing])
      .mockResolvedValueOnce([{ exchangeGenre: 'thriller' }]);
    mockPrisma.project.count.mockResolvedValueOnce(45);

    const request = createRequest('http://localhost:22000/api/exchange?page=3');
    const response = await getExchange(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.pagination.page).toBe(3);
    expect(data.pagination.pageSize).toBe(20);
    expect(data.pagination.total).toBe(45);
    expect(data.pagination.totalPages).toBe(3); // ceil(45/20)
  });

  it('defaults to page 1 when no page param', async () => {
    mockPrisma.project.findMany
      .mockResolvedValueOnce([mockListing])
      .mockResolvedValueOnce([]);
    mockPrisma.project.count.mockResolvedValueOnce(1);

    const request = createRequest('http://localhost:22000/api/exchange');
    const response = await getExchange(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.pagination.page).toBe(1);

    // Verify prisma was called with skip=0 (page 1)
    const findManyCall = mockPrisma.project.findMany.mock.calls[0][0];
    expect(findManyCall.skip).toBe(0);
  });

  it('filters by genre query param', async () => {
    mockPrisma.project.findMany
      .mockResolvedValueOnce([mockListing])
      .mockResolvedValueOnce([{ exchangeGenre: 'thriller' }]);
    mockPrisma.project.count.mockResolvedValueOnce(1);

    const request = createRequest('http://localhost:22000/api/exchange?genre=thriller');
    const response = await getExchange(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.listings).toHaveLength(1);
    expect(data.listings[0].genre).toBe('thriller');

    // Verify the where clause includes genre filter
    const firstFindManyCall = mockPrisma.project.findMany.mock.calls[0][0];
    expect(firstFindManyCall.where.exchangeGenre).toBe('thriller');
  });

  it('returns empty listings when none are public', async () => {
    mockPrisma.project.findMany
      .mockResolvedValueOnce([])  // no listings
      .mockResolvedValueOnce([]); // no genres
    mockPrisma.project.count.mockResolvedValueOnce(0);

    const request = createRequest('http://localhost:22000/api/exchange');
    const response = await getExchange(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.listings).toEqual([]);
    expect(data.pagination.total).toBe(0);
    expect(data.pagination.totalPages).toBe(0);
  });

  it('returns genres list from distinct query', async () => {
    mockPrisma.project.findMany
      .mockResolvedValueOnce([]) // listings
      .mockResolvedValueOnce([  // genres
        { exchangeGenre: 'drama' },
        { exchangeGenre: 'thriller' },
        { exchangeGenre: 'comedy' },
      ]);
    mockPrisma.project.count.mockResolvedValueOnce(0);

    const request = createRequest('http://localhost:22000/api/exchange');
    const response = await getExchange(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.genres).toEqual(['drama', 'thriller', 'comedy']);
  });

  it('filters out null genres from the genres list', async () => {
    mockPrisma.project.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { exchangeGenre: 'drama' },
        { exchangeGenre: null },
        { exchangeGenre: 'sci-fi' },
      ]);
    mockPrisma.project.count.mockResolvedValueOnce(0);

    const request = createRequest('http://localhost:22000/api/exchange');
    const response = await getExchange(request);
    const data = await response.json();

    expect(data.genres).toEqual(['drama', 'sci-fi']);
    expect(data.genres).not.toContain(null);
  });
});
