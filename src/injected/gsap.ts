import { describeNode, toJsonSafe } from '../lib/serialize'
import type { ScrollTriggerData, TimelineData, TweenData } from '../lib/types'

// GSAP / ScrollTrigger readers. This module runs in the MAIN world — the only
// place allowed to touch page globals (architecture.md → invariant 1). The
// page is untrusted input: every access is guarded and every output is
// serialized to plain JSON before it leaves this world.

const MAX_TWEENS = 30
const MAX_TIMELINES = 10
const MAX_TIMELINE_CHILDREN = 20
const MAX_SCROLL_TRIGGERS = 20

/** Extraction scope: a selected element, or the visible viewport. */
export type Scope = Element | 'viewport'

interface TweenLike {
  vars?: Record<string, unknown>
  targets?: () => unknown[]
  duration?: () => number
  progress?: () => number
  isActive?: () => boolean
}

interface TimelineLike extends TweenLike {
  labels?: Record<string, number>
  getChildren?: (nested?: boolean, tweens?: boolean, timelines?: boolean) => unknown[]
}

interface ScrollTriggerInstance {
  trigger?: unknown
  start?: unknown
  end?: unknown
  progress?: unknown
  isActive?: unknown
  vars?: Record<string, unknown>
}

interface PageGlobals {
  gsap?: { version?: string; globalTimeline?: TimelineLike }
  ScrollTrigger?: { getAll?: () => ScrollTriggerInstance[] }
  SplitText?: unknown
}

const page = window as PageGlobals & Window

export function getGsapVersion(): string | null {
  return typeof page.gsap?.version === 'string' ? page.gsap.version : null
}

export function isSplitTextPresent(): boolean {
  return page.SplitText !== undefined
}

export function collectTweens(scope: Scope): TweenData[] {
  return allTweens()
    .filter((tween) => tweenMatchesScope(tween, scope))
    .slice(0, MAX_TWEENS)
    .map(serializeTween)
}

export function collectTimelines(scope: Scope): TimelineData[] {
  const timelines: TimelineData[] = []
  try {
    const children = page.gsap?.globalTimeline?.getChildren?.(true, false, true) ?? []
    for (const child of children) {
      if (timelines.length >= MAX_TIMELINES) break
      const timeline = child as TimelineLike
      const tweens = (timeline.getChildren?.(true, true, false) ?? []) as TweenLike[]
      const matched = tweens.filter((tween) => tweenMatchesScope(tween, scope))
      if (matched.length === 0) continue
      timelines.push({
        labels: safeLabels(timeline),
        duration: safeNumber(() => timeline.duration?.()),
        progress: safeNumber(() => timeline.progress?.()),
        children: matched.slice(0, MAX_TIMELINE_CHILDREN).map(serializeTween),
      })
    }
  } catch {
    // GSAP internals moved under us — return what we have.
  }
  return timelines
}

export function collectScrollTriggers(scope: Scope): ScrollTriggerData[] {
  try {
    const all = page.ScrollTrigger?.getAll?.() ?? []
    return all
      .filter((st) => scrollTriggerMatchesScope(st, scope))
      .slice(0, MAX_SCROLL_TRIGGERS)
      .map((st) => ({
        trigger: st.trigger instanceof Element ? describeNode(st.trigger) : null,
        start: typeof st.start === 'number' ? st.start : null,
        end: typeof st.end === 'number' ? st.end : null,
        scrub: toJsonSafe(st.vars?.['scrub']),
        pin: Boolean(st.vars?.['pin']),
        progress: typeof st.progress === 'number' ? st.progress : 0,
        isActive: st.isActive === true,
      }))
  } catch {
    return []
  }
}

function allTweens(): TweenLike[] {
  try {
    return (page.gsap?.globalTimeline?.getChildren?.(true, true, false) ?? []) as TweenLike[]
  } catch {
    return []
  }
}

function tweenMatchesScope(tween: TweenLike, scope: Scope): boolean {
  const targets = safeTargets(tween)
  return targets.some((target) => {
    if (!(target instanceof Element)) return false
    if (scope === 'viewport') return intersectsViewport(target)
    return scope === target || scope.contains(target) || target.contains(scope)
  })
}

function scrollTriggerMatchesScope(st: ScrollTriggerInstance, scope: Scope): boolean {
  if (!(st.trigger instanceof Element)) return false
  if (scope === 'viewport') return intersectsViewport(st.trigger)
  return scope === st.trigger || scope.contains(st.trigger) || st.trigger.contains(scope)
}

function serializeTween(tween: TweenLike): TweenData {
  const varsSafe = toJsonSafe(tween.vars ?? {})
  return {
    targets: safeTargets(tween).map((t) => (t instanceof Element ? describeNode(t) : String(t))),
    vars: typeof varsSafe === 'object' && varsSafe !== null && !Array.isArray(varsSafe) ? varsSafe : {},
    duration: safeNumber(() => tween.duration?.()),
    progress: safeNumber(() => tween.progress?.()),
    isActive: safeBoolean(() => tween.isActive?.()),
  }
}

function safeTargets(tween: TweenLike): unknown[] {
  try {
    return tween.targets?.() ?? []
  } catch {
    return []
  }
}

function safeLabels(timeline: TimelineLike): Record<string, number> {
  const out: Record<string, number> = {}
  const labels = timeline.labels
  if (labels && typeof labels === 'object') {
    for (const [key, value] of Object.entries(labels)) {
      if (typeof value === 'number') out[key] = value
    }
  }
  return out
}

function safeNumber(read: () => number | undefined): number {
  try {
    const value = read()
    return typeof value === 'number' && Number.isFinite(value) ? value : 0
  } catch {
    return 0
  }
}

function safeBoolean(read: () => boolean | undefined): boolean {
  try {
    return read() === true
  } catch {
    return false
  }
}

export function intersectsViewport(el: Element): boolean {
  const rect = el.getBoundingClientRect()
  return (
    rect.bottom > 0 && rect.top < window.innerHeight && rect.right > 0 && rect.left < window.innerWidth
  )
}
