/**
 * Script Score Service
 *
 * Orchestrates multi-pass LLM analysis of screenplays using structured prompts.
 * Each analysis dimension is evaluated separately for accuracy, then synthesized.
 */

import { z } from 'zod';
import { log } from '../lib/logger.js';
import { generateStructuredOutput } from '../lib/llm-client.js';
import { runAgentLoop } from '../lib/llm-client.js';

import {
  SCORING_CALIBRATION,
  WRITING_QUALITY_PROMPT,
  STORY_QUALITY_PROMPT,
  COMMERCIAL_VIABILITY_PROMPT,
  PRODUCTION_LIKELIHOOD_PROMPT,
  DIALOGUE_ANALYSIS_PROMPT,
  STRUCTURAL_ANALYSIS_PROMPT,
  SYNTHESIS_PROMPT,
  ALL_DIMENSIONS_PROMPT,
} from './prompts/script-score-prompts.js';

/**
 * Batched all-dimensions mode (Phase 2 cost-opt, issue #182).
 *
 * Default OFF — the existing four-call Promise.all path is well-tested. Set
 * BATCHED_SCORING_ENABLED=true on the orchestrator to use the single combined
 * call instead. Output quality should be A/B tested against the corpus before
 * flipping production traffic.
 *
 * Cost win: the script text (typically 5-15K tokens) is sent once instead of
 * four times. Even without prompt caching, that's a 3x reduction on the
 * largest single input per call. With Anthropic prompt caching (PR B of #182)
 * the savings compound — system prompt is also deduped across calls.
 *
 * Read at call time (not module load) so tests and feature-flag toggles take
 * effect without restarting the orchestrator.
 */
function isBatchedScoringEnabled(): boolean {
  return process.env.BATCHED_SCORING_ENABLED === 'true';
}

// =============================================================================
// Types
// =============================================================================

export interface ScriptScoreRequest {
  project_id: string;
  script_text: string;
  title?: string;
  include_dialogue_deep_dive?: boolean;
  include_structural_analysis?: boolean;
}

export interface ScriptScoreProgress {
  phase: string;
  percent: number;
  current_task: string;
}

export type ProgressCallback = (progress: ScriptScoreProgress) => void;

// =============================================================================
// Analysis Report Return Type
// =============================================================================

export interface ScriptAnalysisReport {
  script_id: string;
  title: string;
  analyzed_at: string;
  page_count: number;
  genre: string[];
  logline: string;
  overall_score: number;
  coverage_verdict: string;
  writing_quality: z.infer<typeof WritingQualitySchema>;
  story_quality: z.infer<typeof StoryQualitySchema>;
  commercial_viability: z.infer<typeof CommercialViabilitySchema>;
  production_likelihood: z.infer<typeof ProductionLikelihoodSchema>;
  dialogue_analysis: z.infer<typeof DialogueAnalysisSchema> | null;
  structural_analysis: unknown;
  executive_summary: z.infer<typeof SynthesisSchema>['executive_summary'];
  improvement_roadmap: z.infer<typeof SynthesisSchema>['improvement_roadmap'];
}

// =============================================================================
// Zod Schemas for Structured Output
// =============================================================================
//
// IMPORTANT (Claude compatibility): do NOT use `.min()` / `.max()` on Zod
// numbers in schemas passed to `generateStructuredOutput`. The AI SDK converts
// those to JSON Schema `minimum`/`maximum`, which Anthropic's structured-output
// API rejects. We communicate the intended range via `.describe()` and via the
// prompt; values are then clamped server-side by `clampScore()` below.

/** A 1–10 score from the LLM. Range is enforced via the prompt + post-clamp. */
const scoreField = (label = '1-10 score') => z.number().describe(label);
/** A 0–1 confidence value. Range communicated via prompt + post-clamp. */
const confidenceField = () => z.number().describe('0.0-1.0 confidence');

