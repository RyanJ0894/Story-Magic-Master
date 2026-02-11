/**
 * Generation Job Processor
 *
 * Core background processing logic for audio generation jobs.
 * Extracted from the generate API route to be callable from the queue worker.
 */

import { prisma } from '@/lib/db';
import { log } from '@/lib/logger';

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
  metadata: Record<string, unknown> = {},
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
  } catch (err) {
    log.error('Failed to write job log', err);
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
  accessToken: string | undefined,
  voiceOverrides: Record<string, string> = {}
) {
  const updateJobProgress = async (step: string, percent: number, details?: string, metadata: Record<string, unknown> = {}) => {
    const progressData = {
      step,
      percent,
      details: details || '',
      updated_at: new Date().toISOString(),
    };
    logProgress(jobId, step, `${percent}% - ${details || 'Processing...'}`);

    await logJobEvent(jobId, projectId, 'info', step, details || 'Processing...', { percent, ...metadata });

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

    await updateJobProgress('initializing', 5, 'Starting generation pipeline...');

    // Step 2: Call Director Agent to parse script
    await updateJobProgress('parsing', 10, 'Parsing script and assigning voices...');

    const orchestratorUrl = process.env.ORCHESTRATOR_URL || 'http://localhost:22002';
    logProgress(jobId, 'parsing', `Calling orchestrator at ${orchestratorUrl}/generate-scenes`);

    const generateScenesBody: Record<string, unknown> = {
      project_id: projectId,
      script_text: scriptText,
    };
    if (Object.keys(voiceOverrides).length > 0) {
      generateScenesBody.voice_overrides = voiceOverrides;
      logProgress(jobId, 'parsing', `Voice overrides for ${Object.keys(voiceOverrides).length} character(s)`);
    }

    const directorResponse = await fetch(`${orchestratorUrl}/generate-scenes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken && { 'Authorization': `Bearer ${accessToken}` }),
      },
      body: JSON.stringify(generateScenesBody),
    });

    if (!directorResponse.ok) {
      const errorBody = await directorResponse.text();
      logProgress(jobId, 'parsing', `Director Agent error: ${errorBody}`);
      throw new Error(`Director Agent failed: ${errorBody}`);
    }

    const directorResponse_json = await directorResponse.json();
    const directorJson = directorResponse_json.director_json || directorResponse_json;

    const sceneCount = directorJson.scenes?.length || 0;
    const lineCount = directorJson.scenes?.reduce((acc: number, s: { dialogue?: unknown[] }) => acc + (s.dialogue?.length || 0), 0) || 0;

    await updateJobProgress('parsing_complete', 25, `Parsed ${sceneCount} scenes, ${lineCount} lines`);

    // Save director JSON to project
    await prisma.project.update({
      where: { id: projectId },
      data: { directorJson },
    });

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
    await updateJobProgress('generating_audio', 30, 'Generating TTS audio for all dialogue...');
    logProgress(jobId, 'generating_audio', `Calling orchestrator at ${orchestratorUrl}/orchestrate with ${sceneCount} scenes`);

    const orchestratorResponse = await fetch(`${orchestratorUrl}/orchestrate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken && { 'Authorization': `Bearer ${accessToken}` }),
      },
      body: JSON.stringify({
        project_id: projectId,
        scenes: directorJson.scenes || [],
      }),
    });

    if (!orchestratorResponse.ok) {
      const errorBody = await orchestratorResponse.text();
      logProgress(jobId, 'generating_audio', `Orchestrator error: ${errorBody}`);
      throw new Error(`Orchestrator failed: ${errorBody}`);
    }

    const orchestratorResult = await orchestratorResponse.json();
    await updateJobProgress('mixing', 75, 'Mixing audio tracks...');

    // Step 4: Store audio output records
    await updateJobProgress('uploading', 85, 'Uploading final audio...');

    const audioUrls = orchestratorResult.audio_urls || [];
    const manifest = orchestratorResult.playback_manifest;

    for (const audioUrl of audioUrls) {
      if (!audioUrl) continue;
      const fileName = audioUrl.split('/').pop() || 'output.mp3';
      const pathMatch = audioUrl.match(/\/storage\/v1\/object\/public\/(.+)$/);
      const filePath = pathMatch ? pathMatch[1] : `audio/${projectId}/${fileName}`;
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
    }

    // Step 5: Increment usage
    await updateJobProgress('finalizing', 95, 'Finalizing and updating usage...');

    await prisma.$queryRaw`SELECT increment_usage(${userId}, ${pageCount})`;

    // Step 6: Mark job as completed
    const completionTime = new Date();
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: 'completed',
        completedAt: completionTime,
        progress: { step: 'done', percent: 100, details: 'Generation complete!', updated_at: completionTime.toISOString() },
        result: orchestratorResult,
      },
    });

    await prisma.project.update({
      where: { id: projectId },
      data: { status: 'completed' },
    });

    logProgress(jobId, 'done', 'Generation completed successfully!');

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    logProgress(jobId, 'error', `Generation failed: ${errorMessage}`);

    await logJobEvent(
      jobId,
      projectId,
      'error',
      'failed',
      `Generation failed: ${errorMessage}`,
      { userId, pageCount },
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
  }
}
