import type { FromContentMessage, SelectedTarget } from '../lib/types'
import { hideOverlay, showOverlay } from './overlay'

// Click-to-select inspection mode: hover highlights the element under the
// cursor, click selects it, Escape cancels. Listeners run in the capture
// phase so the selecting click never reaches the page.

type Emit = (msg: FromContentMessage) => void

let active = false
let emit: Emit | null = null

export function isInspecting(): boolean {
  return active
}

export function startInspect(send: Emit): void {
  if (active) return
  active = true
  emit = send
  document.addEventListener('mouseover', onMouseOver, true)
  document.addEventListener('click', onClick, true)
  document.addEventListener('keydown', onKeyDown, true)
  send({ type: 'INSPECT_STARTED' })
}

export function stopInspect(options: { cancelled: boolean }): void {
  if (!active) return
  const send = emit
  active = false
  emit = null
  document.removeEventListener('mouseover', onMouseOver, true)
  document.removeEventListener('click', onClick, true)
  document.removeEventListener('keydown', onKeyDown, true)
  hideOverlay()
  if (options.cancelled) send?.({ type: 'INSPECT_CANCELLED' })
}

function onMouseOver(event: MouseEvent): void {
  const el = event.target
  if (el instanceof Element && el.id !== 'revelio-overlay') showOverlay(el)
}

function onClick(event: MouseEvent): void {
  const el = event.target
  if (!(el instanceof Element)) return
  event.preventDefault()
  event.stopPropagation()
  const send = emit
  const target = describeElement(el)
  stopInspect({ cancelled: false })
  // payload is filled in by the entry module (extraction bridge) before relay.
  send?.({ type: 'ELEMENT_SELECTED', target, payload: null })
}

function onKeyDown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    stopInspect({ cancelled: true })
  }
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
