/**
 * Job Queue Worker
 *
 * Background worker that polls for jobs and processes them.
 * Supports graceful shutdown and lock renewal for long-running jobs.
 */

import {
  dequeueNext,
  releaseJobLock,
  completeJob,
  failJob,
  updateJobProgress,
  extendJobLock,
  cleanupExpiredLocks,
} from './service';
import { DequeueResult, WorkerConfig, WorkerStatus, JobType } from './types';
import { prisma } from '@/lib/db';
import { processGenerationJob } from '@/lib/generation/processor';
import { generateScore } from '@/lib/scoring/service';
import { generateSuggestions } from '@/lib/adviser/service';
import { log } from '@/lib/logger';
import { orchestratorGenerate } from '@/lib/orchestrator-fetch';

// =============================================================================
// Worker Configuration
// =============================================================================

const DEFAULT_CONFIG: WorkerConfig = {
  workerId: `worker-${process.pid}-${Date.now()}`,
  pollIntervalMs: 5000, // Poll every 5 seconds
  lockDurationSeconds: 1800, // 30 minute lock — accommodates 15+ page scripts
  maxConcurrentJobs: parseInt(process.env.QUEUE_CONCURRENCY || '3', 10),
  jobTypes: undefined, // Process all job types
};

// =============================================================================
// Job Processors Registry
// =============================================================================

type JobProcessor = (
  job: DequeueResult,
  context: ProcessorContext
) => Promise<Record<string, unknown> | void>;

interface ProcessorContext {
  updateProgress: (step: string, percent: number, details?: string) => Promise<void>;
  extendLock: () => Promise<boolean>;
  isCancelled: () => boolean;
}

const processors: Map<JobType, JobProcessor> = new Map();

/**
 * Register a job processor for a specific job type
 */
export function registerProcessor(jobType: JobType, processor: JobProcessor): void {
  processors.set(jobType, processor);
}

// =============================================================================
// Worker State
// =============================================================================

let isRunning = false;
let shouldStop = false;
let currentJobId: string | null = null;
let pollTimer: NodeJS.Timeout | null = null;
let lockRenewalTimer: NodeJS.Timeout | null = null;
let cleanupTimer: NodeJS.Timeout | null = null;
let jobsProcessed = 0;
let lastPollAt: Date | null = null;
let startedAt: Date | null = null;
let config: WorkerConfig = DEFAULT_CONFIG;

// =============================================================================
// Worker Lifecycle
// =============================================================================

/**
 * Start the worker
 */
function startWorker(customConfig?: Partial<WorkerConfig>): void {
  if (isRunning) {
    log.info('Worker already running');
    return;
  }

  config = { ...DEFAULT_CONFIG, ...customConfig };
  isRunning = true;
  shouldStop = false;
  startedAt = new Date();
  jobsProcessed = 0;

  log.info('Worker starting', {
    workerId: config.workerId,
    pollIntervalMs: config.pollIntervalMs,
    lockDurationSeconds: config.lockDurationSeconds,
  });

  // Start polling
  poll();

  // Start cleanup timer (every 60 seconds)
  cleanupTimer = setInterval(async () => {
    try {
      const cleaned = await cleanupExpiredLocks();
      if (cleaned > 0) {
        log.info('Cleaned up expired locks', { count: cleaned });
      }
    } catch (error) {
      log.error('Worker cleanup error', error);
    }
  }, 60000);
}

/**
 * Stop the worker gracefully
 */
async function stopWorker(): Promise<void> {
  if (!isRunning) {
    return;
  }

  log.info('Worker stopping');
  shouldStop = true;

  // Clear timers
  if (pollTimer) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
  if (lockRenewalTimer) {
    clearInterval(lockRenewalTimer);
    lockRenewalTimer = null;
  }
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }

  // Release current job lock if any
  if (currentJobId) {
    log.info('Releasing lock for job', { jobId: currentJobId });
    await releaseJobLock(currentJobId, config.workerId);
    currentJobId = null;
  }

  isRunning = false;
  log.info('Worker stopped');
}

/**
 * Get worker status
 */
function getWorkerStatus(): WorkerStatus {
  return {
    workerId: config.workerId,
    isRunning,
    currentJobId,
    jobsProcessed,
    lastPollAt,
    startedAt: startedAt || new Date(),
  };
}

