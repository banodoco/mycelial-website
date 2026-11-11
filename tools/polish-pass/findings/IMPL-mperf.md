# IMPL-mperf: P4 (take-off hitch), P3 (stutter near the top), U2 (thread hover)
Branch polish/mperf, commits b2d28e4 and b13504d. The machine was at load 40-46 throughout, so every ms figure below is CPU time from `process.cpuUsage` in node. Wall time was meaningless. The Agent tool was not available to me, so I did all the work myself (no Haiku helpers).

## P4: take-off
- **colony.js prepare as a cached, resumable job** (journey/manifesto/colony.js, the "THE FLIGHT IS PREPARED AHEAD" block that replaces nearBodies+prepare).
  - `prepare()` is now a staged job keyed by pose, target, fov, roll, fieldCenter, aspect and innerHeight. Stages: JIT warm-up → planAerialReveals → links → gates + arrival-ordered ground/spore indices → near tiers (sliced per body) → tier orders → commit.
  - The job writes to scratch arrays and commits in one step. A phone's Purpose draws through the same plan and tiers while it runs, so it must not see half-written data.
  - Same key on press: no work. `plan` and the tiers are restored from cache, and links, sporeGate and indices are **not** re-uploaded. This removes the ~0.85 MB re-upload on every open, which the test pins.
  - Key changed, or the prewarm was abandoned: `prepare()` runs whatever is left, so the cost falls back to today's.
- **`colony.prewarm(from, aspect, budgetMs)`** runs the job in slices. On a later call it does a **warm draw**: one `renderer.render(realScene, cameraOnLayer31)` into `composer.readBuffer`.
  - It uses a 1×1 scissor, autoClear off, every instanceCount/drawRange at 0, and frustumCulled off for the duration.
  - So the bindings upload every colony buffer and nothing is drawn. Program variants match the frame's, because it is the real scene into the composer target.
  - The colony publishes itself under `Symbol.for('mycelial.manifesto.aerialColony')` so branch.js can reach it without importing three.
- **Slice cost** (node, CPU ms, budget 8, fresh process, 3 runs):
  - Desktop slices max 9.7 / 11.8 / 9.3. The press after the warm-up costs 1.2 ms (cold: 26-49 ms per O1; on this host 15-19 ms CPU for planAerialReveals alone).
  - Phone slices max 9.3 / 13.2 / 14.1. The press after costs 0.1-1 ms.
  - The over-budget slice is the single **planAerialReveals** call (pose.js, not mine). Six earlier 40-body calls JIT-warm it, which takes it from ~15 ms to ~2 ms on desktop, but the phone path stays 5-14 ms. Strict ≤8 ms needs pose.js to export a resumable version (see STRUCTURE).
- **branch.js**:
  - `prewarm({budgetMs})` method, plus module export `prewarmManifesto(options)` (latest branch). It returns true when nothing is left. It is idempotent, abandonable, has no timers of its own, and does nothing while the branch is active or under reduced motion.
  - On desktop (>720, the same predicate as fit/scroll-reading) it also pre-fits the text. The root is shown with `.is-measuring` and hidden again inside one task, so it is never painted. mycelial.css gives `.is-measuring` the open-page reserve.
  - `begin()` now calls `fitDesktop()` instead of `fitDesktop(true)`.
- **fit.js**: the cache key now includes a font-generation counter (`loadingdone`) and is-font-pending. A press with nothing changed costs one layout read instead of up to 12. The reserve variable is only written when its value changes, which avoids a second layout.

