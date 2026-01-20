-- Job Logs Table for Detailed Audit Trail
-- Migration: 20260120000001
--
-- This table captures detailed logs for each job step, including:
-- - Progress updates at each stage
-- - Error messages with full stack traces
-- - Timing information for performance analysis
-- - Request/response data for debugging

CREATE TABLE IF NOT EXISTS job_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

    -- Log details
    level TEXT NOT NULL DEFAULT 'info' CHECK (level IN ('debug', 'info', 'warn', 'error')),
    step TEXT NOT NULL,  -- e.g., 'initializing', 'parsing', 'tts', 'mixing'
    message TEXT NOT NULL,

    -- Additional context (JSON for flexibility)
    metadata JSONB DEFAULT '{}',

    -- Error details (only for level='error')
    error_message TEXT,
    error_stack TEXT,

    -- Timing
    created_at TIMESTAMPTZ DEFAULT NOW(),
    duration_ms INTEGER  -- Time since previous log entry for this job
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_job_logs_job_id ON job_logs(job_id);
CREATE INDEX IF NOT EXISTS idx_job_logs_project_id ON job_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_job_logs_level ON job_logs(level) WHERE level = 'error';
CREATE INDEX IF NOT EXISTS idx_job_logs_created_at ON job_logs(created_at DESC);

-- Composite index for querying job logs by time
CREATE INDEX IF NOT EXISTS idx_job_logs_job_created ON job_logs(job_id, created_at);

-- Enable RLS
ALTER TABLE job_logs ENABLE ROW LEVEL SECURITY;

-- Users can view logs for their own jobs
CREATE POLICY "Users can view own job logs"
    ON job_logs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM jobs
            WHERE jobs.id = job_logs.job_id
            AND jobs.user_id = auth.uid()
        )
    );

-- Service role can insert logs (for background processing)
-- This is handled by using service role key, not RLS policy

-- =============================================================================
-- Helper function to log job events
-- =============================================================================
CREATE OR REPLACE FUNCTION log_job_event(
    p_job_id UUID,
    p_project_id UUID,
    p_level TEXT,
    p_step TEXT,
    p_message TEXT,
    p_metadata JSONB DEFAULT '{}',
    p_error_message TEXT DEFAULT NULL,
    p_error_stack TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_log_id UUID;
    v_last_log_time TIMESTAMPTZ;
    v_duration_ms INTEGER;
BEGIN
    -- Calculate duration since last log for this job
    SELECT created_at INTO v_last_log_time
    FROM job_logs
    WHERE job_id = p_job_id
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_last_log_time IS NOT NULL THEN
        v_duration_ms := EXTRACT(MILLISECONDS FROM (NOW() - v_last_log_time))::INTEGER;
    END IF;

    INSERT INTO job_logs (
        job_id, project_id, level, step, message,
        metadata, error_message, error_stack, duration_ms
    )
    VALUES (
        p_job_id, p_project_id, p_level, p_step, p_message,
        p_metadata, p_error_message, p_error_stack, v_duration_ms
    )
    RETURNING id INTO v_log_id;

    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- View for recent errors (useful for monitoring)
-- =============================================================================
CREATE OR REPLACE VIEW recent_job_errors AS
SELECT
    jl.id,
    jl.job_id,
    jl.project_id,
    j.user_id,
    p.name AS project_name,
    jl.step,
    jl.message,
    jl.error_message,
    jl.error_stack,
    jl.metadata,
    jl.created_at
FROM job_logs jl
JOIN jobs j ON j.id = jl.job_id
JOIN projects p ON p.id = jl.project_id
WHERE jl.level = 'error'
ORDER BY jl.created_at DESC
LIMIT 100;

-- Grant access to the view for authenticated users (filtered by RLS on underlying tables)
GRANT SELECT ON recent_job_errors TO authenticated;
