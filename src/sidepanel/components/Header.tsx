import { Crosshair, X } from 'lucide-react'
import type { PanelStatus } from '../useInspection'

interface HeaderProps {
  status: PanelStatus
  onStartInspect: () => void
  onStopInspect: () => void
}

const statusLabel: Record<PanelStatus, string> = {
  idle: 'Idle',
  inspecting: 'Inspecting…',
  analyzing: 'Analyzing…',
}

// Panel header: app name, current status, and the inspect control. The button
// only sends commands to the background — the panel never touches the page
// directly (architecture.md).
export default function Header({ status, onStartInspect, onStopInspect }: HeaderProps) {
  const inspecting = status === 'inspecting'
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
        disabled={status === 'analyzing'}
        onClick={inspecting ? onStopInspect : onStartInspect}
        className="flex items-center gap-1.5 rounded-md bg-raised px-2.5 py-1.5 text-xs font-medium text-muted transition-colors enabled:hover:bg-accent enabled:hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
      >
        {inspecting ? <X className="h-4 w-4" /> : <Crosshair className="h-4 w-4" />}
        {inspecting ? 'Cancel' : 'Inspect'}
      </button>
    </header>
  )
}
