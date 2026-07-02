import type { JsonValue } from './types'

// Runtime-data serializer (architecture.md → src/lib). Page data is untrusted
// and full of live references; everything crossing a world boundary goes
// through here first so only plain, bounded JSON survives (invariant 2).

const MAX_DEPTH = 4
const MAX_KEYS = 40
const MAX_ITEMS = 40
const MAX_STRING = 500

export function toJsonSafe(value: unknown, depth = 0): JsonValue {
  if (value === null || value === undefined) return null
  if (typeof value === 'string') {
    return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…` : value
  }
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'boolean') return value
  if (typeof value === 'function') {
    return `[function${value.name ? ` ${value.name}` : ''}]`
  }
  if (typeof Element !== 'undefined' && value instanceof Element) return describeNode(value)
  if (depth >= MAX_DEPTH) return '[max depth]'
  if (Array.isArray(value)) {
    return value.slice(0, MAX_ITEMS).map((item) => toJsonSafe(item, depth + 1))
  }
  if (typeof value === 'object') {
    const out: Record<string, JsonValue> = {}
    let count = 0
    for (const key of Object.keys(value)) {
      if (count >= MAX_KEYS) {
        out['…'] = '[truncated]'
        break
      }
      out[key] = toJsonSafe((value as Record<string, unknown>)[key], depth + 1)
      count += 1
    }
    return out
  }
  return String(value)
}

/** Short human/AI-readable descriptor for a DOM node: "div#hero.title". */
export function describeNode(el: Element): string {
  let desc = el.tagName.toLowerCase()
  if (el.id) desc += `#${el.id}`
  const firstClass = el.classList[0]
  if (firstClass) desc += `.${firstClass}`
  return desc
}
