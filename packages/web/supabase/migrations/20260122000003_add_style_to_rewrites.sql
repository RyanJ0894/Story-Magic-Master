-- Add style column to rewrites table
-- This tracks the generation style used for each rewrite

ALTER TABLE rewrites
ADD COLUMN IF NOT EXISTS style TEXT CHECK (style IN ('conservative', 'moderate', 'bold'));

-- Add comment explaining the column
COMMENT ON COLUMN rewrites.style IS 'The generation style used: conservative (minimal changes), moderate (balanced), bold (creative)';
