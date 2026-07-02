import type { FromContentMessage, SelectedTarget } from '../lib/types'
import { serializeElement } from './clone'
import { hideOverlay, showOverlay } from './overlay'

// Click-to-select inspection mode with a steerable "current target": hover sets
// the target, but the keyboard can walk the DOM from there — ArrowUp/Down =
// parent/child, ArrowLeft/Right = siblings — so containers that intercept the
// hover (overlays, full-bleed <a> wrappers) no longer trap you. Enter (or click)
// selects the current target; Escape cancels. Listeners run in the capture phase
// so the selecting click never reaches the page.

type Emit = (msg: FromContentMessage) => void

let active = false
let emit: Emit | null = null
// The element currently targeted (highlighted). Hover sets it; the arrow keys
// walk the DOM from it; Enter/click selects it.
let current: Element | null = null
// Last known cursor position — the anchor for z-stack piercing.
const pointer = { x: 0, y: 0 }
// Depth into the stack of elements under the cursor (0 = topmost). `[`/`]` step
// through it so a covering container no longer blocks the element beneath.
let stackIndex = 0

export function isInspecting(): boolean {
  return active
}

export function startInspect(send: Emit): void {
  if (active) return
  active = true
  emit = send
  current = null
  document.addEventListener('mouseover', onMouseOver, true)
  document.addEventListener('mousemove', onMouseMove, true)
  document.addEventListener('click', onClick, true)
  document.addEventListener('keydown', onKeyDown, true)
  send({ type: 'INSPECT_STARTED' })
}

export function stopInspect(options: { cancelled: boolean }): void {
  if (!active) return
  const send = emit
  active = false
  emit = null
  current = null
  document.removeEventListener('mouseover', onMouseOver, true)
  document.removeEventListener('mousemove', onMouseMove, true)
  document.removeEventListener('click', onClick, true)
  document.removeEventListener('keydown', onKeyDown, true)
  hideOverlay()
  if (options.cancelled) send?.({ type: 'INSPECT_CANCELLED' })
}

// Set + highlight the current target. Ignores our own overlay node.
function setCurrent(el: Element | null): void {
  if (!el || el.id === 'revelio-overlay') return
  current = el
  showOverlay(el)
}

function onMouseMove(event: MouseEvent): void {
  pointer.x = event.clientX
  pointer.y = event.clientY
  // A fresh cursor position restarts z-stack cycling from the top.
  stackIndex = 0
}

function onMouseOver(event: MouseEvent): void {
  if (event.target instanceof Element) setCurrent(event.target)
}

function onClick(event: MouseEvent): void {
  event.preventDefault()
  event.stopPropagation()
  if (event.target instanceof Element) setCurrent(event.target)
  selectCurrent()
}

function onKeyDown(event: KeyboardEvent): void {
  switch (event.key) {
    case 'Escape':
      stop(event, () => stopInspect({ cancelled: true }))
      break
    case 'Enter':
      stop(event, selectCurrent)
      break
    case 'ArrowUp':
      stop(event, () => traverse((el) => el.parentElement))
      break
    case 'ArrowDown':
      stop(event, () => traverse((el) => el.firstElementChild))
      break
    case 'ArrowLeft':
      stop(event, () => traverse((el) => el.previousElementSibling))
      break
    case 'ArrowRight':
      stop(event, () => traverse((el) => el.nextElementSibling))
      break
    // Pierce the z-stack: reach elements stacked under the cursor (past a
    // covering container). `]`/PageDown go deeper, `[`/PageUp back toward the top.
    case ']':
    case 'PageDown':
      stop(event, () => cycleStack(1))
      break
    case '[':
    case 'PageUp':
      stop(event, () => cycleStack(-1))
      break
  }
}

function cycleStack(dir: 1 | -1): void {
  const stack = document
    .elementsFromPoint(pointer.x, pointer.y)
    .filter((el) => el.id !== 'revelio-overlay')
  if (stack.length === 0) return
  stackIndex = Math.max(0, Math.min(stack.length - 1, stackIndex + dir))
  setCurrent(stack[stackIndex])
}

// Consume the event (so arrows don't scroll the page / Enter doesn't submit)
// then run the action.
function stop(event: Event, action: () => void): void {
  event.preventDefault()
  event.stopPropagation()
  action()
}

function traverse(step: (el: Element) => Element | null): void {
  if (!current) return
  const next = step(current)
  // Don't climb into <html> or onto our own overlay.
  if (next && next !== document.documentElement && next.id !== 'revelio-overlay') {
    setCurrent(next)
  }
}

function selectCurrent(): void {
  if (!current) return
  const target = describeElement(current)
  // Serialize the element's real design NOW, before we tear down inspect mode —
  // the sandbox preview reproduces it (best-effort; null if too large/failed).
  const clone = serializeElement(current)
  const send = emit
  stopInspect({ cancelled: false })
  // payload is filled in by the entry module (extraction bridge) before relay.
  send?.({ type: 'ELEMENT_SELECTED', target, payload: null, clone })
}

export function describeElement(el: Element): SelectedTarget {
  const rect = el.getBoundingClientRect()
  return {
    kind: 'element',
    selector: buildSelector(el),
    tag: el.tagName.toLowerCase(),
    id: el.id || null,
    classes: [...el.classList],
    rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
    dpr: window.devicePixelRatio,
    url: location.href,
  }
}

// Best-effort selector: prefer a unique #id anywhere in the ancestor chain,
// otherwise a short tag.class:nth-of-type path (max 4 levels).
function buildSelector(el: Element): string {
  const parts: string[] = []
  let node: Element | null = el
  while (node && node !== document.documentElement && parts.length < 4) {
    if (node.id) {
      parts.unshift(`#${CSS.escape(node.id)}`)
      break
    }
    let part = node.tagName.toLowerCase()
    const firstClass = node.classList[0]
    if (firstClass) part += `.${CSS.escape(firstClass)}`
    const parent: Element | null = node.parentElement
    if (parent) {
      const sameTag = [...parent.children].filter((c) => c.tagName === node!.tagName)
      if (sameTag.length > 1) part += `:nth-of-type(${sameTag.indexOf(node) + 1})`
    }
    parts.unshift(part)
    node = parent
  }
  return parts.join(' > ')
}
