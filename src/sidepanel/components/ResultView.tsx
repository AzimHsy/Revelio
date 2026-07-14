import { Sparkles } from 'lucide-react'
import type { AnalysisParameter, AnalysisResult, ElementClone, ParameterLabel } from '../../lib/types'
import CodeBlock from './CodeBlock'
import PreviewStage from './PreviewStage'
import PromptBlock from './PromptBlock'

// Analysis result. A rules-tier brief (V2 Unit 3/4) is presented PROMPT-FIRST —
// Concept → Explanation → Parameters → Prompt (Copy = primary CTA), no live code
// or preview. Everything else (legacy V1 history, streaming Claude analysis) keeps
// the original code-first layout unchanged, including the streaming caret.
export default function ResultView({
  result,
  clone,
  streaming = false,
}: {
  result: AnalysisResult
  clone?: ElementClone | null
  streaming?: boolean
}) {
  if (result.tier === 'rules' || result.tier === 'deep') {
    return <BriefView result={result} clone={clone} streaming={streaming} />
  }
  return <AnalysisView result={result} clone={clone} streaming={streaming} />
}

// Prompt-first brief (rules + deep tiers): Concept → Explanation → Parameters →
// Prompt, then GSAP code + Preview only when present (deep analyse has them; a
// rules brief carries only the prompt, in `gsapCode`).
function BriefView({
  result,
  clone,
  streaming,
}: {
  result: AnalysisResult
  clone?: ElementClone | null
  streaming: boolean
}) {
  const isRules = result.tier === 'rules'
  // A rules brief keeps its prompt in gsapCode and has no live code/preview.
  const promptText = isRules ? result.gsapCode : (result.prompt ?? '')
  const codeText = isRules ? '' : result.gsapCode
  const previewText = isRules ? '' : result.previewCode
  const hasParams = result.parameters.length > 0
  const caretOn = !streaming
    ? null
    : hasParams
      ? 'parameters'
      : codeText
        ? 'code'
        : promptText
          ? 'prompt'
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

      <ParametersSection parameters={result.parameters} />

      {promptText && (
        <section className="flex flex-col gap-1.5">
          <SectionLabel>Prompt</SectionLabel>
          <PromptBlock prompt={promptText} />
        </section>
      )}

      {codeText && (
        <section className="flex flex-col gap-1.5">
          <SectionLabel>GSAP code</SectionLabel>
          <CodeBlock code={codeText} />
        </section>
      )}

      {!streaming && previewText && <PreviewStage code={previewText} clone={clone} />}
    </div>
  )
}

// Code-first layout (legacy V1 history + streaming Claude analysis): concept →
// explanation → code → preview → parameters, with a blinking caret trailing the
// deepest section still streaming.
function AnalysisView({
  result,
  clone,
  streaming,
}: {
  result: AnalysisResult
  clone?: ElementClone | null
  streaming: boolean
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

      <ParametersSection parameters={result.parameters} />
    </div>
  )
}

function ParametersSection({ parameters }: { parameters: AnalysisParameter[] }) {
  if (parameters.length === 0) return null
  return (
    <section className="flex flex-col gap-1.5">
      <SectionLabel>Parameters</SectionLabel>
      <ul className="flex flex-col gap-1.5">
        {parameters.map((param) => (
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
