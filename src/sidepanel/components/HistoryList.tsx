import { Trash2 } from 'lucide-react'
import type { HistoryEntry } from '../../lib/types'

// Recent analyses as a labeled list — click a concept to view it, or clear all.
// Replaces the older one-at-a-time back/forward nav.
export default function HistoryList({
  entries,
  activeIndex,
  onSelect,
  onClear,
}: {
  entries: HistoryEntry[]
  activeIndex: number
  onSelect: (index: number) => void
  onClear: () => void
}) {
  return (
    <div className="flex flex-col gap-1 px-3 pt-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium tracking-wider text-muted uppercase">Recent</span>
        <button
          type="button"
          onClick={onClear}
          title="Clear history"
          className="flex items-center gap-1 text-[10px] text-muted transition-colors hover:text-error"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Clear
        </button>
      </div>
      <ul className="flex flex-col gap-0.5">
        {entries.map((entry, index) => {
          const active = index === activeIndex
          const target =
            entry.target.kind === 'element'
              ? (entry.target.selector ?? entry.target.tag ?? 'element')
              : 'Current viewport'
          return (
            <li key={entry.id}>
              <button
                type="button"
                onClick={() => onSelect(index)}
                title={target}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors ${
                  active ? 'bg-raised text-primary' : 'text-muted hover:bg-surface hover:text-primary'
                }`}
              >
                {entry.thumbnail ? (
                  <img
                    src={entry.thumbnail}
                    alt=""
                    className="h-7 w-7 shrink-0 rounded object-cover"
                  />
                ) : (
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${active ? 'bg-accent' : 'bg-line'}`}
                  />
                )}
                <span className="truncate">{entry.result.concept || 'Untitled capture'}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
