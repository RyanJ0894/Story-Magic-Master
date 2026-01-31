-- Add voice_assignments JSONB column to projects table
-- Stores user-selected voice assignments as an array of {character_name, voice_id, voice_name, locked}
ALTER TABLE projects ADD COLUMN IF NOT EXISTS voice_assignments JSONB DEFAULT '[]'::jsonb;

-- Add index for querying projects with voice assignments
CREATE INDEX IF NOT EXISTS idx_projects_voice_assignments
  ON projects USING gin (voice_assignments) WHERE voice_assignments != '[]'::jsonb;
