-- Story Scores Migration
-- AI-powered 12-dimension screenplay evaluation system

-- ===================
-- STORY SCORES TABLE
-- ===================
CREATE TABLE IF NOT EXISTS story_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    version INTEGER NOT NULL DEFAULT 1,

    -- Concept Dimensions (scores 1-10)
    premise_originality DECIMAL(3,1) NOT NULL CHECK (premise_originality >= 1 AND premise_originality <= 10),
    premise_originality_reasoning TEXT NOT NULL,
    logline_clarity DECIMAL(3,1) NOT NULL CHECK (logline_clarity >= 1 AND logline_clarity <= 10),
    logline_clarity_reasoning TEXT NOT NULL,
    commercial_viability DECIMAL(3,1) NOT NULL CHECK (commercial_viability >= 1 AND commercial_viability <= 10),
    commercial_viability_reasoning TEXT NOT NULL,

    -- Structure Dimensions
    three_act_integrity DECIMAL(3,1) NOT NULL CHECK (three_act_integrity >= 1 AND three_act_integrity <= 10),
    three_act_integrity_reasoning TEXT NOT NULL,
    pacing_momentum DECIMAL(3,1) NOT NULL CHECK (pacing_momentum >= 1 AND pacing_momentum <= 10),
    pacing_momentum_reasoning TEXT NOT NULL,
    stakes_escalation DECIMAL(3,1) NOT NULL CHECK (stakes_escalation >= 1 AND stakes_escalation <= 10),
    stakes_escalation_reasoning TEXT NOT NULL,

    -- Character Dimensions
    protagonist_arc DECIMAL(3,1) NOT NULL CHECK (protagonist_arc >= 1 AND protagonist_arc <= 10),
    protagonist_arc_reasoning TEXT NOT NULL,
    supporting_cast DECIMAL(3,1) NOT NULL CHECK (supporting_cast >= 1 AND supporting_cast <= 10),
    supporting_cast_reasoning TEXT NOT NULL,
    castability DECIMAL(3,1) NOT NULL CHECK (castability >= 1 AND castability <= 10),
    castability_reasoning TEXT NOT NULL,

    -- Craft Dimensions
    dialogue_quality DECIMAL(3,1) NOT NULL CHECK (dialogue_quality >= 1 AND dialogue_quality <= 10),
    dialogue_quality_reasoning TEXT NOT NULL,
    visual_storytelling DECIMAL(3,1) NOT NULL CHECK (visual_storytelling >= 1 AND visual_storytelling <= 10),
    visual_storytelling_reasoning TEXT NOT NULL,
    technical_execution DECIMAL(3,1) NOT NULL CHECK (technical_execution >= 1 AND technical_execution <= 10),
    technical_execution_reasoning TEXT NOT NULL,

    -- Computed Category Scores (weighted averages)
    concept_score DECIMAL(3,1) NOT NULL,
    structure_score DECIMAL(3,1) NOT NULL,
    character_score DECIMAL(3,1) NOT NULL,
    craft_score DECIMAL(3,1) NOT NULL,

    -- Overall
    overall_score DECIMAL(3,1) NOT NULL,
    rating TEXT NOT NULL CHECK (rating IN (
        'STRONG_RECOMMEND',
        'RECOMMEND',
        'CONSIDER',
        'CONSIDER_WITH_RESERVATIONS',
        'PASS',
        'STRONG_PASS'
    )),

    -- Analysis
    strengths TEXT[] NOT NULL DEFAULT '{}',
    weaknesses TEXT[] NOT NULL DEFAULT '{}',

    -- Metadata
    confidence DECIMAL(3,2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    model_version TEXT NOT NULL DEFAULT 'gpt-4o',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_story_scores_project_id ON story_scores(project_id);
CREATE INDEX IF NOT EXISTS idx_story_scores_version ON story_scores(project_id, version DESC);
CREATE INDEX IF NOT EXISTS idx_story_scores_rating ON story_scores(rating);
CREATE INDEX IF NOT EXISTS idx_story_scores_overall ON story_scores(overall_score DESC);

-- Unique constraint: one score per project per version
CREATE UNIQUE INDEX IF NOT EXISTS idx_story_scores_project_version
    ON story_scores(project_id, version);

-- ===================
-- ROW LEVEL SECURITY
-- ===================
ALTER TABLE story_scores ENABLE ROW LEVEL SECURITY;

-- Users can view scores for their own projects
CREATE POLICY "Users can view own story scores"
    ON story_scores FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = story_scores.project_id
            AND projects.user_id = auth.uid()
        )
    );

-- Users can create scores for their own projects
CREATE POLICY "Users can create story scores"
    ON story_scores FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = story_scores.project_id
            AND projects.user_id = auth.uid()
        )
    );

-- Users can delete scores for their own projects
CREATE POLICY "Users can delete own story scores"
    ON story_scores FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = story_scores.project_id
            AND projects.user_id = auth.uid()
        )
    );

-- ===================
-- HELPER FUNCTIONS
-- ===================

-- Get next version number for a project's scores
CREATE OR REPLACE FUNCTION get_next_score_version(p_project_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_max_version INTEGER;
BEGIN
    SELECT COALESCE(MAX(version), 0) INTO v_max_version
    FROM story_scores
    WHERE project_id = p_project_id;

    RETURN v_max_version + 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get latest score for a project
CREATE OR REPLACE FUNCTION get_latest_score(p_project_id UUID)
RETURNS SETOF story_scores AS $$
BEGIN
    RETURN QUERY
    SELECT *
    FROM story_scores
    WHERE project_id = p_project_id
    ORDER BY version DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
