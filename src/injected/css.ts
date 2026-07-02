import { describeNode, toJsonSafe } from '../lib/serialize'
import type { CssAnimationData } from '../lib/types'
import { intersectsViewport, type Scope } from './gsap'

// CSS animation/transition reader via getAnimations(), which returns resolved
// keyframes and timing even when the stylesheet itself is cross-origin.

const MAX_ANIMATIONS = 20

export function collectCssAnimations(scope: Scope): CssAnimationData[] {
  try {
    const animations =
      scope === 'viewport'
        ? document.getAnimations().filter((a) => {
            const target = effectTarget(a)
            return target !== null && intersectsViewport(target)
          })
        : scope.getAnimations({ subtree: true })
    return animations.slice(0, MAX_ANIMATIONS).map(serializeAnimation)
  } catch {
    return []
  }
}

function serializeAnimation(animation: Animation): CssAnimationData {
  const target = effectTarget(animation)
  const timing = safeTiming(animation)
  const isTransition = typeof CSSTransition !== 'undefined' && animation instanceof CSSTransition
  const isCssAnimation = typeof CSSAnimation !== 'undefined' && animation instanceof CSSAnimation

  let kind: CssAnimationData['kind'] = 'animation'
  let name = animation.id || '(waapi)'
  if (isTransition) {
    kind = 'transition'
    name = animation.transitionProperty
  } else if (isCssAnimation) {
    name = animation.animationName
  }

  return {
    kind,
    name,
    target: target ? describeNode(target) : '(unknown)',
    playState: animation.playState,
    durationMs: typeof timing?.duration === 'number' ? timing.duration : null,
    delayMs: typeof timing?.delay === 'number' ? timing.delay : null,
    easing: timing?.easing ?? null,
    iterations:
      typeof timing?.iterations === 'number' && Number.isFinite(timing.iterations)
        ? timing.iterations
        : null,
    direction: timing?.direction ?? null,
    fill: timing?.fill ?? null,
    keyframes: kind === 'animation' ? safeKeyframes(animation) : null,
  }
}

function effectTarget(animation: Animation): Element | null {
  const effect = animation.effect
  if (effect instanceof KeyframeEffect && effect.target instanceof Element) return effect.target
  return null
}

function safeTiming(animation: Animation): EffectTiming | null {
  try {
    return animation.effect?.getTiming() ?? null
  } catch {
    return null
  }
}

function safeKeyframes(animation: Animation) {
  try {
    const effect = animation.effect
    if (!(effect instanceof KeyframeEffect)) return null
    return toJsonSafe(effect.getKeyframes())
  } catch {
    return null
  }
}
