/**
 * Script Score Service
 *
 * Orchestrates multi-pass LLM analysis of screenplays using structured prompts.
 * Each analysis dimension is evaluated separately for accuracy, then synthesized.
 */

import { generateText, generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { log } from '../lib/logger.js';

import {
  SCORING_CALIBRATION,
  WRITING_QUALITY_PROMPT,
  STORY_QUALITY_PROMPT,
  COMMERCIAL_VIABILITY_PROMPT,
  PRODUCTION_LIKELIHOOD_PROMPT,
  DIALOGUE_ANALYSIS_PROMPT,
  STRUCTURAL_ANALYSIS_PROMPT,
  SYNTHESIS_PROMPT,
} from './prompts/script-score-prompts.js';

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

const CategoryScoreSchema = z.object({
  score: z.number().min(1).max(10),
  confidence: z.number().min(0).max(1),
  summary: z.string(),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  suggestions: z.array(z.string()),
});

const WritingQualitySchema = z.object({
  overall: CategoryScoreSchema,
  dialogue: CategoryScoreSchema.extend({
    subtext_usage: z.number().min(1).max(10),
    voice_distinction: z.number().min(1).max(10),
    naturalism: z.number().min(1).max(10),
    economy: z.number().min(1).max(10),
  }),
  action_lines: CategoryScoreSchema.extend({
    clarity: z.number().min(1).max(10),
    brevity: z.number().min(1).max(10),
    voice: z.number().min(1).max(10),
  }),
  formatting: CategoryScoreSchema.extend({
    industry_standard: z.number().min(1).max(10),
    white_space: z.number().min(1).max(10),
    readability: z.number().min(1).max(10),
  }),
});

const StoryQualitySchema = z.object({
  overall: CategoryScoreSchema,
  premise: CategoryScoreSchema.extend({
    originality: z.number().min(1).max(10),
    clarity: z.number().min(1).max(10),
    hook: z.number().min(1).max(10),
  }),
  structure: CategoryScoreSchema.extend({
    three_act: z.number().min(1).max(10),
    pacing: z.number().min(1).max(10),
    beat_sheet: z.number().min(1).max(10),
    turning_points: z.number().min(1).max(10),
  }),
  characters: CategoryScoreSchema.extend({
    protagonist_clarity: z.number().min(1).max(10),
    antagonist_strength: z.number().min(1).max(10),
    arc: z.number().min(1).max(10),
    supporting_cast: z.number().min(1).max(10),
    motivation: z.number().min(1).max(10),
  }),
  conflict: CategoryScoreSchema.extend({
    central_conflict: z.number().min(1).max(10),
    stakes: z.number().min(1).max(10),
    escalation: z.number().min(1).max(10),
    resolution: z.number().min(1).max(10),
  }),
  theme: CategoryScoreSchema.extend({
    presence: z.number().min(1).max(10),
    integration: z.number().min(1).max(10),
    resonance: z.number().min(1).max(10),
  }),
});

const CommercialViabilitySchema = z.object({
  overall: CategoryScoreSchema,
  market_fit: CategoryScoreSchema.extend({
    genre_clarity: z.number().min(1).max(10),
    target_audience: z.number().min(1).max(10),
    trend_alignment: z.number().min(1).max(10),
    comparables: z.array(z.string()),
  }),
  producibility: CategoryScoreSchema.extend({
    budget_tier: z.enum(['micro', 'low', 'medium', 'high', 'blockbuster']),
    location_feasibility: z.number().min(1).max(10),
    cast_requirements: z.number().min(1).max(10),
    vfx_demands: z.number().min(1).max(10),
    period_setting: z.boolean(),
  }),
  platform_fit: z.object({
    theatrical: z.number().min(1).max(10),
    streaming: z.number().min(1).max(10),
    limited_series: z.number().min(1).max(10),
    international: z.number().min(1).max(10),
  }),
  sales_hooks: CategoryScoreSchema.extend({
    logline_strength: z.number().min(1).max(10),
    poster_moment: z.boolean(),
    trailer_beats: z.number().min(1).max(10),
    word_of_mouth: z.number().min(1).max(10),
  }),
});

const ProductionLikelihoodSchema = z.object({
  overall: CategoryScoreSchema,
  execution_readiness: CategoryScoreSchema.extend({
    script_polish: z.number().min(1).max(10),
    coverage_ready: z.number().min(1).max(10),
    director_attachment: z.number().min(1).max(10),
  }),
  industry_factors: CategoryScoreSchema.extend({
    diversity_inclusion: z.number().min(1).max(10),
    cultural_relevance: z.number().min(1).max(10),
    controversy_risk: z.number().min(1).max(10),
    awards_potential: z.number().min(1).max(10),
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
      vocabulary_richness: z.number().min(1).max(10),
      speech_patterns: z.array(z.string()),
      emotional_range: z.number().min(1).max(10),
      consistency: z.number().min(1).max(10),
      memorable_lines: z.array(z.string()),
    })
  ),
  dynamics: z.object({
    conflict_in_dialogue: z.number().min(1).max(10),
    power_shifts: z.number().min(1).max(10),
    subtext_density: z.number().min(1).max(10),
    exposition_handling: z.number().min(1).max(10),
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
  overall_score: z.number().min(1).max(10),
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

const MODEL = 'gpt-4o'; // Best for structured analysis

async function analyzeWithRetry<T>(
  prompt: string,
  schema: z.ZodSchema<T>,
  script: string,
  maxRetries: number = 2
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await generateObject({
        model: openai(MODEL),
        schema,
        prompt: `${prompt}\n\n---\n\nSCRIPT TO ANALYZE:\n\n${script}`,
        temperature: 0.3, // Lower temperature for consistent scoring
      });

      return result.object;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      log.warn('Analysis attempt failed', { attempt: attempt + 1, error: lastError.message });

      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
  }

  throw lastError || new Error('Analysis failed after retries');
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

  const [writingQuality, storyQuality, commercialViability, productionLikelihood] = await Promise.all([
    analyzeWithRetry(WRITING_QUALITY_PROMPT, WritingQualitySchema, script_text),
    analyzeWithRetry(STORY_QUALITY_PROMPT, StoryQualitySchema, script_text),
    analyzeWithRetry(COMMERCIAL_VIABILITY_PROMPT, CommercialViabilitySchema, script_text),
    analyzeWithRetry(PRODUCTION_LIKELIHOOD_PROMPT, ProductionLikelihoodSchema, script_text),
  ]);

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
    // Structural analysis is complex - use direct text generation for flexibility
    const structureResult = await generateText({
      model: openai(MODEL),
      prompt: `${STRUCTURAL_ANALYSIS_PROMPT}\n\n---\n\nSCRIPT TO ANALYZE:\n\n${script_text}`,
      temperature: 0.3,
    });

    try {
      structuralAnalysis = JSON.parse(structureResult.text);
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
  overall_score: z.number().min(1).max(10),
  writing: z.number().min(1).max(10),
  story: z.number().min(1).max(10),
  commercial: z.number().min(1).max(10),
  production: z.number().min(1).max(10),
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
