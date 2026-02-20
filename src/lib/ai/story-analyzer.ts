import Anthropic from "@anthropic-ai/sdk"
import type { StoryStep, StoryOutcome, StoryPrecondition } from "@/lib/types"

let client: Anthropic | null = null

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })
  }
  return client
}

export interface ConversationMessage {
  role: "user" | "assistant"
  content: string
}

export interface StoryAnalysis {
  isComplete: boolean
  clarifyingQuestions?: string[]
  missingInfo?: string[]
  story?: {
    title: string
    preconditions: StoryPrecondition[]
    steps: StoryStep[]
    outcome: StoryOutcome
  }
}

const STORY_ANALYSIS_SYSTEM_PROMPT = `You are an expert QA analyst helping to capture user stories for automated testing.

Your job is to:
1. Understand the user's description of what they want to test
2. Ask clarifying questions if needed to fully understand the test scenario
3. Generate a structured test story when you have enough information

When analyzing a story description, determine if you have enough information to create a complete test story. A complete story needs:
- Clear understanding of the starting point (preconditions)
- Specific user actions to perform
- Expected outcomes after each action
- Final verification of success

Respond in JSON format with this structure:
{
  "isComplete": boolean,
  "clarifyingQuestions": ["question1", "question2"] (if isComplete is false),
  "story": { ... } (if isComplete is true),
  "missingInfo": ["what's missing"] (if isComplete is false)
}

When the story is complete, include the full story structure:
{
  "isComplete": true,
  "story": {
    "title": "descriptive title",
    "preconditions": [
      { "type": "auth|data|state", "description": "..." }
    ],
    "steps": [
      { "action": "what to do", "element": "target element", "value": "input value if any", "description": "what happens" }
    ],
    "outcome": {
      "description": "final expected state",
      "verifications": [
        { "type": "visual|element|url|content", "expected": "what to check" }
      ]
    }
  }
}`

export async function chat(
  messages: ConversationMessage[],
  systemPrompt?: string
): Promise<string> {
  const anthropic = getClient()

  const response = await anthropic.messages.create({
    model: "claude-3-5-sonnet-latest",
    max_tokens: 4096,
    system: systemPrompt,
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  })

  const textContent = response.content.find((c) => c.type === "text")
  return textContent ? textContent.text : ""
}

function extractJson(response: string): any {
  // Try to extract JSON from markdown code blocks first
  const jsonMatch =
    response.match(/```json\s*([\s\S]*?)\s*```/) ||
    response.match(/```\s*([\s\S]*?)\s*```/)
  const jsonStr = jsonMatch ? jsonMatch[1] : response
  return JSON.parse(jsonStr.trim())
}

export async function analyzeStory(
  description: string,
  previousExchanges: ConversationMessage[] = []
): Promise<StoryAnalysis> {
  const messages: ConversationMessage[] = [
    ...previousExchanges,
    {
      role: "user",
      content: description,
    },
  ]

  const response = await chat(messages, STORY_ANALYSIS_SYSTEM_PROMPT)

  try {
    return extractJson(response)
  } catch {
    // If parsing fails, assume we need more info
    return {
      isComplete: false,
      clarifyingQuestions: [
        "Could you provide more details about what you want to test?",
      ],
      missingInfo: ["Unable to parse story from description"],
    }
  }
}

export async function generateClarifyingQuestions(
  partialDescription: string
): Promise<string[]> {
  const response = await chat(
    [
      {
        role: "user",
        content: `Given this partial story description, what clarifying questions should I ask to complete it?\n\n${partialDescription}`,
      },
    ],
    STORY_ANALYSIS_SYSTEM_PROMPT
  )

  try {
    const result = extractJson(response)
    return result.clarifyingQuestions || []
  } catch {
    return ["Could you provide more details about the test scenario?"]
  }
}

export interface SelectorInference {
  selector: string
  strategy: "role" | "text" | "testid" | "css"
  confidence: number
  alternatives: string[]
}

const SELECTOR_INFERENCE_PROMPT = `You are an expert at inferring CSS/Playwright selectors from action descriptions.

Given an action description, suggest the most likely selector strategy. Consider:
- Button text for buttons
- Label text for form fields
- Role-based selectors when possible
- Data-testid attributes as fallback

Respond in JSON format:
{
  "selector": "the selector string",
  "strategy": "role|text|testid|css",
  "confidence": 0.0-1.0,
  "alternatives": ["alternative1", "alternative2"]
}`

export async function inferSelector(action: string): Promise<SelectorInference> {
  const response = await chat(
    [{ role: "user", content: `Action: "${action}"` }],
    SELECTOR_INFERENCE_PROMPT
  )

  try {
    return extractJson(response)
  } catch {
    return {
      selector: "",
      strategy: "css",
      confidence: 0,
      alternatives: [],
    }
  }
}
