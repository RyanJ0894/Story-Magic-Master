import { Router, Request, Response } from 'express';
import { GenerateScenesRequestSchema, GenerateScenesResponse } from '../schemas/director-json.js';
import { processScript } from '../director/pipeline.js';
import { log } from '../lib/logger.js';
import { getEnv } from '../lib/env.js';
import { prisma } from '../lib/prisma.js';
import { checkAIProviders } from '../lib/ai-health.js';
import { setProjectScope } from '../lib/sentry.js';
import { generateRequestId, runWithRequestContext } from '../lib/request-context.js';

const router = Router();

/**
 * POST /generate-scenes
 *
 * Parses a screenplay and generates Director JSON with voice assignments and audio cues.
 * This is the TypeScript port of the Python Director service.
 *
 * Request body:
 *   - project_id: string
 *   - script_text: string
 *
 * Response:
 *   - project_id: string
 *   - success: boolean
 *   - scene_count: number
 *   - processing_time: number (seconds)
 *   - director_json: DirectorJSON (full output)
 *   - validation_report: ValidationReport
 */
router.post('/generate-scenes', async (req: Request, res: Response): Promise<void> => {
  const upstreamId = (req.headers['x-request-id'] || req.headers['rndr-id']) as string | undefined;
  const requestId = upstreamId || generateRequestId();
  res.setHeader('X-Request-ID', requestId);

  await runWithRequestContext({ requestId, projectId: req.body?.project_id }, async () => {
    await handleGenerateScenes(req, res);
  });
});

