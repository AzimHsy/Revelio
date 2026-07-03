import { describeNode, toJsonSafe } from '../lib/serialize'
import type { InstrumentedRecord, JsonValue } from '../lib/types'
import { intersectsViewport, type Scope } from './gsap'

// Load-time GSAP instrumentation (enhancement 2). Runs in the MAIN world at
// document_start — BEFORE the page's own scripts — and traps `window.gsap` /
// `window.ScrollTrigger` so we can wrap their creation APIs. GSAP disposes a
// finished one-shot tween, so a load-in reveal is gone by the time the user
// inspects; by recording at creation time we keep the ORIGINAL vars as
// SOURCE-grade truth (see architecture.md → invariant 1: only MAIN reads globals).
//
// Hard rule: every wrapper RECORDS, then calls through to the original and
// returns its result unchanged. We never alter animation behaviour.

interface RawRecord {
  method: string
  /** Live element refs for scope matching (never serialized directly). */
  elements: Element[]
  /** Raw selector strings, re-resolved at extract time (DOM may grow after). */
  selectors: string[]
  /** Display descriptors for the payload. */
  descriptors: string[]
  vars: Record<string, unknown>
  createdAt: number
}

const MAX_RECORDS = 300
const registry: RawRecord[] = []
const wrapped = new WeakSet<object>()

// ---------------------------------------------------------------------------
// Public API — called from main.ts.
// ---------------------------------------------------------------------------

/** Install the traps. Idempotent; safe to call once at module load. */
export function installInstrumentation(): void {
  try {
    installTrap('gsap', wrapGsap)
    installTrap('ScrollTrigger', wrapScrollTrigger)
  } catch {
    // A locked-down page (frozen window, defineProperty blocked) — give up
    // silently; the snapshot readers remain the fallback.
  }
}

/** Records whose targets match the selection, serialized for the payload. */
export function collectInstrumented(scope: Scope): InstrumentedRecord[] {
  const matched: InstrumentedRecord[] = []
  for (const record of registry) {
    if (!recordMatchesScope(record, scope)) continue
    matched.push({
      method: record.method,
      targets: record.descriptors.slice(0, 12),
      vars: safeVars(record.vars),
      createdAt: record.createdAt,
    })
    if (matched.length >= 40) break
  }
  return matched
}

// ---------------------------------------------------------------------------
// Trap: wrap the global the moment it is assigned (and if already present).
// `wrap` may return a replacement value (used to proxy the ScrollTrigger
// constructor); returning undefined keeps the original reference.
// ---------------------------------------------------------------------------

function installTrap(name: string, wrap: (value: unknown) => unknown): void {
  const win = window as unknown as Record<string, unknown>
  let current = win[name]
  if (current) {
    try {
      current = wrap(current) ?? current
    } catch {
      /* keep original */
    }
  }
  Object.defineProperty(window, name, {
    configurable: true,
    get: () => current,
    set: (value: unknown) => {
      try {
        current = wrap(value) ?? value
      } catch {
        current = value
      }
    },
  })
}

// ---------------------------------------------------------------------------
// gsap wrapping — to / from / fromTo / set / timeline (+ its child methods).
// Mutates the gsap namespace object's methods in place (behaviour preserved).
// ---------------------------------------------------------------------------

function wrapGsap(value: unknown): unknown {
  const g = value as Record<string, unknown> | null
  if (!g || typeof g !== 'object' || wrapped.has(g)) return value
  wrapped.add(g)

  for (const method of ['to', 'from', 'set'] as const) {
    wrapCall(g, method, (args) => record(`gsap.${method}`, args[0], args[1]))
  }
  wrapCall(g, 'fromTo', (args) => record('gsap.fromTo', args[0], mergeFromTo(args[1], args[2])))
  wrapTimelineFactory(g)
  return value
}

// gsap.timeline() returns a Timeline; wrap that instance's own tween methods so
// children created via the timeline are recorded too. Per-instance shadowing —
// we never touch the shared Timeline prototype.
function wrapTimelineFactory(g: Record<string, unknown>): void {
  const original = g['timeline']
  if (typeof original !== 'function') return
  try {
    g['timeline'] = function (this: unknown, ...args: unknown[]) {
      const tl = (original as (...a: unknown[]) => unknown).apply(this, args)
      try {
        wrapTimelineInstance(tl)
      } catch {
        /* ignore */
      }
      return tl
    }
  } catch {
    /* method not writable — skip */
  }
}

function wrapTimelineInstance(tl: unknown): void {
  const timeline = tl as Record<string, unknown> | null
  if (!timeline || typeof timeline !== 'object' || wrapped.has(timeline)) return
  wrapped.add(timeline)
  for (const method of ['to', 'from', 'set'] as const) {
    wrapCall(timeline, method, (args) => record(`timeline.${method}`, args[0], args[1]))
  }
  wrapCall(timeline, 'fromTo', (args) =>
    record('timeline.fromTo', args[0], mergeFromTo(args[1], args[2])),
  )
}

