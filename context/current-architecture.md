# Revelio — Current Architecture Snapshot

Regenerated from the actual source at the end of V2 (vocabulary-bridge). Generated 2026-07-15.
Stack: MV3 Chrome extension · React 19 + Vite 8 (`@crxjs/vite-plugin` 2.7) · Tailwind v4 · TS strict ·
`@anthropic-ai/sdk` 0.109 (`claude-sonnet-4-6`) · `gsap` 3.15 · `lucide-react` 1.23. Build: `tsc --noEmit && vite build`.

**V2 repositioning (what changed since V1):** Revelio is now a **scan-first, prompt-first, AI-on-demand**
vocabulary bridge. You scan the page (pure JS, zero API) → pick an animation from a list → get an instant
deterministic **Tier 1 brief** (concept + real params + a paste-ready prompt) → optionally escalate to a
Claude **Deep analyse**. Click-to-inspect remains as a secondary path; it no longer auto-analyzes.

## 1. File tree of src/

```
src/manifest.config.ts        MV3 manifest source (crxjs); dist/manifest.json is generated
src/vite-env.d.ts             Vite client type ref
src/background/
  worker.ts                   Service worker: message broker + recording orchestration + the ONLY Claude call (Deep analyse)
  claude.ts                   analyzeCapture: streams Claude, parses, maps SDK errors
  screenshot.ts               captureThumbnail: captureVisibleTab → crop to rect×dpr → webp data URL
src/content/                  (isolated world, document_idle)
  index.ts                    Routes ToContent msgs (inspect / SCAN / HIGHLIGHT / REPLAY), Ctrl+Shift+A capture
  selection.ts                Steerable inspect mode (hover + keyboard DOM traversal + z-stack pierce), selector builder
  overlay.ts                  Highlight box + label (only DOM added to the page; reused for scan row-hover highlight)
  bridge.ts                   requestExtraction + requestScan: postMessage round-trips to MAIN (2s timeout → null/[])
  clone.ts                    serializeElement: deep clone + baked computed styles + tag.class outline
src/injected/                 (MAIN world, document_start)
  main.ts                     MAIN entry: installs instrumentation + browser global; answers EXTRACT and SCAN
  gsap.ts                     Readers: tweens/timelines/scrollTriggers, version, SplitText, scope matching
  css.ts                      collectCssAnimations via getAnimations() (resolved keyframes/timing)
  instrument.ts               document_start traps: GSAP creation-time registry + hover candidates (addEventListener + :hover CSSOM)
  scan.ts                     scan(): merges registry + live + CSS + hover into one deduped ScanItem[] (viewport, cap 40)
  global.ts                   Read-only window.__revelio__ (scan/get) for browser-driving agents (V2 Unit 6)
src/lib/
  types.ts                    Single shared message contract + all payload types (JSON-only)
  serialize.ts                toJsonSafe (depth/key/item/string caps) + describeNode
  prompt.ts                   SYSTEM_PROMPT (+ <<<PROMPT>>> section), CONCEPT_VOCABULARY (23 slugs), buildUserPrompt
  digest.ts                   digestForPrompt: representative sample + true counts (cost guard)
  analysis.ts                 parseAnalysisText (partial-tolerant section parser incl. PROMPT) + isComplete
  classify.ts                 classify(record) → {slug, confidence} against CONCEPT_VOCABULARY (Tier 1 rules)
  brief.ts                    buildBrief(item, slug) → AnalysisResult (rules tier; prompt in gsapCode)
  storage.ts                  getApiKey/setApiKey on chrome.storage.local
  history.ts                  getHistory/pushHistory/clearHistory (last 5) + toCaptureStats
  tokens.ts                   ACCENT hex ('#6e56f7') for the in-page overlay
src/sandbox/                  (sandboxed page, opaque origin)
  preview.html / preview.ts   Runs model preview code via new Function('gsap', code); demo/clone stage
src/offscreen/                (offscreen document)
  recorder.html / recorder.ts MediaRecorder host: tab stream → optional crop canvas → webm data URL
src/sidepanel/                (React UI)
  main.tsx / index.html / index.css   React root + Tailwind @theme tokens
  App.tsx                     Layout: element capture vs scan-pick brief vs history/idle
  useInspection.ts            All panel messaging + state (pending, brief, scan, recording)
  scanBrief.ts                Adapters: briefFromItem (offline Tier 1) + payloadFromRecord/targetFromItem (deep-analyse a scan item)
  components/
    Header.tsx                App name, status chip, Inspect/Cancel
    IdleState.tsx             Empty state + keyboard help
    AnimationList.tsx         Scan/Re-scan + one row per ScanItem (target + kind + source badge; row hover highlights)
    CaptureSummary.tsx        Target label + thumbnail + runtime counts/flags
    HistoryList.tsx           Recent analyses (concept-labeled) + Clear
    ResultView.tsx            BriefView (rules/deep: prompt-first) vs AnalysisView (legacy code-first); LabelChip
    PromptBlock.tsx           Paste-ready prompt + full-width accent "Copy prompt" primary CTA
    CodeBlock.tsx             Mono block + copy button
    PreviewStage.tsx          Sandbox iframe embed; posts RUN_PREVIEW
    DeepAnalyzeButton.tsx     Escalate to Claude (primary when concept is unclassified)
    RecordingView.tsx         Record/Stop/Replay/Download + elapsed timer
    ApiKeyForm.tsx            API key entry (shown on missingKey)
```
Root build config: `vite.config.ts` (crx plugin + `rollupOptions.input.offscreen` for the runtime-created offscreen page).

