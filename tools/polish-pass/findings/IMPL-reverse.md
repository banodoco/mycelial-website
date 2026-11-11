# IMPL-reverse: Inspire -> Intro hard stop

Branch polish/reverse, commit 7ef4eb7 (3 files + 1 new test). Captures: SCRATCH/captures/REVERSE/{after,after2,after4,after6}.

## Root cause
Inspire<->Intro is a route-faithful blend (journey.js directJumpTo, `routeFaithful`). Its phase e maps to a route
coordinate through a pace table (journey.js buildRoutePace ~1006-1031, camera-blend.js routePaceP).
For RETURNS the table adds a floor per sample (`ROUTE_PACE_FLOOR`, journey.js ~1002) so the hero furniture has time to
return across the route's stationary end. That one floored table drove BOTH presentedP and the camera
(camera-blend.js: `director.apply(blend.presentedP)`).

The camera pose path (inspire/camera.js arrival(): dead band p<0.040, then a quintic-like tail that dies within
~0.007 p) has real length only down to p~0.03. The floored table spends the last ~2.5% of the eased phase
(~0.5 s, f 0.855 -> 1) on that flat/vanishing stretch (fake length: 46 samples x floor). The camera rides the
ease at full rate until the real path runs out, so it is cut while the ease is still at ~14% of its peak rate:
3.9 -> 2.7 -> 0.36 -> 0.03 u/s in 3 frames at ~2.85 s, then parked for the remaining ~0.5 s.
(Measured duration 2688 ms / 3333 ms = 0.806 is the same quantity: the floor's share of the table, not a 0.8 factor.)
No second camera owner, handoff, seam or heroEntry gate is involved: p/travel is 0.0336 at the cut, the blend is
still running, hero rig is not writing (checked by the CSV: pose stays on the director path to the last frame).
Forward (departure) has floor=0, so its table is already raw: that is why Intro->Inspire is clean.
The original code has the same table (worse because its dur is shorter: 2.667 s).

## Fix
- journey.js buildRoutePace: also returns `camCum` (the floor-free table; aliases `cum` for departures) and
  `camTotal = pathLen`.
- camera-blend.js: `routePaceP(blend, e, raw)`; the compositor poses the camera and lens at `camP` (raw table) while
  `blend.presentedP` (floored) is published unchanged for scene/chapter/rail readers. Camera is now an arc-length
  parametrisation of the eased clock, so it reaches rest exactly at f=1 with the ease's zero velocity.
- presentedP and the departure path are bit-identical to before; rest poses untouched (p=0 reached at e=1 by both).
- Not done: a single pace table (would need the furniture-return time moved elsewhere). Two tables differ by at most
  ~0.005 p mid-flight (floor share 2.7% of a 0.2 range), only on returns.

## Before / after (640x400, ?nointro=1, 62.5 Hz; inspire-intro)
| | base (orig) | merged branch | fixed |
|-|-|-|-|
| move duration | 2176 ms of 2667 | 2688 ms of 3333 | 3264 ms (of 3333, first 80 ms is lag) |
| peak speed | 18.5 u/s | 14.79 | 14.39 |
| last 0.5 s speed | cut | 4.17,2.66,0.03.. | 4.04,3.68,3.27,2.88,2.56,2.21,1.83,1.56,1.30,1.00,0.74,0.56,0.40,0.23,0.10,0.04,0 (monotone, step 3.9 -> 3.7) |
| max abs accel | 214 | 144 | 14.9 u/s^2 |
| linear discontinuities | >=1 | 1 | 0 |
Forward and Equip legs (same build): intro-inspire 3248 ms, peak 14.39, 0 disc; inspire-equip 2496 ms, peak 11.4, 0 disc.
Unchanged vs brief.

## Residual (not fixed)
One-frame landing step at the very last frame of inspire-intro (t=3344): pos 0.0014 u, forward vector 0.18 deg
(speed 0.099 u/s, 12 deg/s, harness flags it as an angular discontinuity at 18.9% of angular peak but only 0.2 deg of
motion). Cause: the flight's pose at p=0 (poseAt(0, hero, aspect, width)) differs from `heroSnapshot` (what
`restoreHero/applyHeroPose` writes at the end) by that amount at 640x400. The base tree has it too (hidden inside the
hard stop). Fix would be in director/hero capture (rest pose bit-identity: left alone). Check at 960x600 / mobile.

## Other arrivals at the Intro (same build, same harness; arcLerp blends, not route-faithful)
- Equip->Intro: 2864 ms, peak 23.8, 0 disc, 0 ang disc, max accel 27.7; last frames 0.95,0.76,0.59,0.44,0.31,0.20,0.12,0.06,0.02,0 -> NOT affected.
- Connect->Intro: 2480 ms, peak 11.17, 0 disc, max accel 14.6; tail 0.45,0.35,0.26,0.18,0.12,0.07,0.03,0.01 -> NOT affected.
- Purpose->Intro (wrap): see PURPOSE-INTRO below.
- Into other chapters from the Intro side: Intro->Inspire 3248 ms 0 disc (route-faithful departure, no floor) not
  affected; Intro->Equip 2880 ms, peak 23.8, 0 disc, tail 0.32,0.25,0.19,0.13,0.09,0.05,0.02 not affected;
  Intro->Connect 2480 ms, peak 11.17, 0 disc not affected.
  These generic arcs never use the pace table, so the defect is specific to route-faithful RETURNS (Inspire->Intro only;
  mid-leg interrupted returns also, same table).

- Purpose->Intro wrap lap: 5072 ms (5.33 s configured, to the 0.02 u/s threshold ~5.3 s), peak 44.1 u/s, 0 disc, 0 ang disc,
  max accel 25.2; tail 1.19,1.06,.94,.82,.71,.61,.51,.42,.34,.27,.21,.15,.11,.07,.04,.02,0 -> NOT affected, no landing step.
  (Capture needs >10 min wall under load; the harness run dies if `timeout` < ~700 s; baseline wrap not re-measured, code untouched.)

## Tests
Node, this tree, after the change (exit 0 each): test-no-scroll-navigation, test-transition, test-inspire-welcome,
test-inspire-arrival-lock, test-frame-order, test-hotspot-departure, journey/structure.test.mjs, test-rest-composition,
new tools/test-return-pace.mjs (added to `test:unit` in package.json). test-frame-publication fails identically
before and after (boundaries.md scan); test-render-baseline fails identically (`baked: no geometry for connect/strands`).
eslint on the three touched files: clean. Not run: full `npm run test:unit` (stops at pre-existing rail-handoff failure),
`npm run cycles` (pre-existing).
Oracle: test-return-pace.mjs fixes a synthetic return table and asserts the camera's covered path fraction equals
blendEase(f) at f = .1..0.99 and rest at f=1 (the floored table does not satisfy it).

## Owner must check by eye
Return Inspire->Intro on real hardware: the camera now keeps decelerating through the last ~0.5 s (previously it
stopped and the furniture return played over a still frame). Confirm the hero furniture/headline return still reads
well while the camera is still gliding (presentedP timing is unchanged, so only relative timing moved).
Also the 0.18 deg landing frame above.
