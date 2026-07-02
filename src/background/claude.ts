import Anthropic from '@anthropic-ai/sdk'
import { buildUserPrompt, SYSTEM_PROMPT } from '../lib/prompt'
import { getApiKey } from '../lib/storage'
import type { AnalysisParameter, AnalysisResult, RuntimePayload, SelectedTarget } from '../lib/types'

// The Claude API call — this module is the only place it happens
// (architecture.md → invariant 3). The key comes from chrome.storage.local
// and is never logged (invariant 4).

const MODEL = 'claude-sonnet-4-6'
const MAX_TOKENS = 3000

export class MissingKeyError extends Error {
  constructor() {
    super('No Claude API key set. Add your key in the Revelio side panel.')
    this.name = 'MissingKeyError'
  }
}

export async function analyzeCapture(
  target: SelectedTarget,
  payload: RuntimePayload,
): Promise<AnalysisResult> {
  const apiKey = await getApiKey()
  if (!apiKey) throw new MissingKeyError()

  // MV3 service workers count as a browser environment for the SDK; the
  // manifest grants host permission for api.anthropic.com.
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildUserPrompt(target, payload) }],
  })

  const text = response.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('')

  return parseAnalysis(text)
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

// Parse defensively (code-standards.md): strip code fences, tolerate stray
// prose around the JSON, validate the shape before trusting it.
export function parseAnalysis(raw: string): AnalysisResult {
  let text = raw.trim()
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenced?.[1]) text = fenced[1].trim()

  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end <= start) throw new Error('Claude returned no JSON object.')

  let parsed: unknown
  try {
    parsed = JSON.parse(text.slice(start, end + 1))
  } catch {
    throw new Error('Claude returned malformed JSON.')
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Claude returned an unexpected response shape.')
  }
  const obj = parsed as Record<string, unknown>
  const concept = typeof obj['concept'] === 'string' ? obj['concept'] : null
  const explanation = typeof obj['explanation'] === 'string' ? obj['explanation'] : null
  const gsapCode = typeof obj['gsapCode'] === 'string' ? obj['gsapCode'] : null
  if (!concept || !explanation || !gsapCode) {
    throw new Error('Claude response is missing required fields.')
  }

  const parameters: AnalysisParameter[] = Array.isArray(obj['parameters'])
    ? obj['parameters'].flatMap((p: unknown) => {
        if (typeof p !== 'object' || p === null) return []
        const param = p as Record<string, unknown>
        if (typeof param['name'] !== 'string' || typeof param['description'] !== 'string') return []
        return [
          {
            name: param['name'],
            value: typeof param['value'] === 'string' ? param['value'] : String(param['value'] ?? ''),
            description: param['description'],
          },
        ]
      })
    : []

  return { concept, explanation, gsapCode, parameters }
}
