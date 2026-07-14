import {
  BRIDGE_SOURCE,
  type ExtractResponse,
  type RuntimePayload,
  type ScanResponse,
  type SelectedTarget,
} from '../lib/types'
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
import { scan } from './scan'

// MAIN-world entry. Sits passive and answers EXTRACT requests from the
// content script over window.postMessage. Never talks to chrome.* APIs and
// never sees the API key (architecture.md → invariants 1–4).

// Install the GSAP creation-time hook FIRST, synchronously on load. The MAIN
// script runs at document_start (manifest), so this beats the page's own GSAP
// calls and captures the original vars of tweens that finish before inspection.
installInstrumentation()

window.addEventListener('message', (event: MessageEvent) => {
  if (event.source !== window) return
  const data = event.data as {
    source?: unknown
    direction?: unknown
    type?: unknown
    requestId?: unknown
    target?: SelectedTarget
  } | null
  if (
    !data ||
    data.source !== BRIDGE_SOURCE ||
    data.direction !== 'to-injected' ||
    typeof data.requestId !== 'string'
  ) {
    return
  }
  if (data.type === 'EXTRACT' && data.target) {
    handleExtract(data.requestId, data.target)
  } else if (data.type === 'SCAN') {
    handleScan(data.requestId)
  }
})

function handleExtract(requestId: string, target: SelectedTarget): void {
  let payload: RuntimePayload | null = null
  let error: string | null = null
  try {
    payload = extract(target)
  } catch (err) {
    error = err instanceof Error ? err.message : 'extraction failed'
  }

  const response: ExtractResponse = {
    source: BRIDGE_SOURCE,
    direction: 'from-injected',
    type: 'EXTRACT_RESULT',
    requestId,
    payload,
    error,
  }
  window.postMessage(response, '*')
}

function handleScan(requestId: string): void {
  let items: ScanResponse['items'] = []
  let error: string | null = null
  try {
    items = scan()
  } catch (err) {
    error = err instanceof Error ? err.message : 'scan failed'
  }

  const response: ScanResponse = {
    source: BRIDGE_SOURCE,
    direction: 'from-injected',
    type: 'SCAN_RESULT',
    requestId,
    items,
    error,
  }
  window.postMessage(response, '*')
}

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
