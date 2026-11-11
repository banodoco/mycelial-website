# O3-structure: do the 14 symptoms share structural causes?

Read-only. Source: /home/user/mycelial-website only (no runtime/, archive/, docs/ except docs/code-health, no worktrees).
Method: I read the code myself and checked the investigators' claims against it. No Agent tool was available in this
session, so there were no Haiku subagents. Every file:line below was opened and read. Counts come from grep over journey/ and organism/.
Labels: VERIFIED means read in source. JUDGEMENT means my design opinion.

## 0. Ranking (issues explained x recurrence risk / cost)

| # | Structural cause | Ledger issues | Recurrence | Cost (full / now) | Rank |
|---|---|---|---|---|---|
| B | No rest-aware GPU/CPU warm scheduler: 6 independent warmers, none knows "in flight" | P1 P2 P4 P5 | high: every new chapter or asset repeats it | M / S | 1 |
| D | DOM frame has no read/write phases; rail repaints ~30 vars every frame without a dirty check | P2 P3 P4 (part) | medium | S / S | 2 |
| A | The flight phase is published but unclaimed; arrivals run on 8+ other clocks | M1 M2 M3, P2 (slow-mo) | high: each new arrival picks its own clock | L / S | 3 |
| C | "Phone" has about 8 definitions; one band authority exists, but only one caller uses it | U3 M4 M6 (U1 part) | high | L / S | 4 |
| F | Final's retire/arrive is a latched rate integrator (13 § patches), not a function of phase | M3 | medium | M / - | 5 |
| E | Literal and source-text pins | makes M5 and U3 fixes awkward, one is unsafe | low | S / S | 6 |

Where structure is fine and the problem is just a number: M5 (a two-constant change), U1 (one CSS size), M2 (no change),
U2 (pointer-events on one phrase), and the M1 camera ease itself (one branch in `blendPhase`).

---

## B. Scattered warm-up: there is no single "what is needed next, while at rest" (rank 1)

Evidence (VERIFIED):
- There are six warmers with six triggers, and none of them reads transition or flight state:
  1. `boot/hero-gpu.js:148 prepareGpuWarmup` plus `:46-66 renderShellVariants`. This does a real draw into `composer.readBuffer`.
  2. `journey.js:2108 prepareGpu`: compile only.
  3. `journey.js:2121-2155 warmHiddenChapters`: a fixed `setTimeout(next, HERO_INTRO_MS)` (+7.6 s), then rIC with timeout 4000. It ignores `deadline` and `transition.blend`. It does compile plus `initTexture`, and **it never uploads geometry**.
  4. `cards/index.js:102-133 startCardWarming`: a 1500 ms timer, then rIC. It self-starts at import (`:146`).
  5. `chapters/owned/portrait-remix.js:225-231 schedulePrepare`: rIC with timeout 1500, plus synchronous `initTexture` (`:272-279`).
  6. The Manifesto `aerial.prepare` runs synchronously on the click frame (`chapters/final/index.js:1680`, via `manifesto/branch.js`). O1 measured it at 26-49 ms in node.
- The governor `organism/performance.js` has no flight awareness either (no `blend` or flight reads). Its DPR ratchet can fire
  mid-flight, and a ratchet reallocates every target (O2 §2).
- How the ledger issues map onto this: P5 is geometry uploaded on first draw mid-flight (warmer 3 never does geometry). P2 is warmer 3
  landing inside the first hop (26 MB of textures). P1 is warmers 4 and 5 sharing the boot window. P4 is warmer 6 placed on the click instead of at Purpose rest.
- The project already knows part of this. `docs/code-health/2026-08-20-elegance-program.md:818-838` (U01c) plans "explicit
  start/stop scheduler" for card warming (0.75-1.25 days). It is still REMAINING (`:145`).

Target design (JUDGEMENT): `journey/boot/warm-queue.js`, a single queue of `{id, kind: compile|texture|geometry|cpu, cost, needFor: chapterId}`.
- It runs one job per idle slice, and only when `isAtRest()` is true: no `transition.blend`, no manifesto flight, intro released, and `deadline.timeRemaining() > ~8 ms`.
- A flight start pauses it. Arriving at a rest reprioritises it by "adjacent destinations first". From Purpose that means the Manifesto prepare and the Connect geometry.
- The geometry job reuses the one proven mechanism: a hidden draw into `composer.readBuffer` with `frustumCulled=false`, exactly as `renderShellVariants` does.
- Card media and portrait atlases become jobs in this queue instead of owning their own timers.

