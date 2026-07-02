import type { FromContentMessage, SelectedTarget, ToContentMessage } from '../lib/types'
import { requestExtraction } from './bridge'
import { handleKey, startInspect, stopInspect } from './selection'

// Content script entry (isolated world). Handles selection + the capture
// shortcut, asks the MAIN-world extractor for runtime data, and relays
// serialized JSON. Never reads page globals like window.gsap itself
// (architecture.md → invariant 1).

function send(msg: FromContentMessage): void {
  chrome.runtime.sendMessage(msg).catch(() => {
    // No background listener yet (broker is a later unit) — visible in
    // DevTools for manual verification in the meantime.
    console.debug('[revelio] emitted (no listener yet):', msg)
  })
}

// Selections get enriched with the extractor's runtime payload before relay.
function emit(msg: FromContentMessage): void {
  if (msg.type === 'ELEMENT_SELECTED' || msg.type === 'SECTION_CAPTURED') {
    void requestExtraction(msg.target).then((payload) => send({ ...msg, payload }))
    return
  }
  send(msg)
}

chrome.runtime.onMessage.addListener((raw: unknown) => {
  if (typeof raw !== 'object' || raw === null || !('type' in raw)) return
  const msg = raw as ToContentMessage
  switch (msg.type) {
    case 'START_INSPECT':
      startInspect(emit)
      break
    case 'STOP_INSPECT':
      stopInspect({ cancelled: true })
      break
    case 'INSPECT_KEY':
      // Traversal key relayed from the panel (which has keyboard focus).
      handleKey(msg.key)
      break
    case 'REPLAY_SCROLL':
      replayScroll(msg.selector)
      break
  }
})

// Re-fire a scroll-triggered animation: jump the element out of view, then
// smooth-scroll it back into the middle of the viewport.
function replayScroll(selector: string): void {
  let el: Element | null = null
  try {
    el = document.querySelector(selector)
  } catch {
    el = null
  }
  if (!el) return
  window.scrollTo({ top: 0, behavior: 'auto' })
  setTimeout(() => el?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 150)
}

// Ctrl+Shift+A: capture the current section. V1 decision: "current section" =
// the visible viewport bounds (see progress-tracker.md → Architecture Decisions).
document.addEventListener(
  'keydown',
  (event) => {
    if (event.ctrlKey && event.shiftKey && event.code === 'KeyA') {
      event.preventDefault()
      emit({ type: 'SECTION_CAPTURED', target: captureViewport(), payload: null })
    }
  },
  true,
)

function captureViewport(): SelectedTarget {
  return {
    kind: 'section',
    selector: null,
    tag: null,
    id: null,
    classes: [],
    rect: { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight },
    dpr: window.devicePixelRatio,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    url: location.href,
  }
}
