import gsap from 'gsap'

// Sandboxed preview stage. This page runs in an opaque origin with no extension
// APIs and a CSP that blocks scripts/network beyond bundled code + visual assets
// (manifest → content_security_policy.sandbox), so executing model-generated
// GSAP here can touch only this DOM — never the panel, the inspected page, the
// API key, or storage. This is the single place generated code is allowed to run.

interface ClonePayload {
  html: string
  width: number
  height: number
}

const ITEM_COUNT = 6
const stage = document.getElementById('stage') as HTMLDivElement
const errorBox = document.getElementById('error') as HTMLDivElement

// Fallback stage: six .demo-item blocks (used when no element clone is available
// — e.g. history entries captured before the faithful-clone feature).
function buildDemoStage(): void {
  stage.innerHTML = ''
  for (let i = 0; i < ITEM_COUNT; i++) {
    const item = document.createElement('div')
    item.className = 'demo-item'
    stage.appendChild(item)
  }
}

// Faithful stage: the real inspected element (markup + baked computed styles),
// scaled to fit the small preview viewport. The clone keeps its own classes/ids
// so the generated code targets real selectors.
function buildCloneStage(clone: ClonePayload): void {
  stage.innerHTML = ''
  const scaler = document.createElement('div')
  scaler.style.flex = '0 0 auto'
  scaler.innerHTML = clone.html

  // Defense-in-depth: the frame is already sandboxed, but never run injected
  // scripts; and swap any image that fails to load for a neutral placeholder.
  scaler.querySelectorAll('script').forEach((s) => s.remove())
  scaler.querySelectorAll('img').forEach((img) => {
    img.addEventListener('error', () => placeholderImage(img as HTMLImageElement), { once: true })
  })

  stage.appendChild(scaler)

  // Scale down to fit if the element is larger than the viewport (never scale up).
  const pad = 24
  const scale =
    clone.width > 0 && clone.height > 0
      ? Math.min(1, (window.innerWidth - pad) / clone.width, (window.innerHeight - pad) / clone.height)
      : 1
  scaler.style.transform = `scale(${scale})`
  scaler.style.transformOrigin = 'center center'
}

function placeholderImage(img: HTMLImageElement): void {
  img.removeAttribute('src')
  img.style.background = 'repeating-linear-gradient(45deg,#2a2a30,#2a2a30 6px,#33333b 6px,#33333b 12px)'
}

function run(code: string, clone: ClonePayload | null): void {
  gsap.globalTimeline.clear()
  if (clone && clone.html) buildCloneStage(clone)
  else {
    gsap.killTweensOf('.demo-item')
    buildDemoStage()
  }
  setError(null)
  try {
    // The whole point of the sandbox: run model-generated code. It can only
    // reach the `gsap` we pass and this page's own DOM.
    new Function('gsap', code)(gsap)
  } catch (err) {
    setError(err instanceof Error ? err.message : String(err))
  }
}

function setError(message: string | null): void {
  errorBox.textContent = message ?? ''
  errorBox.style.display = message ? 'block' : 'none'
}

window.addEventListener('message', (event: MessageEvent) => {
  const data = event.data as { type?: unknown; code?: unknown; clone?: unknown }
  if (data && data.type === 'RUN_PREVIEW' && typeof data.code === 'string') {
    const raw = data.clone as Partial<ClonePayload> | null | undefined
    const clone: ClonePayload | null =
      raw && typeof raw.html === 'string'
        ? { html: raw.html, width: Number(raw.width) || 0, height: Number(raw.height) || 0 }
        : null
    run(data.code, clone)
  }
})

buildDemoStage()
// Announce readiness; the panel re-posts the code on load and on Replay, so a
// post that races ahead of this listener is harmless.
parent.postMessage({ type: 'PREVIEW_READY' }, '*')
