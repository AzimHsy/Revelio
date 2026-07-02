import { BRIDGE_SOURCE, type ExtractRequest, type ExtractResponse, type RuntimePayload, type SelectedTarget } from '../lib/types'

// Request/response bridge to the MAIN-world extractor over window.postMessage.
// Resolves null on timeout or extractor error — the pipeline continues with
// whatever the content script could describe on its own.

const EXTRACT_TIMEOUT_MS = 2000

export function requestExtraction(target: SelectedTarget): Promise<RuntimePayload | null> {
  return new Promise((resolve) => {
    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`

    const timer = window.setTimeout(() => {
      window.removeEventListener('message', onMessage)
      resolve(null)
    }, EXTRACT_TIMEOUT_MS)

    function onMessage(event: MessageEvent): void {
      if (event.source !== window) return
      const data = event.data as Partial<ExtractResponse> | null
      if (
        !data ||
        data.source !== BRIDGE_SOURCE ||
        data.direction !== 'from-injected' ||
        data.type !== 'EXTRACT_RESULT' ||
        data.requestId !== requestId
      ) {
        return
      }
      window.clearTimeout(timer)
      window.removeEventListener('message', onMessage)
      if (data.error) console.debug('[revelio] extraction error:', data.error)
      resolve(data.payload ?? null)
    }

    window.addEventListener('message', onMessage)

    const request: ExtractRequest = {
      source: BRIDGE_SOURCE,
      direction: 'to-injected',
      type: 'EXTRACT',
      requestId,
      target,
    }
    window.postMessage(request, '*')
  })
}
