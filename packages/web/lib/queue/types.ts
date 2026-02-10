/**
 * Job Queue Types
 *
 * Types for the job queue system with FIFO processing and priority support.
 */

// =============================================================================
// Job Types
// =============================================================================

export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed';

export type JobType = 'audio_generation' | 'scene_regeneration' | 'pdf_extract' | 'ocr_extract' | 'score_generation' | 'suggestion_generation';

export interface Job {
  id: string;
  projectId: string;
  userId: string;
  status: JobStatus;
  jobType: JobType;
  priority: number;
  progress: JobProgress;
  result: Record<string, unknown> | null;
  error: string | null;
  retryCount: number;
  maxRetries: number;
  lastError: string | null;
  workerId: string | null;
  queuedAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  estimatedDurationMs: number | null;
  actualDurationMs: number | null;
}

export interface JobProgress {
  step: string;
  percent: number;
  details?: string;
  error?: string;
  retryAttempt?: number;
  updatedAt?: string;
}

// =============================================================================
// Queue Operations
// =============================================================================

export interface EnqueueOptions {
  projectId: string;
  userId: string;
  jobType?: JobType;
  priority?: number;
  maxRetries?: number;
  estimatedDurationMs?: number;
  metadata?: Record<string, unknown>;
}

export interface EnqueueResult {
  jobId: string;
  position: number;
  estimatedWaitSeconds: number;
}

export interface DequeueResult {
  jobId: string;
  projectId: string;
  userId: string;
  jobType: JobType;
  priority: number;
  retryCount: number;
}

export interface QueuePosition {
  position: number;
  estimatedWaitSeconds: number;
  jobsAhead: number;
}

// =============================================================================
// Queue Statistics
// =============================================================================

export interface QueueStats {
  jobType: JobType;
  queuedCount: number;
  processingCount: number;
  completed24h: number;
  failed24h: number;
  avgDurationMs: number | null;
  oldestQueuedAt: Date | null;
  staleLocks: number;
}

export interface QueueSummary {
  totalQueued: number;
  totalProcessing: number;
  totalCompleted24h: number;
  totalFailed24h: number;
  avgWaitTimeSeconds: number;
  statsByType: QueueStats[];
}

// =============================================================================
// Worker Types
// =============================================================================

export interface WorkerConfig {
  workerId: string;
  pollIntervalMs: number;
  lockDurationSeconds: number;
  maxConcurrentJobs: number;
  jobTypes?: JobType[];
}

export interface WorkerStatus {
  workerId: string;
  isRunning: boolean;
  currentJobId: string | null;
  jobsProcessed: number;
  lastPollAt: Date | null;
  startedAt: Date;
}

// =============================================================================
// Database Row Types (for Supabase)
// =============================================================================

export interface JobRow {
  id: string;
  project_id: string;
  user_id: string;
  status: string;
  job_type: string;
  priority: number;
  progress: JobProgress;
  result: Record<string, unknown> | null;
  error: string | null;
  retry_count: number;
  max_retries: number;
  last_error: string | null;
  worker_id: string | null;
  processing_lock: string | null;
  lock_expires_at: string | null;
  queued_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  estimated_duration_ms: number | null;
  actual_duration_ms: number | null;
}

// =============================================================================
// Helper Functions
// =============================================================================

export function jobRowToJob(row: JobRow): Job {
  return {
    id: row.id,
    projectId: row.project_id,
    userId: row.user_id,
    status: row.status as JobStatus,
    jobType: row.job_type as JobType,
    priority: row.priority,
    progress: row.progress,
    result: row.result,
    error: row.error,
    retryCount: row.retry_count,
    maxRetries: row.max_retries,
    lastError: row.last_error,
    workerId: row.worker_id,
    queuedAt: row.queued_at ? new Date(row.queued_at) : null,
    startedAt: row.started_at ? new Date(row.started_at) : null,
    completedAt: row.completed_at ? new Date(row.completed_at) : null,
    createdAt: new Date(row.created_at),
    estimatedDurationMs: row.estimated_duration_ms,
    actualDurationMs: row.actual_duration_ms,
  };
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

export function formatWaitTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
}
