import { redirect } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { CaptureWizard } from "@/components/story/capture-wizard"
import { ArrowLeft } from "lucide-react"

export default async function NewStoryPage({
  params,
}: {
  params: Promise<{ orgId: string; appId: string; journeyId: string }>
}) {
  const { orgId, appId, journeyId } = await params
  const supabase = await createClient()

  // Verify access
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: membership } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", orgId)
    .eq("user_id", user.id)
    .single()

  if (!membership) redirect("/")

  // Get journey
  const { data: journey } = await supabase
    .from("journeys")
    .select("title, app_id")
    .eq("id", journeyId)
    .eq("app_id", appId)
    .single()

  if (!journey) redirect(`/org/${orgId}/apps/${appId}/journeys`)

  // Get available roles from test users across all environments of this app
  const { data: environments } = await supabase
    .from("environments")
    .select("id")
    .eq("app_id", appId)

  let availableRoles: string[] = []
  if (environments && environments.length > 0) {
    const { data: testUsers } = await supabase
      .from("test_users")
      .select("role")
      .in("environment_id", environments.map(e => e.id))
      .eq("is_enabled", true)

    if (testUsers) {
      availableRoles = [...new Set(testUsers.map(u => u.role))]
    }
  }

  return (
    <div className="space-y-6">
      <Link
        href={`/org/${orgId}/apps/${appId}/journeys/${journeyId}`}
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to {journey.title}
      </Link>

      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold">Create New Story</h1>
        <p className="text-muted-foreground mt-2">
          Use AI to help you create a test story
        </p>
      </div>

      <CaptureWizard journeyId={journeyId} orgId={orgId} appId={appId} availableRoles={availableRoles} />
    </div>
  )
}
