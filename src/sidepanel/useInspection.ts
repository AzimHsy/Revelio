import { useEffect, useState } from 'react'
import { clearHistory as clearStoredHistory, getHistory, MAX_HISTORY } from '../lib/history'
import type {
  AnalysisResult,
  CropRect,
  ElementClone,
  HistoryEntry,
  PanelCommand,
  RuntimePayload,
  ScanItem,
  SelectedTarget,
  ToPanelMessage,
} from '../lib/types'
import { briefFromItem, payloadFromRecord, targetFromItem } from './scanBrief'

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

/** A scan pick and its instant Tier 1 brief (V2 Unit 5). Deep analyse streams the
 *  `result` in place (tier 'rules' → 'deep'). */
export interface ScanBrief {
  item: ScanItem
  result: AnalysisResult | null
}

/** Screen-recording state for the current tab (a page-level action). */
export interface RecordingState {
  isRecording: boolean
  /** Data URL of the finished webm clip, if any. */
  url: string | null
  error: string | null
}

export interface InspectionState {
  status: PanelStatus
  history: HistoryEntry[]
  viewIndex: number
  pending: PendingCapture | null
  error: string | null
  analysisError: AnalysisFailure | null
  recording: RecordingState
  /** V2 Unit 2 — the last page scan's animation list (data-driven capture). */
  scanItems: ScanItem[]
  scanning: boolean
  selectedScanId: string | null
  /** V2 Unit 5 — the picked scan item's Tier 1 brief (or its streaming deep result). */
  brief: ScanBrief | null
  startInspect: () => void
  stopInspect: () => void
  selectEntry: (index: number) => void
  clearHistory: () => void
  startRecording: (crop?: CropRect | null) => void
  stopRecording: () => void
  replayOnPage: (selector: string) => void
  scanPage: () => void
  selectScanItem: (id: string) => void
  highlightTarget: (selector: string) => void
  clearHighlight: () => void
  /** Escalate the current subject (element capture or scan pick) to Claude. */
  deepAnalyze: () => void
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
  const [recording, setRecording] = useState<RecordingState>({
    isRecording: false,
    url: null,
    error: null,
  })
  const [scanItems, setScanItems] = useState<ScanItem[]>([])
  const [scanning, setScanning] = useState(false)
  const [selectedScanId, setSelectedScanId] = useState<string | null>(null)
  const [brief, setBrief] = useState<ScanBrief | null>(null)

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
          // New capture becomes the live pending view (no auto-analyze — Unit 5).
          // History is untouched; a picked scan brief, if any, is superseded.
          setStatus('idle')
          setBrief(null)
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
          // Deep analyse started — clear the current result on whichever subject
          // is active so the spinner shows until the stream fills it.
          setStatus('analyzing')
          setPending((prev) => (prev ? { ...prev, result: null } : prev))
          setBrief((prev) => (prev ? { ...prev, result: null } : prev))
          setAnalysisError(null)
          break
        case 'ANALYSIS_PROGRESS':
          setPending((prev) => (prev ? { ...prev, result: msg.partial } : prev))
          setBrief((prev) => (prev ? { ...prev, result: msg.partial } : prev))
          break
        case 'THUMBNAIL_READY':
          setPending((prev) => (prev ? { ...prev, thumbnail: msg.thumbnail } : prev))
          break
        case 'ANALYSIS_RESULT':
          // Fold the finished deep result into history and show it (newest).
          setHistory((prev) => [msg.entry, ...prev].slice(0, MAX_HISTORY))
          setViewIndex(0)
          setPending(null)
          setBrief(null)
          setStatus('idle')
          break
        case 'ANALYSIS_ERROR':
          // Keep pending/brief so the summary + error/key-form stay visible.
          setStatus('idle')
          setAnalysisError({ reason: msg.reason, missingKey: msg.missingKey })
          break
        case 'RELAY_ERROR':
          setStatus('idle')
          setError(msg.reason)
          break
        case 'RECORDING_STARTED':
          setRecording({ isRecording: true, url: null, error: null })
          break
        case 'RECORDING_READY':
          setRecording({ isRecording: false, url: msg.url, error: null })
          break
        case 'RECORDING_ERROR':
          setRecording({ isRecording: false, url: null, error: msg.reason })
          break
        case 'SCAN_RESULT':
          // Data-driven capture result — populate the list, never auto-analyze.
          setScanItems(msg.items)
          setScanning(false)
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

  // Pick a scanned animation → build its Tier 1 brief instantly (no network) and
  // show it below the list; the element-capture view (if any) is superseded.
  function selectScanItem(id: string): void {
    const item = scanItems.find((candidate) => candidate.id === id)
    if (!item) return
    setSelectedScanId(id)
    setPending(null)
    setAnalysisError(null)
    setStatus('idle')
    setBrief({ item, result: briefFromItem(item) })
  }

  // Escalate the current subject to Claude. Prefers a real element capture; else
  // sends a payload synthesized from the picked scan item's record.
  function deepAnalyze(): void {
    if (pending && pending.payload) {
      setStatus('analyzing')
      setAnalysisError(null)
      sendCommand({
        type: 'PANEL_DEEP_ANALYZE',
        target: pending.target,
        payload: pending.payload,
        clone: pending.clone ?? null,
      })
      return
    }
    if (brief) {
      setStatus('analyzing')
      setAnalysisError(null)
      sendCommand({
        type: 'PANEL_DEEP_ANALYZE',
        target: targetFromItem(brief.item),
        payload: payloadFromRecord(brief.item.record),
        clone: null,
      })
    }
  }

  return {
    status,
    history,
    viewIndex,
    pending,
    error,
    analysisError,
    recording,
    scanItems,
    scanning,
    selectedScanId,
    brief,
    startInspect: () => sendCommand({ type: 'PANEL_START_INSPECT' }),
    stopInspect: () => sendCommand({ type: 'PANEL_STOP_INSPECT' }),
    selectEntry: (index: number) => setViewIndex(index),
    clearHistory: () => {
      void clearStoredHistory().then(() => {
        setHistory([])
        setViewIndex(0)
      })
    },
    startRecording: (crop?: CropRect | null) => {
      setRecording({ isRecording: true, url: null, error: null })
      sendCommand({ type: 'PANEL_START_RECORD', crop: crop ?? null })
    },
    stopRecording: () => sendCommand({ type: 'PANEL_STOP_RECORD' }),
    replayOnPage: (selector: string) => sendCommand({ type: 'PANEL_REPLAY_SCROLL', selector }),
    scanPage: () => {
      setScanning(true)
      sendCommand({ type: 'PANEL_SCAN' })
    },
    selectScanItem,
    highlightTarget: (selector: string) => sendCommand({ type: 'PANEL_HIGHLIGHT_TARGET', selector }),
    clearHighlight: () => sendCommand({ type: 'PANEL_CLEAR_HIGHLIGHT' }),
    deepAnalyze,
  }
}