const CategoryScoreSchema = z.object({
  score: scoreField(),
  confidence: confidenceField(),
  summary: z.string(),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  suggestions: z.array(z.string()),
});

const WritingQualitySchema = z.object({
  overall: CategoryScoreSchema,
  dialogue: CategoryScoreSchema.extend({
    subtext_usage: scoreField(),
    voice_distinction: scoreField(),
    naturalism: scoreField(),
    economy: scoreField(),
  }),
  action_lines: CategoryScoreSchema.extend({
    clarity: scoreField(),
    brevity: scoreField(),
    voice: scoreField(),
  }),
  formatting: CategoryScoreSchema.extend({
    industry_standard: scoreField(),
    white_space: scoreField(),
    readability: scoreField(),
  }),
});

const StoryQualitySchema = z.object({
  overall: CategoryScoreSchema,
  premise: CategoryScoreSchema.extend({
    originality: scoreField(),
    clarity: scoreField(),
    hook: scoreField(),
  }),
  structure: CategoryScoreSchema.extend({
    three_act: scoreField(),
    pacing: scoreField(),
    beat_sheet: scoreField(),
    turning_points: scoreField(),
  }),
  characters: CategoryScoreSchema.extend({
    protagonist_clarity: scoreField(),
    antagonist_strength: scoreField(),
    arc: scoreField(),
    supporting_cast: scoreField(),
    motivation: scoreField(),
  }),
  conflict: CategoryScoreSchema.extend({
    central_conflict: scoreField(),
    stakes: scoreField(),
    escalation: scoreField(),
    resolution: scoreField(),
  }),
  theme: CategoryScoreSchema.extend({
    presence: scoreField(),
    integration: scoreField(),
    resonance: scoreField(),
  }),
});

const CommercialViabilitySchema = z.object({
  overall: CategoryScoreSchema,
  market_fit: CategoryScoreSchema.extend({
    genre_clarity: scoreField(),
    target_audience: scoreField(),
    trend_alignment: scoreField(),
    comparables: z.array(z.string()),
  }),
  producibility: CategoryScoreSchema.extend({
    budget_tier: z.enum(['micro', 'low', 'medium', 'high', 'blockbuster']),
    location_feasibility: scoreField(),
    cast_requirements: scoreField(),
    vfx_demands: scoreField(),
    period_setting: z.boolean(),
  }),
  platform_fit: z.object({
    theatrical: scoreField(),
    streaming: scoreField(),
    limited_series: scoreField(),
    international: scoreField(),
  }),
  sales_hooks: CategoryScoreSchema.extend({
    logline_strength: scoreField(),
    poster_moment: z.boolean(),
    trailer_beats: scoreField(),
    word_of_mouth: scoreField(),
  }),
});

const ProductionLikelihoodSchema = z.object({
  overall: CategoryScoreSchema,
  execution_readiness: CategoryScoreSchema.extend({
    script_polish: scoreField(),
    coverage_ready: scoreField(),
    director_attachment: scoreField(),
  }),
  industry_factors: CategoryScoreSchema.extend({
    diversity_inclusion: scoreField(),
    cultural_relevance: scoreField(),
    controversy_risk: scoreField(),
    awards_potential: scoreField(),
  }),
  practical_considerations: z.object({
    page_count: z.number(),
    estimated_runtime_minutes: z.number(),
    speaking_roles: z.number(),
    locations_count: z.number(),
    major_set_pieces: z.number(),
  }),
});

const DialogueAnalysisSchema = z.object({
  overall: CategoryScoreSchema,
  characters: z.array(
    z.object({
      name: z.string(),
      line_count: z.number(),
      avg_line_length: z.enum(['short', 'medium', 'long']),
      vocabulary_richness: scoreField(),
      speech_patterns: z.array(z.string()),
      emotional_range: scoreField(),
      consistency: scoreField(),
      memorable_lines: z.array(z.string()),
    })
  ),
  dynamics: z.object({
    conflict_in_dialogue: scoreField(),
    power_shifts: scoreField(),
    subtext_density: scoreField(),
    exposition_handling: scoreField(),
  }),
  issues: z.array(
    z.object({
      type: z.enum(['on_the_nose', 'exposition_dump', 'redundant', 'anachronistic', 'inconsistent_voice']),
      location: z.string(),
      example: z.string(),
      suggestion: z.string(),
    })
  ),
});

