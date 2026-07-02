import { useEffect, useRef } from 'react'
import { RefreshCw } from 'lucide-react'

// Embeds the sandboxed preview page and posts the model's preview code to it.
// The sandbox runs that code in an opaque origin with no extension APIs, so this
// component is the trust boundary: it only ever SENDS a code string and never
// acts on anything the iframe sends back (it just re-posts on the ready signal).
export default function PreviewStage({ code }: { code: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  function post(): void {
    iframeRef.current?.contentWindow?.postMessage({ type: 'RUN_PREVIEW', code }, '*')
  }

  // Re-post whenever the code changes (the same iframe is reused across history
  // entries). The sandbox also emits PREVIEW_READY once loaded; posting on both
  // signals means the first paint is never missed regardless of ordering.
  useEffect(() => {
    function onMessage(event: MessageEvent): void {
      if ((event.data as { type?: unknown })?.type === 'PREVIEW_READY') post()
    }
    window.addEventListener('message', onMessage)
    post()
    return () => window.removeEventListener('message', onMessage)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code])

  return (
    <section className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium tracking-wider text-muted uppercase">Preview</span>
        <button
          type="button"
          onClick={post}
          title="Replay the animation"
          className="flex items-center gap-1 text-[10px] text-muted transition-colors hover:text-accent"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Replay
        </button>
      </div>
      <iframe
        ref={iframeRef}
        src={chrome.runtime.getURL('src/sandbox/preview.html')}
        sandbox="allow-scripts"
        title="Animation preview"
        onLoad={post}
        className="h-40 w-full rounded-md border border-line bg-raised"
      />
    </section>
  )
}
