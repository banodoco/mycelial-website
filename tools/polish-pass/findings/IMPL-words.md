# IMPL-words: original Manifesto entrance look, compositor-only
Branch polish/words, commit b2e24c7. Files: mycelial.css (end of file), journey/manifesto/branch.js. Nothing moved to site.css; pose.js/return-flight.js untouched.

## Design
- Plain words and title letters (47 of 53 words in sentence 2; markup-free, no break chars, no leading space) enter as three stacked layers. The word's own text is transparent while it arrives.
  - `::before`: sharp resting glyphs (cream, dark shadow). Opacity 0 until ~10% of the reveal, then 1 by 55%.
  - `fx::before` (blur-in): gold copy, blur baked in as a transparent-text `text-shadow` (7px radius, about sigma 3.5). Opacity 0 to 1 at 3%, 0 by 30%.
  - `fx::after` (gold flush): sharpish gold copy plus the original 16px amber glow. Peak .75 at 30%, .25 at 52%, 0 at 100% (front-loaded cooling, as the original's eased colour was).
  - The blur is raster, not a `filter`. That avoids a per-frame GPU blur pass on the promoted layers. Only opacity animates.
- Timing is the original's: same `--stagger`, `--word-reveal-duration` and easing (pose.js constants untouched, delay uses `--reveal-lateness` as before). Names use their 4.2 s curve, gold #ffe2a2-ish; title glyphs use the 2.6 s condense curve plus the original translate/scale (transform only).
- Resting look unchanged. Layers exist only in `.shown:not(.is-settled)`. branch.js `settleAfter()` adds `.is-settled` with ONE timer per sentence (`lastWordBeat*stagger + 3 s (4.2 s if the line has the name) - lateness + 0.2 s`) and one for the title. Un-showing a line cancels it. Timers are cleared on destroy. After that the fx elements are `display:none` and the word is plain text. Layered vs settled render is pixel-identical (0 of 249,600 pixels differ by more than 60/765 in my 2x capture).
- A11y/copy: layers draw from `data-w` via `content: attr(data-w) / ""` (empty alt text), fx span is `aria-hidden`, text layers are pseudo-content, so a selection copies the line once. Verified `Selection.toString()` equals the line text.
- Reduced motion: all new rules are inside `prefers-reduced-motion: no-preference`; reduced-motion keeps the existing code path unchanged.
- Batching of reads before writes is untouched (only class toggles and timers added in paintLines).
- Words that keep the opacity-only entrance: concept words (nested ink spans with their own colour), chapter links, the note marker, punctuation spans, hyphenated words, and a word that follows the name (leading space). About 6 of 53 words per sentence. Their blur-in/gold flush is still missing, so they look slightly sharper than the original when they arrive ("open models and open tools").
- Phones (existing `max-width: 720px` breakpoint): blur and flush share ONE layer (7px-ish blur with glow), wrapper hidden: 3 composited layers per word instead of 5. I did not do per-line layers because per-word stagger needs per-word opacity; this was the cheaper cut that keeps the stagger. On a phone the blur-in leads the original by roughly one word (sharper earlier); see filmstrip.

## Measurements (headless, software GL, load avg 12-18 on 4 cores; counts only, no ms-of-frame claims)
Page: sentence 2 (53 words) forced `.shown` on a hidden scene (canvases removed, rAF stubbed), 900x600. Harnesses: SCRATCH/words/paint4.cjs (trace), paint.cjs/layers2.cjs (layers), props.cjs (animated properties).
Variants: original = :8137 (main checkout), opacity-only = commit 02b5acf copy on a temp port, yours = :8152.

1. Animated properties of the word animations on the line (`getAnimations().effect.getKeyframes()`):
   - original: filter, opacity, color, text-shadow (53 `j-manifesto-ink`)
   - opacity-only: opacity (53)
   - yours: opacity only, 141 animations (47 words x 3 layers) + 6 opacity-only words. The remaining color/text-shadow/background-size on the line are the unchanged concept pulses and the kinship thread, present in all three.
2. Trace of a 3 s steady window mid-reveal, concept pulses disabled in all three so only the entrance differs (Chrome trace, categories devtools.timeline+cc+viz). Starved compositor, so only 2-4 frames committed per window; read as order of magnitude:

   | variant | Paint | RasterTask | Commit |
   |---|---|---|---|
   | original | 6 | 82 | 3 |
   | opacity-only | 2 | 3 | 4 |
   | yours | 0 | 0 | 2 |

   Per-frame text repaint during the reveal is zero for yours, as for opacity-only. Raster happens once, when a layer is first built (a first stepped-seek run, all pulses on, was too noisy to use: baseline concept pulses repaint in every variant).
3. Layer count (LayerTree, baseline 27 before the sentence):
   - original: 80 during the reveal, 83 AFTER it settled (finished animations keep their layers).
   - opacity-only: 80 during, 83 after (same reason).
   - yours (desktop): up to 268 at sentence start (3 layers + wrapper + the word itself per fx word; all words are promoted as their animation exists in delay), 172-231 mid reveal, 36 after settle (back to baseline plus the open page).
   - yours (phone 390x844): 173 at start.
   So transient layers are about 3x the original's. They are small word-sized layers and are gone after ~8 s, but this is the cost; I reduced it from 5 to 3 per word on phones only. Not reduced on desktop.
4. Not done: a real-flight trace of the actual `shown` toggle through branch.js (the whole Purpose-to-Manifesto flight is too slow under software GL here). The timer/settle logic is exercised only by the unit double (test-manifesto-motion passes) and by emulating `is-settled`.

## Filmstrip verdict (SCRATCH/captures/IMPL-words/, 2x, cropped to the sentence)
Files: `film-0-3.png`, `film-3-6.png`, `film-6-9.png` (orig above mine, times 0.25 to 7.5 s), `phone-film2.png`, `handoff-layers.png`/`handoff-plain.png`. Seeked deterministically via Animation.currentTime on both pages.
- Close: blur softness at entry, stagger, gold warmth, glow halo, time of the peak, the cooling wake, final cream. Alignment of the layers against the real text is exact (0 px diff at settle).
- Remaining differences, honestly:
  - Mine's sharpening front is about half a word ahead of the original's (the original leaves a longer soft tail).
  - The warm wake just behind the front is a touch brighter/yellower in mine at 3.6 s.
  - The original's blur radius slides continuously 7 px to 1.2 px; mine is two fixed radii crossfaded, so mid-transition words look a little less smoothly "focusing".
  - Concept words/links (above) lack blur and flush.
  - Phone: merged layer reads sharper earlier than the original.

## Tests
- `node tools/test-manifesto-motion.mjs`: pass. `node tools/test-mobile-manifesto-range.mjs` (greps live mycelial.css keyframe, 100% at 30%): pass. test-manifesto-concepts/-entry/-return, test-purpose-copy-fit: pass. `npx eslint journey/manifesto/branch.js`: clean.
- Not run (browser-only, container load): test-manifesto-links (reads `.j-manifesto-word` --w beats; my change only appends an empty child span), test-mobile-purpose-labels (timed out), the rest of the browser gates. The static test double needed `setAttribute` rather than `dataset`, handled.

## Owner must judge by eye on a real phone
- Whether the phone's single merged layer looks as soft as the original on arrival, and whether three layers per word (about 170 transient) stay smooth on a real mid-range phone during the heavy flight frames. If not: the cheapest next cut is dropping the blur layer on phones (opacity + gold flush only).
- The concept/link words (sharp arrival) next to blurred neighbours.
- Whether the first frame of a settled sentence shows any text-AA shift (the layered text is rastered in its own layer; headless showed none).

# ROUND 2 (commit 18b95da, supersedes the design/numbers above where they differ)
- Structure now: word = [lead space][fx][.j-manifesto-base(real content)]. Base is the sharp layer (opacity); fx::before = blur-in (5px text-shadow of transparent text), fx::after = gold flush (phone: one merged layer). Layers use linear timing and each has its OWN duration (k x word duration): sharp .32, blur .28, gold .5. fx is an inline-level abspos with no offsets, so it sits at its static position on the first letter's line (a trailing/leading wrap space no longer misplaces it).
- Concept words, links, punctuation and words after the name now get the same layers around their real content (their styling stays on the real content = the sharp layer). Excluded: the note marker (a styled button) and hyphenated words (the ghost cannot wrap), ~1-2 per sentence.
- Windowing: one shared timer (120 ms) marks a word .is-arriving 0.2 s before its beat (class writes only, no layout read; --act shifts the CSS delay), one delegated animationend on the column marks .is-done and drops that word's layers. Before its beat a word is invisible with no layer. .is-settled per sentence remains as backstop.
- Stops re-mapped from side-by-side rows (SCRATCH/captures/IMPL-words/r6-a.png, r7-a.png, phone-film3.png). Word by word vs original:
  - 0.8 s: original We/want/AI crisp, "and" slightly soft, "humanity" soft, "to grow" heavily blurred. Mine: We/want/AI/"and" crisp, "humanity" soft, "to grow" blurred, "together" faint: front about 0.5-1 word ahead, tail about 1 word longer.
  - 1.2 s: original crisp through "to", grow/together soft, "like" blurred, "this. Our" heavy. Mine identical word by word.
  - 1.8 s: crisp through "this." in both; "Our tools" soft in both; mine "have always" about one word crisper.
  - 2.6 s: original crisp through "what", "we create, so" blurred; mine within a word; original glow a little wider.
  - 5/7.5 s: "open models and open tools" now arrives blurred in both and ends gold in both.
  - Phone: same ordering as desktop, merged layer slightly bolder blur at the tail. Intermediate third radius NOT added: the rows matched without it.
  - Earlier "too early" reading came from the gold copy (nearly sharp) rising by 3-16% age; it now starts at ~16%.
- Layers (LayerTree, baseline 27; harness replicates branch.js's tick in-page, paint5.cjs): desktop sampled peak 88, event peak 148 once (transient, unexplained); phone sampled peak 62, event peak 72. 4 layers per arriving word on desktop (fx wrapper is itself promoted, plus base, blur, gold), 3 on phone. TARGET (<100 desktop, <60 phone) NOT reliably met: sampled desktop yes, phone just over, event peaks over. Previous round: 268 / 173.
- Mid-reveal repaint, trace (starved, 2-4 commits): 2 Paint and 85 RasterTask over a 3.9 s desktop window (previous round 0/0, original 6/82, opacity-only 2/3). Raster is layer creation as words enter their window, not per-frame text repaint, but I could not show it is zero per frame; animated properties remain opacity-only.
- Known side effect: while a word is arriving its fx is an out-of-flow box, so `innerText` of the sentence gains newlines. Selection.toString() (copy) and the accessibility tree are unaffected (copy checked); textContent unchanged.
- Settled render vs layered render: 0 pixels differ. Tests: test-manifesto-motion, -concepts, -entry, -return, test-mobile-manifesto-range, test-purpose-copy-fit pass; eslint clean. Browser-only link/decoration tests not run (the link space now sits outside the word's wrapper, inside the link, so the dotted underline under that space shows from the sentence start).
