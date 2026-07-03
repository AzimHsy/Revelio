import { useEffect, useState } from 'react'
import { CircleAlert, Download, RotateCw, Square, Video } from 'lucide-react'
import type { RecordingState } from '../useInspection'

// Records the real element's animation from the tab (via tabCapture in the
// background) and plays the clip back. Because CSS :hover can't be faked, the
// user triggers the animation themselves (hover/scroll) while recording — or
// uses "Replay on page" to re-fire a scroll-triggered reveal.
export default function RecordingView({
  recording,
  onStart,
  onStop,
  onReplay,
}: {
  recording: RecordingState
  onStart: () => void
  onStop: () => void
  onReplay?: () => void
}) {
  const elapsed = useElapsed(recording.isRecording)

  return (
    <section className="flex flex-col gap-1.5 px-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium tracking-wider text-muted uppercase">
          Recording
        </span>
        {recording.isRecording ? (
          <button
            type="button"
            onClick={onStop}
            className="flex items-center gap-1.5 rounded-md bg-error/15 px-2 py-1 text-[11px] font-medium text-error transition-colors hover:bg-error/25"
          >
            <Square className="h-3.5 w-3.5 fill-current" />
            Stop {elapsed > 0 && `· ${elapsed}s`}
          </button>
        ) : (
          <button
            type="button"
            onClick={onStart}
            className="flex items-center gap-1.5 rounded-md bg-raised px-2 py-1 text-[11px] font-medium text-primary transition-colors hover:bg-surface"
          >
            <Video className="h-3.5 w-3.5 text-accent" />
            Record
          </button>
        )}
      </div>

      {!recording.isRecording && !recording.url && (
        <p className="text-[11px] leading-relaxed text-muted">
          Tip: if Record fails, click the Revelio toolbar icon on the page first to enable capture — a
          page reload clears it.
        </p>
      )}

      {recording.isRecording && (
        <div className="flex flex-col gap-1.5">
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-error" />
            Recording the tab — trigger the animation on the page, then Stop.
          </p>
          {onReplay && (
            <button
              type="button"
              onClick={onReplay}
              className="flex items-center gap-1.5 self-start rounded-md bg-raised px-2 py-1 text-[11px] text-muted transition-colors hover:text-primary"
            >
              <RotateCw className="h-3.5 w-3.5" />
              Replay on page (scroll)
            </button>
          )}
        </div>
      )}

      {recording.error && (
        <p className="flex items-center gap-1.5 text-xs text-error">
          <CircleAlert className="h-4 w-4 shrink-0" />
          {recording.error}
        </p>
      )}

      {recording.url && !recording.isRecording && (
        <div className="flex flex-col gap-1.5">
          <video
            src={recording.url}
            autoPlay
            loop
            muted
            playsInline
            controls
            className="w-full rounded-md border border-line bg-black"
          />
          <a
            href={recording.url}
            download="revelio-recording.webm"
            className="flex items-center gap-1.5 self-start text-[11px] text-muted transition-colors hover:text-accent"
          >
            <Download className="h-3.5 w-3.5" />
            Download clip
          </a>
        </div>
      )}
    </section>
  )
}

// Seconds elapsed since the current recording started (resets when it stops).
function useElapsed(active: boolean): number {
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    if (!active) {
      setSeconds(0)
      return
    }
    const started = Date.now()
    const id = setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 500)
    return () => clearInterval(id)
  }, [active])
  return seconds
}
