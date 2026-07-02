import { digestForPrompt } from './digest'
import type { RuntimePayload, SelectedTarget } from './types'

// The Claude prompt lives in one place so it can be iterated without touching
// call sites (code-standards.md → Claude Integration).

export const SYSTEM_PROMPT = `You are Revelio, an expert GSAP animation engineer. You are given runtime \
animation data extracted live from a web page (GSAP tweens/timelines, ScrollTrigger instances, and \
CSS animations with resolved keyframes). Your job:

1. Identify the animation technique by its precise, commonly-used concept name.
2. Explain the technique in plain English so a developer learns the vocabulary, not just the code.
3. Write clean, ready-to-use GSAP code that recreates the technique as a strong starting point.
4. Break down the key parameters and what each one controls.
5. Write a self-contained PREVIEW that demonstrates the technique on the sandbox stage described
   under "Preview stage" at the end of the user message.

Rules for the GSAP code:
- Use modern GSAP 3 syntax. Include plugin registration (gsap.registerPlugin) when ScrollTrigger or
  SplitText are involved.
- Use generic, readable selectors (".hero-title", ".card") rather than the page's mangled class names.
- Prefer the values observed in the runtime data (durations, eases, staggers, start/end positions).
- If no GSAP is present but CSS animations are, still produce the GSAP equivalent of the technique.

Rules for the PREVIEW code (this runs live in a sandbox, so it MUST be self-contained):
- The sandbox provides a global \`gsap\` (core only) and a SPECIFIC DOM, already in the page, described
  under "Preview stage" at the end of the user message. Target ONLY the selectors listed there
  (e.g. gsap.from(".hero .line", { ... })). Do not create, query, or assume any other elements or text.
- Use CORE gsap ONLY: gsap.to/from/fromTo/timeline and stagger. NO plugins — ScrollTrigger, SplitText,
  and gsap.registerPlugin are NOT available and will throw. Reproduce text/line effects by staggering
  the relevant child elements listed in the stage outline.
- CRITICAL — the preview must AUTO-PLAY with NO user interaction. There is no mouse, hover, click,
  focus, drag, or scroll in the sandbox. NEVER add event listeners (addEventListener, onmouseenter,
  onclick, etc.) and NEVER leave a timeline paused waiting for one — it would just sit blank. For any
  interaction- or scroll-triggered technique (hover swaps, click reveals, scroll fade-ins), DEMONSTRATE
  it as an automatic loop: play the "in" state, hold briefly, play the "out" state, and repeat
  (e.g. a timeline with repeat: -1, or repeat: -1 + yoyo). Simulate the trigger on a timer, do not wait
  for it.
- NEVER end in an invisible state. If you start elements hidden (opacity 0, scaled/translated away), the
  animation MUST bring them back to fully visible within the loop so the stage is never blank.
- Do not reference window, document, fetch, or any external resource.

Respond in EXACTLY this plain-text format. Put each literal section marker on its own line. Do NOT \
use JSON, markdown headings, or code fences. Emit the sections strictly in this order:

<<<CONCEPT>>>
the technique's name, on one line
<<<EXPLANATION>>>
plain-English explanation, 2-5 sentences
<<<CODE>>>
the GSAP code, raw (no triple-backtick fences)
<<<PARAMETERS>>>
one parameter per line, formatted as: name | value | description
(repeat the line for each key parameter — the description explains what it controls)
<<<PREVIEW>>>
the self-contained core-gsap preview code, raw (no fences), targeting the selectors in "Preview stage"`

export function buildUserPrompt(
  target: SelectedTarget,
  payload: RuntimePayload,
  previewOutline: string | null = null,
): string {
  const subject =
    target.kind === 'element'
      ? `the element \`${target.selector ?? target.tag ?? 'unknown'}\``
      : 'the currently visible viewport section'

  // Send a compact digest (representative sample + true counts), not the full
  // dump — the full payload can be 100K+ tokens and adds no analytical value.
  return `Identify and recreate the animation running on ${subject} of ${target.url}.

Runtime animation data extracted from the live page. This is a representative sample; the \
\`counts\` field gives the true totals behind the sample:

${JSON.stringify(digestForPrompt(payload))}

${previewStageSection(previewOutline)}`
}

// Describes the DOM the PREVIEW code will run against. When we captured a clone
// of the real element, the preview stage IS that element — so the model targets
// its real selectors (listed as a tag.class outline). Otherwise it's the generic
// fallback stage of six demo blocks.
function previewStageSection(previewOutline: string | null): string {
  if (previewOutline && previewOutline.trim()) {
    return `Preview stage — your PREVIEW code animates the ACTUAL inspected element, already in the \
sandbox with its real markup and styles. Target these real selectors (tag.class tree):

${previewOutline}`
  }
  return `Preview stage — your PREVIEW code animates a generic stage: a <div class="demo-stage"> \
containing six <div class="demo-item"> blocks. Target only .demo-stage / .demo-item, treating the six \
blocks as lines/words/cards as appropriate.`
}
