import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { executeStory } from "./execute-story"
import type { TestRunJobData } from "./types"
import { decrypt } from "./crypto"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

interface TestUser {
  id: string
  role: string
  username: string
  password_encrypted: string
  is_enabled: boolean
}

interface CredentialsMap {
  [role: string]: { username: string; password: string }
}

interface ProgressUpdate {
  total: number
  completed: number
  passed: number
  failed: number
  skipped: number
  current?: string
}

export async function executeTestRun(
  data: TestRunJobData,
  onProgress: (progress: ProgressUpdate) => void
): Promise<void> {
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(`Missing Supabase config: URL=${!!supabaseUrl}, KEY=${!!supabaseServiceKey}`)
  }

  console.log(`Connecting to Supabase: ${supabaseUrl}`)
  const supabase = createSupabaseClient(supabaseUrl, supabaseServiceKey)

  // Get test run
  const { data: testRun, error: runError } = await supabase
    .from("test_runs")
    .select("*")
    .eq("id", data.testRunId)
    .single()

  if (runError) {
    console.error(`Supabase error fetching test run ${data.testRunId}:`, runError)
    throw new Error(`Test run not found: ${data.testRunId} - ${runError.message}`)
  }

  if (!testRun) {
    throw new Error(`Test run not found: ${data.testRunId}`)
  }

  // Get environment
  const { data: environment, error: envError } = await supabase
    .from("environments")
    .select("*")
    .eq("id", data.environmentId)
    .single()

  if (envError || !environment) {
    throw new Error(`Environment not found: ${data.environmentId}`)
  }

  // Get test users for this environment and build credentials map
  const { data: testUsers } = await supabase
    .from("test_users")
    .select("*")
    .eq("environment_id", data.environmentId)
    .eq("is_enabled", true)

  const credentialsMap: CredentialsMap = {}
  if (testUsers && testUsers.length > 0) {
    for (const user of testUsers as TestUser[]) {
      try {
        const decryptedPassword = await decrypt(user.password_encrypted)
        credentialsMap[user.role] = {
          username: user.username,
          password: decryptedPassword,
        }
      } catch (err) {
        console.error(`Failed to decrypt password for role ${user.role}:`, err)
      }
    }
  }

  // Get stories to run
  let storiesQuery = supabase
    .from("stories")
    .select(`
      *,
      journey:journeys(name, title)
    `)
    .eq("is_enabled", true)

  if (data.storyIds && data.storyIds.length > 0) {
    storiesQuery = storiesQuery.in("id", data.storyIds)
  } else if (data.journeyIds && data.journeyIds.length > 0) {
    storiesQuery = storiesQuery.in("journey_id", data.journeyIds)
  } else {
    // Get all stories for the app
    const { data: journeys } = await supabase
      .from("journeys")
      .select("id")
      .eq("app_id", data.appId)

    if (journeys && journeys.length > 0) {
      storiesQuery = storiesQuery.in(
        "journey_id",
        journeys.map((j) => j.id)
      )
    }
  }

  const { data: stories, error: storiesError } = await storiesQuery.order(
    "position"
  )

  if (storiesError) {
    throw new Error(`Failed to fetch stories: ${storiesError.message}`)
  }

  if (!stories || stories.length === 0) {
    // No stories to run, mark as completed
    await supabase
      .from("test_runs")
      .update({
        status: "completed",
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        stories_total: 0,
        stories_passed: 0,
        stories_failed: 0,
        stories_skipped: 0,
      })
      .eq("id", data.testRunId)
    return
  }

  // Update test run status to running
  const startedAt = new Date().toISOString()
  await supabase
    .from("test_runs")
    .update({
      status: "running",
      started_at: startedAt,
      stories_total: stories.length,
    })
    .eq("id", data.testRunId)

  // Execute stories
  let passed = 0
  let failed = 0
  let skipped = 0

  for (let i = 0; i < stories.length; i++) {
    const story = stories[i]
    const journey = story.journey as { name: string; title: string }

    // Check if run was cancelled
    const { data: currentRun } = await supabase
      .from("test_runs")
      .select("status")
      .eq("id", data.testRunId)
      .single()

    if (currentRun?.status === "cancelled") {
      console.log(`Test run ${data.testRunId} was cancelled`)
      // Clear current story and exit
      await supabase
        .from("test_runs")
        .update({
          current_story_id: null,
          current_story_name: null,
        })
        .eq("id", data.testRunId)
      return
    }

    onProgress({
      total: stories.length,
      completed: i,
      passed,
      failed,
      skipped,
      current: story.title,
    })

    // Update current story in database for real-time UI updates
    await supabase
      .from("test_runs")
      .update({
        current_story_id: story.id,
        current_story_name: story.title,
      })
      .eq("id", data.testRunId)

    try {
      // Check if story requires a role and if we have credentials
      const requiredRole = story.required_role
      let credentials: { username: string; password: string } | undefined
      let skipReason: string | undefined

      if (requiredRole) {
        // Check if auth config is properly configured for form-based login
        const authConfig = environment.auth_config
        if (!authConfig || authConfig.type !== 'form') {
          skipReason = `Story requires role "${requiredRole}" but environment auth is not configured for form login`
        } else if (credentialsMap[requiredRole]) {
          credentials = credentialsMap[requiredRole]
        } else {
          skipReason = `Missing test user for required role: ${requiredRole}`
        }
      }

      // Skip story if required role credentials are missing or auth not configured
      if (skipReason) {
        // Save skipped result
        await supabase.from("test_results").insert({
          test_run_id: data.testRunId,
          story_id: story.id,
          journey_name: journey.name,
          story_name: story.name,
          passed: false,
          duration_ms: 0,
          error: skipReason,
          retries: 0,
        })

        // Update story last run info
        await supabase
          .from("stories")
          .update({
            last_run_at: new Date().toISOString(),
            last_result: "skipped",
          })
          .eq("id", story.id)

        // Track skipped separately (not as failed)
        skipped++
        console.log(`Skipped story ${story.id}: ${skipReason}`)

        // Update test run progress with skipped count
        await supabase
          .from("test_runs")
          .update({
            stories_passed: passed,
            stories_failed: failed,
            stories_skipped: skipped,
          })
          .eq("id", data.testRunId)

        continue
      }

      const result = await executeStory(story, environment.base_url, {
        retryCount: 3,
        screenshotOnFailure: true,
        credentials,
        authConfig: environment.auth_config,
      })

      // Save result
      await supabase.from("test_results").insert({
        test_run_id: data.testRunId,
        story_id: story.id,
        journey_name: journey.name,
        story_name: story.name,
        passed: result.passed,
        duration_ms: result.duration_ms,
        steps: result.steps,
        error: result.error,
        screenshot_url: result.screenshot_url,
        console_errors: result.console_errors,
        heal_proposal: result.heal_proposal,
        retries: result.retries,
      })

      // Update story last run info
      await supabase
        .from("stories")
        .update({
          last_run_at: new Date().toISOString(),
          last_result: result.passed ? "passed" : "failed",
        })
        .eq("id", story.id)

      if (result.passed) {
        passed++
      } else {
        failed++
      }

      // Update test run progress
      await supabase
        .from("test_runs")
        .update({
          stories_passed: passed,
          stories_failed: failed,
          stories_skipped: skipped,
        })
        .eq("id", data.testRunId)
    } catch (error) {
      failed++
      console.error(`Story ${story.id} execution error:`, error)

      // Save error result
      await supabase.from("test_results").insert({
        test_run_id: data.testRunId,
        story_id: story.id,
        journey_name: journey.name,
        story_name: story.name,
        passed: false,
        duration_ms: 0,
        error: error instanceof Error ? error.message : String(error),
        retries: 0,
      })

      // Update story last run info
      await supabase
        .from("stories")
        .update({
          last_run_at: new Date().toISOString(),
          last_result: "failed",
        })
        .eq("id", story.id)
    }
  }

  // Mark test run as completed
  const completedAt = new Date().toISOString()
  const durationMs =
    new Date(completedAt).getTime() - new Date(startedAt).getTime()

  await supabase
    .from("test_runs")
    .update({
      status: "completed",
      completed_at: completedAt,
      duration_ms: durationMs,
      stories_passed: passed,
      stories_failed: failed,
      stories_skipped: skipped,
      current_story_id: null,
      current_story_name: null,
    })
    .eq("id", data.testRunId)

  onProgress({
    total: stories.length,
    completed: stories.length,
    passed,
    failed,
    skipped,
  })
}
