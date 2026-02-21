"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { slugify } from "@/lib/utils"
import type { StoryStep, StoryOutcome, StoryPrecondition } from "@/lib/types"

export async function createStory(data: {
  journeyId: string
  name: string
  title: string
  preconditions?: StoryPrecondition[]
  steps: StoryStep[]
  outcome: StoryOutcome
  tags?: string[]
  required_role?: string
}) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: "Unauthorized" }
  }

  const { journeyId, title, preconditions, steps, outcome, tags, required_role } = data

  // Get journey and verify access
  const { data: journey } = await supabase
    .from("journeys")
    .select("app_id, apps(organization_id)")
    .eq("id", journeyId)
    .single()

  if (!journey) {
    return { error: "Journey not found" }
  }

  const orgId = (journey.apps as unknown as { organization_id: string }).organization_id

  const { data: membership } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", orgId)
    .eq("user_id", user.id)
    .single()

  if (!membership || !["owner", "admin", "member"].includes(membership.role)) {
    return { error: "Unauthorized" }
  }

  // Get max position
  const { data: maxPos } = await supabase
    .from("stories")
    .select("position")
    .eq("journey_id", journeyId)
    .order("position", { ascending: false })
    .limit(1)
    .single()

  const position = (maxPos?.position ?? -1) + 1
  const name = data.name || slugify(title)

  const { data: story, error } = await supabase
    .from("stories")
    .insert({
      journey_id: journeyId,
      name,
      title,
      preconditions: preconditions || [],
      steps,
      outcome,
      tags: tags || [],
      position,
      required_role,
    })
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/org/${orgId}/apps/${journey.app_id}/journeys/${journeyId}`)
  return { success: true, data: story }
}

export async function updateStory(data: {
  storyId: string
  title?: string
  preconditions?: StoryPrecondition[]
  steps?: StoryStep[]
  outcome?: StoryOutcome
  tags?: string[]
  is_enabled?: boolean
  generated_test_code?: string
  required_role?: string | null
}) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: "Unauthorized" }
  }

  const { storyId, ...updateData } = data

  // Get story and verify access
  const { data: story } = await supabase
    .from("stories")
    .select("journey_id, journeys(app_id, apps(organization_id))")
    .eq("id", storyId)
    .single()

  if (!story) {
    return { error: "Story not found" }
  }

  const journeys = story.journeys as unknown as { app_id: string; apps: { organization_id: string } }
  const orgId = journeys.apps.organization_id

  const { data: membership } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", orgId)
    .eq("user_id", user.id)
    .single()

  if (!membership || !["owner", "admin", "member"].includes(membership.role)) {
    return { error: "Unauthorized" }
  }

  const { error } = await supabase
    .from("stories")
    .update(updateData)
    .eq("id", storyId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/org/${orgId}/apps/${journeys.app_id}/journeys/${story.journey_id}`)
  return { success: true }
}

export async function deleteStory(storyId: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: "Unauthorized" }
  }

  // Get story and verify access
  const { data: story } = await supabase
    .from("stories")
    .select("journey_id, journeys(app_id, apps(organization_id))")
    .eq("id", storyId)
    .single()

  if (!story) {
    return { error: "Story not found" }
  }

  const journeys = story.journeys as unknown as { app_id: string; apps: { organization_id: string } }
  const orgId = journeys.apps.organization_id

  const { data: membership } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", orgId)
    .eq("user_id", user.id)
    .single()

  if (!membership || !["owner", "admin"].includes(membership.role)) {
    return { error: "Unauthorized" }
  }

  const { error } = await supabase
    .from("stories")
    .delete()
    .eq("id", storyId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/org/${orgId}/apps/${journeys.app_id}/journeys/${story.journey_id}`)
  return { success: true }
}

export async function reorderStories(journeyId: string, storyIds: string[]) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: "Unauthorized" }
  }

  // Get journey and verify access
  const { data: journey } = await supabase
    .from("journeys")
    .select("app_id, apps(organization_id)")
    .eq("id", journeyId)
    .single()

  if (!journey) {
    return { error: "Journey not found" }
  }

  const orgId = (journey.apps as unknown as { organization_id: string }).organization_id

  const { data: membership } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", orgId)
    .eq("user_id", user.id)
    .single()

  if (!membership || !["owner", "admin", "member"].includes(membership.role)) {
    return { error: "Unauthorized" }
  }

  // Update positions
  for (let i = 0; i < storyIds.length; i++) {
    await supabase
      .from("stories")
      .update({ position: i })
      .eq("id", storyIds[i])
  }

  revalidatePath(`/org/${orgId}/apps/${journey.app_id}/journeys/${journeyId}`)
  return { success: true }
}

export async function toggleStoryEnabled(storyId: string, enabled: boolean) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: "Unauthorized" }
  }

  // Get story and verify access
  const { data: story } = await supabase
    .from("stories")
    .select("journey_id, journeys(app_id, apps(organization_id))")
    .eq("id", storyId)
    .single()

  if (!story) {
    return { error: "Story not found" }
  }

  const journeys = story.journeys as unknown as { app_id: string; apps: { organization_id: string } }
  const orgId = journeys.apps.organization_id

  const { data: membership } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", orgId)
    .eq("user_id", user.id)
    .single()

  if (!membership || !["owner", "admin", "member"].includes(membership.role)) {
    return { error: "Unauthorized" }
  }

  const { error } = await supabase
    .from("stories")
    .update({ is_enabled: enabled })
    .eq("id", storyId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/org/${orgId}/apps/${journeys.app_id}/journeys/${story.journey_id}`)
  return { success: true }
}
