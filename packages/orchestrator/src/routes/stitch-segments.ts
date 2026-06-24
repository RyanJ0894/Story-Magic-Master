import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { concatScenesWithCrossfade } from '../orchestrator/workers/export.js';
import { getOutputDir } from '../lib/env.js';
import { log } from '../lib/logger.js';
import { maybeUploadEpisodeToS3 } from '../lib/s3.js';

const router = Router();

const StitchRequestSchema = z.object({
  project_id: z.string().regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    'project_id must be a UUID'
  ),
  segment_count: z.number().int().min(1).max(50),
});

/**
 * Resolve the project output directory and verify it is nested within the
 * audio output base. path.resolve() + startsWith() is the confinement proof
 * that prevents traversal even if project_id somehow escapes UUID validation.
 */
function resolveConfinedProjectDir(projectId: string): string {
  const outputBase = path.resolve(getOutputDir());
  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
  const candidate = path.resolve(outputBase, path.basename(projectId));
  if (!candidate.startsWith(outputBase + path.sep)) {
    throw new Error(`Path traversal detected for project ${projectId}`);
  }
  return candidate;
}

/**
 * POST /stitch-segments
 *
 * Concatenates episode-0.m4a … episode-(N-1).m4a into the final episode.m4a.
 * Called by the web processor after all chunks of a chunked generation complete.
 *
 * Request body:
 *   - project_id: UUID string
 *   - segment_count: number of segments to stitch (1..50)
 */
router.post('/stitch-segments', async (req: Request, res: Response): Promise<void> => {
  const parsed = StitchRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      status: 'error',
      message: 'Invalid request: ' + JSON.stringify(parsed.error.issues),
    });
    return;
  }

  const { project_id, segment_count } = parsed.data;

  let projectDir: string;
  try {
    projectDir = resolveConfinedProjectDir(project_id);
  } catch {
    res.status(400).json({ status: 'error', message: 'Invalid project path' });
    return;
  }

  log.info('stitch-segments: starting', { projectId: project_id, segmentCount: segment_count });

  // PR ε (2026-06-24): Phase 1 — pre-flight as plain JSON so segment-missing
  // 422s still surface as proper HTTP status codes. SSE flush is the lock
  // point: after flushHeaders() the response is HTTP 200 forever. Mirrors
  // /orchestrate's two-phase split in PR #394.
  const segmentPaths: string[] = [];
  for (let i = 0; i < segment_count; i++) {
    // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal, javascript.express.security.audit.express-path-join-resolve-traversal.express-path-join-resolve-traversal
    const segPath = path.join(projectDir, `episode-${i}.m4a`);
    if (!fs.existsSync(segPath)) {
      res.status(422).json({
        status: 'error',
        message: `Segment file not found: episode-${i}.m4a for project ${project_id}`,
      });
      return;
    }
    segmentPaths.push(segPath);
  }

  // Phase 2 — SSE. The ffmpeg concat + optional S3 upload is the long part;
  // a 50-segment full-script stitch + multi-MB S3 PUT can easily exceed
  // Render's ~300 s inter-service proxy timeout.
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
    // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal, javascript.express.security.audit.express-path-join-resolve-traversal.express-path-join-resolve-traversal
    const episodePath = path.join(projectDir, 'episode.m4a');
    await concatScenesWithCrossfade(segmentPaths, episodePath, { fadeDuration: 1.5, fadeType: 'tri' });

    const safeId = path.basename(project_id);
    const s3Url = await maybeUploadEpisodeToS3(episodePath, safeId);
    const audioUrl = s3Url ?? `/audio/${safeId}/episode.m4a`;
    log.info('stitch-segments: complete', { projectId: project_id, audioUrl, storage: s3Url ? 's3' : 'local' });

    sendEvent({ type: 'result', status: 'success', audio_url: audioUrl });
    res.end();
  } catch (error) {
    log.error(
      'stitch-segments: failed',
      error instanceof Error ? error : new Error(String(error)),
      { projectId: project_id }
    );
    sendEvent({
      type: 'result',
      status: 'error',
      message: error instanceof Error ? error.message : 'Stitch failed',
    });
    res.end();
  } finally {
    clearInterval(heartbeat);
  }
});

export default router;
