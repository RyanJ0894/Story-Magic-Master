-- Project Runs and Workflow Mode
-- Track run numbers and workflow mode (automatic vs fine-tuned)

-- ===================
-- JOBS TABLE UPDATES
-- ===================

-- Add run_number to jobs (sequential per project)
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS run_number INTEGER;

-- Add workflow_mode to jobs
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS workflow_mode TEXT DEFAULT 'automatic'
  CHECK (workflow_mode IN ('automatic', 'fine_tuned'));

-- ===================
-- PROJECTS TABLE UPDATES
-- ===================

-- Add preferred workflow mode to projects (remembers user's last choice)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS preferred_workflow_mode TEXT DEFAULT 'automatic'
  CHECK (preferred_workflow_mode IN ('automatic', 'fine_tuned'));

-- Add current run number counter
ALTER TABLE projects ADD COLUMN IF NOT EXISTS current_run_number INTEGER DEFAULT 0;

-- ===================
-- AUTO-INCREMENT RUN NUMBER
-- ===================

-- Function to get next run number for a project
CREATE OR REPLACE FUNCTION get_next_run_number(p_project_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_next_run INTEGER;
BEGIN
  -- Increment and get the new run number
  UPDATE projects
  SET current_run_number = current_run_number + 1
  WHERE id = p_project_id
  RETURNING current_run_number INTO v_next_run;

  RETURN v_next_run;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-set run_number on job insert
CREATE OR REPLACE FUNCTION set_job_run_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.run_number IS NULL THEN
    NEW.run_number := get_next_run_number(NEW.project_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_job_run_number_trigger ON jobs;
CREATE TRIGGER set_job_run_number_trigger
  BEFORE INSERT ON jobs
  FOR EACH ROW EXECUTE FUNCTION set_job_run_number();

-- ===================
-- BACKFILL EXISTING DATA
-- ===================

-- Backfill run numbers for existing jobs (ordered by created_at)
WITH numbered_jobs AS (
  SELECT
    id,
    project_id,
    ROW_NUMBER() OVER (PARTITION BY project_id ORDER BY created_at) as rn
  FROM jobs
  WHERE run_number IS NULL
)
UPDATE jobs
SET run_number = numbered_jobs.rn
FROM numbered_jobs
WHERE jobs.id = numbered_jobs.id;

-- Update project counters based on max run number
UPDATE projects
SET current_run_number = COALESCE(
  (SELECT MAX(run_number) FROM jobs WHERE jobs.project_id = projects.id),
  0
);

-- ===================
-- INDEXES
-- ===================

CREATE INDEX IF NOT EXISTS idx_jobs_run_number ON jobs(project_id, run_number);
