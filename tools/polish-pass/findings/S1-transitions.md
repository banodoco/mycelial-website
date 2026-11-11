# S1-transitions: click-driven section travel (M1, M2, motion side of P2)

Method: static reading plus a node replica of the travel math. Script: SCRATCH/harness/s1-profile.mjs, which stages the real journey/director.js, route.js, camera-path.js and navigation modules.
Raw profile: SCRATCH/captures/S1-transitions/m1-profile.json.
No browser was used. Numbers are 60 fps virtual-clock, 1440x900, aspect 1.6. They are VERIFIED against the shipped modules but not against a rendered frame, so H1's capture should confirm the shapes.
All paths are under /home/user/mycelial-website/journey/ unless noted.

## 1. TL;DR
- Travel is a scripted tween, not a chase or a scroll animation. A clock `blend.t` runs 0..dur, and `f=t/dur` goes through ONE ease. The camera is placed from that ease each frame. Journey state `p` is parked at the destination at click time. Nothing in the camera path is a dt-free lerp.
- Intro->Inspire (the "route-faithful first leg") takes 2.667 s on a cubic smoothstep `f*f*(3-2f)`. That ease is C1 but not C2.
  - Camera-blend.js:56-58 picks smoothstep for this one move only. Every other hop, and the return to Intro, use the quintic smootherstep.
  - The measured start is a step in acceleration (20.8 u/s^2 at t=0) and the end is -10 u/s^2 then 0.
  - Smootherstep would start at 1.4 u/s^2 and end at 0.
  - The "kick-off" feel is a real, code-level cause.
- The Inspire content does not arrive with the camera. Measured against the 2.667 s move:
  - The heading copy is done at 2.17 s, 0.5 s before the camera stops.
  - The first ember kindles at about 2.0 s.
  - Embers 2 and 3 wait for landing: ember 2 starts about 0.04 s after, ember 3 about 0.4 s after, and they complete about 0.9 s after.
  - The hotspot chips, on a wall clock (540 ms gap, 700 ms form), finish about 1.1 s after landing.
  - Nothing is ever cut or stopped. The camera simply stops while the scene is still assembling. That reads as the move dragging on.
- M2: Equip->Connect is NOT an outlier in camera duration (2.718 s against 2.6-2.667 s for its siblings).
  - The extra `EQUIP_CONNECT_EXTRA_S = 0.66` is now nearly vestigial. The 2.6 s floor (`MIN_NAVIGATION_SECONDS`) was added later and swallows it. Without it the hop would be 1.776 s, floored to 2.6 s, so the extra buys 0.118 s.
  - It is the FASTEST sweep on the site: a 227.7 deg az turn with peak 21 u/s, 133 deg/s gaze and 157 deg/s az.
  - Connect's ground-light entry runs a separate 3.2 s clock that starts about 1 s into the move, so the section settles about 1.5 s after the camera lands. The "too long" feeling is most likely that tail.
- Frame drops produce slow-motion, not a jump. `organism/animation.js:67` clamps `dt = min(0.05, ...)`, so any frame over 50 ms makes the camera, and the copy clocks riding it, run slower than wall time.
  - Some arrivals use `performance.now()` instead (hotspot beats `ui.js:1037`, Equip rings `chapters/equip/index.js`). Under load those race ahead of the camera.
  - Each click also runs 3 synchronous full `applyFrame` passes. `ui.update` does forced layout reads on every one, and on every normal frame too (section 3.6).

## 2. How travel works (VERIFIED by reading)

### 2.1 Entry points and the click path
- Rail item click: `rail.js:712-716` calls `navigate(id)`. Menu rows are at `rail.js:1069` and `rail.js:1106`. The hero CTA is at `journey.js:715`. All reach `handleNavIntent` (`journey.js:476`) then `navigateFromControl` (`journey.js:~905`).
- If the journey is not yet activated (click during intro growth), `opts.onEntry` queues it. `boot/handoff.js:560` and `beginFastHandoff` (~`handoff.js:470`) accelerate the intro and replay the entry on `activate()` (`journey.js:2009-2022`). Other order and cost: warm-up of hidden chapters starts then (`journey.js:2021`, `warmHiddenChapters` at `journey.js:2121`).
- After activation: `navigateFromControl` -> `navigateTo` -> `directJumpTo(chapterId, wrap)` (`journey.js:1069`). The wrap is only Intro<->Outro.
- `wheel`/`touch`/`key` input goes through `transport.js`. It does not drive these clicks. In production `blocksTravel()` cues the buttons instead.

