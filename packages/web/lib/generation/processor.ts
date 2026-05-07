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

    // Step 3: Call Orchestrator to generate audio
    const totalScenes = directorJson.scenes?.length || 0;
    await updateJobProgress('generating_audio', 30, `Generating TTS audio for ${totalScenes} scenes...`);

    const orchestratorStart = Date.now();
    log.info('[PIPELINE] orchestrator start', { jobId: jobId.slice(0, 8), totalScenes, elapsedSec: elapsed() });

    const orchestratorResponse = await orchestratorGenerate('/orchestrate', {
      project_id: projectId,
      scenes: directorJson.scenes || [],
    });

    const orchestratorSec = Math.round((Date.now() - orchestratorStart) / 1000);

    if (!orchestratorResponse.ok) {
      const errorBody = await orchestratorResponse.text();
      log.error('[PIPELINE] orchestrator failed', undefined, { jobId: jobId.slice(0, 8), orchestratorSec, errorBody: errorBody.slice(0, 500) });
      await logJobEvent(jobId, projectId, 'error', 'generating_audio', `Orchestrator failed after ${orchestratorSec}s`, { orchestratorSec }, errorBody.slice(0, 500));
      throw new Error(`Orchestrator failed: ${errorBody}`);
    }

    const orchestratorResult = await orchestratorResponse.json();
    log.info('[PIPELINE] orchestrator complete', { jobId: jobId.slice(0, 8), orchestratorSec, elapsedSec: elapsed() });
    await updateJobProgress('mixing', 75, 'Mixing audio tracks...', { orchestratorSec });

    // Step 4: Store audio output records
    await updateJobProgress('uploading', 85, 'Uploading final audio...');

    const audioUrls = orchestratorResult.audio_urls || [];
    const manifest = orchestratorResult.playback_manifest;

    let audioOutputsCreated = 0;
    for (const audioUrl of audioUrls) {
      if (!audioUrl) continue;
      const fileName = audioUrl.split('/').pop() || 'output.mp3';
      // Extract relative path from known URL patterns:
      //   Supabase: .../storage/v1/object/public/{path}
      //   Orchestrator local: /audio/{projectId}/{filename}  → strip leading /audio/
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
          durationSeconds: manifest?.total_duration ?? null,
          format: fileName.endsWith('.m4a') ? 'm4a' : 'mp3',
        },
      });
      audioOutputsCreated++;
    }

    // Guard: if no audio was produced, treat as a pipeline failure — do not silently complete.
    if (audioOutputsCreated === 0) {
      throw new Error(
        'Orchestrator returned no usable audio URLs. ' +
        'The episode file may not have been written to disk. ' +
        `audio_urls received: ${JSON.stringify(orchestratorResult.audio_urls ?? [])}`
      );
    }

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
        result: orchestratorResult,
      },
    });

    log.info('[PIPELINE] complete', { jobId: jobId.slice(0, 8), totalSec: elapsed(), pageCount });
    logProgress(jobId, 'done', `Generation completed in ${elapsed()}s`);

    // Fire webhooks non-blocking — never let delivery failure affect the job result
    dispatchWebhooks('job.completed', userId, jobId, projectId, {
      audioUrl: orchestratorResult && typeof orchestratorResult === 'object' && 'audioUrl' in orchestratorResult
        ? (orchestratorResult as Record<string, unknown>).audioUrl
        : null,
    }).catch(() => {});

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
