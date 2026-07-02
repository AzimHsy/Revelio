# Progress Tracker

Update this file after every meaningful implementation change.

## Current Phase

- **V1 pipeline complete + streaming + previews** — inspect/capture → MAIN-world
  extraction → Claude analysis (streamed) → concept/explanation/code/parameters render
  progressively, plus a screenshot thumbnail of the inspected element and a live
  sandboxed animation preview. API key onboarding included. V1 verified live on gsap.com;
  the two preview units await a live sanity-check. `npm run build` green.

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

- **Recent-analysis history** — previously each capture replaced the last result
  (Azim: "the previous will disappear"). Now the last N (5) analyses persist and are
  navigable. Implements the architecture.md "last N results for quick re-view".
  - `src/lib/history.ts` — `getHistory`/`pushHistory` on `chrome.storage.local`
    (cap `MAX_HISTORY = 5`) + `toCaptureStats` (slim summary, NOT the full payload —
    storage stays small).
  - `src/lib/types.ts` — `CaptureStats`, `HistoryEntry`; `ANALYSIS_RESULT` now
    carries the full `entry` (target + stats + result + id + timestamp).
  - `src/background/worker.ts` — on success, builds + persists the entry, then
    broadcasts it (so history survives even a `Ctrl+Shift+A` with the panel closed).
  - `useInspection` — separates the in-flight `pending` capture from persisted
    `history` + `viewIndex`; selecting a new element no longer wipes prior results;
    loads history from storage on mount (survives panel close); `viewOlder`/`viewNewer`.
  - `CaptureSummary` now takes `target` + `stats` (works for live + stored).
  - **History UI = concept-labeled list** (`src/sidepanel/components/HistoryList.tsx`):
    each recent analysis shown by its concept name, click to view, active row dotted
    in accent, plus a **Clear** button (`clearHistory` → `chrome.storage.local.remove`).
    Replaced the earlier one-at-a-time `‹ / ›` `HistoryNav` (deleted). Hook exposes
    `selectEntry(i)` + `clearHistory` instead of `viewOlder`/`viewNewer`.

- **Preview Unit 1 — element screenshot thumbnail** — the panel was text-only; you
  couldn't see *which* element you inspected. Now each capture carries a cropped
  screenshot of the element, shown in the capture summary and as a 28px thumbnail on
  each history row.
  - `src/lib/types.ts` — `SelectedTarget` gains `dpr` (devicePixelRatio at capture —
    `captureVisibleTab` renders at that scale, `rect` is CSS px); `HistoryEntry` gains
    optional `thumbnail?: string` (webp data URL); new `THUMBNAIL_READY` panel message.
  - `src/content/selection.ts` + `src/content/index.ts` — set `dpr:
    window.devicePixelRatio` where the target is built (element + viewport captures).
  - `src/manifest.config.ts` — added `activeTab` permission (granted on toolbar-action
    open, covers `captureVisibleTab`).
  - `src/background/screenshot.ts` (new) — `captureThumbnail(target, windowId)`:
    `captureVisibleTab` → `createImageBitmap` → crop to `rect × dpr` (clamped to image
    bounds) → downscale to ≤320px → `OffscreenCanvas.convertToBlob` webp q0.7 →
    `FileReader` data URL. Fully failure-tolerant — any error returns `null`.
  - `src/background/worker.ts` — `analyze()` kicks the screenshot off **in parallel**
    with the Claude call (threading `sender.tab?.windowId`), broadcasts
    `THUMBNAIL_READY` for the live view, and folds the awaited result into the stored
    `HistoryEntry`. Never blocks/fails analysis.
  - `useInspection` — `PendingCapture` gains `thumbnail`; handles `THUMBNAIL_READY`.
    `CaptureSummary` renders an `object-contain` image above the label; `HistoryList`
    shows a 28px `object-cover` thumbnail (falls back to the dot when absent).
  - Old history entries without `thumbnail` still render (field optional). `npm run
    build` green.

