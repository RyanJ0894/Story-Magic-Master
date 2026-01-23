/**
 * Job Queue Service
 *
 * Provides queue operations for job management with FIFO processing
 * and support for priority-based ordering (for future use).
 */

import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import {
  Job,
  JobType,
  JobRow,
  JobProgress,
  EnqueueOptions,
  EnqueueResult,
  DequeueResult,
  QueuePosition,
  QueueStats,
  QueueSummary,
  jobRowToJob,
} from './types';

// =============================================================================
// Service Role Client (for background operations)
// =============================================================================

function getServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase service role credentials');
  }

  return createServiceClient(supabaseUrl, serviceRoleKey);
}

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

  const supabase = await createClient();

  // Create the job
  const { data: job, error } = await supabase
    .from('jobs')
    .insert({
      project_id: projectId,
      user_id: userId,
      status: 'queued',
      job_type: jobType,
      priority,
      max_retries: maxRetries,
      estimated_duration_ms: estimatedDurationMs,
      progress: {
        step: 'queued',
        percent: 0,
        details: 'Waiting in queue...',
        updated_at: new Date().toISOString(),
      },
      result: metadata ? { metadata } : null,
    })
    .select()
    .single();

  if (error || !job) {
    console.error('[Queue] Enqueue error:', error);
    throw new Error('Failed to enqueue job');
  }

  // Get queue position
  const position = await getQueuePosition(job.id);

  return {
    jobId: job.id,
    position: position?.position ?? 1,
    estimatedWaitSeconds: position?.estimatedWaitSeconds ?? 60,
  };
}

/**
 * Add a job to the queue using service role (for API routes)
 */
