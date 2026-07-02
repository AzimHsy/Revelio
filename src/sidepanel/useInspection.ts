import { useEffect, useState } from 'react'
import type {
  AnalysisResult,
  PanelCommand,
  RuntimePayload,
  SelectedTarget,
  ToPanelMessage,
} from '../lib/types'

// All side panel messaging lives in this hook — components stay presentational
// (code-standards.md → React). The panel only talks to the background worker;
// it never touches the inspected page directly.

export type PanelStatus = 'idle' | 'inspecting' | 'analyzing'

export interface Capture {
  target: SelectedTarget
  payload: RuntimePayload | null
}

export interface AnalysisFailure {
  reason: string
  missingKey: boolean
}

export interface InspectionState {
  status: PanelStatus
  capture: Capture | null
  result: AnalysisResult | null
  error: string | null
  analysisError: AnalysisFailure | null
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
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [analysisError, setAnalysisError] = useState<AnalysisFailure | null>(null)

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
          setResult(null)
          setError(null)
          setAnalysisError(null)
          break
        case 'ANALYSIS_STARTED':
          setStatus('analyzing')
          setAnalysisError(null)
          break
        case 'ANALYSIS_RESULT':
          setStatus('idle')
          setResult(msg.result)
          break
        case 'ANALYSIS_ERROR':
          setStatus('idle')
          setAnalysisError({ reason: msg.reason, missingKey: msg.missingKey })
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
    result,
    error,
    analysisError,
    startInspect: () => sendCommand({ type: 'PANEL_START_INSPECT' }),
    stopInspect: () => sendCommand({ type: 'PANEL_STOP_INSPECT' }),
  }
}
