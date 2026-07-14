# Revelio — Current Architecture Snapshot

Read from the actual source, not the prose docs. Generated 2026-07-14.
Stack: MV3 Chrome extension · React 19 + Vite 8 (`@crxjs/vite-plugin` 2.7) · Tailwind v4 · TS strict ·
`@anthropic-ai/sdk` 0.109 (`claude-sonnet-4-6`) · `gsap` 3.15 · `lucide-react` 1.23. Build: `tsc --noEmit && vite build`.

## 1. File tree of src/

```
src/manifest.config.ts        MV3 manifest source (crxjs defineManifest); dist/manifest.json is generated
src/vite-env.d.ts             Vite client type ref
src/background/
  worker.ts                   Service worker: message broker + recording orchestration + analyze() flow
  claude.ts                   ONLY Claude API call site: streams, parses, maps SDK errors
  screenshot.ts               captureThumbnail: captureVisibleTab → crop to rect×dpr → webp data URL
src/content/                  (isolated world, document_idle)
  index.ts                    Content entry: routes ToContent msgs, Ctrl+Shift+A capture, replayScroll
  selection.ts                Steerable inspect mode (hover + keyboard DOM traversal + z-stack pierce), selector builder
  overlay.ts                  Highlight box + DevTools-style label (only DOM added to the page)
  bridge.ts                   requestExtraction: EXTRACT postMessage to MAIN world, 2s timeout → null
  clone.ts                    serializeElement: deep clone + baked computed styles + tag.class outline
src/injected/                 (MAIN world, document_start)
  main.ts                     MAIN entry: installs instrumentation, answers EXTRACT with RuntimePayload
  gsap.ts                     Readers: tweens/timelines/scrollTriggers, version, SplitText, scope matching
  css.ts                      collectCssAnimations via getAnimations() (resolved keyframes/timing)
  instrument.ts               document_start trap on window.gsap/ScrollTrigger; records creation-time vars
src/lib/
  types.ts                    Single shared message contract + all payload types (JSON-only)
  serialize.ts                toJsonSafe (depth/key/item/string caps) + describeNode
  prompt.ts                   SYSTEM_PROMPT, CONCEPT_VOCABULARY (23 slugs), buildUserPrompt
  digest.ts                   digestForPrompt: representative sample + true counts (cost guard)
  analysis.ts                 parseAnalysisText (partial-tolerant section parser) + isComplete
  storage.ts                  getApiKey/setApiKey on chrome.storage.local
  history.ts                  getHistory/pushHistory/clearHistory (last 5) + toCaptureStats
  tokens.ts                   ACCENT hex ('#6e56f7') for the in-page overlay
src/sandbox/                  (sandboxed page, opaque origin)
  preview.html                Demo stage markup + styles; loads preview.ts
  preview.ts                  Runs model preview code via new Function('gsap', code); demo/clone stage
src/offscreen/                (offscreen document)
  recorder.html               Minimal host page; loads recorder.ts
  recorder.ts                 MediaRecorder host: tab stream → optional crop canvas → webm data URL
src/sidepanel/                (React UI)
  main.tsx                    React root (StrictMode)
  index.html / index.css      Panel entry + Tailwind @theme tokens
  App.tsx                     Layout: pending (live) vs history view; crop-from-target
  useInspection.ts            All panel messaging in one hook; panel state machine
  components/
    Header.tsx                App name, status chip, Inspect/Cancel button
    IdleState.tsx             Empty state + keyboard help
    CaptureSummary.tsx        Target label + thumbnail + runtime counts/flags
    HistoryList.tsx           Recent analyses (concept-labeled) + Clear
    ResultView.tsx            Concept → Explanation → Code → Preview → Parameters; LabelChip
    CodeBlock.tsx             Mono block + copy button
    PreviewStage.tsx          Sandbox iframe embed; posts RUN_PREVIEW
    RecordingView.tsx         Record/Stop/Replay/Download + elapsed timer
    ApiKeyForm.tsx            API key entry (shown on missingKey)
```
Root build config: `vite.config.ts` (crx plugin + explicit `rollupOptions.input.offscreen` so the runtime-created offscreen page is bundled).

## 2. World boundaries as implemented

- **injected/ (MAIN world, document_start)** — the only code that touches page globals. `main.ts` installs the
  GSAP creation-time trap synchronously on load, then sits passive answering `EXTRACT` over `window.postMessage`.
  Reads `window.gsap`/`ScrollTrigger`/`getAnimations()`; serializes everything to plain JSON. Never touches chrome.* or the key.
- **content/ (isolated world, document_idle)** — selection UX (hover + keyboard traversal), the overlay, viewport
  capture (Ctrl+Shift+A), element cloning, and `REPLAY_SCROLL`. Relays via `bridge.ts` to MAIN and via `chrome.runtime` to the worker. Does NOT read page globals.
