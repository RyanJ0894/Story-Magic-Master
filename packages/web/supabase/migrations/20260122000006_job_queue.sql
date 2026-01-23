-- =============================================================================
-- Job Queue System
-- Adds queue management columns for FIFO processing with future priority support
-- =============================================================================

-- =============================================================================
-- Add Queue Columns to Jobs Table
-- =============================================================================

-- Priority (0 = normal, higher = more important, for future use)
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 0;

-- Queue position timestamp (for FIFO ordering)
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS queued_at TIMESTAMPTZ;

-- Processing lock (prevents duplicate processing)
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS processing_lock UUID;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS lock_expires_at TIMESTAMPTZ;

-- Worker identification
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS worker_id TEXT;

-- Retry tracking
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS max_retries INTEGER DEFAULT 3;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS last_error TEXT;

-- Job type for different processing paths
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS job_type TEXT DEFAULT 'audio_generation';

-- Estimated processing time (for queue time estimation)
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS estimated_duration_ms INTEGER;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS actual_duration_ms INTEGER;

-- =============================================================================
-- Indexes for Queue Operations
-- =============================================================================

-- Index for finding next job to process (FIFO with priority)
CREATE INDEX IF NOT EXISTS idx_jobs_queue_order
ON jobs (priority DESC, queued_at ASC)
WHERE status = 'queued';

-- Index for finding locked jobs that need cleanup
CREATE INDEX IF NOT EXISTS idx_jobs_expired_locks
ON jobs (lock_expires_at)
WHERE status = 'processing' AND lock_expires_at IS NOT NULL;

-- Index for job type
CREATE INDEX IF NOT EXISTS idx_jobs_job_type ON jobs (job_type);

-- =============================================================================
-- Queue Functions
-- =============================================================================

