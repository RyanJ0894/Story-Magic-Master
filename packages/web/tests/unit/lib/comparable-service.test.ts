/**
 * Tests for Comparable Scripts Service
 *
 * lib/comparable/service.ts  — searchComparables, searchComparablesByLogline
 * lib/comparable/embeddings.ts — generateEmbedding, cosineSimilarity, toPgvectorFormat
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockEmbeddingsCreate = vi.fn();
const mockGetOpenAI = vi.fn(() => ({
  embeddings: { create: mockEmbeddingsCreate },
}));
vi.mock('@/lib/ai/openai', () => ({ getOpenAI: () => mockGetOpenAI() }));

const mockPrisma = {
  storyScore: { findFirst: vi.fn() },
  project: { findFirst: vi.fn() },
  $queryRaw: vi.fn(),
};
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));

vi.mock('@/lib/logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ── Imports after mocks ───────────────────────────────────────────────────────

const {
  searchComparables,
  searchComparablesByLogline,
} = await import('@/lib/comparable/service');

const {
  generateEmbedding,
  cosineSimilarity,
  toPgvectorFormat,
} = await import('@/lib/comparable/embeddings');

// ── Fixtures ──────────────────────────────────────────────────────────────────

const PROJECT_ID = '550e8400-e29b-41d4-a716-446655440001';
const FAKE_EMBEDDING = Array.from({ length: 10 }, (_, i) => i * 0.1);

const RAW_ROW = {
  id: 'corp-001',
  title: 'Inception',
  logline: 'A thief enters dreams to plant an idea.',
  genre: ['Thriller', 'Sci-Fi'],
  tone: 'dark',
  production_status: 'produced',
  studio: 'Warner Bros',
  budget_tier: 'high',
  box_office_millions: 836,
  similarity: 0.91,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function setupEmbeddingMock() {
  mockEmbeddingsCreate.mockResolvedValue({
    data: [{ embedding: FAKE_EMBEDDING }],
  });
}

// =============================================================================
// generateEmbedding
// =============================================================================

describe('generateEmbedding', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns embedding array from OpenAI', async () => {
    setupEmbeddingMock();
    const result = await generateEmbedding('A hero on a quest');
    expect(result).toEqual(FAKE_EMBEDDING);
    expect(mockEmbeddingsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'text-embedding-3-small', input: 'A hero on a quest' })
    );
  });

  it('throws for empty text', async () => {
    await expect(generateEmbedding('   ')).rejects.toThrow('Cannot generate embedding for empty text');
    expect(mockEmbeddingsCreate).not.toHaveBeenCalled();
  });
});

// =============================================================================
// cosineSimilarity
// =============================================================================

describe('cosineSimilarity', () => {
  it('returns 1 for identical vectors', () => {
    const v = [1, 0, 0];
    expect(cosineSimilarity(v, v)).toBeCloseTo(1.0);
  });

  it('returns 0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it('returns 0 for zero vectors', () => {
    expect(cosineSimilarity([0, 0], [0, 0])).toBe(0);
  });

  it('throws when dimensions differ', () => {
    expect(() => cosineSimilarity([1, 2], [1, 2, 3])).toThrow('same dimension');
  });
});

// =============================================================================
// toPgvectorFormat
// =============================================================================

describe('toPgvectorFormat', () => {
  it('formats an embedding as pgvector string', () => {
    expect(toPgvectorFormat([0.1, 0.2, 0.3])).toBe('[0.1,0.2,0.3]');
  });
});

// =============================================================================
// searchComparables
// =============================================================================

describe('searchComparables', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupEmbeddingMock();
  });

  it('returns comparables when score + project + DB all resolve', async () => {
    mockPrisma.storyScore.findFirst.mockResolvedValue({
      loglineClarityReasoning: 'A detective investigates a heist.',
    });
    mockPrisma.project.findFirst.mockResolvedValue({
      name: 'Test Film',
      description: 'A detective story',
    });
    mockPrisma.$queryRaw.mockResolvedValue([RAW_ROW]);

    const { comparables, queryLogline } = await searchComparables(PROJECT_ID);

    expect(comparables).toHaveLength(1);
    expect(comparables[0].title).toBe('Inception');
    expect(comparables[0].similarity).toBe(0.91);
    expect(comparables[0].productionStatus).toBe('produced');
    expect(queryLogline).toBe('A detective story');
  });

  it('falls back to project name when description is missing', async () => {
    mockPrisma.storyScore.findFirst.mockResolvedValue({ loglineClarityReasoning: '' });
    mockPrisma.project.findFirst.mockResolvedValue({ name: 'My Movie', description: null });
    mockPrisma.$queryRaw.mockResolvedValue([]);

    const { queryLogline } = await searchComparables(PROJECT_ID);
    expect(queryLogline).toBe('My Movie');
  });

  it('returns empty array when queryLogline is blank', async () => {
    mockPrisma.storyScore.findFirst.mockResolvedValue({ loglineClarityReasoning: '' });
    mockPrisma.project.findFirst.mockResolvedValue({ name: '', description: '' });

    const { comparables, queryLogline } = await searchComparables(PROJECT_ID);

    expect(comparables).toEqual([]);
    expect(queryLogline).toBe('');
    expect(mockEmbeddingsCreate).not.toHaveBeenCalled();
  });

  it('throws when no score found for project', async () => {
    mockPrisma.storyScore.findFirst.mockResolvedValue(null);

    await expect(searchComparables(PROJECT_ID)).rejects.toThrow(
      'No score found for project'
    );
  });

  it('respects limit option passed to DB query', async () => {
    mockPrisma.storyScore.findFirst.mockResolvedValue({ loglineClarityReasoning: 'Query text' });
    mockPrisma.project.findFirst.mockResolvedValue({ name: 'N', description: 'Query text' });
    mockPrisma.$queryRaw.mockResolvedValue([]);

    await searchComparables(PROJECT_ID, { limit: 3 });

    // $queryRaw is a tagged template — called once
    expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1);
  });
});

// =============================================================================
// searchComparablesByLogline
// =============================================================================

describe('searchComparablesByLogline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupEmbeddingMock();
  });

  it('returns mapped comparables for a valid logline', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([RAW_ROW]);

    const results = await searchComparablesByLogline('A detective heist thriller');

    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('Inception');
    expect(results[0].genre).toEqual(['Thriller', 'Sci-Fi']);
  });

  it('returns empty array for blank logline without calling OpenAI', async () => {
    const results = await searchComparablesByLogline('   ');

    expect(results).toEqual([]);
    expect(mockEmbeddingsCreate).not.toHaveBeenCalled();
  });

  it('maps null DB fields correctly', async () => {
    const rowWithNulls = {
      ...RAW_ROW,
      logline: null,
      tone: null,
      production_status: null,
      studio: null,
      budget_tier: null,
      box_office_millions: null,
    };
    mockPrisma.$queryRaw.mockResolvedValue([rowWithNulls]);

    const results = await searchComparablesByLogline('Some story');

    expect(results[0].logline).toBeNull();
    expect(results[0].tone).toBeNull();
    expect(results[0].productionStatus).toBeNull();
  });
});
