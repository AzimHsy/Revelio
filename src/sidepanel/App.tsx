import { CircleAlert, LoaderCircle } from 'lucide-react'
import { toCaptureStats } from '../lib/history'
import type { CropRect, SelectedTarget } from '../lib/types'
import AnimationList from './components/AnimationList'
import ApiKeyForm from './components/ApiKeyForm'
import CaptureSummary from './components/CaptureSummary'
import Header from './components/Header'
import HistoryList from './components/HistoryList'
import IdleState from './components/IdleState'
import RecordingView from './components/RecordingView'
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
    recording,
    scanItems,
    scanning,
    selectedScanId,
    startInspect,
    stopInspect,
    selectEntry,
    clearHistory,
    startRecording,
    stopRecording,
    replayOnPage,
    scanPage,
    selectScanItem,
    highlightTarget,
    clearHighlight,
  } = useInspection()

  const entry = history[viewIndex] ?? null
  // Recording crops to whichever element is currently shown (live or history).
  const shownTarget = pending?.target ?? entry?.target ?? null
  const onStartRecording = () => startRecording(cropFromTarget(shownTarget))
  const selector = shownTarget?.kind === 'element' ? shownTarget.selector : null
  const onReplay = selector ? () => replayOnPage(selector) : undefined

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
            <RecordingView
              recording={recording}
              onStart={onStartRecording}
              onStop={stopRecording}
              onReplay={onReplay}
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
        ) : (
          // Idle: data-driven scan list (V2 Unit 2) above history / the idle prompt.
          <>
            <AnimationList
              items={scanItems}
              scanning={scanning}
              selectedId={selectedScanId}
              onScan={scanPage}
              onSelect={selectScanItem}
              onHover={highlightTarget}
              onLeave={clearHighlight}
            />
            {entry ? (
              <>
                <HistoryList
                  entries={history}
                  activeIndex={viewIndex}
                  onSelect={selectEntry}
                  onClear={clearHistory}
                />
                <CaptureSummary target={entry.target} stats={entry.stats} thumbnail={entry.thumbnail} />
                <RecordingView
                  recording={recording}
                  onStart={onStartRecording}
                  onStop={stopRecording}
                  onReplay={onReplay}
                />
                <ResultView result={entry.result} clone={entry.clone} />
              </>
            ) : scanItems.length === 0 && !scanning ? (
              <IdleState />
            ) : null}
          </>
        )}
      </main>
    </div>
  )
}

// Element captures crop the recording to the element; viewport captures (and a
// missing target) record the whole tab.
function cropFromTarget(target: SelectedTarget | null): CropRect | null {
  if (!target || target.kind !== 'element') return null
  return {
    x: target.rect.x,
    y: target.rect.y,
    width: target.rect.width,
    height: target.rect.height,
    viewportWidth: target.viewport.width,
    viewportHeight: target.viewport.height,
  }
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <p className="m-3 mb-0 flex items-center gap-2 rounded-lg border border-error/40 bg-surface p-3 text-xs text-error">
      <CircleAlert className="h-4 w-4 shrink-0" />
      {message}
    </p>
  )
}
