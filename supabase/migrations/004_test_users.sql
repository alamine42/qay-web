-- Test Users per Environment
-- Allows storing test credentials for different roles per environment

-- =============================================================================
-- TEST USERS TABLE
-- =============================================================================

CREATE TABLE test_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  environment_id UUID NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL,
  username VARCHAR(255) NOT NULL,
  password_encrypted TEXT NOT NULL,
  description TEXT,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(environment_id, role)  -- one user per role per environment
);

CREATE INDEX idx_test_users_environment ON test_users(environment_id);
CREATE INDEX idx_test_users_role ON test_users(role);

-- =============================================================================
-- ADD REQUIRED ROLE TO STORIES
-- =============================================================================

ALTER TABLE stories ADD COLUMN required_role VARCHAR(50);

CREATE INDEX idx_stories_required_role ON stories(required_role);

-- =============================================================================
-- UPDATED_AT TRIGGER FOR TEST USERS
-- =============================================================================

CREATE TRIGGER update_test_users_updated_at
  BEFORE UPDATE ON test_users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- ROW LEVEL SECURITY POLICIES FOR TEST USERS
-- =============================================================================

ALTER TABLE test_users ENABLE ROW LEVEL SECURITY;

-- Members can view test users for their environments
CREATE POLICY "Members can view test users"
  ON test_users FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM environments
    JOIN apps ON apps.id = environments.app_id
    WHERE environments.id = test_users.environment_id
    AND is_org_member(apps.organization_id)
  ));

-- Members can create test users
CREATE POLICY "Members can create test users"
  ON test_users FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM environments
    JOIN apps ON apps.id = environments.app_id
    WHERE environments.id = test_users.environment_id
    AND get_org_role(apps.organization_id) IN ('owner', 'admin', 'member')
  ));

-- Members can update test users
CREATE POLICY "Members can update test users"
  ON test_users FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM environments
    JOIN apps ON apps.id = environments.app_id
    WHERE environments.id = test_users.environment_id
    AND get_org_role(apps.organization_id) IN ('owner', 'admin', 'member')
  ));

-- Admins can delete test users
CREATE POLICY "Admins can delete test users"
  ON test_users FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM environments
    JOIN apps ON apps.id = environments.app_id
    WHERE environments.id = test_users.environment_id
    AND get_org_role(apps.organization_id) IN ('owner', 'admin')
  ));
