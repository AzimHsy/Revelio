import { LoaderCircle, Sparkles } from 'lucide-react'

// Escalate the current subject to Claude (V2 Unit 5). Deliberately secondary for a
// classified brief (the Tier 1 answer is usually enough) and primary when the
// concept was `unclassified` — that's exactly when the AI escape hatch earns its
// cost. Calling Claude needs an API key; a missing key surfaces via the normal
// ApiKeyForm after the attempt.
export default function DeepAnalyzeButton({
  onClick,
  analyzing,
  primary,
  disabled,
}: {
  onClick: () => void
  analyzing: boolean
  primary: boolean
  disabled?: boolean
}) {
  const base = 'flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50'
  const tone = primary
    ? 'bg-accent text-primary hover:opacity-90'
    : 'bg-raised text-muted enabled:hover:text-primary enabled:hover:bg-surface'

  return (
    <button type="button" onClick={onClick} disabled={disabled || analyzing} className={`${base} ${tone}`}>
      {analyzing ? (
        <LoaderCircle className="h-4 w-4 animate-spin" />
      ) : (
        <Sparkles className="h-4 w-4 text-accent" />
      )}
      {analyzing ? 'Asking Claude…' : primary ? 'Deep analyse with Claude' : 'Deep analyse'}
    </button>
  )
}
