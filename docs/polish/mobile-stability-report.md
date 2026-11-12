# Mobile stability: why the phone tab dies and heats, and what changed

Branch `fix/mobile-stability`, 2026-11-11/12. Owner report: on an iPhone (Chrome, which is WebKit) the site
"crashes entirely ... just shuts down" after clicking around for a while, and the phone heats up.

## Verdict, first

- **No leak was found.** In an 8-loop phone soak (before and after trees), nothing grew from one loop to the next: GL objects, GL bytes,
  DOM nodes, detached nodes, listeners, timers, rAF chains, observers and workers all stayed flat. Each loop tapped
  every rail section, opened two cards per chapter, opened the menu, opened the Manifesto, went to Ownership and
  pressed Remix twice. Three full Manifesto ascents also showed no growth, and context loss recovered.
- **What a phone does pay for is a large, fixed GPU footprint, and a page that never stops drawing.**
  - At a phone's 2× pixel ratio the render pipeline held about 300 MB of GPU memory. About 107 MB of that was
    multisample buffers that changed no pixel.
  - The full pipeline (scene into a 4× MSAA float target, bloom, TAA, grade, output) was drawn on every frame for
    the life of the page. That included rest and the time when the menu covers the scene.
  - On iOS that combination explains both symptoms. WebKit counts GPU and canvas memory against the tab's budget
    and jetsam-kills the tab when it is exceeded (the tab "just shuts down"). Sustained full-rate GPU load is the
    heat. A memory budget that is already tight is then tipped over by whatever else the phone is doing.
- **Fixed (no change to the frozen look at rest):**
  1. One multisampled composer target instead of two (−65 MB at 2× DPR, measured).
  2. A single-sampled canvas (about −42 MB at 2× DPR, computed: the census cannot see the default framebuffer).
  3. A rest cadence. On touch devices the composer draws at half rate after 8 s at rest with no input, and holds
     its frame while the phone menu covers the scene.
  4. A retired Remix atlas now frees its canvas backing store at once.
- **Not determined here:** whether this was *the* kill on the owner's phone. Software GL in a Linux container
  cannot reproduce iOS memory limits, jetsam, thermal throttling or WebKit's layer policy. The owner checks at the
  end of this report say how to confirm on the phone.

## What was measured, and how

Tool: `tools/soak/mobile-soak.cjs` (new; NOT shipped, nothing imports it). `tools/soak/summarize.cjs` tabulates runs.

Setup:
- Headless Chromium with SwiftShader.
- 390×844, `isMobile`, `hasTouch`, DSF 1 unless noted.
- `?nointro=1`, real clock.
- Taps are real touch events where the element is on screen.
- The "before" tree is HEAD of this branch at start (`74b4c1a`), served from a separate worktree. The "after" tree
  is the working tree.

After every loop the harness records:
- **GL census.** The WebGL2 prototype is wrapped before page load. It records live
  texture/buffer/framebuffer/renderbuffer/program/shader/VAO counts (create minus delete) and estimated bytes
  (texImage/texStorage/bufferData/renderbufferStorage[Multisample] sizes, mip chains). It also records
  `renderer.info.memory` and `programs.length`.
- **JS heap** after two forced GCs (CDP `HeapProfiler.collectGarbage`, `Runtime.getHeapUsage`).
- **DOM:** document node count; CDP `Memory.getDOMCounters` live nodes and JS listeners. Detached nodes are live
  nodes minus document nodes.
- **Scheduling:** outstanding setTimeout/setInterval/rAF/requestIdleCallback (wrapped, with call sites);
  Intersection/Resize/Mutation/Performance observers; Workers.
- **Layers proxy:** `document.getAnimations().length` and `will-change` elements. The CDP LayerTree domain reported
  no tree under headless SwiftShader, so a real layer count was not available.
- **Rest work:** a 4 s window at rest (rAF callbacks/s, draw calls/s, JS ms/s inside rAF). The same window is
  taken again after 10 s with no input. The table shows **draw calls per frame**, because SwiftShader runs at a few
  fps and only counts are meaningful.
