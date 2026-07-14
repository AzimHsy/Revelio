import { analyzeCapture, describeAnalysisError } from './claude'
import { captureThumbnail } from './screenshot'
import { pushHistory, toCaptureStats } from '../lib/history'
import type {
  CropRect,
  ElementClone,
  FromContentMessage,
  HistoryEntry,
  OffscreenToWorker,
  PanelCommand,
  RuntimePayload,
  SelectedTarget,
  ToContentMessage,
  ToPanelMessage,
  WorkerToOffscreen,
} from '../lib/types'

// Background service worker: the message broker between the content script
// and the side panel, and home of the Claude API call — never anywhere else
// (architecture.md → invariant 3).

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error('[revelio] setPanelBehavior failed', error))

chrome.runtime.onMessage.addListener((raw: unknown, sender) => {
  if (typeof raw !== 'object' || raw === null || !('type' in raw)) return

  // Messages with a sender.tab come from the content script — relay them to
  // the side panel. Selections no longer auto-analyze (V2 Unit 5): the panel
  // shows an instant Tier 1 brief and only calls Claude on explicit Deep analyse.
  if (sender.tab) {
    broadcastToPanel(raw as FromContentMessage)
    return
  }

  // Messages coming back from the offscreen recorder document (no sender.tab).
  if (raw && typeof raw === 'object' && 'type' in raw) {
    const t = (raw as { type: string }).type
    if (t === 'RECORDING_DATA') {
      broadcastToPanel({ type: 'RECORDING_READY', url: (raw as OffscreenToWorker & { type: 'RECORDING_DATA' }).dataUrl })
      return
    }
    if (t === 'RECORDING_FAILED') {
      broadcastToPanel({ type: 'RECORDING_ERROR', reason: (raw as OffscreenToWorker & { type: 'RECORDING_FAILED' }).reason })
      return
    }
  }

  const command = raw as PanelCommand
  switch (command.type) {
    case 'PANEL_START_INSPECT':
      void sendToActiveTab({ type: 'START_INSPECT' })
      break
    case 'PANEL_STOP_INSPECT':
      void sendToActiveTab({ type: 'STOP_INSPECT' })
      break
    case 'PANEL_INSPECT_KEY':
      void sendToActiveTab({ type: 'INSPECT_KEY', key: command.key })
      break
    case 'PANEL_START_RECORD':
      void startRecording(command.crop ?? null)
      break
    case 'PANEL_STOP_RECORD':
      sendToOffscreen({ type: 'STOP_RECORDING' })
      break
    case 'PANEL_REPLAY_SCROLL':
      void sendToActiveTab({ type: 'REPLAY_SCROLL', selector: command.selector })
      break
    case 'PANEL_SCAN':
      // Data-driven capture (V2 Unit 2). The content script does the MAIN-world
      // round trip and replies with SCAN_RESULT, which is relayed as-is above —
      // deliberately NOT auto-analyzed (scan makes zero API calls).
      void sendToActiveTab({ type: 'SCAN' })
      break
    case 'PANEL_HIGHLIGHT_TARGET':
      void sendToActiveTab({ type: 'HIGHLIGHT_TARGET', selector: command.selector })
      break
    case 'PANEL_CLEAR_HIGHLIGHT':
      void sendToActiveTab({ type: 'CLEAR_HIGHLIGHT' })
      break
    case 'PANEL_DEEP_ANALYZE':
      // On-demand Claude escalation (V2 Unit 5). The panel supplies the target +
      // payload (real for an element capture, synthesized from a scan item's
      // record otherwise); this is the only remaining Claude call site.
      void analyze(command.target, command.payload, undefined, command.clone)
      break
  }
})

// ---------------------------------------------------------------------------
// Screen recording. The worker mints the tabCapture streamId (needs the tab's
// activeTab grant from the toolbar-opened panel) and hands it to the offscreen
// document, which owns the MediaRecorder.
// ---------------------------------------------------------------------------

