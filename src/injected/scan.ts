import type { JsonValue, ScanItem, ScanRecord, ScrollTriggerData } from '../lib/types'
import { collectCssAnimations } from './css'
import { collectScrollTriggers, collectTimelines, collectTweens } from './gsap'
import { collectHoverCandidates, collectInstrumented } from './instrument'

// Page scan (V2 Unit 2). Runs in the MAIN world — the only place allowed to read
// page globals (architecture.md → invariant 1). Merges every animation the page
// exposes into one deduped ScanItem[] so the panel can list them and the user
// picks from data instead of hit-testing the DOM. Pure JS, no network, no Claude
// call. Everything is viewport-scoped (a whole-page overview) and already
// serialized to plain JSON by the underlying collectors.

const MAX_ITEMS = 40
const SCOPE = 'viewport' as const

export function scan(): ScanItem[] {
  const items: ScanItem[] = []
  const seen = new Set<string>()
  let counter = 0

  // Registry first (creation-time SOURCE truth), then live, CSS, hover last, so
  // the most trustworthy rows surface at the top.
  const add = (target: string, kindGuess: string, record: ScanRecord): boolean => {
    const key = `${record.source}|${target}|${record.method}`
    if (!seen.has(key)) {
      seen.add(key)
      items.push({ id: `scan-${counter++}`, target, kindGuess, source: record.source, record })
    }
    return items.length < MAX_ITEMS
  }

  for (const rec of collectInstrumented(SCOPE)) {
    const record: ScanRecord = { source: 'registry', method: rec.method, targets: rec.targets, vars: rec.vars }
    if (!add(targetOf(rec.targets), guessKind(rec.method, rec.vars, null), record)) return items
  }

  for (const tween of collectTweens(SCOPE)) {
    const record: ScanRecord = { source: 'live', method: 'tween', targets: tween.targets, vars: tween.vars }
    if (!add(targetOf(tween.targets), guessKind('tween', tween.vars, null), record)) return items
  }

  for (const timeline of collectTimelines(SCOPE)) {
    const first = timeline.children[0]
    const targets = first?.targets ?? []
    const record: ScanRecord = { source: 'live', method: 'timeline', targets, vars: first?.vars ?? {} }
    if (!add(targetOf(targets, '(timeline)'), 'timeline', record)) return items
  }

  for (const st of collectScrollTriggers(SCOPE)) {
    const targets = st.trigger ? [st.trigger] : []
    const record: ScanRecord = { source: 'live', method: 'ScrollTrigger', targets, vars: {}, scrollTrigger: st }
    if (!add(targetOf(targets, '(scrolltrigger)'), guessKind('ScrollTrigger', {}, st), record)) return items
  }

  for (const css of collectCssAnimations(SCOPE)) {
    const record: ScanRecord = { source: 'css', method: `css-${css.kind}`, targets: [css.target], vars: {}, css }
    const kind = css.kind === 'transition' ? 'transition' : css.name || 'css'
    if (!add(css.target, kind, record)) return items
  }

  for (const hover of collectHoverCandidates(SCOPE)) {
    const record: ScanRecord = {
      source: 'hover?',
      method: 'hover',
      targets: [hover.target],
      vars: { trigger: hover.trigger, hoverSource: hover.source },
    }
    if (!add(hover.target, 'hover?', record)) return items
  }

  return items
}

function targetOf(targets: string[], fallback = '(unknown target)'): string {
  return targets[0] ?? fallback
}

// Cheap pre-classifier badge (the real classifier is Unit 3). Reads obvious
// signals off the vars / ScrollTrigger config; defaults to a plain "tween".
function guessKind(
  method: string,
  vars: Record<string, JsonValue>,
  st: ScrollTriggerData | null,
): string {
  if (st?.pin) return 'pinned scroll'
  if (st || vars['scrollTrigger']) return 'scroll'
  if (vars['stagger'] !== undefined) return 'stagger'
  if (vars['clipPath'] !== undefined || vars['clip-path'] !== undefined) return 'clip-path'
  if (method.includes('from')) return 'reveal'
  return 'tween'
}
