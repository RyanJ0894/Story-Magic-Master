/**
 * Tests for Script Score Service
 * Validates quickScore, analyzeScript, and the internal analyzeWithRetry logic.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks - declared before any import that triggers module load
// ---------------------------------------------------------------------------
//
// Note: post-2026-06-08 the service routes through llm-client's
// `generateStructuredOutput` / `runAgentLoop` instead of calling the AI SDK
// directly. Failover/retry across providers is the llm-client's job and is
// covered by its own tests — this file mocks llm-client and only verifies
// the service's data flow + error propagation.

vi.mock('../lib/llm-client.js', () => ({
  generateStructuredOutput: vi.fn(),
  runAgentLoop: vi.fn(),
}));

vi.mock('../lib/logger.js', () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    generation: vi.fn(),
  },
}));

// Stub out prompt imports so the module loads without file I/O errors
vi.mock('./prompts/script-score-prompts.js', () => ({
  SCORING_CALIBRATION: 'CALIBRATION',
  WRITING_QUALITY_PROMPT: 'WRITING_QUALITY',
  STORY_QUALITY_PROMPT: 'STORY_QUALITY',
  COMMERCIAL_VIABILITY_PROMPT: 'COMMERCIAL_VIABILITY',
  PRODUCTION_LIKELIHOOD_PROMPT: 'PRODUCTION_LIKELIHOOD',
  DIALOGUE_ANALYSIS_PROMPT: 'DIALOGUE_ANALYSIS',
  STRUCTURAL_ANALYSIS_PROMPT: 'STRUCTURAL_ANALYSIS',
  SYNTHESIS_PROMPT: 'SYNTHESIS',
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { quickScore, analyzeScript } from './script-score-service.js';
import { generateStructuredOutput, runAgentLoop } from '../lib/llm-client.js';

// Local aliases so the existing test bodies can keep using the old names —
// the change is purely which function under the hood is mocked.
const generateObject = generateStructuredOutput as unknown as ReturnType<typeof vi.fn>;
const generateText = runAgentLoop as unknown as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Fixture factories
// ---------------------------------------------------------------------------

function makeCategoryScore() {
  return {
    score: 7,
    confidence: 0.85,
    summary: 'Solid work.',
    strengths: ['Distinct voices'],
    weaknesses: ['Slow second act'],
    suggestions: ['Tighten act 2'],
  };
}

function makeQuickScoreObject() {
  return {
    overall_score: 7,
    writing: 7,
    story: 7,
    commercial: 6,
    production: 6,
    verdict: 'consider' as const,
    one_liner: 'A taut thriller with strong characters.',
    top_strength: 'Crisp dialogue',
    top_weakness: 'Slow second act',
    genre: ['thriller'],
  };
}

function makeWritingQuality() {
  const cat = makeCategoryScore();
  return {
    overall: cat,
    dialogue: { ...cat, subtext_usage: 7, voice_distinction: 8, naturalism: 7, economy: 7 },
    action_lines: { ...cat, clarity: 8, brevity: 7, voice: 7 },
    formatting: { ...cat, industry_standard: 9, white_space: 8, readability: 8 },
  };
}

function makeStoryQuality() {
  const cat = makeCategoryScore();
  return {
    overall: cat,
    premise: { ...cat, originality: 7, clarity: 8, hook: 7 },
    structure: { ...cat, three_act: 7, pacing: 6, beat_sheet: 7, turning_points: 7 },
    characters: { ...cat, protagonist_clarity: 8, antagonist_strength: 7, arc: 7, supporting_cast: 6, motivation: 8 },
    conflict: { ...cat, central_conflict: 8, stakes: 7, escalation: 7, resolution: 7 },
    theme: { ...cat, presence: 7, integration: 7, resonance: 7 },
  };
}

function makeCommercialViability() {
  const cat = makeCategoryScore();
  return {
    overall: cat,
    market_fit: { ...cat, genre_clarity: 8, target_audience: 7, trend_alignment: 6, comparables: ['Se7en', 'Sicario'] },
    producibility: {
      ...cat,
      budget_tier: 'medium' as const,
      location_feasibility: 7,
      cast_requirements: 6,
      vfx_demands: 5,
      period_setting: false,
    },
    platform_fit: { theatrical: 7, streaming: 8, limited_series: 5, international: 6 },
    sales_hooks: {
      ...cat,
      logline_strength: 7,
      poster_moment: true,
      trailer_beats: 7,
      word_of_mouth: 7,
    },
  };
}

function makeProductionLikelihood() {
  const cat = makeCategoryScore();
  return {
    overall: cat,
    execution_readiness: { ...cat, script_polish: 7, coverage_ready: 7, director_attachment: 5 },
    industry_factors: { ...cat, diversity_inclusion: 6, cultural_relevance: 7, controversy_risk: 8, awards_potential: 6 },
    practical_considerations: {
      page_count: 105,
      estimated_runtime_minutes: 100,
      speaking_roles: 12,
      locations_count: 8,
      major_set_pieces: 3,
    },
  };
}

function makeSynthesis() {
  return {
    overall_score: 7,
    coverage_verdict: 'consider' as const,
    executive_summary: {
      one_liner: 'A taut thriller.',
      top_strengths: ['Strong protagonist'],
      critical_weaknesses: ['Pacing issues'],
      comparison_titles: ['Se7en'],
      ideal_for: ['Streaming platforms'],
    },
    improvement_roadmap: [
      {
        priority: 'high' as const,
        area: 'Structure',
        issue: 'Slow second act',
        recommendation: 'Compress act 2 by 10 pages',
        effort: 'moderate_revision' as const,
      },
    ],
    logline: 'A detective hunts a serial killer through a city of sin.',
    genre: ['thriller', 'crime'],
  };
}

const SAMPLE_SCRIPT = `
INT. POLICE STATION - DAY

DETECTIVE MILLS
(slamming folder)
What is in the box?!

DETECTIVE SOMERSET
Mills, calm down.
`.trim();

// ---------------------------------------------------------------------------
// Tests: quickScore
// ---------------------------------------------------------------------------

describe('quickScore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a score object with all expected fields', async () => {
    vi.mocked(generateObject).mockResolvedValueOnce(makeQuickScoreObject() as any);

    const result = await quickScore(SAMPLE_SCRIPT, 'Se7en');

    expect(result).toMatchObject({
      overall_score: expect.any(Number),
      writing: expect.any(Number),
      story: expect.any(Number),
      commercial: expect.any(Number),
      production: expect.any(Number),
      verdict: expect.any(String),
      one_liner: expect.any(String),
      top_strength: expect.any(String),
      top_weakness: expect.any(String),
      genre: expect.any(Array),
      title: 'Se7en',
      page_count: expect.any(Number),
    });
  });

  it('overall_score is between 1 and 10', async () => {
    vi.mocked(generateObject).mockResolvedValueOnce(makeQuickScoreObject() as any);

    const result = await quickScore(SAMPLE_SCRIPT);

    expect(result.overall_score).toBeGreaterThanOrEqual(1);
    expect(result.overall_score).toBeLessThanOrEqual(10);
  });

  it('uses "Untitled" as default title when none is provided', async () => {
    vi.mocked(generateObject).mockResolvedValueOnce(makeQuickScoreObject() as any);

    const result = await quickScore(SAMPLE_SCRIPT);

    expect(result.title).toBe('Untitled');
  });

  it('calculates page_count from word count', async () => {
    // ~750 words → ~3 pages (250 words/page)
    const longScript = 'word '.repeat(750);
    vi.mocked(generateObject).mockResolvedValueOnce(makeQuickScoreObject() as any);

    const result = await quickScore(longScript);

    expect(result.page_count).toBe(3);
  });

  it('propagates generateObject errors', async () => {
    vi.mocked(generateObject).mockRejectedValue(new Error('API rate limit'));

    await expect(quickScore(SAMPLE_SCRIPT)).rejects.toThrow('API rate limit');
  });
});

// ---------------------------------------------------------------------------
// Tests: analyzeScript
// ---------------------------------------------------------------------------

describe('analyzeScript', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns full analysis report with all required dimensions', async () => {
    // 4 core analyses + synthesis = 5 generateObject calls
    vi.mocked(generateObject)
      .mockResolvedValueOnce(makeWritingQuality() as any)
      .mockResolvedValueOnce(makeStoryQuality() as any)
      .mockResolvedValueOnce(makeCommercialViability() as any)
      .mockResolvedValueOnce(makeProductionLikelihood() as any)
      .mockResolvedValueOnce(makeSynthesis() as any);

    const result = await analyzeScript({
      project_id: 'proj_001',
      script_text: SAMPLE_SCRIPT,
      title: 'Se7en',
    });

    expect(result).toMatchObject({
      script_id: 'proj_001',
      title: 'Se7en',
      analyzed_at: expect.any(String),
      page_count: expect.any(Number),
      overall_score: 7,
      coverage_verdict: 'consider',
      writing_quality: expect.any(Object),
      story_quality: expect.any(Object),
      commercial_viability: expect.any(Object),
      production_likelihood: expect.any(Object),
      dialogue_analysis: null,
      structural_analysis: null,
      executive_summary: expect.any(Object),
      improvement_roadmap: expect.any(Array),
    });
  });

  it('calls progress callback at key milestones', async () => {
    vi.mocked(generateObject)
      .mockResolvedValueOnce(makeWritingQuality() as any)
      .mockResolvedValueOnce(makeStoryQuality() as any)
      .mockResolvedValueOnce(makeCommercialViability() as any)
      .mockResolvedValueOnce(makeProductionLikelihood() as any)
      .mockResolvedValueOnce(makeSynthesis() as any);

    const onProgress = vi.fn();
    await analyzeScript({ project_id: 'proj_002', script_text: SAMPLE_SCRIPT }, onProgress);

    expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({ phase: 'parsing', percent: 0 }));
    expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({ phase: 'complete', percent: 100 }));
  });

  it('runs dialogue deep-dive when include_dialogue_deep_dive is true', async () => {
    const dialogueResult = {
      overall: makeCategoryScore(),
      characters: [],
      dynamics: {
        conflict_in_dialogue: 7,
        power_shifts: 6,
        subtext_density: 7,
        exposition_handling: 7,
      },
      issues: [],
    };

    vi.mocked(generateObject)
      .mockResolvedValueOnce(makeWritingQuality() as any)
      .mockResolvedValueOnce(makeStoryQuality() as any)
      .mockResolvedValueOnce(makeCommercialViability() as any)
      .mockResolvedValueOnce(makeProductionLikelihood() as any)
      .mockResolvedValueOnce(dialogueResult as any)
      .mockResolvedValueOnce(makeSynthesis() as any);

    const result = await analyzeScript({
      project_id: 'proj_003',
      script_text: SAMPLE_SCRIPT,
      include_dialogue_deep_dive: true,
    });

    expect(result.dialogue_analysis).not.toBeNull();
  });

  it('propagates LLM failure to the caller (failover handled by llm-client)', async () => {
    // analyzeScript fires 4 parallel analyses via Promise.all. Each one calls
    // generateStructuredOutput exactly once — retry/failover across providers
    // is the llm-client's responsibility and is tested separately.
    vi.mocked(generateObject).mockRejectedValue(new Error('Anthropic 529'));

    await expect(
      analyzeScript({ project_id: 'proj_004', script_text: SAMPLE_SCRIPT })
    ).rejects.toThrow();

    // 4 parallel analyses each made 1 call.
    expect(generateObject.mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  it('runs structural analysis when include_structural_analysis is true', async () => {
    const structuralJson = JSON.stringify({ acts: [{ name: 'Act 1', pages: '1-30' }] });

    vi.mocked(generateObject)
      .mockResolvedValueOnce(makeWritingQuality() as any)
      .mockResolvedValueOnce(makeStoryQuality() as any)
      .mockResolvedValueOnce(makeCommercialViability() as any)
      .mockResolvedValueOnce(makeProductionLikelihood() as any)
      .mockResolvedValueOnce(makeSynthesis() as any);

    vi.mocked(generateText).mockResolvedValueOnce(structuralJson as any);

    const result = await analyzeScript({
      project_id: 'proj_005',
      script_text: SAMPLE_SCRIPT,
      include_structural_analysis: true,
    });

    expect(generateText).toHaveBeenCalledOnce();
    expect(result.structural_analysis).toEqual({ acts: [{ name: 'Act 1', pages: '1-30' }] });
  });
});

// ---------------------------------------------------------------------------
// Tests: llm-client delegation contract (via quickScore surface)
//
// Internal retry was removed from analyzeWithRetry on 2026-06-08; the service
// now delegates failover to llm-client.generateStructuredOutput. These tests
// pin the new contract: exactly one llm-client call per analysis dimension,
// errors propagate unchanged.
// ---------------------------------------------------------------------------

describe('analyzeWithRetry contract (via quickScore)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('makes exactly one llm-client call per dimension on success', async () => {
    vi.mocked(generateObject).mockResolvedValueOnce(makeQuickScoreObject() as any);

    const result = await quickScore(SAMPLE_SCRIPT);

    expect(generateObject).toHaveBeenCalledTimes(1);
    expect(result.overall_score).toBe(7);
  });

  it('propagates the llm-client error verbatim (no internal retry)', async () => {
    vi.mocked(generateObject).mockRejectedValue(new Error('Persistent failure'));

    await expect(quickScore(SAMPLE_SCRIPT)).rejects.toThrow('Persistent failure');
    // Single call — the llm-client owns the failover chain across providers.
    expect(generateObject).toHaveBeenCalledTimes(1);
  });
});