- **Preview Unit 2 — live animation preview** — the panel showed GSAP code but you
  couldn't *watch* it. Now the model also returns a self-contained preview that runs
  live in a sandboxed iframe on a demo stage, with a Replay button.
  - `src/lib/prompt.ts` — added a 5th job + a `<<<PREVIEW>>>` output section. Preview
    code must be **core-gsap only** (no ScrollTrigger/SplitText — not in the sandbox),
    target ONLY the provided `.demo-stage` / 6× `.demo-item`, loop/feel alive, and
    reproduce scroll effects as an auto-playing timeline. `MAX_TOKENS` 3000→3500.
  - `src/lib/analysis.ts` — `PREVIEW` added to `SECTION_RE`; `parseAnalysisText` now
    fills `previewCode` (fence-stripped). `isComplete` unchanged → preview is optional,
    so pre-feature history entries still render.
  - `src/lib/types.ts` — `AnalysisResult.previewCode: string`.
  - `src/manifest.config.ts` — `sandbox: { pages: ['src/sandbox/preview.html'] }` +
    a restrictive `content_security_policy.sandbox` (`default-src 'none'; script-src
    'self' 'unsafe-eval'; style-src 'unsafe-inline'` — network blocked, eval allowed
    for `new Function`).
  - `src/sandbox/preview.html` + `preview.ts` (new) — opaque-origin page bundling
    `gsap` (new dep, 3.15.0). Builds the 6-item stage, listens for
    `postMessage({type:'RUN_PREVIEW', code})`, resets (`globalTimeline.clear()` +
    rebuild stage), runs the code via `new Function('gsap', code)(gsap)`, shows any
    thrown error inline. Announces `PREVIEW_READY` to the parent.
  - `src/sidepanel/components/PreviewStage.tsx` (new) — iframe
    (`sandbox="allow-scripts"`, src via `chrome.runtime.getURL`) + Replay button; posts
    the code on load / ready / code-change / Replay. Only SENDS a string — never acts on
    iframe messages beyond re-posting.
  - `ResultView` renders `PreviewStage` under the code block **only when not streaming**
    (partial code mid-stream would be a syntax error; avoids re-mounting every 120ms).
  - **crxjs**: auto-emitted `dist/src/sandbox/preview.html` + a bundled `preview.html-*.js`
    (gsap inside) with no `rollupOptions.input` needed — the plan's flagged risk didn't
    materialize. `npm run build` green.
  - Generated code executes ONLY inside the sandbox (opaque origin, no extension APIs,
    network-blocked) — it cannot reach the panel, the inspected page, the key, or storage.

- **Selection reach (Phase A)** — you couldn't inspect components hidden under blocking
  containers (overlays, full-bleed `<a>` wrappers) because selection used `event.target`
  (topmost hit-tested node). Now selection is a **steerable current-target model**.
  - `src/content/selection.ts` — holds `current`/`pointer`; hover still sets the default
    target, but the keyboard refines it while inspecting: **↑** parent, **↓** first child,
    **←/→** siblings, **Enter**/click selects, **Escape** cancels. **`[` / `]`** (and
    PageUp/PageDown) cycle `document.elementsFromPoint(cursor)` to reach elements **under**
    a blocker (z-stack piercing); moving the mouse resets the stack index. Arrow/bracket
    keys `preventDefault` so the page doesn't scroll.
  - `src/content/overlay.ts` — the highlight box now carries a **DevTools-style label**
    (tag`#id`.class · W×H) so you see exactly what's targeted as you traverse.
  - `src/sidepanel/components/IdleState.tsx` — documents the new keys (added a `Kbd` helper).
  - **Focus fix** — the toolbar-opened side panel keeps keyboard focus, so the page's own
    keydown never fired ("keyboard does nothing"). Now the panel relays traversal keys:
    `useInspection` listens while `status === 'inspecting'` → `PANEL_INSPECT_KEY` →
    `worker` → `INSPECT_KEY` → content `handleKey(key)` (shared by the page listener too, so
    it also works if the page happens to hold focus). Added `INSPECT_KEY`/`PANEL_INSPECT_KEY`
    to the message contract.
  - `npm run build` green.