const SynthesisSchema = z.object({
  overall_score: scoreField(),
  coverage_verdict: z.enum(['pass', 'consider', 'consider_with_reservations', 'recommend']),
  executive_summary: z.object({
    one_liner: z.string(),
    top_strengths: z.array(z.string()),
    critical_weaknesses: z.array(z.string()),
    comparison_titles: z.array(z.string()),
    ideal_for: z.array(z.string()),
  }),
  improvement_roadmap: z.array(
    z.object({
      priority: z.enum(['critical', 'high', 'medium', 'low']),
      area: z.string(),
      issue: z.string(),
      recommendation: z.string(),
      effort: z.enum(['quick_fix', 'moderate_revision', 'major_rewrite']),
    })
  ),
  logline: z.string(),
  genre: z.array(z.string()),
});

// =============================================================================
// Analysis Functions
// =============================================================================

/**
 * Model selection for script analysis.
 *
 * Order of precedence:
 *   1. SCRIPT_SCORE_MODEL — explicit override (testing, A/B)
 *   2. DIRECTOR_MODEL — same model as the rest of the director pipeline
 *   3. fallback Claude Sonnet
 *
 * NOTE: This was previously hardcoded to `openai('gpt-4o')` which caused every
 * analysis to call OpenAI directly, completely bypassing the failover chain in
 * llm-client.ts. That's why both billing accounts were being hit per analysis.
 * Now routes through `generateStructuredOutput` which has built-in Claude →
 * OpenRouter → OpenAI failover via `buildFailoverChain()`.
 */
function getAnalysisModel(): string {
  return (
    process.env.SCRIPT_SCORE_MODEL ||
    process.env.DIRECTOR_MODEL ||
    'anthropic/claude-sonnet-4-6'
  );
}

async function analyzeWithRetry<T>(
  prompt: string,
  schema: z.ZodSchema<T>,
  script: string,
): Promise<T> {
  // `generateStructuredOutput` already does the failover chain
  // (Claude → OpenRouter → OpenAI), so we don't loop here ourselves.
  return generateStructuredOutput<T>(
    `${prompt}\n\n---\n\nSCRIPT TO ANALYZE:\n\n${script}`,
    {
      model: getAnalysisModel(),
      schema,
      temperature: 0.3,
      maxTokens: 8192,
    },
  );
}

// =============================================================================
// Batched All-Dimensions Analysis (PR C of #182)
// =============================================================================
//
// One LLM call returning all four core dimensions. Used when
// BATCHED_SCORING_ENABLED=true. The output is then splatted back into the
// same four variables the downstream code already uses, so the rest of the
// pipeline doesn't need to change.

const AllDimensionsScoreSchema = z.object({
  writing_quality: WritingQualitySchema,
  story_quality: StoryQualitySchema,
  commercial_viability: CommercialViabilitySchema,
  production_likelihood: ProductionLikelihoodSchema,
});

type AllDimensionsScore = z.infer<typeof AllDimensionsScoreSchema>;

export async function analyzeAllDimensionsBatched(script: string): Promise<AllDimensionsScore> {
  log.info('ScriptScore using batched all-dimensions mode (BATCHED_SCORING_ENABLED=true)');
  return generateStructuredOutput<AllDimensionsScore>(
    `${ALL_DIMENSIONS_PROMPT}\n\n---\n\nSCRIPT TO ANALYZE:\n\n${script}`,
    {
      model: getAnalysisModel(),
      schema: AllDimensionsScoreSchema,
      temperature: 0.3,
      // Larger output budget than the per-dimension calls: this single call
      // must return ~4x the JSON of any individual dimension.
      maxTokens: 16384,
    },
  );
}

