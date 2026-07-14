# UI Context

## Theme

Dark only. No light mode. The side panel is a compact technical surface — a near-black
background, one layered surface for cards, and a single vivid accent for interactive
elements and concept highlights. It should read like a focused inspector, not a marketing
page.

> The palette below is a starting suggestion. You're the design lead — swap any token.

## Colors

All components must use these tokens — no hardcoded hex values.

| Role            | CSS Variable       | Value     |
| --------------- | ------------------ | --------- |
| Page background | `--bg-base`        | `#0A0A0B` |
| Surface         | `--bg-surface`     | `#141417` |
| Surface (raised)| `--bg-raised`      | `#1C1C21` |
| Primary text    | `--text-primary`   | `#ECECEE` |
| Muted text      | `--text-muted`     | `#8A8A93` |
| Primary accent  | `--accent-primary` | `#6E56F7` |
| Border          | `--border-default` | `#232328` |
| Error           | `--state-error`    | `#F0506E` |
| Success         | `--state-success`  | `#2ECC71` |

> Accent option: if you want a nod to GSAP, swap `--accent-primary` for a GSAP-style green
> instead of the violet. Pick one and keep it single — the inspector reads cleaner with one
> accent.

## Typography

Code output is central to this tool, so the mono choice matters — pick one with strong
readability for long snippets.

| Role      | Font                          | Variable      |
| --------- | ----------------------------- | ------------- |
| UI text   | Geist Sans (or Inter)         | `--font-sans` |
| Code/mono | Geist Mono (or JetBrains Mono)| `--font-mono` |

## Border Radius

| Context           | Class        |
| ----------------- | ------------ |
| Inline / small UI | `rounded-md` |
| Cards / panels    | `rounded-lg` |
| Modals / overlays | `rounded-xl` |

## Component Library

Keep it light for an extension. Hand-roll the few components needed with Tailwind, rather
than pulling a heavy library into the bundle. shadcn/ui is fine if you want it, but the side
panel is small enough not to need it.

## Layout Patterns

- Side panel: single vertical column — header (status + controls), then the body.
- **Scan list** (primary): a `Scan page` / `Re-scan` control above a list of animation rows,
  each showing the target label + a kind badge + a source badge (`source`/`live`/`css`/`hover?`).
  Hovering a row highlights that element on the page.
- **Brief (prompt-first)**: a picked scan item renders in order **concept → explanation →
  parameters (with SOURCE/PARTIAL/GUESS chips) → prompt**. The prompt block is the product:
  full-width, with an accent **Copy prompt** button as the primary call to action. A
  **Deep analyse** button sits below it (secondary; visually primary when the concept is
  `unclassified`). Deep-analyse results additionally show GSAP code + a live preview after the prompt.
- Legacy / streaming Claude results keep the older code-first order (concept → explanation →
  code → preview → parameters) with a blinking caret while streaming.
- Code blocks: full-width mono block with a copy button in the corner.
- Selection state: a highlight overlay drawn on the inspected element by the content script —
  not by the panel (reused to flash a scanned element on row hover).
- Empty / idle state: a short prompt telling the user to Scan the page (or click an element /
  press `Ctrl+Shift+A` as the secondary path).

## Icons

Lucide React. Stroke-based icons only. `h-4 w-4` for inline, `h-5 w-5` for buttons.
