import { NextResponse } from "next/server"
import { analyzeStory } from "@/lib/ai/story-analyzer"
import type { ConversationMessage, AppContext } from "@/lib/ai/story-analyzer"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    // Verify authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { description, previousExchanges = [], appId } = body as {
      description: string
      previousExchanges?: ConversationMessage[]
      appId?: string
    }

    if (!description || typeof description !== "string") {
      return NextResponse.json(
        { error: "Description is required" },
        { status: 400 }
      )
    }

    // Validate previousExchanges is an array with valid structure
    if (!Array.isArray(previousExchanges)) {
      return NextResponse.json(
        { error: "Invalid previousExchanges format" },
        { status: 400 }
      )
    }

    // Validate each message has valid role and content
    const validRoles = ["user", "assistant"]
    for (const msg of previousExchanges) {
      if (
        typeof msg !== "object" ||
        msg === null ||
        !validRoles.includes(msg.role) ||
        typeof msg.content !== "string"
      ) {
        return NextResponse.json(
          { error: "Invalid message format in previousExchanges" },
          { status: 400 }
        )
      }
    }

    // Limit request size to prevent abuse
    if (description.length > 10000) {
      return NextResponse.json(
        { error: "Description too long (max 10000 characters)" },
        { status: 400 }
      )
    }

    const totalExchangeSize = previousExchanges.reduce(
      (acc, msg) => acc + msg.content.length,
      0
    )
    if (totalExchangeSize > 50000) {
      return NextResponse.json(
        { error: "Conversation history too long" },
        { status: 400 }
      )
    }

    // Fetch app context if appId is provided
    let context: AppContext | undefined
    if (appId && typeof appId === "string") {
      // Verify user has access to this app via organization membership
      const { data: app } = await supabase
        .from("apps")
        .select("id, organization_id")
        .eq("id", appId)
        .single()

      if (app) {
        const { data: membership } = await supabase
          .from("organization_members")
          .select("id")
          .eq("organization_id", app.organization_id)
          .eq("user_id", user.id)
          .single()

        if (!membership) {
          return NextResponse.json(
            { error: "Access denied to this application" },
            { status: 403 }
          )
        }

        // User has access, fetch environments
        const { data: environments } = await supabase
          .from("environments")
          .select(`
            id,
            name,
            base_url,
            is_default,
            test_users(role, username, description)
          `)
          .eq("app_id", appId)
          .eq("test_users.is_enabled", true)

        if (environments && environments.length > 0) {
          const allTestUsers = environments.flatMap(e => e.test_users || [])
          context = {
            environments: environments.map(e => ({
              name: e.name,
              base_url: e.base_url,
              is_default: e.is_default,
              test_users: (e.test_users || []).map(u => ({
                role: u.role,
                username: u.username,
              })),
            })),
            availableRoles: [...new Set(allTestUsers.map(u => u.role))],
          }
        }
      }
    }

    const result = await analyzeStory(description, previousExchanges, context)

    return NextResponse.json(result)
  } catch (error) {
    console.error("Story analysis error:", error)
    // Don't expose internal error details to client
    return NextResponse.json(
      { error: "Failed to analyze story" },
      { status: 500 }
    )
  }
}
