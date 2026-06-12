import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { SceneSchema } from '../schemas/director-json.js';
import { generatePreview } from '../orchestrator/preview-pipeline.js';
import { log } from '../lib/logger.js';

const router = Router();

const PreviewRequestSchema = z.object({
  // Strict UUID — see OrchestrateRequestSchema for rationale.
  project_id: z.string().uuid('project_id must be a valid UUID'),
  scene: SceneSchema,
});

/**
 * POST /preview
 *
 * Generates a 15-second audio preview for a single scene.
 *
 * Request body:
 *   - project_id: string
 *   - scene: Scene object with dialogue, music, ambience, sfx
 *
 * Response:
 *   - status: 'success' | 'error'
 *   - project_id: string
 *   - scene_id: string
 *   - preview_url: string | null
 *   - duration_seconds: number
 */
router.post('/preview', async (req: Request, res: Response): Promise<void> => {
  const parsed = PreviewRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      status: 'error',
      message: 'Invalid request: ' + JSON.stringify(parsed.error.issues),
    });
    return;
  }

  const { project_id, scene } = parsed.data;

  try {
    log.info('Generating scene preview', { projectId: project_id, sceneId: scene.scene_id });

    const result = await generatePreview(project_id, scene);

    res.json({
      status: 'success',
      project_id: result.project_id,
      scene_id: result.scene_id,
      preview_url: result.preview_url,
      preview_path: result.preview_path,
      duration_seconds: result.duration_seconds,
    });
  } catch (error) {
    log.error('Preview generation failed', error instanceof Error ? error : new Error(String(error)), { projectId: project_id, sceneId: scene.scene_id });
    res.status(500).json({
      status: 'error',
      project_id,
      scene_id: scene.scene_id,
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