## P3: stutter towards the top (ranked plan; I stopped after step 3)
1. **Mid-flight uploads.**
   - Measured baseline, phone, 390×844, my harness on a pristine copy of HEAD:
     - First-sight `bufferData` of the ground mid-ascent (f114): 518+518+690+690+345 KB attributes plus a 173 KB index.
     - Then **7 whole-index re-uploads of 172,640 B** (`bufferSubData`) as the in-view set changed.
   - Cause: cullBatches re-compacted the ground and spore index every time the visible batch set changed.
   - Fix: indices are written once per prepared flight, in arrival order. A frame draws one contiguous `drawRange` covering its arrived, in-view batches. Culling still empties the range behind the camera, and on the phone at the top it still culls (1240/50400 vertices).
   - Instance culls now upload only from the first changed slot (`addUpdateRange`, ≤18 KB).
   - **After** (same harness, phone): the **7 index re-uploads are gone**. Ascent non-stream uploads fell from 7.27 MB to 6.08 MB.
   - The first-sight ground creation (2.9 MB) was still mid-flight in that run, so the prewarm warm draw did **not** take effect there. I could not finish diagnosing it before the browser moratorium. My best hypothesis is the ground's frustum test against the Purpose camera; b13504d disables it during the warm draw and adds a `colony.warm` QA getter. **This must be checked in a browser** (see below).
   - The remaining per-frame 50,400 / 16,800 / 10,908 B bufferSubData streams are hero-side (e.g. 4200 spores × vec3) and are not colony-owned.
   - Heap (orchestrator note on +41.5 MB at y≈58): a node sim of the colony's own set() loop over the whole desktop flight grows 18.38 → 18.65 MB (harness/mperf-heap.mjs). The colony allocates nothing mid-flight, so that step comes from elsewhere. It is still unattributed. Candidate areas to profile: Final/sky.js and the rail.
2. **TAA skip** (organism/organism.js taaFrame, `TAA_MIN_WEIGHT = 0.02`).
   - Below that weight the pass is `enabled=false` and the composer goes straight to the OutputPass. Jitter gain is 0 while skipped.
   - When the pass comes back, `validHistory=false`: blend weight 0 and history seeded from the current frame, the same restart a resize takes. The lens's sanitise shader is untouched.
   - Rests have weight 0.6, including frozen `?capture=`, so the pass runs exactly as before and goldens are unaffected.
   - Saves two full-resolution passes on every moving frame. Not measured in a browser.
3. **Words are compositor-only** (mycelial.css, end of file).
   - New keyframes `j-manifesto-ink-light`, `-name-light` and `-condense-light` animate opacity (plus transform for title glyphs). They replace site.css's blur/text-shadow/colour animations by `animation-name`, inside `prefers-reduced-motion: no-preference`.
   - The resting look is kept: line colour and shadow; the name's rgba(246,226,184,.96); the glyph shadow.
   - **Look change for the owner to judge:** the in-flight gold flush and blur-in are gone.
   - Concept pulses (colour/text-shadow on ~20 words) are left as they are.
   - Desktop sentence starts are already one layout: `liftColumn` returns early above 720 px, and the phone follow/padding code is untouched.
4. **LOD: not done.**
   - The bodies are not small at the top. Desktop body height ≈ s·54 px at y=70 on 1440×900; phone ≈ s·94 px at y=38. A pop-free screen-size fade with sub-pixel/4-12 px thresholds would therefore remove nothing.
   - Real savings need visible thinning of far-tier strands, e.g. a crossfade from stride 8 to 16 with gain ×2 keyed to altitude. That needs an eye check on a real GPU, which was impossible here.
   - Measured draws/vertices (phone baseline = after; the colony geometry is unchanged): u=0: 44 draws / 0.23 M verts; u≈0.5: 207 / 0.82 M (1.66 M verts×instances); u=1: 326 / 2.57 M (3.76 M).
   - Desktop at 480×300 reached 451 draws / 3.76 M verts by y=21 before I stopped the run.

## U2
- Inspection:
  - No concept phrase has any hover behaviour. Only the real chapter links (`.manifesto-chapter-link`) react: colour and underline on hover/focus.
  - The kinship phrase is the only concept with an underline, the "thread".
  - Fixed root cause: the line has `pointer-events: none` and the thread had no hover rule.
- Change (mycelial.css):
  - Under `@media (hover:hover)` the shown thread gets `pointer-events: auto`.
  - A registered `--thread-hover` property transitions to 1 in 0.2 s and is added to the animated `--thread-strength` in the gradient, so it brightens .48 → ~.98. They never fight over the same property.
  - The release waits 0.12 s, so crossing between wrapped lines does not flicker.
  - No focus stop and no cursor, because it is copy, not a link.
- **Ambiguity flagged:** "for all concept phrases uniformly" would mean drawing new underlines on ~15 other concept words. I did not do this, because it is a design addition. Concept phrases other than kinship have no wrapper span, so each would need one (branch.js plus build-static-content.mjs for the static twin).

