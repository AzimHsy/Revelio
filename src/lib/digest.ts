import type {
  CssAnimationData,
  InstrumentedRecord,
  JsonValue,
  RuntimePayload,
  TimelineData,
  TweenData,
} from './types'

// Builds a small, representative sample of the runtime payload to send to
// Claude. The full capture can be huge — 10 timelines × 20 child tweens, or a
// SplitText tween targeting 100+ characters — which is slow and expensive to
// send in full (and adds nothing: the technique is identifiable from a handful
// of representative tweens plus the true counts). code-standards.md → "keep
// only what's needed". The UI still shows the full counts from the raw payload;
// only what we hand to the model is trimmed.

const SAMPLE = {
  tweens: 8,
  timelines: 4,
  timelineChildren: 5,
  scrollTriggers: 5,
  cssAnimations: 5,
  instrumented: 12,
  targetsPerTween: 6,
  keyframes: 3,
}

export interface PayloadDigest {
  gsapVersion: string | null
  splitTextPresent: boolean
  clipPath: string | null
  /** True totals so the model knows the real scale behind the sample. */
  counts: { tweens: number; timelines: number; scrollTriggers: number; cssAnimations: number }
  tweens: TweenData[]
  timelines: TimelineData[]
  scrollTriggers: RuntimePayload['scrollTriggers']
  cssAnimations: CssAnimationData[]
  /**
   * Creation-time GSAP calls captured by the load-time hook (enhancement 2).
   * These are the ORIGINAL vars the page passed in — treat their values as
   * SOURCE-grade truth (label them SOURCE), even for tweens that had finished.
   */
  instrumented: InstrumentedRecord[]
}

export function digestForPrompt(payload: RuntimePayload): PayloadDigest {
  return {
    gsapVersion: payload.gsapVersion,
    splitTextPresent: payload.splitTextPresent,
    clipPath: payload.clipPath,
    counts: {
      tweens: payload.tweens.length,
      timelines: payload.timelines.length,
      scrollTriggers: payload.scrollTriggers.length,
      cssAnimations: payload.cssAnimations.length,
    },
    tweens: payload.tweens.slice(0, SAMPLE.tweens).map(trimTween),
    timelines: payload.timelines.slice(0, SAMPLE.timelines).map((timeline) => ({
      ...timeline,
      children: timeline.children.slice(0, SAMPLE.timelineChildren).map(trimTween),
    })),
    scrollTriggers: payload.scrollTriggers.slice(0, SAMPLE.scrollTriggers),
    cssAnimations: payload.cssAnimations.slice(0, SAMPLE.cssAnimations).map((animation) => ({
      ...animation,
      keyframes: trimKeyframes(animation.keyframes),
    })),
    instrumented: (payload.instrumented ?? []).slice(0, SAMPLE.instrumented),
  }
}

// A SplitText/stagger tween can list every character as a target — keep only a
// few, and record how many were dropped so the stagger scale stays legible.
function trimTween(tween: TweenData): TweenData {
  if (tween.targets.length <= SAMPLE.targetsPerTween) return tween
  const kept = tween.targets.slice(0, SAMPLE.targetsPerTween)
  kept.push(`…+${tween.targets.length - SAMPLE.targetsPerTween} more`)
  return { ...tween, targets: kept }
}

function trimKeyframes(keyframes: JsonValue | null): JsonValue | null {
  if (!Array.isArray(keyframes) || keyframes.length <= SAMPLE.keyframes) return keyframes
  return [keyframes[0], `…${keyframes.length - 2} more…`, keyframes[keyframes.length - 1]]
}
