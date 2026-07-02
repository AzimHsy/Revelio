import type { ElementClone } from '../lib/types'

// Serializes an inspected element into self-contained HTML: a deep clone with
// each node's computed style baked inline, so it renders faithfully inside the
// sandbox preview WITHOUT the page's stylesheets. Runs in the isolated content
// world (full DOM + getComputedStyle; no page globals needed). Best-effort and
// capped — returns null on any failure or if the result is too large. Classes
// and ids are preserved so the generated preview code can target real selectors.

const MAX_NODES = 500
const MAX_DEPTH = 14
const MAX_HTML_BYTES = 300_000

const UNSAFE_TAGS = new Set(['SCRIPT', 'STYLE', 'LINK', 'META', 'NOSCRIPT', 'IFRAME', 'OBJECT', 'EMBED'])

// Curated visual properties — enough for faithful static rendering without the
// ~300-property full computed style (which would bloat every node). `transition`
// and `animation` are intentionally excluded so GSAP alone drives the motion.
const PROPS = [
  'display', 'box-sizing', 'position', 'top', 'right', 'bottom', 'left', 'z-index', 'float', 'clear',
  'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height',
  'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
  'border-top-style', 'border-right-style', 'border-bottom-style', 'border-left-style',
  'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color',
  'border-top-left-radius', 'border-top-right-radius', 'border-bottom-right-radius', 'border-bottom-left-radius',
  'overflow-x', 'overflow-y',
  'flex-direction', 'flex-wrap', 'flex-grow', 'flex-shrink', 'flex-basis', 'order',
  'justify-content', 'align-items', 'align-self', 'align-content', 'row-gap', 'column-gap',
  'grid-template-columns', 'grid-template-rows', 'grid-template-areas', 'grid-auto-flow',
  'grid-auto-columns', 'grid-auto-rows', 'grid-column', 'grid-row',
  'font-family', 'font-size', 'font-weight', 'font-style', 'font-variant', 'line-height',
  'letter-spacing', 'word-spacing',
  'text-align', 'text-transform', 'text-decoration', 'text-indent', 'text-shadow', 'white-space',
  'word-break', 'overflow-wrap', 'vertical-align',
  'color', 'opacity', 'visibility',
  'background-color', 'background-image', 'background-size', 'background-position',
  'background-repeat', 'background-origin', 'background-clip', 'background-attachment',
  'box-shadow', 'filter', 'backdrop-filter', 'mix-blend-mode', 'clip-path',
  '-webkit-clip-path', '-webkit-background-clip', '-webkit-text-fill-color',
  'transform', 'transform-origin', 'perspective', 'perspective-origin', 'transform-style',
  'backface-visibility',
  'object-fit', 'object-position', 'aspect-ratio',
  'list-style', 'cursor', 'pointer-events', 'writing-mode', 'direction',
]

export function serializeElement(el: Element): ElementClone | null {
  try {
    const rect = el.getBoundingClientRect()
    if (rect.width < 1 || rect.height < 1) return null
    const clone = el.cloneNode(true) as Element
    bake(el, clone, 0, { n: MAX_NODES })
    const html = clone.outerHTML
    if (html.length > MAX_HTML_BYTES) return null
    return { html, width: Math.round(rect.width), height: Math.round(rect.height) }
  } catch {
    return null
  }
}

function bake(orig: Element, clone: Element, depth: number, budget: { n: number }): void {
  budget.n--
  applyInlineStyle(orig, clone)
  stripUnsafeAttributes(clone)
  if (orig instanceof HTMLImageElement && clone instanceof HTMLImageElement) {
    // Absolute URL so it resolves in the sandbox's opaque origin; drop srcset
    // (relative candidates wouldn't resolve there).
    clone.setAttribute('src', orig.currentSrc || orig.src)
    clone.removeAttribute('srcset')
  }
  const origKids = Array.from(orig.children)
  const cloneKids = Array.from(clone.children)
  const tooDeep = depth >= MAX_DEPTH
  for (let i = 0; i < cloneKids.length; i++) {
    const ck = cloneKids[i]
    const ok = origKids[i]
    if (
      tooDeep ||
      budget.n <= 0 ||
      !(ck instanceof Element) ||
      !(ok instanceof Element) ||
      UNSAFE_TAGS.has(ck.tagName)
    ) {
      clone.removeChild(ck)
      continue
    }
    bake(ok, ck, depth + 1, budget)
  }
}

function applyInlineStyle(orig: Element, clone: Element): void {
  const cs = window.getComputedStyle(orig)
  let text = ''
  for (const prop of PROPS) {
    const value = cs.getPropertyValue(prop)
    if (value) text += `${prop}:${value};`
  }
  clone.setAttribute('style', text)
}

function stripUnsafeAttributes(el: Element): void {
  for (const attr of Array.from(el.attributes)) {
    // Drop inline event handlers (onclick, onload, …); the frame is sandboxed
    // anyway, but no reason to carry them.
    if (attr.name.startsWith('on')) el.removeAttribute(attr.name)
  }
}
