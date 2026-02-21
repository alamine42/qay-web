// Database types extending CLI types for SaaS

export type Plan = 'free' | 'pro' | 'enterprise'
export type Role = 'owner' | 'admin' | 'member' | 'viewer'
export type TestStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped'
export type TriggerType = 'manual' | 'scheduled' | 'api' | 'ci'
export type HealStatus = 'proposed' | 'approved' | 'rejected' | 'applied'
export type HealProposalType = 'selector' | 'flow' | 'content'

// Organization
export interface Organization {
  id: string
  name: string
  slug: string
  plan: Plan
  settings: OrganizationSettings
  created_at: string
}

export interface OrganizationSettings {
  defaultTimezone?: string
  notificationEmail?: string
  slackWebhookUrl?: string
}

// Organization Member
export interface OrganizationMember {
  id: string
  organization_id: string
  user_id: string
  role: Role
  created_at: string
}

// App
export interface App {
  id: string
  organization_id: string
  name: string
  slug: string
  description?: string
  settings: AppSettings
  created_at: string
}

export interface AppSettings {
  defaultEnvironmentId?: string
  retryCount?: number
  screenshotOnFailure?: boolean
}

// Environment
export interface Environment {
  id: string
  app_id: string
  name: string
  base_url: string
  auth_config?: AuthConfig
  is_default: boolean
  created_at: string
}

export interface AuthConfig {
  type: 'none' | 'basic' | 'form' | 'oauth'
  username?: string
  password?: string
  loginUrl?: string
  usernameSelector?: string
  passwordSelector?: string
  submitSelector?: string
}

// Journey
export interface Journey {
  id: string
  app_id: string
  name: string
  title: string
  description?: string
  preconditions?: string[]
  position: number
  created_at: string
}

// Story
export interface Story {
  id: string
  journey_id: string
  name: string
  title: string
  preconditions?: StoryPrecondition[]
  steps: StoryStep[]
  outcome: StoryOutcome
  tags?: string[]
  position: number
  is_enabled: boolean
  generated_test_code?: string
  last_run_at?: string
  last_result?: TestStatus
  required_role?: string
  created_at: string
}

export interface StoryPrecondition {
  description: string
  type?: 'auth' | 'data' | 'state'
}

export interface StoryStep {
  action: string
  element?: string
  value?: string
  description?: string
  selector?: string
}

export interface StoryOutcome {
  description: string
  verifications: StoryVerification[]
}

export interface StoryVerification {
  type: 'visual' | 'element' | 'url' | 'content'
  target?: string
  expected: string
}

// Test Run
export interface TestRun {
  id: string
  organization_id: string
  app_id: string
  environment_id: string
  triggered_by: string
  trigger_type: TriggerType
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  stories_total: number
  stories_passed: number
  stories_failed: number
  stories_skipped: number
  duration_ms?: number
  started_at?: string
  completed_at?: string
  created_at: string
}

// Test Result
export interface TestResult {
  id: string
  test_run_id: string
  story_id: string
  journey_name: string
  story_name: string
  passed: boolean
  duration_ms: number
  steps?: StepResult[]
  error?: string
  screenshot_url?: string
  console_errors?: string[]
  heal_proposal?: HealProposal
  retries: number
  created_at: string
}

export interface StepResult {
  step: number
  action: string
  passed: boolean
  duration_ms: number
  error?: string
  screenshot?: string
}

// Scheduled Job
export interface ScheduledJob {
  id: string
  app_id: string
  environment_id: string
  name: string
  cron_expression: string
  timezone: string
  journey_ids?: string[]
  is_enabled: boolean
  next_run_at?: string
  created_at: string
}

// Heal History
export interface HealHistory {
  id: string
  story_id: string
  test_result_id: string
  proposal_type: HealProposalType
  original_code: string
  proposed_code: string
  confidence: number
  status: HealStatus
  created_at: string
}

export interface HealProposal {
  type: HealProposalType
  original: string
  proposed: string
  file?: string
  line?: number
  confidence: number
  reasoning: string
}

// API Response types
export interface ApiResponse<T> {
  data?: T
  error?: string
}

// Form input types
export interface CreateAppInput {
  name: string
  description?: string
  baseUrl: string
  environments?: {
    name: string
    base_url: string
  }[]
}

export interface CreateStoryInput {
  journeyId: string
  description: string
}

export interface TriggerRunInput {
  appId: string
  environmentId: string
  journeyIds?: string[]
  storyIds?: string[]
}

// Test User (client-safe version without password)
export interface TestUser {
  id: string
  environment_id?: string
  role: string
  username: string
  description?: string
  is_enabled: boolean
  created_at: string
  updated_at: string
}

export interface TestUserInput {
  environmentId: string
  role: string
  username: string
  password: string
  description?: string
}

export interface TestUserCredentials {
  username: string
  password: string
}
