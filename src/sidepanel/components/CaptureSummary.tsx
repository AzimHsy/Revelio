import { Clapperboard, MousePointerClick, ScanLine } from 'lucide-react'
import type { CaptureStats, SelectedTarget } from '../../lib/types'

// Capture context card: target descriptor + runtime counts. Driven by a slim
// CaptureStats so it renders identically for a live capture and a stored
// history entry (the full payload is never needed here).
export default function CaptureSummary({
  target,
  stats,
}: {
  target: SelectedTarget
  stats: CaptureStats | null
}) {
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
      {stats ? (
        <>
          <div className="flex flex-wrap gap-1.5">
            <Stat label="tweens" value={stats.tweens} />
            <Stat label="timelines" value={stats.timelines} />
            <Stat label="scroll triggers" value={stats.scrollTriggers} />
            <Stat label="CSS animations" value={stats.cssAnimations} />
          </div>
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <Clapperboard className="h-4 w-4 shrink-0" />
            {stats.gsapVersion ? `GSAP v${stats.gsapVersion}` : 'No GSAP detected'}
            {stats.splitTextPresent && ' · SplitText present'}
            {stats.clipPath && ' · clip-path set'}
          </p>
        </>
      ) : (
        <p className="text-xs text-muted">
          No runtime data extracted — the element may have disappeared, or the page blocked
          extraction.
        </p>
      )}
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
