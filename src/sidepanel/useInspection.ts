import { useEffect, useState } from 'react'
import type { PanelCommand, RuntimePayload, SelectedTarget, ToPanelMessage } from '../lib/types'

// All side panel messaging lives in this hook — components stay presentational
// (code-standards.md → React). The panel only talks to the background worker;
// it never touches the inspected page directly.

export type PanelStatus = 'idle' | 'inspecting' | 'analyzing'

export interface Capture {
  target: SelectedTarget
  payload: RuntimePayload | null
}

export interface InspectionState {
  status: PanelStatus
  capture: Capture | null
  error: string | null
  startInspect: () => void
  stopInspect: () => void
}

function sendCommand(command: PanelCommand): void {
  chrome.runtime.sendMessage(command).catch(() => {
    // Background worker unavailable (e.g. reloading) — the status broadcast
    // simply won't arrive; the panel stays in its current state.
  })
}

export function useInspection(): InspectionState {
  const [status, setStatus] = useState<PanelStatus>('idle')
  const [capture, setCapture] = useState<Capture | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    function onMessage(raw: unknown): void {
      if (typeof raw !== 'object' || raw === null || !('type' in raw)) return
      const msg = raw as ToPanelMessage
      switch (msg.type) {
        case 'INSPECT_STARTED':
          setStatus('inspecting')
          setError(null)
          break
        case 'INSPECT_CANCELLED':
          setStatus('idle')
          break
        case 'ELEMENT_SELECTED':
        case 'SECTION_CAPTURED':
          setStatus('idle')
          setCapture({ target: msg.target, payload: msg.payload })
          setError(null)
          break
        case 'RELAY_ERROR':
          setStatus('idle')
          setError(msg.reason)
          break
      }
    }
    chrome.runtime.onMessage.addListener(onMessage)
    return () => chrome.runtime.onMessage.removeListener(onMessage)
  }, [])

  return {
    status,
    capture,
    error,
    startInspect: () => sendCommand({ type: 'PANEL_START_INSPECT' }),
    stopInspect: () => sendCommand({ type: 'PANEL_STOP_INSPECT' }),
  }
}