const OFFSCREEN_PATH = 'src/offscreen/recorder.html'

async function startRecording(crop: CropRect | null): Promise<void> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true })
    if (tab?.id === undefined) throw new Error('No active tab to record.')
    await ensureOffscreen()
    const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id })
    sendToOffscreen({ type: 'START_RECORDING', streamId, crop })
    broadcastToPanel({ type: 'RECORDING_STARTED' })
  } catch (error) {
    broadcastToPanel({ type: 'RECORDING_ERROR', reason: recordErrorReason(error) })
  }
}

// tabCapture needs the tab's activeTab grant, which Chrome hands out only when
// the extension is INVOKED on that tab — and drops on every reload/tab switch
// (the side panel itself persists, which is why inspect/analyze still work but
// capture doesn't). Turn Chrome's raw "has not been invoked" error into a fix.
function recordErrorReason(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  if (/invoked|activeTab|not been granted/i.test(message)) {
    return 'Click the Revelio toolbar icon on this page to enable capture, then press Record. (Reloading the page clears it.)'
  }
  return message || 'Could not start recording.'
}

async function ensureOffscreen(): Promise<void> {
  const has = await chrome.offscreen.hasDocument()
  if (has) return
  await chrome.offscreen.createDocument({
    url: OFFSCREEN_PATH,
    reasons: [chrome.offscreen.Reason.USER_MEDIA],
    justification: "Record the inspected element's animation from the tab.",
  })
}

function sendToOffscreen(msg: WorkerToOffscreen): void {
  chrome.runtime.sendMessage(msg).catch(() => {})
}

function broadcastToPanel(msg: ToPanelMessage): void {
  // Rejects when the panel is closed — nothing to update, safe to ignore.
  chrome.runtime.sendMessage(msg).catch(() => {})
}

// Deep analyse: the on-demand Claude escalation (V2 Unit 5). Streams a `deep`-tier
// result (concept/explanation/code/preview + a paste-ready prompt) and persists it
// to the recent-history store so it survives the panel closing.
async function analyze(
  target: SelectedTarget,
  payload: RuntimePayload,
  windowId?: number,
  clone: ElementClone | null = null,
): Promise<void> {
  broadcastToPanel({ type: 'ANALYSIS_STARTED' })
  // Screenshot runs in parallel with the Claude call — optional, never blocks/fails
  // the analysis. Skipped for synthesized scan-item targets (no real rect to crop).
  const wantThumbnail = target.rect.width > 0 && target.rect.height > 0
  const thumbnailPromise = wantThumbnail ? captureThumbnail(target, windowId) : Promise.resolve(null)
  void thumbnailPromise.then((thumbnail) => {
    if (thumbnail) broadcastToPanel({ type: 'THUMBNAIL_READY', thumbnail })
  })
  try {
    const result = await analyzeCapture(target, payload, clone, (partial) => {
      partial.tier = 'deep'
      broadcastToPanel({ type: 'ANALYSIS_PROGRESS', partial })
    })
    result.tier = 'deep'
    const entry: HistoryEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      target,
      stats: toCaptureStats(payload),
      result,
      thumbnail: (await thumbnailPromise) ?? undefined,
      clone,
      at: Date.now(),
    }
    await pushHistory(entry)
    broadcastToPanel({ type: 'ANALYSIS_RESULT', entry })
  } catch (error) {
    broadcastToPanel({ type: 'ANALYSIS_ERROR', ...describeAnalysisError(error) })
  }
}

async function sendToActiveTab(msg: ToContentMessage): Promise<void> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true })
    if (tab?.id === undefined) throw new Error('no active tab')
    await chrome.tabs.sendMessage(tab.id, msg)
  } catch {
    // Typically a page without the content script (chrome://, Web Store, PDFs).
    broadcastToPanel({
      type: 'RELAY_ERROR',
      reason: 'Revelio cannot inspect this page. Try a regular http(s) website.',
    })
  }
}