// =============================================================================
// Polling Loop
// =============================================================================

async function poll(): Promise<void> {
  if (shouldStop) {
    return;
  }

  lastPollAt = new Date();

  try {
    // Get next job
    const job = await dequeueNext(config.workerId, config.lockDurationSeconds);

    if (job) {
      // Check if we should process this job type
      if (config.jobTypes && !config.jobTypes.includes(job.jobType)) {
        log.info('Skipping job (wrong type)', { jobId: job.jobId, jobType: job.jobType });
        await releaseJobLock(job.jobId, config.workerId);
      } else {
        await processJob(job);
      }
    }
  } catch (error) {
    log.error('Worker poll error', error);
  }

  // Schedule next poll
  if (!shouldStop) {
    pollTimer = setTimeout(poll, config.pollIntervalMs);
  }
}

// =============================================================================
// Job Processing
// =============================================================================

async function processJob(job: DequeueResult): Promise<void> {
  log.info('Processing job', { jobId: job.jobId, jobType: job.jobType, retryCount: job.retryCount });
  currentJobId = job.jobId;

  // Start lock renewal timer
  lockRenewalTimer = setInterval(async () => {
    if (currentJobId === job.jobId) {
      const renewed = await extendJobLock(job.jobId, config.workerId, config.lockDurationSeconds);
      if (!renewed) {
        log.warn('Failed to renew lock for job', { jobId: job.jobId });
      }
    }
  }, (config.lockDurationSeconds * 1000) / 2); // Renew at half the lock duration

  let cancelled = false;

  // Create processor context
  const context: ProcessorContext = {
    updateProgress: async (step: string, percent: number, details?: string) => {
      await updateJobProgress(job.jobId, { step, percent, details });
    },
    extendLock: async () => {
      return extendJobLock(job.jobId, config.workerId, config.lockDurationSeconds);
    },
    isCancelled: () => cancelled || shouldStop,
  };

  try {
    // Get the processor for this job type
    const processor = processors.get(job.jobType);

    if (!processor) {
      throw new Error(`No processor registered for job type: ${job.jobType}`);
    }

    // Process the job
    const result = await processor(job, context);

    // Mark as completed
    await completeJob(job.jobId, result || undefined);
    jobsProcessed++;
    log.info('Job completed successfully', { jobId: job.jobId });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log.error('Job failed', error, { jobId: job.jobId });

    // Mark as failed (with retry if applicable)
    const { retrying, retryCount } = await failJob(job.jobId, errorMessage);

    if (retrying) {
      log.info('Job will retry', { jobId: job.jobId, retryCount });
    } else {
      log.warn('Job permanently failed', { jobId: job.jobId });
    }
  } finally {
    // Clear lock renewal timer
    if (lockRenewalTimer) {
      clearInterval(lockRenewalTimer);
      lockRenewalTimer = null;
    }
    currentJobId = null;
  }
}

// =============================================================================
// Built-in Processors (can be overridden)
// =============================================================================

// Audio generation processor - fetches job metadata and runs the pipeline
registerProcessor('audio_generation', async (job, context) => {
  // Fetch generation metadata stored by the /api/generate route
  const jobRow = await prisma.job.findUnique({
    where: { id: job.jobId },
    select: { result: true },
  });

  if (!jobRow) {
    throw new Error('Failed to fetch job metadata: not found');
  }

  const metadata = (jobRow.result as Record<string, unknown>)?.metadata as {
    scriptText?: string;
    pageCount?: number;
    voiceOverrides?: Record<string, string>;
  } | undefined;

  if (!metadata?.scriptText) {
    throw new Error('Missing generation metadata (scriptText) in job');
  }

  // Run the generation pipeline
  // Note: processGenerationJob manages its own status updates (processing → completed/failed)
  await processGenerationJob(
    job.projectId,
    job.jobId,
    job.userId,
    metadata.scriptText,
    metadata.pageCount || 1,
    metadata.voiceOverrides || {},
  );
});

