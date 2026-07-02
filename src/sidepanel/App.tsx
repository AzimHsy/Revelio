import { CircleAlert, LoaderCircle } from 'lucide-react'
import { toCaptureStats } from '../lib/history'
import ApiKeyForm from './components/ApiKeyForm'
import CaptureSummary from './components/CaptureSummary'
import Header from './components/Header'
import HistoryList from './components/HistoryList'
import IdleState from './components/IdleState'
import ResultView from './components/ResultView'
import { useInspection } from './useInspection'

// Side panel: single vertical column — header (status + controls), then the
// body. While a capture is in flight (`pending`) the live/streaming view shows;
// otherwise the selected history entry shows with back/forward navigation.
export default function App() {
  const {
    status,
    history,
    viewIndex,
    pending,
    error,
    analysisError,
    startInspect,
    stopInspect,
    selectEntry,
    clearHistory,
  } = useInspection()

  const entry = history[viewIndex] ?? null

  return (
    <div className="flex min-h-screen flex-col bg-base font-sans text-primary">
      <Header status={status} onStartInspect={startInspect} onStopInspect={stopInspect} />
      <main className="flex flex-1 flex-col">
        {error && <ErrorBanner message={error} />}

        {pending ? (
          // Live capture being analyzed (or just errored) — not yet in history.
          <>
            <CaptureSummary
              target={pending.target}
              stats={toCaptureStats(pending.payload)}
              thumbnail={pending.thumbnail}
            />
            {analysisError && !analysisError.missingKey && (
              <ErrorBanner message={analysisError.reason} />
            )}
            {analysisError?.missingKey && <ApiKeyForm />}
            {status === 'analyzing' && !pending.result && (
              <p className="flex items-center gap-2 px-3 pb-3 text-xs text-muted">
                <LoaderCircle className="h-4 w-4 animate-spin text-accent" />
                Asking Claude to identify the technique…
              </p>
            )}
            {pending.result && (
              <ResultView
                result={pending.result}
                clone={pending.clone}
                streaming={status === 'analyzing'}
              />
            )}
          </>
        ) : entry ? (
          // Viewing saved history.
          <>
            <HistoryList
              entries={history}
              activeIndex={viewIndex}
              onSelect={selectEntry}
              onClear={clearHistory}
            />
            <CaptureSummary target={entry.target} stats={entry.stats} thumbnail={entry.thumbnail} />
            <ResultView result={entry.result} clone={entry.clone} />
          </>
        ) : (
          <IdleState />
        )}
      </main>
    </div>
  )
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <p className="m-3 mb-0 flex items-center gap-2 rounded-lg border border-error/40 bg-surface p-3 text-xs text-error">
      <CircleAlert className="h-4 w-4 shrink-0" />
      {message}
    </p>
  )
}
