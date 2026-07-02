import { Crosshair } from 'lucide-react'

interface HeaderProps {
  status: 'idle' | 'inspecting' | 'analyzing'
}

const statusLabel: Record<HeaderProps['status'], string> = {
  idle: 'Idle',
  inspecting: 'Inspecting…',
  analyzing: 'Analyzing…',
}

// Panel header: app name, current status, and the inspect control.
// The inspect button is disabled until the content script exists (Next Up #2)
// — the panel never touches the page directly (architecture.md).
export default function Header({ status }: HeaderProps) {
  return (
    <header className="flex items-center justify-between border-b border-line bg-surface px-4 py-3">
      <div className="flex items-center gap-2">
        <h1 className="text-sm font-semibold text-primary">Revelio</h1>
        <span className="flex items-center gap-1.5 rounded-md bg-raised px-2 py-0.5 text-xs text-muted">
          <span
            className={`h-1.5 w-1.5 rounded-full ${status === 'idle' ? 'bg-muted' : 'bg-accent'}`}
          />
          {statusLabel[status]}
        </span>
      </div>
      <button
        type="button"
        disabled
        title="Element inspection arrives with the content script"
        className="flex items-center gap-1.5 rounded-md bg-raised px-2.5 py-1.5 text-xs font-medium text-muted transition-colors enabled:hover:bg-accent enabled:hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Crosshair className="h-4 w-4" />
        Inspect
      </button>
    </header>
  )
}
