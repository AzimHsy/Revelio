# Architecture Context

## Stack

Scoped to the V1 Chrome extension. No web app or backend service exists yet.

| Layer     | Technology                     | Role                                 |
| --------- | ------------------------------ | ------------------------------------ |
| Platform  | Chrome Extension, Manifest V3  | Host environment                     |
| Build     | Vite + `@crxjs/vite-plugin`    | Bundling, HMR, MV3 packaging         |
| UI        | React + TypeScript             | Side panel interface                 |
| Styling   | Tailwind CSS                   | Side panel styling                   |
| Sidebar   | `chrome.sidePanel` API         | Native side panel surface            |
| AI        | Claude API (`claude-sonnet-4-6`) | Animation analysis + code generation |
| Storage   | `chrome.storage.local`         | API key + recent results             |

> Stack note: React + TS is chosen for UI ergonomics and to match the author's
> background. If bundle size or simplicity matters more, the side panel can be rewritten
> in vanilla TS without changing any of the boundaries or invariants below.

## System Boundaries

- `src/sidepanel/` — React UI for the side panel (the only surface the user sees). Renders
  results and dispatches messages. Does not touch the inspected page directly.
- `src/background/` — Service worker. Owns the Claude API call, reads the API key from
  storage, and brokers messages between the page extractor and the side panel.
- `src/content/` — Content script (isolated world). Handles element selection (click +
  shortcut), draws the highlight overlay, and relays extracted data. Cannot read
  `window.gsap` directly.
- `src/injected/` — Page-context script (MAIN world). The only place that can read the
  page's live `window.gsap` / `ScrollTrigger` objects. Serializes runtime data and posts
  it back to the content script. Installs the document_start instrumentation traps
  (`instrument.ts` — GSAP creation-time records + hover candidates), answers `EXTRACT` and
  `SCAN` (`scan.ts` merges every animation into a `ScanItem[]`), and exposes the read-only
  `window.__revelio__` global (`global.ts`).
- `src/sandbox/` — Sandboxed page (opaque origin, no extension APIs, network blocked by
  its own CSP). The single place model-generated GSAP preview code is allowed to execute
  (`new Function('gsap', code)`). Embedded by the side panel in an `<iframe>`.
- `src/offscreen/` — Offscreen document. Hosts the `MediaRecorder` for screen recording,
  which a service worker cannot hold. The worker mints a `tabCapture` streamId and hands
  it here; the doc records the tab (optionally cropped to the element) to a webm data URL.
- `src/lib/` — Shared types, the Claude prompt builder, the runtime-data serializer, the
  payload digest, the response parser, the Tier 1 rule classifier + template brief
  (`classify.ts` / `brief.ts`), and storage/history helpers.

## Capture & analysis (V2)

Two capture entry points, both answered by the MAIN world over the postMessage bridge:

- **Scan** (primary) — `SCAN` → `scan.ts` returns a whole-page, viewport-scoped `ScanItem[]`
  (instrumented registry + live GSAP + CSS + hover candidates, deduped). Pure JS, zero API calls.
  The panel lists it; the user picks one.
- **Extract** (secondary) — `EXTRACT` → a per-element `RuntimePayload`, for click-to-inspect and
  for Deep-analysing an element capture.

Analysis has two tiers:

- **Tier 1 — rules (offline, free, instant)**: runs in the panel. `classify(record)` maps the
  animation's signature to a slug from the single controlled vocabulary (`CONCEPT_VOCABULARY`,
  owned by `prompt.ts` and imported — never duplicated); `buildBrief` produces an `AnalysisResult`
  (`tier:'rules'`) with real captured parameters and a paste-ready prompt. No network.
- **Tier 2 — deep (Claude, on demand)**: reached only via `PANEL_DEEP_ANALYZE`; the background
  worker streams `analyzeCapture` (the sole Claude call site, invariant 3) and stamps `tier:'deep'`.
  Selecting/scanning never auto-calls Claude.

## Storage Model

- **`chrome.storage.local`**: the user's Claude API key (`claudeApiKey`), and the last 5
  analysis results for quick re-view (`recentAnalyses`, slim stats + result, never the full
  runtime dump). Nothing else persists.
- No database. No remote storage. No file/blob storage. Recording clips are live-view only,
  never persisted (webms would blow the storage quota).

## Permissions (manifest.config.ts)

- **`permissions`**: `sidePanel`, `storage`, `activeTab` (covers `captureVisibleTab` for the
  element thumbnail and `tabCapture` for recording), `tabCapture`, `offscreen`.
- **`host_permissions`**: `https://api.anthropic.com/*` — the background worker calls Claude
  directly (single-user V1; see Invariant 4).
- **`sandbox.pages`**: `src/sandbox/preview.html`, with a locked `content_security_policy.sandbox`
  (`default-src 'none'; script-src 'self' 'unsafe-eval'; style-src 'unsafe-inline'; img-src * data:
  blob:; font-src * data:`) — bundled script + eval only, no XHR/fetch; images/fonts allowed so a
  cloned element renders with its real assets.
- **`web_accessible_resources`**: `src/sandbox/preview.html` — MV3 blocks framing an extension page
  unless it is declared web-accessible, and the panel embeds the sandbox in an iframe.
- The offscreen recorder page is NOT a manifest field; it is created at runtime via
  `chrome.offscreen` and bundled via an explicit `rollupOptions.input` in `vite.config.ts`.

## Auth and Access Model

- None. V1 is a single-user personal tool.
- The only "credential" is the developer's own Claude API key, stored locally on their
  machine.
- A future multi-user / published build must move the key behind a backend proxy
  (see Invariant 4).

## Invariants

1. Only the MAIN-world injected script reads page runtime objects (`window.gsap`,
   `ScrollTrigger`). The content script and side panel never assume direct access to page
   globals.
2. Runtime data crossing the world boundary must be serialized to plain JSON — no live
   object or function references survive `postMessage`.
3. The Claude API call happens only in the background service worker — never from the
   content script or the injected script.
4. The API key lives in `chrome.storage.local`, is never injected into page context, and is
   never logged. This is acceptable only because V1 is single-user; a shared or published
   build must proxy the key through a backend.
5. The extension reads from pages. It never mutates the inspected page's DOM beyond its own
   highlight overlay. The one nuance: `injected/instrument.ts` monkey-patches page globals
   in place (`window.gsap` methods, `ScrollTrigger.create`/`new`) to record creation-time
   vars — but every wrapper RECORDS then calls through to the original unchanged, so page
   animation behaviour is never altered. Recording, not mutation.
6. Model-generated preview code runs ONLY inside the `src/sandbox/` page (opaque origin, no
   extension APIs, network blocked by CSP). It is never executed in the panel, the content
   world, or the service worker.

## Browser-agent global (`window.__revelio__`)

A read-only integration surface (V2 Unit 6) exposed by the MAIN-world script
(`src/injected/global.ts`) for browser-driving agents that operate in the page's own
context (not via the extension UI). Extraction only — it returns the same serialized scan
data the panel sees; it never exposes the API key or any `chrome.*` surface.

- `window.__revelio__.version: number` — API version (currently `1`).
- `window.__revelio__.scan(): ScanItem[]` — enumerate the page's animations now (instrumented
  registry + live GSAP + CSS + hover candidates, deduped). Also caches the result for `get`.
- `window.__revelio__.get(id: string): ScanItem | null` — look up one item from the most recent
  `scan()` by its id.

Read-only by construction: the object and every returned value are frozen/deep-cloned, and the
property is defined non-writable + non-configurable so page code cannot replace or tamper with it.
There is deliberately no UI for this — it is a programmatic surface only.
