// Shared message contract + payload types crossing world boundaries.
// Defined once and reused everywhere (code-standards.md → Messaging).
// Everything here must survive postMessage / runtime messaging: plain JSON only.

/** Serializable descriptor of what the user selected on the page. */
export interface SelectedTarget {
  kind: 'element' | 'section'
  /** Best-effort CSS selector for the element (null for section captures). */
  selector: string | null
  tag: string | null
  id: string | null
  classes: string[]
  /** Bounding rect in viewport coordinates. */
  rect: { x: number; y: number; width: number; height: number }
  /** Page URL at capture time. */
  url: string
}

/** Messages sent TO the content script (from background / side panel). */
export type ToContentMessage = { type: 'START_INSPECT' } | { type: 'STOP_INSPECT' }

/** Messages the content script emits toward the background worker. */
export type FromContentMessage =
  | { type: 'INSPECT_STARTED' }
  | { type: 'INSPECT_CANCELLED' }
  | { type: 'ELEMENT_SELECTED'; target: SelectedTarget }
  | { type: 'SECTION_CAPTURED'; target: SelectedTarget }