Smallest step NOW, inside the perf and mperf packages:
- Put the "yield to flights" check, the hidden warm draw, and the Purpose-rest Manifesto prewarm behind ONE predicate, `isAtRest()` (defined once next to `warmHiddenChapters` from `transition.blend` plus manifesto state), and ONE loop, not three ad-hoc guards.
- Replace the +7.6 s constant with "first rest after activation".

Follow-up: fold in card warming (U01c), the portrait-atlas bakes, and governor deferral ("never step DPR while a blend is live").

Risk: low to medium. Hidden draws on software GL are already special-cased (`organism/renderer.js:36-37`). Warm draws must be skipped there too.

Proof: `browser-smoke.mjs`; promote O2's `harness/o2-lazy-gl.cjs` to a check that asserts **0 bufferData > 100 KB and 0 texStorage during any `flyTo` leg** after the first rest (counts calls, so valid on SwiftShader). Goldens are unaffected: nothing moves at rest.

## D. Per-frame DOM: write, then read, then repaint everything (rank 2)

Evidence (VERIFIED):
- `ui.js:1024-1031` runs in this order every frame:
  1. `rail.update` writes styles.
  2. `copy.step` writes opacity and transform on `.j-h`, `.j-sub` and `.j-act`.
  3. `chips.measure()` reads.
- `hotspot-frame.js:221-229` performs `getBoundingClientRect` and `getComputedStyle` per visible block, and `offsetWidth`/`offsetHeight` per hotspot. Together that is a forced style and layout recalc on every frame, at rest too.
- `rail.js` has 95 `style.setProperty` sites. `paintPurposeHandoff` (`rail.js:2357`, called unconditionally from `update` at `:2984`) writes about 30 inherited
  custom properties on the `.j-rail` root (`:2683-2731`) every frame, in every chapter, with no dirty check. The Purpose tree is invisible
  in most of them.
- On a click, 3 synchronous `applyFrame` calls run (`journey.js:1197` → `placeAt` `:1933,:1935`, then `:1509`). Each one repeats the whole DOM cycle.
- `frame/publication.js` gives the pose a single value per frame. The DOM side has no equivalent, so the frame-order discipline the project
  enforces for the camera (C4-C11 pins) does not exist for layout.
- The cache was refused on purpose (`hotspot-frame.js:215-220`): "a width taken on the first frame, before the stylesheet and the webfont have settled,
  reads short". That is a real constraint. It is solved by invalidation events, not by measuring every frame.

Target (JUDGEMENT):
- Split `ui.update` into `measure(frame)`, which reads first, from a cache invalidated by ResizeObserver, `document.fonts.ready`, visibility or text change, and the viewport, and `paint(frame)`, which writes only.
- Add one `setVar(el, name, str)` helper with a per-element last-value map. Rail, copy and manifesto would all write through it.

Smallest step NOW (perf package, about 40 lines):
- Add the dirty-checked `setVar` in rail.js (`paintPurposeHandoff`, `rowFrame`) and cache `measure()` under the invalidation set above.
- Leave the 3 click `applyFrame`s alone: `test-frame-order.mjs` and `test-transition.mjs` pin them, and they become cheap once the other two items land.

Risk: low. A dirty check cannot change a written value. The cache risk is the webfont case named in the comment, which is covered by `fonts.ready`.

Proof: `test-frame-order.mjs`, `test-hotspot-departure.mjs`, `tools/trace/rail-centre.mjs --assert`. Also a Performance-panel count of `Layout` events per idle frame, which should go from 1 to 0.

## A. Many clocks: the authority exists and nobody reads it (rank 3)

Evidence (VERIFIED):
- The single flight phase already exists. `camera-blend.js:64-82` computes `e` once and writes `railMotion.phase=e` and `railMotion.elapsed=blend.t`.
  `frame/publication.js:89-120` publishes it as `frame.transitionPhase {kind, e, fromP, targetP}`. Its own header (`:57-58`) says
  **"Nothing reads transitionPhase in production today"**. The only other mention is a comment at `journey.js:1799`.
- Time bases that drive visuals during a hop (dt = the clamped animator delta from `organism/animation.js:67`, `min(0.05, …)`):

