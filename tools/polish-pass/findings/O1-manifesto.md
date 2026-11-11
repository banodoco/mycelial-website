# O1-manifesto — Manifesto sequence: model, M4 / M5 / M6 / P3 / P4

Method: deep code read plus pure-function simulation in node of the shipped pose/descent/schedule code
(scripts in SCRATCH/harness/o1-*.mjs, all import the live repo modules, nothing copied). One Playwright
probe for renderer.info was attempted (SCRATCH/harness/o1/probe.cjs). Software GL is too slow at 1440x900
(over 10 min for under 5 s of page time), so I have no in-browser GPU numbers. H2-perf owns those.
Rest poses used: desktop Purpose rest from journey/chapters/final/camera.js:56 (pos -14.72,2.73,2.70;
tgt -3.06,0.83,-1.94; fov 45.5). Phone Purpose rest is the fixture in tools/test-manifesto-return.mjs:3-4
(pos -15.49,5.25,3.49; fov 53.5; roll -5°; fieldCenter .25,-1.82).

## 1. TL;DR
- **M4 (VERIFIED, sim)**: the desktop Return is a height-inverted replay of the climb (pose.js:129-148, `descentU`).
  The desktop climb puts its lateral frame shift (frameShiftAt "middle", pose.js:98-100, 8 units over climb-seconds
  8.5→13.5) in a window where height barely changes. The height-keyed descent therefore crosses those 5 climb-seconds
  in about 0.2 s of wall time, which gives a sideways whip of **126 u/s against a ~58 u/s baseline at t≈1.9-2.05 s of the 4.8 s
  return**. It only happens when starting from u>0.36, so it is worst **from the very end/top**, as the owner described. There is also a
  second re-acceleration plus a 51°/s pitch swing in the last second, because the 8-unit "lift" (pose.js:210,220) is not part of the
  inverted height. Mobile got exactly this fix (pose.js:132-139). Desktop was deliberately left on the old inverse, and
  tools/test-manifesto-return.mjs:28-38 pins that.
- **M6 (VERIFIED, sim)**: on a phone the first 5 s are a tilt-to-overhead that **moves the camera TOWARD the cluster**.
  The hero's on-screen scale goes 52→71 px/u (+36 %, a zoom IN) at 2.5 s and is back to 53 px/u at 5 s, so the net pull-back
  is zero. After 5 s, heading is frozen and the climb runs on `smoother(s/37.58)`. Measured screen motion is 2-7 px/s, which reads as static.
  The first 0.5 s is also almost frozen (quintic ease, 8-30 px/s). On desktop the motion stays at 40-115 px/s from 0.5 s onward, with a 100° orbit.
