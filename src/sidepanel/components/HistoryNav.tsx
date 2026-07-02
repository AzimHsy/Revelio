import { ChevronLeft, ChevronRight, History } from 'lucide-react'

// Back/forward through recent analyses. index 0 = newest; left goes older.
export default function HistoryNav({
  index,
  total,
  onOlder,
  onNewer,
}: {
  index: number
  total: number
  onOlder: () => void
  onNewer: () => void
}) {
  return (
    <div className="flex items-center justify-between px-3 pt-3">
      <span className="flex items-center gap-1.5 text-[10px] font-medium tracking-wider text-muted uppercase">
        <History className="h-4 w-4" />
        Recent · {index + 1} / {total}
      </span>
      <div className="flex items-center gap-1">
        <NavButton onClick={onOlder} disabled={index >= total - 1} title="Older">
          <ChevronLeft className="h-4 w-4" />
        </NavButton>
        <NavButton onClick={onNewer} disabled={index <= 0} title="Newer">
          <ChevronRight className="h-4 w-4" />
        </NavButton>
      </div>
    </div>
  )
}

function NavButton({
  onClick,
  disabled,
  title,
  children,
}: {
  onClick: () => void
  disabled: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="flex items-center justify-center rounded-md bg-raised p-1 text-muted transition-colors enabled:hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  )
}