-- Function to get the next job in queue (FIFO with priority)
-- Uses SELECT FOR UPDATE SKIP LOCKED for safe concurrent access
CREATE OR REPLACE FUNCTION get_next_queued_job(
    p_worker_id TEXT,
    p_lock_duration_seconds INTEGER DEFAULT 300  -- 5 minute default lock
)
RETURNS TABLE (
    job_id UUID,
    project_id UUID,
    user_id UUID,
    job_type TEXT,
    priority INTEGER,
    retry_count INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_job_id UUID;
    v_lock_id UUID := gen_random_uuid();
    v_lock_expires TIMESTAMPTZ := NOW() + (p_lock_duration_seconds || ' seconds')::INTERVAL;
BEGIN
    -- Find and lock the next available job
    SELECT j.id INTO v_job_id
    FROM jobs j
    WHERE j.status = 'queued'
      AND (j.lock_expires_at IS NULL OR j.lock_expires_at < NOW())
    ORDER BY j.priority DESC, j.queued_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    -- If no job found, return empty
    IF v_job_id IS NULL THEN
        RETURN;
    END IF;

    -- Lock the job
    UPDATE jobs
    SET
        status = 'processing',
        processing_lock = v_lock_id,
        lock_expires_at = v_lock_expires,
        worker_id = p_worker_id,
        started_at = NOW(),
        progress = jsonb_build_object(
            'step', 'initializing',
            'percent', 0,
            'updated_at', NOW()
        )
    WHERE id = v_job_id;

    -- Return the locked job
    RETURN QUERY
    SELECT
        j.id,
        j.project_id,
        j.user_id,
        j.job_type,
        j.priority,
        j.retry_count
    FROM jobs j
    WHERE j.id = v_job_id;
END;
$$;

-- Function to release a job lock (for graceful shutdown)
CREATE OR REPLACE FUNCTION release_job_lock(
    p_job_id UUID,
    p_worker_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
    v_updated BOOLEAN;
BEGIN
    UPDATE jobs
    SET
        status = 'queued',
        processing_lock = NULL,
        lock_expires_at = NULL,
        worker_id = NULL,
        started_at = NULL
    WHERE id = p_job_id
      AND worker_id = p_worker_id
      AND status = 'processing';

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    RETURN v_updated > 0;
END;
$$;

-- Function to mark job as completed
CREATE OR REPLACE FUNCTION complete_job(
    p_job_id UUID,
    p_result JSONB DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
    v_started_at TIMESTAMPTZ;
    v_duration_ms INTEGER;
BEGIN
    -- Get started_at for duration calculation
    SELECT started_at INTO v_started_at
    FROM jobs WHERE id = p_job_id;

    IF v_started_at IS NOT NULL THEN
        v_duration_ms := EXTRACT(EPOCH FROM (NOW() - v_started_at)) * 1000;
    END IF;

    UPDATE jobs
    SET
        status = 'completed',
        completed_at = NOW(),
        processing_lock = NULL,
        lock_expires_at = NULL,
        result = COALESCE(p_result, result),
        actual_duration_ms = v_duration_ms,
        progress = jsonb_build_object(
            'step', 'done',
            'percent', 100,
            'updated_at', NOW()
        )
    WHERE id = p_job_id;

    RETURN FOUND;
END;
$$;

-- Function to mark job as failed (with retry support)
CREATE OR REPLACE FUNCTION fail_job(
    p_job_id UUID,
    p_error TEXT,
    p_should_retry BOOLEAN DEFAULT TRUE
)
RETURNS TABLE (
    retrying BOOLEAN,
    retry_count INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_retry_count INTEGER;
    v_max_retries INTEGER;
    v_should_retry BOOLEAN;
BEGIN
    -- Get current retry info
    SELECT j.retry_count, j.max_retries
    INTO v_retry_count, v_max_retries
    FROM jobs j WHERE j.id = p_job_id;

    -- Determine if we should retry
    v_should_retry := p_should_retry AND (v_retry_count < v_max_retries);

    IF v_should_retry THEN
        -- Requeue for retry
        UPDATE jobs
        SET
            status = 'queued',
            processing_lock = NULL,
            lock_expires_at = NULL,
            worker_id = NULL,
            retry_count = v_retry_count + 1,
            last_error = p_error,
            queued_at = NOW() + ((v_retry_count + 1) * INTERVAL '30 seconds'),  -- Exponential backoff
            progress = jsonb_build_object(
                'step', 'retrying',
                'percent', 0,
                'error', p_error,
                'retry_attempt', v_retry_count + 1,
                'updated_at', NOW()
            )
        WHERE id = p_job_id;

        RETURN QUERY SELECT TRUE, v_retry_count + 1;
    ELSE
        -- Mark as failed permanently
        UPDATE jobs
        SET
            status = 'failed',
            completed_at = NOW(),
            processing_lock = NULL,
            lock_expires_at = NULL,
            error = p_error,
            last_error = p_error,
            progress = jsonb_build_object(
                'step', 'failed',
                'percent', 0,
                'error', p_error,
                'updated_at', NOW()
            )
        WHERE id = p_job_id;

        -- Also update project status
        UPDATE projects
        SET status = 'failed'
        WHERE id = (SELECT project_id FROM jobs WHERE id = p_job_id);

        RETURN QUERY SELECT FALSE, v_retry_count;
    END IF;
END;
$$;

-- Function to cleanup expired locks (for crashed workers)
CREATE OR REPLACE FUNCTION cleanup_expired_job_locks()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    UPDATE jobs
    SET
        status = 'queued',
        processing_lock = NULL,
        lock_expires_at = NULL,
        worker_id = NULL,
        retry_count = retry_count + 1,
        last_error = 'Worker timeout - job lock expired',
        progress = jsonb_build_object(
            'step', 'queued',
            'percent', 0,
            'error', 'Worker timeout - automatically requeued',
            'updated_at', NOW()
        )
    WHERE status = 'processing'
      AND lock_expires_at IS NOT NULL
      AND lock_expires_at < NOW()
      AND retry_count < max_retries;

    GET DIAGNOSTICS v_count = ROW_COUNT;

    -- Mark jobs that exceeded retries as failed
    UPDATE jobs
    SET
        status = 'failed',
        completed_at = NOW(),
        processing_lock = NULL,
        lock_expires_at = NULL,
        error = 'Max retries exceeded after worker timeout',
        progress = jsonb_build_object(
            'step', 'failed',
            'percent', 0,
            'error', 'Max retries exceeded',
            'updated_at', NOW()
        )
    WHERE status = 'processing'
      AND lock_expires_at IS NOT NULL
      AND lock_expires_at < NOW()
      AND retry_count >= max_retries;

    RETURN v_count;
END;
$$;

-- =============================================================================
-- Queue Statistics View
-- =============================================================================

CREATE OR REPLACE VIEW queue_stats AS
SELECT
    job_type,
    COUNT(*) FILTER (WHERE status = 'queued') AS queued_count,
    COUNT(*) FILTER (WHERE status = 'processing') AS processing_count,
    COUNT(*) FILTER (WHERE status = 'completed' AND completed_at > NOW() - INTERVAL '24 hours') AS completed_24h,
    COUNT(*) FILTER (WHERE status = 'failed' AND completed_at > NOW() - INTERVAL '24 hours') AS failed_24h,
    AVG(actual_duration_ms) FILTER (WHERE status = 'completed' AND completed_at > NOW() - INTERVAL '24 hours') AS avg_duration_ms,
    MAX(queued_at) FILTER (WHERE status = 'queued') AS oldest_queued_at,
    COUNT(*) FILTER (WHERE status = 'processing' AND lock_expires_at < NOW()) AS stale_locks
FROM jobs
GROUP BY job_type;

-- =============================================================================
-- User Queue Position Function
-- =============================================================================

CREATE OR REPLACE FUNCTION get_queue_position(p_job_id UUID)
RETURNS TABLE (
    position INTEGER,
    estimated_wait_seconds INTEGER,
    jobs_ahead INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_queued_at TIMESTAMPTZ;
    v_priority INTEGER;
    v_jobs_ahead INTEGER;
    v_avg_duration INTEGER;
BEGIN
    -- Get the job's queue info
    SELECT queued_at, priority
    INTO v_queued_at, v_priority
    FROM jobs
    WHERE id = p_job_id AND status = 'queued';

    IF v_queued_at IS NULL THEN
        -- Job not in queue
        RETURN QUERY SELECT NULL::INTEGER, NULL::INTEGER, NULL::INTEGER;
        RETURN;
    END IF;

    -- Count jobs ahead in queue
    SELECT COUNT(*)
    INTO v_jobs_ahead
    FROM jobs
    WHERE status = 'queued'
      AND (priority > v_priority OR (priority = v_priority AND queued_at < v_queued_at));

    -- Get average duration from recent completed jobs
    SELECT COALESCE(AVG(actual_duration_ms), 60000)::INTEGER  -- Default 60s
    INTO v_avg_duration
    FROM jobs
    WHERE status = 'completed'
      AND completed_at > NOW() - INTERVAL '24 hours';

    RETURN QUERY SELECT
        (v_jobs_ahead + 1)::INTEGER,
        ((v_jobs_ahead * v_avg_duration) / 1000)::INTEGER,
        v_jobs_ahead::INTEGER;
END;
$$;

-- =============================================================================
-- Update existing queued jobs to have queued_at
-- =============================================================================

UPDATE jobs
SET queued_at = created_at
WHERE status = 'queued' AND queued_at IS NULL;

-- =============================================================================
-- Trigger to set queued_at on insert
-- =============================================================================

CREATE OR REPLACE FUNCTION set_job_queued_at()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'queued' AND NEW.queued_at IS NULL THEN
        NEW.queued_at := NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_job_queued_at ON jobs;
CREATE TRIGGER trigger_set_job_queued_at
    BEFORE INSERT OR UPDATE ON jobs
    FOR EACH ROW
    EXECUTE FUNCTION set_job_queued_at();