## 2. World boundaries as implemented

- **injected/ (MAIN world, document_start)** — the only code that touches page globals. On load it installs
  (a) the GSAP creation-time trap + hover-candidate trap (`instrument.ts`) and (b) the read-only
  `window.__revelio__` global (`global.ts`), then answers `EXTRACT` (per-element payload) and `SCAN`
  (whole-page `ScanItem[]`) over `window.postMessage`. Serializes everything to plain JSON. Never touches chrome.* or the key.
- **content/ (isolated world, document_idle)** — selection UX, the overlay (also flashed on scan row-hover),
  viewport capture, element cloning, `REPLAY_SCROLL`, and the `SCAN` bridge round-trip. Relays via `chrome.runtime`. Does NOT read page globals.
- **background/ (service worker)** — message broker keyed on `sender.tab`; routes panel commands to the tab,
  relays content events to the panel, orchestrates recording, and runs `analyze()` — the **only** Claude call, now reached solely via `PANEL_DEEP_ANALYZE` (no auto-analyze).
- **sidepanel/ (React)** — the only user surface. Talks only to the worker. Owns the scan list, the offline Tier 1 brief (classify + buildBrief run here), and Deep-analyse escalation.
- **sandbox/ (opaque-origin page)** — the single place model-generated preview code runs (`new Function`), under a locked CSP.
- **offscreen/ (offscreen document)** — hosts the `MediaRecorder` the worker can't hold.

## 3. Message contract (types.ts)

**Bridge — window.postMessage, content(isolated) ↔ injected(MAIN):**
- `EXTRACT` c→i `{…, requestId, target}` · `EXTRACT_RESULT` i→c `{…, requestId, payload:RuntimePayload|null, error}`
- `SCAN` c→i `{…, requestId}` · `SCAN_RESULT` i→c `{…, requestId, items:ScanItem[], error}`

**ToContentMessage — worker→content:** `START_INSPECT` · `STOP_INSPECT` · `INSPECT_KEY{key}` · `REPLAY_SCROLL{selector}` · `SCAN` · `HIGHLIGHT_TARGET{selector}` · `CLEAR_HIGHLIGHT`

**FromContentMessage — content→worker:** `INSPECT_STARTED` · `INSPECT_CANCELLED` ·
`ELEMENT_SELECTED{target, payload, clone?}` · `SECTION_CAPTURED{…}` · `SCAN_RESULT{items:ScanItem[]}`

**PanelCommand — panel→worker:** `PANEL_START_INSPECT` · `PANEL_STOP_INSPECT` · `PANEL_INSPECT_KEY{key}` ·
`PANEL_START_RECORD{crop?}` · `PANEL_STOP_RECORD` · `PANEL_REPLAY_SCROLL{selector}` · `PANEL_SCAN` ·
`PANEL_HIGHLIGHT_TARGET{selector}` · `PANEL_CLEAR_HIGHLIGHT` · `PANEL_DEEP_ANALYZE{target, payload:RuntimePayload, clone}`

**WorkerToOffscreen:** `START_RECORDING{streamId, crop?}` · `STOP_RECORDING` — **OffscreenToWorker:** `RECORDING_DATA{dataUrl}` · `RECORDING_FAILED{reason}`

**ToPanelMessage — worker→panel:** all FromContentMessage (relayed) plus `RELAY_ERROR{reason}` ·
`ANALYSIS_STARTED` · `ANALYSIS_PROGRESS{partial}` · `THUMBNAIL_READY{thumbnail}` · `ANALYSIS_RESULT{entry}` ·
`ANALYSIS_ERROR{reason, missingKey}` · `RECORDING_STARTED` · `RECORDING_READY{url}` · `RECORDING_ERROR{reason}`

**Sandbox — panel ↔ iframe:** `RUN_PREVIEW{code, clone}` → · ← `PREVIEW_READY`

Key payloads: `RuntimePayload{gsapVersion, splitTextPresent, clipPath, tweens[], timelines[], scrollTriggers[], cssAnimations[], instrumented[], hoverCandidates[]}` ·
`ScanItem{id, target, kindGuess, source:'registry'|'live'|'css'|'hover?', record:ScanRecord}` ·
`AnalysisResult{concept, explanation, gsapCode, parameters[], previewCode, prompt?, tier?:'rules'|'deep'}` ·
`HoverCandidate{target, source:'listener'|'css', trigger, createdAt}`.

