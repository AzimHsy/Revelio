# Revelio V2 — Vocabulary Bridge (Enhancement Brief, rev 2)

> **Single source of truth for the V2 direction. Feed this one file to Claude Code.**
> Rev 2 is aligned to `context/current-architecture.md` (verified 2026-07-14) —
> touch points below use the real filenames and message contract. Where this brief
> and older prose docs disagree, **this brief + current-architecture.md win.**
>
> **Same repo, branch `v2-vocabulary-bridge`. Do not scaffold anything new.**

---

## Already shipped (do NOT rebuild)

Verified in code — earlier planning notes treated these as future work:

- ✅ **Instrumentation** — `src/injected/instrument.ts`: document_start trap on
  `window.gsap`/`ScrollTrigger`, creation-time vars registry (cap 300),
  `collectInstrumented(scope)`. SOURCE-grade recovery of disposed load-in tweens.
- ✅ **Controlled vocabulary** — `CONCEPT_VOCABULARY` (23 slugs) in `src/lib/prompt.ts`.
- ✅ **Honesty labels** — 4-field `name | value | label | description` params,
  back-compat parsing in `src/lib/analysis.ts`, `LabelChip` in ResultView.
- ✅ **Interaction-model-first** — in `SYSTEM_PROMPT`.
- ✅ **Cost guard** — `src/lib/digest.ts` (sample + true counts).
- ✅ Streaming, thumbnails, history(5), sandbox preview, faithful clone, recording.

## The repositioning (what V2 actually changes)

Revelio V1 works but is a **code generator with a click-first capture model**.
V2 makes it a **vocabulary bridge**:

1. **Capture: scan-and-list, not click-first.** The element you _see_ animating is
   often not where GSAP is registered (wrappers, SplitText spans, multi-element
   timelines) — so clicking captures the wrong thing. V2 lists animations from
   GSAP's own data (registry + live + CSS); the user picks from the list. Click
   stays as a secondary path.
2. **Output: prompt-first, not code-first.** Primary output = concept + real
   params + a **ready-to-paste prompt** for the dev's own agent (Claude Code /
   Codex / Cursor). Full code + preview demoted below it.
3. **AI: on-demand, not pipeline.** A rule classifier + template produces the
   brief deterministically (free, instant, cannot hallucinate). The existing
   Claude call becomes a **Deep analyse** button for compound/unclassified cases.
   Daily use = zero tokens.

```
document_start: instrument gsap + hover listeners  →  registry
panel: SCAN (pure JS, 0 API)  →  animation list (real targets)
user picks ONE  →  classify (rules) → template brief + paste-ready prompt
                    └─ unclassified / user choice → Deep analyse (1 small call)
```

See `revelio-flow.mermaid`.

## Ground rules

- One unit at a time (`ai-workflow-rules.md`); `tsc --noEmit && vite build` green
  after each; update `progress-tracker.md` after each.
- Invariants hold: only MAIN world touches page globals; JSON across boundaries;
  Claude call only in `background/claude.ts`; key never in page context; page
  never mutated beyond the overlay (instrumentation records-then-calls-through).
- Keep the existing delimiter output format (`<<<SECTION>>>`), NOT JSON.

---

## Unit 0 — Doc sync (15 min, do first)

Fix the drift current-architecture.md found, so later units build on true docs:
rename `context/*_1.md` → unsuffixed (CLAUDE.md already references unsuffixed);
add `sandbox/` + `offscreen/` worlds, real permissions (`activeTab`, `tabCapture`,
`offscreen`, sandbox CSP, `web_accessible_resources`) and the instrumentation
monkey-patch nuance to `architecture.md`; correct the stale early tracker entries
(`worker.ts` not `index.ts`; delimiter sections not JSON; 4-field params).

## Unit 1 — Hover candidates (extend instrumentation)

**Why:** hover tweens don't exist until triggered — the scan can't see them. The
registry catches one live hover permanently, but the user needs to know _where_
to hover.

