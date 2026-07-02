import { Clapperboard, MousePointerClick, ScanLine } from 'lucide-react'
import type { Capture } from '../useInspection'

// Interim card showing what a capture extracted (target + runtime counts).
// The AI analysis sections (concept → explanation → code → parameters) replace
// the body of the panel once the Claude call lands; this stays as the
// "what was captured" summary above them.
export default function CaptureSummary({ capture }: { capture: Capture }) {
  const { target, payload } = capture
  const label =
    target.kind === 'element'
      ? (target.selector ?? target.tag ?? 'element')
      : 'Current viewport'
  const Icon = target.kind === 'element' ? MousePointerClick : ScanLine

  return (
    <section className="m-3 flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 shrink-0 text-accent" />
        <span className="truncate font-mono text-xs text-primary" title={label}>
          {label}
        </span>
      </div>
      {payload ? (
        <>
          <div className="flex flex-wrap gap-1.5">
            <Stat label="tweens" value={payload.tweens.length} />
            <Stat label="timelines" value={payload.timelines.length} />
            <Stat label="scroll triggers" value={payload.scrollTriggers.length} />
            <Stat label="CSS animations" value={payload.cssAnimations.length} />
          </div>
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <Clapperboard className="h-4 w-4 shrink-0" />
            {payload.gsapVersion ? `GSAP v${payload.gsapVersion}` : 'No GSAP detected'}
            {payload.splitTextPresent && ' · SplitText present'}
            {payload.clipPath && ' · clip-path set'}
          </p>
        </>
      ) : (
        <p className="text-xs text-muted">
          No runtime data extracted — the element may have disappeared, or the page blocked
          extraction.
        </p>
      )}
      <p className="text-xs text-muted">AI analysis arrives in the next build step.</p>
    </section>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <span className="rounded-md bg-raised px-2 py-0.5 text-xs text-muted">
      <span className={value > 0 ? 'font-medium text-primary' : ''}>{value}</span> {label}
    </span>
  )
}
