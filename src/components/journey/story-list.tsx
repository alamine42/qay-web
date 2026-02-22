"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { toggleStoryEnabled, deleteStory } from "@/app/actions/stories"
import { triggerTestRun } from "@/app/actions/test-runs"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Label } from "@/components/ui/label"
import {
  CheckCircle,
  XCircle,
  Clock,
  MoreVertical,
  Play,
  Pencil,
  Trash,
  GripVertical,
  Plus,
  Loader2,
} from "lucide-react"
import type { Story } from "@/lib/types"

interface StoryListProps {
  stories: Story[]
  journeyId: string
  orgId: string
  appId: string
}

interface Environment {
  id: string
  name: string
  is_default: boolean
}

export function StoryList({ stories, journeyId, orgId, appId }: StoryListProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [toggling, setToggling] = useState<string | null>(null)
  const [runStoryId, setRunStoryId] = useState<string | null>(null)
  const [environments, setEnvironments] = useState<Environment[]>([])
  const [selectedEnv, setSelectedEnv] = useState<string>("")
  const [loadingEnvs, setLoadingEnvs] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!runStoryId) return

    async function loadEnvironments() {
      setLoadingEnvs(true)
      const supabase = createClient()
      const { data: envs } = await supabase
        .from("environments")
        .select("id, name, is_default")
        .eq("app_id", appId)
        .order("is_default", { ascending: false })

      if (envs) {
        setEnvironments(envs)
        const defaultEnv = envs.find((e) => e.is_default)
        if (defaultEnv) {
          setSelectedEnv(defaultEnv.id)
        } else if (envs.length > 0) {
          setSelectedEnv(envs[0].id)
        }
      }
      setLoadingEnvs(false)
    }

    loadEnvironments()
  }, [runStoryId, appId])

  const handleToggle = async (storyId: string, enabled: boolean) => {
    setToggling(storyId)
    await toggleStoryEnabled(storyId, enabled)
    setToggling(null)
  }

  const handleDelete = async () => {
    if (!deleteId) return
    await deleteStory(deleteId)
    setDeleteId(null)
  }

  const handleRunStory = async () => {
    if (!runStoryId || !selectedEnv) return
    setSubmitting(true)

    const formData = new FormData()
    formData.set("orgId", orgId)
    formData.set("appId", appId)
    formData.set("environmentId", selectedEnv)
    formData.set("storyIds", runStoryId)

    await triggerTestRun(formData)
    // Note: triggerTestRun redirects on success, so we only reach here on error
    setSubmitting(false)
  }

  const runStory = stories.find((s) => s.id === runStoryId)

  if (stories.length === 0) {
    return (
      <div className="text-center py-12">
        <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">No stories yet</h3>
        <p className="text-muted-foreground mb-4">
          Add your first test story to this journey
        </p>
        <Link href={`/org/${orgId}/apps/${appId}/journeys/${journeyId}/stories/new`}>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Create Story
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-2">
        {stories.map((story, index) => (
          <div
            key={story.id}
            className="flex items-center gap-4 p-4 rounded-lg border hover:bg-muted/50 transition-colors"
          >
            <div className="cursor-grab text-muted-foreground">
              <GripVertical className="h-5 w-5" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {index + 1}.
                </span>
                <h4 className="font-medium truncate">{story.title}</h4>
                {story.tags && story.tags.length > 0 && (
                  <div className="flex gap-1">
                    {story.tags.slice(0, 2).map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                <span>{story.steps?.length || 0} steps</span>
                {story.last_run_at && (
                  <span>
                    Last run: {new Date(story.last_run_at).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Status */}
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    {story.last_result === "passed" ? (
                      <Badge variant="success" className="gap-1 cursor-help">
                        <CheckCircle className="h-3 w-3" />
                        Passed
                      </Badge>
                    ) : story.last_result === "failed" ? (
                      <Badge variant="destructive" className="gap-1 cursor-help">
                        <XCircle className="h-3 w-3" />
                        Failed
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="gap-1 cursor-help">
                        <Clock className="h-3 w-3" />
                        Pending
                      </Badge>
                    )}
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p className="text-xs">
                      {story.last_result === "passed"
                        ? "This story passed its last test run"
                        : story.last_result === "failed"
                        ? "This story failed its last test run"
                        : "This story hasn't been run yet"}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {/* Enable/Disable Toggle */}
              <div className="flex items-center gap-2">
                <Switch
                  id={`story-enabled-${story.id}`}
                  checked={story.is_enabled}
                  disabled={toggling === story.id}
                  onCheckedChange={(checked) => handleToggle(story.id, checked)}
                />
                <Label
                  htmlFor={`story-enabled-${story.id}`}
                  className="text-xs text-muted-foreground cursor-pointer"
                >
                  {story.is_enabled ? "Enabled" : "Disabled"}
                </Label>
              </div>

              {/* Actions */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link href={`/org/${orgId}/apps/${appId}/journeys/${journeyId}/stories/${story.id}`}>
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setRunStoryId(story.id)}>
                    <Play className="h-4 w-4 mr-2" />
                    Run Test
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => setDeleteId(story.id)}
                  >
                    <Trash className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        ))}
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Story</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this story? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Run Story Dialog */}
      <Dialog open={!!runStoryId} onOpenChange={() => setRunStoryId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Run Test</DialogTitle>
            <DialogDescription>
              Run "{runStory?.title}" against an environment
            </DialogDescription>
          </DialogHeader>

          {loadingEnvs ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : environments.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-sm text-muted-foreground mb-4">
                No environments configured for this app.
              </p>
              <Link href={`/org/${orgId}/apps/${appId}/settings`}>
                <Button variant="outline" size="sm">
                  Configure Environments
                </Button>
              </Link>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Environment</Label>
                <Select value={selectedEnv} onValueChange={setSelectedEnv}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select environment" />
                  </SelectTrigger>
                  <SelectContent>
                    {environments.map((env) => (
                      <SelectItem key={env.id} value={env.id}>
                        {env.name}
                        {env.is_default && " (default)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setRunStoryId(null)}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleRunStory}
                  disabled={!selectedEnv || submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Starting...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Run Test
                    </>
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
