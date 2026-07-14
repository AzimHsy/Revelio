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
  it back to the content script.
- `src/lib/` — Shared types, the Claude prompt builder, and the runtime-data serializer.

## Storage Model

- **`chrome.storage.local`**: the user's Claude API key, and optionally the last N analysis
  results for quick re-view. Nothing else persists.
- No database. No remote storage. No file/blob storage.

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
   highlight overlay.
