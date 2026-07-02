# Progress Tracker

Update this file after every meaningful implementation change.

## Current Phase

- Side panel shell complete — panel opens via `chrome.sidePanel` and renders the idle state.

## Current Goal

- Content script — click-to-select + `Ctrl+Shift+A`, highlight overlay (Next Up #1).

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

## In Progress

- None.

## Next Up

1. Content script — click-to-select + `Ctrl+Shift+A`, highlight overlay.
2. MAIN-world injected extractor — read `window.gsap` / `ScrollTrigger`, serialize to JSON.
3. Messaging contract — injected → content → background → sidepanel (wires the
   Inspect button + live status chip in the panel header).
4. Background Claude call — read key from storage, send payload, parse structured response.
5. Result rendering — concept, explanation, code, parameters in the panel.

## Open Questions

- **Obfuscated / minified GSAP**: when `tween.vars` is readable but selector/IDs are
  mangled, how much do we lean on Claude vs raw values? Decide the fallback.
- **`Ctrl+Shift+A` scope**: what exactly defines "current section" — the viewport bounds,
  the nearest semantic `<section>`, or the largest pinned ScrollTrigger in view?
- **CSS-only elements**: what does the output look like when an element animates via CSS
  with no GSAP present? (Still useful — define the shape.)
- **ScrollTrigger capture**: `ScrollTrigger.getAll()` returns all triggers, but values
  (progress, active) depend on scroll position. Snapshot all, or only active-in-viewport?

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
