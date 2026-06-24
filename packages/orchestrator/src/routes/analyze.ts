/**
 * Script Analysis Routes
 *
 * POST /analyze - Full script analysis with all dimensions
 * POST /analyze/quick - Quick score for triage
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { analyzeScript, quickScore } from '../analysis/script-score-service.js';
import { log } from '../lib/logger.js';
import { setProjectScope } from '../lib/sentry.js';
import {
  withWallClockBudget,
  getWallClockBudgetMs,
  BudgetExceededError,
} from '../lib/wallclock-budget.js';

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
  setProjectScope(project_id);

  log.info('Starting full script analysis', {
    projectId: project_id,
    scriptLength: script_text.length,
    estimatedPages: Math.round(script_text.split(/\s+/).length / 250),
    includeDialogueDeepDive: include_dialogue_deep_dive,
    includeStructuralAnalysis: include_structural_analysis,
  });

  // T3-5 (#186 follow-up): cap total wall-clock time on /analyze. The LLM
  // failover chain can retry across providers and burn tokens if things go
  // sideways; this prevents one runaway request from sitting open for minutes
  // while the model thrashes. Default 120s — comfortably above the p99 for a
  // healthy run, but tight enough to surface real provider issues fast.
  const budgetMs = getWallClockBudgetMs('ANALYZE_WALLCLOCK_BUDGET_MS', 120_000);

  // PR ε (2026-06-24): SSE conversion — see /orchestrate and /generate-scenes
  // for the rationale. Render's inter-service proxy closes idle connections
  // after ~300 s. The wall-clock budget is 120 s today but ANALYZE_WALLCLOCK_
  // BUDGET_MS can be raised; without SSE, anyone bumping it past 300 s would
  // walk into the silent connection-drop class. analyzeScript already exposes
  // a progress callback, so we forward those events as SSE `progress` events
  // on top of the load-bearing 25 s heartbeat.
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const sendEvent = (data: object): void => {
    if (!res.writableEnded) res.write(`data: ${JSON.stringify(data)}\n\n`);
  };
  const heartbeat = setInterval(() => {
    if (!res.writableEnded) res.write(': heartbeat\n\n');
  }, 25_000);

  try {
    const startTime = Date.now();

    const result = await withWallClockBudget(
      analyzeScript(
        {
          project_id,
          script_text,
          title,
          include_dialogue_deep_dive,
          include_structural_analysis,
        },
        (progress) => {
          log.info('Analysis progress', { projectId: project_id, phase: progress.phase, percent: progress.percent, currentTask: progress.current_task });
          sendEvent({ type: 'progress', phase: progress.phase, percent: progress.percent, current_task: progress.current_task });
        }
      ),
      budgetMs,
      `/analyze project=${project_id}`,
    );

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    log.info('Script analysis complete', { projectId: project_id, durationSeconds: parseFloat(duration), overallScore: result.overall_score, coverageVerdict: result.coverage_verdict });

    sendEvent({
      type: 'result',
      status: 'success',
      analysis: result,
      metadata: {
        duration_seconds: parseFloat(duration),
        model: 'gpt-4o',
      },
    });
    res.end();
  } catch (error) {
    if (error instanceof BudgetExceededError) {
      log.warn('Script analysis exceeded wall-clock budget — emitting SSE error', {
        projectId: project_id,
        budgetMs: error.budgetMs,
      });
      sendEvent({
        type: 'result',
        status: 'error',
        message: `Analysis took longer than ${Math.round(error.budgetMs / 1000)}s — please retry. If this keeps happening, the upstream LLM provider may be degraded.`,
      });
      res.end();
      return;
    }
    log.error('Script analysis failed', error instanceof Error ? error : new Error(String(error)), { projectId: project_id });
    sendEvent({
      type: 'result',
      status: 'error',
      message: error instanceof Error ? error.message : 'Analysis failed',
    });
    res.end();
  } finally {
    clearInterval(heartbeat);
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

  log.info('Starting quick score analysis');

  try {
    const startTime = Date.now();
    const result = await quickScore(script_text, title);
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    log.info('Quick score complete', { durationSeconds: parseFloat(duration), overallScore: result.overall_score });

    res.json({
      status: 'success',
      score: result,
      metadata: {
        duration_seconds: parseFloat(duration),
        model: 'gpt-4o',
      },
    });
  } catch (error) {
    log.error('Quick score failed', error instanceof Error ? error : new Error(String(error)));
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