// Scene regeneration processor — sends a single scene to the orchestrator
registerProcessor('scene_regeneration', async (job, context) => {
  // Fetch job metadata stored by the regenerate-scene route
  const jobRow = await prisma.job.findUnique({
    where: { id: job.jobId },
    select: { result: true },
  });

  if (!jobRow) {
    throw new Error('Failed to fetch job metadata: not found');
  }

  const metadata = (jobRow.result as Record<string, unknown>)?.metadata as {
    sceneIndex?: number;
    scene?: Record<string, unknown>;
    emotion_overrides?: Record<string, string>;
  } | undefined;

  if (metadata?.sceneIndex === undefined || !metadata?.scene) {
    throw new Error('Missing scene regeneration metadata (sceneIndex, scene)');
  }

  await context.updateProgress('generating_audio', 10, `Regenerating scene ${metadata.sceneIndex + 1}...`);

  const orchestratorResponse = await orchestratorGenerate('/orchestrate', {
    project_id: job.projectId,
    scenes: [metadata.scene],
    emotion_overrides: metadata.emotion_overrides,
  });

  if (!orchestratorResponse.ok) {
    const errorBody = await orchestratorResponse.text();
    throw new Error(`Orchestrator failed: ${errorBody}`);
  }

  const orchestratorResult = await orchestratorResponse.json();
  await context.updateProgress('uploading', 80, 'Storing regenerated audio...');

  // Store new audio output records for this scene
  const audioUrls = (orchestratorResult.audio_urls || []) as string[];
  const manifest = orchestratorResult.playback_manifest;

  for (const audioUrl of audioUrls) {
    if (!audioUrl) continue;
    const fileName = audioUrl.split('/').pop() || 'output.mp3';
    const pathMatch = audioUrl.match(/\/storage\/v1\/object\/public\/(.+)$/);
    const filePath = /^https?:\/\//i.test(audioUrl)
      ? audioUrl
      : pathMatch ? pathMatch[1] : `audio/${job.projectId}/${fileName}`;
    await prisma.audioOutput.create({
      data: {
        projectId: job.projectId,
        jobId: job.jobId,
        fileName,
        filePath,
        durationSeconds: manifest?.total_duration || null,
        format: fileName.endsWith('.m4a') ? 'm4a' : 'mp3',
      },
    });
  }

  log.info('Scene regeneration complete', {
    jobId: job.jobId.slice(0, 8),
    projectId: job.projectId,
    sceneIndex: metadata.sceneIndex,
  });

  return { sceneIndex: metadata.sceneIndex, audioUrls };
});

// Score generation processor — runs StoryScore analysis on a project
registerProcessor('score_generation', async (job, context) => {
  await context.updateProgress('scoring', 10, 'Fetching project script...');

  const project = await prisma.project.findUnique({
    where: { id: job.projectId },
    select: { name: true, description: true, scriptText: true },
  });

  if (!project?.scriptText) {
    throw new Error('Project has no script text for scoring');
  }

  await context.updateProgress('scoring', 30, 'Running StoryScore analysis...');

  const score = await generateScore(job.projectId, project.scriptText, {
    title: project.name || undefined,
    logline: project.description || undefined,
  });

  await context.updateProgress('scoring', 90, 'Score generation complete');

  log.info('Score generation complete', {
    jobId: job.jobId.slice(0, 8),
    projectId: job.projectId,
    overallScore: score.overallScore,
  });

  return { scoreId: score.id, overallScore: score.overallScore, rating: score.rating };
});

// Suggestion generation processor — runs Story-Adviser analysis on a project
registerProcessor('suggestion_generation', async (job, context) => {
  await context.updateProgress('suggesting', 10, 'Fetching project script...');

  const project = await prisma.project.findUnique({
    where: { id: job.projectId },
    select: { name: true, scriptText: true },
  });

  if (!project?.scriptText) {
    throw new Error('Project has no script text for suggestion generation');
  }

  await context.updateProgress('suggesting', 30, 'Generating suggestions...');

  const suggestions = await generateSuggestions(job.projectId, project.scriptText);

  await context.updateProgress('suggesting', 90, 'Suggestion generation complete');

  log.info('Suggestion generation complete', {
    jobId: job.jobId.slice(0, 8),
    projectId: job.projectId,
    count: suggestions.length,
  });

  return { suggestionCount: suggestions.length };
});

// =============================================================================
// Exports
// =============================================================================

export {
  registerProcessor as registerJobProcessor,
  startWorker,
  stopWorker,
  getWorkerStatus,
};