- **background/ (service worker)** — message broker keyed on `sender.tab`; routes panel commands to the active tab,
  relays content events to the panel, runs `analyze()` (Claude + parallel thumbnail), persists history, and orchestrates recording (mints tabCapture streamId, manages the offscreen doc).
- **sidepanel/ (React)** — the only user surface. Talks only to the worker (never the page). `useInspection` owns all messaging + state.
- **sandbox/ (opaque-origin page)** — the single place model-generated code runs (`new Function('gsap', code)`),
  under a locked CSP (no network, eval allowed). Renders the demo stage or the faithful element clone.
- **offscreen/ (offscreen document)** — hosts the `MediaRecorder` the service worker can't hold; records the tab
  (optionally cropped to the element via a canvas draw loop) → webm data URL.

## 3. Message contract (types.ts)

**Bridge — window.postMessage, content(isolated) ↔ injected(MAIN):**
- `EXTRACT` — content→injected — `{source:'revelio', direction:'to-injected', requestId, target:SelectedTarget}`
- `EXTRACT_RESULT` — injected→content — `{source, direction:'from-injected', requestId, payload:RuntimePayload|null, error:string|null}`

**ToContentMessage — worker→content:** `START_INSPECT` · `STOP_INSPECT` · `INSPECT_KEY{key}` · `REPLAY_SCROLL{selector}`

**FromContentMessage — content→worker:** `INSPECT_STARTED` · `INSPECT_CANCELLED` ·
`ELEMENT_SELECTED{target, payload:RuntimePayload|null, clone?:ElementClone|null}` · `SECTION_CAPTURED{…same…}`

**PanelCommand — panel→worker:** `PANEL_START_INSPECT` · `PANEL_STOP_INSPECT` · `PANEL_INSPECT_KEY{key}` ·
`PANEL_START_RECORD{crop?:CropRect|null}` · `PANEL_STOP_RECORD` · `PANEL_REPLAY_SCROLL{selector}`

**WorkerToOffscreen — worker→offscreen:** `START_RECORDING{streamId, crop?}` · `STOP_RECORDING`
**OffscreenToWorker — offscreen→worker:** `RECORDING_DATA{dataUrl}` · `RECORDING_FAILED{reason}`

**ToPanelMessage — worker→panel:** all FromContentMessage (relayed as-is) plus `RELAY_ERROR{reason}` ·
`ANALYSIS_STARTED` · `ANALYSIS_PROGRESS{partial:AnalysisResult}` · `THUMBNAIL_READY{thumbnail}` ·
`ANALYSIS_RESULT{entry:HistoryEntry}` · `ANALYSIS_ERROR{reason, missingKey}` · `RECORDING_STARTED` ·
`RECORDING_READY{url}` · `RECORDING_ERROR{reason}`

**Sandbox — window.postMessage, panel ↔ sandbox iframe:** `RUN_PREVIEW{code, clone}` panel→sandbox · `PREVIEW_READY` sandbox→panel

Key payload shapes: `SelectedTarget{kind:'element'|'section', selector, tag, id, classes[], rect, dpr, viewport, url}` ·
`RuntimePayload{gsapVersion, splitTextPresent, clipPath, tweens[], timelines[], scrollTriggers[], cssAnimations[], instrumented[]}` ·
`ElementClone{html, width, height, outline}` · `CropRect{x,y,width,height,viewportWidth,viewportHeight}`.

## 4. Extraction

Entry: `main.ts::extract(target)` — scope = the selected element (via `document.querySelector(target.selector)`) or `'viewport'`.
Triggered by an `EXTRACT` bridge request, which the content script fires on select/capture. Functions:
- **gsap.ts** — `getGsapVersion`, `isSplitTextPresent`, `collectTweens` (globalTimeline children, cap 30),
  `collectTimelines` (cap 10 × 20 children), `collectScrollTriggers` (`ScrollTrigger.getAll()`, cap 20). Scope match = element self/ancestor/descendant, or viewport intersection. All accesses guarded.
- **css.ts** — `collectCssAnimations` via `getAnimations()` (subtree for elements, viewport-intersecting for sections; cap 20); resolved keyframes/timing, distinguishes animation vs transition.
- **instrument.ts** — `installInstrumentation()` (called at document_start, before page scripts) traps `window.gsap`
  (`to/from/fromTo/set/timeline` + timeline instance methods) and `window.ScrollTrigger` (`create` in place + `new` via Proxy). Every wrapper records original vars then calls through unchanged. `collectInstrumented(scope)` re-resolves selectors against the grown DOM and returns creation-time records matching the selection (registry cap 300, output cap 40). This is the only SOURCE-grade path for load-in reveals already disposed by inspect time.
