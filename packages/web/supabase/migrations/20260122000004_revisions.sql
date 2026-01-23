-- Revision Tracking Migration
-- Tracks script versions and score trajectory over time

-- ===================
-- REVISIONS TABLE
-- ===================
CREATE TABLE IF NOT EXISTS revisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

    -- Version info
    version_number INT NOT NULL,
    label TEXT,

    -- Content snapshot
    script_text TEXT NOT NULL,
    word_count INT NOT NULL,
    page_count INT NOT NULL,

    -- Associated score (optional)
    score_id UUID REFERENCES story_scores(id) ON DELETE SET NULL,
    overall_score DECIMAL(4,1),

    -- Change summary from previous revision (JSON)
    changes_summary JSONB,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    -- Ensure unique version numbers per project
    UNIQUE(project_id, version_number)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_revisions_project_id ON revisions(project_id);
CREATE INDEX IF NOT EXISTS idx_revisions_score_id ON revisions(score_id);
CREATE INDEX IF NOT EXISTS idx_revisions_created_at ON revisions(created_at);
CREATE INDEX IF NOT EXISTS idx_revisions_version ON revisions(project_id, version_number DESC);

-- ===================
-- ROW LEVEL SECURITY
-- ===================
ALTER TABLE revisions ENABLE ROW LEVEL SECURITY;

-- Users can view revisions for their own projects
CREATE POLICY "Users can view own revisions"
    ON revisions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = revisions.project_id
            AND projects.user_id = auth.uid()
        )
    );

-- Users can create revisions for their own projects
CREATE POLICY "Users can create revisions"
    ON revisions FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = revisions.project_id
            AND projects.user_id = auth.uid()
        )
    );

-- Users can update revisions for their own projects (label only)
CREATE POLICY "Users can update own revisions"
    ON revisions FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = revisions.project_id
            AND projects.user_id = auth.uid()
        )
    );

-- Users can delete revisions for their own projects
CREATE POLICY "Users can delete own revisions"
    ON revisions FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = revisions.project_id
            AND projects.user_id = auth.uid()
        )
    );

-- ===================
-- HELPER FUNCTIONS
-- ===================

-- Get the next version number for a project
CREATE OR REPLACE FUNCTION get_next_version_number(p_project_id UUID)
RETURNS INT AS $$
DECLARE
    max_version INT;
BEGIN
    SELECT COALESCE(MAX(version_number), 0) INTO max_version
    FROM revisions
    WHERE project_id = p_project_id;

    RETURN max_version + 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get revision timeline for a project
CREATE OR REPLACE FUNCTION get_revision_timeline(p_project_id UUID)
RETURNS TABLE (
    id UUID,
    version_number INT,
    label TEXT,
    word_count INT,
    page_count INT,
    overall_score DECIMAL(4,1),
    changes_summary JSONB,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        r.id,
        r.version_number,
        r.label,
        r.word_count,
        r.page_count,
        r.overall_score,
        r.changes_summary,
        r.created_at
    FROM revisions r
    WHERE r.project_id = p_project_id
    ORDER BY r.version_number DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get score trajectory for a project (only scored revisions)
CREATE OR REPLACE FUNCTION get_score_trajectory(p_project_id UUID)
RETURNS TABLE (
    revision_id UUID,
    version_number INT,
    score DECIMAL(4,1),
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        r.id as revision_id,
        r.version_number,
        r.overall_score as score,
        r.created_at
    FROM revisions r
    WHERE r.project_id = p_project_id
    AND r.overall_score IS NOT NULL
    ORDER BY r.version_number ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Auto-create initial revision when project is created (trigger)
CREATE OR REPLACE FUNCTION create_initial_revision()
RETURNS TRIGGER AS $$
BEGIN
    -- Only create if script_text is not empty
    IF NEW.script_text IS NOT NULL AND LENGTH(TRIM(NEW.script_text)) > 0 THEN
        INSERT INTO revisions (
            project_id,
            version_number,
            label,
            script_text,
            word_count,
            page_count,
            created_by
        ) VALUES (
            NEW.id,
            1,
            'Initial upload',
            NEW.script_text,
            array_length(regexp_split_to_array(TRIM(NEW.script_text), '\s+'), 1),
            CEIL(array_length(regexp_split_to_array(TRIM(NEW.script_text), '\s+'), 1)::DECIMAL / 250),
            NEW.user_id
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for initial revision
DROP TRIGGER IF EXISTS trigger_create_initial_revision ON projects;
CREATE TRIGGER trigger_create_initial_revision
    AFTER INSERT ON projects
    FOR EACH ROW
    EXECUTE FUNCTION create_initial_revision();
