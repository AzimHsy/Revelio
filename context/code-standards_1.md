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
- The API call lives only in the background worker.
- Always request a predictable, structured response shape from Claude, and parse it
  defensively (strip code fences, handle malformed JSON).
- Never hardcode the API key; always read it from `chrome.storage.local`.

## Data and Storage

- Only the API key and (optionally) recent results go in `chrome.storage.local`.
- Do not persist large serialized page dumps; keep only what the UI needs to render.

## File Organization

- `src/sidepanel/` — React UI for the side panel.
- `src/background/` — service worker + Claude call.
- `src/content/` — selection, highlight overlay, relay.
- `src/injected/` — MAIN-world runtime extractor.
- `src/lib/` — shared types, prompt builder, serializer.