- **Faithful-clone preview (Phase B)** — the preview ran on 6 generic gradient boxes, so it
  never resembled the inspected component (Azim's core complaint was *fidelity*, not anim
  params). Now the preview reproduces the **actual inspected element** — real markup + baked
  computed styles — and animates it.
  - `src/content/clone.ts` (new) — `serializeElement(el)`: deep-clone the subtree, bake each
    node's `getComputedStyle` into inline styles (curated ~100 visual props; `transition`/
    `animation` excluded so GSAP drives motion), absolute-ize `<img src>`, strip
    scripts/`on*`/unsafe tags, cap nodes/depth/bytes (500/14/300KB → null if over). Also emits
    a compact **tag.class outline** (depth/line-capped) so the model can target real selectors.
  - `src/lib/types.ts` — `ElementClone { html, width, height, outline }`; `clone?` added to
    `ELEMENT_SELECTED`/`SECTION_CAPTURED`, `HistoryEntry`, and `PendingCapture`. All optional →
    old history still valid.
  - Capture flow: `selection.ts` serializes the element at select time and attaches `clone` to
    the message; `index.ts` passes it through; `worker.ts` stores it on the `HistoryEntry` and
    forwards `clone.outline` to `analyzeCapture` → `buildUserPrompt`.
  - `src/sandbox/preview.ts` — when a clone is present, injects its HTML into a scale-to-fit
    wrapper (never scales up) instead of the demo boxes; images that fail to load swap to a
    placeholder; scripts stripped defensively. Falls back to the 6-box demo when no clone.
  - `src/manifest.config.ts` — sandbox CSP relaxed to allow **images/fonts only**
    (`img-src * data: blob:; font-src * data:`); still no script/XHR loosening.
  - `src/lib/prompt.ts` — the `<<<PREVIEW>>>` DOM is now described dynamically per capture
    ("Preview stage" section in the user prompt = the real tag.class outline when cloned, else
    the demo stage); model targets the real selectors. Auto-play/no-listener/never-hidden
    hardening retained.
  - `PreviewStage`/`ResultView`/`App` thread `clone` through to the sandbox postMessage.
  - crxjs still auto-emits the sandbox (gsap bundled). `npm run build` green.

## In Progress

- None. Both phases (selection reach + faithful-clone preview) built + building green; awaiting
  live verification in Chrome.

## Next Up

1. Manual verification on gsap.com (**reload the extension card after building**):
   - **Selection reach**: hover a component sitting under an overlay/link wrapper → use ↑↓←→
     to walk the DOM and `[`/`]` to reach the element beneath the blocker (the overlay label
     confirms the target) → Enter selects it.
   - **Faithful-clone preview**: inspect a styled component → the Preview now shows *that
     component's real design* animating (not the 6 boxes); a broken image → placeholder; text
     falls back to a close system font; Replay re-runs. Big elements scale to fit.
   - Fallbacks: a pre-clone history entry (no `clone`) still shows the old 6-box demo; if a
     capture's clone was too large/failed, it falls back too.
   - Watch the iframe console for a sandbox CSP error (bundled preview script under
     `script-src 'self'` in the opaque origin) — loosen the sandbox CSP if it appears.
2. Known follow-ups from the plan's honest limits: **pseudo-elements** (`::before/::after`)
   aren't cloned yet (some underline/mask reveals look off) → read pseudo computed styles +
   inject stand-in spans; CORS images → placeholder; web fonts → system fallback.
3. Possible polish (not yet scoped): show capture timestamp on each history row.

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
