# Manifesto → Purpose return: the sideways jump and the landing flash

Branch `fix/manifesto-return`. Commits: `67332e3` (descent law), `0ff8ca7` (landing flash), `fbdeb8a` (runtime `d97e988d`), plus this report.

## Summary

- **The jump is real, and it lives in the pose itself.** On desktop, the Return replayed the climb backwards through `descentU`. The climb's 8-unit sideways "frame shift" (made to leave room for the text column) took about 4.4 s on the way up, and the descent crossed it in about **0.15–0.25 s**. Because the shift moves the eye and the target together, the whole picture slides: about **100 px in 9 frames**, peaking at **12.75 px/frame at 800 px wide** (10.2 px at 640) at t≈2.3–2.4 s into a Return from the top. The hero moves left, so it reads as the camera panning right.
  - Around that slide, the 100° orbit unwound in about 1.5 s. The hero swung right, then left, then right again (two reversals), and the heading turned at up to **84 °/s**.
- **The flash is real, and it is a double draw.** On the landing frame, `exit()` calls `field.setManifesto(null)`. Purpose's `setManifesto` defaulted `seats = 1`, so it relit the colony's *copies* of the back ring at full light, on top of the originals, which were already back.
  - In the browser, the colony group went `visible 0→1, seatLight 0→1` on the hand-off frame. One screen cell stepped **+4.42/255** with the camera already still, followed by +2.2, +1.3 and +0.8 as TAA converged.
  - The copies then **stayed on**, because Purpose's desktop `setPurpose(0)` returns early. Full-frame luma climbed 47.5 → 49.9 over the next second.
- **Ruled out by measurement:** no camera view offset, film offset, CSS transform or canvas move (all constant over every frame); no jump on the click frame; no jump at the camera hand-off (0.00 px); no TAA brightening (the restart ramps with no luma step; see the after run). The browser camera matched the node sim **to 0.00 px on every frame**, desktop and phone, so the page applies nothing on top of `pose.js`.

## Method

- **Browser capture:** `return-capture.cjs`, Playwright headless Chromium on SwiftShader, with the fake clock paused and `runFor(16)` per frame (62.5 Hz).
  - Sources are served live from `serve.py`: before = `74b4c1a` in a scratch worktree, after = this branch.
  - Three QA hooks are injected at fetch time with `page.route`, without touching the repo: `branch.js` exposes its state (`u`, `returnK`, `returnStart`, direction, `seatLight`) and a seek of its climb clock; `organism.js` exposes the TAA pass; `colony.js` exposes group visibility, seat light, gate and Purpose mode.
  - The climb is seeked to `u·T − 0.4 s`, then 26 real frames run before the Return is clicked through `journey.flyTo('final')`.
- **Recorded after every `composer.render`:**
  - camera position, target, forward, up and right vectors, `journeyRoll`, fov, `camera.view`, `filmOffset`;
  - the canvas's CSS transform and rect;
  - the steady-projected screen position of the hero's cap (0, 2, 0) and of the world origin;
  - TAA enabled/weight/validHistory; the Purpose/colony uniforms; body classes;
  - `readPixels` mean luma plus a 4×4 grid (row 0 = top/back of frame); a 320 px thumbnail every 8th frame.
- **Analysis:** `analyze.mjs` recomputes the node-sim pose for each browser frame from the page's own `returnStart`/`returnK` and the director's Purpose rest, projects it, and diffs it against the browser (`maxSimDev`). The scripts live in the session scratchpad and are not committed.
- **Viewport caveat:** `isMobileManifesto` (pose.js:126) also treats `innerWidth ≤ 720` as a phone. A 640×400 window gets the **phone** camera, so my first 640×400 capture was discarded. Desktop captures are at **800×500** (aspect 1.6, the desktop curve). The pixel figures marked "@640" are scaled to the brief's 640-wide frame.
- **What ran where:**
  - In the browser: before and after from u=1 on desktop; before from u=1 on phone.
  - Starts 0.1–0.9 on desktop ran in the node sim only. The sim was checked against the browser to 0.00 px at u=1, but it is still a sim.

## Results: lateral glide (desktop)

| Return from | Source | Max lateral step @640 (px/frame) | Lateral reversals | Max vertical step @640 | Peak heading rate (°/s) | Heading backtrack |
|---|---|---|---|---|---|---|
| u=1.0 | **browser** before | **10.20** (12.75 @800) | 2 | 2.42 | 83.7 | — |
| u=1.0 | **browser** after | **0.35** (0.44 @800) | **0** | 1.00 | **39.3** | **0.000°** |
| u=1.0 | sim before / after | 10.61 / 0.37 | 2 / 0 | 2.52 / 1.04 | 84.0 / 39.6 | |
| u=0.9 | sim before / after | 10.70 / 0.40 | 2 / 0 | 2.54 / 1.08 | 81.6 / 40.8 | |
| u=0.8 | sim before / after | 10.46 / 0.49 | 2 / 0 | 2.49 / 1.12 | 78.0 / 40.8 | |
| u=0.75 | sim before / after | 10.43 / 0.54 | 2 / 0 | 2.48 / 1.14 | 75.0 / 39.0 | |
| u=0.5 | sim before / after | 8.17 / 0.62 | 1 / 0 | 1.94 / 1.21 | 48.0 / 21.0 | |
| u=0.36 | sim before / after | 4.77 / 0.46 | 1 / 0 | 1.15 / 1.24 | 25.2 / 12.6 | |
| u=0.1 | sim before / after | 0.54 / 0.40 | 0 / 0 | 0.76 / 0.76 | 0.6 / 1.2 | |

