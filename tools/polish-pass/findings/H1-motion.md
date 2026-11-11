# H1-motion: motion-capture harness and baseline camera curves

## TL;DR
- Harness built and working: `SCRATCH/harness/motion-capture.js` (+ `motion-analysis.js`, `run-all.sh`, `table.js`). Deterministic via Playwright's fake clock; camera read from `window.journey.hero.camera`.
- Captured 3 of 8 requested desktop transitions: intro->inspire, inspire->equip, equip->inspire. Plus the captures are complete (no truncation).
- Not captured: equip->connect, connect->purpose, purpose->intro, purpose->manifesto, manifesto->purpose, and all mobile runs. Reason: host contention (load 20-42 on 4 cores from concurrent browsers) made each frame take 1-5 s; a single transition took 9-12 min and several attempts hit a 5-min browser stall. Orchestrator asked to stop.
- The three captured nav jumps are clean: no velocity steps above the frame-to-frame noise floor, no reversals, no plateaus. Peak linear speed ~11-14 u/s at ~1.3 s; copy fades finish ~0.5 s before the camera stops, and the incoming copy starts only ~1.4-1.5 s in (about 55% through the move).
- Not yet observed: any "jolt" in these three. The M1 complaint (Inspire "jolty"/"drag") was not reproduced in this sample; the M1-relevant fact is the copy timing above. Entry into Inspire from Intro has no plateau.

## Exact usage
Prereq: dev server on http://localhost:8137 (already running). Playwright is global.
```
cd SCRATCH/harness
# one transition, desktop (640x400 = same 1.6 aspect as 1440x900, cheaper under load)
node motion-capture.js --only inspire-equip --viewport 640x400 --max-sec 6 --out SCRATCH/captures/H1-motion
# mobile (390x844 touch; dsf 1 default)
node motion-capture.js --mobile --only connect-purpose --out SCRATCH/captures/H1-motion
# other port:  --url http://localhost:PORT/?nointro=1
# filmstrip:   --filmstrip 10  (PNG every 10 captured frames; slow under load)
# retry wrapper (one browser per transition, 20 min timeout, 3 attempts):
VP=640x400 ./run-all.sh intro-inspire inspire-equip
# per-transition table:  node table.js SCRATCH/captures/H1-motion/desktop
```
Transition names: intro-inspire, inspire-equip, equip-inspire, equip-connect, connect-purpose, purpose-intro, purpose-manifesto (8 s recorded), manifesto-purpose (until settled + 2 s, cap 20 s). Each run first navigates to the start chapter (setup flights are not recorded) and then records. Output per transition: `<name>.csv` (per frame), `<name>.summary.json`, `<name>.svg` (speed, angular speed, copy opacity). Under current load a 2.5 s nav capture took 9-11 min wall (about 1-3 s per frame).

## How the camera is obtained
- `window.journey.hero` is `sceneApi` (`journey/journey.js:1992` publishes `hero: sceneApi`; `main.js:953` sets `window.sceneApi`). `hero.camera` is the three.js camera. `tools/tempo-oracle.mjs` (`runEpisode`, ~line 252) reads the same `J.hero.camera`, so this is the project's own path. No repo file was edited and no module was intercepted.
- Per frame, after `clock.runFor`, the page is evaluated once: `camera.matrixWorld` (rotation columns; forward = -z column, up = y column), position, `camera.fov`, `journey.p`, `journey.travelP` (the camera-phase value), and `getComputedStyle` opacity of each chapter's `.j-block` (matched by `.j-h` heading text), plus `.j-manifesto-panel` opacity.
- Node derives: linear speed |Δpos|/Δt; angular speed from the relative rotation angle (trace of R1ᵀR2) / Δt; forward-direction reversal (angle between successive displacement vectors > 90°); acceleration and jerk by finite difference; discontinuities where |Δv| > max(5×median|Δv|, 10% of peak); plateaus = runs ≥ 6 frames below 2% of peak inside the motion window; copy 10/50/90% crossings relative to motion start and end.
- Caveat: `.j-block` is found by heading text ("Inspire", "Equip", "Connect", "Owned by", "open source"). Intro has no `.j-block`, so mission copy is "NO BLOCK FOUND". The Purpose heading match ("open source") is unverified.