## Tests
- `tools/test-manifesto-motion.mjs`:
  - Desktop/mobile "visible submissions" block now pins the new contract: the index never re-uploads through view changes or arrivals, the draw run is contiguous, whole strands are kept, and behind the camera it is empty and invisible. It previously pinned the re-compaction, which is the thing P3.1 asks to remove.
  - New block: a warmed press equals a cold press, takes several bounded slices, an unchanged re-entry re-uploads nothing, and an abandoned warm-up is finished by the press.
- `tools/test-mobile-manifesto-range.mjs`: also checks that the live mycelial.css keyframe keeps opacity 1 at 30 % (WORD_VISIBLE_FRACTION).
- Results:
  - `npm run lint`: 7 errors in mycelial/flowers.js and tools/test-inspire-departure.mjs, the same on pristine HEAD. My files are clean.
  - `npm run cycles`: ✔ no cycles.
  - `npm run test:unit`: stops at tools/test-rail-handoff.mjs:145 ("20 !== 72"), the same on pristine HEAD. Every other command in the chain passes, test-manifesto-motion included.
  - Browser-only tests (test-manifesto-fit, -links, -link-decoration, render-baseline) timed out here; they need Chrome on :8137.

## NEEDS-WIRING (journey.js, owner `perf`)
Register as a Final rest task in perf's warm queue; no timers of mine:
```js
// journey.js, after manifestoBranch is created (~:705)
registerRestWarmTask(({ budgetMs = 8 } = {}) => manifestoBranch.prewarm({ budgetMs }), { chapter: 'final' });
// (or import { prewarmManifesto } from './manifesto/branch.js' and register that)
```
It returns true when done; call it again after a resize (it re-keys itself).

## NEEDS-BROWSER-CHECK (run serially; harnesses in SCRATCH/harness)
1. `node mperf-ascent.cjs mobile 8145 after 4 prewarm`, then `node mperf-analyze.cjs ../captures/IMPL-mperf/ascent-mobile-after.json`.
   - Expect: the log line `prewarm {...warm.report.geometries >= 3, prewarmUpBytes >= ~3 MB}`.
   - Expect in the ascent: **no** bufferData ≥100 KB and no 172,640 B bufferSubData. Non-stream ascent uploads should be only the ≤18 KB instance ranges.
   - Expect draws unchanged: 44 / ~205 / 326 at heights 0 / .5 / 1.
   - If the 2.9 MB ground bufferData still appears mid-flight, the warm draw is not reaching the ground and needs debugging (colony.js warmDraw).
2. The same with `desktop 8145 after 4 prewarm`, and `desktop 8245 before 4` for the baseline. 8245 serves a pristine HEAD copy from SCRATCH/base.
3. `node mperf-u2.cjs 8145 after`. It writes u2-rest/u2-hover PNGs to SCRATCH/captures/IMPL-mperf/.
   - Expect `--thread-hover` 0 → 1, `:hover` true across every word and in the gap, and a visibly brighter thread.
4. Top-frame screenshots, written by mperf-ascent (top-*.png). I did not capture these. The colony geometry/LOD is unchanged, so only the text's arrival differs.

## STRUCTURE
- **Per-layer draws:** ~140 hero leaf layers × 2 tiers give ~280 colony draws at the top. The cleaner design merges layers per material kind into one geometry, with a layer-id attribute and a frame table, giving ~3-6 draws per tier. Cost: 1-2 days. Risk: medium (per-layer uniforms differ). Follow-up.
- **prepare reachable only from the press:** Final's `setManifesto(from)` calls `aerial.prepare`. The global-symbol handle stands in for a field-contract `prewarmManifesto` on final/index.js (not mine). Final should expose it so the symbol can go.
- **planAerialReveals is indivisible (pose.js, agent `pose`):** export a resumable form (state `{i, edgeLoad, frames}`) so the job can honour ≤8 ms on phones.
- **The word keyframes now live in two sheets:** mycelial.css overrides site.css by name. Move them whole into site.css (its owner) and delete the old blur keyframes.
- **Divergent phone predicates touched here:**
  - `isMobileManifesto(aspect)` (pose.js camera)
  - `innerWidth <= 720` (branch scrollReading, fit.js, my prewarm fit)
  - `innerWidth <= 620 && portrait` (final/index.js mobile seats)
  - `aspect < 0.9` (colony portrait)
  - CSS `max-width: 720px` / `620px`
  - I added none.
- **Instance culling by compaction** still uploads small ranges. A static arrival-ordered instance buffer culled in the vertex shader would upload nothing, but it trades away the vertex-work saving, so I kept compaction.
