/**
 * Tests for Story Adviser Service
 *
 * lib/adviser/service.ts — generateSuggestions, getSuggestions, respondToSuggestion
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockChatCreate = vi.fn();
const mockGetOpenAI = vi.fn(() => ({
  chat: { completions: { create: mockChatCreate } },
}));
vi.mock('@/lib/ai/openai', () => ({ getOpenAI: () => mockGetOpenAI() }));

const mockPrisma = {
  storyScore: { findFirst: vi.fn() },
  suggestion: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  },
  rewrite: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
    update: vi.fn(),
  },
  $queryRaw: vi.fn(),
};
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));

const mockGetLatestScore = vi.fn();
vi.mock('@/lib/scoring', () => ({ getLatestScore: (...args: unknown[]) => mockGetLatestScore(...args) }));

vi.mock('@/lib/logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Prompts — real implementations are not critical to unit-test here;
// mock to return a stable string and a truthy validate function.
vi.mock('@/lib/adviser/prompts', () => ({
  buildSuggestionPrompt: vi.fn(() => 'mocked-suggestion-prompt'),
  buildRewritePrompt: vi.fn(() => 'mocked-rewrite-prompt'),
  validateSuggestionsResponse: vi.fn((parsed: unknown) => {
    return (
      parsed !== null &&
      typeof parsed === 'object' &&
      'suggestions' in (parsed as object) &&
      Array.isArray((parsed as { suggestions: unknown }).suggestions)
    );
  }),
  validateRewriteResponse: vi.fn((parsed: unknown) => {
    return (
      parsed !== null &&
      typeof parsed === 'object' &&
      'rewrites' in (parsed as object) &&
      Array.isArray((parsed as { rewrites: unknown }).rewrites)
    );
  }),
  findExcerptInScript: vi.fn(() => null),
}));

// ── Imports after mocks ───────────────────────────────────────────────────────

const {
  generateSuggestions,
  getSuggestions,
  getSuggestion,
  respondToSuggestion,
} = await import('@/lib/adviser/service');

// ── Fixtures ──────────────────────────────────────────────────────────────────

const PROJECT_ID = '550e8400-e29b-41d4-a716-446655440002';
const SUGGESTION_ID = '550e8400-e29b-41d4-a716-446655440003';

const MOCK_SUGGESTION_ROW = {
  id: SUGGESTION_ID,
  projectId: PROJECT_ID,
  scoreId: null,
  startLine: 10,
  endLine: 15,
  startChar: null,
  endChar: null,
  excerpt: 'She ran into the room.',
  sceneNumber: null,
  sceneHeading: null,
  category: 'dialogue',
  severity: 'minor',
  title: 'Weak action',
  explanation: 'The action is passive.',
  suggestion: 'Make it active.',
  status: 'pending',
  userFeedback: null,
  confidence: 0.8,
  createdAt: new Date('2026-01-01'),
  respondedAt: null,
};

const LLM_SUGGESTIONS_RESPONSE = {
  suggestions: [
    {
      startLine: 10,
      endLine: 15,
      excerpt: 'She ran into the room.',
      category: 'dialogue',
      severity: 'minor',
      title: 'Weak action',
      explanation: 'The action is passive.',
      suggestion: 'Make it active.',
      confidence: 0.8,
    },
  ],
};

// =============================================================================
// generateSuggestions
// =============================================================================

describe('generateSuggestions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetLatestScore.mockResolvedValue(null);
    mockPrisma.suggestion.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.suggestion.create.mockResolvedValue(MOCK_SUGGESTION_ROW);
  });

  it('returns suggestions from LLM response', async () => {
    mockChatCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(LLM_SUGGESTIONS_RESPONSE) } }],
    });

    const suggestions = await generateSuggestions(PROJECT_ID, 'INT. ROOM - DAY\nShe ran into the room.');

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].title).toBe('Weak action');
    expect(suggestions[0].status).toBe('pending');
  });

  it('clears existing pending suggestions before inserting new ones', async () => {
    mockChatCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(LLM_SUGGESTIONS_RESPONSE) } }],
    });

    await generateSuggestions(PROJECT_ID, 'script text');

    expect(mockPrisma.suggestion.deleteMany).toHaveBeenCalledWith({
      where: { projectId: PROJECT_ID, status: 'pending' },
    });
  });

  it('throws when LLM returns no content', async () => {
    mockChatCreate.mockResolvedValue({ choices: [{ message: { content: null } }] });

    await expect(generateSuggestions(PROJECT_ID, 'script')).rejects.toThrow(
      'No response from LLM'
    );
  });

  it('throws when LLM response is not valid JSON', async () => {
    mockChatCreate.mockResolvedValue({
      choices: [{ message: { content: 'not json' } }],
    });

    await expect(generateSuggestions(PROJECT_ID, 'script')).rejects.toThrow(
      'Failed to parse LLM response as JSON'
    );
  });

  it('throws when LLM JSON does not match expected schema', async () => {
    mockChatCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ wrong: 'schema' }) } }],
    });

    await expect(generateSuggestions(PROJECT_ID, 'script')).rejects.toThrow(
      'LLM response does not match expected schema'
    );
  });

  it('uses storyScore context when available', async () => {
    mockGetLatestScore.mockResolvedValue({ id: 'score-1', overallScore: 72 });
    mockChatCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(LLM_SUGGESTIONS_RESPONSE) } }],
    });

    await generateSuggestions(PROJECT_ID, 'script text');

    // getLatestScore is called; verify it was invoked for context
    expect(mockGetLatestScore).toHaveBeenCalledWith(PROJECT_ID);
  });

  it('skips a suggestion gracefully when DB insert throws', async () => {
    mockChatCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(LLM_SUGGESTIONS_RESPONSE) } }],
    });
    mockPrisma.suggestion.create.mockRejectedValue(new Error('DB error'));

    const suggestions = await generateSuggestions(PROJECT_ID, 'script text');

    // The insert failed but we don't throw — we skip and return empty
    expect(suggestions).toEqual([]);
  });
});

// =============================================================================
// getSuggestions
// =============================================================================

describe('getSuggestions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns all suggestions for a project', async () => {
    mockPrisma.suggestion.findMany.mockResolvedValue([MOCK_SUGGESTION_ROW]);

    const result = await getSuggestions(PROJECT_ID);

    expect(result).toHaveLength(1);
    expect(result[0].projectId).toBe(PROJECT_ID);
  });

  it('filters by status when provided', async () => {
    mockPrisma.suggestion.findMany.mockResolvedValue([]);

    await getSuggestions(PROJECT_ID, { status: 'accepted' });

    expect(mockPrisma.suggestion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'accepted' }),
      })
    );
  });

  it('filters by category when provided', async () => {
    mockPrisma.suggestion.findMany.mockResolvedValue([]);

    await getSuggestions(PROJECT_ID, { category: 'dialogue' });

    expect(mockPrisma.suggestion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ category: 'dialogue' }),
      })
    );
  });

  it('returns empty array when no suggestions exist', async () => {
    mockPrisma.suggestion.findMany.mockResolvedValue([]);

    const result = await getSuggestions(PROJECT_ID);
    expect(result).toEqual([]);
  });
});

// =============================================================================
// getSuggestion
// =============================================================================

describe('getSuggestion', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns suggestion by ID', async () => {
    mockPrisma.suggestion.findFirst.mockResolvedValue(MOCK_SUGGESTION_ROW);

    const result = await getSuggestion(SUGGESTION_ID);

    expect(result).not.toBeNull();
    expect(result?.title).toBe('Weak action');
  });

  it('returns null when not found', async () => {
    mockPrisma.suggestion.findFirst.mockResolvedValue(null);

    const result = await getSuggestion('non-existent-id');
    expect(result).toBeNull();
  });
});

// =============================================================================
// respondToSuggestion
// =============================================================================

describe('respondToSuggestion', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates status to accepted', async () => {
    mockPrisma.suggestion.update.mockResolvedValue({
      ...MOCK_SUGGESTION_ROW,
      status: 'accepted',
      respondedAt: new Date(),
    });

    const result = await respondToSuggestion(SUGGESTION_ID, 'accepted');

    expect(result.status).toBe('accepted');
    expect(mockPrisma.suggestion.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: SUGGESTION_ID },
        data: expect.objectContaining({ status: 'accepted' }),
      })
    );
  });

  it('updates status to rejected with feedback', async () => {
    mockPrisma.suggestion.update.mockResolvedValue({
      ...MOCK_SUGGESTION_ROW,
      status: 'rejected',
      userFeedback: 'Not relevant',
      respondedAt: new Date(),
    });

    const result = await respondToSuggestion(SUGGESTION_ID, 'rejected', 'Not relevant');

    expect(result.status).toBe('rejected');
    expect(mockPrisma.suggestion.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userFeedback: 'Not relevant' }),
      })
    );
  });

  it('throws wrapped error when DB update fails', async () => {
    mockPrisma.suggestion.update.mockRejectedValue(new Error('Row not found'));

    await expect(respondToSuggestion(SUGGESTION_ID, 'dismissed')).rejects.toThrow(
      'Failed to update suggestion: Row not found'
    );
  });
});