async function handleGenerateScenes(req: Request, res: Response): Promise<void> {
  const start = Date.now();

  // Validate request
  const parsed = GenerateScenesRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      project_id: req.body?.project_id || 'unknown',
      success: false,
      message: 'Invalid request: ' + JSON.stringify(parsed.error.issues),
    } as GenerateScenesResponse);
    return;
  }

  const { project_id, script_text, voice_overrides, director_notes, run_consistency_check } = parsed.data;
  setProjectScope(project_id);

  // Ownership check (BL-013): authenticated user must own this project.
  // req.user is populated by authMiddleware; AUTH_DISABLED skips this safely
  // because it only runs in non-production environments.
  const requestingUserId = req.user?.id;
  if (requestingUserId) {
    try {
      const project = await prisma.project.findUnique({
        where: { id: project_id },
        select: { userId: true },
      });
      if (!project) {
        res.status(404).json({
          project_id,
          success: false,
          message: 'Project not found',
        } as GenerateScenesResponse);
        return;
      }
      if (project.userId !== requestingUserId) {
        log.warn('generate-scenes: ownership check failed', { projectId: project_id, requestingUserId });
        res.status(403).json({
          project_id,
          success: false,
          message: 'Forbidden: you do not own this project',
        } as GenerateScenesResponse);
        return;
      }
    } catch (err) {
      // Non-fatal: if DB is unavailable, log and continue (allows dev without DB)
      log.warn('generate-scenes: ownership check skipped (DB unavailable)', { projectId: project_id });
    }
  }

  // Pre-flight: verify AI provider keys are reachable before committing
  // to a long-running batch job.  Probes are zero-cost (model-list endpoints).
  const preflight = await checkAIProviders('preflight');
  if (!preflight.canProceed) {
    const detail = preflight.results
      .filter((r) => r.status === 'down')
      .map((r) => `${r.provider}: ${r.errorCode ?? 'down'}`)
      .join(', ');
    log.error('generate-scenes: AI preflight failed — aborting job', undefined, {
      projectId: project_id,
      blockedBy: preflight.blockedBy,
      detail,
    });
    res.status(503).json({
      project_id,
      success: false,
      message: `AI services unavailable — please retry in a few minutes. (${detail})`,
    } as GenerateScenesResponse);
    return;
  }

  // Pre-flight: enforce script size limits before any LLM call
  const { MAX_SCRIPT_CHARS, MAX_SCRIPT_PAGES } = getEnv();
  if (script_text.length > MAX_SCRIPT_CHARS) {
    res.status(400).json({
      project_id,
      success: false,
      message: `Script exceeds character limit (${script_text.length.toLocaleString()} > ${MAX_SCRIPT_CHARS.toLocaleString()} chars). Please reduce script length or contact support for extended limits.`,
    } as GenerateScenesResponse);
    return;
  }
  // Estimate page count: ~2,200 chars/page (standard screenplay format with
  // whitespace, action lines, dialogue).  The prior 500 chars/page estimate
  // was ~4× too low — a 30-page script (66K chars) was reported as ~132 pages,
  // triggering false 400 rejections against a 150-page limit.
  const estimatedPages = Math.ceil(script_text.length / 2_200);
  if (estimatedPages > MAX_SCRIPT_PAGES) {
    res.status(400).json({
      project_id,
      success: false,
      message: `Script exceeds page limit (~${estimatedPages} pages > ${MAX_SCRIPT_PAGES} pages). Please reduce script length or contact support for extended limits.`,
    } as GenerateScenesResponse);
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
    log.warn('generate-scenes: advanced analysis purchase check skipped (DB unavailable)', { projectId: project_id });
  }

  const { DIRECTOR_MODEL, DIRECTOR_MODEL_ADVANCED } = getEnv();
  const directorModel = useAdvancedModel ? DIRECTOR_MODEL_ADVANCED : DIRECTOR_MODEL;

  if (useAdvancedModel) {
    log.info('generate-scenes: Advanced Analysis active — using upgraded model', { projectId: project_id, model: directorModel });
  }

  // Attach model to req so pino-http can include it in access log error messages
  (req as unknown as Record<string, unknown>).llmModel = directorModel;

  // ── Phase 2: long-running director pipeline — switch to SSE ─────────────────
  // Same fix as #394 ported to /generate-scenes. Render's proxy closes
  // inter-service connections after ~300 s without any response bytes,
  // regardless of instance size. For 10-page+ scripts the director phase
  // (CharacterExtraction + VoiceMap + SceneConstruction + AudioDirectorAgent +
  // OpenAI embedding lookups, all serial under TTS_CONCURRENCY=2) routinely
  // crosses 300 s, so we stream SSE comments to keep the connection alive
  // and send the final result as a single SSE data event. The web-side
  // orchestratorGenerate already handles both JSON and SSE responses
  // transparently — no client change needed.
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable nginx/Cloudflare response buffering
  res.flushHeaders();

  const sendEvent = (data: object): void => {
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    }
  };

  // Node.js undici (native fetch) has a 300 s body-read timeout that fires if
  // no bytes arrive while the caller is consuming the SSE stream. processScript
  // has no progress callback — the entire director run is a single opaque
  // operation that can take minutes — so a heartbeat comment every 25 s is
  // the only thing keeping the body-read timer from firing. Comments
  // (": …\n\n") are valid SSE protocol and are silently discarded by any SSE
  // parser or response.text() consumer.
  const heartbeat = setInterval(() => {
    if (!res.writableEnded) res.write(': heartbeat\n\n');
  }, 25_000);

  try {
    log.info('Starting scene generation', { projectId: project_id, scriptLength: script_text.length, estimatedPages, model: directorModel });
    if (voice_overrides && Object.keys(voice_overrides).length > 0) {
      log.info('Voice overrides provided', { projectId: project_id, overrideCount: Object.keys(voice_overrides).length, characters: Object.keys(voice_overrides) });
    }

    // Run the full Director pipeline:
    // 1. DirectorAgent parses script → Director JSON with voice assignments
    // 2. Apply user voice overrides (if any)
    // 3. AudioDirectorAgent selects audio → Scene Audio JSON
    // 4. Validators check and auto-correct business rules
    // 5. Merge results into final Director JSON
    const result = await processScript(
      { project_id, script_text, voice_overrides, director_notes },
      { directorModel, runConsistencyCheck: run_consistency_check === true },
    );

    const processingTime = (Date.now() - start) / 1000;
    log.info('Scene generation complete', { projectId: project_id, processingTimeSeconds: processingTime, sceneCount: result.director_json.scenes.length });

    sendEvent({
      type: 'result',
      project_id,
      success: true,
      scene_count: result.director_json.scenes.length,
      processing_time: processingTime,
      // Include full results for downstream processing
      director_json: result.director_json,
      validation_report: result.validation_report,
    });
    res.end();
  } catch (error) {
    log.error('Scene generation failed', error instanceof Error ? error : new Error(String(error)), { projectId: project_id, model: directorModel });
    // Once SSE headers are flushed, the HTTP status is locked at 200 —
    // errors are conveyed in the final `data:` event body. The web-side
    // orchestratorFetch wrapper maps `status: 'error'` → HTTP 500 for the
    // synthetic Response so callers see the existing contract.
    sendEvent({
      type: 'result',
      project_id,
      success: false,
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
      processing_time: (Date.now() - start) / 1000,
    });
    res.end();
  } finally {
    clearInterval(heartbeat);
  }
}

export default router;
