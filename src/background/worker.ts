import { analyzeCapture, describeAnalysisError } from './claude'
import type { FromContentMessage, PanelCommand, ToContentMessage, ToPanelMessage } from '../lib/types'

// Background service worker: the message broker between the content script
// and the side panel, and home of the Claude API call — never anywhere else
// (architecture.md → invariant 3).

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error('[revelio] setPanelBehavior failed', error))

chrome.runtime.onMessage.addListener((raw: unknown, sender) => {
  if (typeof raw !== 'object' || raw === null || !('type' in raw)) return

  // Messages with a sender.tab come from the content script — relay them to
  // the side panel. Everything else is a panel command to route to the page.
  if (sender.tab) {
    const msg = raw as FromContentMessage
    broadcastToPanel(msg)
    if ((msg.type === 'ELEMENT_SELECTED' || msg.type === 'SECTION_CAPTURED') && msg.payload) {
      void analyze(msg.target, msg.payload)
    }
    return
  }

  const command = raw as PanelCommand
  switch (command.type) {
    case 'PANEL_START_INSPECT':
      void sendToActiveTab({ type: 'START_INSPECT' })
      break
    case 'PANEL_STOP_INSPECT':
      void sendToActiveTab({ type: 'STOP_INSPECT' })
      break
  }
})

function broadcastToPanel(msg: ToPanelMessage): void {
  // Rejects when the panel is closed — nothing to update, safe to ignore.
  chrome.runtime.sendMessage(msg).catch(() => {})
}

// Captures auto-analyze: the core flow is click → extract → Claude → panel
// (project-overview.md → Core User Flow).
async function analyze(
  target: Parameters<typeof analyzeCapture>[0],
  payload: NonNullable<Parameters<typeof analyzeCapture>[1]>,
): Promise<void> {
  broadcastToPanel({ type: 'ANALYSIS_STARTED' })
  try {
    const result = await analyzeCapture(target, payload)
    broadcastToPanel({ type: 'ANALYSIS_RESULT', result })
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
