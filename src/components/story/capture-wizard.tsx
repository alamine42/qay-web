"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  MessageSquare,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Wand2,
  Edit,
  Save,
  Shield,
} from "lucide-react"
import { createStory } from "@/app/actions/stories"
import type { StoryStep, StoryOutcome, StoryPrecondition } from "@/lib/types"

interface Message {
  role: "user" | "assistant"
  content: string
}

interface GeneratedStory {
  title: string
  preconditions: StoryPrecondition[]
  steps: StoryStep[]
  outcome: StoryOutcome
  required_role?: string
}

interface CaptureWizardProps {
  journeyId: string
  orgId: string
  appId: string
  availableRoles?: string[]
}

type Step = "describe" | "clarify" | "review" | "confirm"

export function CaptureWizard({ journeyId, orgId, appId, availableRoles = [] }: CaptureWizardProps) {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState<Step>("describe")
  const [description, setDescription] = useState("")
  const [messages, setMessages] = useState<Message[]>([])
  const [currentInput, setCurrentInput] = useState("")
  const [generatedStory, setGeneratedStory] = useState<GeneratedStory | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const handleDescribe = async () => {
    if (!description.trim()) return

    setLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/v1/ai/analyze-story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description,
          previousExchanges: [],
        }),
      })

      const data = await response.json()

      if (data.error) {
        setError(data.error)
        setLoading(false)
        return
      }

      setMessages([
        { role: "user", content: description },
        {
          role: "assistant",
          content: data.isComplete
            ? "I have enough information to create your test story. Click Continue to review it."
            : data.clarifyingQuestions?.join("\n\n") || "I need more information.",
        },
      ])

      if (data.isComplete && data.story) {
        setGeneratedStory(data.story)
        setCurrentStep("review")
      } else {
        setCurrentStep("clarify")
      }
    } catch {
      setError("Failed to analyze story. Please try again.")
    }

    setLoading(false)
  }

  const handleClarify = async () => {
    if (!currentInput.trim()) return

    setLoading(true)
    setError(null)

    const newMessages = [
      ...messages,
      { role: "user" as const, content: currentInput },
    ]
    setMessages(newMessages)
    setCurrentInput("")

    try {
      const response = await fetch("/api/v1/ai/analyze-story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: currentInput,
          previousExchanges: newMessages,
        }),
      })

      const data = await response.json()

      if (data.error) {
        setError(data.error)
        setLoading(false)
        return
      }

      setMessages([
        ...newMessages,
        {
          role: "assistant",
          content: data.isComplete
            ? "I have enough information now. Click Continue to review your test story."
            : data.clarifyingQuestions?.join("\n\n") || "I need more information.",
        },
      ])

      if (data.isComplete && data.story) {
        setGeneratedStory(data.story)
      }
    } catch {
      setError("Failed to process response. Please try again.")
    }

    setLoading(false)
  }

  const handleSave = async () => {
    if (!generatedStory) return

    setSaving(true)
    setError(null)

    try {
      const result = await createStory({
        journeyId,
        name: generatedStory.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, ""),
        title: generatedStory.title,
        preconditions: generatedStory.preconditions,
        steps: generatedStory.steps,
        outcome: generatedStory.outcome,
        required_role: generatedStory.required_role,
      })

      if (result.error) {
        setError(result.error)
        setSaving(false)
        return
      }

      router.push(`/org/${orgId}/apps/${appId}/journeys/${journeyId}`)
      router.refresh()
    } catch {
      setError("Failed to save story. Please try again.")
      setSaving(false)
    }
  }

  const steps: { id: Step; label: string; description: string }[] = [
    { id: "describe", label: "Describe", description: "Tell us what you want to test" },
    { id: "clarify", label: "Clarify", description: "Answer AI questions" },
    { id: "review", label: "Review", description: "Review generated story" },
    { id: "confirm", label: "Confirm", description: "Save your story" },
  ]

  const currentStepIndex = steps.findIndex((s) => s.id === currentStep)

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Progress Steps */}
      <div className="flex items-center justify-between">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center">
            <div
              className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${
                index < currentStepIndex
                  ? "bg-primary border-primary text-primary-foreground"
                  : index === currentStepIndex
                  ? "border-primary text-primary"
                  : "border-muted text-muted-foreground"
              }`}
            >
              {index < currentStepIndex ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <span className="text-sm font-medium">{index + 1}</span>
              )}
            </div>
            <div className="ml-2 hidden md:block">
              <p
                className={`text-sm font-medium ${
                  index <= currentStepIndex ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {step.label}
              </p>
            </div>
            {index < steps.length - 1 && (
              <Separator className="w-12 mx-4 hidden md:block" />
            )}
          </div>
        ))}
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Step Content */}
      {currentStep === "describe" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5" />
              Describe Your Test
            </CardTitle>
            <CardDescription>
              Tell us in natural language what you want to test. Be as detailed as possible.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Example: I want to test that a user can log in with their email and password, see their dashboard, and log out successfully."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={6}
              className="resize-none"
            />
          </CardContent>
          <CardFooter className="flex justify-end">
            <Button onClick={handleDescribe} disabled={loading || !description.trim()}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  Continue
                  <ArrowRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      )}

      {currentStep === "clarify" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Clarify Details
            </CardTitle>
            <CardDescription>
              Answer the AI&apos;s questions to complete your test story.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ScrollArea className="h-[300px] rounded-md border p-4">
              <div className="space-y-4">
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={`flex ${
                      message.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg px-4 py-2 ${
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-lg px-4 py-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            <div className="flex gap-2">
              <Input
                placeholder="Type your answer..."
                value={currentInput}
                onChange={(e) => setCurrentInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !loading && handleClarify()}
                disabled={loading}
              />
              <Button onClick={handleClarify} disabled={loading || !currentInput.trim()}>
                Send
              </Button>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button
              variant="outline"
              onClick={() => setCurrentStep("describe")}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            {generatedStory && (
              <Button onClick={() => setCurrentStep("review")}>
                Continue
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            )}
          </CardFooter>
        </Card>
      )}

      {currentStep === "review" && generatedStory && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5" />
              Review Your Story
            </CardTitle>
            <CardDescription>
              Review and edit the generated test story before saving.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={generatedStory.title}
                onChange={(e) =>
                  setGeneratedStory({ ...generatedStory, title: e.target.value })
                }
              />
            </div>

            {availableRoles.length > 0 && (
              <div className="space-y-3 p-4 rounded-xl border bg-gradient-to-br from-violet-500/5 to-purple-500/5">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500/20 to-purple-500/20">
                    <Shield className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                  </div>
                  <div>
                    <Label className="text-sm font-semibold">Required Role</Label>
                    <p className="text-xs text-muted-foreground">
                      Authenticate before running this story
                    </p>
                  </div>
                </div>

                {/* Role Pills - Mobile optimized */}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setGeneratedStory({
                        ...generatedStory,
                        required_role: undefined,
                      })
                    }
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-full border transition-all ${
                      !generatedStory.required_role
                        ? "bg-primary text-primary-foreground border-primary shadow-md"
                        : "bg-muted/50 text-muted-foreground hover:bg-muted border-transparent"
                    }`}
                  >
                    No auth
                  </button>
                  {availableRoles.map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() =>
                        setGeneratedStory({
                          ...generatedStory,
                          required_role: role,
                        })
                      }
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-full border transition-all ${
                        generatedStory.required_role === role
                          ? "bg-gradient-to-r from-violet-600 to-purple-600 text-white border-transparent shadow-lg shadow-violet-500/25"
                          : "bg-muted/50 text-muted-foreground hover:bg-muted border-transparent"
                      }`}
                    >
                      <Shield className="h-3.5 w-3.5" />
                      {role}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <Tabs defaultValue="preconditions">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="preconditions">Preconditions</TabsTrigger>
                <TabsTrigger value="steps">Steps</TabsTrigger>
                <TabsTrigger value="outcome">Outcome</TabsTrigger>
              </TabsList>

              <TabsContent value="preconditions" className="space-y-2">
                {generatedStory.preconditions.length > 0 ? (
                  generatedStory.preconditions.map((pre, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-2 p-3 rounded-lg border"
                    >
                      <Badge variant="outline">{pre.type}</Badge>
                      <p className="text-sm">{pre.description}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No preconditions</p>
                )}
              </TabsContent>

              <TabsContent value="steps" className="space-y-2">
                {generatedStory.steps.map((step, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-3 p-3 rounded-lg border"
                  >
                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-medium">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{step.action}</p>
                      {step.element && (
                        <p className="text-sm text-muted-foreground">
                          Element: {step.element}
                        </p>
                      )}
                      {step.value && (
                        <p className="text-sm text-muted-foreground">
                          Value: {step.value}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="outcome" className="space-y-2">
                <div className="p-3 rounded-lg border">
                  <p className="font-medium">{generatedStory.outcome.description}</p>
                  <div className="mt-2 space-y-1">
                    {generatedStory.outcome.verifications.map((v, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Badge variant="secondary">{v.type}</Badge>
                        <span className="text-sm">{v.expected}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button
              variant="outline"
              onClick={() => setCurrentStep("clarify")}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Button onClick={() => setCurrentStep("confirm")}>
              Looks Good
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </CardFooter>
        </Card>
      )}

      {currentStep === "confirm" && generatedStory && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Save className="h-5 w-5" />
              Save Story
            </CardTitle>
            <CardDescription>
              Your test story is ready to be saved.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border p-4 bg-muted/50">
              <h4 className="font-semibold">{generatedStory.title}</h4>
              <p className="text-sm text-muted-foreground mt-1">
                {generatedStory.steps.length} steps •{" "}
                {generatedStory.outcome.verifications.length} verifications
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button
              variant="outline"
              onClick={() => setCurrentStep("review")}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Story
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  )
}
