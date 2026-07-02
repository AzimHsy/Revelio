import gsap from 'gsap'

// Sandboxed preview stage. This page runs in an opaque origin with no extension
// APIs and a network-blocked CSP (manifest → content_security_policy.sandbox),
// so executing model-generated GSAP here can touch only this DOM — never the
// panel, the inspected page, the API key, or storage. This is the single place
// generated code is allowed to run.

const ITEM_COUNT = 6
const stage = document.getElementById('stage') as HTMLDivElement
const errorBox = document.getElementById('error') as HTMLDivElement

// (Re)build the six .demo-item blocks the preview code animates. Rebuilding the
// DOM each run guarantees no inline transforms/opacity linger between runs, so
// Replay is always a clean re-run.
function buildStage(): void {
  stage.innerHTML = ''
  for (let i = 0; i < ITEM_COUNT; i++) {
    const item = document.createElement('div')
    item.className = 'demo-item'
    stage.appendChild(item)
  }
}

function run(code: string): void {
  gsap.globalTimeline.clear()
  gsap.killTweensOf('.demo-item')
  buildStage()
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
  const data = event.data as unknown
  if (
    data &&
    typeof data === 'object' &&
    (data as { type?: unknown }).type === 'RUN_PREVIEW' &&
    typeof (data as { code?: unknown }).code === 'string'
  ) {
    run((data as { code: string }).code)
  }
})

buildStage()
// Announce readiness; the panel re-posts the code on load and on Replay, so a
// post that races ahead of this listener is harmless.
parent.postMessage({ type: 'PREVIEW_READY' }, '*')