## Proof the fake clock drives the site
1. Boot probe: after `clock.install` + `clock.pauseAt(1000)`, `performance.now()` stayed at 205 ms across 1 s of real waiting (paused). One `runFor(16.667)` moved it 17 ms (Playwright quantises to integer ms).
2. Per-frame `rafN` (count of rAF callbacks the page actually ran, instrumented with an init script): with `runFor(16)`, 242 of 242 frames in inspire-equip and equip-inspire had exactly one rAF fire; intro-inspire had 359 single and 1 double. The camera changes on those frames and is still otherwise.
3. The timestamps are exact: `rel_ms` increments by exactly 16 ms in the captured CSVs, and the camera path is a smooth ease in and out.
4. Finding during this work: a 16.67 ms nominal step produced two rAF fires on 16 of 360 frames, and those frames doubled the camera displacement (spurious 13.5 u/s spike, then 7 u/s). The harness now steps 16 ms (62.5 Hz), so the time base is 62.5 Hz, not 60 Hz. All derivatives use real timestamps.

## Table (captured transitions only)
Viewport: intro-inspire 960x600; inspire-equip and equip-inspire 640x400 (same aspect; camera path not verified identical across sizes). dsf 1. Desktop only.

| transition | motion duration | peak speed (u/s) @ t | peak angular (deg/s) @ t | discontinuities | reversals | plateaus | copy block 10/50/90% (ms after action start) |
|---|---|---|---|---|---|---|---|
| intro-inspire | 2656 ms | 13.6 @1328 ms | 64.0 @1664 ms | none (max step 0.34 u/s/frame, median 0.16 u/s/frame) | none | none | inspire fade-in: 1523 / 1767 / 2010 ms |
| inspire-equip | 2496 ms | 11.4 @1328 ms | 68.2 @1312 ms | none (max step 0.23 u/s/frame) | none | none | inspire fade-out: 1043 / 742 / 441 ms (falling, so 90% first); equip fade-in: 1393 / 1636 / 1880 ms |
| equip-inspire | 2496 ms | 11.4 @1280 ms | 68.2 @1296 ms | none (max step 0.23 u/s/frame) | none | none | equip fade-out: 1059 / 758 / 457 ms; inspire fade-in: 1409 / 1652 / 1896 ms |

Notes per row:
- Copy-vs-camera offsets are measured from the action start. Camera motion ends at the duration above. Incoming copy reaches 90% at about 2.0 s (intro-inspire) or 1.9 s (inspire-equip/equip-inspire), so it finishes about 0.5-0.65 s before the camera stops. Outgoing copy is 90% gone by 0.44-0.46 s, so it leaves while the camera is still accelerating.
- Nav jumps: `journey.p` jumps to 0.20 (Inspire) on the first frame, while the camera eases over 2.5 s. `travelP` (the "travel" column) is the value that tracks the camera. Use `travelP`, not `p`, when comparing.
- Speed rises from ~0 to peak at ~1.3 s, then decelerates; peak angular speed is reached before peak linear speed in inspire-equip (1312 vs 1328 ms), which is a small offset, not a reversal.

## Observations (plain)
- No velocity step, direction reversal, or end-of-move snap was seen in these three moves. Every speed change is smooth and within 0.25-0.35 u/s per frame.
- The incoming copy starts about 1.4-1.5 s into a 2.5 s move and the outgoing copy is gone by 0.45-1.0 s. For the Inspire-side copy this means the "arrival with the camera" timing the owner asked for (M1) is about 0.5 s late relative to the camera's peak speed (~1.3 s). Only the copy timing, not the camera, is the observation here.
- The one-frame double-advance seen with a 16.67 ms step was a harness artifact, not a site jolt. Captures from the 16 ms step (inspire-equip, equip-inspire) show none.

## Not captured (and why)
- equip->connect, connect->purpose, purpose->intro (M3, the wrap), purpose->manifesto (M4 setup, 8 s), manifesto->purpose (M4 return, last 2 s): not run. The orchestrator asked to stop because of machine load (~33) from concurrent browsers. The harness supports all of them (`--only` names are in `TRANSITIONS`); estimated ~10 min per transition under this load.
- Mobile (purpose->manifesto, connect->purpose): not run.
- Filmstrips: not produced.

## Open questions
- Whether the camera path is identical at 960x600 and 640x400 (not verified).
- Whether `.j-block` heading matching correctly identifies Purpose ("open source") and whether manifesto copy is `.j-manifesto-panel`.
- Whether the rest-state creep of `journey.p` (~1e-5 per frame) matters for any feel issue.
- Settle detection is camera-only; a camera still moving slowly after 20 frames would be reported as motion through the cap.
