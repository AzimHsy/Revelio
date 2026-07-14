import type { ScanItem } from '../lib/types'
import { scan } from './scan'

// Read-only browser-agent global (V2 Unit 6). Exposes the page-scan snapshot on
// `window.__revelio__` so a browser-driving agent can enumerate the page's
// animations with pure JS — no UI, no extension messaging, no network. It runs in
// the MAIN world (the only place allowed to read page globals, architecture.md →
// invariant 1) and is EXTRACTION ONLY: it returns the same serialized data the
// panel scan sees, never the API key or any chrome.* surface.
//
// Read-only by construction: the exposed object and its returned values are
// frozen/cloned, and the property is non-writable + non-configurable so page code
// can't replace or tamper with it.

const VERSION = 1

interface RevelioGlobal {
  readonly version: number
  /** Enumerate the page's animations right now (also caches for `get`). */
  scan(): ScanItem[]
  /** Look up one item from the most recent `scan()` by id, or null. */
  get(id: string): ScanItem | null
}

let snapshot = new Map<string, ScanItem>()

// ScanItem is plain JSON, so a JSON round-trip is a safe deep copy that also
// severs any shared reference into our cache.
function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export function installBrowserGlobal(): void {
  const win = window as unknown as Record<string, unknown>
  if (win['__revelio__']) return // idempotent

  const api: RevelioGlobal = Object.freeze({
    version: VERSION,
    scan(): ScanItem[] {
      const items = scan()
      snapshot = new Map(items.map((item) => [item.id, item]))
      return items.map(clone)
    },
    get(id: string): ScanItem | null {
      const item = snapshot.get(id)
      return item ? clone(item) : null
    },
  })

  try {
    Object.defineProperty(window, '__revelio__', {
      value: api,
      writable: false,
      configurable: false,
      enumerable: false,
    })
  } catch {
    // Property already defined non-configurably, or window locked down — skip.
  }
}