### 2.2 What directJumpTo does (`journey.js:1069-1520`)
1. `placeAt(targetP, {snap:false})` (`journey.js:1197`, defined `journey.js:1924`) runs `applyFrame(p,0)`, `seams.update`, `applyFrame(p,0)`. Then the final `applyFrame(targetP,0)` at `journey.js:1509` is a third full pass. That is 3 synchronous full frames in the click task. They do no rendering but run `ui.update`, the chapters' `drive`, the lens and the seams.
2. It reads the live camera as `pos0/tgt0/fov0/roll0`. The new target is `p = restProgress(id)`. Rests: mission 0, inspire 0.2, equip 0.32, connect 0.523, owned 0.725, final 0.97 (route.js, verified by import).
3. Path choice:
   - Mission<->Inspire is "route-faithful" (`journey.js:1109-1115`). The camera rides the authored `poseAt(p)` route, with `p` driven by a path-metric pace table (`buildRoutePace`, `journey.js:1006`, 256 samples).
   - Every other hop is a generic cylindrical arc, `arcLerp` (`camera-path.js:~17`). It has the grammar sense `navSense` (`navigation.js:~60`), bow (Equip legs), tgtDip (Equip), skim (Connect->Final), roll, fov and fog lerps.
4. Duration:
   - `baseDuration = 0.85 + 0.35*min(len/20,1)`. Equip legs, the flyby and any leg over 180 deg use uncapped `len/20` (`journey.js:1372-1400`). The flyby adds 0.72, and the Equip->Connect exit adds 0.66.
   - `dur = max(2.6, base / speed)` (`navigation-timing.js:34-40`), with speed from `navigationSpeed`. Default 0.45. `connect|equip` 0.70. `connect>final` 0.42. `final>connect` 0.49. `inspire>connect` 0.48. `final|mission` 0.75.
   - Duration IS distance-dependent through `len`, but the 2.6 s floor binds on most hops.
5. `transition.beginBlend({... t:0, dur, play:1, easeSlope, easeK ...})` (`journey.js:1442`). The easeSlope term is only used when a click overtakes a live flight.
6. `setBlending(true, ...)` is called for non-route-faithful hops only (`journey.js:1489`).
   - Route-faithful: no `chapterEntry` (`journey.js:1188`), so chapters keep reading the presented `p`.
   - Others: `startChapterEntry(chapter)` calls `beginEntry()` and returns a local entry clock (`chapter-entry.js:14-27`).

### 2.3 Per frame (`applyFrame`, `journey.js:1590-1870`)
- `organism/animation.js:63-68`: `dt = min(0.05, max(0, t - prevT))`. Animator order puts the journey before the chapters.
- `transition.stepCamBlend(dt)` -> `camera-blend.js:64`: `blend.t += dt*play; f=min(t/dur,1); e=blendPhase(blend,f)`.
- `railMotion.phase=e` and `railMotion.elapsed=blend.t` (`camera-blend.js:80-82`). The rail, the copy and the hero furniture all read these.
- Route-faithful: `presentedP = routePaceP(blend,e)`, then `director.apply(presentedP, dt)` and a lens override (`camera-blend.js:90-95`).
  - `apply` is `poseAt` + handheld + `applyCameraRoll` + fog (`director.js`).
  - `poseAt` -> `INSPIRE_CAM.arrival` (`chapters/inspire/camera.js`): `azEase` (trapezoid, RAMP 0.18, plus ORBIT_BREATH 1%) for azimuth, `trapEase` for r, y, fov and the gaze bezier.
  - The pace table is the length of the camera POSITION path only, and skips the hero dead band (ARRIVAL_DEAD).
