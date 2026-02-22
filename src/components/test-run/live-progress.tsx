"use client"

import { useTestRunProgress } from "@/lib/hooks/use-test-run-progress"
import { Progress } from "@/components/ui/progress"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2 } from "lucide-react"
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
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Test Run in Progress
        </CardTitle>
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
      </CardContent>
    </Card>
  )
}
