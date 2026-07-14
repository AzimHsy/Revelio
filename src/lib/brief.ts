import type {
  AnalysisParameter,
  AnalysisResult,
  JsonValue,
  ParameterLabel,
  ScanItem,
  ScanRecord,
} from './types'

// Tier 1 template brief (V2 Unit 3). Turns a classified scan item into the
// existing AnalysisResult shape — so ResultView + history render it unchanged —
// but tagged `tier:'rules'`, with the real captured parameters and, per the
// brief, the paste-ready prompt in the `gsapCode` field (Unit 4 presents it as
// the Prompt). Deterministic + offline: no model call, so captured values are
// SOURCE truth and inferred defaults are labelled GUESS.

type Interaction = 'scroll' | 'hover' | 'click' | 'time'

export function buildBrief(item: ScanItem, slug: string): AnalysisResult {
  const interaction = interactionModel(item.record)
  const parameters = extractParameters(item.record)
  const explanation = `Interaction model: ${interaction}. ${explanationFor(slug)}`
  const prompt = buildPrompt(slug, item.target, interaction, parameters)
  return {
    concept: slug,
    explanation,
    gsapCode: prompt,
    parameters,
    previewCode: '',
    tier: 'rules',
  }
}

function interactionModel(record: ScanRecord): Interaction {
  if (record.scrollTrigger || record.vars['scrollTrigger']) return 'scroll'
  if (record.source === 'hover?' || record.method === 'hover') return 'hover'
  return 'time'
}

function extractParameters(record: ScanRecord): AnalysisParameter[] {
  const params: AnalysisParameter[] = []
  // Registry/live vars are the site's real values; hover?/css-inferred are guesses.
  const varsLabel: ParameterLabel =
    record.source === 'registry' || record.source === 'live' ? 'SOURCE' : 'GUESS'
  const v = record.vars

  addParam(params, 'ease', v['ease'], varsLabel, 'Easing curve of the tween')
  addParam(params, 'duration', v['duration'], varsLabel, 'Tween duration (seconds)')
  addParam(params, 'delay', v['delay'], varsLabel, 'Delay before the tween starts')
  addParam(params, 'stagger', v['stagger'], varsLabel, 'Delay between staggered targets')

  const st = record.scrollTrigger
  if (st) {
    addParam(params, 'start', st.start, 'SOURCE', 'ScrollTrigger start position')
    addParam(params, 'end', st.end, 'SOURCE', 'ScrollTrigger end position')
    addParam(params, 'scrub', st.scrub, 'SOURCE', 'Whether progress is tied to scroll')
    if (st.pin) addParam(params, 'pin', st.pin, 'SOURCE', 'Pins the trigger while scrubbing')
  }

  const css = record.css
  if (css) {
    addParam(
      params,
      'duration',
      css.durationMs != null ? `${css.durationMs}ms` : undefined,
      'SOURCE',
      'CSS animation/transition duration',
    )
    addParam(params, 'easing', css.easing ?? undefined, 'SOURCE', 'CSS timing function')
  }

  return params
}

function addParam(
  out: AnalysisParameter[],
  name: string,
  value: JsonValue | string | undefined,
  label: ParameterLabel,
  description: string,
): void {
  if (value === undefined || value === null || value === '') return
  if (out.some((p) => p.name === name)) return // don't duplicate (e.g. vars + css duration)
  out.push({ name, value: formatValue(value), label, description })
}

function formatValue(value: JsonValue | string): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

// The paste-ready prompt (the actual product for a rules-tier brief). Filled from
// the template in the enhancement brief; every parameter here is captured, not
// invented, so the dev's own agent recreates the real technique.
function buildPrompt(
  slug: string,
  target: string,
  interaction: Interaction,
  params: AnalysisParameter[],
): string {
  const paramLine = params.length
    ? params.map((p) => `${p.name} ${p.value}`).join(' · ')
    : 'none captured — infer sensible defaults'
  return [
    `Recreate a ${slug} animation on ${target}.`,
    `Interaction: ${interaction}.`,
    `Use GSAP. Parameters captured from the original site's runtime:`,
    paramLine,
    `Structure: ${structureFor(slug)}.`,
    `Adapt selectors to my codebase.`,
  ].join('\n')
}

const EXPLANATIONS: Record<string, string> = {
  'pinned-scroll': 'The section is pinned in place while its content animates against scroll progress.',
  'scroll-scrub': 'Animation progress is tied directly to the scrollbar (scrubbed), not played on a timer.',
  'split-text-chars': 'Text is split into per-character elements that reveal in a staggered sequence.',
  'stagger-reveal': 'A set of elements animate in one after another with a fixed stagger.',
  'clip-path-wipe': 'The element is revealed by animating its clip-path from a hidden to a full shape.',
  'fade-up-on-enter': 'Elements fade and translate upward into place as they scroll into view.',
  'marquee-loop': 'A row of content drifts horizontally in a seamless infinite loop.',
  'hover-scale': 'The element scales (and usually eases) on hover, returning to rest on mouse-out.',
}

function explanationFor(slug: string): string {
  return EXPLANATIONS[slug] ?? 'Recreated from the animation captured on the original site.'
}

const STRUCTURES: Record<string, string> = {
  'pinned-scroll': 'pin the container, then drive its inner elements across the pinned scroll range',
  'scroll-scrub': "a timeline scrubbed across the trigger's scroll range",
  'split-text-chars': 'split the text into characters, then stagger each one in',
  'stagger-reveal': 'animate the group in sequence with a stagger',
  'clip-path-wipe': 'animate clip-path from hidden to fully revealed',
  'fade-up-on-enter': 'each element starts translated-down and transparent, then settles as it enters',
  'marquee-loop': 'duplicate the row and translate it continuously with repeat: -1',
  'hover-scale': 'scale up on mouseenter, scale back on mouseleave',
}

function structureFor(slug: string): string {
  return STRUCTURES[slug] ?? 'the captured target(s) animate together'
}
