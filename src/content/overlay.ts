import { ACCENT } from '../lib/tokens'

// Highlight overlay drawn over the current target, with a DevTools-style label
// (tag#id.class · WxH) so you can see exactly what's targeted while walking the
// DOM. This is the ONLY DOM the extension ever adds to the inspected page
// (architecture.md → invariant 5).

let box: HTMLDivElement | null = null
let label: HTMLDivElement | null = null

export function showOverlay(el: Element): void {
  if (!box) {
    box = document.createElement('div')
    box.id = 'revelio-overlay'
    Object.assign(box.style, {
      position: 'fixed',
      pointerEvents: 'none',
      zIndex: '2147483647',
      border: `1.5px solid ${ACCENT}`,
      background: `${ACCENT}1f`,
      borderRadius: '2px',
      transition: 'left 40ms linear, top 40ms linear, width 40ms linear, height 40ms linear',
    })
    label = document.createElement('div')
    Object.assign(label.style, {
      position: 'absolute',
      left: '0',
      top: '0',
      transform: 'translateY(-100%)',
      maxWidth: '90vw',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      padding: '2px 6px',
      background: ACCENT,
      color: '#fff',
      font: '11px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace',
      borderRadius: '3px',
      boxSizing: 'border-box',
    })
    box.appendChild(label)
    document.documentElement.appendChild(box)
  }
  const r = el.getBoundingClientRect()
  Object.assign(box.style, {
    left: `${r.left}px`,
    top: `${r.top}px`,
    width: `${r.width}px`,
    height: `${r.height}px`,
  })
  if (label) label.textContent = describeForLabel(el, r)
}

export function hideOverlay(): void {
  box?.remove()
  box = null
  label = null
}

// Short human descriptor for the label — tag, first id/class, and rendered size.
function describeForLabel(el: Element, r: DOMRect): string {
  const tag = el.tagName.toLowerCase()
  const id = el.id ? `#${el.id}` : ''
  const cls = el.classList[0] ? `.${el.classList[0]}` : ''
  return `${tag}${id}${cls} · ${Math.round(r.width)}×${Math.round(r.height)}`
}
