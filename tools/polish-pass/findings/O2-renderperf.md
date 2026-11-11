# O2-renderperf: frame-loop and transition hitch audit (P1, P2, P5)

Harness: SCRATCH/harness/o2-lazy-gl.cjs. It wraps WebGL bufferData/bufferSubData/texImage2D/texStorage2D/
texSubImage2D/generateMipmap/compileShader/linkProgram/renderbufferStorageMultisample, records the phase
(boot / settle / each `journey.flyTo` leg / its rest) and a JS stack for any upload over 100 KB, plus
PerformanceObserver longtasks. Raw data: SCRATCH/captures/O2-renderperf/lazy-gl-desktop.json (800x500,
`?nointro=1`, real clock, SwiftShader), desktop.txt, mobile.txt.
SwiftShader timings are meaningless (and SwiftShader has no KHR_parallel_shader_compile). Only the
**call counts, byte counts, call sites and same-frame clustering** count as evidence. The page ran on the
real clock; I did not use the fake clock, because I count events and do not time trajectories.

## 1. TL;DR
- **P5 root cause (VERIFIED):** the Final ("Purpose") chapter's baked geometry is created on the GPU the
  first time it is drawn, which is **mid-flight on Connect->Purpose**. 318 bufferData calls, **4.55 MB**,
  ~4.2 MB of it inside one 50 ms bucket, called from three's `projectObject` (first render). It sits on
  the leg's largest long task. The warm-up compiles programs and uploads textures but **never uploads
  geometry** (journey.js:2121-2155, hero-gpu.js:23-34). Connect has the same bug at smaller size: 0.32 MB
  on its first approach.
- **Shaders are not the problem (VERIFIED):** 0 compileShader/linkProgram calls on any leg. All 68 programs
  link at boot. The patched `compile()` uses `scene.traverse`, not `traverseVisible`
  (vendor/three/three.module.js:29713), so hidden chapters are covered.
- **P2 (Inspire<->Equip) has no GL first-sight work (VERIFIED):** 0 bufferData, 0 texture, 0 link, and
  the same ~78 KB/frame of dynamic uploads as at rest. The prime GL-side suspect is the **idle-time warm
  pass** landing inside a flight. In the run, its 13 texture uploads (**26.4 MB texStorage + 13
  generateMipmap**, journey.js:2145) fired during the very first leg. That pass starts 7.6 s after
  activation, so it only hits the first navigation or two. That fits "sometimes". The rest of P2 is CPU/DOM:
  there is a forced synchronous layout every frame, and the click frame runs `applyFrame` three times.
- **P1 (inconsistent load stutter) is a race in the boot schedule (VERIFIED from code):** if the journey is
  not ready within 1.5 s of the hero shaders (handoff.js:390,418-421), the growth starts anyway. All
  chapter builds (code comments put them at up to ~565 ms each), `boot()` and its compile pass then run
  **after the growth, on the settled hero** (handoff.js:541-556). Cold cache or a slow link takes that
  path; a warm cache does not. The same window carries more main-thread work: the ~6 MB card-media
  prefetch competing for bandwidth, the portrait photo-atlas bakes, and a first-visit DPR calibration
  step.
- **Biggest wins:** (1) a hidden "warm draw" that uploads each chapter's geometry at boot or at rest,
  (2) warm slices that check `timeRemaining()` and skip while a flight is running, (3) defer and slice the
  photo-atlas and hover-atlas bakes and uploads, (4) defer card-media warming until after
  `journey-interactive`. Nothing here needs a visual downgrade.

## 2. How the relevant code works
**Frame loop.** organism/animation.js:60-113 runs one rAF. `dt` is clamped to 0.05 (:67). Animators run in
Map order: the spine `journey` first, then hero animators, chapter animators (`spike-plumes`,
`journey-connect`, `journey-owned`, `journey-final`), lens, `rail`, perf-governor. Then `composer.render()`
(organism.js:2127-2131).

**Passes per frame** (organism.js:206-326, lens.js:318-326):
1. RenderPass into a 4x MSAA RGBA16F target at drawing-buffer size.
2. UnrealBloom at **CSS** size (organism.js:215-219), a mip chain of about 12 small draws.
3. TemporalAccumulatePass: a 10-tap blend plus a copy into a RGBA16F history at buffer size (:228-318).
4. Grade ShaderPass: ~10 taps (aberration and halation) (lens.js:108-191).
5. OutputPass (ACES plus sRGB).

