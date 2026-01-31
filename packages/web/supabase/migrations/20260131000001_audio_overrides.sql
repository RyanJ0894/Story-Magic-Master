-- Add audio_overrides JSONB column to projects table
-- Stores user-selected audio overrides as an array of {scene_id, category, cue_index, track_id, file, title, user_selected, locked}
ALTER TABLE projects ADD COLUMN IF NOT EXISTS audio_overrides JSONB DEFAULT '[]'::jsonb;

-- Add index for querying projects with audio overrides
CREATE INDEX IF NOT EXISTS idx_projects_audio_overrides
  ON projects USING gin (audio_overrides) WHERE audio_overrides != '[]'::jsonb;
