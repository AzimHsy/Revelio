# Progress Tracker

Update this file after every meaningful implementation change.

## Current Phase

- **V1 pipeline complete + streaming** — inspect/capture → MAIN-world extraction → Claude
  analysis (streamed) → concept/explanation/code/parameters render progressively in the
  panel, with API key onboarding. Verified live on gsap.com. `npm run build` green.

## Current Goal

- End-to-end verification on a real GSAP site (success criteria in
  project-overview.md): load unpacked, set the API key, click an animated element,
  confirm concept + usable GSAP code; verify `Ctrl+Shift+A` on a scroll-driven section.

## Completed

- **Extension scaffold** — Vite 8 + `@crxjs/vite-plugin` 2.7 (stable) + React 19 + TS
  (strict) + Tailwind v4 (`@tailwindcss/vite`), MV3 manifest.
  - `src/manifest.config.ts` defines the MV3 manifest (manifest_version 3, `side_panel`,
    `background` service worker, `sidePanel` + `storage` permissions). Edit this, not the
    generated `dist/manifest.json`.
  - `src/sidepanel/` holds the React app (placeholder "scaffold loaded" view).
  - `src/background/index.ts` is a minimal worker that only sets
    `openPanelOnActionClick` so clicking the toolbar icon opens the panel (needed to make
    the scaffold verifiable in Chrome). No message brokering / Claude call yet.
  - `src/content/`, `src/injected/`, `src/lib/` created as empty placeholders
    (`.gitkeep`) matching the world boundaries in architecture.md — not yet implemented.
  - Design tokens from ui-context.md exposed as Tailwind v4 `@theme` colors in
    `src/sidepanel/index.css` (utilities: `bg-base`, `bg-surface`, `bg-raised`,
    `text-primary`, `text-muted`, `text-accent`, `border-line`, `*-error`, `*-success`).
  - `npm run build` passes (`tsc --noEmit && vite build`).

