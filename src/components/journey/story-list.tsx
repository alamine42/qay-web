"use client"

import { useState } from "react"
import Link from "next/link"
import { toggleStoryEnabled, deleteStory } from "@/app/actions/stories"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
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
} from "lucide-react"
import type { Story } from "@/lib/types"

interface StoryListProps {
  stories: Story[]
  journeyId: string
  orgId: string
  appId: string
}

export function StoryList({ stories, journeyId, orgId, appId }: StoryListProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [toggling, setToggling] = useState<string | null>(null)

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
                  <DropdownMenuItem>
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
    </>
  )
}