// =============================================================================
// Main Analysis Service
// =============================================================================

export async function analyzeScript(
  request: ScriptScoreRequest,
  onProgress?: ProgressCallback
): Promise<ScriptAnalysisReport> {
  const { script_text, title, include_dialogue_deep_dive, include_structural_analysis } = request;

  const report = (phase: string, percent: number, task: string) => {
    log.info('ScriptScore progress', { phase, percent, task });
    if (onProgress) {
      onProgress({ phase, percent, current_task: task });
    }
  };

  report('parsing', 0, 'Starting script analysis...');

  // Estimate page count (roughly 1 page = 250 words)
  const wordCount = script_text.split(/\s+/).length;
  const estimatedPages = Math.round(wordCount / 250);

  // ==========================================================================
  // Phase 1: Core Analysis (run in parallel for speed)
  // ==========================================================================

  report('analyzing', 10, 'Analyzing writing quality...');

  let writingQuality: z.infer<typeof WritingQualitySchema>;
  let storyQuality: z.infer<typeof StoryQualitySchema>;
  let commercialViability: z.infer<typeof CommercialViabilitySchema>;
  let productionLikelihood: z.infer<typeof ProductionLikelihoodSchema>;

  if (isBatchedScoringEnabled()) {
    // One call returns all four dimensions. ~3x less script-text input than
    // the parallel four-call path. Default off — flip via env after corpus A/B.
    const batched = await analyzeAllDimensionsBatched(script_text);
    writingQuality = batched.writing_quality;
    storyQuality = batched.story_quality;
    commercialViability = batched.commercial_viability;
    productionLikelihood = batched.production_likelihood;
  } else {
    [writingQuality, storyQuality, commercialViability, productionLikelihood] = await Promise.all([
      analyzeWithRetry(WRITING_QUALITY_PROMPT, WritingQualitySchema, script_text),
      analyzeWithRetry(STORY_QUALITY_PROMPT, StoryQualitySchema, script_text),
      analyzeWithRetry(COMMERCIAL_VIABILITY_PROMPT, CommercialViabilitySchema, script_text),
      analyzeWithRetry(PRODUCTION_LIKELIHOOD_PROMPT, ProductionLikelihoodSchema, script_text),
    ]);
  }

  report('analyzing', 50, 'Core analysis complete');

  // ==========================================================================
  // Phase 2: Optional Deep Dives
  // ==========================================================================

  let dialogueAnalysis = null;
  let structuralAnalysis = null;

  if (include_dialogue_deep_dive) {
    report('dialogue', 55, 'Analyzing dialogue in depth...');
    dialogueAnalysis = await analyzeWithRetry(DIALOGUE_ANALYSIS_PROMPT, DialogueAnalysisSchema, script_text);
    report('dialogue', 70, 'Dialogue analysis complete');
  }

  if (include_structural_analysis) {
    report('structure', 75, 'Analyzing story structure...');
    // Structural analysis is complex — use unstructured text generation for
    // flexibility (no schema enforcement). Routes through `runAgentLoop` so
    // we still get the failover chain even though there are no tools.
    const rawText = await runAgentLoop(
      `${STRUCTURAL_ANALYSIS_PROMPT}\n\n---\n\nSCRIPT TO ANALYZE:\n\n${script_text}`,
      {
        model: getAnalysisModel(),
        systemPrompt: 'You analyze screenplay structure and return JSON.',
        temperature: 0.3,
        maxTokens: 8192,
        maxIterations: 1,
      },
    );

    try {
      // Strip markdown code fences in case the model wraps its JSON
      const cleaned = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
      structuralAnalysis = JSON.parse(cleaned);
    } catch {
      log.warn('Could not parse structural analysis as JSON');
    }
    report('structure', 85, 'Structural analysis complete');
  }

  // ==========================================================================
  // Phase 3: Synthesis
  // ==========================================================================

  report('synthesis', 90, 'Synthesizing final report...');

  const analysisContext = `
WRITING QUALITY ANALYSIS:
${JSON.stringify(writingQuality, null, 2)}

STORY QUALITY ANALYSIS:
${JSON.stringify(storyQuality, null, 2)}

COMMERCIAL VIABILITY ANALYSIS:
${JSON.stringify(commercialViability, null, 2)}

PRODUCTION LIKELIHOOD ANALYSIS:
${JSON.stringify(productionLikelihood, null, 2)}

${dialogueAnalysis ? `DIALOGUE ANALYSIS:\n${JSON.stringify(dialogueAnalysis, null, 2)}` : ''}

${structuralAnalysis ? `STRUCTURAL ANALYSIS:\n${JSON.stringify(structuralAnalysis, null, 2)}` : ''}
`;

  const synthesis = await analyzeWithRetry(
    `${SYNTHESIS_PROMPT}\n\nPREVIOUS ANALYSES:\n${analysisContext}`,
    SynthesisSchema,
    '' // We already have the analyses, don't need script again
  );

  report('complete', 100, 'Analysis complete!');

  // ==========================================================================
  // Compile Final Report
  // ==========================================================================

  return {
    script_id: request.project_id,
    title: title || 'Untitled',
    analyzed_at: new Date().toISOString(),
    page_count: estimatedPages,
    genre: synthesis.genre,
    logline: synthesis.logline,

    overall_score: synthesis.overall_score,
    coverage_verdict: synthesis.coverage_verdict,

    writing_quality: writingQuality,
    story_quality: storyQuality,
    commercial_viability: commercialViability,
    production_likelihood: productionLikelihood,
    dialogue_analysis: dialogueAnalysis,
    structural_analysis: structuralAnalysis,

    executive_summary: synthesis.executive_summary,
    improvement_roadmap: synthesis.improvement_roadmap,
  };
}

