import { chromium, Browser, Page } from "playwright"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import type { StoryStep, HealProposal, StepResult } from "./types"

interface Story {
  id: string
  steps: StoryStep[]
  outcome: { verifications: Array<{ type: string; target?: string; expected: string }> }
  required_role?: string
}

interface AuthConfig {
  type: 'none' | 'basic' | 'form' | 'oauth'
  loginUrl?: string
  usernameSelector?: string
  passwordSelector?: string
  submitSelector?: string
  successIndicator?: string
}

interface UserCredentials {
  username: string
  password: string
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

interface ExecutionOptions {
  retryCount: number
  screenshotOnFailure: boolean
  credentials?: UserCredentials
  authConfig?: AuthConfig
}

interface ExecutionResult {
  passed: boolean
  duration_ms: number
  steps: StepResult[]
  error?: string
  screenshot_url?: string
  console_errors: string[]
  heal_proposal?: HealProposal
  retries: number
}

let browser: Browser | null = null

async function getBrowser(): Promise<Browser> {
  if (!browser) {
    browser = await chromium.launch({
      headless: true,
    })
  }
  return browser
}

async function uploadScreenshot(
  screenshot: Buffer,
  storyId: string,
  timestamp: string
): Promise<string | null> {
  try {
    const supabase = createSupabaseClient(supabaseUrl, supabaseServiceKey)
    const filename = `${storyId}/${timestamp}.png`

    const { error } = await supabase.storage
      .from("screenshots")
      .upload(filename, screenshot, {
        contentType: "image/png",
        upsert: true,
      })

    if (error) {
      console.error("Screenshot upload error:", error)
      return null
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("screenshots").getPublicUrl(filename)

    return publicUrl
  } catch (error) {
    console.error("Screenshot upload failed:", error)
    return null
  }
}

async function authenticateUser(
  page: Page,
  baseUrl: string,
  credentials: UserCredentials,
  authConfig: AuthConfig
): Promise<{ success: boolean; error?: string }> {
  try {
    // Navigate to login page - resolve relative paths against baseUrl
    const loginUrl = new URL(authConfig.loginUrl ?? "/", baseUrl).toString()
    await page.goto(loginUrl, { waitUntil: "domcontentloaded" })

    // Default selectors if not provided
    const usernameSelector = authConfig.usernameSelector || 'input[type="email"], input[name="email"], input[name="username"], #email, #username'
    const passwordSelector = authConfig.passwordSelector || 'input[type="password"], input[name="password"], #password'
    const submitSelector = authConfig.submitSelector || 'button[type="submit"], input[type="submit"], button:has-text("Login"), button:has-text("Sign in")'

    // Fill credentials
    await page.fill(usernameSelector, credentials.username)
    await page.fill(passwordSelector, credentials.password)

    // Click submit
    await page.click(submitSelector)

    // Wait for navigation or success indicator
    if (authConfig.successIndicator) {
      await page.waitForSelector(authConfig.successIndicator, { timeout: 10000 })
    } else {
      // Wait for URL change or page load
      await page.waitForLoadState("domcontentloaded")
    }

    console.log(`Authenticated as ${credentials.username}`)
    return { success: true }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error(`Authentication failed: ${errorMessage}`)
    return { success: false, error: `Authentication failed: ${errorMessage}` }
  }
}

async function executeStep(
  page: Page,
  step: StoryStep,
  stepIndex: number
): Promise<StepResult> {
  const startTime = Date.now()

  try {
    const action = step.action.toLowerCase()

    // Navigate
    if (action.includes("navigate") || action.includes("go to")) {
      const url = step.value || step.element
      if (url) {
        await page.goto(url, { waitUntil: "domcontentloaded" })
      }
    }
    // Click
    else if (action.includes("click") || action.includes("tap")) {
      const selector = step.selector || step.element
      if (selector) {
        await page.click(selector)
      }
    }
    // Type/Fill
    else if (
      action.includes("type") ||
      action.includes("enter") ||
      action.includes("fill")
    ) {
      const selector = step.selector || step.element
      const value = step.value || ""
      if (selector) {
        await page.fill(selector, value)
      }
    }
    // Select
    else if (action.includes("select") || action.includes("choose")) {
      const selector = step.selector || step.element
      const value = step.value || ""
      if (selector) {
        await page.selectOption(selector, value)
      }
    }
    // Check/Uncheck
    else if (action.includes("check")) {
      const selector = step.selector || step.element
      if (selector) {
        await page.check(selector)
      }
    } else if (action.includes("uncheck")) {
      const selector = step.selector || step.element
      if (selector) {
        await page.uncheck(selector)
      }
    }
    // Wait
    else if (action.includes("wait")) {
      const timeout = parseInt(step.value || "1000", 10)
      await page.waitForTimeout(timeout)
    }
    // Scroll
    else if (action.includes("scroll")) {
      const selector = step.selector || step.element
      if (selector) {
        await page.locator(selector).scrollIntoViewIfNeeded()
      } else {
        await page.evaluate(() => window.scrollBy(0, 300))
      }
    }
    // Hover
    else if (action.includes("hover")) {
      const selector = step.selector || step.element
      if (selector) {
        await page.hover(selector)
      }
    }
    // Press key
    else if (action.includes("press")) {
      const key = step.value || "Enter"
      await page.keyboard.press(key)
    }
    // Focus
    else if (action.includes("focus")) {
      const selector = step.selector || step.element
      if (selector) {
        await page.focus(selector)
      }
    }
    // Default: try to click if element provided
    else if (step.selector || step.element) {
      const selector = step.selector || step.element!
      await page.click(selector)
    }

    // Brief pause to let UI update after action
    await page.waitForTimeout(100)

    return {
      step: stepIndex,
      action: step.action,
      passed: true,
      duration_ms: Date.now() - startTime,
    }
  } catch (error) {
    return {
      step: stepIndex,
      action: step.action,
      passed: false,
      duration_ms: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function executeStory(
  story: Story,
  baseUrl: string,
  options: ExecutionOptions
): Promise<ExecutionResult> {
  const browser = await getBrowser()
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  })
  const page = await context.newPage()

  const consoleErrors: string[] = []
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text())
    }
  })

  const startTime = Date.now()
  const stepResults: StepResult[] = []
  let passed = true
  let error: string | undefined
  let screenshotUrl: string | undefined
  let retries = 0

  try {
    // Authenticate if credentials provided
    if (options.credentials && options.authConfig && options.authConfig.type === 'form') {
      const authResult = await authenticateUser(
        page,
        baseUrl,
        options.credentials,
        options.authConfig
      )
      if (!authResult.success) {
        throw new Error(authResult.error || "Authentication failed")
      }
    } else {
      // Navigate to base URL first (if no auth needed)
      await page.goto(baseUrl, { waitUntil: "domcontentloaded" })
    }

    // Execute each step
    for (let i = 0; i < story.steps.length; i++) {
      const step = story.steps[i]
      let stepResult: StepResult

      // Retry logic for individual steps
      let attempts = 0
      let lastError: string | undefined

      while (attempts <= options.retryCount) {
        stepResult = await executeStep(page, step, i)

        if (stepResult.passed) {
          break
        }

        lastError = stepResult.error
        attempts++
        retries++

        if (attempts <= options.retryCount) {
          // Wait before retry
          await page.waitForTimeout(1000)
        }
      }

      stepResults.push(stepResult!)

      if (!stepResult!.passed) {
        passed = false
        error = lastError

        // Take screenshot on failure
        if (options.screenshotOnFailure) {
          const screenshot = await page.screenshot()
          screenshotUrl = await uploadScreenshot(
            screenshot,
            story.id,
            new Date().toISOString().replace(/[:.]/g, "-")
          ) || undefined
        }

        break
      }
    }

    // Verify outcome if all steps passed
    if (passed && story.outcome?.verifications) {
      for (const verification of story.outcome.verifications) {
        try {
          if (verification.type === "url") {
            const currentUrl = page.url()
            if (!currentUrl.includes(verification.expected)) {
              passed = false
              error = `Expected URL to contain "${verification.expected}", got "${currentUrl}"`
            }
          } else if (verification.type === "element") {
            const element = await page
              .locator(verification.target || verification.expected)
              .first()
            if (!(await element.isVisible())) {
              passed = false
              error = `Element "${verification.target || verification.expected}" not visible`
            }
          } else if (verification.type === "content") {
            const hasText = await page
              .locator(`text=${verification.expected}`)
              .first()
              .isVisible()
              .catch(() => false)
            if (!hasText) {
              passed = false
              error = `Expected content "${verification.expected}" not found`
            }
          }
        } catch (e) {
          passed = false
          error = e instanceof Error ? e.message : String(e)
        }

        if (!passed) break
      }

      // Take screenshot on verification failure
      if (!passed && options.screenshotOnFailure && !screenshotUrl) {
        const screenshot = await page.screenshot()
        screenshotUrl = await uploadScreenshot(
          screenshot,
          story.id,
          new Date().toISOString().replace(/[:.]/g, "-")
        ) || undefined
      }
    }
  } catch (e) {
    passed = false
    error = e instanceof Error ? e.message : String(e)

    // Take screenshot on error
    if (options.screenshotOnFailure) {
      try {
        const screenshot = await page.screenshot()
        screenshotUrl = await uploadScreenshot(
          screenshot,
          story.id,
          new Date().toISOString().replace(/[:.]/g, "-")
        ) || undefined
      } catch {
        // Ignore screenshot errors
      }
    }
  } finally {
    await context.close()
  }

  return {
    passed,
    duration_ms: Date.now() - startTime,
    steps: stepResults,
    error,
    screenshot_url: screenshotUrl,
    console_errors: consoleErrors,
    retries,
  }
}

// Clean up browser on process exit
process.on("exit", async () => {
  if (browser) {
    await browser.close()
  }
})
