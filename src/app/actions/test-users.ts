"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { encrypt, decrypt } from "@/lib/crypto"
import type { TestUserInput } from "@/lib/types"

export async function createTestUser(data: TestUserInput) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: "Unauthorized" }
  }

  const { environmentId, role, username, password, description } = data

  // Get environment and verify access
  const { data: env } = await supabase
    .from("environments")
    .select("app_id, apps(organization_id)")
    .eq("id", environmentId)
    .single()

  if (!env) {
    return { error: "Environment not found" }
  }

  const orgId = (env.apps as unknown as { organization_id: string }).organization_id

  const { data: membership } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", orgId)
    .eq("user_id", user.id)
    .single()

  if (!membership || !["owner", "admin", "member"].includes(membership.role)) {
    return { error: "Unauthorized" }
  }

  // Encrypt password
  const passwordEncrypted = await encrypt(password)

  const { data: testUser, error } = await supabase
    .from("test_users")
    .insert({
      environment_id: environmentId,
      role,
      username,
      password_encrypted: passwordEncrypted,
      description,
    })
    .select()
    .single()

  if (error) {
    if (error.code === "23505") {
      return { error: `A test user with role "${role}" already exists for this environment` }
    }
    return { error: error.message }
  }

  revalidatePath(`/org/${orgId}/apps/${env.app_id}`)
  return { success: true, data: testUser }
}

export async function updateTestUser(data: {
  testUserId: string
  role?: string
  username?: string
  password?: string
  description?: string
  is_enabled?: boolean
}) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: "Unauthorized" }
  }

  const { testUserId, password, ...updateData } = data

  // Get test user and verify access
  const { data: testUser } = await supabase
    .from("test_users")
    .select("environment_id, environments(app_id, apps(organization_id))")
    .eq("id", testUserId)
    .single()

  if (!testUser) {
    return { error: "Test user not found" }
  }

  const environments = testUser.environments as unknown as { app_id: string; apps: { organization_id: string } }
  const orgId = environments.apps.organization_id

  const { data: membership } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", orgId)
    .eq("user_id", user.id)
    .single()

  if (!membership || !["owner", "admin", "member"].includes(membership.role)) {
    return { error: "Unauthorized" }
  }

  // Build update object
  const updates: Record<string, unknown> = { ...updateData }

  // Encrypt new password if provided
  if (password) {
    updates.password_encrypted = await encrypt(password)
  }

  const { error } = await supabase
    .from("test_users")
    .update(updates)
    .eq("id", testUserId)

  if (error) {
    if (error.code === "23505") {
      return { error: `A test user with this role already exists for this environment` }
    }
    return { error: error.message }
  }

  revalidatePath(`/org/${orgId}/apps/${environments.app_id}`)
  return { success: true }
}

export async function deleteTestUser(testUserId: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: "Unauthorized" }
  }

  // Get test user and verify access
  const { data: testUser } = await supabase
    .from("test_users")
    .select("environment_id, environments(app_id, apps(organization_id))")
    .eq("id", testUserId)
    .single()

  if (!testUser) {
    return { error: "Test user not found" }
  }

  const environments = testUser.environments as unknown as { app_id: string; apps: { organization_id: string } }
  const orgId = environments.apps.organization_id

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
    .from("test_users")
    .delete()
    .eq("id", testUserId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/org/${orgId}/apps/${environments.app_id}`)
  return { success: true }
}

export async function getTestUsers(environmentId: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: "Unauthorized" }
  }

  // Get environment and verify access
  const { data: env } = await supabase
    .from("environments")
    .select("app_id, apps(organization_id)")
    .eq("id", environmentId)
    .single()

  if (!env) {
    return { error: "Environment not found" }
  }

  const orgId = (env.apps as unknown as { organization_id: string }).organization_id

  const { data: membership } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", orgId)
    .eq("user_id", user.id)
    .single()

  if (!membership) {
    return { error: "Unauthorized" }
  }

  const { data: testUsers, error } = await supabase
    .from("test_users")
    .select("*")
    .eq("environment_id", environmentId)
    .order("role")

  if (error) {
    return { error: error.message }
  }

  return { success: true, data: testUsers }
}

export async function getDecryptedCredentials(testUserId: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: "Unauthorized" }
  }

  // Get test user and verify access
  const { data: testUser } = await supabase
    .from("test_users")
    .select("*, environments(app_id, apps(organization_id))")
    .eq("id", testUserId)
    .single()

  if (!testUser) {
    return { error: "Test user not found" }
  }

  const environments = testUser.environments as unknown as { app_id: string; apps: { organization_id: string } }
  const orgId = environments.apps.organization_id

  const { data: membership } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", orgId)
    .eq("user_id", user.id)
    .single()

  if (!membership || !["owner", "admin", "member"].includes(membership.role)) {
    return { error: "Unauthorized" }
  }

  const password = await decrypt(testUser.password_encrypted)

  return {
    success: true,
    data: {
      username: testUser.username,
      password,
    },
  }
}

export async function getAvailableRoles(environmentId: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: "Unauthorized" }
  }

  const { data: testUsers, error } = await supabase
    .from("test_users")
    .select("role")
    .eq("environment_id", environmentId)
    .eq("is_enabled", true)

  if (error) {
    return { error: error.message }
  }

  return { success: true, data: testUsers?.map(u => u.role) || [] }
}