That is 4 full-resolution passes after the MSAA resolve. At 1440x900 with DPR 2 (5.2 MP), the MSAA colour
target alone is about 166 MB (measured at 800x500: 4 renderbufferStorageMultisample calls = 51 MB).
- *Hypothesis:* on an integrated GPU this steady cost sits close to budget, so any extra main-thread or
  GPU work tips a frame over.

**DPR policy.** performance.js:66-88: `initial = min(devicePixelRatio, 2)` on every device class. There is
no phone tier and no quality tier: `setTier` exists only in a comment (lens.js:54). The pixel ratio is
calibrated once per display key, which includes `devicePixelRatio`, so browser zoom or a second monitor
creates a new key (:69-70). The calibration measures during the intro (:194-258) and applies the whole drop
at once through `viewport.sync`. That sync reallocates rt1, rt2 and the TAA history, resizes bloom, and
flushes TAA (renderer.js:414-416, organism.js:2311-2318). After that, a two-strike catastrophic ratchet
(:260-281) can step the ratio at **any** moment, mid-flight included, when more than half the frames
are clamped for 2x2.5 s.

**What is drawn per chapter.** Chapter groups start hidden. Each chapter's animator sets `group.visible`
every frame and returns early when hidden, so CPU cost is small:
- Final: index.js:1364
- Owned: owned/index.js:618
- Connect: connect/index.js:1087
- Inspire: inspire/index.js:1627

Arming comes from seams.js:46-90, which reads `frame.routeP`. A nav jump snaps `p` to the destination on
the click frame. So on Connect->Purpose, **Final and Owned are armed from frame 0**. Final becomes
*visible* once its rise/eff passes 0.003 mid-flight; that is the first draw. Hero spores (4200 points)
upload positions every frame in every chapter: 50400+16800+10908 B/frame (VERIFIED; identical at rest and
in travel).

**Boot.**
- main.js:53-85: dynamic imports of organism, lens, baked and journey.
- baked.js fetches 6.26 MB of .bin files: final 3.56 MB, owned 2.31 MB, connect 0.32 MB, inspire 0.08 MB.
- The first `render` in createScene uploads 4.79 MB of hero geometry synchronously (VERIFIED stack:
  organism.js:2131 <- animation.js:134 <- organism.js:2301).
- handoff.js:499-556 (loadJourney): prepareHeroGpu, then prepareRail, then `await bakedGeomReady`, then
  `growthSettled`, then one `prepareChapter` per rAF+task, then `boot()`. The intro release is gated by
  `beginNormalIntro` (:385-450).
- journey.js:2108-2156: the `prepareGpu` compile pass at boot. `warmHiddenChapters()` starts at
  `activate()` + `setTimeout(HERO_INTRO_MS = 7600)` and runs one chapter group per `requestIdleCallback`
  (timeout 4000). In each slice it calls `compileForFrame(group)` and `initTexture` on every texture.
  **It never touches geometry**, and it ignores `deadline` and flight state.

## 3. Findings

### P5: Connect -> Purpose (mobile)
**H5.1. Final's geometry is uploaded at first sight, mid-flight. VERIFIED.**
- Evidence: in the `4:connect->final` phase there are 318 bufferData calls, 4.55 MB. Large buffers
  (509 KB x2, 170 KB x7, 125 KB...) are all created in one frame (t=601.65 s), stack `createBuffer <-
  attributes.update <- objects.update <- projectObject` (a first render).
- That frame starts the leg's largest long task (4677 ms on SwiftShader; real cost will be much lower,
  but it is a single-frame burst).
- Baked Final is 3.56 MB plus runtime buffers. On a phone or an integrated GPU, a few MB of bufferData in
  one frame means CPU copy, GPU-process copy and a possible driver sync. *Hypothesis:* 10-60 ms; the
  harness should measure it on hardware.
- Fix A, best: upload geometry during warm-up with a hidden warm draw. In `warmHiddenChapters`
  (journey.js:2132-2151), after `compileForFrame`, bind `composer.readBuffer` with a 1x1
  scissor/viewport. Set `frustumCulled=false` on the subtree (restore it afterwards) and call
  `renderer.render(group, camera)` once. This links the real per-object variants and uploads every
  attribute and index. The same pattern is already proven in hero-gpu.js:46-66. Run it while the camera
  is at rest, never mid-flight. Better still, also run it in `prepareGpu` at boot (journey.js:2108), while
  the prelude is still in its worker.
  - Risk: low. A 1x1 scissor changes no pixels; TAA history is untouched because the composer does not
    run.
  - Gates: tools/test-gpu-preparation*.mjs and test-startup-recovery.mjs (they fake `warmHiddenChapters`
    and the renderer). Goldens should be unaffected.
