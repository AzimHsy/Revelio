import { Check, Copy } from 'lucide-react'
import { useState } from 'react'

// Full-width mono block with a copy button in the corner (ui-context.md).
export default function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)

  function copy(): void {
    void navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <div className="relative rounded-lg border border-line bg-raised">
      <button
        type="button"
        onClick={copy}
        title="Copy code"
        className="absolute top-2 right-2 flex items-center gap-1 rounded-md bg-surface px-2 py-1 text-xs text-muted transition-colors hover:text-primary"
      >
        {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
        {copied ? 'Copied' : 'Copy'}
      </button>
      <pre className="overflow-x-auto p-3 pr-20 font-mono text-xs leading-relaxed text-primary">
        <code>{code}</code>
      </pre>
    </div>
  )
}
