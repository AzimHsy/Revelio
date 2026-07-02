import { MousePointerClick } from 'lucide-react'

// Empty/idle state per ui-context.md: a short prompt telling the user to click
// an element or press Ctrl+Shift+A.
export default function IdleState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-surface">
        <MousePointerClick className="h-5 w-5 text-accent" />
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-primary">Nothing inspected yet</p>
        <p className="max-w-60 text-xs leading-relaxed text-muted">
          Click an element on the page to inspect its animation, or press{' '}
          <Kbd>Ctrl+Shift+A</Kbd> to capture the current section.
        </p>
        <p className="max-w-60 text-xs leading-relaxed text-muted">
          While inspecting, refine the target with the keyboard: <Kbd>↑</Kbd> parent,{' '}
          <Kbd>↓</Kbd> child, <Kbd>←</Kbd> <Kbd>→</Kbd> siblings, <Kbd>[</Kbd> <Kbd>]</Kbd> to
          reach elements under a blocking container, then <Kbd>Enter</Kbd> to pick.
        </p>
      </div>
    </div>
  )
}

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="rounded-md border border-line bg-raised px-1.5 py-0.5 font-mono text-[10px] text-primary">
      {children}
    </kbd>
  )
}