- Fix B, cheaper: three's public `renderer.initRenderTarget` does not cover geometry, so there is no
  public upload API. The warm draw is the idiomatic way.
- Verify: after the fix the harness should show bufferData approx 0 in every `X->Y` phase, with the bytes
  moved to boot or rest.

**H5.2. Owned's photo atlases are baked on the CPU and uploaded at arbitrary times. VERIFIED (code) plus
partly measured.**
- `photosReady` (portrait-remix.js:176-191) bakes when the 390 KB sprite arrives: a 2048x512 photo atlas
  and a **4096x1024 hover atlas** with anisotropy 8, mipmaps, and a CPU-backed canvas (portrait-atlas.js:18).
  It does this synchronously on the main thread, using `drawImage` from an `<img>` with no
  `decode()`/`createImageBitmap`.
- The hover atlas is commented "keep lazy" (:273-280), but it is uploaded eagerly by the warm pass:
  journey.js:2145 iterates every uniform texture, `uMapH` included. Measured: 13 uploads, 26.4 MB, in one
  warm sequence.
- `prepareRemix` (:269) has **no caller** (grep), so the first Remix click bakes three atlases
  synchronously (:301-307) mid-animation.
- Fix:
  - bake through `createImageBitmap` plus an OffscreenCanvas worker, or at least `await img.decode()` and
    one atlas per idle slice;
  - leave `uMapH` out of the warm pass until first hover, or bake it at Owned rest;
  - call `prepareRemix` at Owned rest.
- Gates: tools/test-portrait-* and the Owned goldens (the bust path is untouched).

**H5.3. Purpose rail tree: ~30 custom-property writes and ~10 class toggles on the rail ROOT every frame.
VERIFIED (code), cost HYPOTHESIS.**
- rail.js:2666-2735 writes inherited custom properties on the root, so every value change restyles the
  whole rail subtree. These include `--nav-scrim-extra/height` (width/height of a scrim:
  site.css:3770-3771, which causes layout and paint) and an animated `filter: blur(var(--purpose-tree-blur))`
  (site.css:4063).
- They animate exactly during Connect->Purpose. The hotspot `measure()` (below) then forces that layout
  synchronously on the main thread. This weighs most on phone CPUs.
- Fix: cache the last string and write only on change, and set the vars on the purpose subtree element
  instead of the root. Risk: low. Gates: rail tests (tools/test-rail-*), purpose captures.

**H5.4. Phone specifics. VERIFIED.**
- There is no mobile geometry or quality tier. The only phone cuts are `omitOnPhone` for one clone
  (final/ring.js:445, clones.js:734) and the Connect light profile (connect/phone-light.js, which only
  changes uniforms).
- Phones run the full pipeline at DPR 2. They are the device most likely to trip the post-settle
  catastrophic ratchet (performance.js:273-278) during the heavy Final flyby. That step reallocates every
  target and flushes TAA mid-flight. *Hypothesis.*
- Fix: defer any ratchet step until `!transition.blend` (pass a predicate into
  `createAdaptiveResolution`, as `bootSettled` already is). Risk: low.

### P2: Inspire <-> Equip
**Measured:** Inspire->Equip and Equip->Inspire have zero first-sight GL work. Equip owns no geometry (equip/index.js
adds markers only). Uploads per frame equal those at rest.

**H2.1. The idle warm pass collides with flights. VERIFIED.**
- In the run, the first warm sequence (26.4 MB of texture plus mip generation, plus a full `compile()` of
  a chapter group) executed inside `0:mission->inspire`.
- `requestIdleCallback` fires in the idle gaps between rAF frames during a flight, and the slice ignores
  `deadline.timeRemaining()` and `transition` (journey.js:2124-2152). The window runs from activation
  +7.6 s until five idle slices have run.
- The fix list is in §5.

**H2.2. Click-frame burst. VERIFIED (code).**
- `placeAt(p, {snap:false})` runs `applyFrame` twice plus `seams.update` before the regular rAF frame does
  it a third time (journey.js:1924-1935). The departure also arms copy entries, rail recentre (a forced
  `offsetWidth`, rail.js:1943) and per-chapter `setBlending`.