Browser after, u=1 (800 px wide):
- **Click frame:** 0.00 px step.
- **Landing / hand-off frames:** 0.00 / 0.00 px.
- **Peak lateral speed:** 27.6 px/s, against 78.3 px/s vertical. Before it was 797 px/s lateral against 189 px/s vertical.
- **Heading rate over the last 10 frames (°/s):** −0.96 −0.80 −0.64 −0.50 −0.38 −0.27 −0.19 −0.11 −0.06 −0.02 0, so it reaches zero rate at landing. Roll stays at 0 on desktop (the rest roll is 0).
- **Rest pose:** the landed position, forward vector, fov and roll are bit-identical before and after.
- **Hero screen x:** 590 → 520 px, monotone.

Contact sheets (every 8th frame; look at +2.34 → +2.46 s): `img/return-top-before-desktop.jpg`, `img/return-top-after-desktop.jpg`, `img/return-top-phone-unchanged.jpg`.

## Results: landing luma (desktop, browser, u=1)

Frames are numbered from the hand-off. "Back" is the mean of the top row of the 4×4 grid. "Max cell step" is the largest single-cell change from the previous frame. The camera is already still in all of these frames.

| frame | before: luma / back / max cell step / colony | after: luma / back / max cell step / colony |
|---|---|---|
| −2 | 47.51 / 32.21 / 0.18 / hidden | 49.50 / 32.48 / 0.19 / hidden |
| −1 (hand-off) | 48.30 / 32.49 / **4.42** / **vis, seat 1** | 49.53 / 32.51 / 0.17 / hidden |
| 0 | 48.73 / 32.69 / 2.22 / vis, seat 1 | 49.54 / 32.53 / 0.11 / hidden |
| +1 | 48.94 / 32.81 / 1.31 | 49.48 / 32.49 / 0.17 |
| +2 | 49.13 / 32.94 / 0.77 | 49.54 / 32.52 / 0.28 |
| +3 | 49.20 / 33.02 / 0.32 | 49.52 / 32.54 / 0.16 |
| +62 (1 s) | 49.94 / 33.25 (it kept rising; the copies stayed lit) | — / 32.37 (max over that second 32.58) |

After the fix, no back-field step at landing exceeds 0.28/255 and nothing overshoots its rest value.

The pre-landing levels differ between the two runs (49.5 vs 47.5) because the views differ for the last ~0.5 s: the after run's orbit arrives on its own clock. Phone, browser, before (path unchanged): the colony switches representation at landing (`gate 0→1`, `seat 1→0`, Purpose mode). The top region moves 53.40 → 53.65 → 53.62, about 0.25/255, so no phone flash was measured.

## Root causes (file:line at `74b4c1a`)

1. **The frame shift was replayed on the descent.**
   - `journey/manifesto/pose.js:140` applied the shift's `middle` window as a function of the climb clock. `branch.js:363` posed the descent as `manifestoPose(from, descentU(...)·T)`, with `descentU` at pose.js:171.
   - `descentU` passes through that window (u ≈ 0.36 → 0.23) at about 16× the climb's speed. The world-space checks (≤ 100 u/s) passed because 8 units is small in world terms. On screen it is a 100 px slide.
2. **The orbit unwound on the climb clock.**
   - `spiral` (pose.js:281) drives azimuth, radius and the target's swing. The descent's u falls 0.85 → 0.25 in about 1.5 s of a 4.8 s Return, so the heading turned at 84 °/s and the hero swung across the frame both ways.
3. **The landing relit the colony's ring copies.**
   - `branch.js:881` calls `field.setManifesto(null)`.
   - `journey/chapters/final/index.js:1727` took `seatAmount = seats` (default 1) on desktop. That made `colony.js:926` show the group with `seatLight = 1` over the returned original ring.
   - Purpose's desktop frame calls `aerial.setPurpose(0)`, which returns early (`colony.js:879`), so nothing switched the copies off again. The sky's own seat amount already treated the hand-back as 0.

## What changed