- **clone.ts** — `serializeElement` runs in the content world (needs getComputedStyle) at select time, not part of the MAIN payload.

Triggers: click/Enter in inspect mode → `ELEMENT_SELECTED`; `Ctrl+Shift+A` → `SECTION_CAPTURED` (viewport bounds). Both auto-analyze.

## 5. Claude integration

Lives only in `background/claude.ts::analyzeCapture`. Model `claude-sonnet-4-6`, `max_tokens 3500`, `timeout 60s`, `maxRetries 1`,
`dangerouslyAllowBrowser: true`. Key from `chrome.storage.local` (never logged / never in page context).
- **Prompt** (`prompt.ts`): `SYSTEM_PROMPT` instructs interaction-model-first → concept slug from `CONCEPT_VOCABULARY` →
  explanation → GSAP code → parameters with honesty labels → self-contained core-gsap PREVIEW. `buildUserPrompt` sends
  `digestForPrompt(payload)` (sample + true counts, ~15× smaller than the raw dump) plus a "Preview stage" section = the clone outline when present, else the 6-box demo.
- **Response format** — plain-text delimiter sections (NOT JSON): `<<<CONCEPT>>>` / `<<<EXPLANATION>>>` / `<<<CODE>>>` /
  `<<<PARAMETERS>>>` (lines `name | value | label | description`) / `<<<PREVIEW>>>`.
- **Parsing** (`analysis.ts`): `parseAnalysisText` is partial-tolerant (streams), strips trailing markers/code fences;
  `parseParameters` treats field 3 as a label only if it's SOURCE/PARTIAL/GUESS, else description → GUESS (back-compat with old 3-field history). `isComplete` requires concept+explanation+code. Streaming pushes throttled partials (120ms) as `ANALYSIS_PROGRESS`.
- **Errors** (`describeAnalysisError`): MissingKey/Auth → `missingKey:true`; RateLimit/APIError/generic → safe panel messages.

## 6. Output / UI

Single vertical column (`App.tsx`). Render order when a capture is live (`pending`): CaptureSummary → RecordingView →
(ApiKeyForm or error) → analyzing spinner → ResultView. When viewing history: HistoryList → CaptureSummary → RecordingView → ResultView. Else IdleState.
- **ResultView** section order: Concept → Explanation → GSAP code (CodeBlock) → Preview (PreviewStage, only when `!streaming`) → Parameters (each with a SOURCE/PARTIAL/GUESS LabelChip). Blinking caret trails the deepest filled section while streaming.
- **Recording** clip stays live-view only, never persisted.
- **Stored history entry** (`HistoryEntry`): `{id, target:SelectedTarget, stats:CaptureStats|null, result:AnalysisResult,
  thumbnail?:string, clone?:ElementClone|null, at:number}`. `CaptureStats` = counts+flags only (never the full payload). Last 5 in `chrome.storage.local` under `recentAnalyses`; API key under `claudeApiKey`.

## 7. Drift between code and context/*.md

Present in code, NOT in the prose docs (`architecture_1.md`):
- **`src/sandbox/` and `src/offscreen/` worlds** — architecture_1.md "System Boundaries" lists only sidepanel/background/content/injected/lib. Two whole execution contexts (sandboxed preview, offscreen recorder) are undocumented there.
- **Recording, thumbnail, faithful-clone preview, live preview, instrumentation** — none appear in architecture_1.md; permissions it implies (`sidePanel`, `storage`) omit the actual `activeTab`, `tabCapture`, `offscreen`, the `sandbox` page, `web_accessible_resources`, and the relaxed sandbox CSP.
- **Instrumentation invariant nuance** — invariant 5 ("never mutates the page beyond the overlay") still holds, but `instrument.ts` monkey-patches page globals in place (records-then-calls-through, behavior preserved). Worth noting as a boundary the doc doesn't mention.

In context/*.md but no longer matching the code:
- **`progress-tracker_1.md` "Background Claude call"** says the prompt "asks for strict JSON `{concept,explanation,gsapCode,parameters[]}`" with `max_tokens 3000` and brace-extract parsing. Code now uses delimiter sections, `max_tokens 3500`, and `analysis.ts` section parsing. (The later "Streaming analysis" / "Payload digest" tracker entries do supersede this, but the early entry is stale as written.)
- **Background entry filename** — tracker's early entries reference `src/background/index.ts`; the actual entry is `src/background/worker.ts` (per manifest).
- **`parameters` line format** — early tracker shows `name | value | description` (3-field); code emits/parses 4-field `name | value | label | description`.
- **Filenames** — all context specs carry a `_1` suffix (`architecture_1.md`, etc.); CLAUDE.md still references the unsuffixed names (`architecture.md`, …).
- **Storage "recent results"** — architecture_1.md hedges "optionally the last N"; it is now fully implemented (5 entries).
```
