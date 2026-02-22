"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { enqueueTestRun } from "@/lib/queue/client"

export async function triggerTestRun(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: "Unauthorized" }
  }

  const orgId = formData.get("orgId") as string
  const appId = formData.get("appId") as string
  const environmentId = formData.get("environmentId") as string
  const journeyIdsStr = formData.get("journeyIds") as string
  const storyIdsStr = formData.get("storyIds") as string

  const journeyIds = journeyIdsStr ? journeyIdsStr.split(",").filter(Boolean) : undefined
  const storyIds = storyIdsStr ? storyIdsStr.split(",").filter(Boolean) : undefined

  // Verify access
  const { data: membership } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", orgId)
    .eq("user_id", user.id)
    .single()

  if (!membership || !["owner", "admin", "member"].includes(membership.role)) {
    return { error: "Unauthorized" }
  }

  // Get story count for the run
  let storiesCount = 0
  if (storyIds && storyIds.length > 0) {
    const { count } = await supabase
      .from("stories")
      .select("*", { count: "exact", head: true })
      .in("id", storyIds)
      .eq("is_enabled", true)
    storiesCount = count || 0
  } else if (journeyIds && journeyIds.length > 0) {
    const { count } = await supabase
      .from("stories")
      .select("*", { count: "exact", head: true })
      .in("journey_id", journeyIds)
      .eq("is_enabled", true)
    storiesCount = count || 0
  } else {
    // All stories in app
    const { data: journeys } = await supabase
      .from("journeys")
      .select("id")
      .eq("app_id", appId)

    if (journeys && journeys.length > 0) {
      const { count } = await supabase
        .from("stories")
        .select("*", { count: "exact", head: true })
        .in("journey_id", journeys.map((j) => j.id))
        .eq("is_enabled", true)
      storiesCount = count || 0
    }
  }

  // Create test run
  const { data: testRun, error: runError } = await supabase
    .from("test_runs")
    .insert({
      organization_id: orgId,
      app_id: appId,
      environment_id: environmentId,
      triggered_by: user.id,
      trigger_type: "manual",
      status: "pending",
      stories_total: storiesCount,
    })
    .select()
    .single()

  if (runError || !testRun) {
    return { error: runError?.message || "Failed to create test run" }
  }

  // Enqueue the test run
  try {
    await enqueueTestRun({
      testRunId: testRun.id,
      organizationId: orgId,
      appId,
      environmentId,
      journeyIds,
      storyIds,
    })
  } catch (error) {
    // Update test run status to failed if queue fails
    await supabase
      .from("test_runs")
      .update({ status: "failed" })
      .eq("id", testRun.id)

    return { error: "Failed to queue test run" }
  }

  revalidatePath(`/org/${orgId}/apps/${appId}/runs`)
  redirect(`/org/${orgId}/apps/${appId}/runs/${testRun.id}`)
}

export async function cancelTestRun(testRunId: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: "Unauthorized" }
  }

  // Get test run
  const { data: testRun } = await supabase
    .from("test_runs")
    .select("organization_id, status")
    .eq("id", testRunId)
    .single()

  if (!testRun) {
    return { error: "Test run not found" }
  }

  if (testRun.status !== "pending" && testRun.status !== "running") {
    return { error: "Cannot cancel completed test run" }
  }

  // Verify access
  const { data: membership } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", testRun.organization_id)
    .eq("user_id", user.id)
    .single()

  if (!membership || !["owner", "admin", "member"].includes(membership.role)) {
    return { error: "Unauthorized" }
  }

  // Update status and clear current story
  const { error } = await supabase
    .from("test_runs")
    .update({
      status: "cancelled",
      completed_at: new Date().toISOString(),
      current_story_id: null,
      current_story_name: null,
    })
    .eq("id", testRunId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/org/${testRun.organization_id}`)

  return { success: true }
}
