import { MousePointerClick } from 'lucide-react'

// Empty/idle state per ui-context.md: a short prompt telling the user to click
// an element or press Ctrl+Shift+A.
export default function IdleState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-surface">
        <MousePointerClick className="h-5 w-5 text-accent" />
      </div>
      <div className="flex flex-col gap-1.5">
        <p className="text-sm font-medium text-primary">Nothing inspected yet</p>
        <p className="max-w-60 text-xs leading-relaxed text-muted">
          Click an element on the page to inspect its animation, or press{' '}
          <kbd className="rounded-md border border-line bg-raised px-1.5 py-0.5 font-mono text-[10px] text-primary">
            Ctrl+Shift+A
          </kbd>{' '}
          to capture the current section.
        </p>
      </div>
    </div>
  )
}