export async function enqueueWithServiceRole(options: EnqueueOptions): Promise<EnqueueResult> {
  const {
    projectId,
    userId,
    jobType = 'audio_generation',
    priority = 0,
    maxRetries = 3,
    estimatedDurationMs,
    metadata,
  } = options;

  const supabase = getServiceClient();

  // Create the job
  const { data: job, error } = await supabase
    .from('jobs')
    .insert({
      project_id: projectId,
      user_id: userId,
      status: 'queued',
      job_type: jobType,
      priority,
      max_retries: maxRetries,
      estimated_duration_ms: estimatedDurationMs,
      progress: {
        step: 'queued',
        percent: 0,
        details: 'Waiting in queue...',
        updated_at: new Date().toISOString(),
      },
      result: metadata ? { metadata } : null,
    })
    .select()
    .single();

  if (error || !job) {
    console.error('[Queue] Enqueue error:', error);
    throw new Error('Failed to enqueue job');
  }

  // Get queue position
  const position = await getQueuePositionWithServiceRole(job.id);

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
 * Uses SELECT FOR UPDATE SKIP LOCKED for safe concurrent access
 */
export async function dequeueNext(
  workerId: string,
  lockDurationSeconds: number = 300
): Promise<DequeueResult | null> {
  const supabase = getServiceClient();

  const { data, error } = await supabase.rpc('get_next_queued_job', {
    p_worker_id: workerId,
    p_lock_duration_seconds: lockDurationSeconds,
  });

  if (error) {
    console.error('[Queue] Dequeue error:', error);
    throw new Error('Failed to dequeue job');
  }

  if (!data || data.length === 0) {
    return null;
  }

  const row = data[0];
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
  const supabase = getServiceClient();

  const { data, error } = await supabase.rpc('release_job_lock', {
    p_job_id: jobId,
    p_worker_id: workerId,
  });

  if (error) {
    console.error('[Queue] Release lock error:', error);
    return false;
  }

  return data === true;
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
  const supabase = getServiceClient();

  const { data, error } = await supabase.rpc('complete_job', {
    p_job_id: jobId,
    p_result: result || null,
  });

  if (error) {
    console.error('[Queue] Complete job error:', error);
    return false;
  }

  return data === true;
}

/**
 * Mark a job as failed (with optional retry)
 */
export async function failJob(
  jobId: string,
  errorMessage: string,
  shouldRetry: boolean = true
): Promise<{ retrying: boolean; retryCount: number }> {
  const supabase = getServiceClient();

  const { data, error } = await supabase.rpc('fail_job', {
    p_job_id: jobId,
    p_error: errorMessage,
    p_should_retry: shouldRetry,
  });

  if (error) {
    console.error('[Queue] Fail job error:', error);
    throw new Error('Failed to mark job as failed');
  }

  if (!data || data.length === 0) {
    return { retrying: false, retryCount: 0 };
  }

  return {
    retrying: data[0].retrying,
    retryCount: data[0].retry_count,
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
  const supabase = getServiceClient();

  const { error } = await supabase
    .from('jobs')
    .update({
      progress: {
        ...progress,
        updated_at: new Date().toISOString(),
      },
    })
    .eq('id', jobId);

  if (error) {
    console.error('[Queue] Update progress error:', error);
  }
}

/**
 * Extend job lock (for long-running jobs)
 */
export async function extendJobLock(
  jobId: string,
  workerId: string,
  additionalSeconds: number = 300
): Promise<boolean> {
  const supabase = getServiceClient();

  const { error, count } = await supabase
    .from('jobs')
    .update({
      lock_expires_at: new Date(Date.now() + additionalSeconds * 1000).toISOString(),
    })
    .eq('id', jobId)
    .eq('worker_id', workerId)
    .eq('status', 'processing');

  if (error) {
    console.error('[Queue] Extend lock error:', error);
    return false;
  }

  return (count ?? 0) > 0;
}

// =============================================================================
// Queue Position
// =============================================================================

/**
 * Get queue position for a job
 */
export async function getQueuePosition(jobId: string): Promise<QueuePosition | null> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('get_queue_position', {
    p_job_id: jobId,
  });

  if (error || !data || data.length === 0) {
    return null;
  }

  const row = data[0];
  if (row.position === null) {
    return null;
  }

  return {
    position: row.position,
    estimatedWaitSeconds: row.estimated_wait_seconds,
    jobsAhead: row.jobs_ahead,
  };
}

/**
 * Get queue position using service role
 */
export async function getQueuePositionWithServiceRole(jobId: string): Promise<QueuePosition | null> {
  const supabase = getServiceClient();

  const { data, error } = await supabase.rpc('get_queue_position', {
    p_job_id: jobId,
  });

  if (error || !data || data.length === 0) {
    return null;
  }

  const row = data[0];
  if (row.position === null) {
    return null;
  }

  return {
    position: row.position,
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
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (error || !data) {
    return null;
  }

  return jobRowToJob(data as JobRow);
}

/**
 * Get jobs for a project
 */
export async function getProjectJobs(projectId: string): Promise<Job[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error || !data) {
    return [];
  }

  return data.map((row) => jobRowToJob(row as JobRow));
}

// =============================================================================
// Queue Statistics
// =============================================================================

/**
 * Get queue statistics
 */
export async function getQueueStats(): Promise<QueueSummary> {
  const supabase = getServiceClient();

  const { data, error } = await supabase.from('queue_stats').select('*');

  if (error || !data) {
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
    queuedCount: row.queued_count || 0,
    processingCount: row.processing_count || 0,
    completed24h: row.completed_24h || 0,
    failed24h: row.failed_24h || 0,
    avgDurationMs: row.avg_duration_ms,
    oldestQueuedAt: row.oldest_queued_at ? new Date(row.oldest_queued_at) : null,
    staleLocks: row.stale_locks || 0,
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
  const supabase = getServiceClient();

  const { data, error } = await supabase.rpc('cleanup_expired_job_locks');

  if (error) {
    console.error('[Queue] Cleanup error:', error);
    return 0;
  }

  return data || 0;
}

/**
 * Cancel a queued job
 */
export async function cancelJob(jobId: string, userId: string): Promise<boolean> {
  const supabase = await createClient();

  const { error, count } = await supabase
    .from('jobs')
    .update({
      status: 'failed',
      error: 'Cancelled by user',
      completed_at: new Date().toISOString(),
      progress: {
        step: 'cancelled',
        percent: 0,
        error: 'Cancelled by user',
        updated_at: new Date().toISOString(),
      },
    })
    .eq('id', jobId)
    .eq('user_id', userId)
    .eq('status', 'queued');

  if (error) {
    console.error('[Queue] Cancel error:', error);
    return false;
  }

  return (count ?? 0) > 0;
}
