/**
 * Generation Job Processor
 *
 * Core background processing logic for audio generation jobs.
 * Extracted from the generate API route to be callable from the queue worker.
 */

import { prisma } from '@/lib/db';
import { log } from '@/lib/logger';
import { safeUpdate, safeCreate } from '@/lib/db/safe-write';
import {
  orchestratorGenerate,
  waitForOrchestratorReady,
  isTransientOrchestratorError,
  OrchestratorUnreachableError,
} from '@/lib/orchestrator-fetch';
import { dispatchWebhooks } from '@/lib/webhooks/deliver';
import { triggerHumanReviewIfPurchased } from '@/lib/human-review/trigger';
import { chunkScenes, segmentProgressLabel } from '@/lib/generation/chunk-script';
import { classifyFailure } from '@/lib/generation/classify-failure';
import { addBreadcrumb, captureMessage } from '@sentry/nextjs';
import { Prisma } from '@story-magic/shared';
import { asDirectorJson, type DirectorJson } from '@story-magic/shared';

// =============================================================================
// Error Sanitization
// =============================================================================

/**
 * Convert a raw orchestrator HTTP response body to a user-safe error message.
 * Internal details (project IDs, raw API errors, stack traces) stay in logs only.
 */
function sanitizeOrchestratorError(rawBody: string, context: string): string {
  try {
    const parsed = JSON.parse(rawBody) as Record<string, unknown>;
    // Extract message if present and it's a plain string
    if (typeof parsed.message === 'string' && parsed.message.length < 200) {
      return `${context}: ${parsed.message}`;
    }
    if (typeof parsed.error === 'string' && parsed.error.length < 200) {
      return `${context}: ${parsed.error}`;
    }
  } catch {
    // Not JSON — check if it's a short plain-text error (< 200 chars, no JSON/stack noise)
    const trimmed = rawBody.trim();
    if (trimmed.length > 0 && trimmed.length < 200 && !trimmed.includes('{') && !trimmed.includes('Error:')) {
      return `${context}: ${trimmed}`;
    }
  }
  return `${context}. Please try again or contact support if the issue persists.`;
}

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
  // H4: safeCreate swallows the P2003 / P2025 races where the project (and
  // its cascade-deleted job rows) was already gone by the time this log
  // tries to write. Today's incident: e2e teardown deleted the project
  // mid-flight; the worker hit `job_logs_job_id_fkey` violation.
  await safeCreate(
    prisma.jobLog,
    {
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
    },
    { jobId, projectId, step },
  );
}