- **Side panel shell** — header + idle state per ui-context.md layout patterns.
  - `src/sidepanel/components/Header.tsx` — app name, status chip (`idle` /
    `inspecting` / `analyzing` display states), and an Inspect button rendered
    **disabled** until the content script exists (Next Up #1). Panel stays
    presentational — no page access, no messaging.
  - `src/sidepanel/components/IdleState.tsx` — idle prompt: click an element or
    press `Ctrl+Shift+A` (rendered as a `<kbd>` chip).
  - `src/sidepanel/App.tsx` — single vertical column composing Header + body;
    status hardcoded to `'idle'` until the messaging contract lands (Next Up #3).
  - Added `lucide-react` (icon library per ui-context.md; `h-4 w-4` inline).
  - All styling via the `@theme` tokens — no hardcoded hex.

- **Content script** — selection + capture in the isolated world, registered in the
  manifest (`http/https`, `document_idle`).
  - `src/lib/types.ts` — start of the single typed message contract
    (`ToContentMessage` / `FromContentMessage`, `SelectedTarget` payload). Grows
    with each unit; plain JSON only.
  - `src/content/selection.ts` — inspect mode: hover highlights, capture-phase
    click selects (never reaches the page), Escape cancels. Emits
    `ELEMENT_SELECTED` with a best-effort selector (unique `#id` or a short
    `tag.class:nth-of-type` path, max 4 levels).
  - `src/content/overlay.ts` — the highlight box; the only DOM Revelio adds to a
    page (invariant 5). Accent color comes from `src/lib/tokens.ts` (Tailwind
    `@theme` doesn't exist inside inspected pages).
  - `src/content/index.ts` — entry: `START_INSPECT` / `STOP_INSPECT` handler +
    `Ctrl+Shift+A` → `SECTION_CAPTURED` (viewport bounds).
  - Emitted messages have no background listener yet (broker is a later unit);
    they log via `console.debug` for manual verification.

- **MAIN-world injected extractor** — registered as a second manifest content script
  with `world: 'MAIN'` (`src/injected/main.ts`), passive until asked.
  - Bridge: content sends `EXTRACT` over `window.postMessage`
    (`src/content/bridge.ts`, 2s timeout → null payload); injected answers
    `EXTRACT_RESULT` with a `RuntimePayload` or an error string.
  - `src/injected/gsap.ts` — tweens/timelines via `gsap.globalTimeline.getChildren()`,
    ScrollTriggers via `ScrollTrigger.getAll()`; scope = selected element
    (target within/containing selection) or viewport intersection for section
    captures. Everything guarded — page globals are untrusted. Capped
    (30 tweens / 10 timelines / 20 triggers / 20 CSS animations).
  - `src/injected/css.ts` — CSS animations + transitions via `getAnimations()`
    (resolved keyframes + timing, works with cross-origin stylesheets).
  - `src/lib/serialize.ts` — `toJsonSafe` (depth/keys/items/string caps,
    functions → `"[function name]"`, Elements → `"div#id.class"` descriptors)
    enforcing invariant 2 before anything crosses a world.
  - `src/lib/types.ts` grew: `RuntimePayload` (+ tween/timeline/ScrollTrigger/CSS
    shapes), bridge request/response types; `ELEMENT_SELECTED` / `SECTION_CAPTURED`
    now carry `payload: RuntimePayload | null`.

- **Background broker** — `src/background/index.ts` is now the messaging hub.
  - Content messages (recognized by `sender.tab`) are relayed as-is to the side
    panel; panel commands (`PANEL_START_INSPECT` / `PANEL_STOP_INSPECT`) are routed
    to the active tab as `START_INSPECT` / `STOP_INSPECT`.
  - Pages without the content script (chrome://, Web Store, PDFs) surface as a
    `RELAY_ERROR` broadcast so the panel can tell the user instead of failing
    silently. Broadcasts to a closed panel are safely ignored.
  - `src/lib/types.ts`: added `PanelCommand` + `ToPanelMessage`.

- **Sidepanel wiring** — the inspection loop is now user-drivable end to end.
  - `src/sidepanel/useInspection.ts` — all panel messaging in one hook
    (components stay presentational): listens for relayed content events,
    exposes `startInspect` / `stopInspect` commands, tracks
    `status / capture / error`.
  - Header Inspect button live: Inspect ↔ Cancel toggle, status chip follows
    `INSPECT_STARTED` / `INSPECT_CANCELLED`; `RELAY_ERROR` renders as an error
    banner (e.g. on chrome:// pages).
  - `src/sidepanel/components/CaptureSummary.tsx` — interim card after a
    capture: target descriptor + tween/timeline/ScrollTrigger/CSS counts +
    GSAP version/SplitText/clip-path flags. The analysis sections replace the
    panel body in the result-rendering unit; this card stays as the capture
    context above them.

- **Background Claude call** — captures now auto-analyze (core user flow).
  - `@anthropic-ai/sdk` in the service worker (`dangerouslyAllowBrowser` — MV3
    workers count as browser env), `host_permissions` for `api.anthropic.com`.
  - `src/lib/prompt.ts` — system + user prompt in one place; asks for strict
    JSON `{concept, explanation, gsapCode, parameters[]}`.
  - `src/lib/storage.ts` — `getApiKey`/`setApiKey` on `chrome.storage.local`
    (key never logged / never in page context, invariant 4).
  - `src/background/claude.ts` — the ONLY Claude call site (invariant 3):
    `claude-sonnet-4-6`, max_tokens 3000, defensive parsing (fence-strip,
    brace-extract, shape validation), typed SDK errors mapped to safe
    panel-facing messages (`missingKey` flag for auth problems).
  - Broker broadcasts `ANALYSIS_STARTED` / `ANALYSIS_RESULT` / `ANALYSIS_ERROR`.

- **Result rendering + API key onboarding** — the panel now completes the loop.
  - `src/sidepanel/components/ResultView.tsx` — stacked sections in spec order:
    concept → explanation → code → parameters.
  - `src/sidepanel/components/CodeBlock.tsx` — full-width mono block with a
    corner Copy button (clipboard + copied feedback).
  - `src/sidepanel/components/ApiKeyForm.tsx` — appears when analysis fails
    with `missingKey` (no key set, or Claude rejected it); saves via
    `src/lib/storage.ts`.
  - `useInspection` tracks `result` / `analysisError`; status chip shows
    `Analyzing…` with a spinner line under the capture summary.

- **Streaming analysis** — the answer now renders progressively instead of after a
  15-30s blank wait (Azim's call when the non-streaming version felt too slow).
  - Output format changed from JSON to delimiter sections
    (`<<<CONCEPT>>>`/`EXPLANATION`/`CODE`/`PARAMETERS`, params as
    `name | value | description` lines) so it parses incrementally — `src/lib/prompt.ts`.
  - `src/lib/analysis.ts` — `parseAnalysisText` (partial-tolerant, strips a
    mid-stream trailing marker, defends against stray code fences) + `isComplete`.
    Replaces the old JSON `parseAnalysis` in `claude.ts`. Verified against
    growing stream prefixes (sections fill in order, no marker leak).
  - `src/background/claude.ts` — `client.messages.stream()` + `.finalMessage()`;
    `onProgress` callback throttled to 120ms pushes partial parses.
  - Broker relays `ANALYSIS_PROGRESS`; `useInspection` renders each partial live;
    `ResultView` skips empty sections + shows a blinking caret on the section
    still filling (`streaming` prop).

- **Payload digest (cost/latency fix)** — a rich capture (25 tweens / 10 timelines ×
  20 children / SplitText tween targeting 120 chars) was sending Claude ~100K+
  input tokens; the old non-streaming call hit the SDK's 10-min timeout and retried
  2× → one analysis took ~10 min and cost ~$1. Fix:
  - `src/lib/digest.ts` — `digestForPrompt` sends a representative SAMPLE (8 tweens,
    4 timelines × 5 children, 5 scroll triggers, 5 CSS anims, ≤6 targets/tween,
    trimmed keyframes) plus the TRUE counts so the model still knows the real scale.
    Measured **~15× smaller** (≈26K→≈1.7K tokens on a gsap.com-scale capture).
    The UI still shows full counts from the raw payload — only the model input is trimmed.
  - `src/lib/prompt.ts` — sends the digest, compact `JSON.stringify` (no pretty-print).
  - `src/background/claude.ts` — client now sets `timeout: 60s` + `maxRetries: 1`
    (was SDK default 2) so a bad call can't eat $1 again.
  - **Lesson**: never send the full runtime dump to the model — sample + counts.
    Timeouts/retries on a huge non-streamed payload multiply cost silently.

## In Progress

- None.

## Next Up

1. Manual end-to-end verification on a real GSAP site (see Current Goal).
2. Optional (in scope per architecture.md but not yet built): persist the last N
   analysis results in `chrome.storage.local` for quick re-view.

## Open Questions

- **Obfuscated / minified GSAP**: when `tween.vars` is readable but selector/IDs are
  mangled, how much do we lean on Claude vs raw values? Decide the fallback.
- ~~**`Ctrl+Shift+A` scope**~~ **Resolved (V1)**: "current section" = the visible viewport
  bounds. Revisit (nearest `<section>` / pinned ScrollTrigger) if viewport captures prove
  too noisy in practice.
- **CSS-only elements**: what does the output look like when an element animates via CSS
  with no GSAP present? (Still useful — define the shape.)
- ~~**ScrollTrigger capture**~~ **Resolved (V1)**: snapshot all triggers matching the
  capture scope (element relation, or viewport intersection for sections), each with its
  current `progress` + `isActive` so Claude sees the scroll state at capture time.

## Architecture Decisions

- **Stack**: React 19 + TypeScript (strict) + Tailwind v4 + Vite 8 (`@crxjs/vite-plugin`
  2.7, stable). Chosen for UI ergonomics and author familiarity; can drop to vanilla TS
  without changing boundaries. Tailwind v4 uses the `@tailwindcss/vite` plugin with
  CSS-first `@theme` tokens (no `tailwind.config.js`).
- **Sidebar surface**: `chrome.sidePanel` API (native side panel), not a DevTools panel,
  so the user can interact with the page while the panel shows results.
- **Runtime access**: page globals (`window.gsap`, `ScrollTrigger`) are only reachable from
  a MAIN-world injected script; the content script relays serialized JSON.
- **API key**: stored in `chrome.storage.local`, call made only from the background worker.
  Acceptable for single-user V1; a published build must proxy through a backend.
- **Scope**: V1 covers standard GSAP + ScrollTrigger + SplitText + clip-path + stagger +
  CSS. Page transitions = V2, WebGL/Canvas = V3.

## Session Notes

- Context files filled and finalized.
- Scaffold built and `npm run build` passes. To load in Chrome: `chrome://extensions`
  → enable Developer mode → "Load unpacked" → select the `dist/` folder (run
  `npm run build` first, or `npm run dev` for HMR). Click the Revelio toolbar icon to
  open the side panel.
- Note: under Vite 8 (Rolldown), the build prints a harmless
  `Both rollupOptions and rolldownOptions were specified by "crx:content-scripts"`
  warning — crxjs's legacy rollup option is ignored, no functional impact.
- **crxjs gotcha**: content-script entry files must have **unique basenames**. Two
  entries both named `index.ts` collide in crxjs's emitted-chunk bookkeeping and the
  build dies with `Content script fileName is undefined`. Hence the injected entry is
  `src/injected/main.ts` (mnemonic: MAIN world), not `index.ts`.
