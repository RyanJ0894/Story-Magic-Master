-- Story-Adviser Suggestions Migration
-- AI-generated suggestions linked to StoryScore dimensions

-- ===================
-- SUGGESTIONS TABLE
-- ===================
CREATE TABLE IF NOT EXISTS suggestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    score_id UUID REFERENCES story_scores(id) ON DELETE SET NULL,

    -- Location in script
    start_line INT NOT NULL,
    end_line INT NOT NULL,
    start_char INT,
    end_char INT,
    excerpt TEXT NOT NULL,
    scene_number INT,
    scene_heading TEXT,

    -- Classification
    category TEXT NOT NULL CHECK (category IN (
        'premise', 'clarity', 'commercial',
        'structure', 'pacing', 'stakes',
        'protagonist', 'supporting', 'castability',
        'dialogue', 'visual', 'technical'
    )),
    severity TEXT NOT NULL CHECK (severity IN ('critical', 'important', 'minor')),

    -- Content
    title TEXT NOT NULL,
    explanation TEXT NOT NULL,
    suggestion TEXT NOT NULL,

    -- Status lifecycle
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending', 'accepted', 'rejected', 'dismissed'
    )),
    user_feedback TEXT,

    -- Metadata
    confidence DECIMAL(3,2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    responded_at TIMESTAMPTZ
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_suggestions_project_id ON suggestions(project_id);
CREATE INDEX IF NOT EXISTS idx_suggestions_score_id ON suggestions(score_id);
CREATE INDEX IF NOT EXISTS idx_suggestions_status ON suggestions(status);
CREATE INDEX IF NOT EXISTS idx_suggestions_category ON suggestions(category);
CREATE INDEX IF NOT EXISTS idx_suggestions_severity ON suggestions(severity);
CREATE INDEX IF NOT EXISTS idx_suggestions_location ON suggestions(project_id, start_line, end_line);

-- ===================
-- REWRITES TABLE
-- ===================
CREATE TABLE IF NOT EXISTS rewrites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    suggestion_id UUID NOT NULL REFERENCES suggestions(id) ON DELETE CASCADE,

    -- Content
    original_text TEXT NOT NULL,
    rewritten_text TEXT NOT NULL,
    explanation TEXT NOT NULL,

    -- Selection
    selected BOOLEAN DEFAULT FALSE,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rewrites_suggestion_id ON rewrites(suggestion_id);

-- ===================
-- ROW LEVEL SECURITY
-- ===================
ALTER TABLE suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE rewrites ENABLE ROW LEVEL SECURITY;

-- Users can view suggestions for their own projects
CREATE POLICY "Users can view own suggestions"
    ON suggestions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = suggestions.project_id
            AND projects.user_id = auth.uid()
        )
    );

-- Users can create suggestions for their own projects
CREATE POLICY "Users can create suggestions"
    ON suggestions FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = suggestions.project_id
            AND projects.user_id = auth.uid()
        )
    );

-- Users can update suggestions for their own projects
CREATE POLICY "Users can update own suggestions"
    ON suggestions FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = suggestions.project_id
            AND projects.user_id = auth.uid()
        )
    );

-- Users can delete suggestions for their own projects
CREATE POLICY "Users can delete own suggestions"
    ON suggestions FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = suggestions.project_id
            AND projects.user_id = auth.uid()
        )
    );

-- Rewrites: Users can view/create/update rewrites for their suggestions
CREATE POLICY "Users can view own rewrites"
    ON rewrites FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM suggestions
            JOIN projects ON projects.id = suggestions.project_id
            WHERE suggestions.id = rewrites.suggestion_id
            AND projects.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create rewrites"
    ON rewrites FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM suggestions
            JOIN projects ON projects.id = suggestions.project_id
            WHERE suggestions.id = rewrites.suggestion_id
            AND projects.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update own rewrites"
    ON rewrites FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM suggestions
            JOIN projects ON projects.id = suggestions.project_id
            WHERE suggestions.id = rewrites.suggestion_id
            AND projects.user_id = auth.uid()
        )
    );

-- ===================
-- HELPER FUNCTIONS
-- ===================

-- Get suggestion stats for a project
CREATE OR REPLACE FUNCTION get_suggestion_stats(p_project_id UUID)
RETURNS TABLE (
    total BIGINT,
    pending BIGINT,
    accepted BIGINT,
    rejected BIGINT,
    dismissed BIGINT,
    critical BIGINT,
    important BIGINT,
    minor BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::BIGINT as total,
        COUNT(*) FILTER (WHERE status = 'pending')::BIGINT as pending,
        COUNT(*) FILTER (WHERE status = 'accepted')::BIGINT as accepted,
        COUNT(*) FILTER (WHERE status = 'rejected')::BIGINT as rejected,
        COUNT(*) FILTER (WHERE status = 'dismissed')::BIGINT as dismissed,
        COUNT(*) FILTER (WHERE severity = 'critical')::BIGINT as critical,
        COUNT(*) FILTER (WHERE severity = 'important')::BIGINT as important,
        COUNT(*) FILTER (WHERE severity = 'minor')::BIGINT as minor
    FROM suggestions
    WHERE project_id = p_project_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Clear all suggestions for a project (before regenerating)
CREATE OR REPLACE FUNCTION clear_project_suggestions(p_project_id UUID)
RETURNS VOID AS $$
BEGIN
    DELETE FROM suggestions WHERE project_id = p_project_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