async function markJobFailed(
  jobId: string,
  projectId: string,
  errorMessage: string,
  errorStack?: string
) {
  const now = new Date().toISOString();

  await logJobEvent(jobId, projectId, 'error', 'failed', errorMessage, {}, errorMessage, errorStack);

  // H4: safeUpdate — if the project was deleted while this job was running
  // (e2e teardown, manual admin delete), the cascade already removed the
  // job row. Today's incident was exactly this: e2e cleanup raced the
  // worker's failure path, producing P2025.
  await safeUpdate(
    prisma.job,
    {
      where: { id: jobId },
      data: {
        status: 'failed',
        error: errorMessage,
        progress: { step: 'failed', percent: 0, details: errorMessage, updated_at: now },
      },
    },
    { jobId, projectId, action: 'markJobFailed' },
  );

  // H4: same race as the job update above — project may have been deleted.
  await safeUpdate(
    prisma.project,
    {
      where: { id: projectId },
      data: { status: 'failed' },
    },
    { projectId, action: 'markJobFailed-project' },
  );

  // #174 PR β: master notification — script generation failed.
  // Fire-and-forget; can't fail the failure handler.
  try {
    const { emitScriptGenerationFailed } = await import('@/lib/notifications/producers');
    await emitScriptGenerationFailed(prisma, {
      projectId,
      errorSummary: errorMessage.slice(0, 300),
    });
  } catch {
    // swallow
  }

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
  voiceOverrides: Record<string, string> = {},
  // #372: when true, the orchestrator bypasses scene_renders cache for
  // this run only. directorJson reuse still applies (no LLM re-runs).
  // Set by the "Re-render audio (reuse cached AI)" UI toggle.
  forceFreshTts: boolean = false,
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

    // safeUpdate (Sprint A audit): the project can be cascade-deleted mid-pipeline
    // (e2e teardown, admin delete). Without safeUpdate, every subsequent progress
    // write raises a P2025 that pollutes Sentry but tells us nothing actionable —
    // the catch handler downstream is already going to call markJobFailed via
    // safeUpdate. Wrap here so the noise is suppressed at the source.
    await safeUpdate(
      prisma.job,
      { where: { id: jobId }, data: { progress: progressData } },
      { jobId, projectId, action: 'updateJobProgress' },
    );
  };

  try {
    // Step 1: Start processing — safeUpdate so the worker doesn't crash
    // ungracefully if the project (and the cascading job row) was deleted
    // between job-creation and processing pickup.
    await safeUpdate(
      prisma.job,
      {
        where: { id: jobId },
        data: { status: 'processing', startedAt: new Date() },
      },
      { jobId, projectId, action: 'markJobProcessing' },
    );

    log.info('[PIPELINE] start', { jobId: jobId.slice(0, 8), projectId, pageCount, scriptLength: scriptText.length });
    await updateJobProgress('initializing', 5, 'Starting generation pipeline...');

    // Wait up to 90s for the orchestrator to be ready before spending an LLM
    // call. A-001 (2026-06-15): bumped from 30s → 60s for Render's rolling
    // deploy window. 2026-06-20: bumped to 90s after Ryan's 6/19 trace hit
    // "did not become ready within 60000ms (probed 15x)" — whisper.cpp model
    // load adds ~30s on cold-boot.
    //
    // Also surface a "service is warming up" user-visible message before
    // re-throwing, so Ryan sees "deploy in progress, retrying" instead of a
    // bare error toast.
    await updateJobProgress('initializing', 6, 'Service is warming up (this can take ~30s after a deploy)…');
    try {
      await waitForOrchestratorReady(90_000);
    } catch (err) {
      if (err instanceof OrchestratorUnreachableError) {
        await logJobEvent(jobId, projectId, 'error', 'initializing',
          'The orchestrator is restarting after a deploy — your generation will retry automatically. If you see this more than twice in a row, the orchestrator may be down; please contact support.', {},
          err.message);
        // Re-throw so the queue worker classifies + applies the longer backoff.
        throw err;
      }
      throw err;
    }

    // Step 2: Parse script via Director Agent (skip if a prior run already produced directorJson)
    const existingProject = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        directorJson: true,
        directorNotes: true,
        userId: true,
        // Phase E: per-project override for the consistency check.
        advancedConsistencyCheckEnabled: true,
      },
    });

    // Narrow Prisma's JsonValue to DirectorJson at the boundary. asDirectorJson
    // returns null for legacy rows whose shape predates the schema; the
    // hasExistingParse check below catches both the null case and rows with
    // empty scenes, so the existing fallback to fresh parsing still fires.
    const existingDirectorJson = asDirectorJson(existingProject?.directorJson);
    const hasExistingParse =
      existingDirectorJson !== null && existingDirectorJson.scenes.length > 0;

    let directorJson: DirectorJson;

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
      // Phase E (advanced consistency check) — resolve the per-project
      // override first, then fall back to the profile-level opt-in. NULL
      // override means "inherit". Forward to the orchestrator only when
      // true; the body stays clean for the common (off) path.
      try {
        const ownerProfile = existingProject?.userId
          ? await prisma.profile.findUnique({
              where: { id: existingProject.userId },
              select: { advancedConsistencyCheckEnabled: true },
            })
          : null;
        const projectOverride = (existingProject as { advancedConsistencyCheckEnabled?: boolean | null })
          ?.advancedConsistencyCheckEnabled;
        const consistencyEnabled =
          projectOverride === null || projectOverride === undefined
            ? !!ownerProfile?.advancedConsistencyCheckEnabled
            : projectOverride;
        if (consistencyEnabled) {
          generateScenesBody.run_consistency_check = true;
          log.info('[PIPELINE] Phase E consistency check enabled for this run');
        }
      } catch (consistencyErr) {
        // Non-fatal: if the lookup fails we proceed without the check.
        log.warn('[PIPELINE] Phase E consistency-check flag lookup failed (non-fatal)', {
          error: consistencyErr instanceof Error ? consistencyErr.message : String(consistencyErr),
        });
      }

      const directorResponse = await orchestratorGenerate('/generate-scenes', generateScenesBody);

      const directorSec = Math.round((Date.now() - directorStart) / 1000);

      if (!directorResponse.ok) {
        const errorBody = await directorResponse.text();
        log.error('[PIPELINE] director failed', undefined, { jobId: jobId.slice(0, 8), directorSec, errorBody: errorBody.slice(0, 500) });
        await logJobEvent(jobId, projectId, 'error', 'parsing', `Director Agent failed after ${directorSec}s`, { directorSec }, errorBody.slice(0, 500));
        throw new Error(sanitizeOrchestratorError(errorBody, 'Script parsing failed'));
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

      // Save director JSON to project for future retry reuse. safeUpdate
      // because the project could be deleted between the parse finishing and
      // this write (same race class as updateJobProgress above).
      // Cast back to Prisma's InputJsonValue at the boundary — DirectorJson
      // is a structural subset but Prisma's type wants an index signature.
      await safeUpdate(
        prisma.project,
        {
          where: { id: projectId },
          data: { directorJson: directorJson as unknown as Prisma.InputJsonValue },
        },
        { jobId, projectId, action: 'cacheDirectorJson' },
      );
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

    // B-005 wiring (2026-06-15): pull the user's locked AudioTuning. Returns
    // undefined when no row exists or `locked === false` — both cases mean
    // the orchestrator uses its in-code defaults.
    const { getLockedAudioTuning } = await import('@/lib/services/audio-tuning');
    const audioTuning = await getLockedAudioTuning(prisma, userId);
    if (audioTuning) {
      log.info('[PIPELINE] applying locked audio tuning', { jobId: jobId.slice(0, 8), audioTuning });
    }

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
        const scene = directorJson.scenes.find((s) => s.scene_id === override.scene_id);
        if (!scene) continue;
        // Only music/ambience/sfx are valid override categories — the dialogue
        // and mix fields aren't user-overridable here.
        const category = override.category as 'music' | 'ambience' | 'sfx';
        if (category !== 'music' && category !== 'ambience' && category !== 'sfx') continue;
        const cueArray = scene[category];
        const idx = override.cue_index as number;
        if (!Array.isArray(cueArray) || idx >= cueArray.length) continue;
        cueArray[idx] = {
          ...cueArray[idx],
          file: override.file as string,
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
      /** #320: error body when status='failed' — lets the post-loop check
       *  surface a clearer "TTS provider is down" message vs a generic failure. */
      error?: string;
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
      await safeUpdate(
        prisma.job,
        {
          where: { id: jobId },
          data: { segments: JSON.parse(JSON.stringify(segmentStatuses)) },
        },
        { jobId, projectId, action: 'updateSegmentStatusProcessing' },
      );

      // A-004 (2026-06-15): Sentry breadcrumb per chunk attempt. Lets us see
      // WHICH chunk failed in retrospect — before this, Ryan's Error 4
      // ('no audio was produced' on a 15-page script) gave us no idea which
      // segment died. We had to scroll through logs and guess.
      addBreadcrumb({
        category: 'pipeline.chunk',
        message: `chunk ${chunk.index + 1}/${chunks.length} start`,
        level: 'info',
        data: {
          jobId: jobId.slice(0, 8),
          chunkIndex: chunk.index,
          chunkCount: chunks.length,
          sceneCount: chunk.scenes.length,
          isChunked,
        },
      });

      const chunkStart = Date.now();
      const orchestratorResponse = await orchestratorGenerate('/orchestrate', {
        project_id: projectId,
        scenes: chunk.scenes,
        // Only set chunk_index for multi-chunk jobs. Without it the orchestrator
        // runs the full pipeline (makePlaybackManifest + S3 upload). With it, the
        // orchestrator skips the manifest/S3 step and returns a local path.
        ...(isChunked ? { chunk_index: chunk.index } : {}),
        // B-005: forward the user's locked tuning. Orchestrator (#301/#305)
        // applies the values to the cache hash + TTS speed + mix gains.
        ...(audioTuning ? { audio_tuning: audioTuning } : {}),
        // #372: per-run TTS cache bypass. Only sent when true to keep the
        // request body clean for the common path.
        ...(forceFreshTts ? { force_fresh_tts: true } : {}),
      });
      const chunkSec = Math.round((Date.now() - chunkStart) / 1000);

      if (!orchestratorResponse.ok) {
        const errorBody = await orchestratorResponse.text();
        const msg = `Orchestrator failed on segment ${chunk.index + 1}/${chunks.length} after ${chunkSec}s`;
        log.error('[PIPELINE] orchestrator chunk failed', undefined, {
          jobId: jobId.slice(0, 8), chunkIndex: chunk.index, chunkSec, errorBody: errorBody.slice(0, 500),
        });
        await logJobEvent(jobId, projectId, 'error', 'generating_audio', msg, { chunkIndex: chunk.index, chunkSec }, errorBody.slice(0, 500));

        // A-004: explicit Sentry breadcrumb for the failure side. Pairs with
        // the success breadcrumb below so a job failure leaves a clear trail
        // of which chunks succeeded vs failed in the Sentry breadcrumb stack.
        addBreadcrumb({
          category: 'pipeline.chunk',
          message: `chunk ${chunk.index + 1}/${chunks.length} failed`,
          level: 'error',
          data: {
            jobId: jobId.slice(0, 8),
            chunkIndex: chunk.index,
            chunkSec,
            httpStatus: orchestratorResponse.status,
            errorBodyPreview: errorBody.slice(0, 200),
          },
        });

        // Mark this segment failed; continue with remaining segments (partial audio)
        segmentStatuses[chunk.index].status = 'failed';
        // #320: capture the error body so the terminal-failure path can
        // distinguish upstream-TTS issues from other causes.
        segmentStatuses[chunk.index].error = errorBody.slice(0, 500);
        await safeUpdate(
          prisma.job,
          {
            where: { id: jobId },
            data: { segments: JSON.parse(JSON.stringify(segmentStatuses)) },
          },
          { jobId, projectId, action: 'markSegmentFailed' },
        );
        continue;
      }

      orchestratorResult = await orchestratorResponse.json() as Record<string, unknown>;
      const chunkAudioUrls: string[] = (orchestratorResult.audio_urls as string[] | undefined) || [];
      const manifest = orchestratorResult.playback_manifest as Record<string, unknown> | undefined;
      lastManifest = manifest ?? lastManifest;

      // 2026-06-21: silent-empty-audio-urls guard. Before this guard, a 200
      // OK response with audio_urls=[] (or [null]) silently incremented zero
      // audioOutputs and left this segment with status='ready' and a null
      // URL. The terminal-failure path then couldn't classify the failure
      // (no segment had status='failed' + error) and surfaced the generic
      // "no audio produced" message — exactly Ryan's 6/20 10:10/10:22 PM
      // CST experience on 15-page scripts. Now we treat empty audio_urls
      // on a 200 as a failed segment with a discoverable error string.
      // Root cause may be Render's multi-instance file-system races on
      // chunked jobs — to be confirmed by the explicit error from this
      // guard in the next failing run.
      const nonNullAudioUrls = chunkAudioUrls.filter((u) => typeof u === 'string' && u.length > 0);
      if (nonNullAudioUrls.length === 0) {
        const msg = `Orchestrator returned 200 OK on segment ${chunk.index + 1}/${chunks.length} but zero audio URLs after ${chunkSec}s`;
        log.error('[PIPELINE] orchestrator returned empty audio_urls', undefined, {
          jobId: jobId.slice(0, 8),
          chunkIndex: chunk.index,
          chunkSec,
          orchestratorResultPreview: JSON.stringify(orchestratorResult).slice(0, 500),
        });
        await logJobEvent(
          jobId, projectId, 'error', 'generating_audio', msg,
          { chunkIndex: chunk.index, chunkSec },
          'empty_audio_urls: ' + JSON.stringify(orchestratorResult).slice(0, 400),
        );
        addBreadcrumb({
          category: 'pipeline.chunk',
          message: `chunk ${chunk.index + 1}/${chunks.length} empty audio_urls`,
          level: 'error',
          data: {
            jobId: jobId.slice(0, 8),
            chunkIndex: chunk.index,
            chunkSec,
            orchestratorResultPreview: JSON.stringify(orchestratorResult).slice(0, 200),
          },
        });
        segmentStatuses[chunk.index].status = 'failed';
        segmentStatuses[chunk.index].error = 'empty_audio_urls: orchestrator returned 200 OK with no audio URLs';
        await safeUpdate(
          prisma.job,
          { where: { id: jobId }, data: { segments: JSON.parse(JSON.stringify(segmentStatuses)) } },
          { jobId, projectId, action: 'markSegmentEmptyUrls' },
        );
        continue;
      }

      log.info('[PIPELINE] orchestrator chunk complete', {
        jobId: jobId.slice(0, 8),
        chunkIndex: chunk.index,
        chunkSec,
        audioUrls: chunkAudioUrls.length,
        elapsedSec: elapsed(),
      });

      // A-004: success breadcrumb so the chunk-by-chunk story is complete
      // in Sentry. If a later chunk fails, the failure stack shows clearly
      // which chunks succeeded before the failure.
      addBreadcrumb({
        category: 'pipeline.chunk',
        message: `chunk ${chunk.index + 1}/${chunks.length} complete`,
        level: 'info',
        data: {
          jobId: jobId.slice(0, 8),
          chunkIndex: chunk.index,
          chunkSec,
          audioUrls: chunkAudioUrls.length,
        },
      });

      // Persist audio output records for this chunk
      for (const audioUrl of chunkAudioUrls) {
        if (!audioUrl) continue;
        const fileName = audioUrl.split('/').pop() || 'output.mp3';
        const supabaseMatch = audioUrl.match(/\/storage\/v1\/object\/public\/(.+)$/);
        const localMatch = audioUrl.match(/^\/audio\/(.+)$/);
        // For local /audio/... paths, store the absolute orchestrator URL so the
        // browser AudioPlayer can load it directly without needing NEXT_PUBLIC_ORCHESTRATOR_URL.
        // Absolute URLs (S3/R2) are stored as-is — resolveAudioUrl passes them through unchanged.
        const filePath = /^https?:\/\//i.test(audioUrl)
          ? audioUrl
          : supabaseMatch
            ? supabaseMatch[1]
            : localMatch
              ? (orchestratorBase ? `${orchestratorBase}/audio/${localMatch[1]}` : localMatch[1])
              : (orchestratorBase ? `${orchestratorBase}/audio/${projectId}/${fileName}` : `${projectId}/${fileName}`);
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
      await safeUpdate(
        prisma.job,
        { where: { id: jobId }, data: updateData },
        { jobId, projectId, action: 'updateSegmentSuccess' },
      );
    }

    // Guard: at least one chunk must have produced audio
    if (audioOutputsCreated === 0) {
      log.error('[PIPELINE] no audio produced', undefined, {
        jobId: jobId.slice(0, 8),
        chunksAttempted: chunks.length,
        lastAudioUrls: JSON.stringify(orchestratorResult?.audio_urls ?? []),
      });
      // #320 (2026-06-17): when the cause is a sustained ElevenLabs outage
      // we want Ryan to see "TTS provider issue, retry" instead of a generic
      // "no audio produced." Look at the last segment's recorded error
      // message to make the distinction. The classifier in orchestrator-fetch
      // covers the worker-retry path; this string is purely the user-facing
      // toast / job log entry for the terminal-failure case.
      const lastFailure = segmentStatuses
        .slice()
        .reverse()
        .find((s) => s.status === 'failed' && s.error)?.error ?? '';
      // 2026-06-20: extracted to lib/generation/classify-failure.ts so the
      // three user-facing messages are pinned by unit tests against any
      // future drift. Three buckets: upstream-tts (transient ElevenLabs
      // 5xx/429), preflight-voice (422 from PR #338 validator), generic.
      const { message: userMessage } = classifyFailure(lastFailure);
      throw new Error(userMessage);
    }

    // A-003 (2026-06-15): partial-audio detection. When the chunked loop
    // skipped 1+ failed chunks but at least one succeeded, surface the
    // partial-success state to Sentry as a warning and to the job log so
    // Ryan can see in the UI that the generation completed but missed
    // material. The job still flows to status='completed' below — partial
    // audio is better than no audio for a 90-page script where one chunk
    // hit a transient ElevenLabs blip.
    const failedSegmentCount = segmentStatuses.filter((s) => s.status === 'failed').length;
    if (failedSegmentCount > 0) {
      const partialMsg = `Partial audio: ${chunks.length - failedSegmentCount}/${chunks.length} segments succeeded`;
      log.warn(`[PIPELINE] ${partialMsg}`, {
        jobId: jobId.slice(0, 8),
        failedSegmentCount,
        chunksAttempted: chunks.length,
        failedIndexes: segmentStatuses.map((s, i) => (s.status === 'failed' ? i : null)).filter((i): i is number => i !== null),
      });
      await logJobEvent(jobId, projectId, 'warn', 'generating_audio', partialMsg, {
        failedSegmentCount,
        chunksAttempted: chunks.length,
      });
      captureMessage(partialMsg, {
        level: 'warning',
        tags: { kind: 'pipeline.partial_audio' },
        extra: {
          jobId: jobId.slice(0, 8),
          projectId,
          failedSegmentCount,
          chunksAttempted: chunks.length,
        },
      });
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
            // Replace the per-chunk audioOutput records with a single record for
            // the final stitched episode. The chunk files are intermediate artifacts;
            // the player reads audioOutput.filePath so this must point to the final URL.
            await prisma.audioOutput.deleteMany({ where: { jobId } });
            await prisma.audioOutput.create({
              data: {
                projectId,
                jobId,
                fileName: 'episode.m4a',
                filePath: finalAudioUrl,
                durationSeconds: typeof lastManifest?.total === 'number' ? lastManifest.total : null,
                format: 'm4a',
              },
            });
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

    // Project + job completion writes: safeUpdate because both rows could
    // have been cascade-deleted while orchestration was running (the most
    // common pattern: e2e teardown delete-project mid-flight). Either write
    // failing is benign — we logged completion to job_logs already.
    await safeUpdate(
      prisma.project,
      { where: { id: projectId }, data: { status: 'completed' } },
      { jobId, projectId, action: 'markProjectCompleted' },
    );

    await safeUpdate(
      prisma.job,
      {
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
      },
      { jobId, projectId, action: 'markJobCompleted' },
    );

    // #174 PR β: master notification — script generation completed.
    // Fire-and-forget; producer swallows errors so it can't fail the job.
    try {
      const { emitScriptGenerationComplete } = await import('@/lib/notifications/producers');
      await emitScriptGenerationComplete(prisma, {
        projectId,
        // `userId` here is the function param — the Clerk ID of whoever
        // kicked off this generation. For team-owned projects this is
        // typically the sub-account that ran it.
        triggeredByUserId: userId,
      });
    } catch {
      // swallow — completion already persisted; logging is best-effort
    }

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
    const errorCause = (() => {
      if (!(error instanceof Error) || error.cause === undefined) return undefined;
      const cause = error.cause;
      if (cause instanceof AggregateError) {
        return cause.errors.map((e: unknown) => (e instanceof Error ? e.message : String(e))).join('; ');
      }
      if (cause instanceof Error) return cause.message;
      try { return JSON.stringify(cause); } catch { return String(cause); }
    })();
    const totalSec = elapsed();
    log.error('[PIPELINE] failed', error instanceof Error ? error : undefined, {
      jobId: jobId.slice(0, 8),
      totalSec,
      errorMessage,
      ...(errorCause ? { errorCause } : {}),
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

    // Failure-path writes also wrapped — same race class as the completion
    // path above. The throw at the end of this catch is the contract with
    // the queue worker; nothing here observes a return value.
    await safeUpdate(
      prisma.job,
      {
        where: { id: jobId },
        data: {
          status: 'failed',
          error: errorMessage,
          progress: { step: 'failed', percent: 0, details: errorMessage, updated_at: new Date().toISOString() },
        },
      },
      { jobId, projectId, action: 'markJobFailedFromCatch' },
    );

    await safeUpdate(
      prisma.project,
      { where: { id: projectId }, data: { status: 'failed' } },
      { jobId, projectId, action: 'markProjectFailedFromCatch' },
    );

    dispatchWebhooks('job.failed', userId, jobId, projectId, { error: errorMessage }).catch(() => {});

    // Rethrow so the queue worker's catch branch runs instead of completeJob().
    // Without this the worker marks the job 'completed' immediately after the
    // processor marks it 'failed', overwriting the failed status.
    throw error;
  }
}