- **M5 (VERIFIED)**: the pause is `LINE_BREATH_SECONDS 1.6 + LINE_SECONDS_PER_WORD 0.14 × words(prev)` (pose.js:52-53).
  The visible dead gap (last word readable → next sentence's first word) is currently **1.81 / 2.37 / 2.34 / 1.89 s**.
  Setting **1.2 and 0.125 halves every gap (0.86 / 1.19 / 1.17 / 0.95 s)** and shortens the flight from 37.58 s to 33.34 s.
- **P4 (VERIFIED code path; magnitude measured in node only)**: the click frame runs `aerial.prepare()` synchronously
  (branch.js:678 → final/index.js:1680 → colony.js:640-680). That is planAerialReveals plus nearBodies (two 560-body × ~150-pose
  projections), which took **26-49 ms cold / 10 ms warm in node on this server**, and phones are several times slower. The same frame also runs the desktop
  font-fit binary search (fit.js:34-39, up to 12 forced layouts) and a whole-document class change. Then come first-sight GPU uploads of every
  colony buffer (ground 50,400 verts × 16 floats ≈ 3.2 MB, spores 5,940 pts, per-layer indices, plus the 0.8 MB link table re-uploaded on every
  open). All of this is deterministic from the Purpose rest pose and can be pre-warmed while Purpose is idle.
- **P3 (mostly HYPOTHESIS; needs H2's timeline)**: the cost rises steadily to the top, because the drawn instances are the arrived ∩ in-frustum
  prefix (colony.js:309-336) and all of them have arrived by the top. On top of that come main-thread spikes at each sentence beat (forced
  layouts plus ~40 new `filter: blur` / `text-shadow` CSS animations, site.css:4569-4623). The last two beats (26.4 s, 33.04 s) land on the heaviest GPU frames.
  No adaptive quality covers the manifesto: the DPR is calibrated once on the intro, and after that only a catastrophic, visible step is allowed
  (performance.js:180-280). TAA keeps running two full-res passes even though its weight is ~0 while the camera moves (organism.js:298-311, 370).

## 2. How it works
- **Entry.** Rail "Open Manifesto" → `navigate('manifesto')` (rail.js:846-848) → journey.js `enterManifesto` (827-854). If the page is settled on
  Purpose it calls `branch.begin()` with no anchor and `from = capture()` (branch.js:656-659). Otherwise it calls placeForPassage('final') plus
  `begin({anchor, departFrom})`, and an entry flight joins the ascent at 8.5 s (entry-flight.js:7-19).
- **Clock.** No timer of its own. journey.js:1709 calls `branch.update(dt)` every frame after director.apply. `elapsed` is wall time when dt
  is clamped (branch.js:851-855). `u = elapsed / cameraSeconds` (867), and cameraSeconds is `CAMERA_SECONDS` = `revealSecondsFor(word counts)`
  (pose.js:68) = **37.58 s**, which is the last word's start plus 3 s. Sentences ink when `elapsed >= lineSeconds[i]` (869-870):
  starts **2.00, 8.78, 17.66, 26.40, 33.04 s** (words 37,52,51,36,15). Per word: delay `--w × 0.11 s`, a 3 s `j-manifesto-ink` animation, readable at
  30 % (0.9 s) (pose.js:5-10, site.css:4569-4572). Phones use the same reveal times but admit layout up to 2 s early (pose.js:71-79).
- **Pose** (pose.js:208-233), s = elapsed seconds, T = 37.58:
  - Desktop: `lift = smoother(s/3)`, `spiral = smoother((s-1)/(T-1))`, `ascent = 0.6·smoother(s/10) + 0.4·smoother(s/T)`.
    y = y0 + 8·lift + (70 − y0 − 8)·ascent. Azimuth goes +100°·spiral, radius → 60, target → ring of 21. fov 45.5→46 on lift. Lateral
    frameShift = 11·spiral + 8·middle(s 8.5→13.5 in, 19→T out) (pose.js:90-102).
  - Phone (pose.js:176-205): `tilt = smoother(s/5)` drives pitch→straight down, x/z→fieldCenter, fov 53.5→46, roll→0, and heading +25°.
    Height = 16·smoother(s/5) + (38 − y0 − 16)·smoother(s/T) (pose.js:152-155).
  - The easing everywhere is quintic smootherstep (0 velocity and 0 acceleration at both ends). At s=0.5 the phone has used 0.86 % of its tilt and desktop 3.5 % of its lift.
- **Return** (branch.js:750-777, 873-884): `returnRate = 1/returnSecondsFrom(u)` (2.2 s + 2.6 s·u, pose.js:18-24). For a plain Return,
  `returnFlight = null`, so the pose is `manifestoPose(from, descentU(u0, k)·T)`: the climb replayed at the clock whose height falls as
  `(1 − smoother(k))`. On desktop that height is ascentAt only, and on phone it is the full height law. At k=1 it calls `apply(0)` and then `exit()`, which puts the
  camera at `from` and syncs OrbitControls with the limits lifted (branch.js:778-833). The director (journey.js ~1700) writes the same Purpose
  rest the following frame (handheld amplitude is exactly 0 at rests, director.js:173-176), so **no pose mismatch at hand-off was found**
  (VERIFIED by code; not pixel-checked).
- **Field.** `field.setManifesto(...)` per frame (branch.js:403) → final/index.js:1679-1700 → colony.js `set()` (721-750). The colony is
  560 aerial bodies plus seats (pose.js:80, 254-345), instanced per source layer per tier. NEAR tier = bodies ever ≥70 px tall; others are FAR
  (colony.js:49-52, 606-634). Strands use 1/8 of the hero's segments, sparks 1/3; far shells use a welded index (colony.js:29, 59-87). Six draw calls
  for the colony overall (test-manifesto-motion.mjs asserts this). Ground mat: 50,400 verts / 25,200 additive segments. Spores: 5,940 points
  (measured by running colony.js in node, harness/o1-colony-count.mjs). Phones schedule only **72** of the 560 aerial bodies (planAerialReveals'
  phone-frustum filter, pose.js:395-407); desktop schedules all 560.

## 3. Findings per ledger ID

### M4 — jolt returning Manifesto → Purpose (worst from the very end)
Evidence (harness/o1-return.mjs and o1-return-fine.mjs, 60 fps steps through the shipped functions, desktop 1.6 aspect):
- Return from u=1 (4.8 s). Camera speed per 0.2 s: …58.7 (1.82 s) → **126.3 (2.00 s)** → 23.8 (2.22 s). Frame-level: horizontal velocity jumps
  57→126 u/s and back to 28 u/s within 0.22 s (frames 113-125). The target sweeps sideways at 107 u/s. `frameShiftAt().z` unwinds from −10.1 to −0.8 in 0.18 s.
  Climb-seconds go 13.25 → 8.67 in 0.2 s of wall time. Root cause (VERIFIED): ascentAt is nearly flat for s∈[8.5,13.5] (the 0.6·smoother(s/10) term saturates),
  so the inverted-height clock crosses the frameShift "middle" window about 25× faster than the climb did. From u=0.5 the same whip is 108 u/s at 1.1 s.
  From u=0.15 there is no whip.
- Last second (all starts): speed 12.9 → 17.3 → 0 u/s and pitch rate 26 → **51°/s** at t=4.18 s → 0. The camera drops ~11 u and pitches ~40° in the final ~0.8 s.
  Cause (VERIFIED): the 8-unit `lift`, the target-y and the fov are keyed to s∈[0,3], and that range is crossed in the last 25 % of k. The `8·lift` height is not in
  the inverted function (pose.js:139 vs 220). This is the same "second downward move" that was fixed for phones (pose.js:132-136).
- Phone return: no position spike. The pitch-up starts abruptly, though: angular rate 0 → 24 → 57°/s across 0.4 s at k≈0.5 (s jumps 11.2→4.6),
  because the phone lift term is flat for s>5. Possible "mobile jolt" (VERIFIED in sim, perceptual weight HYPOTHESIS).
- Hand-off at exit: no mismatch found (see §2). There is a separate phone-only HYPOTHESIS: on the frame after exit, final/index.js:1584 `aerial.setPurpose`
  switches the colony from the manifesto schedule (near/far tiers, seats at reveal −1) to Purpose mode (far tier only, welded shells, plan = b.reveal/.14,
  colony.js:684-711). That could pop silhouette or brightness on the nearest seats on the landing frame. H1 should diff the frames on either side of `exit()`.

Fixes (ranked):
1. **Re-key the desktop descent clock to a blend of height and time** in `descentU` (pose.js:137-139): for desktop use
   `heightAt = s => 0.5*yDesk(s)/(H − y0) + 0.5*s/T` with `yDesk(s) = 8*smoother(s/3) + (H − y0 − 8)*ascentAt(s)` (H = max(70, 76/aspect)).
   Simulated (harness/o1-return-fix2.mjs "yMix50"): peak speed 126→96 u/s (top) and 109→74 (mid). Peak |dv/dt| drops **2054→914 and 1863→586 u/s²**.
   The end settles earlier (last 0.5 s: 0-1°/s instead of 28°/s). The landing stays exact because heightAt(0)=0 and the function is monotone. Risk: low, return-only;
   the first ~0.5 s of a return from the top becomes slower to get going. Update tools/test-manifesto-return.mjs:28-38 (it pins the old desktop inverse) and add a
   test for no velocity spike (e.g. max frame-to-frame |Δv| < 1000 u/s²).
2. Alternatively, or in addition, key frameShiftAt's `middle` envelope to ascent fraction instead of absolute seconds (pose.js:98-99). This changes the ascent, so it is riskier.
3. Phone: apply the same `+ c·s/T` time share to `mobileHeightAbove` inside descentU only (pose.js:137-138), so the tilt-up starts gradually. The exact-landing test
   test-manifesto-return.mjs:5-26 asserts height ∝ (1−eased k). That assertion would need to become "monotone, ≤1 % in the last tenth".
Verify: rerun the harness for every start u. H1 should check the camera curve around t≈2 s of a top-start return on 1440x900.

### M5 — pause between sentences too long (halve)
- Defined at pose.js:51-62 (`FIRST_LINE_SECONDS 2.0`, `LINE_BREATH_SECONDS 1.6`, `LINE_SECONDS_PER_WORD 0.14`).
  Derived from them: `CAMERA_SECONDS` (pose.js:68) and every camera curve that divides by T (spiral, ascentAt, phone climb). Also
  `planAerialReveals`' clockScale = T/28 (pose.js:379), `nearBodies` (colony.js:609), the phone admit schedule (pose.js:71-79), `arrivePhase` for the rail dot (branch.js:920-926),
  and the chapter-link enable times (branch.js:587-598). frameShiftAt's absolute 8.5/5/19 s windows (pose.js:98-99) are **not** scaled by T.
- Exact change: `LINE_BREATH_SECONDS = 1.2`, `LINE_SECONDS_PER_WORD = 0.125`. New starts 2.00/7.83/15.53/23.10/28.80, T = 33.34 s,
  dead gaps 0.86/1.19/1.17/0.95 s, each about half of today's 1.81/2.37/2.34/1.89 (harness one-liner in this session; formula gap = start_{i+1} − (start_i + lastBeat·0.11 + 0.9)).
  The ink and stagger constants stay as they are.
- If "pause" means start-to-start: halving that (≈3.4-4.4 s) would overlap sentences, so don't. Halving the breath alone (0.8 s) gives gaps of 1.0-1.6 s, which is not a half.
- Tests that pin current values: tools/test-manifesto-motion.mjs:90 (`1.6 + .14*words`; change it to the new constants or import them), :92 (uses fixture words [26,27,20,25,21]: 19.05 ≤ 28.34, still passes), :183 (T equals the last word finish, still true). The aerial-reveal counts at fixed fractions of T (:513-526) and
  the dwell/tempo oracles (tools/tempo-oracle.mjs, dwell-oracle.mjs do not reference the manifesto: grep found nothing) are unaffected.
  Note that the camera gets 11 % faster, and frameShiftAt's unscaled middle window then sits at a different fraction of the flight. Also scale those (×T/37.58) to keep composition.

### M6 — phone: pull-back not apparent in the first seconds; combine zoom with rotation
Evidence (harness/o1-sim.mjs, o1-mob-candidate*.mjs; 390x844, mean on-screen displacement of a 13×13 ground grid):
- Phone: 0.25 s 8 px/s, 0.5 s 30, 1 s 100, 2 s 185, 3 s 81, 4 s 91, **5 s 2.1, 6 s 2.7, 10 s 5.7, 20 s 7.1, 30 s 2.4 px/s**. Hero scale 52.2 → 70.9 (2.5 s) → 53.3 (5 s) → 28.4 px/u (end).
  Camera-to-hero distance 16.0 → **12.8** (2.5 s) → 18.7. Heading turn (25°) ends at 5 s. After that the frame only zooms, at under 1 %/s.
- Desktop: 0.5 s 32 px/s, then 70-115 px/s through 6 s, and the 100° orbit runs the whole flight. The lift starts 5/3 sooner (s/3 against s/5).
- Root cause (VERIFIED): (a) x/z glide toward fieldCenter and the pitch-down use the same 5 s ease as the 16 u rise, so the camera approaches the subject
  while it rises. (b) The fov 53.5→46 narrowing (×1.19 magnification) eats the rise. (c) The post-lift climb `smoother(s/T)` gives almost no rate at 5-10 s
  and 30-37 s. (d) There is no rotation after 5 s.
- Proposed start curve (end pose unchanged: x/z = fieldCenter, y=38, straight down, heading +25°, fov 46), in `mobilePose`/`mobileHeightAbove` (pose.js:152-205):
  `tilt = smoother(s/5.5)` (pitch and x/z glide); `lift = smoother(s/3.5)` (16 u rise leads the glide); `fov = mix(fov0, 46, lift)`;
  climb term `(38 − y0 − 16)·ramp(s/T, 0.12)`, where `ramp` is C1: quadratic ease-in over the first 12 %, linear, ease-out over the last 12 %;
  heading `= h0 + 25°·(0.45·tilt + 0.55·ramp(s/T, 0.12))`, a continuous slow turn that keeps the +25° end.
  Simulated: 0.25 s 11 px/s, 0.5 s 40, 1 s 92. Hero scale 52 → max 55.5 (+6 % instead of +36 %) → 50.4 at 5 s → 28.4. The steady phase is 4-6 px/s with roughly constant
  zoom (≈1.5-2 %/s) instead of stalling at 2 px/s. Option B, if the owner wants the rotation more legible: add an extra slow orbit of 20-35° over the flight
  (`+ EXTRA·ramp(s/T,.12)`, steady-phase 6-7 px/s). That changes only the final frame's rotation about the vertical. Re-check the colony's portrait "quiet" mask
  (colony.js:233) and the reading column overlap.
- Keep `mobileHeightAbove` monotone (it is, as a sum of monotone terms) so `descentU` still inverts it. planAerialReveals/nearBodies follow automatically
  (they sample manifestoPose).
- Tests to update: test-manifesto-motion.mjs:47-71 (x/z must equal fieldCenter for s ≥ MOBILE_LIFT_SECONDS; heading equals the full turn after the lift; pitch straight down
  after the lift). With tilt over 5.5 s, either set MOBILE_LIFT_SECONDS=5.5 or assert from 5.5 s. test-mobile-manifesto-range.mjs and the
  test-manifesto-return.mjs:5-26 phone block (descent inverts the new height law, still true by construction).
- Risk: medium (composition). Verify on 390x844 with H1's capture: on-screen motion > 5 px/s at every t in (0.3 s, T−2 s), hero scale monotone after 1.5 s.

### P4 — hitch at take-off
On the click frame (begin, branch.js:629-697), VERIFIED code path:
1. `field.setManifesto(0,0,from,…)` (branch.js:678) → `aerial.prepare(from, aspect)` (final/index.js:1680, colony.js:640-680). It runs planAerialReveals
   (pose.js:377-434: 560 bodies × ~140 sampled poses, phones + 151 frustum frames through a closure `phoneFrames.some(...)`), `nearBodies` (colony.js:606-634, 560 × 151),
   and rewrites links (50,400×2), sporeGate (5,940×2) and the tier attributes, all `needsUpdate`. **Measured in node: 42.8/49.2 ms desktop, 25.8 ms cold / 9.7 ms warm phone**
   (harness/o1-colony-count.mjs; the planAerialReveals part alone is 28 ms cold / 1.8 ms warm desktop and 16-20 ms phone).
2. `fitDesktop(true)` (branch.js:689, fit.js:26-39): up to 12 synchronous style+layout passes of ~300 spans (desktop only).
3. `body.j-manifesto-open` (branch.js:686): a document-wide restyle (site.css:4342-4428: z-index changes on .ui and .j-rail, copy fades, `:has()` selector at 4343),
   `root.hidden=false` (first layout of the manuscript), focus, and 18 title-glyph animations with filter/text-shadow.
4. First frames: the colony group is never drawn on desktop Purpose (setPurpose returns early, colony.js:686), so all of its index and instance buffers, ground (≈3.2 MB) and
   spores upload on first sight. warmHiddenChapters (journey.js:2121-2160) compiles programs and uploads textures only, not geometry (HYPOTHESIS, strong: three's compile
   does not upload buffers). links/sporeGate re-upload (~0.85 MB) on every open.
Fixes (ranked): (1) **Precompute `prepare()` during Purpose idle**: when Final settles at rest, schedule `aerial.prepare(restPose, aspect)` in requestIdleCallback and
cache it by `(from pose, aspect, innerHeight)`. In `prepare`, skip the work if the key matches (colony.js:640). Make `setManifesto`'s first call pass a "prepared" flag.
Expected: removes 10-50 ms (desktop server) / likely 50-200 ms (phone) from the click frame. Low risk, since it is a deterministic function of the same inputs. Re-prepare on resize.
(2) **Upload the colony buffers in the idle warm pass**: render the colony group once (instanceCount ≥1, gate 0) into a 1×1 target during warmHiddenChapters, or force-draw it
at Purpose with all fragments discarded. Low risk. (3) Cache the desktop fit result per `(panel width, available height, font-loaded)` and compute it in idle
(fit.js:23-25 already keys on it). Prime it at Purpose. Low risk. Verify with H2's long-task timeline around the click.

### P3 — stutter toward the top (esp. phone)
Evidence / mechanisms:
- Load grows monotonically: instances drawn = arrived ∩ in-frustum prefix (colony.js:309-336), and arrivals end by T (pose.js:430). At the top, desktop has all 560 bodies plus 25k
  additive ground segments plus 5,940 spores. The phone has 72 aerial bodies plus seats but full hero shells for near ones. The colony.js:31-34 comment records
  ~20M tris / 2M segments / 0.5M points ≈ 30 ms GPU at the settled aerial pose before the tiers were added. Current numbers: H2.
- Intermittent hitches (HYPOTHESIS, ranked): (a) **sentence beats**. paintLines (branch.js:599-625) plus liftColumn/measureReadingPadding/followParagraph do forced layouts.
  withAdmittedLayout toggles `hidden` twice (branch.js:453-458, 469, 496) on phones. ~40 words then start a 3 s animation of `filter: blur`, `color` and `text-shadow`
  (site.css:4605-4623), which is main-thread paint every frame. Beats 4 and 5 (26.4 s, 33.04 s; the "Mycelial" name animates 4.2 s) coincide with peak GPU load.
  (b) The phone reading follow writes `lines.scrollTop` every frame (branch.js:529-532) during a follow. (c) cullBodies/cullBatches: whenever the visible set changes
  (bodies entering the orbiting frustum, or a new ground batch starting), the whole instance arrays and the **whole 50,400-entry ground index (200 KB)** are re-uploaded (colony.js:326-329, 361).
  This happens often during the orbit. (d) Frame times near the vsync boundary alternate 16/33 ms (judder). Wall-time stepping (branch.js:851-855) keeps the camera correct but
  does not hide it. (e) GC: ~20-30 small objects per frame (manifestoPose objects, returnVelocity each frame branch.js:366, two `filter` arrays at 869-870). That is minor.
- No quality governor: DPR = min(dpr,2) calibrated on the intro (performance.js:33, 228-258). After that only a >50 %-frames-at-50 ms rule may step, and visibly
  (performance.js:268-279). TAA runs blend+copy at full res every frame even though `weight = 0.6·exp(-motion·150)` is ≈0 during the flight (organism.js:298-311, 366-371).
LOD design for "fade detail as you ascend, no pops" (ranked by win/risk):
1. **Skip TAA while weight < 0.02** (organism.js:298, set `validHistory=false`, copy readBuffer through). Zero visual change, since the history weight and jitter are already ~0.
   Saves 2 full-res passes on every moving manifesto frame (the phone at DPR 2 is 0.78 Mpx each). Low risk.
2. **Precompute the per-sentence layout** (above). Make the ink animation compositor-only: animate opacity/transform per word and put the glow on a single
   per-line pseudo-element with an opacity animation instead of per-word `filter`/`text-shadow` (site.css:4569-4623). This removes the main-thread paint during reading. Medium risk (look).
3. **Screen-size fade of strand/spark light per instance** (colony.js:229-240): the vertex shader already has `centre` (clip). Compute body px height
   `≈ aColonyPose.w·3.6·projectionMatrix[1][1]/centre.w·halfH`. For lines/points multiply `vColonyLight` by `smoothstep(4., 12., px)`, and when it is 0
   emit `gl_Position = vec4(2,2,2,1)` (the pattern spores already use, colony.js:578) so those primitives never rasterise. Optionally raise uColonyGain on the
   surviving shells to keep the patch luminance. It is continuous in px, so it can't pop. This cuts additive overdraw/fill, the dominant cost per colony.js:21-25. Low-medium risk.
4. **Progress-driven far-tier thinning by crossfade**: build a second far strand index at stride 16/32 with gain ×2/×4 and crossfade by a uniform tied to ascent
   (0 below y≈25, 1 by y≈45). Both draw during the crossfade, then only the coarse one. This cuts vertex cost too. Medium risk (sparkle).
5. Throttle the cull uploads: update only changed ranges (`addUpdateRange`) and cull ground batches at 10 Hz. Low risk, small win.
6. Avoid any DPR change mid-flight: setPixelRatio reallocates targets and flashes TAA (performance.js:200-214 comment), and doing it at take-off would worsen P4.

## 4. Open questions
- No GPU or renderer.info numbers from a real device. Swiftshader made the probe impractical. H2 should check whether frame spikes align with beats
  2/8.78/17.66/26.4/33.04 s (P3a) and the click frame (P4).
- I could not confirm which M4 component the owner feels: the mid-return whip (~2 s in, top starts only) or the final-second drop and pitch. Both are fixed by fix 1.
- Phone landing-frame colony mode switch (setPurpose) as a pop source: unverified.
- The fake clock was not used for any claim here; all trajectories come from pure functions at exact 1/60 s steps.