- **Additional modes:**
  - `--races`: second destination mid-flight; menu opened mid-flight; Manifesto then Return at once; double tap.
  - `--lose-context`: `WEBGL_lose_context` at rest and mid-flight.
  - `--manifesto`: N full ascents, each waited to its landing.
  - `--probe --dsf 2`: footprint at 2× DPR. Pin `?pr=2`, or the governor calibrates SwiftShader down to 1×.
  - At the end of a run: a synthetic hidden tab, and the menu left open.

### Per-loop table, phone, before vs after

Loop samples are taken back at Intro, 3 s after the last tap. "idle" is the same probe 10 s later with no input.

| sample | heap MB | GL MB (est.) | tex | buf | fb | rb | vao | three geo | DOM nodes | detached | listeners | timeouts | rAF | idle cb | observers | workers | draws/frame rest | draws/frame idle |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| before boot | 17.99 | 95.03* | 34 | 134 | 16 | 17 | 40 | 27 | 2152 | 87 | 318 | 0 | 1 | 1 | 5 | 0 | 44 | 44 |
| before loop1 | 20.05 | 107.01 | 35 | 539 | 16 | 17 | 163 | 140 | 2183 | 1054 | 362 | 1 | 1 | 0 | 5 | 0 | 44 | 46 |
| before loop2 | 20.43 | 107.01 | 35 | 539 | 16 | 17 | 163 | 140 | 2183 | 1054 | 362 | 1 | 1 | 0 | 5 | 0 | 45 | 44 |
| before loop4 | 20.68 | 107.01 | 35 | 539 | 16 | 17 | 163 | 140 | 2183 | 1054 | 362 | 1 | 1 | 0 | 5 | 0 | 43 | 44 |
| before loop6 | 20.83 | 110.02 | 35 | 550 | 16 | 17 | 165 | 142 | 2183 | 1054 | 362 | 1 | 1 | 0 | 5 | 0 | 44 | 45 |
| before loop8 | 20.94 | 110.02 | 35 | 550 | 16 | 17 | 165 | 142 | 2183 | 1054 | 362 | 1 | 1 | 0 | 5 | 0 | 46 | 44 |
| after boot | 17.68 | 48.48* | 32 | 134 | 15 | 14 | 40 | 27 | 2152 | 87 | 323 | 0 | 1 | 1 | 5 | 0 | 22 | 22 |
| after loop1 | 20.05 | 90.69 | 35 | 539 | 15 | 14 | 163 | 140 | 2183 | 1054 | 367 | 1 | 1 | 0 | 5 | 0 | 44 | 22 |
| after loop2 | 20.45 | 90.69 | 35 | 539 | 15 | 14 | 163 | 140 | 2183 | 1054 | 367 | 1 | 1 | 0 | 5 | 0 | 45 | 22 |
| after loop4 | 20.65 | 90.69 | 35 | 539 | 15 | 14 | 163 | 140 | 2183 | 1054 | 367 | 1 | 1 | 0 | 5 | 0 | 38 | 22 |
| after loop6 | 21.54 | 93.70 | 35 | 550 | 15 | 14 | 165 | 142 | 2183 | 1054 | 367 | 0 | 1 | 1 | 5 | 0 | 26 | 22 |
| after loop8 | 21.65 | 93.70 | 35 | 550 | 15 | 14 | 165 | 142 | 2183 | 1054 | 367 | 0 | 1 | 1 | 5 | 0 | 46 | 22 |

\* Boot samples differ in how many late textures (the photo atlases) had landed, so compare loop rows, not boot rows.
Raw JSON is reproducible with the commands below.

**Per-loop growth, loop 2 → loop 8 (6 loops each):**

| | heap | GL bytes | buffers | VAOs | geometries | DOM | detached | listeners | timers | rAF | observers |
|---|---|---|---|---|---|---|---|---|---|---|---|
| before | +0.09 MB/loop | +0.50 MB/loop | +1.8 | +0.3 | +0.3 | 0 | 0 | 0 | 0 | 0 | 0 |
| after | +0.20 MB/loop | +0.50 MB/loop | +1.8 | +0.3 | +0.3 | 0 | 0 | 0 | 0 | 0 | 0 |

The GL "growth" is one step in both trees: +11 buffers, +2 VAOs, +2 geometries, +3 MB, in loop 5 or 6, flat
before and after it. It is something drawn for the first time late (most likely an Owned/Purpose object reached by
a different deal), not a per-loop allocation. The heap moves by ±0.5 MB from loop to loop with no trend beyond
about 0.1–0.2 MB/loop, which is within JIT and code-cache noise. Nothing in this table grows with use.

