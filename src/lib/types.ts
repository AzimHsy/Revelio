// Shared message contract + payload types crossing world boundaries.
// Defined once and reused everywhere (code-standards.md → Messaging).
// Everything here must survive postMessage / runtime messaging: plain JSON only.

/** JSON-safe value — what the serializer guarantees after crossing a world. */
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

/** Serializable descriptor of what the user selected on the page. */
export interface SelectedTarget {
  kind: 'element' | 'section'
  /** Best-effort CSS selector for the element (null for section captures). */
  selector: string | null
  tag: string | null
  id: string | null
  classes: string[]
  /** Bounding rect in viewport coordinates (CSS pixels). */
  rect: { x: number; y: number; width: number; height: number }
  /** devicePixelRatio at capture time — captureVisibleTab renders at this scale. */
  dpr: number
  /** Page URL at capture time. */
  url: string
}

// ---------------------------------------------------------------------------
// Runtime payload — what the MAIN-world extractor reads off the page.
// ---------------------------------------------------------------------------

export interface TweenData {
  /** Short descriptors of the tween's targets, e.g. "div#hero.title". */
  targets: string[]
  /** JSON-safe snapshot of tween.vars (duration, ease, stagger, x, y, …). */
  vars: Record<string, JsonValue>
  duration: number
  progress: number
  isActive: boolean
}

export interface TimelineData {
  labels: Record<string, number>
  duration: number
  progress: number
  /** Child tweens (capped). */
  children: TweenData[]
}

export interface ScrollTriggerData {
  /** Descriptor of the trigger element, e.g. "section#features". */
  trigger: string | null
  start: number | null
  end: number | null
  scrub: JsonValue
  pin: boolean
  progress: number
  isActive: boolean
}

/** A CSS animation or transition, read via getAnimations() (resolved values). */
export interface CssAnimationData {
  kind: 'animation' | 'transition'
  /** animationName, or the transitioned property. */
  name: string
  target: string
  playState: string
  durationMs: number | null
  delayMs: number | null
  easing: string | null
  iterations: number | null
  direction: string | null
  fill: string | null
  /** Resolved keyframes (animations only). */
  keyframes: JsonValue | null
}

export interface RuntimePayload {
  gsapVersion: string | null
  splitTextPresent: boolean
  /** Computed clip-path of the selected element (element captures only). */
  clipPath: string | null
  tweens: TweenData[]
  timelines: TimelineData[]
  scrollTriggers: ScrollTriggerData[]
  cssAnimations: CssAnimationData[]
}

// ---------------------------------------------------------------------------
// window.postMessage bridge: content (isolated) ↔ injected (MAIN).
// ---------------------------------------------------------------------------

export const BRIDGE_SOURCE = 'revelio'

export interface ExtractRequest {
  source: typeof BRIDGE_SOURCE
  direction: 'to-injected'
  type: 'EXTRACT'
  requestId: string
  target: SelectedTarget
}

export interface ExtractResponse {
  source: typeof BRIDGE_SOURCE
  direction: 'from-injected'
  type: 'EXTRACT_RESULT'
  requestId: string
  payload: RuntimePayload | null
  error: string | null
}

// ---------------------------------------------------------------------------
// chrome.runtime messaging: content → background → sidepanel.
// ---------------------------------------------------------------------------

/** Messages sent TO the content script (from the background worker). */
export type ToContentMessage = { type: 'START_INSPECT' } | { type: 'STOP_INSPECT' }

/** Messages the content script emits toward the background worker. */
export type FromContentMessage =
  | { type: 'INSPECT_STARTED' }
  | { type: 'INSPECT_CANCELLED' }
  | { type: 'ELEMENT_SELECTED'; target: SelectedTarget; payload: RuntimePayload | null }
  | { type: 'SECTION_CAPTURED'; target: SelectedTarget; payload: RuntimePayload | null }

/** Commands the side panel sends to the background worker. */
export type PanelCommand = { type: 'PANEL_START_INSPECT' } | { type: 'PANEL_STOP_INSPECT' }

// ---------------------------------------------------------------------------
// AI analysis — what Claude returns for a capture.
// ---------------------------------------------------------------------------

export interface AnalysisParameter {
  name: string
  value: string
  description: string
}

export interface AnalysisResult {
  /** The animation concept's name, e.g. "Staggered SplitText reveal". */
  concept: string
  /** Plain-English explanation of the technique. */
  explanation: string
  /** Ready-to-use GSAP code. */
  gsapCode: string
  parameters: AnalysisParameter[]
}

/** Slim capture stats stored with a history entry (not the full payload). */
export interface CaptureStats {
  tweens: number
  timelines: number
  scrollTriggers: number
  cssAnimations: number
  gsapVersion: string | null
  splitTextPresent: boolean
  clipPath: string | null
}

/** One persisted analysis, kept in chrome.storage.local for quick re-view. */
export interface HistoryEntry {
  id: string
  target: SelectedTarget
  stats: CaptureStats | null
  result: AnalysisResult
  /** Cropped screenshot of the inspected element (webp data URL). Optional. */
  thumbnail?: string
  /** Capture time (epoch ms). */
  at: number
}

/**
 * Messages the background worker broadcasts to the side panel. Content events
 * are relayed as-is; broker-level failures surface as RELAY_ERROR.
 */
export type ToPanelMessage =
  | FromContentMessage
  | { type: 'RELAY_ERROR'; reason: string }
  | { type: 'ANALYSIS_STARTED' }
  | { type: 'ANALYSIS_PROGRESS'; partial: AnalysisResult }
  | { type: 'THUMBNAIL_READY'; thumbnail: string }
  | { type: 'ANALYSIS_RESULT'; entry: HistoryEntry }
  | { type: 'ANALYSIS_ERROR'; reason: string; missingKey: boolean }