**Touch:** `src/injected/instrument.ts`, `src/injected/main.ts`, `src/lib/types.ts`.

**How:** in `installInstrumentation()`, also wrap
`EventTarget.prototype.addEventListener`: when a page registers
`mouseenter`/`mouseover` on an Element, record `{target: describeNode-style
selector, event, createdAt}` into a deduped hover-candidate list (cap ~100).
Record-then-call-through, never alter behavior. Expose alongside the registry.
Also read CSSOM for `:hover` rules that set `transition`/`transform`/`animation`
(same-origin sheets only; cross-origin → skip silently) as a second candidate
source. Add `HoverCandidate` to types.

**Accept:** on a site with a GSAP mouseenter button, the candidate appears after
load without hovering; hovering it once puts the real tween in the registry;
cross-origin stylesheets don't throw.

## Unit 2 — Scan & list (new primary capture)

**Why:** selection from data, not hit-testing — blocked elements,
`pointer-events:none`, and the see-vs-registered mismatch stop mattering. Scan
is **pure JS, zero API calls**; never auto-analyse the list.

**Touch:** new `src/injected/scan.ts`; `src/injected/main.ts` (answer `SCAN`);
`src/content/index.ts` + `bridge.ts` (relay, reuse the requestId pattern);
`src/lib/types.ts`; `src/background/worker.ts` (route `PANEL_SCAN`, **no**
auto-analyze on scan); `src/sidepanel/useInspection.ts` + new
`components/AnimationList.tsx`.

**How:**

1. `scan()` merges into one deduped `ScanItem[]`: instrumented registry +
   `collectTweens`/`collectTimelines`/`collectScrollTriggers` (viewport scope) +
   `collectCssAnimations` + Unit 1 hover candidates (`kind:'hover?'`).
   `ScanItem = {id, target, kindGuess, source:'registry'|'live'|'css'|'hover?',
record}` where `record` carries enough serialized vars for Unit 3. Cap ~40.
2. Messages: `PANEL_SCAN` (panel→worker) → `SCAN` (worker→content→MAIN) →
   `SCAN_RESULT{items}` back up. Same bridge timeout pattern as `EXTRACT`.
3. List UI above IdleState/history: one row per item (target label + kind badge +
   source badge; `hover?` rows say "hover it to capture"). **Row hover →
   `HIGHLIGHT_TARGET{selector}` → content reuses `overlay.ts`** to flash the
   element on the page (mitigates minified selector labels). Row click → Unit 3
   locally (no network); re-scan button refreshes (picks up upgraded hover items).
4. Existing click-to-inspect stays as-is (secondary path).

**Accept:** on gsap.com the list shows animations with sensible targets incl. a
registry-only (finished) one; row hover highlights on page; scan makes zero
network calls; a hover candidate upgrades to a real item after one live hover +
re-scan.

## Unit 3 — Rule classifier + template brief (Tier 1, deterministic)

**Why:** the vocabulary is finite and most concepts have mechanical signatures.
Rules + template = instant, free, cannot hallucinate; every value SOURCE by
construction.

**Touch:** new `src/lib/classify.ts`, new `src/lib/brief.ts`,
`src/lib/types.ts`.

**How:**

1. `classify(record) → {slug, confidence}` against `CONCEPT_VOCABULARY`
   (import from `prompt.ts` — one vocabulary, never two). Starter rules:
   `scrollTrigger.pin→pinned-scroll · scrub set→scroll-scrub · stagger+char
targets→split-text-chars · clipPath→clip-path-wipe · hover candidate+scale→
hover-scale · repeat:-1+x drift→marquee-loop · y+opacity+scrollTrigger→
fade-up-on-enter …` extend freely. No rule fires → `unclassified`.
2. `buildBrief(item, slug) → AnalysisResult` — reuse the existing shape so
   ResultView/history work unchanged: concept = slug; explanation = short
   per-slug template text; parameters = real vars with labels (registry/live →
   `SOURCE`, inferred → `GUESS`); **code = the filled paste-ready prompt** (see
   Unit 4 for presentation):
   ```
   Recreate a {slug} animation on {target description}.
   Interaction: {scroll|hover|click|time}.
   Use GSAP. Parameters captured from the original site's runtime:
   ease {ease} · duration {duration}s · stagger {stagger} · {trigger config…}
   Structure: {one line: what animates in what order}.
   Adapt selectors to my codebase.
   ```
   Mark the entry `tier:'rules'` (add optional field to `AnalysisResult`).

