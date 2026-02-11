/**
 * Job Queue Service
 *
 * Provides queue operations for job management with FIFO processing
 * and support for priority-based ordering.
 *
 * Uses Prisma for all database operations. Stored functions are called
 * via prisma.$queryRaw for atomic queue operations.
 */

import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import {
  Job,
  JobType,
  JobProgress,
  EnqueueOptions,
  EnqueueResult,
  DequeueResult,
  QueuePosition,
  QueueStats,
  QueueSummary,
} from './types';

// =============================================================================
// Enqueue Operations
// =============================================================================

/**
 * Add a job to the queue
 */
export async function enqueue(options: EnqueueOptions): Promise<EnqueueResult> {
  const {
    projectId,
    userId,
    jobType = 'audio_generation',
    priority = 0,
    maxRetries = 3,
    estimatedDurationMs,
    metadata,
  } = options;

  const job = await prisma.job.create({
    data: {
      projectId,
      userId,
      status: 'queued',
      jobType,
      priority,
      maxRetries,
      estimatedDurationMs: estimatedDurationMs ?? null,
      progress: {
        step: 'queued',
        percent: 0,
        details: 'Waiting in queue...',
        updated_at: new Date().toISOString(),
      },
      result: metadata ? { metadata } : Prisma.JsonNull,
    },
  });

  // Get queue position
  const position = await getQueuePosition(job.id);

  return {
    jobId: job.id,
    position: position?.position ?? 1,
    estimatedWaitSeconds: position?.estimatedWaitSeconds ?? 60,
  };
}

// =============================================================================
// Dequeue Operations
// =============================================================================

/**
 * Get the next job from the queue (FIFO with priority)
 * Uses stored function for safe concurrent access with SELECT FOR UPDATE SKIP LOCKED
 */
export async function dequeueNext(
  workerId: string,
  lockDurationSeconds: number = 300
): Promise<DequeueResult | null> {
  const result = await prisma.$queryRaw<Array<{
    job_id: string;
    project_id: string;
    user_id: string;
    job_type: string;
    priority: number;
    retry_count: number;
  }>>`SELECT * FROM get_next_queued_job(${workerId}, ${lockDurationSeconds})`;

  if (!result || result.length === 0) {
    return null;
  }

  const row = result[0];
  return {
    jobId: row.job_id,
    projectId: row.project_id,
    userId: row.user_id,
    jobType: row.job_type as JobType,
    priority: row.priority,
    retryCount: row.retry_count,
  };
}

/**
 * Release a job lock (for graceful shutdown)
 */
export async function releaseJobLock(jobId: string, workerId: string): Promise<boolean> {
  const result = await prisma.$queryRaw<Array<{ release_job_lock: boolean }>>`
    SELECT release_job_lock(${jobId}::uuid, ${workerId})
  `;

  return result?.[0]?.release_job_lock === true;
}

// =============================================================================
// Job Completion
// =============================================================================

/**
 * Mark a job as completed
 */
export async function completeJob(
  jobId: string,
  result?: Record<string, unknown>
): Promise<boolean> {
  const dbResult = await prisma.$queryRaw<Array<{ complete_job: boolean }>>`
    SELECT complete_job(${jobId}::uuid, ${result ? JSON.stringify(result) : null}::jsonb)
  `;

  return dbResult?.[0]?.complete_job === true;
}

/**
 * Mark a job as failed (with optional retry)
 */
export async function failJob(
  jobId: string,
  errorMessage: string,
  shouldRetry: boolean = true
): Promise<{ retrying: boolean; retryCount: number }> {
  const result = await prisma.$queryRaw<Array<{
    retrying: boolean;
    retry_count: number;
  }>>`SELECT * FROM fail_job(${jobId}::uuid, ${errorMessage}, ${shouldRetry})`;

  if (!result || result.length === 0) {
    return { retrying: false, retryCount: 0 };
  }

  return {
    retrying: result[0].retrying,
    retryCount: result[0].retry_count,
  };
}

// =============================================================================
// Progress Updates
// =============================================================================

/**
 * Update job progress
 */
export async function updateJobProgress(
  jobId: string,
  progress: Partial<JobProgress>
): Promise<void> {
  await prisma.job.update({
    where: { id: jobId },
    data: {
      progress: {
        ...progress,
        updated_at: new Date().toISOString(),
      },
    },
  });
}

/**
 * Extend job lock (for long-running jobs)
 */
export async function extendJobLock(
  jobId: string,
  workerId: string,
  additionalSeconds: number = 300
): Promise<boolean> {
  const result = await prisma.job.updateMany({
    where: {
      id: jobId,
      workerId,
      status: 'processing',
    },
    data: {
      lockExpiresAt: new Date(Date.now() + additionalSeconds * 1000),
    },
  });

  return result.count > 0;
}

// =============================================================================
// Queue Position
// =============================================================================

/**
 * Get queue position for a job
 */
