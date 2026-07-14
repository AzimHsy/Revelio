# Revelio

## Overview

Revelio is a Chrome extension that identifies the animation techniques behind any
website and turns them into ready-to-use GSAP code. When a developer sees a polished,
awwwards-level animation but doesn't know what the technique is called, Revelio extracts
the live animation data running in the page, sends it to Claude, and returns the concept
name, an explanation, the GSAP code, and a parameter breakdown. V1 is a personal tool for
a single developer (the author) — no accounts, no web app, no backend service.

## Goals

1. Cut the time to recreate a seen animation from "an hour of trial-and-error prompting"
   down to a few minutes.
2. Name the animation concept precisely, so the developer gains the vocabulary — not just
   the code.
3. Produce GSAP code accurate enough to use as a strong starting point (not necessarily
   pixel-perfect 1:1).

## Core User Flow

1. Developer browses any website in Chrome.
2. Opens the Revelio side panel.
3. Clicks a specific element to inspect it, or presses `Ctrl+Shift+A` to capture the
   current viewport / section.
4. Revelio extracts the live animation runtime data (GSAP tweens, timelines,
   ScrollTrigger, CSS animations) from the page.
5. The data is sent to Claude, which identifies the concept and generates code.
6. The side panel shows: concept name, explanation, GSAP code, and a parameter breakdown.
7. Developer copies the code into their own project.

## Features

### Inspection
- Click-to-inspect a single element.
- Keyboard shortcut (`Ctrl+Shift+A`) to capture the current section / viewport state.

### Runtime Extraction
- Active GSAP tweens and their vars (duration, ease, stagger, etc.).
- GSAP timelines and their child tweens.
- ScrollTrigger instances (start, end, scrub, pin).
- SplitText usage.
- Clip-path animations.
- CSS animations and transitions.

### AI Analysis (Claude)
- Concept name.
- Plain-English explanation of the technique.
- Ready-to-use GSAP code.
- Parameter breakdown.

### Output
- Proper Chrome side panel, single scrollable view, English.

## Scope

### In Scope (V1)
- Chrome extension (Manifest V3), personal / self-use.
- Click + keyboard-shortcut inspection.
- GSAP + ScrollTrigger + SplitText + clip-path + stagger + CSS animation extraction.
- Claude API integration (`claude-sonnet-4-6`).
- Side panel UI.

### Out of Scope (V1 — future enhancements)
- Page transitions (V2).
- WebGL / Canvas / Three.js animations (V3).
- Web app / playground with live preview + tweak.
- Accounts, auth, multi-user, database.
- Concept library / history sync.
- Chrome Web Store publishing / distribution (personal unpacked install only for now).

## Success Criteria

1. On a real GSAP-powered site, clicking an animated element returns a correct concept
   name and usable GSAP code inside the side panel.
2. The `Ctrl+Shift+A` capture returns meaningful data for a scroll-driven section.
3. The extension runs entirely locally with the developer's own API key — no backend
   required.