The 1,054 detached nodes are constant from loop 1 on. They are the card stages and popover/detail DOM, built once
per node and cached (journey/cards/popover-tier.js `stageCache`). They are bounded by the node count.

### GPU footprint at the phone's pixel ratio (2×, `?pr=2`, boot)

| | GL bytes seen by the census | largest allocations |
|---|---:|---|
| before | **215.6 MB** | 4× MSAA colour rb 40.2 MB ×2, 4× depth rb 20.1 MB ×2, hover atlas ~22 MB‡, three 10 MB float targets, ... |
| after | **150.3 MB** | 4× MSAA colour rb 40.2 MB ×1, 4× depth rb 20.1 MB ×1, hover atlas, ... |

The census cannot see the canvas's own default framebuffer. Before, it was `antialias: true`: at 780×1688 that is a
4× RGBA8 colour buffer and a 4× depth-stencil buffer, about 42 MB, plus the 5 MB resolve, which is kept. So the
real drop is **≈ 107 MB at 2×**. At 3× devices the ratio is capped at 2, so the same figure applies.

‡ The census multiplies mip chains for both `texStorage2D(levels>1)` and `generateMipmap`, so it reads the
4096×1024 hover atlas as 28.4 MB. The real size is ~22 MB.

### Work at rest

| | before | after |
|---|---|---|
| draw calls per frame, at rest, 3 s after input | 44 (Intro) | 44 (unchanged: full rate for 8 s after any input) |
| draw calls per frame, after 8 s at rest with no input (touch) | 44: full pipeline, every frame, forever | **22**: composer every other frame. Animators, clock and rAF still every frame |
| Manifesto at rest, idle | 420–525 | **210** |
| menu open (phone: the panel covers 92% of the width) | 59–132 draws/s, full rate | **0 draws/s**: last frame held (both after runs) |
| tab hidden | composer already gated by `visibilitychange` (organism/animation.js), and WebKit also stops rAF | unchanged |
| pixel ratio on phones | `min(devicePixelRatio, 2)`, no phone tier; the governor is a one-way ratchet and only steps post-settle when most frames hit the 50 ms clamp. It did not oscillate in any run | unchanged (see recommendations) |

### Context loss (`--lose-context`, after tree)

- **At rest** (`WEBGL_lose_context.loseContext()`, 800 ms later `restoreContext()`): lost and restored events fire;
  `isContextLost()` false; `glError` 0; three re-registers on the next draws; the page navigates (Inspire → Intro)
  afterwards. **Recovers.**
- **Mid-flight** (during a flight to Connect): same result. The flight lands and the session continues.
  **Recovers.**
- main.js's handler (preventDefault, render gated, TAA history invalidated on restore, a note only after 2.5 s) is
  correct. The new single-sampled rt2 and the canvas change go through three's normal restore path.
- Not testable here: a loss that iOS **never restores**. The page then shows the static fallback note after 2.5 s,
  as designed, and does not crash.

### Rapid input (`--races`, after tree; plus two isolated repro scripts on both trees)

- **Covered:** second destination mid-flight, menu opened mid-flight and closed 500 ms later, Manifesto then Return
  at once, and a double tap on a rail item.
- **Result:** no duplicated loops (always exactly 1 outstanding rAF), no listener growth (constant 367), no timer
  growth, no stuck flights, no page errors.
- **One unexplained observation.** In the first races run (with a context-loss test queued for after the sample,
  and two other browsers loading the host), the page sat at rest in Intro with the rAF loop at 56/s and **0 composer
  draws**.
  - The context was not lost: the extension loaded, and a forced loss/restore did not revive drawing.
  - The gates that can do that are: `renderEnabled` (context loss only), `pageVisible`, the prelude `holdRender`,
    and the new cadence hold.
  - The cadence hold returns 0 only while `.j-menu.open` is laid out at ≥ 85% of the viewport width, i.e. while the
    menu really covers the screen.
  - It did **not** reproduce in three further attempts: two isolated race scripts on the after tree (one also on
    base) and a second two-loop races soak with gate diagnostics, which rendered normally (44–45 draws/frame).
  - The likeliest reading is that the mid-flight menu open/close race left the menu genuinely open, in which case
    holding the frame under it is the intended behaviour. That is not proven. See "for the owner".

