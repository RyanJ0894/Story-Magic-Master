/**
 * Tests for StoryScore service (lib/scoring/service.ts).
 *
 * Coverage: callScoringLLM, generateScore, getLatestScore, getScoreHistory,
 * deleteScore, compareScores.
 *
 * `prisma` is a module-level import in service.ts, mocked via vi.mock('@/lib/db').
 * `compareScores` is a pure function — no mocking needed.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { StoryScore } from '@/lib/scoring/types';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@/lib/logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const mockGenerateText = vi.fn();
vi.mock('ai', () => ({ generateText: (...args: unknown[]) => mockGenerateText(...args) }));

const mockResolveModel = vi.fn().mockReturnValue('mock-model');
vi.mock('@/lib/ai/providers', () => ({
  resolveModel: (...args: unknown[]) => mockResolveModel(...args),
  MODELS: { PRODUCTION: 'claude-sonnet-4-6', BATCH: 'gemini-2.0-flash' },
}));

const mockBuildScoringPrompt = vi.fn().mockReturnValue('SCORE THIS SCRIPT');
const mockBuildCalibrationExamples = vi.fn().mockResolvedValue('CALIBRATION EXAMPLES');
const mockValidateLLMResponse = vi.fn().mockReturnValue(true);
vi.mock('@/lib/scoring/prompts', () => ({
  buildScoringPrompt: (...args: unknown[]) => mockBuildScoringPrompt(...args),
  buildCalibrationExamples: (...args: unknown[]) => mockBuildCalibrationExamples(...args),
  validateLLMResponse: (v: unknown) => mockValidateLLMResponse(v),
}));

const mockChunkScript = vi.fn().mockImplementation((text: string) => ({
  text,
  wasChunked: false,
}));
vi.mock('@/lib/scoring/chunk-script', () => ({
  chunkScriptForScoring: (text: unknown) => mockChunkScript(text),
}));

const mockStoryScoreCreate = vi.fn();
const mockStoryScoreFindFirst = vi.fn();
const mockStoryScoreFindMany = vi.fn();
const mockStoryScoreDelete = vi.fn();
const mockQueryRaw = vi.fn();

vi.mock('@/lib/db', () => ({
  prisma: {
    storyScore: {
      create: (...args: unknown[]) => mockStoryScoreCreate(...args),
      findFirst: (...args: unknown[]) => mockStoryScoreFindFirst(...args),
      findMany: (...args: unknown[]) => mockStoryScoreFindMany(...args),
      delete: (...args: unknown[]) => mockStoryScoreDelete(...args),
    },
    $queryRaw: (...args: unknown[]) => mockQueryRaw(...args),
  },
}));

// ── Import after mocks ────────────────────────────────────────────────────────

const {
  callScoringLLM,
  generateScore,
  getLatestScore,
  getScoreHistory,
  deleteScore,
  compareScores,
} = await import('@/lib/scoring/service');

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ALL_DIMENSIONS = [
  'premiseOriginality',
  'loglineClarity',
  'commercialViability',
  'threeActIntegrity',
  'pacingMomentum',
  'stakesEscalation',
  'protagonistArc',
  'supportingCast',
  'castability',
  'dialogueQuality',
  'visualStorytelling',
  'technicalExecution',
] as const;

function makeLLMResponse(score = 7) {
  const dimensions: Record<string, { score: number; reasoning: string }> = {};
  for (const key of ALL_DIMENSIONS) {
    dimensions[key] = { score, reasoning: `Reasoning for ${key}` };
  }
  return { dimensions, strengths: ['Strong premise'], weaknesses: ['Weak ending'], confidence: 0.85 };
}

function makePrismaScoreRow(projectId = 'proj-1') {
  return {
    id: 'score-1',
    projectId,
    version: 1,
    premiseOriginality: 7,
    premiseOriginalityReasoning: 'r',
    loglineClarity: 7,
    loglineClarityReasoning: 'r',
    commercialViability: 7,
    commercialViabilityReasoning: 'r',
    threeActIntegrity: 7,
    threeActIntegrityReasoning: 'r',
    pacingMomentum: 7,
    pacingMomentumReasoning: 'r',
    stakesEscalation: 7,
    stakesEscalationReasoning: 'r',
    protagonistArc: 7,
    protagonistArcReasoning: 'r',
    supportingCast: 7,
    supportingCastReasoning: 'r',
    castability: 7,
    castabilityReasoning: 'r',
    dialogueQuality: 7,
    dialogueQualityReasoning: 'r',
    visualStorytelling: 7,
    visualStorytellingReasoning: 'r',
    technicalExecution: 7,
    technicalExecutionReasoning: 'r',
    conceptScore: 7,
    structureScore: 7,
    characterScore: 7,
    craftScore: 7,
    overallScore: 7,
    rating: 'CONSIDER',
    strengths: ['Strong premise'],
    weaknesses: ['Weak ending'],
    confidence: 0.85,
    modelVersion: 'claude-sonnet-4-6',
    createdAt: new Date('2026-01-01'),
  };
}

function makeStoryScore(overallScore = 7.0): StoryScore {
  const dimensions = {} as StoryScore['dimensions'];
  for (const key of ALL_DIMENSIONS) {
    dimensions[key] = { score: overallScore, reasoning: 'r' };
  }
  return {
    id: 'score-1',
    projectId: 'proj-1',
    version: 1,
    dimensions,
    categoryScores: { concept: overallScore, structure: overallScore, character: overallScore, craft: overallScore },
    overallScore,
    rating: 'CONSIDER',
    strengths: ['good'],
    weaknesses: ['bad'],
    confidence: 0.8,
    modelVersion: 'claude-sonnet-4-6',
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

// =============================================================================
// callScoringLLM
// =============================================================================

describe('callScoringLLM', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateLLMResponse.mockReturnValue(true);
    mockChunkScript.mockImplementation((text: string) => ({ text, wasChunked: false }));
  });

  it('returns parsed dimensions, strengths, weaknesses, confidence', async () => {
    const llmResponse = makeLLMResponse(8);
    mockGenerateText.mockResolvedValue({ text: JSON.stringify(llmResponse) });

    const result = await callScoringLLM('INT. OFFICE - DAY\nA scene.');

    expect(result.dimensions.premiseOriginality.score).toBe(8);
    expect(result.strengths).toEqual(['Strong premise']);
    expect(result.confidence).toBe(0.85);
  });

  it('extracts JSON from text with preamble (code fence wrapping)', async () => {
    const llmResponse = makeLLMResponse(7);
    const wrappedText = `Here is the analysis:\n\`\`\`json\n${JSON.stringify(llmResponse)}\n\`\`\``;
    mockGenerateText.mockResolvedValue({ text: wrappedText });

    const result = await callScoringLLM('script text');

    expect(result.dimensions.premiseOriginality.score).toBe(7);
  });

  it('throws when LLM returns invalid JSON', async () => {
    mockGenerateText.mockResolvedValue({ text: 'not json at all' });

    await expect(callScoringLLM('script')).rejects.toThrow('Failed to parse LLM response');
  });

  it('throws when validateLLMResponse returns false', async () => {
    mockValidateLLMResponse.mockReturnValue(false);
    mockGenerateText.mockResolvedValue({ text: '{"foo": "bar"}' });

    await expect(callScoringLLM('script')).rejects.toThrow('does not match expected schema');
  });

  it('logs when script is chunked', async () => {
    mockChunkScript.mockReturnValue({ text: 'chunked text', wasChunked: true });
    mockGenerateText.mockResolvedValue({ text: JSON.stringify(makeLLMResponse()) });

    await callScoringLLM('very long script');

    const { log } = await import('@/lib/logger');
    expect(log.info).toHaveBeenCalledWith(expect.stringContaining('chunked'), expect.any(Object));
  });
});

// =============================================================================
// generateScore
// =============================================================================

describe('generateScore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateLLMResponse.mockReturnValue(true);
    mockChunkScript.mockImplementation((text: string) => ({ text, wasChunked: false }));
    mockGenerateText.mockResolvedValue({ text: JSON.stringify(makeLLMResponse()) });
    mockQueryRaw.mockResolvedValue([{ get_next_score_version: 1 }]);
    mockStoryScoreCreate.mockResolvedValue(makePrismaScoreRow());
  });

  it('returns a StoryScore with the correct projectId', async () => {
    const score = await generateScore('proj-1', 'script text');

    expect(score.projectId).toBe('proj-1');
    expect(score.version).toBe(1);
    expect(score.overallScore).toBeTypeOf('number');
  });

  it('persists the score to the database via storyScore.create', async () => {
    await generateScore('proj-1', 'script text');

    expect(mockStoryScoreCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ projectId: 'proj-1', version: 1 }),
      }),
    );
  });

  it('uses version from $queryRaw result', async () => {
    mockQueryRaw.mockResolvedValue([{ get_next_score_version: 3 }]);

    await generateScore('proj-1', 'script text');

    // The version sourced from $queryRaw must be written into the DB row
    expect(mockStoryScoreCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ version: 3 }) }),
    );
  });

  it('falls back to version 1 when $queryRaw returns empty', async () => {
    mockQueryRaw.mockResolvedValue([]);

    const score = await generateScore('proj-1', 'script text');

    expect(score.version).toBe(1);
  });

  it('throws when storyScore.create fails', async () => {
    mockStoryScoreCreate.mockRejectedValue(new Error('DB error'));

    await expect(generateScore('proj-1', 'script text')).rejects.toThrow('Failed to save score');
  });
});

// =============================================================================
// getLatestScore
// =============================================================================

describe('getLatestScore', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns null when no score exists', async () => {
    mockStoryScoreFindFirst.mockResolvedValue(null);

    const result = await getLatestScore('proj-1');

    expect(result).toBeNull();
  });

  it('returns a StoryScore for an existing project', async () => {
    mockStoryScoreFindFirst.mockResolvedValue(makePrismaScoreRow());

    const result = await getLatestScore('proj-1');

    expect(result).not.toBeNull();
    expect(result!.projectId).toBe('proj-1');
  });

  it('queries by projectId ordered by version desc', async () => {
    mockStoryScoreFindFirst.mockResolvedValue(null);

    await getLatestScore('proj-1');

    expect(mockStoryScoreFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { projectId: 'proj-1' },
        orderBy: { version: 'desc' },
      }),
    );
  });
});

// =============================================================================
// getScoreHistory
// =============================================================================

describe('getScoreHistory', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns empty array when no scores exist', async () => {
    mockStoryScoreFindMany.mockResolvedValue([]);

    const result = await getScoreHistory('proj-1');

    expect(result).toEqual([]);
  });

  it('returns all versions as StoryScore objects', async () => {
    mockStoryScoreFindMany.mockResolvedValue([
      makePrismaScoreRow(),
      { ...makePrismaScoreRow(), id: 'score-2', version: 2 },
    ]);

    const result = await getScoreHistory('proj-1');

    expect(result).toHaveLength(2);
    expect(result[0].projectId).toBe('proj-1');
  });
});

// =============================================================================
// deleteScore
// =============================================================================

describe('deleteScore', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('calls prisma.storyScore.delete with the given id', async () => {
    mockStoryScoreDelete.mockResolvedValue({ id: 'score-1' });

    await deleteScore('score-1');

    expect(mockStoryScoreDelete).toHaveBeenCalledWith({ where: { id: 'score-1' } });
  });

  it('throws a descriptive error when delete fails', async () => {
    mockStoryScoreDelete.mockRejectedValue(new Error('Record not found'));

    await expect(deleteScore('missing-id')).rejects.toThrow('Failed to delete score');
  });
});

// =============================================================================
// compareScores — pure function, no mocks needed
// =============================================================================

describe('compareScores', () => {
  it('correctly classifies improved, declined, and unchanged dimensions', () => {
    const old = makeStoryScore(5);
    const next = makeStoryScore(5);

    // Improve 3 dimensions, decline 2, leave rest unchanged
    next.dimensions.premiseOriginality.score = 8;
    next.dimensions.loglineClarity.score = 9;
    next.dimensions.threeActIntegrity.score = 7;
    next.dimensions.commercialViability.score = 3;
    next.dimensions.pacingMomentum.score = 2;

    const result = compareScores(old, next);

    expect(result.improved).toContain('premiseOriginality');
    expect(result.improved).toContain('loglineClarity');
    expect(result.improved).toContain('threeActIntegrity');
    expect(result.declined).toContain('commercialViability');
    expect(result.declined).toContain('pacingMomentum');
    expect(result.unchanged).toHaveLength(ALL_DIMENSIONS.length - 5);
  });

  it('computes correct overallChange', () => {
    const old = makeStoryScore(5.0);
    const next = makeStoryScore(7.5);

    const result = compareScores(old, next);

    expect(result.overallChange).toBeCloseTo(2.5);
  });

  it('returns all dimensions as unchanged when scores are identical', () => {
    const score = makeStoryScore(7.0);
    const result = compareScores(score, { ...score });

    expect(result.improved).toHaveLength(0);
    expect(result.declined).toHaveLength(0);
    expect(result.unchanged).toHaveLength(ALL_DIMENSIONS.length);
  });
});
