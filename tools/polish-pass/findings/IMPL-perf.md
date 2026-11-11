# IMPL-perf — intermittent hitches (P5, P2, P1). Branch polish/perf, 8 commits on 6835391
No Agent tool was available to me, so there were no Haiku helpers; I did all the work myself. A browser moratorium stopped the "after" harness run (see NEEDS-BROWSER-CHECK).

## Measured BEFORE (my harness, base tree on :8246, desktop 800x500, ?nointro, settle 3 s, SwiftShader)
`SCRATCH/perf/lazy-gl.cjs`: counts bufferData/tex/mip/link calls, long tasks, layout reads per frame and custom-property writes per frame, per phase.
| hop | bufferData n / MB | tex n / MB (mips) | layout reads/frame | --prop writes/frame |
|---|---|---|---|---|
| mission->inspire | 35 / 0.08 | **30 / 52.9 (15)**, from the old warm pass | 53.7 | 170.6 |
| inspire->equip, equip->inspire | 0 / 0 | 0 | 59.2 | 171 |
| inspire->connect | 9 / **0.32** | 0 | 58.2 | 169.3 |
| connect->final | 327 / **4.60** | 0 | 58.0 | 168.5 |
| final->owned | 75 / **2.31** | 0 | 58.5 | 168.9 |
Mobile 390x844: my run was killed by the time limit. Use O2's run: connect->final 4.10 MB, and 26.4 MB of textures in the first hop.

## P5 / P2: items 1 and 2 — one rest-aware warm queue (journey/journey.js, `warmHiddenChapters` ~:2135-2400)
- **Shared predicate `isAtRest()`**: no `transition.blend`, no `cameraStateDisagree`, `intro.complete` is not false, and no Manifesto ascent/descent running. It is exposed as `journey.atRest`. The resolution governor reads it too (item 6).
- **Units, one per idle slice, in this order for each chapter**: the chapter compile (as before) → ONE stale texture per slice → **warm draws**, one per subtree of ≤1 MB / ≤160 objects (subtrees over budget are split). Final's 20 MB tree becomes about 20 units.
- **Warm draw**: renders the real Scene (so fog and program variants match) into a **1x1 clone of composer.readBuffer** (same HalfFloat type, 4x MSAA). Everything off the unit's path is hidden, `frustumCulled` is off for the unit, then visibility, frustumCulled and the render target are restored.
  - I chose this over binding readBuffer with a 1x1 scissor: no pixel, viewport, scissor, autoClear or TAA-history state that a frame reads is touched at all. Rest frames are identical by construction.
  - The 1x1 target is allocated once and never freed (one 1x1 MSAA target).
- **Scheduling**:
  - It starts at `activate()` (the journey is interactive) on the first idle callback. The +7.6 s timer is gone.
  - Units run only after ≥300 ms of rest. A unit starts only if `timeRemaining() ≥ 6 ms`; otherwise one unit runs per 1.5 s of starved rest.
  - Order is nearest chapter first in **rail order** (mission, inspire, equip, connect, final, owned), measured from `chapterAt(p)`. A jump moves p to the destination on the click frame, so after a flight lands the destination comes first.
  - After each flight the textures are re-checked against `renderer.properties.__version`. Photo atlases and remix swaps then upload at the next rest, never on first sight. An upload three declines is tried once per version.
  - Once everything is drained, the queue sleeps until the next flight.
- **Hover atlas (uMapH)**: the shader samples it on every Owned draw (portraits.js:1151). So the "keep lazy" comment (portrait-remix.js:273) never made it lazy: it was uploaded on Owned's first draw, mid-flight. It now uploads in its own rest slice, which follows the brief's "its lazy upload must not hitch".
- **Software rasteriser** (`rendererName` matches swiftshader/llvmpipe/software): warm DRAWS are skipped, as boot's warm-up always did. `?warmdraw=1` keeps them so the harness can measure.
- **`registerRestWarmTask(fn, {chapter})`**: available on the journey handle and inside journey.js. `fn(deadline)` may return true ("call again", re-polled after 150 ms) or a promise. With `chapter` set, it runs only while resting AT that chapter, after that chapter's own units. The comment block names the wiring line for mperf's prewarm (below).
- **Verified**: new `tools/test-rest-warm-queue.mjs` runs the shipped code against fakes. W1: nothing runs mid-flight or in the first 300 ms. W2: every geometry is drawn once, into the 1x1 target, with siblings hidden. W3: visibility, culling and the target are restored. W4: one upload per texture and no retry loop. W5: rail order from Connect is connect→final→owned→… W6: a chapter task runs only at its chapter. A texture swapped in later is uploaded at the next rest. I mutation-checked it (W1, W3 and W5 each go red under a one-line break).