- Generic arcs: `arcLerp(pos0,dst,e,...,az1,bow,rise,eAz)`, plus target lerp, fov lerp, fog lerp, grade lerp, with `e = smootherstep(f)` (`blendEase`, `camera-blend.js:48-52`).
- Landing: `f>=1` -> `onEnd(true)` -> `endCamBlend(true)` (`transition/controller.js`). That does `setBlending(false)`, `snapChapterLandings` and a lens override reset.

### 2.4 Layers between target p and the camera
- Pacing table -> ease -> `poseAt` -> handheld (`director.js:~295`, amp 0.34 deg, scrub-suppressed above 0.06 p/s, zero within 0.018 p of a rest anchor).
- Roll, fov, fog and grade are lerped with the same `e` (generic arcs) or ride `poseAt` (route-faithful).
- No spring or damping filter sits in the click path.
- I grepped for dt-free `x += (t-x)*k` lerps in `journey/` and `organism/`: none in the travel path. The only filters are `min(1, dt*K)` forms (copy-arrival `COPY_IN_K=2.4`, `COPY_OUT_K=7`, `pSpeed` at `dt*5`, hhSpeed at `dt*4`).
- Lens (`lens.js`) is a colour-grade curve (`lookOf(p)`), not an FOV changer. FOV changes are in `poseAt` / `blend.fov0`.
- The seams (`seams.js`) arm and retire chapter groups by presented progress. Inspire's exits arm at about az 4.79 deg (`chapters/inspire/camera.js` comments), which is the very start of the move.

## 3. Findings

### 3.1 M1 stage list, Intro->Inspire, in time order (dur 2.667 s)
VERIFIED from the replica unless marked.

| t (s) | Event |
|---|---|
| 0 (click task) | 3 sync full frames, a pace-table build (257 `poseAt`), `director.setTransitioning(true)`, rail cue stop, and `closeDetail`. |
| frame 1 | `presentedP` jumps 0 -> 0.031 (the dead band is skipped). Poses are identical, so there is no visual jump. The derived `|dp/dt|` reads about 2 p/s for one frame, so `hhSpeed` and the copy `pSpeed` spike. |
| 0 - 0.05 | Speed is already 0.16 u/s, and acceleration is 20.8 u/s^2 from the first frame. **Acceleration step at launch.** |
| 0.32 - 1.32 | Intro copy and hero furniture depart on `navCopyDeparture` (`bands.js`): `departStart=min(0.45,0.12*dur)=0.32`, `departDur=1.0`. Hero spore field fades with it. |
| 1.35 | Peak speed 13.5 u/s, 71 deg/s az, gaze 64 deg/s at 1.62. This is the middle of the move. |
| 1.37 - 2.17 | Inspire heading copy arrives (`navCopyArrival`, `bands.js:101`): start `max(0.5*dur, dur-1.3, departStart+0.8)=1.367`, `ARRIVE_S=0.8`. Camera phase `e` is 0.52 -> 0.92 here. |
| ~1.82 - 2.67 | The chapter gate rises 0 -> 0.38: `gateLead=smoothA((phase-0.76)/0.24)`, cap `land=0.38` (`copy-arrival.js:150-153`, `:~437`). Ember 1 kindles at gate 0.10 (about 1.99 s). |
| 2.42 - 2.67 | Camera tail: 4.7 u/s at 2.42, 1.2 u/s at 2.62, then the end. Acceleration steps from -10 u/s^2 to 0. |
| 2.667 | Landing. `endCamBlend`. The nav ticket becomes "carrying". |
| 2.7 - 3.6 | The gate chases the floor on `min(1,dt*2.4*settled)` (`copy-arrival.js:~495`). Ember 2 starts at gate 0.4375 (about +0.04 s), ember 3 at 0.775 (about +0.42 s), complete at 0.93 (about +0.92 s) (`chapters/inspire/index.js:~1002-1010`, constants at `:~965-967`). |
| ~2.0 - 3.8 | Hotspot chips: `beatGapMs 540`, `formMs 700` (`constants/copy.js:236`), wall clock via `performance.now()` (`ui.js:1037`, `hotspot-frame.js:370-383`). Chip 3 completes about 1.1 s after landing. Surge shimmer is 2.15 s on top (`chapters/inspire/index.js:~1020`). |

