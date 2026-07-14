import { BRIDGE_SOURCE, type ExtractRequest, type ExtractResponse, type RuntimePayload, type SelectedTarget } from '../lib/types'
import { collectCssAnimations } from './css'
import {
  collectScrollTriggers,
  collectTimelines,
  collectTweens,
  getGsapVersion,
  isSplitTextPresent,
  type Scope,
} from './gsap'
import { collectHoverCandidates, collectInstrumented, installInstrumentation } from './instrument'

// MAIN-world entry. Sits passive and answers EXTRACT requests from the
// content script over window.postMessage. Never talks to chrome.* APIs and
// never sees the API key (architecture.md → invariants 1–4).

// Install the GSAP creation-time hook FIRST, synchronously on load. The MAIN
// script runs at document_start (manifest), so this beats the page's own GSAP
// calls and captures the original vars of tweens that finish before inspection.
installInstrumentation()

window.addEventListener('message', (event: MessageEvent) => {
  if (event.source !== window) return
  const data = event.data as Partial<ExtractRequest> | null
  if (
    !data ||
    data.source !== BRIDGE_SOURCE ||
    data.direction !== 'to-injected' ||
    data.type !== 'EXTRACT' ||
    typeof data.requestId !== 'string' ||
    !data.target
  ) {
    return
  }

  let payload: RuntimePayload | null = null
  let error: string | null = null
  try {
    payload = extract(data.target)
  } catch (err) {
    error = err instanceof Error ? err.message : 'extraction failed'
  }

  const response: ExtractResponse = {
    source: BRIDGE_SOURCE,
    direction: 'from-injected',
    type: 'EXTRACT_RESULT',
    requestId: data.requestId,
    payload,
    error,
  }
  window.postMessage(response, '*')
})

function extract(target: SelectedTarget): RuntimePayload {
  let scope: Scope = 'viewport'
  let clipPath: string | null = null

  if (target.kind === 'element') {
    const el = target.selector ? document.querySelector(target.selector) : null
    if (!el) throw new Error(`selected element not found: ${target.selector ?? '(no selector)'}`)
    scope = el
    const computed = getComputedStyle(el).clipPath
    clipPath = computed && computed !== 'none' ? computed : null
  }

  return {
    gsapVersion: getGsapVersion(),
    splitTextPresent: isSplitTextPresent(),
    clipPath,
    tweens: collectTweens(scope),
    timelines: collectTimelines(scope),
    scrollTriggers: collectScrollTriggers(scope),
    cssAnimations: collectCssAnimations(scope),
    // Creation-time records whose targets match the selection (enhancement 2).
    instrumented: collectInstrumented(scope),
    // Where to hover to trigger not-yet-registered animations (V2 Unit 1).
    hoverCandidates: collectHoverCandidates(scope),
  }
}
