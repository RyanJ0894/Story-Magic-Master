import { Router, Request, Response } from 'express';
import { OrchestrateRequestSchema, DirectorJSONSchema, OrchestrateResponse, type DirectorJSON } from '../schemas/director-json.js';
import { processScript } from '../director/pipeline.js';
import { orchestrate, orchestrateParallel, type PipelineProgress } from '../orchestrator/pipeline.js';
import { log } from '../lib/logger.js';
import { prisma } from '../lib/prisma.js';
import { checkAIProviders } from '../lib/ai-health.js';
import { selectDirectorModel } from '../lib/select-director-model.js';

const router = Router();

/**
 * POST /orchestrate
 *
 * Takes Director JSON and generates the final audio output.
 * Optionally runs Director pipeline if script_text is provided.
 *
 * Request body:
 *   - project_id: string
 *   - scenes: Scene[] (optional if script_text provided)
 *   - script_text?: string (optional - if provided with no scenes, runs Director first)
 *
 * Query parameters:
 *   - parallel: 'true' (default) or 'false' - Use parallel processing pipeline
 *
 * Response:
 *   - status: 'success' | 'error'
 *   - project_id: string
 *   - audio_urls: string[]
 *   - playback_manifest: object
 */
router.post('/orchestrate', async (req: Request, res: Response): Promise<void> => {
  // Validate request
  const parsed = OrchestrateRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      status: 'error',
      project_id: req.body?.project_id || 'unknown',
      message: 'Invalid request: ' + JSON.stringify(parsed.error.issues),
    } as OrchestrateResponse);
    return;
  }

  let { project_id, scenes, script_text, emotion_overrides, chunk_index } = parsed.data;

  // Ownership check (BL-013): authenticated user must own this project.
  const requestingUserId = req.user?.id;
  if (requestingUserId) {
    try {
      const project = await prisma.project.findUnique({
        where: { id: project_id },
        select: { userId: true },
      });
      if (!project) {
        res.status(404).json({
          status: 'error',
          project_id,
          message: 'Project not found',
        } as OrchestrateResponse);
        return;
      }
      if (project.userId !== requestingUserId) {
        log.warn('orchestrate: ownership check failed', { projectId: project_id, requestingUserId });
        res.status(403).json({
          status: 'error',
          project_id,
          message: 'Forbidden: you do not own this project',
        } as OrchestrateResponse);
        return;
      }
    } catch (err) {
      // Non-fatal: if DB is unavailable, log and continue (allows dev without DB)
      log.warn('orchestrate: ownership check skipped (DB unavailable)', { projectId: project_id });
    }
  }

  // Pre-flight: verify AI provider keys are reachable before committing
  // to a long-running audio generation job.
  const preflight = await checkAIProviders('preflight');
  if (!preflight.canProceed) {
    const detail = preflight.results
      .filter((r) => r.status === 'down')
      .map((r) => `${r.provider}: ${r.errorCode ?? 'down'}`)
      .join(', ');
    log.error('orchestrate: AI preflight failed — aborting job', undefined, {
      projectId: project_id,
      blockedBy: preflight.blockedBy,
      detail,
    });
    res.status(503).json({
      status: 'error',
      project_id,
      message: `AI services unavailable — please retry in a few minutes. (${detail})`,
    } as OrchestrateResponse);
    return;
  }

  // Check if project has an Advanced Analysis purchase — model selection is
  // ALWAYS server-side (DB lookup). The client NEVER influences model choice.
  let useAdvancedModel = false;
  try {
    const advancedPurchase = await prisma.purchase.findFirst({
      where: {
        projectId: project_id,
        purchaseType: 'advanced_analysis',
        status: 'completed',
      },
      select: { id: true },
    });
    useAdvancedModel = !!advancedPurchase;
  } catch {
    // Non-fatal — default to standard model if DB check fails
    log.warn('orchestrate: advanced analysis purchase check skipped (DB unavailable)', { projectId: project_id });
  }

  // Tier 2 (#186 PR E): route by script complexity. Small scripts (≤
  // TIER1_PAGE_THRESHOLD pages) run on TIER1_MODEL (Haiku by default);
  // larger scripts use the standard DIRECTOR_MODEL (Sonnet). Paid
  // Advanced Analysis purchases bypass the tier and use Opus regardless.
  const modelSelection = selectDirectorModel({
    scriptText: script_text ?? '',
    useAdvanced: useAdvancedModel,
  });
  const directorModel = modelSelection.model;

  log.info('orchestrate: director model selected', {
    projectId: project_id,
    tier: modelSelection.tier,
    estimatedPages: modelSelection.estimatedPages,
    model: directorModel,
  });

  let directorJSON: DirectorJSON;

  try {
    // If script_text is provided but no scenes, run Director first
    if (script_text && (!scenes || scenes.length === 0)) {
      log.info('Running Director pipeline for orchestration', { projectId: project_id });

      const directorResult = await processScript({ project_id, script_text }, { directorModel });
      directorJSON = directorResult.director_json;

      log.info('Director pipeline complete', { projectId: project_id, sceneCount: directorJSON.scenes.length });
    } else {
      // Validate provided Director JSON before processing
      directorJSON = { project_id, scenes: scenes || [] };
      const directorValidation = DirectorJSONSchema.safeParse(directorJSON);
      if (!directorValidation.success) {
        res.status(400).json({
          status: 'error',
          project_id,
          message: 'Invalid Director JSON: ' + JSON.stringify(directorValidation.error.issues),
        } as OrchestrateResponse);
        return;
      }
      directorJSON = directorValidation.data;
    }

    log.info('Starting orchestration', { projectId: project_id, sceneCount: directorJSON.scenes.length });

    // Check if parallel processing is requested (default: true)
    const useParallel = req.query.parallel !== 'false';

    // Run the orchestration pipeline
    const result = useParallel
      ? await orchestrateParallel(directorJSON, (progress: PipelineProgress) => {
          log.info('Orchestration progress', { projectId: project_id, step: progress.step, percent: progress.percent, message: progress.message });
        }, emotion_overrides ?? {}, { chunkIndex: chunk_index })
      : await orchestrate(directorJSON, { chunkIndex: chunk_index });

    res.json({
      status: 'success',
      project_id,
      audio_urls: result.audio_urls || [],
      playback_manifest: result.manifest,
    } as OrchestrateResponse);
  } catch (error) {
    log.error('Orchestration failed', error instanceof Error ? error : new Error(String(error)), { projectId: project_id });
    res.status(500).json({
      status: 'error',
      project_id,
      message: error instanceof Error ? error.message : 'Unknown error',
    } as OrchestrateResponse);
  }
});

export default router;
