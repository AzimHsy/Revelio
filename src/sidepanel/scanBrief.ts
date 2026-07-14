import { buildBrief } from '../lib/brief'
import { classify } from '../lib/classify'
import type {
  AnalysisResult,
  InstrumentedRecord,
  RuntimePayload,
  ScanItem,
  ScanRecord,
  SelectedTarget,
  TweenData,
} from '../lib/types'

// Adapters between a scan item and the shapes the rest of the pipeline expects
// (V2 Unit 5). A scan pick produces a Tier 1 brief instantly (classify + template,
// zero network); if the user escalates to Deep analyse, the same record is wrapped
// into a minimal RuntimePayload + target so the existing Claude path can digest it.

/** Tier 1 brief for a scanned item — deterministic, offline, no API call. */
export function briefFromItem(item: ScanItem): AnalysisResult {
  return buildBrief(item, classify(item.record).slug)
}

/** Synthetic target for Deep analyse of a scan item (no real rect — scan is
 *  viewport-wide, so recording/thumbnail cropping is skipped for these). */
export function targetFromItem(item: ScanItem): SelectedTarget {
  return {
    kind: 'element',
    selector: item.target,
    tag: null,
    id: null,
    classes: [],
    rect: { x: 0, y: 0, width: 0, height: 0 },
    dpr: 1,
    viewport: { width: 0, height: 0 },
    url: 'the scanned page',
  }
}

/** Wrap one scan record into a minimal RuntimePayload so digestForPrompt (and
 *  the capture-summary counts) see exactly that one animation's real data. */
export function payloadFromRecord(record: ScanRecord): RuntimePayload {
  const payload: RuntimePayload = {
    gsapVersion: null,
    splitTextPresent: false,
    clipPath: null,
    tweens: [],
    timelines: [],
    scrollTriggers: [],
    cssAnimations: [],
    instrumented: [],
    hoverCandidates: [],
  }
  const duration = typeof record.vars['duration'] === 'number' ? record.vars['duration'] : 0

  if (record.source === 'registry') {
    const rec: InstrumentedRecord = {
      method: record.method,
      targets: record.targets,
      vars: record.vars,
      createdAt: 0,
    }
    payload.instrumented = [rec]
  } else if (record.source === 'live' && record.scrollTrigger) {
    payload.scrollTriggers = [record.scrollTrigger]
  } else if (record.source === 'css' && record.css) {
    payload.cssAnimations = [record.css]
  } else if (record.source === 'hover?') {
    payload.hoverCandidates = [
      {
        target: record.targets[0] ?? '(unknown target)',
        source: 'listener',
        trigger: String(record.vars['trigger'] ?? 'hover'),
        createdAt: 0,
      },
    ]
    payload.tweens = [tweenFrom(record, duration)]
  } else {
    payload.tweens = [tweenFrom(record, duration)]
  }
  return payload
}

function tweenFrom(record: ScanRecord, duration: number): TweenData {
  return { targets: record.targets, vars: record.vars, duration, progress: 0, isActive: false }
}
