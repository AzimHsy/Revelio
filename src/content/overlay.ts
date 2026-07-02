import { ACCENT } from '../lib/tokens'

// Highlight overlay drawn over the hovered element. This is the ONLY DOM the
// extension ever adds to the inspected page (architecture.md → invariant 5).

let box: HTMLDivElement | null = null

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
    document.documentElement.appendChild(box)
  }
  const r = el.getBoundingClientRect()
  Object.assign(box.style, {
    left: `${r.left}px`,
    top: `${r.top}px`,
    width: `${r.width}px`,
    height: `${r.height}px`,
  })
}

export function hideOverlay(): void {
  box?.remove()
  box = null
}