- *Hypothesis:* 3-8 ms extra on a weak CPU, which is enough to drop the first frame of every hop.
- Fix: in placeAt-for-jump, keep only one `applyFrame(dt=0)` after seams. The frame-order gates
  (tools/test-frame-order.mjs, test-frame-publication.mjs) pin this, so medium risk.

**H2.3. A forced synchronous layout every frame. VERIFIED (code).**
- `ui.update` writes in `rail.update` and `copy.step` (ui.js:1025-1029), then `chips.measure()`
  (ui.js:1031 -> hotspot-frame.js:221-229) reads `getBoundingClientRect` + `getComputedStyle` on visible
  copy blocks and **`offsetWidth/offsetHeight` on every hotspot (~29, all chapters)**.
- `place()` then writes about 13 properties per icon-tab chip per frame (hotspot-frame.js:575-583,
  772-779), including `setAttribute('aria-hidden')` and tabIndex on hidden chips.
- During a hop the copy and chip styles change every frame, so the forced recalc and layout is real work
  each frame.
- Fix: cache `pillW/H` behind a ResizeObserver or the `fonts.loadingdone` event (the reason given for
  per-frame measurement, :215-220). Skip writes for chips whose `h.a` and position are unchanged.
- Risk: low to medium. Gates: hotspot/rail tests and goldens at dt=0.

**H2.4. Fill-rate spike near the cap. HYPOTHESIS.**
- The Equip fly-around passes close to the cap. Spore point sprites grow to 2.35x as fake depth of field
  (cap-occlusion.js:104-108) and are additive over a 4x MSAA RGBA16F Retina target.
- A few near-lens frames can be GPU-bound even with no JS work. It needs a GPU timer
  (EXT_disjoint_timer_query) from H2's harness.

**GC. HYPOTHESIS, low.** The hot path is mostly allocation-free:
- lens.js:362 and the chapter animators use scratch vectors;
- the frame publication freezes 3 small objects per frame (frame/publication.js:16-60);
- the hotspots allocate `w.clone()` and template strings per chip (hotspot-frame.js:200-209, 282, 575-583).

That totals tens of KB per frame, so only minor scavenges. There is no evidence of major GC.

### P1: stutter on load (inconsistent)
**H1.1. Boot schedule race. VERIFIED (code).**
- `prepared = readyState !== null || heroReadyAt + 1500 ms passed || 10 s` (handoff.js:418-421). On a fast
  or warm load, every chapter build and `boot()` finishes while the prelude still owns the screen.
- On a cold or slow load (6.26 MB baked, 390 KB sprite, a ~3 MB module graph), the growth starts first.
  `loadJourney` then parks at `growthSettled()` (:487-497) and runs 5 chapter builds plus `boot()`
  (`journey.prepareGpu` compile, `createUI` DOM build, two `placeAt` passes) **right after the growth
  completes**, on the settled hero, one per rAF.
- The costs come from code comments: chapters up to ~565 ms (hero-spores.js:2091), and the "0.35 s
  freeze / 1.6 s cold" note (journey.js:288-293).
- A visitor who clicks during the growth flushes the same work into the departure flight
  (`wantsFastEntry` resolves growthSettled).
- Fix:
  - slice the chapter builds further (Final and Owned in sub-steps), or move baked decoding and the CPU
    passes to a worker;
  - for each slice, wait for `requestIdleCallback` with a deadline check rather than rAF+setTimeout(0);
  - on the slow path, prefer holding the prelude a little longer over building on the settled hero.
  - Risk: medium, because the handoff tests pin this order.

**H1.2. Bandwidth contention. VERIFIED (code).**
- cards/index.js:136-147 self-starts `fetch` of about 13 images plus **7 mp4s (5.2 MB)** 1.5 s after the
  journey module graph evaluates. That graph is imported at main.js:85, at page start. One fetch is issued
  per idle slice, so all of them are in flight within a few frames.
- They compete with `static/geom/*.bin` and the module graph, so this is what moves a cold load onto the
  late-build path.
- Fix: start warming at `performance.mark('journey-interactive')` and use `fetch(url, {priority:'low'})`.
- Note: tools/test-card-warming.mjs Part C compares the 1500 ms delay byte-for-byte against a pinned SHA,
  and must be re-pinned.