// ---------------------------------------------------------------------------
// ScrollTrigger wrapping — static .create in place, constructor via a Proxy so
// `new ScrollTrigger(config)` is recorded too. Static props/instanceof forward
// to the real class through the proxy.
// ---------------------------------------------------------------------------

function wrapScrollTrigger(value: unknown): unknown {
  const ST = value as Record<string, unknown> | null
  if (!ST || typeof value !== 'function' || wrapped.has(ST)) return value
  wrapped.add(ST)

  wrapCall(ST, 'create', (args) => record('ScrollTrigger.create', triggerOf(args[0]), args[0]))

  try {
    return new Proxy(value as object, {
      construct(target, args, newTarget) {
        try {
          record('ScrollTrigger.new', triggerOf(args[0]), args[0])
        } catch {
          /* ignore */
        }
        return Reflect.construct(target as new () => object, args, newTarget)
      },
    })
  } catch {
    return value
  }
}

/** ScrollTrigger config → its trigger target (element or selector). */
function triggerOf(config: unknown): unknown {
  if (config && typeof config === 'object') {
    return (config as Record<string, unknown>)['trigger'] ?? null
  }
  return null
}

// ---------------------------------------------------------------------------
// Wrapper mechanics + recording.
// ---------------------------------------------------------------------------

/** Replace obj[method] with a recording wrapper that calls through unchanged. */
function wrapCall(
  obj: Record<string, unknown>,
  method: string,
  onCall: (args: unknown[]) => void,
): void {
  const original = obj[method]
  if (typeof original !== 'function') return
  try {
    obj[method] = function (this: unknown, ...args: unknown[]) {
      try {
        onCall(args)
      } catch {
        /* recording must never break the page */
      }
      return (original as (...a: unknown[]) => unknown).apply(this, args)
    }
  } catch {
    /* property not writable — leave the original in place */
  }
}

function record(method: string, target: unknown, vars: unknown): void {
  if (registry.length >= MAX_RECORDS) return
  const { elements, selectors, descriptors } = resolveTargets(target)
  registry.push({
    method,
    elements,
    selectors,
    descriptors: descriptors.length ? descriptors : ['(unknown target)'],
    vars: vars && typeof vars === 'object' ? (vars as Record<string, unknown>) : {},
    createdAt: nowMs(),
  })
}

// fromTo carries two vars objects; duration/ease/stagger can live in either, so
// merge them (destination wins) rather than lose the timing info.
function mergeFromTo(fromVars: unknown, toVars: unknown): Record<string, unknown> {
  const from = fromVars && typeof fromVars === 'object' ? (fromVars as Record<string, unknown>) : {}
  const to = toVars && typeof toVars === 'object' ? (toVars as Record<string, unknown>) : {}
  return { ...from, ...to, from: { ...from } }
}

// A GSAP target is a selector string, an Element, or an array/NodeList thereof.
function resolveTargets(target: unknown): {
  elements: Element[]
  selectors: string[]
  descriptors: string[]
} {
  const elements: Element[] = []
  const selectors: string[] = []
  const descriptors: string[] = []

  const visit = (t: unknown) => {
    if (t == null) return
    if (typeof t === 'string') {
      selectors.push(t)
      const found = querySafe(t)
      if (found.length) {
        for (const el of found) {
          elements.push(el)
          descriptors.push(describeNode(el))
        }
      } else {
        descriptors.push(t)
      }
      return
    }
    if (typeof Element !== 'undefined' && t instanceof Element) {
      elements.push(t)
      descriptors.push(describeNode(t))
      return
    }
    // Array / NodeList / HTMLCollection / iterable of the above.
    if (Array.isArray(t) || (typeof t === 'object' && Symbol.iterator in (t as object))) {
      try {
        for (const item of t as Iterable<unknown>) visit(item)
      } catch {
        /* not really iterable */
      }
    }
  }

  try {
    visit(target)
  } catch {
    /* ignore */
  }
  return { elements, selectors, descriptors }
}

function querySafe(selector: string): Element[] {
  try {
    return Array.from(document.querySelectorAll(selector))
  } catch {
    return []
  }
}

// Match a record against the current selection. Re-resolves string selectors now
// (the DOM has grown since creation) and unions with the live element refs.
function recordMatchesScope(record: RawRecord, scope: Scope): boolean {
  const els = [...record.elements]
  for (const selector of record.selectors) els.push(...querySafe(selector))
  if (els.length === 0) return false
  return els.some((el) => {
    if (scope === 'viewport') return intersectsViewport(el)
    return scope === el || scope.contains(el) || el.contains(scope)
  })
}

function safeVars(vars: Record<string, unknown>): Record<string, JsonValue> {
  const safe = toJsonSafe(vars)
  return typeof safe === 'object' && safe !== null && !Array.isArray(safe) ? safe : {}
}

function nowMs(): number {
  try {
    return Math.round(performance.now())
  } catch {
    return Date.now()
  }
}
