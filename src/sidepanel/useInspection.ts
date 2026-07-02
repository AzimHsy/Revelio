import { useEffect, useState } from 'react'
import { clearHistory as clearStoredHistory, getHistory, MAX_HISTORY } from '../lib/history'
import type {
  AnalysisResult,
  ElementClone,
  HistoryEntry,
  PanelCommand,
  RuntimePayload,
  SelectedTarget,
  ToPanelMessage,
} from '../lib/types'

// All side panel messaging lives in this hook — components stay presentational
// (code-standards.md → React). The panel only talks to the background worker;
// it never touches the inspected page directly.

export type PanelStatus = 'idle' | 'inspecting' | 'analyzing'

export interface AnalysisFailure {
  reason: string
  missingKey: boolean
}

/** The capture currently being (or just) analyzed — not yet in history. */
export interface PendingCapture {
  target: SelectedTarget
  payload: RuntimePayload | null
  result: AnalysisResult | null
  /** Cropped element screenshot — arrives via THUMBNAIL_READY, may be absent. */
  thumbnail?: string
  /** Self-contained HTML clone for the faithful preview, if it was captured. */
  clone?: ElementClone | null
}

export interface InspectionState {
  status: PanelStatus
  history: HistoryEntry[]
  viewIndex: number
  pending: PendingCapture | null
  error: string | null
  analysisError: AnalysisFailure | null
  startInspect: () => void
  stopInspect: () => void
  selectEntry: (index: number) => void
  clearHistory: () => void
}

function sendCommand(command: PanelCommand): void {
  chrome.runtime.sendMessage(command).catch(() => {
    // Background worker unavailable (e.g. reloading) — the status broadcast
    // simply won't arrive; the panel stays in its current state.
  })
}

export function useInspection(): InspectionState {
  const [status, setStatus] = useState<PanelStatus>('idle')
  const [history, setHistory] = useState<HistoryEntry[]>([])
  // 0 = newest. Which history entry is shown when not viewing a live capture.
  const [viewIndex, setViewIndex] = useState(0)
  const [pending, setPending] = useState<PendingCapture | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [analysisError, setAnalysisError] = useState<AnalysisFailure | null>(null)

  // Load persisted history once so it survives the panel closing/reopening.
  useEffect(() => {
    void getHistory().then((stored) => {
      setHistory(stored)
      setViewIndex(0)
    })
  }, [])

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
          // New capture becomes the live pending view. History is untouched —
          // the previous results stay saved and navigable.
          setStatus('idle')
          setPending({
            target: msg.target,
            payload: msg.payload,
            result: null,
            clone: msg.clone ?? null,
          })
          setError(null)
          setAnalysisError(null)
          break
        case 'ANALYSIS_STARTED':
          setStatus('analyzing')
          setPending((prev) => (prev ? { ...prev, result: null } : prev))
          setAnalysisError(null)
          break
        case 'ANALYSIS_PROGRESS':
          setPending((prev) => (prev ? { ...prev, result: msg.partial } : prev))
          break
        case 'THUMBNAIL_READY':
          setPending((prev) => (prev ? { ...prev, thumbnail: msg.thumbnail } : prev))
          break
        case 'ANALYSIS_RESULT':
          // Fold the finished capture into history and show it (newest).
          setHistory((prev) => [msg.entry, ...prev].slice(0, MAX_HISTORY))
          setViewIndex(0)
          setPending(null)
          setStatus('idle')
          break
        case 'ANALYSIS_ERROR':
          // Keep `pending` so the capture summary + error/key-form stay visible.
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

  // While inspecting, the panel (not the page) holds keyboard focus, so traversal
  // keys land here — relay them to the content script. ArrowUp/Down/Left/Right walk
  // the DOM, `[`/`]` pierce the z-stack, Enter selects, Escape cancels.
  useEffect(() => {
    if (status !== 'inspecting') return
    const KEYS = new Set([
      'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', '[', ']', 'PageUp', 'PageDown', 'Enter', 'Escape',
    ])
    function onKey(event: KeyboardEvent): void {
      if (!KEYS.has(event.key)) return
      event.preventDefault()
      sendCommand({ type: 'PANEL_INSPECT_KEY', key: event.key })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [status])

  return {
    status,
    history,
    viewIndex,
    pending,
    error,
    analysisError,
    startInspect: () => sendCommand({ type: 'PANEL_START_INSPECT' }),
    stopInspect: () => sendCommand({ type: 'PANEL_STOP_INSPECT' }),
    selectEntry: (index: number) => setViewIndex(index),
    clearHistory: () => {
      void clearStoredHistory().then(() => {
        setHistory([])
        setViewIndex(0)
      })
    },
  }
}
