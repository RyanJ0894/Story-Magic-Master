-- Story Magic MVP Schema
-- Initial migration for core tables

-- ===================
-- PROFILES
-- ===================
-- Extends Supabase auth.users with app-specific data
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    full_name TEXT,
    avatar_url TEXT,
    subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'creator', 'pro', 'studio')),
    stripe_customer_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO profiles (id, email, full_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ===================
-- PROJECTS
-- ===================
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'processing', 'completed', 'failed')),
    script_text TEXT,
    page_count INTEGER DEFAULT 0,
    director_json JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for user's projects
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);

-- ===================
-- JOBS
-- ===================
-- Track generation jobs for async processing
CREATE TABLE IF NOT EXISTS jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
    progress JSONB DEFAULT '{"step": "queued", "percent": 0}',
    result JSONB,
    error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

-- Indexes for job queries
CREATE INDEX IF NOT EXISTS idx_jobs_project_id ON jobs(project_id);
CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);

-- ===================
-- AUDIO OUTPUTS
-- ===================
-- Store generated audio file references
CREATE TABLE IF NOT EXISTS audio_outputs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    duration_seconds DECIMAL(10,2),
    format TEXT DEFAULT 'mp3',
    storage_bucket TEXT DEFAULT 'audio-outputs',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audio_outputs_project_id ON audio_outputs(project_id);

-- ===================
-- USAGE TRACKING
-- ===================
-- Track pages used per billing period
CREATE TABLE IF NOT EXISTS usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    period TEXT NOT NULL, -- Format: 'YYYY-MM'
    pages_used INTEGER DEFAULT 0,
    pages_limit INTEGER DEFAULT 3, -- Free tier default
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, period)
);

CREATE INDEX IF NOT EXISTS idx_usage_user_period ON usage(user_id, period);

-- ===================
-- ROW LEVEL SECURITY
-- ===================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audio_outputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can read/update their own profile
CREATE POLICY "Users can view own profile"
    ON profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE
    USING (auth.uid() = id);

-- Projects: Users can CRUD their own projects
CREATE POLICY "Users can view own projects"
    ON projects FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create projects"
    ON projects FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own projects"
    ON projects FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own projects"
    ON projects FOR DELETE
    USING (auth.uid() = user_id);

-- Jobs: Users can view their own jobs
CREATE POLICY "Users can view own jobs"
    ON jobs FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create jobs"
    ON jobs FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Audio outputs: Users can view outputs for their projects
CREATE POLICY "Users can view own audio outputs"
    ON audio_outputs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = audio_outputs.project_id
            AND projects.user_id = auth.uid()
        )
    );

-- Usage: Users can view their own usage
CREATE POLICY "Users can view own usage"
    ON usage FOR SELECT
    USING (auth.uid() = user_id);

-- ===================
-- HELPER FUNCTIONS
-- ===================

-- Get current billing period
CREATE OR REPLACE FUNCTION current_billing_period()
RETURNS TEXT AS $$
BEGIN
    RETURN TO_CHAR(NOW(), 'YYYY-MM');
END;
$$ LANGUAGE plpgsql;

-- Get user's remaining pages for current period
CREATE OR REPLACE FUNCTION get_remaining_pages(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_usage RECORD;
    v_limit INTEGER;
BEGIN
    -- Get user's tier limit
    SELECT
        CASE subscription_tier
            WHEN 'free' THEN 3
            WHEN 'creator' THEN 50
            WHEN 'pro' THEN 200
            WHEN 'studio' THEN 1000
            ELSE 3
        END INTO v_limit
    FROM profiles
    WHERE id = p_user_id;

    -- Get current usage
    SELECT pages_used INTO v_usage
    FROM usage
    WHERE user_id = p_user_id
    AND period = current_billing_period();

    IF v_usage IS NULL THEN
        RETURN v_limit;
    END IF;

    RETURN GREATEST(0, v_limit - v_usage.pages_used);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Increment usage (called after successful generation)
CREATE OR REPLACE FUNCTION increment_usage(p_user_id UUID, p_pages INTEGER)
RETURNS VOID AS $$
BEGIN
    INSERT INTO usage (user_id, period, pages_used)
    VALUES (p_user_id, current_billing_period(), p_pages)
    ON CONFLICT (user_id, period)
    DO UPDATE SET
        pages_used = usage.pages_used + p_pages,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update timestamps trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to tables
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_usage_updated_at
    BEFORE UPDATE ON usage
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
