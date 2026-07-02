import Anthropic from '@anthropic-ai/sdk'
import { isComplete, parseAnalysisText } from '../lib/analysis'
import { buildUserPrompt, SYSTEM_PROMPT } from '../lib/prompt'
import { getApiKey } from '../lib/storage'
import type { ElementClone, AnalysisResult, RuntimePayload, SelectedTarget } from '../lib/types'

// How often (ms) to push a partial parse to the panel while streaming — often
// enough to feel live, throttled so we don't spam the message channel.
const PROGRESS_INTERVAL_MS = 120

// The Claude API call — this module is the only place it happens
// (architecture.md → invariant 3). The key comes from chrome.storage.local
// and is never logged (invariant 4).

const MODEL = 'claude-sonnet-4-6'
const MAX_TOKENS = 3500 // room for the extra PREVIEW section
// Safety rails so a slow/huge request can never run away (the payload digest
// keeps input small; these bound the worst case regardless):
const REQUEST_TIMEOUT_MS = 60_000 // hard cap per attempt
const MAX_RETRIES = 1 // one retry, not the SDK default of 2 — bounds cost on failure

export class MissingKeyError extends Error {
  constructor() {
    super('No Claude API key set. Add your key in the Revelio side panel.')
    this.name = 'MissingKeyError'
  }
}

export async function analyzeCapture(
  target: SelectedTarget,
  payload: RuntimePayload,
  clone: ElementClone | null,
  onProgress?: (partial: AnalysisResult) => void,
): Promise<AnalysisResult> {
  const apiKey = await getApiKey()
  if (!apiKey) throw new MissingKeyError()

  // MV3 service workers count as a browser environment for the SDK; the
  // manifest grants host permission for api.anthropic.com.
  const client = new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true,
    timeout: REQUEST_TIMEOUT_MS,
    maxRetries: MAX_RETRIES,
  })

  // Stream so the panel can render the answer as it generates instead of
  // waiting on the full response (claude-api guidance for large outputs).
  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildUserPrompt(target, payload, clone?.outline ?? null) }],
  })

  let text = ''
  let lastEmit = 0
  stream.on('text', (delta) => {
    text += delta
    const now = Date.now()
    if (onProgress && now - lastEmit >= PROGRESS_INTERVAL_MS) {
      lastEmit = now
      onProgress(parseAnalysisText(text))
    }
  })

  const final = await stream.finalMessage()
  const full = final.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('')

  const result = parseAnalysisText(full)
  if (!isComplete(result)) throw new Error('Claude returned an incomplete response.')
  return result
}

/** Human-readable message for the panel; never includes the API key. */
export function describeAnalysisError(error: unknown): { reason: string; missingKey: boolean } {
  if (error instanceof MissingKeyError) return { reason: error.message, missingKey: true }
  if (error instanceof Anthropic.AuthenticationError) {
    return { reason: 'Claude rejected the API key. Check it in the side panel.', missingKey: true }
  }
  if (error instanceof Anthropic.RateLimitError) {
    return { reason: 'Rate limited by the Claude API — try again shortly.', missingKey: false }
  }
  if (error instanceof Anthropic.APIError) {
    return { reason: `Claude API error (${error.status ?? 'network'}): ${error.message}`, missingKey: false }
  }
  return {
    reason: error instanceof Error ? error.message : 'Analysis failed unexpectedly.',
    missingKey: false,
  }
}
