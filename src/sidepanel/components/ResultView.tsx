import { Sparkles } from 'lucide-react'
import type { AnalysisResult } from '../../lib/types'
import CodeBlock from './CodeBlock'

// Analysis result, stacked in spec order: concept → explanation → code →
// parameters (ui-context.md → Layout Patterns).
export default function ResultView({ result }: { result: AnalysisResult }) {
  return (
    <div className="flex flex-col gap-4 px-3 pb-4">
      <section className="flex flex-col gap-1">
        <SectionLabel>Concept</SectionLabel>
        <h2 className="flex items-center gap-2 text-sm font-semibold text-accent">
          <Sparkles className="h-4 w-4 shrink-0" />
          {result.concept}
        </h2>
      </section>

      <section className="flex flex-col gap-1">
        <SectionLabel>Explanation</SectionLabel>
        <p className="text-xs leading-relaxed text-primary">{result.explanation}</p>
      </section>

      <section className="flex flex-col gap-1.5">
        <SectionLabel>GSAP code</SectionLabel>
        <CodeBlock code={result.gsapCode} />
      </section>

      {result.parameters.length > 0 && (
        <section className="flex flex-col gap-1.5">
          <SectionLabel>Parameters</SectionLabel>
          <ul className="flex flex-col gap-1.5">
            {result.parameters.map((param) => (
              <li key={param.name} className="rounded-md bg-surface p-2.5">
                <p className="font-mono text-xs text-primary">
                  {param.name}
                  {param.value && <span className="text-accent"> = {param.value}</span>}
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
