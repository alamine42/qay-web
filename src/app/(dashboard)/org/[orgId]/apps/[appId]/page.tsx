import { redirect } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { formatDuration } from "@/lib/utils"
import {
  Plus,
  Play,
  Settings,
  CheckCircle,
  XCircle,
  Clock,
  Globe,
  BookOpen,
  ExternalLink,
} from "lucide-react"
import { TestUsersManager } from "@/components/environment/test-users-manager"
import type { TestUser } from "@/lib/types"

export default async function AppOverviewPage({
  params,
}: {
  params: Promise<{ orgId: string; appId: string }>
}) {
  const { orgId, appId } = await params
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

  // Get app with related data
  const { data: app } = await supabase
    .from("apps")
    .select("*")
    .eq("id", appId)
    .eq("organization_id", orgId)
    .single()

  if (!app) redirect(`/org/${orgId}`)

  // Get environments with test users (exclude password_encrypted for security)
  const { data: environments } = await supabase
    .from("environments")
    .select(`
      *,
      test_users(id, role, username, description, is_enabled, created_at, updated_at)
    `)
    .eq("app_id", appId)
    .order("is_default", { ascending: false })

  // Get journeys with story counts
  const { data: journeys } = await supabase
    .from("journeys")
    .select(`
      *,
      stories(count)
    `)
    .eq("app_id", appId)
    .order("position")

  // Get recent test runs
  const { data: recentRuns } = await supabase
    .from("test_runs")
    .select(`
      *,
      environment:environments(name)
    `)
    .eq("app_id", appId)
    .order("created_at", { ascending: false })
    .limit(5)

  // Calculate stats
  const totalJourneys = journeys?.length || 0
  const totalStories = journeys?.reduce(
    (acc, j) => acc + ((j.stories as { count: number }[])[0]?.count || 0),
    0
  ) || 0
  const lastRun = recentRuns?.[0]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{app.name}</h1>
          <p className="text-muted-foreground">
            {app.description || "No description"}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/org/${orgId}/apps/${appId}/runs/new`}>
            <Button>
              <Play className="h-4 w-4 mr-2" />
              Run Tests
            </Button>
          </Link>
          <Link href={`/org/${orgId}/apps/${appId}/settings`}>
            <Button variant="outline" size="icon">
              <Settings className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Environments</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{environments?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Journeys</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalJourneys}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stories</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStories}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Run</CardTitle>
            {lastRun?.status === "completed" && lastRun.stories_failed === 0 ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : lastRun?.status === "completed" ? (
              <XCircle className="h-4 w-4 text-red-500" />
            ) : (
              <Clock className="h-4 w-4 text-muted-foreground" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {lastRun
                ? lastRun.status === "completed"
                  ? `${lastRun.stories_passed}/${lastRun.stories_total}`
                  : lastRun.status
                : "—"}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Environments */}
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between bg-gradient-to-r from-background to-muted/20">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 shrink-0">
                <Globe className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <CardTitle className="text-lg">Environments</CardTitle>
                <CardDescription className="text-xs sm:text-sm">Test environments with credentials</CardDescription>
              </div>
            </div>
            <Link href={`/org/${orgId}/apps/${appId}/settings`}>
              <Button variant="outline" size="sm" className="shadow-sm hover:shadow transition-shadow">
                <Plus className="h-4 w-4 mr-1.5" />
                <span className="hidden sm:inline">Add</span>
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            {environments && environments.length > 0 ? (
              <div className="space-y-4">
                {environments.map((env) => {
                  const testUsers = (env.test_users || []) as TestUser[]

                  return (
                    <div
                      key={env.id}
                      className="group rounded-xl border bg-card overflow-hidden transition-all duration-200 hover:shadow-md hover:border-border/80"
                    >
                      {/* Environment Header */}
                      <div className="p-4 bg-gradient-to-r from-muted/30 to-transparent">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-semibold text-base">{env.name}</h4>
                              {env.is_default && (
                                <Badge variant="secondary" className="text-xs bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-800">
                                  Default
                                </Badge>
                              )}
                            </div>
                            <a
                              href={env.base_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mt-1 group/link"
                            >
                              <span className="truncate max-w-[250px]">{env.base_url}</span>
                              <ExternalLink className="h-3 w-3 opacity-0 group-hover/link:opacity-100 transition-opacity shrink-0" />
                            </a>
                          </div>
                        </div>
                      </div>

                      {/* Test Users Section */}
                      <div className="p-4 border-t bg-muted/5">
                        <TestUsersManager
                          environmentId={env.id}
                          environmentName={env.name}
                          testUsers={testUsers}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="relative overflow-hidden rounded-xl border border-dashed bg-gradient-to-br from-muted/30 to-muted/10 py-12 text-center">
                <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,transparent,white)] dark:bg-grid-slate-700/25" />
                <div className="relative">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500/20 to-teal-500/20 mb-4">
                    <Globe className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <p className="text-base font-medium text-foreground">No environments yet</p>
                  <p className="text-sm text-muted-foreground mt-1 mb-4">
                    Add an environment to start testing
                  </p>
                  <Link href={`/org/${orgId}/apps/${appId}/settings`}>
                    <Button variant="outline" size="sm" className="shadow-sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Environment
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Journeys */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Journeys</CardTitle>
              <CardDescription>Test journey groups</CardDescription>
            </div>
            <Link href={`/org/${orgId}/apps/${appId}/journeys/new`}>
              <Button variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {journeys && journeys.length > 0 ? (
              <div className="space-y-3">
                {journeys.map((journey) => (
                  <Link
                    key={journey.id}
                    href={`/org/${orgId}/apps/${appId}/journeys/${journey.id}`}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div>
                      <p className="font-medium">{journey.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {(journey.stories as { count: number }[])[0]?.count || 0} stories
                      </p>
                    </div>
                    <Badge variant="outline">{journey.name}</Badge>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <BookOpen className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-muted-foreground">No journeys yet</p>
                <Link href={`/org/${orgId}/apps/${appId}/journeys/new`}>
                  <Button variant="outline" size="sm" className="mt-2">
                    Create your first journey
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Test Runs */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Recent Test Runs</CardTitle>
            <CardDescription>Latest test execution results</CardDescription>
          </div>
          <Link href={`/org/${orgId}/apps/${appId}/runs`}>
            <Button variant="outline" size="sm">View All</Button>
          </Link>
        </CardHeader>
        <CardContent>
          {recentRuns && recentRuns.length > 0 ? (
            <div className="space-y-3">
              {recentRuns.map((run) => (
                <Link
                  key={run.id}
                  href={`/org/${orgId}/apps/${appId}/runs/${run.id}`}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {run.status === "completed" && run.stories_failed === 0 ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : run.status === "completed" && run.stories_failed > 0 ? (
                      <XCircle className="h-5 w-5 text-red-500" />
                    ) : run.status === "running" ? (
                      <Clock className="h-5 w-5 text-blue-500 animate-pulse" />
                    ) : (
                      <Clock className="h-5 w-5 text-muted-foreground" />
                    )}
                    <div>
                      <p className="font-medium">
                        {run.environment?.name || "Unknown"} Environment
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {run.stories_passed}/{run.stories_total} passed
                        {run.duration_ms && ` • ${formatDuration(run.duration_ms)}`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge
                      variant={
                        run.status === "completed" && run.stories_failed === 0
                          ? "success"
                          : run.status === "completed"
                          ? "destructive"
                          : "secondary"
                      }
                    >
                      {run.status}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(run.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-6">
              <Play className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground">No test runs yet</p>
              <Link href={`/org/${orgId}/apps/${appId}/runs/new`}>
                <Button variant="outline" size="sm" className="mt-2">
                  Run your first test
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