// =============================================================================
// Quick Score (Faster, Less Detailed)
// =============================================================================

const QuickScoreSchema = z.object({
  overall_score: scoreField(),
  writing: scoreField(),
  story: scoreField(),
  commercial: scoreField(),
  production: scoreField(),
  verdict: z.enum(['pass', 'consider', 'consider_with_reservations', 'recommend']),
  one_liner: z.string(),
  top_strength: z.string(),
  top_weakness: z.string(),
  genre: z.array(z.string()),
});

const QUICK_SCORE_PROMPT = `
You are a script reader providing a QUICK ASSESSMENT.
Read the script and provide concise scores and a brief verdict.

${SCORING_CALIBRATION}

Return a JSON object:
{
  "overall_score": <1-10>,
  "writing": <1-10, dialogue and prose quality>,
  "story": <1-10, narrative and characters>,
  "commercial": <1-10, market viability>,
  "production": <1-10, likelihood of being made>,
  "verdict": "<pass|consider|consider_with_reservations|recommend>",
  "one_liner": "<One sentence summary of the script's quality>",
  "top_strength": "<The single best thing about this script>",
  "top_weakness": "<The single most important thing to fix>",
  "genre": ["<genre 1>", "<genre 2 if applicable>"]
}

Be direct and honest. This is a quick triage, not detailed coverage.
`;

export async function quickScore(
  script_text: string,
  title?: string
): Promise<z.infer<typeof QuickScoreSchema> & { title: string; page_count: number }> {
  const wordCount = script_text.split(/\s+/).length;
  const estimatedPages = Math.round(wordCount / 250);

  const result = await analyzeWithRetry(QUICK_SCORE_PROMPT, QuickScoreSchema, script_text);

  return {
    ...result,
    title: title || 'Untitled',
    page_count: estimatedPages,
  };
}
