import { Router, Request, Response } from 'express';
import { OrchestrateRequestSchema, DirectorJSONSchema, OrchestrateResponse, type DirectorJSON } from '../schemas/director-json.js';
import { processScript } from '../director/pipeline.js';
import { orchestrate } from '../orchestrator/pipeline.js';

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

  let { project_id, scenes, script_text } = parsed.data;
  let directorJSON: DirectorJSON;

  try {
    // If script_text is provided but no scenes, run Director first
    if (script_text && (!scenes || scenes.length === 0)) {
      console.log(`🎬 [orchestrate] Running Director pipeline for project: ${project_id}`);

      const directorResult = await processScript({ project_id, script_text });
      directorJSON = directorResult.director_json;

      console.log(`✅ [orchestrate] Director complete: ${directorJSON.scenes.length} scenes`);
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

    console.log(`🎬 [orchestrate] Starting orchestration for project: ${project_id}`);
    console.log(`📋 Scenes to process: ${directorJSON.scenes.length}`);

    // Run the orchestration pipeline
    const result = await orchestrate(directorJSON);

    res.json({
      status: 'success',
      project_id,
      audio_urls: result.audio_urls || [],
      playback_manifest: result.manifest,
    } as OrchestrateResponse);
  } catch (error) {
    console.error(`❌ [orchestrate] Error:`, error);
    res.status(500).json({
      status: 'error',
      project_id,
      message: error instanceof Error ? error.message : 'Unknown error',
    } as OrchestrateResponse);
  }
});

export default router;