| # | Clock | Drives | dt-clamped? | Tied to flight phase? |
|---|---|---|---|---|
| 1 | `blend.t/dur → e` (camera-blend.js:65-68) | camera, rail, wordmark, `stepHeroExit` | yes | it IS the phase |
| 2 | `railMotion.elapsed` in seconds, with constant leads (`ui/bands.js:74-80`, ARRIVE_LEAD_S 1.3, ARRIVE_S 0.8) | heading/body copy, hero furniture | yes | derived from `dur`, but its end is not pinned to landing |
| 3 | copy gate: `e` capped at `land` in flight (`copy-arrival.js:150-153,636-637`), then `dt*2.4` chase after landing | Inspire embers, chips gate | yes | flight-capped, then free-running |
| 4 | chapter entry clock `chapterEntry.t` (`frame-application.js:8-18`), which starts when the chapter's own camera predicate `entryReady()` holds | Connect 3.2 s (`connect/index.js:546,1464`), Equip 2.2 s (`equip/index.js:360-366`) | yes | no: starts on a camera-shape test, so its end time is emergent |
| 5 | `performance.now()` beats (`ui.js:1037` → `hotspot-frame.js:370-381`, 540/700 ms) | hotspot chips | **no** | no |
| 6 | `performance.now()` rings (`equip/index.js:222`) | Equip welcome/pulse rings, labels | **no** | no |
| 7 | Final rate integrator `blendRate·retireScale·dt` (`final/index.js:1010`, latched state `:810-966`) | Purpose field retire/arrive, intro relight (M3) | yes | indirectly, through `durS` |
| 8 | seam dwell hysteresis `performance.now()` (`seams.js:86`) | arming/retiring groups | **no** | no |
| 9 | Manifesto `elapsed`, a **local de-clamp** to wall time (`manifesto/branch.js:841-856`) | ascent, sentence beats | partially | its own flight |
| 10 | CSS: 81 `transition:` and 35 `animation:` in `journey/site.css`, plus `Date.now()+720` rail follow gate (`rail.js:1236,2917`) | words ink (3 s), rail, chips | **no** | no |

  Count per hop: Intro→Inspire uses 1, 2, 3, 5, 8, 10, plus hero-spores' own `performance.now` fade (21 reads in `organism/hero-spores.js`). Equip→Connect uses 1, 2, 4, 5, 6, 8, 10. Connect→Purpose uses 1, 2, 7, 8, 10 and the rail 720 ms gate.
  So each hop has 6-7 independent time bases. Under a frame drop the dt-clamped ones slow down while 5, 6, 8 and 10 keep wall time, so content
  races ahead of the camera (S1 §3.5).
- The dt clamp already bit once. `branch.js:841-850` documents "the 28 s climb ran over 34 s" and patched only the Manifesto. The clamp
  policy is therefore decided per consumer.
- Decoupling is the stated design, not an accident. `chapter-entry.js:1-7`: "destination-owned intro choreography can continue after the
  camera arrives." M1 and M2 are that policy working as written. Nothing states or tests *how long after*, so every arrival's tail
  relative to landing is emergent: about 1.1 s for Inspire chips and about 1.5 s for Connect (S1).

Target (JUDGEMENT):
- Make `frame.transitionPhase` the clock. Add `{t, dur, remaining, sinceLanding}`. `sinceLanding` accrues frame dt after `endCamBlend`, so post-landing tails are on the same clock too.
- Give arrivals a declarative `arrivalWindow({from: 0.66, to: 1.0, tail: 0})` helper in `ui/bands.js`. Each arrival then states its window as a share of the flight, plus an allowed tail in seconds.
- Under this design:
  - `entryReady()` predicates become `from` thresholds.
  - Wall-clock beats (5, 6) take `frame.dt`-accumulated seconds.
  - The Final integrator (7) becomes a pure `f(e, direction)` (see F).
- The dt clamp stays as the single policy. If anything should keep wall time, that should be decided once in `animation.js`, by exposing `wallDt` next to `dt`, not in branch.js.

Smallest step NOW (motion package, M1):
- Express the Inspire changes as phase windows on the clock that already exists. Arrival ends at `dur` (`ARRIVE_LEAD_S = ARRIVE_S`, `bands.js:79`), and use the dedicated `flightLead` row S1 proposed.
- Pass the hotspot `now` as accumulated `frame.dt` seconds rather than `performance.now()` (`ui.js:1037`). This is a one-argument change and removes the one wall clock on the M1 path.
- Add ONE oracle assertion: on a virtual clock, every arrival envelope on every ordinary hop finishes within X s of landing. X is whatever the owner accepts: about 0.2 s for Inspire, and the current value for Connect.

Follow-up: migrate Equip rings, the Connect `entryReady`, seam dwell and Final 7 onto `transitionPhase` (about 2-4 days). Each of those has
dedicated pins: `test-connect-arrival`, `test-connect-motion`, `test-connect-hivemind-welcome`, `test-equip-arrival`, `test-epilogue-retire`, and the elegance-program
§559-565 "level-gate/fixed-clock mismatch" brief.

