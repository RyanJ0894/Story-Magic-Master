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

// =============================================================================
// Worker Configuration
// =============================================================================

const DEFAULT_CONFIG: WorkerConfig = {
  workerId: `worker-${process.pid}-${Date.now()}`,
  pollIntervalMs: 5000, // Poll every 5 seconds
  lockDurationSeconds: 300, // 5 minute lock
  maxConcurrentJobs: 1, // Process one job at a time
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
    console.log('[Worker] Already running');
    return;
  }

  config = { ...DEFAULT_CONFIG, ...customConfig };
  isRunning = true;
  shouldStop = false;
  startedAt = new Date();
  jobsProcessed = 0;

  console.log(`[Worker] Starting worker ${config.workerId}`);
  console.log(`[Worker] Poll interval: ${config.pollIntervalMs}ms`);
  console.log(`[Worker] Lock duration: ${config.lockDurationSeconds}s`);

  // Start polling
  poll();

  // Start cleanup timer (every 60 seconds)
  cleanupTimer = setInterval(async () => {
    try {
      const cleaned = await cleanupExpiredLocks();
      if (cleaned > 0) {
        console.log(`[Worker] Cleaned up ${cleaned} expired locks`);
      }
    } catch (error) {
      console.error('[Worker] Cleanup error:', error);
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

  console.log('[Worker] Stopping worker...');
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
    console.log(`[Worker] Releasing lock for job ${currentJobId}`);
    await releaseJobLock(currentJobId, config.workerId);
    currentJobId = null;
  }

  isRunning = false;
  console.log('[Worker] Worker stopped');
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
        console.log(`[Worker] Skipping job ${job.jobId} (type: ${job.jobType})`);
        await releaseJobLock(job.jobId, config.workerId);
      } else {
        await processJob(job);
      }
    }
  } catch (error) {
    console.error('[Worker] Poll error:', error);
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
  console.log(`[Worker] Processing job ${job.jobId} (type: ${job.jobType}, retry: ${job.retryCount})`);
  currentJobId = job.jobId;

  // Start lock renewal timer
  lockRenewalTimer = setInterval(async () => {
    if (currentJobId === job.jobId) {
      const renewed = await extendJobLock(job.jobId, config.workerId, config.lockDurationSeconds);
      if (!renewed) {
        console.warn(`[Worker] Failed to renew lock for job ${job.jobId}`);
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
    console.log(`[Worker] Job ${job.jobId} completed successfully`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Worker] Job ${job.jobId} failed:`, errorMessage);

    // Mark as failed (with retry if applicable)
    const { retrying, retryCount } = await failJob(job.jobId, errorMessage);

    if (retrying) {
      console.log(`[Worker] Job ${job.jobId} will retry (attempt ${retryCount})`);
    } else {
      console.log(`[Worker] Job ${job.jobId} permanently failed`);
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

// Default processor for audio generation - calls the existing /api/generate logic
registerProcessor('audio_generation', async (job, context) => {
  // This will be replaced by the actual generation logic
  // For now, we delegate to the existing processGenerationJob function
  throw new Error('Audio generation processor not implemented - use /api/generate directly');
});

// Default processor for score generation
registerProcessor('score_generation', async (job, context) => {
  throw new Error('Score generation processor not implemented');
});

// Default processor for suggestion generation
registerProcessor('suggestion_generation', async (job, context) => {
  throw new Error('Suggestion generation processor not implemented');
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