### Suspects: each confirmed or cleared

| suspect | verdict | evidence |
|---|---|---|
| Warm queue periodic re-scan (journey/journey.js:2168 `WARM_RESCAN_MS`, :2515 `waitAtRest`) | **Cleared as a leak; small perpetual CPU.** At rest it keeps one 250 ms watcher timer and re-walks every chapter every 3 s. A fresh walk (`warmReport()`, same traversal) costs 2–22 ms on this host. Its 1×1 warm target is a single clone and is not re-created (fb/rb counts are flat) | soak `warmWalkMs`, flat fb/rb |
| Manifesto word layers, per-sentence timers, `animationend` | **Cleared as a leak.** The spans are built once, timers are bounded (a Map keyed per line), and listeners are added once. After Return, animations drop from 105 to 1. See the note on the 105 below | soak-manifesto, static audit of branch.js |
| Colony prepare cache keyed by pose/aspect/`innerHeight` (journey/manifesto/colony.js) | **Bounded.** Single slots (`job`, `prepared`); a new key overwrites. On iOS a toolbar height change re-plans on the next press: CPU, not memory | static audit |
| Portrait atlases and Remix | **No GPU leak** (old textures are disposed via portrait-textures.js `retire`). **CPU canvases** waited for GC, ~24 MB per remix. **Fixed**: they are released at once | static audit + fix |
| Card media videos | **Cleared.** ADOS pauses, drops `src` and calls `load()` on close. Arca pauses but keeps `src` on a cached, paused element (buffered data kept, nothing decodes). No object URLs | static audit |
| Hero-spores worker | **Cleared.** `workersLive` is 0 at every sample | soak |
| TAA/render targets recreated on resize | **Cleared.** organism.js already throttles resize (150 ms trailing) and drops no-op events; `setSize` disposes the old targets. fb/rb counts are flat | code + soak |
| +41.5 MB heap step in the (desktop) Manifesto ascent | **Not reproduced on phone.** Three full phone ascents: heap 19.5 → 20.1 MB. The desktop ascent was not re-run here, so it remains unattributed | soak-manifesto |
| Listeners re-added per chapter entry | **Cleared.** 362/367 constant across all loops | soak |
| CSS blur/backdrop/`will-change` | 6 `will-change` elements, constant. `backdrop-filter` appears only on the Manifesto reading-edge strips (2rem, opacity 0 until scroll-reading) and the hero-deco pill. Not a growth source | soak + grep |
| Rest never idles | **Confirmed; fixed** (rest cadence) | soak "draws/frame idle" |
| Doubled MSAA targets | **Confirmed; fixed** | probe at 2× |

## Findings and fixes

### F1. The second composer buffer was 4× multisampled with a 4× depth buffer it never used: 65 MB at 2× DPR

- **Root cause.** vendor/three/addons/postprocessing/EffectComposer.js:38 builds `renderTarget2` by `clone()` of the
  supplied target. organism.js supplies a `samples: 4` HalfFloat target, so rt2 inherited 4× MSAA colour plus 4×
  depth.
- **Why rt2 needed it.** The pipeline swaps after TAA, grade and output (three `needsSwap` passes; RenderPass and
  bloom do not swap, EffectComposer.js:128). With an odd count, the read buffer flips every frame, so the scene draw
  landed in rt2 on alternate frames.
- **Fix** (organism/organism.js:215-240, :2171):
  - rt2 is replaced by a single-sampled, depthless HalfFloat target, and the old one is disposed.
  - The read buffer starts at rt1, and `pinSceneTarget()` swaps back after every composed frame, so the scene always
    draws into the multisampled rt1.
  - Full-screen passes now write a single-sampled target. They covered every sample of every pixel with one value,
    so the resolve returned it unchanged: no pixel changes.
  - The helpers that bind `composer.readBuffer` for warm-up and compile (journey/boot/hero-gpu.js:26,57,71,
    journey.js:2335) now always see the scene target, which is what they assumed.
