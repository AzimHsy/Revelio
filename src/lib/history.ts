import type { CaptureStats, HistoryEntry, RuntimePayload } from './types'

// Recent-analysis history in chrome.storage.local (architecture.md → Storage
// Model: "optionally the last N analysis results for quick re-view"). We store
// a slim stats summary per entry, never the full runtime dump.

const HISTORY_KEY = 'recentAnalyses'
export const MAX_HISTORY = 5

/** Reduce a full runtime payload to the counts/flags the summary card shows. */
export function toCaptureStats(payload: RuntimePayload | null): CaptureStats | null {
  if (!payload) return null
  return {
    tweens: payload.tweens.length,
    timelines: payload.timelines.length,
    scrollTriggers: payload.scrollTriggers.length,
    cssAnimations: payload.cssAnimations.length,
    gsapVersion: payload.gsapVersion,
    splitTextPresent: payload.splitTextPresent,
    clipPath: payload.clipPath,
  }
}

export async function getHistory(): Promise<HistoryEntry[]> {
  const stored = await chrome.storage.local.get(HISTORY_KEY)
  const list = stored[HISTORY_KEY]
  return Array.isArray(list) ? (list as HistoryEntry[]) : []
}

/** Prepend an entry (newest first), cap at MAX_HISTORY, persist, return the new list. */
export async function pushHistory(entry: HistoryEntry): Promise<HistoryEntry[]> {
  const next = [entry, ...(await getHistory())].slice(0, MAX_HISTORY)
  await chrome.storage.local.set({ [HISTORY_KEY]: next })
  return next
}