Risk: medium. The tests pin seconds, so moving to phase changes shipped timings by design. Under rule 8 (CONTRIBUTING.md:67-71) each migration
needs its pins converted *before* its behaviour change.

Proof: `test-frame-publication.mjs` (C8-C11 already pin a single seq per frame), `tempo-oracle`/`tempo-run` (TL3), `test-nav-entry-continuity.mjs`.

## C. Device-branch divergence: about 8 definitions of "phone" (rank 4)

Evidence (VERIFIED, JS):
- **One authority exists and is barely used.** `layout/rail-geometry.js:197-216 bandOf(w,h)` was written after DEFECT-01 precisely to stop
  forks. `rail-geometry.js` is the only importer of it in journey/.
- `frame.aspectProfile: null` (`publication.js:172-175`) is the reserved, unbuilt "responsive layout authority".
- Inline re-derivations of `innerWidth <= 620 && h > w`, 10 sites:
  - `connect/index.js:739`
  - `final/index.js:1192,1577,1681`
  - `final/clones.js:735`
  - `inspire/index.js:1389`
  - `portrait.js:613,652,669`
  - `inspire/index.js:1614` uses a **900** threshold instead.
- Separate media-query thresholds: `rail.js:558` (620 portrait), `rail.js:565 mobileRail` (`coarse, max-width 900`), `ui.js:62` sheet (`coarse, 720`).
- The Manifesto alone has three predicates:
  - `isMobileManifesto`: aspect < 0.9 OR w ≤ 720 (`pose.js:88`)
  - `w <= 720`: `fit.js:9`, `branch.js:570-571,632,638`
  - `aspect < 0.9`: `colony.js:679`, `pose.js:420`
- Concrete inconsistency: an 820x1180 portrait tablet gets the phone Manifesto camera (aspect .69) but the desktop font-fit and no scroll reading (w > 720).
  Its rail is "mobile" (≤ 900), but `bandOf` says not-phone.
- CSS: `journey/site.css` alone uses 10 distinct media-query shapes for the same bands (620-portrait, 720, 900, coarse/900, coarse/720,
  621-900-portrait…). `hero.css` and `mycelial.css` add more (600, 1024, 1366/coarse, max-height 560/700).

How this maps onto the ledger:
- **U3**: the intro rail rest is a CSS-only lift (`--nav-hero-lift`, site.css:3644, in `:root` for every band), while the chapter rest is JS
  (`rail-geometry.js:108`, `centreFromBottom: 70`) mirrored by hand in CSS (`site.css:3665`). Two owners for one position.
- **M4/M6**: the Manifesto descent fix was made in the phone branch only (`pose.js:132-139`), and desktop was pinned to the old inverse
  (`test-manifesto-return.mjs:28-38`).
- **U1**: thesis size is set separately per breakpoint (`site.css:682` vs `:913`).

Target (JUDGEMENT): `journey/layout/band.js` (extend `bandOf`) as the one predicate source.
- Publish it as `frame.aspectProfile`.
- Mirror it to CSS as `data-band` on `<html>`, set by the same function, so CSS selects on `[data-band=phone]` instead of restating widths.
- Behaviour forks should be parameters on one law, not branches. The Manifesto pose is the model case.

Smallest step NOW (pose package, M4):
- Implement "blend height with time" by making desktop call the SAME descent law the phone uses, parameterised by band constants. Do not add a third branch.
- Retarget the desktop pin in `test-manifesto-return.mjs:28-38` as a conversion: pin the purpose (max lateral speed ≤ k × baseline, no end re-acceleration), not the old curve.

Smallest step NOW (ui package, U3): `--nav-hero-lift: 0px` in the phone block is an acceptable point fix; note in the commit that the rest position still has two owners.

Follow-up: adopt `bandOf` in the 10 inline sites (mechanical, about 0.5 day) and build `data-band` plus the CSS migration (about 2 days, capture risk).

Risk: low for the adoption, because the predicates are identical where they say 620. Medium for unifying 720/900/aspect, which changes tablets on purpose.

Proof: `tools/trace/mobile/gate.mjs` (rail-centre parity), `test-rail-handoff.mjs`, `test-mobile-manifesto-range.mjs`, and the 430x932 goldens via capture-diff on the owner's machine.

## F. File-scale coupling: mostly just size, with two real tangles (rank 5)

