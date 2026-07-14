import { CircleAlert, LoaderCircle, MousePointerClick } from 'lucide-react'
import { toCaptureStats } from '../lib/history'
import type { CropRect, SelectedTarget } from '../lib/types'
import AnimationList from './components/AnimationList'
import ApiKeyForm from './components/ApiKeyForm'
import CaptureSummary from './components/CaptureSummary'
import DeepAnalyzeButton from './components/DeepAnalyzeButton'
import Header from './components/Header'
import HistoryList from './components/HistoryList'
import IdleState from './components/IdleState'
import RecordingView from './components/RecordingView'
import ResultView from './components/ResultView'
import { useInspection } from './useInspection'

// Side panel: single vertical column — header, then the body. Primary V2 flow is
// scan → pick a row → instant Tier 1 brief (zero network) → optional Deep analyse
// (Claude). Click-to-inspect an element is the secondary path; it no longer
// auto-analyzes — it offers Deep analyse on demand.
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
    brief,
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
    deepAnalyze,
  } = useInspection()

  const entry = history[viewIndex] ?? null
  // Recording crops to whichever element is currently shown (live or history).
  const shownTarget = pending?.target ?? entry?.target ?? null
  const onStartRecording = () => startRecording(cropFromTarget(shownTarget))
  const selector = shownTarget?.kind === 'element' ? shownTarget.selector : null
  const onReplay = selector ? () => replayOnPage(selector) : undefined
  const analyzing = status === 'analyzing'

  return (
    <div className="flex min-h-screen flex-col bg-base font-sans text-primary">
      <Header status={status} onStartInspect={startInspect} onStopInspect={stopInspect} />
      <main className="flex flex-1 flex-col">
        {error && <ErrorBanner message={error} />}

        {pending ? (
          // Click-to-inspect element capture (secondary path). No auto-analyze —
          // Deep analyse is on demand.
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
            {analyzing && !pending.result && <AnalyzingLine />}
            {pending.result && (
              <ResultView result={pending.result} clone={pending.clone} streaming={analyzing} />
            )}
            {pending.payload && !analyzing && !pending.result && (
              <div className="px-3 pb-4">
                <DeepAnalyzeButton onClick={deepAnalyze} analyzing={false} primary />
              </div>
            )}
          </>
        ) : (
          // Data-driven scan list (V2 Unit 2) above the picked brief / history / idle.
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
            {brief ? (
              // Picked scan item → instant Tier 1 brief; Deep analyse escalates it.
              <>
                <PickedHeader target={brief.item.target} />
                {analysisError && !analysisError.missingKey && (
                  <ErrorBanner message={analysisError.reason} />
                )}
                {analysisError?.missingKey && <ApiKeyForm />}
                {analyzing && !brief.result && <AnalyzingLine />}
                {brief.result && <ResultView result={brief.result} streaming={analyzing} />}
                {!analyzing && (
                  <div className="px-3 pb-4">
                    <DeepAnalyzeButton
                      onClick={deepAnalyze}
                      analyzing={false}
                      primary={brief.result?.concept === 'unclassified'}
                    />
                  </div>
                )}
              </>
            ) : entry ? (
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

function PickedHeader({ target }: { target: string }) {
  return (
    <section className="m-3 mb-0 flex items-center gap-2 rounded-lg border border-line bg-surface p-3">
      <MousePointerClick className="h-4 w-4 shrink-0 text-accent" />
      <span className="truncate font-mono text-xs text-primary" title={target}>
        {target}
      </span>
    </section>
  )
}

function AnalyzingLine() {
  return (
    <p className="flex items-center gap-2 px-3 pb-3 text-xs text-muted">
      <LoaderCircle className="h-4 w-4 animate-spin text-accent" />
      Asking Claude to identify the technique…
    </p>
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
