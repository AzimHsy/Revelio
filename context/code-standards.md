# Code Standards

## General

- Keep modules small and single-purpose; one responsibility per file.
- Fix root causes rather than layering workarounds.
- Respect the world boundaries in `architecture.md` — extraction logic, messaging, UI, and
  the API call each stay in their own layer.

## TypeScript

- Strict mode on throughout.
- Avoid `any`. Model the extracted runtime payload as an explicit, shared interface in
  `src/lib/types.ts`.
- Validate / normalize the runtime payload at the boundary (after it crosses from MAIN
  world) before trusting it — page data is untrusted input.

## React (Side Panel)

- Functional components and hooks only.
- The side panel is presentational: it renders results and dispatches messages. Keep
  extraction and API logic out of components.
- Keep network / messaging side effects in hooks or a small service module, not inline in
  JSX.

## Messaging

- Use a single typed message contract across `injected → content → background → sidepanel`.
  Define the message types once and reuse them.
- Every message has an explicit `type` discriminator; handlers switch on it exhaustively.

## Styling

- Tailwind utility classes against the tokens defined in `ui-context.md` — no hardcoded hex
  values.
- Follow the border-radius scale defined in `ui-context.md`.

## Claude Integration

- Build the prompt in one place (`src/lib/prompt.ts`) so it can be iterated without touching
  call sites.
- The API call lives only in the background worker, and is reached only on demand (Deep
  analyse) — never auto-triggered by a selection or a scan.
- The response is **delimiter-sectioned plain text** (`<<<CONCEPT>>>` / `EXPLANATION` / `CODE` /
  `PARAMETERS` / `PREVIEW` / `PROMPT`), NOT JSON — so it parses incrementally while streaming.
  Parse it defensively in `src/lib/analysis.ts` (partial-tolerant, strip stray code fences,
  tolerate missing sections); never assume a section is present.
- Never hardcode the API key; always read it from `chrome.storage.local`.

## Classifier & Vocabulary (Tier 1)

- There is exactly ONE concept vocabulary: `CONCEPT_VOCABULARY` in `src/lib/prompt.ts`. The rule
  classifier (`src/lib/classify.ts`) imports it — never define a second list.
- The Tier 1 path (`classify` + `buildBrief`) is deterministic and offline: no network, no model.
  Every parameter it surfaces must be real (registry/live → `SOURCE`); inferred defaults → `GUESS`.
  Never present a guess as certain.
- Classifier rules are first-match and easy to extend; an unmatched signature returns
  `unclassified` and is left to Deep analyse — do not force a weak match.

## Data and Storage

- Only the API key and (optionally) recent results go in `chrome.storage.local`.
- Do not persist large serialized page dumps; keep only what the UI needs to render.

## File Organization

- `src/sidepanel/` — React UI for the side panel (scan list, brief, history, recording).
- `src/background/` — service worker + the on-demand Claude call.
- `src/content/` — selection, highlight overlay, scan/extract relay.
- `src/injected/` — MAIN-world: runtime extractor, instrumentation + hover traps, `scan`, and the
  read-only `window.__revelio__` global.
- `src/sandbox/` — opaque-origin page; the only place model-generated preview code runs.
- `src/offscreen/` — offscreen document hosting the `MediaRecorder`.
- `src/lib/` — shared types, prompt builder, serializer, digest, response parser, and the Tier 1
  classifier + template brief.
