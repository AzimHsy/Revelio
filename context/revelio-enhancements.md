# Revelio — Enhancements Brief

> **Single source of truth for the changes agreed on top of the shipped V1.**
> Feed this one file to Claude Code. It references `context/` but stands alone for
> these changes. Drop it in `context/` or point at it directly.
>
> **Do not re-architect.** The shipped V1 is a direct Claude-API Chrome extension
> (see `progress-tracker.md` → Completed). An MCP-bridge / Claude-Code-as-agent design
> was explored and **NOT adopted** — transport stays direct-API, Invariants 3–4 hold.

## Ground rules (from `ai-workflow-rules.md`)

- One unit at a time; small, verifiable increments.
- `npm run build` must pass after each unit.
- Update `progress-tracker.md` after each unit.
- Do these in order: **Enhancement 1 first** (cheap, prompt-only, high value), then 2.

---

## Enhancement 1 — Identification quality (prompt-only)

**Goal:** sharper, more consistent, more honest output. No architecture change.

**Touch points:**
- `src/lib/prompt.ts` — the rules below.
- `src/lib/analysis.ts` — extend the `PARAMETERS` line parser (new label field).
- `src/lib/types.ts` — add `label` to the parameter type.
- `src/sidepanel/components/ResultView.tsx` — render the label chip.

**Changes:**

1. **Controlled vocabulary.** The model must pick the concept from a fixed slug list,
   not invent a new label for a technique that already has one. If nothing fits, it may
   propose one new slug and mark it `(new)`. Starter list (extend as needed):

   ```
   stagger-reveal, split-text-chars, split-text-lines, clip-path-wipe, mask-reveal,
   pinned-scroll, horizontal-scroll, scroll-scrub, parallax-layers, magnetic-cursor,
   cursor-follow-lerp, marquee-loop, text-scramble, counter-tween, image-sequence,
   flip-layout, draw-svg, morph-svg, elastic-bounce-in, fade-up-on-enter,
   sticky-stacked-cards, hover-scale, hover-underline-wipe
   ```

2. **Honesty labels.** Every emitted parameter is tagged `SOURCE` (read from runtime),
   `PARTIAL` (partially inferred), or `GUESS` (inferred). Unlabelled = `GUESS`. Never
   present an inferred value as certain.

   Output line format changes from `name | value | description` to:
   ```
   name | value | label | description
   ```
   Update `parseAnalysisText` to split 4 fields (tolerate 3 for old history: missing
   label → `GUESS`). `isComplete` unchanged.

3. **Interaction-model-first.** Before describing, the model states the interaction model
   — `scroll` / `click` / `hover` / `time` — and keys the code to it. (Wrong model is the
   most expensive mistake to recreate.)

4. **Capture-every-state.** Describe before/after states for triggered animations, not just
   the default frame.

5. **GSAP-skills grounding.** Instruct the model to follow current GSAP best practice
   (idiomatic timelines, standard eases, `useGSAP`/cleanup where relevant) rather than
   ad-hoc values. If the official `greensock/gsap-skills` are available in the Claude Code
   session, lean on them.

**Acceptance:** on a gsap.com capture, concept comes from the vocabulary; every parameter
shows a label; the answer names the interaction model; `npm run build` green; an old
history entry (3-field params) still renders.

---

## Enhancement 2 — Load-time GSAP instrumentation (precision)

**Goal:** recover animations the snapshot misses. GSAP disposes finished one-shot tweens,
so a load-in reveal is gone by the time the user inspects. Instrumenting at creation time
captures the **original vars** as `SOURCE`-grade truth.

**Touch points:**
- `src/injected/instrument.ts` (new) — the hook + registry.
- `src/injected/main.ts` — run the hook **first**, at `document_start`.
- `src/manifest.config.ts` — ensure the MAIN-world injected script is `run_at:
  'document_start'` (instrumentation must beat the page's GSAP calls).
- `src/injected/gsap.ts` — at `EXTRACT`, merge registry records for the selected
  element into the payload.
- `src/lib/types.ts` — add an `instrumented` array to `RuntimePayload`.

**How:**

1. **Hook before GSAP exists.** At `document_start`, `window.gsap` is usually undefined.
   Install a trap so we wrap the moment it's assigned, and also handle the already-present
   case:

   ```js
   function installTrap(name, wrap) {
     let current = window[name];
     if (current) wrap(current);
     Object.defineProperty(window, name, {
       configurable: true,
       get: () => current,
       set: (v) => { current = v; try { wrap(v); } catch {} }
     });
   }
   // installTrap('gsap', wrapGsap); installTrap('ScrollTrigger', wrapScrollTrigger);
   ```

2. **Wrap the creation APIs.** `gsap.to/from/fromTo` (and `set`), `gsap.timeline` (also wrap
   the returned timeline's `.to/.from/.fromTo`), and `ScrollTrigger.create` + the
   `ScrollTrigger` constructor. Each wrapper records, then calls through to the original and
   returns its result unchanged. Never alter behaviour.

3. **Registry.** Keep an array of records — elements can't be JSON keys:
   ```
   { targets: string[],        // element descriptors (tag#id.class)
     method: string,           // "gsap.to" | "timeline.from" | "ScrollTrigger.create" | ...
     vars: object,             // serialized (reuse src/lib/serialize.ts)
     createdAt: number }
   ```
   Serialize `vars` with the existing `toJsonSafe` (functions → "[function]", ease objects
   kept, `scrollTrigger` config flattened). Cap the registry (e.g. 300 records).

4. **Merge at extract.** When `EXTRACT` fires for the selected element, include registry
   records whose `targets` match the selection (element itself, ancestor, or descendant).
   Mark values that came from the registry as `SOURCE` in the parameter labels (E1).

5. **Honest limits (document, don't fight):**
   - If the site bundles GSAP as an ESM module and never puts it on `window`, the trap can't
     see it → fall back to the existing snapshot. State this in the output.
   - Cross-origin iframes and WebGL/Canvas remain out of scope.

**Acceptance:** on a site with a load-in stagger that has already finished, inspecting the
element still returns the original `stagger`/`ease`/`duration` as `SOURCE` (not a guess);
sites without `window.gsap` still work via snapshot; `npm run build` green; Invariant 1
(only MAIN world reads page globals) and Invariant 2 (JSON across boundaries) hold.

---

## Not doing (recorded so it doesn't resurface)

- **MCP bridge / Claude Code as agent** — explored, not adopted. If ever wanted, it's a
  separate track, not a change to this build.
- **Page transitions** = V2. **WebGL / Canvas** = V3.