Why this reads as "jolty / drag" (ranked):
1. HYPOTHESIS, strongly supported: **the content cascade outlasts the camera.** The camera is calm (peak 13.5 u/s, below the 13-22 u/s family), then stops while the scene is still assembling for about 1.1 s. The heading is already fully visible 0.5 s before the camera stops, so the sequence reads heading-then-camera-lands-then-embers. It is a distinct second "arrival" rather than one move.
2. VERIFIED: **cubic ease at the launch.** `camera-blend.js:56-58` chose smoothstep for the departing first leg ("a cubic launch then makes movement perceptible promptly"). Peak acceleration is 20.8 u/s^2 immediately at t=0, and the camera is already at 5% of peak speed by 0.05 s. A Matrix-style lazy start would be about 0.2 s.
3. VERIFIED, minor: the pace table equalises POSITION path length per eased time only. It does not equalise gaze or fov. Gaze peak (64 deg/s at 1.62 s) trails position peak (1.35 s), so the aim keeps turning while the camera slows. It is smooth, not a jolt.
4. VERIFIED, cosmetic: the pace table is piecewise-linear over 256 samples, so `dp/du` changes slope at 256 knots. Magnitude is about percent-level; invisible.
5. HYPOTHESIS (needs H1): first-sight work in the click task or mid-move. Candidates:
   - 3 synchronous full `applyFrame`s (section 3.6).
   - `warmHiddenChapters` idle compiles (`journey.js:2121-2153`): it sets `visible=true` on whole groups and calls `renderer.initTexture`, which is synchronous. It starts 7.6 s after activation, one group per idle callback, 4 s timeout, which can overlap an early click.
   - Seam arming of Inspire's plume and spore systems at the very start of the move.
   - Any frame over 50 ms slows the camera because of the `dt` clamp.

No mid-move deceleration exists in the camera maths. Speed is a single bell: smoothstep gives 1.5x average at the centre, with no second ease-in. The perceived "drag" is therefore content-driven (1) or hitch-driven (5), not an ease defect.

### 3.2 Per-hop durations (VERIFIED, replica vs shipped formulas)

| hop | az sweep | path len | base s | speed | dur s | peak u/s | peak gaze deg/s |
|---|---|---|---|---|---|---|---|
| mission>inspire | +127.2 | 24.0 | 1.200 | 0.45 | **2.667** | 13.5 | 64 |
| inspire>mission | -127.2 | 24.0 | 1.200 | 0.45 | 2.667 | similar | |
| inspire>equip | +85.0 | 13.2 | 1.081 | 0.45 | **2.600** (floor) | 11.4 | 67 |
| equip>inspire | -85.0 | 13.2 | 1.081 | 0.45 | 2.600 (floor) | 11.4 | 67 |
| equip>connect | +227.7 | 22.4 | 1.903 | 0.70 | **2.718** | **21.1** | **133** |
| connect>equip | -227.7 | 22.4 | 1.243 | 0.70 | 2.600 (floor) | 22.0 | 139 |
| connect>final | +212.7 | 43.5* | 2.331 | 0.42 | 5.549 | 15.2 (plain arc; skim is shaped) | 68 |
| final>connect | -212.7 | 43.5* | 1.611 | 0.49 | 3.287 | | |

*Skim path length is longer than the plain-arc estimate; the replica did not model the skim lobe.

Notes:
- Distance-dependence is real, but the 2.6 s floor (`navigation-timing.js:12`) pins inspire<->equip and connect>equip.
- The wrap is separate (Intro<->Outro, base 4.0, speed 0.75, 5.33 s).
- Second-click (overtaking) behaviour and the easeSlope momentum are out of scope here.

