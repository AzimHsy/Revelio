import { CONCEPT_VOCABULARY } from './prompt'
import type { JsonValue, ScanRecord, ScrollTriggerData } from './types'

// Tier 1 rule classifier (V2 Unit 3). Maps a scanned animation's runtime
// signature to a concept slug from the ONE controlled vocabulary (imported from
// prompt.ts — never a second copy). Deterministic + offline: no model, so it
// cannot hallucinate, and every value the brief then surfaces is real. Compound
// or unmatched cases return `unclassified` and are left to Tier 2 (Deep analyse,
// Unit 5). Rules are intentionally easy to extend as new signatures recur.

export const UNCLASSIFIED = 'unclassified'

export interface Classification {
  /** A CONCEPT_VOCABULARY slug, or UNCLASSIFIED. */
  slug: string
  /** Rough 0..1 confidence; low/none → prefer Deep analyse. */
  confidence: number
}

const VOCAB = new Set<string>(CONCEPT_VOCABULARY)

export function classify(record: ScanRecord): Classification {
  const result = match(record)
  // Guard: never emit a slug outside the shared vocabulary.
  if (result.slug !== UNCLASSIFIED && !VOCAB.has(result.slug)) {
    return { slug: UNCLASSIFIED, confidence: 0 }
  }
  return result
}

// First match wins; order matters (the interaction model dominates the concept).
function match(record: ScanRecord): Classification {
  const vars = record.vars
  const st = record.scrollTrigger ?? scrollTriggerFromVars(vars['scrollTrigger'])

  // Scroll-driven signatures.
  if (st) {
    if (st.pin) return { slug: 'pinned-scroll', confidence: 0.9 }
    if (isSet(st.scrub)) return { slug: 'scroll-scrub', confidence: 0.85 }
    if (has(vars, 'y') || has(vars, 'opacity') || has(vars, 'autoAlpha')) {
      return { slug: 'fade-up-on-enter', confidence: 0.75 }
    }
    return { slug: 'scroll-scrub', confidence: 0.5 }
  }

  // clip-path reveal.
  if (has(vars, 'clipPath') || has(vars, 'clip-path') || has(vars, 'webkitClipPath')) {
    return { slug: 'clip-path-wipe', confidence: 0.8 }
  }

  // Stagger → split-text vs a generic group reveal, by how many targets move.
  if (has(vars, 'stagger')) {
    if (looksLikeChars(record.targets)) return { slug: 'split-text-chars', confidence: 0.7 }
    return { slug: 'stagger-reveal', confidence: 0.7 }
  }

  // Looping horizontal drift → marquee.
  if (isInfiniteRepeat(vars) && (has(vars, 'x') || has(vars, 'xPercent'))) {
    return { slug: 'marquee-loop', confidence: 0.75 }
  }

  // Hover-driven.
  if (record.source === 'hover?' || record.method === 'hover') {
    const scaled = has(vars, 'scale') || has(vars, 'scaleX') || has(vars, 'scaleY')
    return { slug: 'hover-scale', confidence: scaled ? 0.75 : 0.5 }
  }
  if (has(vars, 'scale') && !has(vars, 'stagger')) {
    // A lone scale tween is most often a hover-scale on a card/button.
    return { slug: 'hover-scale', confidence: 0.45 }
  }

  return { slug: UNCLASSIFIED, confidence: 0 }
}

function has(vars: Record<string, JsonValue>, key: string): boolean {
  return vars[key] !== undefined && vars[key] !== null
}

function isSet(value: JsonValue | undefined): boolean {
  return value !== undefined && value !== null && value !== false
}

function isInfiniteRepeat(vars: Record<string, JsonValue>): boolean {
  return vars['repeat'] === -1
}

// A stagger over many uniform targets (or char/word/line-named ones) is split-text.
function looksLikeChars(targets: string[]): boolean {
  if (targets.length >= 8) return true
  return targets.some((t) => /char|letter|word|split|line/i.test(t))
}

// A tween may carry its ScrollTrigger inline as a vars object; derive the bits
// the classifier needs (pin/scrub) from it when there's no live trigger record.
function scrollTriggerFromVars(value: JsonValue | undefined): ScrollTriggerData | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const o = value as Record<string, JsonValue>
  return {
    trigger: null,
    start: typeof o['start'] === 'number' ? o['start'] : null,
    end: typeof o['end'] === 'number' ? o['end'] : null,
    scrub: o['scrub'] ?? null,
    pin: o['pin'] === true,
    progress: 0,
    isActive: false,
  }
}
