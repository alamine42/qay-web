-- Enable Realtime for test_runs and test_results tables
-- This allows the UI to receive live updates during test execution

ALTER PUBLICATION supabase_realtime ADD TABLE test_runs;
ALTER PUBLICATION supabase_realtime ADD TABLE test_results;
