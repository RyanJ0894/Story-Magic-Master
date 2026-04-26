import { Router, Request, Response } from 'express';
import { GenerateScenesRequestSchema, GenerateScenesResponse } from '../schemas/director-json.js';
import { processScript } from '../director/pipeline.js';
import { log } from '../lib/logger.js';
import { getEnv } from '../lib/env.js';

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

  const { project_id, script_text, voice_overrides } = parsed.data;

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
  // Estimate page count: ~500 chars per page (average screenplay line density)
  const estimatedPages = Math.ceil(script_text.length / 500);
  if (estimatedPages > MAX_SCRIPT_PAGES) {
    res.status(400).json({
      project_id,
      success: false,
      message: `Script exceeds page limit (~${estimatedPages} pages > ${MAX_SCRIPT_PAGES} pages). Please reduce script length or contact support for extended limits.`,
    } as GenerateScenesResponse);
    return;
  }

  try {
    log.info('Starting scene generation', { projectId: project_id, scriptLength: script_text.length, estimatedPages });
    if (voice_overrides && Object.keys(voice_overrides).length > 0) {
      log.info('Voice overrides provided', { projectId: project_id, overrideCount: Object.keys(voice_overrides).length, characters: Object.keys(voice_overrides) });
    }

    // Run the full Director pipeline:
    // 1. DirectorAgent parses script → Director JSON with voice assignments
    // 2. Apply user voice overrides (if any)
    // 3. AudioDirectorAgent selects audio → Scene Audio JSON
    // 4. Validators check and auto-correct business rules
    // 5. Merge results into final Director JSON
    const result = await processScript({ project_id, script_text, voice_overrides });

    const processingTime = (Date.now() - start) / 1000;
    log.info('Scene generation complete', { projectId: project_id, processingTimeSeconds: processingTime, sceneCount: result.director_json.scenes.length });

    res.json({
      project_id,
      success: true,
      scene_count: result.director_json.scenes.length,
      processing_time: processingTime,
      // Include full results for downstream processing
      director_json: result.director_json,
      validation_report: result.validation_report,
    });
  } catch (error) {
    log.error('Scene generation failed', error instanceof Error ? error : new Error(String(error)), { projectId: project_id });
    res.status(500).json({
      project_id,
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
      processing_time: (Date.now() - start) / 1000,
    } as GenerateScenesResponse);
  }
});

export default router;
