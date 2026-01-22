/**
 * Script Analysis Routes
 *
 * POST /analyze - Full script analysis with all dimensions
 * POST /analyze/quick - Quick score for triage
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { analyzeScript, quickScore } from '../analysis/script-score-service.js';

const router = Router();

// =============================================================================
// Request Validation
// =============================================================================

const AnalyzeRequestSchema = z.object({
  project_id: z.string().uuid(),
  script_text: z.string().min(100, 'Script must be at least 100 characters'),
  title: z.string().optional(),
  include_dialogue_deep_dive: z.boolean().default(false),
  include_structural_analysis: z.boolean().default(false),
});

const QuickScoreRequestSchema = z.object({
  script_text: z.string().min(100, 'Script must be at least 100 characters'),
  title: z.string().optional(),
});

// =============================================================================
// Full Analysis Endpoint
// =============================================================================

/**
 * POST /analyze
 *
 * Comprehensive screenplay analysis covering:
 * - Writing Quality (dialogue, action lines, formatting)
 * - Story Quality (premise, structure, characters, conflict, theme)
 * - Commercial Viability (market fit, producibility, platform fit)
 * - Production Likelihood (execution readiness, industry factors)
 * - Optional: Dialogue Deep Dive (per-character analysis)
 * - Optional: Structural Analysis (beat sheet, pacing)
 *
 * Response includes:
 * - Scores (1-10) for each dimension and sub-dimension
 * - Coverage verdict (pass/consider/recommend)
 * - Executive summary with strengths, weaknesses, comparables
 * - Prioritized improvement roadmap
 */
router.post('/analyze', async (req: Request, res: Response): Promise<void> => {
  // Validate request
  const parsed = AnalyzeRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      status: 'error',
      message: 'Invalid request',
      errors: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  const { project_id, script_text, title, include_dialogue_deep_dive, include_structural_analysis } =
    parsed.data;

  console.log(`[analyze] Starting full analysis for project ${project_id}`);
  console.log(`[analyze] Script: ${script_text.length} chars, ~${Math.round(script_text.split(/\s+/).length / 250)} pages`);
  console.log(`[analyze] Options: dialogue=${include_dialogue_deep_dive}, structure=${include_structural_analysis}`);

  try {
    const startTime = Date.now();

    const result = await analyzeScript(
      {
        project_id,
        script_text,
        title,
        include_dialogue_deep_dive,
        include_structural_analysis,
      },
      (progress) => {
        console.log(`[analyze] Progress: ${progress.phase} - ${progress.percent}% - ${progress.current_task}`);
      }
    );

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[analyze] Complete in ${duration}s. Overall score: ${result.overall_score}/10, Verdict: ${result.coverage_verdict}`);

    res.json({
      status: 'success',
      analysis: result,
      metadata: {
        duration_seconds: parseFloat(duration),
        model: 'gpt-4o',
      },
    });
  } catch (error) {
    console.error('[analyze] Error:', error);
    res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Analysis failed',
    });
  }
});

// =============================================================================
// Quick Score Endpoint
// =============================================================================

/**
 * POST /analyze/quick
 *
 * Fast triage scoring (single LLM call)
 * Returns overall score, dimension scores, verdict, and brief summary
 *
 * Use for:
 * - Initial screening of scripts
 * - Dashboard overview
 * - When full analysis is too slow
 */
router.post('/analyze/quick', async (req: Request, res: Response): Promise<void> => {
  const parsed = QuickScoreRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      status: 'error',
      message: 'Invalid request',
      errors: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  const { script_text, title } = parsed.data;

  console.log(`[analyze/quick] Starting quick score`);

  try {
    const startTime = Date.now();
    const result = await quickScore(script_text, title);
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log(`[analyze/quick] Complete in ${duration}s. Score: ${result.overall_score}/10`);

    res.json({
      status: 'success',
      score: result,
      metadata: {
        duration_seconds: parseFloat(duration),
        model: 'gpt-4o',
      },
    });
  } catch (error) {
    console.error('[analyze/quick] Error:', error);
    res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Quick score failed',
    });
  }
});

// =============================================================================
// Schema Documentation Endpoint
// =============================================================================

/**
 * GET /analyze/schema
 *
 * Returns the scoring rubric documentation for reference
 */
router.get('/analyze/schema', (_req: Request, res: Response): void => {
  res.json({
    status: 'success',
    schema: {
      score_range: '1-10',
      calibration: {
        '1-2': 'Fundamentally broken, needs complete rewrite',
        '3-4': 'Below average, significant issues',
        '5': 'Average, meets basic expectations',
        '6': 'Above average, shows competence',
        '7': 'Good, would merit a "Consider"',
        '8': 'Very good, "Consider with enthusiasm"',
        '9': 'Excellent, near-professional, "Recommend"',
        '10': 'Exceptional, top 1%, ready for production',
      },
      dimensions: {
        writing_quality: {
          description: 'Craft of the writing itself',
          sub_dimensions: ['dialogue', 'action_lines', 'formatting'],
        },
        story_quality: {
          description: 'Narrative and dramatic elements',
          sub_dimensions: ['premise', 'structure', 'characters', 'conflict', 'theme'],
        },
        commercial_viability: {
          description: 'Market potential and saleability',
          sub_dimensions: ['market_fit', 'producibility', 'platform_fit', 'sales_hooks'],
        },
        production_likelihood: {
          description: 'Chance of actually being produced',
          sub_dimensions: ['execution_readiness', 'industry_factors', 'practical_considerations'],
        },
      },
      verdicts: {
        pass: 'Not ready for market',
        consider: 'Shows promise, needs work',
        consider_with_reservations: 'Good but has specific concerns',
        recommend: 'Ready for market, would champion',
      },
      optional_analyses: {
        dialogue_deep_dive: 'Per-character voice analysis, conversation dynamics, issues',
        structural_analysis: 'Save the Cat beat sheet, pacing, scene-by-scene breakdown',
      },
    },
  });
});

export default router;
