-- Add real-time progress tracking to test_runs
-- Tracks which story is currently being executed

ALTER TABLE test_runs
ADD COLUMN current_story_id UUID REFERENCES stories(id) ON DELETE SET NULL,
ADD COLUMN current_story_name VARCHAR(100);

COMMENT ON COLUMN test_runs.current_story_id IS 'The story currently being executed';
COMMENT ON COLUMN test_runs.current_story_name IS 'Name of the current story (denormalized for display)';