- **`journey/manifesto/pose.js`** adds `descentPose(from, startU, k, aspect)` (line 248), the plain Return's pose at descent clock `k`:
  - height, lift, lens and bank keep `descentU`, as before;
  - on desktop the frame shift is *released*: whatever shift was on screen at the click eases out on `smoother(k)` and is never re-applied (`descentFrameShift`, line 148). From the top there is none to release;
  - on desktop the orbit (azimuth, radius, target swing) eases on `smoother(k)` from the orbit on screen at the click (`descentSpiral`, line 237);
  - on desktop the look target slides along the camera's horizontal right so the hero's screen x eases straight from its click position to its rest position, a correction of at most ~40 px (`anchorScreenX`; 4 fixed-point iterations).
  - `manifestoPose` takes optional `{ shift, spiral }` overrides. Without them the climb is bit-identical: the existing ascent tests and the warm-plan bit-identity tests pass unchanged. At k=1 the overrides are exactly 0, so the landing is the exact rest.
- **Why the pieces are combined, from the sims:**
  - *Shift release alone:* lateral peak 2.1 px, but still a 106 px / 50 px reversal and 84 °/s heading.
  - *Screen pin alone:* lateral 0.4 px, but the heading overshot by 20° and came back, which is a pan reversal.
  - *Orbit on k alone:* 38 °/s heading, but a ~55 px swing remained.
  - *All three together* meet every target.
- **Phone is deliberately unchanged.** Its descent starts looking straight down, where any sideways target offset picks a new heading. Moving its 85° turn onto `k` was tried and made the lateral step worse (2.2 → 4.8 px/frame), because the tilt then sweeps along a heading that has not yet unwound.
- **`journey/manifesto/branch.js`** poses the descent and reads `u` through `descentPose` (lines 366, 974). The landing and retarget blends use the same law.
- **`journey/chapters/final/index.js:1734`:** on desktop, the hand-back (`progress === null`) gives the colony copies 0, matching the sky.
- **Tests:**
  - `tools/test-manifesto-return.mjs` gains an on-screen meter: a real THREE camera, 62.5 Hz, the hero's cap, three desktop rests (the literal one, and the director's at 1440×900 and 1280×720), starts 0.1–1. It requires:
    - lateral step ≤ 1.5 px @640;
    - < 0.1 px on the click frame;
    - zero lateral reversals;
    - heading backtrack < 1° and heading rate < 60 °/s;
    - exact landing;
    - phone lateral ≤ 1.5 px at starts 0.1/0.5/1;
    - branch.js text uses `descentPose`.

    The same meter runs the old law and must measure > 5 px (it measures 10.2). The two existing descent blocks now pose through `descentPose`. They are a cheap guard on the phone curve, which is unchanged.
  - `tools/test-final-ring-handoff.mjs` gains a node oracle on the `seatAmount` expression. I verified that it fails against the old `index.js`.
- **Runtime:** `runtime/d97e988d…` and `runtime-release.js`; `npm run runtime:check` verified it.

**Tests run before/after:** test-manifesto-motion, -return, test-mobile-manifesto-range, test-manifesto-entry, test-manifesto-concepts, test-colony-retirement, test-frame-order, and the three test-final-* suites all pass before and after.

Every other suite that reads these files as text gives the same result at `74b4c1a` and on this branch:
- **pass:** tempo-oracle, declared-conversions, ui-closure;
- **fail identically:** chapter-contract, connect-motion, frame-publication, gate-composition, global-hooks, page-lifetime, rail-handoff;
- **times out identically:** epilogue-retire.

No goldens were re-shot.

## Not verified, stated bluntly

- **Desktop starts 0.5 and 0.8 were not captured in a browser.** Only u=1 was run, before and after. Their numbers are node sim. At u=1 the sim and browser agree to 0.00 px, and nothing page-side varies with the start, but it is not a browser measurement.
- **The phone was captured in a browser before the fix only.** The fix does not change the phone path, and the sim reproduces that capture to 0.00 px.
  - The phone still has a lateral swing: the hero moves right about 50 px while overhead (the orbit unwinding as an image rotation), then left about 160 px during the tilt up, peaking at **2.1 px/frame at 390 wide** with two reversals. That swing exists before and after this change.
  - The phone meter's 1.5 px bound holds for the test's phone rest, but **not** for the director's 390×844 rest (2.1–2.5 px in sim).
  - If the owner feels a sideways pull on the iPhone, this is it. It needs its own law, for example a pole-safe pin that rotates the image instead of sliding the target. I have not attempted it.
- **Mid-descent composition differs from the climb** at the same height: the orbit is on its own clock, and from the top the frame shift is never re-applied. The contact sheet looks continuous to me. Whether it matches the owner's taste is untested.
- **Away descents (landing elsewhere) and retargets are unchanged.** `createReturnFlight` overrides the pose there, as before.
- **Software GL, 800×500, DPR 1, fake clock.** TAA history and frame pacing on real GPUs were not measured. Real browsers between 640 and 720 px wide take the phone camera on a landscape window (pre-existing, `isMobileManifesto`).
- **What the owner should look for on the MacBook:**
  - A Return from the top of the Manifesto: no slide to the side about 2.3 s in. The cluster should drift calmly to its place while the view turns one way and stops turning as it lands.
  - At touchdown: the back mushrooms should not brighten.
  - On the iPhone: the overhead turn, then the tilt, are unchanged. Judge whether that sideways pull bothers you.