- **Final's light state machine** (`chapters/final/index.js`): 97 `retir*` mentions, 13 distinct `§` patch markers, and 9 latched flags
  (`bedSpread`, `spreadSpan`, `retiring`, `retireScale`, `lapArrive`, `lapHoldS`, `arriveEff`, `spreadTail`, `wasBlending`; `:810-966`).
  The comments cite earlier regressions caused by latched state (`ba09f49`, `a0a89f8`, "the epilogue race"). M3, the intro web relighting
  3.6x in 0.8 s mid-lap, comes from this integrator. Its output is the history of the lap, not a function of where the lap is.
  - Target: make `retire(e, direction, durS)` pure, with `sinceLanding` from A for tails. That is a follow-up.
  - NOW: the wrap package's "relight over the last ~40% of the lap, finishing at landing" should be written as a phase window on `e` (the A helper), not as one more latched flag.
  - Proof: `test-epilogue-retire.mjs`, S2's filmstrip harness.
- **rail.js** (3.1k lines): the row, the Purpose tree, labels, menu and cue timers share one `update()`. The real cost is D: the Purpose tree paints in
  every chapter. The rail rest position is split JS/CSS (C). Splitting the file is not needed for this pass.
- **journey.js, organism.js, hero-spores.js**: no symptom traces to their size. `warmHiddenChapters` living in journey.js is fine (its problem is B).
  - hero-spores is a separate clock domain (21 `performance.now` reads), relevant only to the intro fade.
  - organism.js is implicated only through TAA running at ~0 weight (P3) and the flight-blind governor, both B/A-shaped.
- What the project knows about itself:
  - `docs/code-health/2026-08-20-structural-refactor-program.md` WS-08/09/11 plans decomposition of ui.js, organism.js and journey.js. They are framed as size and ownership work, not around clocks, warm-up or bands.
  - `.desloppify/plan.json` holds only auto clusters (`auto/unused`, `auto/test_coverage-*`, `auto/initial-review`) from one 2026-08-20 scan (455 open, "Abstraction fit"/"Design coherence" unscored). It says nothing about these issues.

## E. Duplicated constants: mostly deliberate; one unsafe pattern (rank 6)

- Literal pins such as `test-no-scroll-navigation.mjs:246-251` (speed table) and `test-manifesto-motion.mjs:90` (`1.6 + .14*words`) are
  **deliberate independent declarations** (CONTRIBUTING.md:60-75). Importing the constant would make the test tautological. Structure is fine here.
- The catch: M5 must edit `:90` in the same commit, which CONTRIBUTING calls a "conversion order". Do it as one: pin the purpose (visible
  dead gap in [0.8, 1.3] s, the shortest sentence hands on sooner), not the formula.
- **Unsafe pattern:** 24 of 63 `tools/test-*.mjs` read source text.
  - `test-mobile-landing-anchor.mjs:18` string-replaces `calc(13.5vh - var(--nav-centre-bottom))` in served CSS. The U3 fix makes that a **silent no-op**, so the test would pass against an unpatched layout.
  - `test-rail-handoff.mjs:491,552` regex-match source.
  - NOW: the ui package must update `:18` and make the replace assert that it matched (one line: throw if `body === replaced`).
  - Follow-up: a repo-wide `replaceOrThrow` helper for route-patching tests.
- Seconds-not-derived: `bands.js:74-80` mixes seconds constants with `dur`. That is why stretching M1 to 3.3 s moves the copy's
  phase relation on every hop (S1 Fix 2 risk). A's `arrivalWindow` removes this class.

## Verdict

Yes, a few structural patterns sit under most of these symptoms. They are not flaws in the core design: the codebase already contains the right seams, and they are unfinished. The four stutters (P1, P2, P4, P5) come from one gap: six separate warm-up routines, none of which knows whether the camera is resting or flying, and some skip geometry entirely. The timing complaints (M1, M2, M3) come from a second gap: the flight phase is computed once and published (`frame.transitionPhase`), but no arrival effect reads it, so arrivals run on six or seven other clocks and how long content lingers after landing is accidental, not designed. The phone layout issues (U3, M4, M6) come from about eight definitions of "phone", even though `bandOf` was written to be the single one and almost nothing uses it. None of this needs a rewrite before the polish ships. Within this pass, make each fix the right-shaped way: one rest check and one warm loop; a dirty-checked style writer and cached layout reads; arrival timing as fractions of the flight; desktop reusing the phone's descent rule instead of a third branch. Each costs about the same as a point fix. The larger moves (every chapter on the flight clock, Final's lighting as a pure function of phase, one band authority shared by JS and CSS) deserve their own follow-up, with tests converted first. M5, U1, U2 and M2 really are just numbers.