## P5: item 4 — rail.js
`purposeVar()` (defined after `root`, :576-585) skips a write when the string is unchanged. All 26 Purpose-tree root writes (:2693-2745) go through it.
- `root` is `nav.j-rail`, not the document, so the restyle was already scoped to the rail subtree. Moving the vars further down would need CSS changes: consumers include the root's scrim. Not done.
- Quantising: not done. The values change every frame in flight anyway, and they are exactly at their endpoints at rest. Rounding would only risk ±1 LSB in flight for no measurable win.

## P2: item 5 — hotspot-frame.js
- Added `setVar()`, a per-element memo, for the 9 `--j-hot-*` writes and `--j-hit-x`.
- `tabIndex` and `aria-hidden` are written only on change (an `h.ariaShown` memo, because the fake DOM in the tests has no getAttribute).
- **Pill-size cache: not done.** The one forced layout per frame comes from the first read, `getBoundingClientRect` on the copy blocks, which runs after `rail.update`/`copy.step` have written. The 58 offset reads that follow it hit a clean layout. Caching pills does not remove that forced layout. Removing it means reading before those writes, which changes the values read in flight (frame order is pinned). STRUCTURE §D: a measure/paint split with a ResizeObserver plus fonts invalidation. That adds a page-lifetime observer, which tools/test-page-lifetime.mjs budgets.

## P5/P1: item 6 — organism/performance.js, organism.js
- **Ratchet hold**: the post-settle catastrophic ratchet (new `canStep` dep) holds a decided step while `journey.atRest === false` and applies it on the first rest frame. The calibration step is unchanged. Checked with a node sim: held mid-flight, applied once after landing.
- **Resize**: coalesced at organism.js ~:2322. The first event applies at once, the rest of a burst collapse into one trailing apply after 150 ms, and an event with no size or DPR change is dropped. `addEventListener('resize', viewport.resize)` is kept verbatim (pinned by test-initial-render-target-size).
  - Watch on hardware: during a desktop window drag the canvas is CSS-stretched for up to 150 ms.
- The organism→journey read goes through `globalThis.journey.atRest`. The organism had no handle to the journey; this is the only coupling.

## P1/P5: item 3 — portraits (partly done)
- `portrait-photo-loader.js` now calls `image.decode()` before resolving, so the first atlas bake no longer decodes the 390 KB JPEG synchronously inside drawImage. A refused decode still resolves. I edited this file under "sibling portrait files", although it sits in journey/chapters/owned/. Owner, please confirm.
- NOT done:
  - Moving the sprite-arrival bakes and `prepareRemix` into the queue. tools/test-ui-closure.mjs A2b forbids journey.js from reaching `chapters.owned.portraits`, and portrait-remix.js is a pinned "THIS IS A MOVE" file. See NEEDS-WIRING.
  - The remix's own `schedulePrepare` (rIC, 1.5 s) can still land in a flight after a Remix click.

## P2: item 7 — not done
The three `applyFrame` calls on a click are pinned by test-frame-order and test-transition. I cannot prove the published frame is identical without a browser. O3 also advises leaving them.

