/**
 * POST /api/settings/audio-tuning/preview — B-004 from the build plan.
 *
 * Renders a SHORT audio sample using the user's most recent project as
 * source material, with the requested audio-tuning overrides applied.
 * The point is to let Ryan iterate on the sliders fast: ~30-60 seconds
 * per preview instead of 5-10 min for a full generation.
 *
 * How it works:
 *   1. Take the user's MOST RECENT project that has a `directorJson`
 *      (i.e. has at least gone through the director pipeline).
 *   2. Truncate the director scenes to just scene #1.
 *   3. POST that to the orchestrator's /orchestrate with
 *      `audio_tuning: <patch>` and `chunk_index: 0` so the output file
 *      is written as `episode-0.m4a` and doesn't clobber a real
 *      generation's final mix.
 *   4. Return the resulting audio URL — the client plays it for
 *      subjective evaluation.
 *
 * The patch passed in is NOT persisted. The user can iterate freely;
 * only the explicit lock via PATCH /api/settings/audio-tuning writes
 * to the DB.
 */

import { NextResponse } from 'next/server';
import { withAuth, errorResponse, parseBody } from '@/lib/api/middleware';
import { AudioTuningPatchSchema, DEFAULT_AUDIO_TUNING } from '@/lib/services/audio-tuning';
import { log } from '@/lib/logger';
import { z } from 'zod';

const PreviewRequestSchema = z.object({
  /** Tuning to apply for this preview (un-persisted). */
  tuning: AudioTuningPatchSchema,
  /**
   * Optional: which project to use as the source script. Defaults to
   * the user's most recent project with a director_json. Useful if Ryan
   * wants to A/B against a specific script.
   */
  projectId: z.string().uuid().optional(),
});

export const POST = withAuth(async (request, { userId, prisma }) => {
  const parsed = await parseBody(request, PreviewRequestSchema);
  if ('error' in parsed) return parsed.error;
  const { tuning, projectId: requestedProjectId } = parsed.data;

  // Find a source project to preview against
  const project = await prisma.project.findFirst({
    where: {
      userId,
      ...(requestedProjectId ? { id: requestedProjectId } : {}),
      directorJson: { not: null as unknown as undefined },
    },
    select: { id: true, directorJson: true },
    orderBy: { updatedAt: 'desc' },
  });

  if (!project || !project.directorJson) {
    return errorResponse(
      'No source project available for preview. Generate at least one script first, then come back here.',
      400,
      { code: 'NO_SOURCE_PROJECT' },
    );
  }

  // Truncate to scene 1 only — preview should be ~30s, not the full thing.
  interface DirJson { scenes?: unknown[]; project_id?: string }
  const director = project.directorJson as DirJson;
  if (!Array.isArray(director.scenes) || director.scenes.length === 0) {
    return errorResponse('Source project has no parsed scenes yet', 400, { code: 'NO_SCENES' });
  }
  const previewScenes = director.scenes.slice(0, 1);

  // Merge patch onto DEFAULT_AUDIO_TUNING so we send the COMPLETE shape
  // the orchestrator's zod schema expects (all four fields required).
  const audioTuning = {
    musicGainOffsetDb: tuning.musicGainOffsetDb ?? DEFAULT_AUDIO_TUNING.musicGainOffsetDb,
    ambienceGainOffsetDb: tuning.ambienceGainOffsetDb ?? DEFAULT_AUDIO_TUNING.ambienceGainOffsetDb,
    sfxGainOffsetDb: tuning.sfxGainOffsetDb ?? DEFAULT_AUDIO_TUNING.sfxGainOffsetDb,
    narrationSpeed: tuning.narrationSpeed ?? DEFAULT_AUDIO_TUNING.narrationSpeed,
  };

  const orchestratorUrl = process.env.ORCHESTRATOR_URL || 'http://localhost:22002';
  const serviceKey = process.env.SERVICE_SECRET_KEY;
  if (!serviceKey) {
    log.error('[audio-tuning preview] SERVICE_SECRET_KEY missing');
    return errorResponse('Preview service unavailable', 503, { code: 'CONFIG_ERROR' });
  }

  log.info('[audio-tuning preview] dispatching to orchestrator', {
    userId,
    projectId: project.id,
    audioTuning,
  });

  try {
    const orchResponse = await fetch(`${orchestratorUrl}/orchestrate?parallel=true`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Service-Key': serviceKey,
      },
      body: JSON.stringify({
        project_id: project.id,
        scenes: previewScenes,
        chunk_index: 0, // Writes episode-0.m4a — won't clobber the real episode.m4a
        audio_tuning: audioTuning,
      }),
      // Preview should not take more than ~3 min. Cap aggressively.
      signal: AbortSignal.timeout(180_000),
    });

    if (!orchResponse.ok) {
      const body = await orchResponse.text().catch(() => '');
      log.error('[audio-tuning preview] orchestrator returned non-OK', undefined, {
        status: orchResponse.status,
        body: body.slice(0, 200),
      });
      return errorResponse(
        'Preview generation failed — try again in a moment.',
        502,
        { code: 'ORCHESTRATOR_ERROR' },
      );
    }

    const result = (await orchResponse.json()) as { audio_urls?: string[]; playback_manifest?: { audio_urls?: string[] } };
    const audioUrl = result.audio_urls?.[0] ?? result.playback_manifest?.audio_urls?.[0];

    if (!audioUrl) {
      return errorResponse('Preview generated but no audio URL returned', 500, { code: 'NO_AUDIO_URL' });
    }

    return NextResponse.json({
      data: {
        audioUrl,
        projectId: project.id,
        sceneCount: previewScenes.length,
        appliedTuning: audioTuning,
      },
    });
  } catch (err) {
    log.error('[audio-tuning preview] dispatch failed', err);
    return errorResponse(
      'Preview generation failed — the orchestrator may be down. Try again in a moment.',
      503,
      { code: 'ORCHESTRATOR_UNREACHABLE' },
    );
  }
}, { rateLimit: 'strict' });
