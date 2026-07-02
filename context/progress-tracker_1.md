# Progress Tracker

Update this file after every meaningful implementation change.

## Current Phase

- Injected extractor complete — MAIN-world GSAP/ScrollTrigger/CSS extraction, serialized
  JSON relayed through the content script.

## Current Goal

- Background broker — relay `content → background → sidepanel` (Next Up #1).

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

## In Progress

- None.

## Next Up

1. Background broker — relay `content → background → sidepanel`.
2. Sidepanel wiring — enable the Inspect button + live status chip.
3. Background Claude call — read key from storage, send payload, parse structured response.
4. Result rendering — concept, explanation, code, parameters in the panel.

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
