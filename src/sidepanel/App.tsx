import { CircleAlert } from 'lucide-react'
import CaptureSummary from './components/CaptureSummary'
import Header from './components/Header'
import IdleState from './components/IdleState'
import { useInspection } from './useInspection'

// Side panel: single vertical column — header (status + controls), then the
// body. Result sections (concept → explanation → code → parameters) replace
// the capture summary once analysis exists (Next Up: Claude call + rendering).
export default function App() {
  const { status, capture, error, startInspect, stopInspect } = useInspection()

  return (
    <div className="flex min-h-screen flex-col bg-base font-sans text-primary">
      <Header status={status} onStartInspect={startInspect} onStopInspect={stopInspect} />
      <main className="flex flex-1 flex-col">
        {error && (
          <p className="m-3 flex items-center gap-2 rounded-lg border border-error/40 bg-surface p-3 text-xs text-error">
            <CircleAlert className="h-4 w-4 shrink-0" />
            {error}
          </p>
        )}
        {capture ? <CaptureSummary capture={capture} /> : <IdleState />}
      </main>
    </div>
  )
}
