/**
 * Generation Job Processor
 *
 * Core background processing logic for audio generation jobs.
 * Extracted from the generate API route to be callable from the queue worker.
 */

import { prisma } from '@/lib/db';
import { log } from '@/lib/logger';
import { orchestratorGenerate } from '@/lib/orchestrator-fetch';
import { dispatchWebhooks } from '@/lib/webhooks/deliver';
import { triggerHumanReviewIfPurchased } from '@/lib/human-review/trigger';
import { chunkScenes, segmentProgressLabel } from '@/lib/generation/chunk-script';

// =============================================================================
// Logging Helpers
// =============================================================================

function logProgress(jobId: string, step: string, message: string) {
  log.info(message, { jobId: jobId.slice(0, 8), step });
}

async function logJobEvent(
  jobId: string,
  projectId: string,
  level: 'debug' | 'info' | 'warn' | 'error',
  step: string,
  message: string,
  metadata: Record<string, string | number | boolean | null> = {},
  errorMessage?: string,
  errorStack?: string
) {
  try {
    await prisma.jobLog.create({
      data: {
        jobId,
        projectId,
        level,
        step,
        message,
        metadata,
        errorMessage: errorMessage ?? null,
        errorStack: errorStack ?? null,
      },
    });
  } catch (error) {
    log.error('Failed to write job log', error);
  }
}

async function markJobFailed(
  jobId: string,
  projectId: string,
  errorMessage: string,
  errorStack?: string
) {
  const now = new Date().toISOString();

  await logJobEvent(jobId, projectId, 'error', 'failed', errorMessage, {}, errorMessage, errorStack);

  await prisma.job.update({
    where: { id: jobId },
    data: {
      status: 'failed',
      error: errorMessage,
      progress: { step: 'failed', percent: 0, details: errorMessage, updated_at: now },
    },
  });

  await prisma.project.update({
    where: { id: projectId },
    data: { status: 'failed' },
  });

  logProgress(jobId, 'error', `Job marked as failed: ${errorMessage}`);
}

// =============================================================================
// Generation Job Processor
// =============================================================================