### 3.3 M2: Equip->Connect
- Camera duration: 2.718 s vs 2.6 (inspire<->equip, connect>equip) and 2.667 (intro<->inspire). Delta +0.05..0.12 s, not an outlier. VERIFIED.
- `EQUIP_CONNECT_EXTRA_S=0.66` (`journey.js:270`) was authored when no floor existed: 1.76 -> 2.73 s per its own comment. After `MIN_NAVIGATION_SECONDS=2.6` it buys 0.118 s. The tests pin `1.9/0.70`, so they would still pass (`tools/test-no-scroll-navigation.mjs:~245`).
- The sweep is the widest and fastest generic arc: +227.7 deg in 2.72 s with peak 157 deg/s on azimuth and 133 deg/s on gaze. That is double the Intro->Inspire family, with a bow of 2.2 and a tgtDip. A slow-then-fast-then-slow profile of this size can read "long" because the middle is whippy and the ends crawl.
- Connect's own entry clock (`chapters/connect/index.js:546`, `ENTRY_DURATION_S=3.2`, started by `entryReady()` = camera y>0 and gaze resolve >= 0.24 (`ENTRY_CAMERA_READY`)):
  - In the replica the camera is ready about 0.98 s into the move, so the ground-light show finishes about 4.2 s after click, about 1.5 s after landing.
  - This is the most likely source of "feels long", not the camera.
  - Pinned by `tools/test-connect-arrival.mjs`, `test-connect-motion.mjs`, `test-connect-hivemind-welcome.mjs` and `tools/test-equip-arrival.mjs` (the last one pins Equip's own 280 ms / 790 ms cadence).
- Recommendation: do not change the camera. If the owner wants it shorter, the lever is `ENTRY_DURATION_S` (3.2 -> about 2.4), or `EQUIP_CONNECT_EXTRA_S=0` to drop to the 2.6 floor (gains 0.118 s). Measure with H1 first.

### 3.4 P2, motion side (Inspire <-> Equip)
- These are generic arcs on a 2.6 s floor, `startChapterEntry('equip')` runs `beginEntry()`, and `setBlending(true, ...)` is on. `p` is parked at the destination, so the whole scene composes for the destination while the camera is still at the source.
  - Inspire's exits and plumes are released on the click frame. `plumeFade.setBlending` and `hotspot-frame` carry departure.
  - Equip's group becomes visible immediately.
- Candidate stutter causes (HYPOTHESIS unless noted):
  - Equip's rings fire from `advanceIntro` and use a wall clock (`seconds()=performance.now()/1000`, `chapters/equip/index.js:~215`). They call `sceneApi.welcomeFrom/pulseFrom`. Each ring is a GPU-side event at a moment not tied to the camera clock.
  - The click task runs 3 full frames (VERIFIED, section 3.6).
  - The `dt` clamp stretches the move whenever a frame runs long.
  - First-sight shader or texture upload for Equip, if `warmHiddenChapters` has not reached it yet.
- Equip's entry clock `entryDuration 2.2` starts when `entryReady()` is true (under-cap camera, r<8, 0<y<2.6).

### 3.5 Frame drops and the dt clamp (VERIFIED)
- `organism/animation.js:67`: `dt = min(0.05, ...)`. A 100 ms frame advances every scene clock by 50 ms (slow-motion). The camera, copy (`railMotion.elapsed`), Inspire surge and handheld all share it.
- Wall-clock readers: hotspot beats (`ui.js:1037` -> `hotspot-frame.js:380`) and Equip rings. After a hitch those run ahead of the camera.
- Other clamps: spores 0.033, `copy-arrival`'s `min(1, dt*k)` forms. Scroll has its own `STALL_FRAME_MS`; that path is not used by clicks.
- Under load, the camera does not jump. It stretches. It does not skip a section either.

### 3.6 Expensive or hot work the travel code triggers
- Click task: 3 full `applyFrame`s (`journey.js:1197`, `:1924-1936`, `:1509`). Each runs `ui.update`, chapter `drive`/`driveEntry`, seams, lens, and `chips.measure()`.
- Per frame, always: `ui.js:1029-1031` writes copy opacity/transform (`copy.step` -> `paintCopy`, `paintCopyRise` sets `style.transform` on `.j-h`, `.j-sub`, `.j-act`), then `chips.measure()` reads right after. `hotspot-frame.js:221-229` does `getBoundingClientRect` + `getComputedStyle` on each visible copy block, plus `offsetWidth/offsetHeight` for every hotspot. That is a **forced style+layout recalc on every frame** (write-then-read), not only during travel.
- `arrival-motion.js:6` and `:17-18`: `void block.offsetWidth` and `getComputedStyle` on copy start (WAAPI path, wraps only).
- `camera-blend.js:116`: `guarded('lens', ...)` and a `look` object per frame; cheap.
- `buildRoutePace`: 257 `poseAt` calls; trivial. `skimPathLength`: 257 `arcLerp`; trivial.
- `warmHiddenChapters` (`journey.js:2121`): synchronous `traverse`, visibility flips and `renderer.initTexture` per group in idle callbacks. It is not tied to the click but may overlap it.
- Class toggles on large subtrees on the path: `.j-arrive` (wrap only). I found none for ordinary clicks.

## 4. Ranked fixes for M1 (aim: one C2 arc; content phase-locked to the camera)

### Fix 1. Move the camera to a C2 ease and re-price the duration
- Where: `camera-blend.js:56-58`. Make `blendPhase` return `blendEase(f)` for all hops (drop the smoothstep branch). `blend.easeSlope` stays 0 on un-overtaken legs.
- Add a `mission>inspire` speed row in `navigation-timing.js` (`NAVIGATION_DIRECTION_SPEED`, line 22). Dur then = `base / speed`.
- Measured replica table (same pace table, same path):

| ease, D | peak u/s | peak gaze deg/s | start accel (u/s^2) | speed reaches 5% of peak at |
|---|---|---|---|---|
| smoothstep 2.667 (shipped) | 13.5 | 64 | 20.8 | 0.05 s |
| smootherstep 2.667 | 16.9 | 79 | 1.4 | 0.18 s |
| smootherstep 3.0 | 15.0 | 70 | 0.7 | 0.20 s |
| smootherstep 3.333 | 13.5 | 64 | 0.3 | 0.22 s |
| smootherstep 3.75 | 12.0 | 56 | 0.3 | 0.25 s |
| septic (C3) 3.333 | 15.8 | 74 | 0 | 0.37 s |

- Expected effect: the same peak speed as today at D=3.333 s (speed 0.36), with zero launch kick and a glide landing. This is the Matrix-ish arc.
- Risk: the move is 0.67 s longer; check the rail, hero-furniture and wordmark timings that read `railFlight.phase`.
- Risk: `ordinaryDepartureOpacity` and copy departure use seconds, so they are unaffected. `stepHeroExit` is phase-based (0.025-0.55 of `e`), so it shifts a little.
- Risk: a one-click-away reversal now shares the same ease as the return leg, which is good.
- Pinned by: `tools/test-no-scroll-navigation.mjs` (`blendEase` shape, durations >= 2.6, the proportionality asserts at `:228-244`). It does not name `mission>inspire` speed. `tools/test-transition.mjs` pins controller behaviour with fixture blends. Browser oracles: `tools/tempo-oracle.mjs`/`tempo-run.mjs` (TL3 dead tail). `tools/test-frame-order.mjs` is not affected.
- Verify: replay H1's capture of speed vs time; compare `a0` and `tOn5`.

### Fix 2. Phase-lock the Inspire content to the last third of the move
- Heading and body copy: `journey/ui/bands.js:78-80`. Today `ARRIVE_S=0.8`, `ARRIVE_LEAD_S=1.3` (arrival ends 0.5 s early), `ARRIVE_MIN_SHARE=0.5`. To land with the camera and fill the last third:
  - `ARRIVE_LEAD_S = ARRIVE_S` (0.8 -> arrival ends exactly at touchdown), or
  - `ARRIVE_LEAD_S = 0.9` and `ARRIVE_S = 1.0` for a gentler last-third entrance.
  - At D=3.333: `arriveStart = max(0.5*3.333, 3.333-0.9, departStart+0.8)` = 2.43 s, ending 3.33 s.
- This is global (all ordinary hops, and the hero furniture reads the same schedule), so the effect is wider than Inspire. Not pinned by name in tools (grep for `navCopySchedule|ARRIVE_LEAD_S` finds only `bands.js`, `copy-arrival.js` and `journey.js`).
- Embers and chips: `copy-arrival.js:150-153`, `FLIGHT_ENVELOPES.standard {onset:0.76, land:0.38}`. `land` is the ceiling on the gate while the camera flies.
  - Embers 2 and 3 need 0.4375 and 0.775 (`chapters/inspire/index.js:~965`). Raising `land` to about 0.8 kindles all three before touchdown. It also moves the gate's final approach.
  - It is shared by Equip, Connect, Owned and Final, whose welcomes are tuned to wait for landing. Add a dedicated lead (for example `flightLead:'inspire'`) in `structure.js:44`, validated against the set at `structure.js:112`. Then give it its own `FLIGHT_ENVELOPES` row.
  - The comment at `chapters/inspire/index.js:~944-955` records that a ceiling over 0.4375 kindles two embers in the air, "a different composition". That is exactly the change the owner asked for, but note the history.
- The chip cadence, `HOTSPOT_ARRIVAL {beatGapMs:540, formMs:700}` (`constants/copy.js:236`), is wall-clock. To put it on camera time, feed the camera's clock (`dt`) into `beatEnvelope` instead of `performance.now()` (`ui.js:1037`, `hotspot-frame.js:370-383`). Smaller win; it only matters under load.
- Pinned by: `tools/test-inspire-welcome.mjs` (surge clock), `test-hotspot-departure.mjs`, `test-equip-arrival.mjs` and `test-connect-arrival.mjs` (their own landing cadence; only matters if Fix 2's `FLIGHT_ENVELOPES` change is shared). Browser: `tools/test-nav-entry-continuity.mjs`.
- Risk: the rail's hero shelf (`copy-arrival.js:~540-570`) and the hero-return entrance share the schedule.

### Fix 3. Make the stall behaviour safer
- `organism/animation.js:67`: raise `0.05` to about `1/15` (0.0667), or clamp only the blend's dt differently, so a single 60-90 ms hitch is absorbed instead of stretching the move. Risk: every animator shares this dt; spores clamp at 0.033, so it is mostly safe, but other consumers that assume <= 50 ms need review. Low expected gain unless H1 shows hitches mid-move.

### Fix 4. Remove avoidable cost around the click
- `ui/hotspot-frame.js:221-229` `measure()`: cache `copyBounds`, `pillW` and `pillH`, and re-measure only when a block's visibility, a chip's text or the viewport changes. This removes the per-frame write-then-read layout. Perf agent O2 owns this; I flag it as the main per-frame layout thrash on the travel path.
- Reduce `placeAt` + final `applyFrame` from 3 frames to the minimum. `tools/test-frame-order.mjs` and `test-transition.mjs` pin the ordering, so this is invasive. Not recommended without a measurement.
- Stagger `warmHiddenChapters` away from the first 10 s after activation (`journey.js:2154` `setTimeout(next, HERO_INTRO_MS)`), or pause it while `transition.blend` is live.

Suggested order: Fix 1 and Fix 2 together (camera ease + content timing). Verify with H1's capture that the heading, embers and chips finish within about 0.2 s of landing. Fix 3 and Fix 4 only if H1 shows hitch-driven drag.

## 5. Open questions / not determined
- I did not render. HYPOTHESES about mid-move GPU hitches (seam arming, first-sight compile, hero-spore to Inspire-plume handover) need H1's frame-time trace for the 0-3 s after the Inspire click.
- The 1.1 s post-landing chip estimate assumes `settled`≈1 and first-chip onset about 2.0 s. H1 should time the `.vis` class on the three Inspire chips against the camera landing frame.
- Skim path length and the portrait fold were not modelled; the table uses desktop aspect 1.6.
- Whether the owner's "jolty" means the launch or the landing needs a call: Fix 1 addresses launch; the landing is already a glide (4.7 -> 1.2 u/s over 0.2 s, then 0).
- Overtaken-click momentum (`easeSlope`) was read but not simulated.
