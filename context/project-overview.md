# Revelio

## Overview

Revelio is a Chrome extension that identifies the animation techniques behind any
website and hands them to your own coding agent as a **paste-ready prompt** (plus real
parameters and optional GSAP code). When a developer sees a polished, awwwards-level
animation but doesn't know what the technique is called, Revelio scans the page's live
animation data, names the concept, and produces a brief they can drop into Claude Code /
Cursor / Codex. It is a personal tool for a single developer (the author) — no accounts,
no web app, no backend service.

**V2 — vocabulary bridge.** Revelio is scan-first, prompt-first, and AI-on-demand:
- **Scan-first**: it lists every animation the page exposes (from GSAP's own data +
  CSS + hover candidates) and you pick from the list, instead of hit-testing the DOM.
- **Prompt-first**: the primary output is a concept name + real captured parameters + a
  paste-ready prompt for the developer's own agent; full GSAP code + live preview are secondary.
- **AI-on-demand**: a deterministic rule classifier produces a free, instant, offline
  **Tier 1 brief** for the common cases; Claude is a **Deep analyse** escape hatch for the
  compound minority. Daily use costs zero tokens.

## Goals

1. Cut the time to recreate a seen animation from "an hour of trial-and-error prompting"
   down to a few minutes.
2. Name the animation concept precisely, so the developer gains the vocabulary — not just
   the code.
3. Produce GSAP code accurate enough to use as a strong starting point (not necessarily
   pixel-perfect 1:1).

## Core User Flow

1. Developer browses any website in Chrome and opens the Revelio side panel.
2. Clicks **Scan page** — Revelio lists every animation it finds (GSAP registry + live
   tweens/timelines/ScrollTriggers + CSS + hover candidates). Zero API calls.
3. Hovers a row to highlight that element on the page, then clicks a row to pick it.
4. An instant **Tier 1 brief** appears: concept name, interaction model, real captured
   parameters (each SOURCE/PARTIAL/GUESS-labelled), and a paste-ready prompt (Copy = primary action).
5. For a compound or `unclassified` case, the developer clicks **Deep analyse** — Claude
   streams a richer result (adds GSAP code + a live preview) using the developer's own API key.
6. Developer copies the prompt (or the code) into their own project / agent.

Secondary path: click-to-inspect a single element (or `Ctrl+Shift+A` for the viewport) →
capture summary → **Deep analyse** on demand. Selections no longer auto-call Claude.

## Features

### Capture
- **Scan & list** (primary): data-driven — pick an animation from a list, not by hit-testing.
- Click-to-inspect a single element; `Ctrl+Shift+A` to capture the current viewport (secondary).
- Row hover highlights the element on the page.

### Runtime Extraction
- Instrumented GSAP calls captured at creation time (SOURCE-grade, incl. finished load-in reveals).
- Live GSAP tweens/vars, timelines + child tweens, ScrollTrigger (start/end/scrub/pin).
- Hover candidates (where to hover to trigger not-yet-fired animations).
- SplitText usage, clip-path, CSS animations and transitions.

### Tier 1 brief (rules — offline, free, instant)
- Concept slug from a controlled vocabulary; interaction-model-first explanation.
- Real captured parameters with honesty labels (SOURCE / PARTIAL / GUESS).
- A paste-ready prompt for the developer's own coding agent.

### Deep analyse (Claude — on demand)
- Everything above plus ready-to-use GSAP code, a live sandboxed preview, and a model-written prompt.

### Output
- Chrome side panel, single scrollable view, English. Prompt-first presentation.
- Read-only `window.__revelio__` global (scan snapshot) for browser-driving agents.

## Scope

### In Scope (V1 + V2)
- Chrome extension (Manifest V3), personal / self-use.
- Scan-and-list capture (primary) + click / keyboard-shortcut inspection (secondary).
- GSAP + ScrollTrigger + SplitText + clip-path + stagger + CSS animation extraction, plus
  document_start instrumentation (creation-time SOURCE vars) and hover candidates.
- Deterministic Tier 1 rule classifier + template brief (offline); Claude Deep analyse on demand
  (`claude-sonnet-4-6`).
- Prompt-first side panel UI; read-only `window.__revelio__` browser-agent global.

### Out of Scope (future / deferred)
- MCP bridge (local Node server + WebSocket) — designed, deferred; the read-only global shipped instead.
- WebGL / Canvas / Three.js animations (V3).
- Web app / playground with live preview + tweak.
- Accounts, auth, multi-user, database.
- Concept library / history sync.
- Chrome Web Store publishing / distribution (personal unpacked install only for now).

## Success Criteria

1. On a real GSAP-powered site, **Scan** lists the page's animations with sensible targets,
   and picking one yields a correct concept + real SOURCE parameters + a paste-ready prompt —
   instantly and offline (zero API calls).
2. **Deep analyse** on a compound/`unclassified` pick streams a richer Claude result (adds
   usable GSAP code + preview) using the developer's own key; a missing key blocks only Deep analyse.
3. The extension runs entirely locally; the daily flow needs no backend and no API key.
