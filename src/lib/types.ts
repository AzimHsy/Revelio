// Shared message contract + payload types crossing world boundaries.
// Defined once and reused everywhere (code-standards.md → Messaging).
// Everything here must survive postMessage / runtime messaging: plain JSON only.

/** JSON-safe value — what the serializer guarantees after crossing a world. */
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

/**
 * Self-contained HTML clone of the inspected element (markup + computed styles
 * baked inline), used to reproduce its real design in the sandbox preview.
 * `width`/`height` are the element's intrinsic size, for scale-to-fit.
 */
export interface ElementClone {
  html: string
  width: number
  height: number
  /** Compact tag.class tree of the real element, so the model can target its
   *  actual selectors in the preview code (not the fallback demo boxes). */
  outline: string
}

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
  /** Viewport size (CSS px) at capture time — maps rect onto a captured frame. */
  viewport: { width: number; height: number }
  /** Page URL at capture time. */
  url: string
}

/** Rect (CSS px) + the viewport it was measured in, for cropping a tab frame. */
export interface CropRect {
  x: number
  y: number
  width: number
  height: number
  viewportWidth: number
  viewportHeight: number
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

/**
 * A GSAP call captured at CREATION time by the load-time instrumentation hook
 * (enhancement 2), before its tween could finish and be disposed. Unlike the
 * snapshot readers (which see only live tweens), these carry the ORIGINAL vars
 * the page passed in — SOURCE-grade truth even for a load-in reveal that already
 * ended by the time the user inspected.
 */
export interface InstrumentedRecord {
  /** e.g. "gsap.from" | "timeline.to" | "ScrollTrigger.create". */
  method: string
  /** Target descriptors (tag#id.class or the original selector string). */
  targets: string[]
  /** The original vars object the page passed (serialized). */
  vars: Record<string, JsonValue>
  /** Creation time (page performance.now-ish epoch ms). */
  createdAt: number
}

/**
 * A place the user can hover to trigger an animation the scan can't see yet —
 * hover tweens don't exist until fired (V2 Unit 1). Discovered two ways at
 * document_start / collect time: a wrapped `addEventListener` for
 * `mouseenter`/`mouseover` on an Element, or a same-origin CSS `:hover` rule
 * that sets `transition`/`transform`/`animation`.
 */
export interface HoverCandidate {
  /** tag#id.class descriptor of the element to hover. */
  target: string
  /** Whether it came from a JS listener or a CSS `:hover` rule. */
  source: 'listener' | 'css'
  /** Listener: the event name (`mouseenter`/`mouseover`). CSS: the base selector. */
  trigger: string
  /** Discovery time (page performance.now-ish ms). */
  createdAt: number
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
  /**
   * Creation-time GSAP calls whose targets match the selection, captured by the
   * document_start instrumentation hook. Empty when the page never exposed GSAP
   * on `window` (ESM-bundled) — the snapshot readers above are the fallback.
   */
  instrumented: InstrumentedRecord[]
  /**
   * Places to hover to trigger animations not yet in the registry (V2 Unit 1).
   * Matched to the selection scope. The scan (Unit 2) is the primary consumer.
   */
  hoverCandidates: HoverCandidate[]
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
// Scan (V2 Unit 2) — data-driven capture. `scan()` lists every animation the
// page exposes (instrumented registry + live GSAP + CSS + hover candidates) so
// the user picks from a list instead of hit-testing the DOM. Pure JS, no network.
// ---------------------------------------------------------------------------

export type ScanSource = 'registry' | 'live' | 'css' | 'hover?'

/** Serialized evidence behind a ScanItem, carried for the Unit 3 classifier. */
export interface ScanRecord {
  source: ScanSource
  /** GSAP method / css kind / 'tween' / 'timeline' / 'ScrollTrigger' / 'hover'. */
  method: string
  targets: string[]
  vars: Record<string, JsonValue>
  /** Present for ScrollTrigger items. */
  scrollTrigger?: ScrollTriggerData | null
  /** Present for CSS animation/transition items. */
  css?: CssAnimationData | null
}

/** One animation the scan surfaced, rendered as a row in the panel list. */
export interface ScanItem {
  id: string
  /** tag#id.class descriptor of the animated element (also used to highlight it). */
  target: string
  /** Lightweight concept guess (badge); refined by the Unit 3 classifier. */
  kindGuess: string
  source: ScanSource
  record: ScanRecord
}

export interface ScanRequest {
  source: typeof BRIDGE_SOURCE
  direction: 'to-injected'
  type: 'SCAN'
  requestId: string
}

export interface ScanResponse {
  source: typeof BRIDGE_SOURCE
  direction: 'from-injected'
  type: 'SCAN_RESULT'
  requestId: string
  items: ScanItem[]
  error: string | null
}

// ---------------------------------------------------------------------------
// chrome.runtime messaging: content → background → sidepanel.
// ---------------------------------------------------------------------------

/** Messages sent TO the content script (from the background worker). */
export type ToContentMessage =
  | { type: 'START_INSPECT' }
  | { type: 'STOP_INSPECT' }
  // A traversal key relayed from the panel (which holds keyboard focus while the
  // toolbar-opened panel is active, so the page's own keydown never fires).
  | { type: 'INSPECT_KEY'; key: string }
  // Scroll the element out of view then back, to re-fire scroll-triggered
  // animations during a recording.
  | { type: 'REPLAY_SCROLL'; selector: string }
  // Run a page scan (V2 Unit 2) — the content script does the MAIN-world round
  // trip and replies with SCAN_RESULT.
  | { type: 'SCAN' }
  // Flash the highlight overlay on a scanned element while its row is hovered.
  | { type: 'HIGHLIGHT_TARGET'; selector: string }
  | { type: 'CLEAR_HIGHLIGHT' }

/** Messages the content script emits toward the background worker. */
export type FromContentMessage =
  | { type: 'INSPECT_STARTED' }
  | { type: 'INSPECT_CANCELLED' }
  | {
      type: 'ELEMENT_SELECTED'
      target: SelectedTarget
      payload: RuntimePayload | null
      clone?: ElementClone | null
    }
  | {
      type: 'SECTION_CAPTURED'
      target: SelectedTarget
      payload: RuntimePayload | null
      clone?: ElementClone | null
    }
  // Result of a page scan (V2 Unit 2). Relayed to the panel; never auto-analyzed.
  | { type: 'SCAN_RESULT'; items: ScanItem[] }

/** Commands the side panel sends to the background worker. */
export type PanelCommand =
  | { type: 'PANEL_START_INSPECT' }
  | { type: 'PANEL_STOP_INSPECT' }
  | { type: 'PANEL_INSPECT_KEY'; key: string }
  | { type: 'PANEL_START_RECORD'; crop?: CropRect | null }
  | { type: 'PANEL_STOP_RECORD' }
  | { type: 'PANEL_REPLAY_SCROLL'; selector: string }
  // V2 Unit 2 — scan the page and highlight a scanned element on row hover.
  | { type: 'PANEL_SCAN' }
  | { type: 'PANEL_HIGHLIGHT_TARGET'; selector: string }
  | { type: 'PANEL_CLEAR_HIGHLIGHT' }

// ---------------------------------------------------------------------------
// Screen recording: worker ⇄ offscreen document (holds the MediaRecorder, since
// a service worker can't). tabCapture streamId is minted in the worker and sent
// to the offscreen doc, which records and returns a webm data URL.
// ---------------------------------------------------------------------------

/** Worker → offscreen recorder document. */
export type WorkerToOffscreen =
  | { type: 'START_RECORDING'; streamId: string; crop?: CropRect | null }
  | { type: 'STOP_RECORDING' }

/** Offscreen recorder document → worker. */
export type OffscreenToWorker =
  | { type: 'RECORDING_DATA'; dataUrl: string }
  | { type: 'RECORDING_FAILED'; reason: string }

// ---------------------------------------------------------------------------
// AI analysis — what Claude returns for a capture.
// ---------------------------------------------------------------------------

/**
 * Honesty label for a parameter's value (enhancement 1):
 * - `SOURCE`  — read directly from the runtime capture (trustworthy).
 * - `PARTIAL` — partially inferred (some runtime signal, some inference).
 * - `GUESS`   — inferred; no runtime value backed it.
 * Old history entries (3-field params) have no label and default to `GUESS`.
 */
export type ParameterLabel = 'SOURCE' | 'PARTIAL' | 'GUESS'

export interface AnalysisParameter {
  name: string
  value: string
  label: ParameterLabel
  description: string
}

/**
 * Which path produced an AnalysisResult (V2):
 * - `rules` — deterministic Tier 1 brief from the rule classifier (Unit 3): free,
 *   instant, offline; every captured value is SOURCE by construction.
 * - `deep`  — Claude "Deep analyse" (Unit 5).
 * Absent on pre-V2 history entries (they render as before).
 */
export type AnalysisTier = 'rules' | 'deep'

export interface AnalysisResult {
  /** The animation concept's name, e.g. "Staggered SplitText reveal". */
  concept: string
  /** Plain-English explanation of the technique. */
  explanation: string
  /** Ready-to-use GSAP code. For a `rules`-tier brief this holds the paste-ready
   *  prompt instead (Unit 4 presents it as the Prompt). */
  gsapCode: string
  parameters: AnalysisParameter[]
  /**
   * Self-contained, core-gsap-only code that recreates the technique on the
   * sandbox demo stage (no ScrollTrigger/SplitText). Optional — empty for
   * captures analyzed before this feature (and for `rules`-tier briefs), so old
   * history still renders.
   */
  previewCode: string
  /** Which tier produced this (V2). Absent on pre-V2 history entries. */
  tier?: AnalysisTier
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
  /** Self-contained HTML clone for the faithful preview. Optional. */
  clone?: ElementClone | null
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
  | { type: 'RECORDING_STARTED' }
  | { type: 'RECORDING_READY'; url: string }
  | { type: 'RECORDING_ERROR'; reason: string }
