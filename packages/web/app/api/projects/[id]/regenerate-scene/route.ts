/**
 * Scene Regeneration API Route
 *
 * POST /api/projects/:id/regenerate-scene
 *
 * Regenerates audio for a single scene by sending a single-scene array
 * to the orchestrator. Uses strict rate limiting since each regen triggers TTS.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@clerk/nextjs/server';
import { withProjectAuth, parseBody } from '@/lib/api/middleware';
import { enqueue } from '@/lib/queue/service';
import { log } from '@/lib/logger';

const RegenerateSceneSchema = z.object({
  sceneIndex: z.number().int().min(0, 'Scene index must be non-negative'),
});

export const POST = withProjectAuth(
  async (request, { userId, projectId, project }) => {
    // Parse and validate body
    const parsed = await parseBody(request, RegenerateSceneSchema);
    if ('error' in parsed) return parsed.error;
    const { sceneIndex } = parsed.data;

    // Get director_json from project
    const directorJson = project.director_json as {
      scenes?: Array<Record<string, unknown>>;
    } | null;

    if (!directorJson?.scenes || directorJson.scenes.length === 0) {
      return NextResponse.json(
        { error: 'Project has no generated scenes', code: 'NO_SCENES' },
        { status: 404 },
      );
    }

    if (sceneIndex >= directorJson.scenes.length) {
      return NextResponse.json(
        {
          error: `Scene index ${sceneIndex} out of range (0-${directorJson.scenes.length - 1})`,
          code: 'SCENE_OUT_OF_RANGE',
        },
        { status: 400 },
      );
    }

    const targetScene = directorJson.scenes[sceneIndex];

    // Get session token for orchestrator API calls
    const { getToken } = await auth();
    const accessToken = await getToken();

    // Enqueue a scene_regeneration job
    const result = await enqueue({
      projectId,
      userId,
      jobType: 'scene_regeneration',
      priority: 1, // Higher priority than full generations
      metadata: {
        sceneIndex,
        scene: targetScene,
        accessToken,
      },
    });

    log.info('Scene regeneration queued', {
      jobId: result.jobId.slice(0, 8),
      projectId,
      sceneIndex,
    });

    return NextResponse.json({
      jobId: result.jobId,
      status: 'queued',
      sceneIndex,
    });
  },
  { rateLimit: 'strict' },
);