export async function getQueuePosition(jobId: string): Promise<QueuePosition | null> {
  const result = await prisma.$queryRaw<Array<{
    position: number | null;
    estimated_wait_seconds: number;
    jobs_ahead: number;
  }>>`SELECT * FROM get_queue_position(${jobId}::uuid)`;

  if (!result || result.length === 0 || result[0].position === null) {
    return null;
  }

  const row = result[0];
  return {
    position: row.position!,
    estimatedWaitSeconds: row.estimated_wait_seconds,
    jobsAhead: row.jobs_ahead,
  };
}

// =============================================================================
// Job Retrieval
// =============================================================================

/**
 * Get a job by ID
 */
export async function getJob(jobId: string): Promise<Job | null> {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
  });

  if (!job) return null;

  return {
    id: job.id,
    projectId: job.projectId,
    userId: job.userId,
    status: job.status as Job['status'],
    jobType: job.jobType as JobType,
    priority: job.priority,
    progress: job.progress as unknown as JobProgress,
    result: job.result as Record<string, unknown> | null,
    error: job.error,
    retryCount: job.retryCount,
    maxRetries: job.maxRetries,
    lastError: job.lastError,
    workerId: job.workerId,
    queuedAt: job.queuedAt,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    createdAt: job.createdAt,
    estimatedDurationMs: job.estimatedDurationMs,
    actualDurationMs: job.actualDurationMs,
  };
}

/**
 * Get jobs for a project
 */
export async function getProjectJobs(projectId: string): Promise<Job[]> {
  const jobs = await prisma.job.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
  });

  return jobs.map((job) => ({
    id: job.id,
    projectId: job.projectId,
    userId: job.userId,
    status: job.status as Job['status'],
    jobType: job.jobType as JobType,
    priority: job.priority,
    progress: job.progress as unknown as JobProgress,
    result: job.result as Record<string, unknown> | null,
    error: job.error,
    retryCount: job.retryCount,
    maxRetries: job.maxRetries,
    lastError: job.lastError,
    workerId: job.workerId,
    queuedAt: job.queuedAt,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    createdAt: job.createdAt,
    estimatedDurationMs: job.estimatedDurationMs,
    actualDurationMs: job.actualDurationMs,
  }));
}

// =============================================================================
// Queue Statistics
// =============================================================================

/**
 * Get queue statistics (from queue_stats view)
 */
export async function getQueueStats(): Promise<QueueSummary> {
  const data = await prisma.$queryRaw<Array<{
    job_type: string;
    queued_count: number;
    processing_count: number;
    completed_24h: number;
    failed_24h: number;
    avg_duration_ms: number | null;
    oldest_queued_at: string | null;
    stale_locks: number;
  }>>`SELECT * FROM queue_stats`;

  if (!data || data.length === 0) {
    return {
      totalQueued: 0,
      totalProcessing: 0,
      totalCompleted24h: 0,
      totalFailed24h: 0,
      avgWaitTimeSeconds: 0,
      statsByType: [],
    };
  }

  const stats: QueueStats[] = data.map((row) => ({
    jobType: row.job_type as JobType,
    queuedCount: Number(row.queued_count) || 0,
    processingCount: Number(row.processing_count) || 0,
    completed24h: Number(row.completed_24h) || 0,
    failed24h: Number(row.failed_24h) || 0,
    avgDurationMs: row.avg_duration_ms ? Number(row.avg_duration_ms) : null,
    oldestQueuedAt: row.oldest_queued_at ? new Date(row.oldest_queued_at) : null,
    staleLocks: Number(row.stale_locks) || 0,
  }));

  return {
    totalQueued: stats.reduce((sum, s) => sum + s.queuedCount, 0),
    totalProcessing: stats.reduce((sum, s) => sum + s.processingCount, 0),
    totalCompleted24h: stats.reduce((sum, s) => sum + s.completed24h, 0),
    totalFailed24h: stats.reduce((sum, s) => sum + s.failed24h, 0),
    avgWaitTimeSeconds: Math.round(
      (stats.reduce((sum, s) => sum + (s.avgDurationMs || 0), 0) / Math.max(stats.length, 1)) / 1000
    ),
    statsByType: stats,
  };
}

// =============================================================================
// Maintenance
// =============================================================================

/**
 * Cleanup expired job locks
 */
export async function cleanupExpiredLocks(): Promise<number> {
  const result = await prisma.$queryRaw<Array<{ cleanup_expired_job_locks: number }>>`
    SELECT cleanup_expired_job_locks()
  `;

  return result?.[0]?.cleanup_expired_job_locks || 0;
}

/**
 * Cancel a queued job
 */
export async function cancelJob(jobId: string, userId: string): Promise<boolean> {
  const result = await prisma.job.updateMany({
    where: {
      id: jobId,
      userId,
      status: 'queued',
    },
    data: {
      status: 'failed',
      error: 'Cancelled by user',
      completedAt: new Date(),
      progress: {
        step: 'cancelled',
        percent: 0,
        error: 'Cancelled by user',
        updated_at: new Date().toISOString(),
      },
    },
  });

  return result.count > 0;
}
