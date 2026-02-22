"use client"

import { useState } from "react"
import { useTestRunProgress } from "@/lib/hooks/use-test-run-progress"
import { cancelTestRun } from "@/app/actions/test-runs"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, XCircle } from "lucide-react"
import type { TestRun, TestResult } from "@/lib/types"

interface TestRunProgressProps {
  testRunId: string
  initialRun: TestRun
  initialResults: TestResult[]
}

export function TestRunProgress({
  testRunId,
  initialRun,
  initialResults,
}: TestRunProgressProps) {
  const { testRun, results, loading } = useTestRunProgress({
    testRunId,
    initialRun,
    initialResults,
  })
  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)

  const handleCancel = async () => {
    setCancelling(true)
    setCancelError(null)
    const result = await cancelTestRun(testRunId)
    if (result.error) {
      setCancelError(result.error)
      setCancelling(false)
    }
    // On success, status will update via realtime subscription
  }

  if (!testRun) return null

  const total = testRun.stories_total || 1
  const completed = testRun.stories_passed + testRun.stories_failed + (testRun.stories_skipped || 0)
  const progress = (completed / total) * 100

  // Use current_story_name from test run (real-time) or fall back to last result
  const currentStoryName = testRun.current_story_name || results[results.length - 1]?.story_name

  if (testRun.status === "completed" || testRun.status === "cancelled") {
    return null
  }

  return (
    <Card className="border-blue-200 bg-blue-50/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Test Run in Progress
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCancel}
            disabled={cancelling}
            className="text-muted-foreground hover:text-destructive"
          >
            {cancelling ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
            <span className="ml-1">Cancel</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>
              {completed} of {total} stories completed
            </span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} />
        </div>

        {currentStoryName && (
          <div className="text-sm text-muted-foreground">
            Running: <span className="font-medium">{currentStoryName}</span>
          </div>
        )}

        <div className="flex gap-4 text-sm">
          <span className="text-green-600">
            {testRun.stories_passed} passed
          </span>
          <span className="text-red-600">
            {testRun.stories_failed} failed
          </span>
        </div>

        {cancelError && (
          <p className="text-sm text-destructive">{cancelError}</p>
        )}
      </CardContent>
    </Card>
  )
}
