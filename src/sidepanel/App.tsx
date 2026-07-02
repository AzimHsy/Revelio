import { CircleAlert, LoaderCircle } from 'lucide-react'
import ApiKeyForm from './components/ApiKeyForm'
import CaptureSummary from './components/CaptureSummary'
import Header from './components/Header'
import IdleState from './components/IdleState'
import ResultView from './components/ResultView'
import { useInspection } from './useInspection'

// Side panel: single vertical column — header (status + controls), then the
// body: capture context, then the analysis sections in spec order
// (concept → explanation → code → parameters).
export default function App() {
  const { status, capture, result, error, analysisError, startInspect, stopInspect } =
    useInspection()

  return (
    <div className="flex min-h-screen flex-col bg-base font-sans text-primary">
      <Header status={status} onStartInspect={startInspect} onStopInspect={stopInspect} />
      <main className="flex flex-1 flex-col">
        {error && <ErrorBanner message={error} />}
        {analysisError && !analysisError.missingKey && (
          <ErrorBanner message={analysisError.reason} />
        )}
        {analysisError?.missingKey && <ApiKeyForm />}
        {capture ? (
          <>
            <CaptureSummary capture={capture} />
            {status === 'analyzing' && (
              <p className="flex items-center gap-2 px-3 pb-3 text-xs text-muted">
                <LoaderCircle className="h-4 w-4 animate-spin text-accent" />
                Asking Claude to identify the technique…
              </p>
            )}
            {result && <ResultView result={result} />}
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