## 4. Extraction

Two MAIN-world entry points, both from a content bridge request:
- **`EXTRACT`** (`main.ts::extract`) — per-element/section `RuntimePayload`: `gsap.ts` (tweens cap 30 / timelines 10×20 / ScrollTriggers 20), `css.ts` (`getAnimations()`, cap 20), `instrument.ts` `collectInstrumented` (creation-time SOURCE records) + `collectHoverCandidates` (JS listeners + same-origin `:hover` CSSOM). Used by the secondary click-to-inspect path and by Deep analyse of an element capture.
- **`SCAN`** (`main.ts::handleScan` → `scan.ts::scan`) — whole-page (viewport-scoped) `ScanItem[]`, merging registry (SOURCE first) → live tweens/timelines/ScrollTriggers → CSS → hover candidates, deduped, cap 40. Each item carries a `ScanRecord` (evidence for the classifier). Pure JS, no network.

Instrumentation (`instrument.ts`, installed at document_start): traps `window.gsap`/`ScrollTrigger` (records creation-time vars, record-then-call-through) and `EventTarget.prototype.addEventListener` (mouseenter/mouseover → hover candidates); reads same-origin `:hover` CSSOM at collect time. Triggers: click/Enter → `ELEMENT_SELECTED`; `Ctrl+Shift+A` → `SECTION_CAPTURED`; panel Scan button → `SCAN`. Selections no longer auto-analyze.

## 5. AI: two tiers

**Tier 1 — rules (offline, free, instant; runs in the panel):** `classify(record)` matches a signature to a
`CONCEPT_VOCABULARY` slug (`st.pin`→pinned-scroll, scrub→scroll-scrub, stagger(+char targets)→split-text-chars,
clipPath→clip-path-wipe, hover(+scale)→hover-scale, repeat:-1+x→marquee-loop, ST+y/opacity→fade-up-on-enter …;
no match → `unclassified`). `buildBrief(item, slug)` returns an `AnalysisResult` (`tier:'rules'`): interaction-model-first
explanation, real captured params (registry/live → SOURCE, else GUESS), and the **paste-ready prompt in `gsapCode`**. No network.

**Tier 2 — deep (Claude, on-demand):** `background/claude.ts::analyzeCapture` (the only call site; `claude-sonnet-4-6`,
`max_tokens 3500`, `timeout 60s`, `maxRetries 1`, streamed). Reached only via `PANEL_DEEP_ANALYZE`. `prompt.ts` asks
for delimiter sections `<<<CONCEPT>>>`/`EXPLANATION`/`CODE`/`PARAMETERS`(4-field `name|value|label|description`)/`PREVIEW`/`PROMPT`,
built from `digestForPrompt(payload)` (sample + true counts). `analysis.ts::parseAnalysisText` parses them (partial-tolerant;
`prompt` optional). The worker stamps `tier:'deep'`. A scan item is deep-analysed by wrapping its record into a minimal
payload (`scanBrief.ts::payloadFromRecord`). Missing/invalid key → `ANALYSIS_ERROR{missingKey}` → ApiKeyForm; Tier 1 is unaffected.

## 6. Output / UI

Single column (`App.tsx`). **Scan pick** (primary): AnimationList (always visible in the idle branch) → pick a row →
`PickedHeader` + `ResultView(brief)` + `DeepAnalyzeButton`. **Element capture** (secondary): `CaptureSummary` +
`RecordingView` + `DeepAnalyzeButton` (no auto-analyze). **History**: `HistoryList` → summary → `ResultView(entry)`.
- `ResultView` branches on `tier`: `rules`/`deep` → **BriefView** (Concept → Explanation → Parameters → **Prompt** (Copy = primary CTA) → Code → Preview, streaming caret for deep); no tier (legacy V1 history) → **AnalysisView** (original code-first, unchanged).
- Only **deep** results stream and fold into history (`HistoryEntry{id, target, stats, result, thumbnail?, clone?, at}`, last 5 in `chrome.storage.local`); Tier 1 briefs are transient (re-derived instantly on pick). API key under `claudeApiKey`.

## 7. Doc sync status

This snapshot was regenerated together with a narrative-doc sync, so the specs now match the code:
- `architecture.md` — worlds (sandbox/offscreen), permissions, instrumentation nuance, browser-agent global, and a scan/AI-tiers section.
- `project-overview.md` — scan-first/prompt-first/on-demand-AI capture model + output.
- `code-standards.md` — delimiter-not-JSON response, one-vocabulary classifier rule, full folder list.
- `ui-context.md` — scan list + brief (prompt-first) layout.

Not reflected anywhere by design: the deferred **Unit 6 MCP bridge** (optional; only the read-only `window.__revelio__` global was built). No other code/doc drift known at this snapshot.
