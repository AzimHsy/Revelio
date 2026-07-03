import { Sparkles } from 'lucide-react'
import type { AnalysisResult, ElementClone, ParameterLabel } from '../../lib/types'
import CodeBlock from './CodeBlock'
import PreviewStage from './PreviewStage'

// Analysis result, stacked in spec order: concept → explanation → code →
// parameters (ui-context.md → Layout Patterns). Renders partial results too —
// each section appears as it streams in, so empty sections are skipped and a
// blinking caret trails the last-filled section while `streaming`.
export default function ResultView({
  result,
  clone,
  streaming = false,
}: {
  result: AnalysisResult
  clone?: ElementClone | null
  streaming?: boolean
}) {
  const hasParams = result.parameters.length > 0
  // The caret sits on the deepest section that has content so far.
  const caretOn = !streaming
    ? null
    : hasParams
      ? 'parameters'
      : result.gsapCode
        ? 'code'
        : result.explanation
          ? 'explanation'
          : result.concept
            ? 'concept'
            : null

  return (
    <div className="flex flex-col gap-4 px-3 pb-4">
      {result.concept && (
        <section className="flex flex-col gap-1">
          <SectionLabel>Concept</SectionLabel>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-accent">
            <Sparkles className="h-4 w-4 shrink-0" />
            {result.concept}
            {caretOn === 'concept' && <Caret />}
          </h2>
        </section>
      )}

      {result.explanation && (
        <section className="flex flex-col gap-1">
          <SectionLabel>Explanation</SectionLabel>
          <p className="text-xs leading-relaxed text-primary">
            {result.explanation}
            {caretOn === 'explanation' && <Caret />}
          </p>
        </section>
      )}

      {result.gsapCode && (
        <section className="flex flex-col gap-1.5">
          <SectionLabel>GSAP code</SectionLabel>
          <CodeBlock code={result.gsapCode} />
        </section>
      )}

      {/* Only run the preview once streaming has finished — partial code
          mid-stream would be a syntax error, and re-mounting the iframe every
          120ms partial is wasteful. */}
      {!streaming && result.previewCode && (
        <PreviewStage code={result.previewCode} clone={clone} />
      )}

      {hasParams && (
        <section className="flex flex-col gap-1.5">
          <SectionLabel>Parameters</SectionLabel>
          <ul className="flex flex-col gap-1.5">
            {result.parameters.map((param) => (
              <li key={param.name} className="rounded-md bg-surface p-2.5">
                <p className="flex items-center gap-2 font-mono text-xs text-primary">
                  <span>
                    {param.name}
                    {param.value && <span className="text-accent"> = {param.value}</span>}
                  </span>
                  <LabelChip label={param.label} />
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted">{param.description}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function SectionLabel({ children }: { children: string }) {
  return (
    <span className="text-[10px] font-medium tracking-wider text-muted uppercase">{children}</span>
  )
}

function Caret() {
  return <span className="ml-0.5 inline-block h-3 w-1.5 animate-pulse bg-accent align-middle" />
}

// Honesty label for a parameter's value (enhancement 1): SOURCE = read from the
// runtime capture, GUESS = inferred, PARTIAL = in between. Colored so trustworthy
// values (SOURCE) read as confident and guesses read as tentative.
const LABEL_STYLES: Record<ParameterLabel, { className: string; title: string }> = {
  SOURCE: {
    className: 'border-success/40 text-success',
    title: 'Read from the captured runtime data',
  },
  PARTIAL: {
    className: 'border-accent/40 text-accent',
    title: 'Partially inferred from the runtime data',
  },
  GUESS: {
    className: 'border-line text-muted',
    title: 'Inferred — no runtime value backed this',
  },
}

function LabelChip({ label }: { label: ParameterLabel }) {
  const style = LABEL_STYLES[label] ?? LABEL_STYLES.GUESS
  return (
    <span
      title={style.title}
      className={`ml-auto shrink-0 rounded-md border px-1.5 py-0.5 text-[9px] font-medium tracking-wider uppercase ${style.className}`}
    >
      {label}
    </span>
  )
}
