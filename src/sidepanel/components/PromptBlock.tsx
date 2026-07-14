import { Check, Copy } from 'lucide-react'
import { useState } from 'react'

// The paste-ready prompt is the PRODUCT of a rules-tier brief (V2 Unit 4), so
// Copy is the primary call to action — a full-width accent button, not the small
// corner button a code block uses. The text is prose with line breaks, so it
// wraps (whitespace-pre-wrap) rather than scrolling like code.
export default function PromptBlock({ prompt }: { prompt: string }) {
  const [copied, setCopied] = useState(false)

  function copy(): void {
    void navigator.clipboard.writeText(prompt).then(() => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-accent/30 bg-surface p-3">
      <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-primary">{prompt}</pre>
      <button
        type="button"
        onClick={copy}
        className="flex items-center justify-center gap-1.5 rounded-md bg-accent px-3 py-2 text-xs font-medium text-primary transition-opacity hover:opacity-90"
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        {copied ? 'Copied — paste into your agent' : 'Copy prompt'}
      </button>
    </div>
  )
}