## P1: item 8
- **Chapter builds**: these already yield one chapter per rAF+setTimeout(0) (handoff.js:546-551). Splitting inside a chapter build means editing chapters/** (not mine). Not done.
- **Card media**: implemented, then reverted (commit 67ec8f0). Removing the import-time `startCardWarming()` breaks test-card-icons and test-card-registry. Those are frozen-move proofs: "importing index.js schedules exactly [1500]", and reverse-applying the move must reproduce the pinned pre-move bytes, so ANY byte change to cards/index.js reds them. test-card-warming Part C already fails here: its `git show` SHA is absent from this shallow clone.
  - The ready change is in `SCRATCH/perf/card-warming-deferral.patch`: an `enqueue` mode with `fetch(..., {priority:'low'})` and no self-start.
  - Plus one line in journey.js `warmHiddenChapters` (comment marks the spot): `startCardWarming({ enqueue: (job) => registerRestWarmTask(() => { job(); return false; }) });` with `import { startCardWarming } from './cards/index.js';`.
  - The owner must re-base the two move proofs (`selfStartDelays: []`, plus their pinned pre-move bytes) in the same commit.

## NEEDS-WIRING
- index.html (preload the headline face): `<link rel="preload" href="./assets/fonts/mycelial/cormorant-regular.ttf" as="font" type="font/ttf" crossorigin>`
- mperf's Manifesto prewarm, in journey.js after `manifestoBranch` exists: `registerRestWarmTask(() => manifestoBranch.prewarm(), { chapter: 'final' });`
- Owned remix at rest (owned/index.js, chapter owner):
  - `portraits.photosReady.then((ok) => ok && sceneApi.registerRestWarmTask?.(() => portraits.prepareRemix(sceneApi.renderer), { chapter: 'owned' }));`
  - This needs journey.js to also install `sceneApi.registerRestWarmTask = registerRestWarmTask;`, after checking test-frame-publication's install pins.
- Card media: see item 8.

## NEEDS-BROWSER-CHECK (run serially; port = the merged server)
- `node SCRATCH/perf/lazy-gl.cjs desktop inspire,equip,inspire,connect,final,owned 20000 after <port> warmdraw=1`
- `node SCRATCH/perf/lazy-gl.cjs mobile connect,final,owned 20000 after <port> warmdraw=1`
- Expect, for every `X->Y` hop:
  - bufferData > 64 KB ≈ 0 (before: 0.28 / 2.79 / 1.67 MB on ->connect / ->final / ->owned)
  - total bufferData ≈ the per-frame dynamic level only (before: 4.60 MB on ->final)
  - 0 texStorage/texImage and 0 generateMipmap (before: 30 / 52.9 MB / 15 in the first hop)
  - those bytes move into `settle` and `:rest` phases instead
  - `--prop writes/frame` at rest well below 162 (unchanged values are now skipped); in flight, roughly unchanged
- Caveats:
  - 20 s rests matter. At about 1 fps a short rest cannot drain Final's ~20 units. That is real on a phone that is clicked through fast, and the destination still uploads on first sight.
  - Without `warmdraw=1`, SwiftShader skips the draws by design.
  - Also run `node tools/browser-smoke.mjs` (boot path touched).

## FOLLOW-UP: phone tier (not implemented; for the owner)
- Phones run the desktop pipeline at DPR min(dpr, 2): 4x MSAA RGBA16F, bloom, TAA and grade at full resolution.
- Proposed tier for `(pointer:coarse) and max-width 900px`, at 390x844:
  - DPR cap 1.5: 44% fewer pixels.
  - MSAA 4x → 2x: TAA already integrates the jitter.
  - Bloom at half CSS size.
  - Grade halation taps cut from ~10 to 4.
- Expected gain: about 2x on the full-screen passes (fill-bound on phone GPUs), and ~75 MB less target memory at DSF 3.
- Risk: the 430x932 goldens are shot at the desktop tier. A phone tier needs its own goldens, or capture must pin the tier.

## STRUCTURE
- **Done**: one queue with one predicate. The journey warm pass and geometry warm draws use them, and so does the governor's ratchet; mperf, the Owned remix and card media can each join with one line.
- **Still separate**: hero-gpu (boot-gated, correct as is), card warming (blocked by the move proofs, above), portrait bakes (blocked by test-ui-closure A2b and the move-file pins).
- **Cleaner next step**: move the queue to `journey/boot/warm-queue.js` with injected `isAtRest`/`here`, so chapters can register through sceneApi. Cost is about 0.5 day plus re-basing those pins. Risk is low.

## Tests
- New: `tools/test-rest-warm-queue.mjs` (pass).
- Unchanged and passing: test-startup-recovery, test-gpu-preparation, test-frame-order, test-ui-closure, test-hotspot-departure, test-card-icons, test-card-registry, and test-portrait-{lifecycle,harness,perturbation,textures,baked,dealer}.
- Failing identically on the untouched base copy (pre-existing, not mine):
  - test-intro-readiness (`prepareGpuWarmup` not in its rig; I checked the loader part separately)
  - test-frame-publication C5, test-rail-handoff:145, test-page-lifetime D1, test-renderer-resources (shallow-clone `git show`), test-card-warming Part C, test-portrait-paint
- `npm run test:unit`: fails at test-rail-handoff:145 (actual 20, expected 72), same as base.
- `npm run lint`: 16 problems (7 errors), same count as base, none in my files.
- `npm run cycles`: same madge-resolve failure as base.
- My full-suite runs, base and after, were each cut off at the 30-minute background limit. On the overlap, the only diffs were baked-lifecycle and body-dissolve going 1→0 (load timeouts in the base run).
- **Check by eye on hardware**:
  - First-hop smoothness right after load.
  - Connect→Purpose on a phone after ~5 s at Connect.
  - The resize behaviour during a desktop window drag.