export async function processGenerationJob(
  projectId: string,
  jobId: string,
  userId: string,
  scriptText: string,
  pageCount: number,
  voiceOverrides: Record<string, string> = {}
) {
  const jobStart = Date.now();
  const elapsed = () => Math.round((Date.now() - jobStart) / 1000);

  const updateJobProgress = async (step: string, percent: number, details?: string, metadata: Record<string, unknown> = {}) => {
    const progressData = {
      step,
      percent,
      details: details || '',
      updated_at: new Date().toISOString(),
    };
    const msg = `[${elapsed()}s] ${percent}% — ${details || 'Processing...'}`;
    logProgress(jobId, step, msg);

    await logJobEvent(jobId, projectId, 'info', step, details || 'Processing...', {
      percent,
      elapsedSec: elapsed(),
      ...metadata,
    });

    await prisma.job.update({
      where: { id: jobId },
      data: { progress: progressData },
    });
  };

  try {
    // Step 1: Start processing
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: 'processing',
        startedAt: new Date(),
      },
    });

    log.info('[PIPELINE] start', { jobId: jobId.slice(0, 8), projectId, pageCount, scriptLength: scriptText.length });
    await updateJobProgress('initializing', 5, 'Starting generation pipeline...');

    // Step 2: Parse script via Director Agent (skip if a prior run already produced directorJson)
    const existingProject = await prisma.project.findUnique({
      where: { id: projectId },
      select: { directorJson: true, directorNotes: true },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existingDirectorJson = existingProject?.directorJson as any;
    const hasExistingParse = Array.isArray(existingDirectorJson?.scenes) && existingDirectorJson.scenes.length > 0;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let directorJson: any;

    if (hasExistingParse) {
      directorJson = existingDirectorJson;
      const sceneCount = directorJson.scenes?.length || 0;
      const lineCount = directorJson.scenes?.reduce((acc: number, s: { dialogue?: unknown[] }) => acc + (s.dialogue?.length || 0), 0) || 0;
      logProgress(jobId, 'parsing', `Reusing existing director parse: ${sceneCount} scenes, ${lineCount} lines`);
      await updateJobProgress('parsing_complete', 25, `Using cached parse: ${sceneCount} scenes, ${lineCount} lines`);
    } else {
      await updateJobProgress('parsing', 10, 'Parsing script and assigning voices...');

      const directorStart = Date.now();
      log.info('[PIPELINE] director start', { jobId: jobId.slice(0, 8), elapsedSec: elapsed() });

      const generateScenesBody: Record<string, unknown> = {
        project_id: projectId,
        script_text: scriptText,
      };
      if (Object.keys(voiceOverrides).length > 0) {
        generateScenesBody.voice_overrides = voiceOverrides;
        log.info('[PIPELINE] voice overrides', { count: Object.keys(voiceOverrides).length });
      }
      if (existingProject?.directorNotes) {
        generateScenesBody.director_notes = JSON.stringify(existingProject.directorNotes);
        log.info('[PIPELINE] director notes attached');
      }

      const directorResponse = await orchestratorGenerate('/generate-scenes', generateScenesBody);

      const directorSec = Math.round((Date.now() - directorStart) / 1000);

      if (!directorResponse.ok) {
        const errorBody = await directorResponse.text();
        log.error('[PIPELINE] director failed', undefined, { jobId: jobId.slice(0, 8), directorSec, errorBody: errorBody.slice(0, 500) });
        await logJobEvent(jobId, projectId, 'error', 'parsing', `Director Agent failed after ${directorSec}s`, { directorSec }, errorBody.slice(0, 500));
        throw new Error(`Director Agent failed: ${errorBody}`);
      }

      const directorResponse_json = await directorResponse.json();
      directorJson = directorResponse_json.director_json || directorResponse_json;

      const sceneCount = directorJson.scenes?.length || 0;
      const lineCount = directorJson.scenes?.reduce((acc: number, s: { dialogue?: unknown[] }) => acc + (s.dialogue?.length || 0), 0) || 0;
      const characterSet = new Set<string>();
      for (const scene of directorJson.scenes || []) {
        for (const line of scene.dialogue || []) {
          if ((line as { character?: string }).character) characterSet.add((line as { character: string }).character);
        }
      }

      log.info('[PIPELINE] director complete', {
        jobId: jobId.slice(0, 8),
        directorSec,
        sceneCount,
        lineCount,
        characterCount: characterSet.size,
        elapsedSec: elapsed(),
      });

      await updateJobProgress('parsing_complete', 25, `Parsed ${sceneCount} scenes, ${lineCount} lines, ${characterSet.size} characters`, {
        directorSec, sceneCount, lineCount, characterCount: characterSet.size,
      });

      // Save director JSON to project for future retry reuse
      await prisma.project.update({
        where: { id: projectId },
        data: { directorJson },
      });
    }

    // Check for cancellation before starting the long orchestration phase
    const jobAfterParsing = await prisma.job.findUnique({
      where: { id: jobId },
      select: { status: true },
    });
    if (jobAfterParsing?.status === 'failed') {
      logProgress(jobId, 'cancelled', 'Job cancelled by user after parsing');
      return;
    }

    // (directorJson already saved above when freshly parsed; no-op on retry)

    // Apply audio overrides from project settings
    const projectData = await prisma.project.findUnique({
      where: { id: projectId },
      select: { audioOverrides: true },
    });

    const audioOverrides = Array.isArray(projectData?.audioOverrides)
      ? (projectData.audioOverrides as Array<Record<string, unknown>>).filter(
          (o) => o.user_selected && o.file && o.scene_id
        )
      : [];

    if (audioOverrides.length > 0) {
      for (const override of audioOverrides) {
        const scene = directorJson.scenes?.find(
          (s: { scene_id: string }) => s.scene_id === override.scene_id
        );
        if (!scene) continue;
        const cueArray = scene[override.category as string];
        if (!Array.isArray(cueArray) || (override.cue_index as number) >= cueArray.length) continue;
        cueArray[override.cue_index as number] = {
          ...cueArray[override.cue_index as number],
          file: override.file,
          reasoning: 'User override',
        };
      }
      await updateJobProgress('audio_overrides', 27, `Applied ${audioOverrides.length} audio override(s)`);
    }

    // Step 3: Split scenes into chunks and process each segment independently.
    // This prevents timeout on long scripts — each chunk is ~14 scenes (~90–120s of TTS).
    const allScenes: unknown[] = directorJson.scenes || [];
    const chunks = chunkScenes(allScenes);

    // Orchestrator base URL — needed to absolutize local /audio/ paths before writing them
    // to the job record. These paths are later read by the BROWSER (not the server), so they
    // must point to the orchestrator host, not the Next.js frontend.
    const orchestratorBase = (process.env.ORCHESTRATOR_URL ?? '').replace(/\/$/, '');
    const isChunked = chunks.length > 1;

    log.info('[PIPELINE] orchestrator start', {
      jobId: jobId.slice(0, 8),
      totalScenes: allScenes.length,
      segments: chunks.length,
      elapsedSec: elapsed(),
    });

    // Segment status tracker written to jobs.segments after each chunk
    type SegmentStatus = {
      index: number;
      status: 'pending' | 'processing' | 'ready' | 'failed';
      audioUrl: string | null;
    };

    const segmentStatuses: SegmentStatus[] = chunks.map((c) => ({
      index: c.index,
      status: 'pending',
      audioUrl: null,
    }));

    const allAudioUrls: string[] = [];
    let lastManifest: Record<string, unknown> | null = null;
    let audioOutputsCreated = 0;
    let orchestratorResult: Record<string, unknown> = {};

    const baseProgressPercent = 30; // percent at start of audio generation
    const progressRangePercent = 55; // 30–85% is the audio generation window

    for (const chunk of chunks) {
      const label = segmentProgressLabel(chunk, chunks.length);
      const chunkProgressPercent = baseProgressPercent +
        Math.round((chunk.index / chunks.length) * progressRangePercent);

      // Update segment status to processing
      segmentStatuses[chunk.index].status = 'processing';
      await updateJobProgress('generating_audio', chunkProgressPercent, label);
      await prisma.job.update({
        where: { id: jobId },
        data: { segments: JSON.parse(JSON.stringify(segmentStatuses)) },
      });

      const chunkStart = Date.now();
      const orchestratorResponse = await orchestratorGenerate('/orchestrate', {
        project_id: projectId,
        scenes: chunk.scenes,
        chunk_index: chunk.index,
      });
      const chunkSec = Math.round((Date.now() - chunkStart) / 1000);

      if (!orchestratorResponse.ok) {
        const errorBody = await orchestratorResponse.text();
        const msg = `Orchestrator failed on segment ${chunk.index + 1}/${chunks.length} after ${chunkSec}s`;
        log.error('[PIPELINE] orchestrator chunk failed', undefined, {
          jobId: jobId.slice(0, 8), chunkIndex: chunk.index, chunkSec, errorBody: errorBody.slice(0, 500),
        });
        await logJobEvent(jobId, projectId, 'error', 'generating_audio', msg, { chunkIndex: chunk.index, chunkSec }, errorBody.slice(0, 500));

        // Mark this segment failed; continue with remaining segments (partial audio)
        segmentStatuses[chunk.index].status = 'failed';
        await prisma.job.update({
          where: { id: jobId },
          data: { segments: JSON.parse(JSON.stringify(segmentStatuses)) },
        });
        continue;
      }

      orchestratorResult = await orchestratorResponse.json() as Record<string, unknown>;
      const chunkAudioUrls: string[] = (orchestratorResult.audio_urls as string[] | undefined) || [];
      const manifest = orchestratorResult.playback_manifest as Record<string, unknown> | undefined;
      lastManifest = manifest ?? lastManifest;

      log.info('[PIPELINE] orchestrator chunk complete', {
        jobId: jobId.slice(0, 8),
        chunkIndex: chunk.index,
        chunkSec,
        audioUrls: chunkAudioUrls.length,
        elapsedSec: elapsed(),
      });

      // Persist audio output records for this chunk
      for (const audioUrl of chunkAudioUrls) {
        if (!audioUrl) continue;
        const fileName = audioUrl.split('/').pop() || 'output.mp3';
        const supabaseMatch = audioUrl.match(/\/storage\/v1\/object\/public\/(.+)$/);
        const localMatch = audioUrl.match(/^\/audio\/(.+)$/);
        const filePath = supabaseMatch
          ? supabaseMatch[1]
          : localMatch
            ? localMatch[1]
            : `${projectId}/${fileName}`;
        await prisma.audioOutput.create({
          data: {
            projectId,
            jobId,
            fileName,
            filePath,
            durationSeconds: manifest?.total_duration as number ?? null,
            format: fileName.endsWith('.m4a') ? 'm4a' : 'mp3',
          },
        });
        allAudioUrls.push(audioUrl);
        audioOutputsCreated++;
      }

      // Mark segment ready; set firstAudioUrl on first successful chunk (Sprint L Fast Start)
      const segmentAudioUrl = chunkAudioUrls[0] ?? null;
      const absSegmentUrl = segmentAudioUrl?.startsWith('/')
        ? `${orchestratorBase}${segmentAudioUrl}`
        : segmentAudioUrl;
      segmentStatuses[chunk.index].status = 'ready';
      segmentStatuses[chunk.index].audioUrl = absSegmentUrl ?? null;

      // Fire firstAudioUrl on the very first chunk to succeed (not necessarily index 0)
      const isFirstSuccessfulChunk = segmentAudioUrl && allAudioUrls.length === chunkAudioUrls.filter(Boolean).length;
      const updateData: Record<string, unknown> = {
        segments: JSON.parse(JSON.stringify(segmentStatuses)),
      };
      if (isFirstSuccessfulChunk) {
        updateData.firstAudioUrl = absSegmentUrl;
        updateData.progress = {
          step: 'first_audio_ready',
          percent: chunkProgressPercent + Math.round(progressRangePercent / chunks.length),
          details: isChunked
            ? 'Audio started — continuing generation in background…'
            : 'Audio ready',
          updated_at: new Date().toISOString(),
        };
      }
      await prisma.job.update({ where: { id: jobId }, data: updateData });
    }

    // Guard: at least one chunk must have produced audio
    if (audioOutputsCreated === 0) {
      throw new Error(
        'Orchestrator returned no usable audio URLs across all segments. ' +
        `Segments attempted: ${chunks.length}. ` +
        `Last result: ${JSON.stringify(orchestratorResult?.audio_urls ?? [])}`
      );
    }

    // Sprint K: stitch segment files into a single episode.m4a when chunked
    const rawFirstUrl = allAudioUrls[0] ?? null;
    let finalAudioUrl: string | null = rawFirstUrl?.startsWith('/')
      ? `${orchestratorBase}${rawFirstUrl}`
      : rawFirstUrl;
    if (isChunked && audioOutputsCreated > 0) {
      try {
        const stitchResponse = await orchestratorGenerate('/stitch-segments', {
          project_id: projectId,
          segment_count: chunks.length,
        });
        if (stitchResponse.ok) {
          const stitchResult = await stitchResponse.json() as Record<string, unknown>;
          if (typeof stitchResult.audio_url === 'string') {
            const raw = stitchResult.audio_url;
            finalAudioUrl = raw.startsWith('/') ? `${orchestratorBase}${raw}` : raw;
          }
        } else {
          log.warn('[PIPELINE] stitch-segments failed — using first segment URL', {
            jobId: jobId.slice(0, 8), status: stitchResponse.status,
          });
        }
      } catch (stitchErr) {
        log.warn('[PIPELINE] stitch-segments error — using first segment URL', {
          jobId: jobId.slice(0, 8),
          error: stitchErr instanceof Error ? stitchErr.message : String(stitchErr),
        });
      }
    }

    await updateJobProgress('mixing', 85, 'Finalizing audio mix...');

    // Build a merged manifest (use last chunk's manifest as base; extend with total URLs)
    const mergedManifest = { ...(lastManifest ?? {}), audio_urls: allAudioUrls };

    // Step 5: Increment usage
    await updateJobProgress('finalizing', 95, 'Finalizing and updating usage...');

    await prisma.$executeRaw`SELECT increment_usage(${userId}, ${pageCount}::integer)`;

    // Step 6: Mark project completed first, then job — the client polls job status
    // and calls router.refresh() the moment it sees 'completed'. By updating project
    // first we guarantee project.status === 'completed' is visible to that refresh.
    const completionTime = new Date();

    await prisma.project.update({
      where: { id: projectId },
      data: { status: 'completed' },
    });

    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: 'completed',
        completedAt: completionTime,
        progress: { step: 'done', percent: 100, details: 'Generation complete!', updated_at: completionTime.toISOString() },
        result: mergedManifest,
        // Persist final audio URL for direct access on completed jobs
        firstAudioUrl: finalAudioUrl,
        segments: JSON.parse(JSON.stringify(segmentStatuses)),
      },
    });

    log.info('[PIPELINE] complete', { jobId: jobId.slice(0, 8), totalSec: elapsed(), pageCount, segments: chunks.length });
    logProgress(jobId, 'done', `Generation completed in ${elapsed()}s`);

    // Fire webhooks non-blocking — never let delivery failure affect the job result
    dispatchWebhooks('job.completed', userId, jobId, projectId, {
      audioUrl: finalAudioUrl,
    }).catch(() => {});

    // Human-in-loop: if the user purchased white-glove review, queue it now
    triggerHumanReviewIfPurchased(userId, projectId, jobId, orchestratorResult).catch(() => {});

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    const totalSec = elapsed();
    log.error('[PIPELINE] failed', error instanceof Error ? error : undefined, {
      jobId: jobId.slice(0, 8),
      totalSec,
      errorMessage,
    });
    logProgress(jobId, 'error', `[${totalSec}s] Generation failed: ${errorMessage}`);

    await logJobEvent(
      jobId,
      projectId,
      'error',
      'failed',
      `Generation failed after ${totalSec}s: ${errorMessage}`,
      { userId, pageCount, totalSec },
      errorMessage,
      errorStack
    );

    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: 'failed',
        error: errorMessage,
        progress: { step: 'failed', percent: 0, details: errorMessage, updated_at: new Date().toISOString() },
      },
    });

    await prisma.project.update({
      where: { id: projectId },
      data: { status: 'failed' },
    });

    dispatchWebhooks('job.failed', userId, jobId, projectId, { error: errorMessage }).catch(() => {});
  }
}
