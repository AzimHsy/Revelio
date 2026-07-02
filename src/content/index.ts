import type { FromContentMessage, SelectedTarget, ToContentMessage } from '../lib/types'
import { startInspect, stopInspect } from './selection'

// Content script entry (isolated world). Handles selection + the capture
// shortcut and relays serialized data. Never reads page globals like
// window.gsap — that is the MAIN-world injected script's job (architecture.md).

function send(msg: FromContentMessage): void {
  chrome.runtime.sendMessage(msg).catch(() => {
    // No background listener yet (broker is a later unit) — visible in
    // DevTools for manual verification in the meantime.
    console.debug('[revelio] emitted (no listener yet):', msg)
  })
}

chrome.runtime.onMessage.addListener((raw: unknown) => {
  if (typeof raw !== 'object' || raw === null || !('type' in raw)) return
  const msg = raw as ToContentMessage
  switch (msg.type) {
    case 'START_INSPECT':
      startInspect(send)
      break
    case 'STOP_INSPECT':
      stopInspect({ cancelled: true })
      break
  }
})

// Ctrl+Shift+A: capture the current section. V1 decision: "current section" =
// the visible viewport bounds (see progress-tracker.md → Architecture Decisions).
document.addEventListener(
  'keydown',
  (event) => {
    if (event.ctrlKey && event.shiftKey && event.code === 'KeyA') {
      event.preventDefault()
      send({ type: 'SECTION_CAPTURED', target: captureViewport() })
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
    url: location.href,
  }
}