- **Evidence:** census at 2×: 215.6 → 150.3 MB, two 40.2 MB and two 20.1 MB renderbuffers down to one each; per-loop
  table at 1×: 107.0 → 90.7 MB.
- **Test:** tools/test-mobile-stability.mjs M3a–c (including a simulation of the vendored swap rule at three
  parities); tools/test-initial-render-target-size.mjs still passes.

### F2. The canvas asked for antialias that nothing used: about 42 MB at 2× DPR

- **Root cause.** organism/renderer.js created the renderer with `antialias: true`. Only the composer's final
  full-screen OutputPass draws to the canvas: every scene draw goes into the composer's own 4× target, as
  organism.js's comment already said. A 4× default framebuffer therefore resolved to exactly the single-sampled
  picture.
- **Fix:** `antialias: false` (organism/renderer.js:23).
- **Test:** M4.

### F3. The page never idled: full pipeline at full rate, at rest and under the menu, forever

- **Root cause.** organism/animation.js's loop rendered every frame unless the context was lost or the document was
  hidden.
- **Fix:** organism/rest-cadence.js (a pure policy) plus a fourth gate in organism/animation.js:29,:125, wired in
  organism/organism.js:2415-2440 beside the governor (whose `canStep` already uses the same at-rest predicate).
  - On a `(pointer: coarse)` device, after 8 s at rest with no pointer/touch/wheel/key input, the composer draws
    every other frame.
  - While the opaque `.j-menu` panel is open and ≥ 85% of the viewport width, it holds the last frame.
  - Any input restores full rate on the same frame (capture-phase listeners).
  - Flights, fine pointers and `?capture` are never throttled.
  - A window resize always lets a frame through.
  - The loop, the clock and every animator still run each frame, for the reasons the existing gate comment gives (the
    governor's calibration window).
- **Evidence:** idle draws/frame 44 → 22, Manifesto idle 420 → 210, menu open 132 draws/s → 0.
- **Look:** the frozen goldens are taken under `?capture`, which bypasses this. A live phone at rest shows the same
  slow sway and drift at 30 fps.
- **Test:** M1a–f (policy), M2a–c (the real animation.js executed with a fake rAF; mutation-checked: removing the
  gate turns 3 rows red).

### F4. A retired Remix atlas kept its canvas backing store until GC

- **Root cause.** journey/chapters/owned/portrait-textures.js `retire()` disposed the GPU texture but left the
  2048×512 / 4096×1024 canvas as `texture.image`. That is about 24 MB per remix, waiting on GC; WebKit accounts
  canvas memory against a page budget and reclaims it lazily.
- **Fix:** `releaseCanvas()` shrinks a retired atlas's canvas to 0×0 (portrait-textures.js:11, :53). Protected and
  wired textures are untouched.
- **Test:** M5; tools/test-portrait-textures.mjs 7/7, test-portrait-harness and test-portrait-lifecycle pass.
- Not measurable here: Chromium's canvas memory is not visible to the census.

## What I could not determine or fix (blunt)

- **Whether memory was the kill on the owner's phone.** The fixes remove ~107 MB of GPU memory and halve GPU work at
  rest, which addresses the two most likely mechanisms. SwiftShader in a container has no iOS jetsam, no thermal
  model and no WebKit compositor, so I cannot show the crash going away.
- **Real compositor layers.** The CDP layer tree was empty here.
  - At Manifesto rest, 105 word animations stay "in effect": `j-manifesto-ink-light … both`, mycelial.css:1003 over
    journey/site.css:4576. The fill is what holds each word at opacity 1.
  - If WebKit keeps a composited layer per filling animation, that is ~105 small layers for as long as the Manifesto
    is open. They are released on Return (105 → 1).
  - I did not change it. A look-neutral fix would be: on `.is-settled`, `animation: none; opacity: 1` for that
    line's words. It needs eyes on the settle timing first.
- **The one 0-draw state** in the first races run (above). Not reproduced. If the owner ever sees the page frozen
  with the menu closed, that is the thing to report.
- **The desktop +41.5 MB heap step** in the Manifesto ascent: not re-run on desktop. It does not occur on the phone
  path.
- **Frozen-still goldens** (`tools/capture.py --check`) need macOS Chrome and could not run here. F1/F2 are argued
  pixel-identical above (full-screen passes; every sample of a pixel equal). F3 does not run under `?capture`. The
  gate should still be run once on the owner's machine before release.
- **Pre-existing test failures** (identical before and after; they need macOS Chrome, git history a shallow clone
  lacks, or baked geometry): 40 of 123 tools/test-*.mjs, the `test:unit` chain (stops at the same
  test-mobile-manifesto-range assertion on base), and 7 eslint errors in untouched files. The only before/after
  difference, `test-ui-closure` A5, came from my first wiring in main.js; the wiring moved into organism.js and the
  test passes.

## Recommendations not taken (each changes something a person would see)

1. **Phone pixel-ratio cap at 1.5** (organism/performance.js `createPixelRatioPolicy`, under `(pointer: coarse)`).
   Every screen-sized buffer shrinks by 44%: about −45 MB more at rest and ~44% less fill. It is softer on a 3×
   phone. Owner's call.
2. **Hover atlas on touch devices.** The 4096×1024 hover atlas (~22 MB GPU plus a 16 MB canvas, twice during a
   remix) exists to sharpen a hovered face. On a phone it is reached only by tap-selection. Baking it at the resting
   cell size on `(hover: none)` would save ~17 MB GPU and 12 MB CPU.
3. **Warm-queue re-scan back-off**: 3 s → 6 → 12 … 60 s while nothing is missing, reset on input. It is a few ms
   every 3 s; low value.
4. **The settled-word animations** (above).

## For the owner: how to check on the iPhone

Safari Web Inspector works for any iOS browser that is WebKit-based, but it needs Safari on the phone for
inspection. Chrome iOS pages are only inspectable if Chrome's "Web Inspector" setting is on (Chrome ≥ 115:
Settings → Content Settings → Web Inspector).

