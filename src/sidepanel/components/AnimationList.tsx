import { LoaderCircle, RefreshCw, ScanSearch } from 'lucide-react'
import type { ScanItem, ScanSource } from '../../lib/types'

// Data-driven capture list (V2 Unit 2): every animation the page exposes, so the
// user picks from data instead of hit-testing the DOM. Hovering a row highlights
// the element on the page; clicking selects it (the Unit 3 classifier will turn
// a selection into a brief). Scanning makes zero API calls.
export default function AnimationList({
  items,
  scanning,
  selectedId,
  onScan,
  onSelect,
  onHover,
  onLeave,
}: {
  items: ScanItem[]
  scanning: boolean
  selectedId: string | null
  onScan: () => void
  onSelect: (id: string) => void
  onHover: (selector: string) => void
  onLeave: () => void
}) {
  return (
    <section className="flex flex-col gap-1.5 px-3 pt-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium tracking-wider text-muted uppercase">Animations</span>
        <button
          type="button"
          onClick={onScan}
          disabled={scanning}
          title="Scan the page for animations (no API call)"
          className="flex items-center gap-1 rounded-md bg-raised px-2 py-1 text-[11px] font-medium text-primary transition-colors enabled:hover:bg-surface disabled:opacity-50"
        >
          {items.length > 0 ? <RefreshCw className="h-3.5 w-3.5 text-accent" /> : <ScanSearch className="h-3.5 w-3.5 text-accent" />}
          {items.length > 0 ? 'Re-scan' : 'Scan page'}
        </button>
      </div>

      {scanning ? (
        <p className="flex items-center gap-2 py-1 text-xs text-muted">
          <LoaderCircle className="h-4 w-4 animate-spin text-accent" />
          Scanning the page…
        </p>
      ) : items.length === 0 ? (
        <p className="text-[11px] leading-relaxed text-muted">
          Scan the page to list its animations — then pick one, or hover a row to find it on the page.
        </p>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {items.map((item) => {
            const active = item.id === selectedId
            return (
              <li key={item.id} className="flex flex-col">
                <button
                  type="button"
                  onMouseEnter={() => onHover(item.target)}
                  onMouseLeave={onLeave}
                  onClick={() => onSelect(item.id)}
                  title={item.target}
                  className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors ${
                    active ? 'bg-raised' : 'hover:bg-surface'
                  }`}
                >
                  <span className="min-w-0 flex-1 truncate font-mono text-xs text-primary">{item.target}</span>
                  <KindBadge kind={item.kindGuess} />
                  <SourceBadge source={item.source} />
                </button>
                {item.source === 'hover?' && (
                  <span className="px-2 pb-0.5 text-[10px] text-muted">hover it on the page to capture the real tween</span>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function KindBadge({ kind }: { kind: string }) {
  return (
    <span className="shrink-0 rounded-md bg-surface px-1.5 py-0.5 text-[9px] tracking-wide text-muted uppercase">
      {kind}
    </span>
  )
}

// Where the data came from — registry (creation-time SOURCE truth) reads as the
// most trustworthy, hover? as tentative.
const SOURCE_STYLES: Record<ScanSource, { label: string; className: string; title: string }> = {
  registry: { label: 'source', className: 'border-success/40 text-success', title: 'Captured at creation time — real values' },
  live: { label: 'live', className: 'border-accent/40 text-accent', title: 'Read from a live GSAP tween/trigger' },
  css: { label: 'css', className: 'border-line text-muted', title: 'CSS animation/transition' },
  'hover?': { label: 'hover?', className: 'border-line text-muted', title: 'Only a place to hover — trigger it to capture' },
}

function SourceBadge({ source }: { source: ScanSource }) {
  const style = SOURCE_STYLES[source] ?? SOURCE_STYLES.css
  return (
    <span
      title={style.title}
      className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[9px] font-medium tracking-wider uppercase ${style.className}`}
    >
      {style.label}
    </span>
  )
}
