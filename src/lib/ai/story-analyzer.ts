import Anthropic from "@anthropic-ai/sdk"
import type { StoryStep, StoryOutcome, StoryPrecondition } from "@/lib/types"

let client: Anthropic | null = null

function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY environment variable is not set")
    }
    client = new Anthropic({ apiKey })
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

export interface AppContext {
  environments: Array<{
    name: string
    base_url: string
    is_default: boolean
    test_users: Array<{ role: string; username: string }>
  }>
  availableRoles: string[]
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

  const response = await anthropic.messages.create(
    {
      model: "claude-3-haiku-20240307",
      max_tokens: 4096,
      system: systemPrompt,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    },
    {
      timeout: 30000, // 30 second timeout
    }
  )

  const textContent = response.content.find((c) => c.type === "text")
  return textContent ? textContent.text : ""
}

function extractJson(response: string): unknown {
  // Try to extract JSON from markdown code blocks first
  const jsonMatch =
    response.match(/```json\s*([\s\S]*?)\s*```/) ||
    response.match(/```\s*([\s\S]*?)\s*```/)
  const jsonStr = jsonMatch ? jsonMatch[1] : response
  return JSON.parse(jsonStr.trim())
}

function isValidStoryAnalysis(data: unknown): data is StoryAnalysis {
  if (typeof data !== "object" || data === null) return false
  const obj = data as Record<string, unknown>
  if (typeof obj.isComplete !== "boolean") return false
  if (obj.isComplete && !obj.story) return false
  if (obj.clarifyingQuestions && !isStringArray(obj.clarifyingQuestions)) return false
  if (obj.missingInfo && !isStringArray(obj.missingInfo)) return false
  if (obj.story) {
    const story = obj.story as Record<string, unknown>
    if (typeof story.title !== "string") return false
    if (!Array.isArray(story.steps)) return false
    if (!Array.isArray(story.preconditions)) return false
  }
  return true
}

function isStringArray(data: unknown): data is string[] {
  return Array.isArray(data) && data.every(item => typeof item === "string")
}

function isValidClarifyingQuestionsResult(data: unknown): data is { clarifyingQuestions?: string[] } {
  if (typeof data !== "object" || data === null) return false
  const obj = data as Record<string, unknown>
  if (obj.clarifyingQuestions !== undefined && !isStringArray(obj.clarifyingQuestions)) return false
  return true
}

function isValidSelectorInference(data: unknown): data is SelectorInference {
  if (typeof data !== "object" || data === null) return false
  const obj = data as Record<string, unknown>
  if (typeof obj.selector !== "string") return false
  if (!["role", "text", "testid", "css"].includes(obj.strategy as string)) return false
  if (typeof obj.confidence !== "number") return false
  if (!Array.isArray(obj.alternatives)) return false
  return true
}

function buildContextSection(context: AppContext): string {
  const envList = context.environments
    .map(e => `- ${e.name}${e.is_default ? ' (default)' : ''}: ${e.base_url}`)
    .join('\n')

  const roleList = context.availableRoles
    .map(r => `- ${r}`)
    .join('\n')

  const testUsersByEnv = context.environments
    .filter(e => e.test_users.length > 0)
    .map(e => `- ${e.name}: ${e.test_users.map(u => `${u.role} (${u.username})`).join(', ')}`)
    .join('\n')

  return `
## App Context (DO NOT ask for this information - use it directly)

You have access to the following app configuration. Use it directly in your story without asking:

Environments:
${envList}

Available Test Roles:
${roleList}

Test Users per Environment:
${testUsersByEnv}

When generating steps:
- Use the default environment URL unless the user specifies otherwise
- Reference test roles when authentication is needed
- Don't ask about URLs or credentials - they're already configured
`
}

export async function analyzeStory(
  description: string,
  previousExchanges: ConversationMessage[] = [],
  context?: AppContext
): Promise<StoryAnalysis> {
  const messages: ConversationMessage[] = [
    ...previousExchanges,
    {
      role: "user",
      content: description,
    },
  ]

  const contextSection = context ? buildContextSection(context) : ''
  const systemPrompt = STORY_ANALYSIS_SYSTEM_PROMPT + contextSection

  const response = await chat(messages, systemPrompt)

  try {
    const parsed = extractJson(response)
    if (isValidStoryAnalysis(parsed)) {
      return parsed
    }
    // Parsed but invalid structure
    return {
      isComplete: false,
      clarifyingQuestions: [
        "Could you provide more details about what you want to test?",
      ],
      missingInfo: ["Unable to parse a valid story structure"],
    }
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
    if (isValidClarifyingQuestionsResult(result)) {
      return result.clarifyingQuestions || []
    }
    return ["Could you provide more details about the test scenario?"]
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
    const result = extractJson(response)
    if (isValidSelectorInference(result)) {
      return result
    }
    return {
      selector: "",
      strategy: "css",
      confidence: 0,
      alternatives: [],
    }
  } catch {
    return {
      selector: "",
      strategy: "css",
      confidence: 0,
      alternatives: [],
    }
  }
}
