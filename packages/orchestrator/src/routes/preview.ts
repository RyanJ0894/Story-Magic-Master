import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { SceneSchema } from '../schemas/director-json.js';
import { generatePreview } from '../orchestrator/preview-pipeline.js';
import { log } from '../lib/logger.js';
import { setProjectScope } from '../lib/sentry.js';

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
  setProjectScope(project_id);

  // PR ε (2026-06-24): SSE conversion — preview pipeline runs TTS + mix on
  // a single scene, which is normally fast but can exceed Render's ~300 s
  // inter-service proxy timeout when ElevenLabs is degraded. Heartbeat
  // every 25 s keeps the connection (and undici's body-read timer) alive.
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
    log.info('Generating scene preview', { projectId: project_id, sceneId: scene.scene_id });

    const result = await generatePreview(project_id, scene);

    sendEvent({
      type: 'result',
      status: 'success',
      project_id: result.project_id,
      scene_id: result.scene_id,
      preview_url: result.preview_url,
      preview_path: result.preview_path,
      duration_seconds: result.duration_seconds,
    });
    res.end();
  } catch (error) {
    log.error('Preview generation failed', error instanceof Error ? error : new Error(String(error)), { projectId: project_id, sceneId: scene.scene_id });
    sendEvent({
      type: 'result',
      status: 'error',
      project_id,
      scene_id: scene.scene_id,
      message: error instanceof Error ? error.message : 'Unknown error',
    });
    res.end();
  } finally {
    clearInterval(heartbeat);
  }
});

export default router;