**H1.3. Photo-atlas bake on sprite arrival (H5.2).** It lands about one RTT after the Owned build, which is
on the settled hero on the slow path. *Hypothesis:* tens of ms, because of the 4096x1024 Canvas2D draw.

**H1.4. First-visit DPR calibration step.** This happens once per display key (performance.js:244-257):
target reallocation plus a TAA flush. It is "masked" in the intro, but it only happens on a first visit,
after a zoom change or on a new monitor, which fits "inconsistent". *Hypothesis* that it is noticeable.
Fix: apply the step while the scene is held (before intro release) or accept it as is.

**H1.5. Fonts. VERIFIED (code), minor.**
- Cormorant is loaded as ~290 KB TTF with `font-display: swap` and no preload; only dm-sans-regular is
  preloaded (index.html:55, mycelial.css:2-34). The swap reflows the copy.
- `document.fonts` `loadingdone` also re-runs `fitPurposeCopy(true)`, a forced layout (ui.js:272).
  `fitPurposeCopy`'s key includes `document.fonts.status`, so the card-font warming toggles it again.
- Fix: woff2 plus a preload of the headline face.

**H1.6. Resize path. VERIFIED (code).** `viewport.resize` is undebounced and reallocates every render
target on each resize event (organism.js:2322). On mobile, a toolbar or visualViewport change can cause a
reallocation hitch. Fix: debounce it, and skip the reallocation when the drawing-buffer size is unchanged.

## 4. Ranked fix list (expected hitch reduction per unit of risk)
1. **Geometry warm draw** (H5.1). Change journey.js:2121-2155, plus optionally `prepareGpu` :2108. This
   removes the 4.5 MB mid-flight upload on Connect->Purpose and 0.3 MB on ->Connect. Verify: harness
   bufferData=0 in `X->Y` phases. Low risk.
2. **Make warm slices polite** (H2.1). Change journey.js:2124-2152:
   - honour `deadline.timeRemaining()`;
   - re-queue while `transition.blend || transition.cameraStateDisagree`;
   - one texture per slice;
   - start at activation rather than activation + 7.6 s, because the earlier the work runs the less often a
     hop overlaps it.

   Verify: no texStorage2D, compile or bufferData inside `X->Y` phases. Low risk.
3. **Portrait atlases** (H5.2). Change portrait-remix.js:176-191, 269-280, 301-307, and drop `uMapH` from
   the warm list. Use decode()/createImageBitmap, defer the hover atlas, and call prepareRemix at Owned
   rest. Low to medium risk; the Owned goldens use the bust path.
4. **Defer card-media warming** (H1.2). Change cards/index.js:136-147 and re-pin test-card-warming.mjs.
   Low risk.
5. **Rail purpose vars written only on change and scoped** (H5.3). Change rail.js:2666-2735. Low risk.
6. **Cache hotspot pill sizes, skip unchanged writes** (H2.3). Change hotspot-frame.js:221-229, 772-779.
   Low to medium risk.
7. **Ratchet steps only at rest; debounce resize reallocation** (H5.4, H1.6). Change
   performance.js:273-278 and organism.js:2322. Low risk.
8. **Boot schedule: finer chapter slices or worker decode** (H1.1). handoff.js:540-556 and the chapter
   builders. Medium risk; startup-recovery and handoff tests apply.
9. **Single applyFrame on the jump click** (H2.2). journey.js:1924-1935. Medium risk; frame-order gates
   apply.

## 5. Open questions / not determined
- Real millisecond costs on the owner's hardware. Each H above names what the H2-perf harness should time
  per frame: bufferData bytes per frame, texStorage per frame, forced-layout time, and GPU time.
- MOBILE CONFIRMED (390x844 isMobile, DSF 1, mobile.txt): `1:connect->final` = **328 bufferData, 4.10 MB** first-sight upload (same bug as desktop); 0 links; and the warm pass's 13 texture uploads (26.4 MB) again landed inside the first hop (`0:mission->connect`). Not determined: the phone-DSF-2 GPU cost.
  same Final upload.
- The intro path (no `?nointro`) was not measured. The code shows the same lazy geometry upload, because
  neither warm-up draws chapters.
- Owned's 2.3 MB baked geometry: I did not confirm when it first uploads. It does not upload on
  Connect->Final in this run (Owned stays invisible above ground: owned/index.js:534-548), so it would
  hit at Owned first approach. The same fix 1 applies.
- I did not quantify the GPU fill-rate spike near the cap (H2.4); it needs timer queries.