**Accept:** picking a pinned ScrollTrigger from the list yields `pinned-scroll`
with real start/end/scrub as SOURCE and a paste-ready prompt — instantly,
offline, and it renders through the existing ResultView + history without crash.

## Unit 4 — Panel: brief-first presentation

**Why:** the panel still presents code as the product.

**Touch:** `src/sidepanel/components/ResultView.tsx` (+ small `PromptBlock` or
reuse `CodeBlock`), `App.tsx` if ordering lives there.

**How:** render order becomes **Concept → Explanation → Parameters (LabelChips)
→ Prompt (Copy = primary CTA)**; then, only when present, GSAP code + Preview
(deep-analyse results keep them; rules-tier entries have prompt only). Old
history entries (code-first shape) must still render as before. Recording view
unchanged.

**Accept:** rules-tier brief renders instantly with Copy-prompt as the visually
primary action; a V1 history entry still displays; streaming deep-analyse still
shows the caret.

## Unit 5 — Demote Claude to Deep analyse (on-demand)

**Why:** AI = escape hatch for the compound ~20-30%, not the pipeline.

**Touch:** `src/background/worker.ts` (remove auto-`analyze()` on
`ELEMENT_SELECTED`/`SECTION_CAPTURED`; add `PANEL_DEEP_ANALYZE{itemId|capture}`),
`src/lib/prompt.ts` (add `<<<PROMPT>>>` delimiter section: ask the model to also
emit a paste-ready prompt; keep CODE/PREVIEW for this path),
`src/lib/analysis.ts` (parse the new section, tolerant when absent),
`src/sidepanel/` (Deep analyse button on the brief; primary suggestion when
`unclassified`; existing ApiKeyForm/missingKey/streaming flows unchanged).

**How:** select/pick → Tier 1 brief immediately (Units 2–3, zero network).
Deep analyse sends only that one item's record through `digestForPrompt`.
No key → button explains; Tier 1 unaffected.

**Accept:** normal flow makes zero API calls; Deep analyse on an unclassified
compound timeline streams a result incl. the prompt section; missing key blocks
only deep-analyse; old 4-field param parsing still passes.

## Unit 6 (optional, gated — do not start without explicit go-ahead)

- **MCP bridge**: local Node MCP server ⟷ WebSocket ⟷ extension (ws client in
  the existing offscreen doc — MV3 workers die ~30s idle). Tools:
  `revelio.scan()`, `revelio.get(id)` returning raw records; the dev's agent
  reasons on their own subscription. Raw extraction only — no second brain.
- **Browser-agent global**: read-only `window.__revelio__` scan snapshot for
  browser-driving agents. Document, don't build UI.

---

## Not doing (so it doesn't resurface)

- Full component code as the primary output (demoted, not deleted).
- Auto-analysing list items (n items ≠ n API calls) or auto-analyse on select.
- JSON response format (delimiter sections stay).
- A second vocabulary or classifier inside the prompt path (one vocabulary,
  imported both places).
- MCP as transport replacement; page transitions; WebGL/Canvas; publishing.

## Sync after each unit

Capture model + output → `project-overview.md`; scan/classifier boundaries →
`architecture.md` (Extraction Method); vocabulary/classifier conventions →
`code-standards.md`; list/brief UI → `ui-context.md`; everything →
`progress-tracker.md`. Keep `current-architecture.md` regenerated at the end of
V2 so the next planning pass starts from truth.