1. On the iPhone: Settings → Safari → Advanced → **Web Inspector** on. Connect the phone to a Mac by cable. On the
   Mac: Safari → Settings → Advanced → "Show features for web developers". Open mycelial.works on the phone, then on
   the Mac: Develop → [iPhone] → the page.
2. **Timelines** tab. Record with **Memory** and **Layers**, plus **Screen** and **JavaScript & Events**. Click around
   for the usual minutes.
   - Memory is broken down into JavaScript / Layers / Page / Images / Other. Watch the total.
   - Before this branch, expect a high flat line. "Layers" is where GPU-backed canvas and compositing show up.
   - If "Page" or "JavaScript" climbs per navigation, that is a leak this harness could not see.
3. **Layers** tab, with the Manifesto open and fully landed: count the layers. If there are ~100 small word layers,
   apply recommendation 4.
4. **Heat and frame work:** in the Timelines **Rendering Frames** track, at rest with no touches for 10 s, frames
   should drop to about every other vsync (this branch). With the menu open they should stop.
5. If the tab still dies: Settings → Privacy & Security → Analytics & Improvements → Analytics Data. A `JetsamEvent`
   at the time of the crash confirms the memory kill and names the process (`com.apple.WebKit.WebContent` or
   `.GPU`).

## Reproduce

```
python3 serve.py                                   # :8137, live source
node tools/soak/mobile-soak.cjs --loops 8 --out soak.json
node tools/soak/mobile-soak.cjs --loops 4 --races --lose-context --out races.json
node tools/soak/mobile-soak.cjs --manifesto --loops 3 --out manifesto.json
node tools/soak/mobile-soak.cjs --probe --dsf 2 --query "nointro=1&pr=2" --out probe.json
node tools/soak/summarize.cjs soak.json races.json manifesto.json
node tools/test-mobile-stability.mjs
```

About 6–9 minutes per loop under SwiftShader, and ~4.5 minutes per Manifesto ascent. Run at most two at once.

## Commits

- `19b47b2` Renderer: one multisampled composer target and a single-sampled canvas
- `efd94ec` Portraits: a retired atlas frees its canvas backing store at once
- `efc7790` Frame loop: draw at half rate at rest on touch devices, hold under the menu
- `3371c0f` Soak harness
- `5337980` Runtime release eb5f8da4 (production snapshot; `npm run runtime:check` passes; the release-mode server
  was smoke-tested on a phone viewport, navigated with no errors and loaded `rest-cadence.js` from the snapshot)
