# IMPL-pose — M4 / M5 / M6 (journey/manifesto/pose.js + its tests)
Branch polish/pose, worktree /home/user/wt/pose. Files: journey/manifesto/pose.js, tools/test-manifesto-motion.mjs,
tools/test-manifesto-return.mjs, tools/test-mobile-manifesto-range.mjs. return-flight.js unchanged (it needed nothing).
Sims: SCRATCH/harness/pose-sim.mjs `<pose.js> m4|m5|m6|all` (60 Hz steps through the shipped functions; Purpose rests from O1).
Before = main checkout (same commit), after = worktree: SCRATCH/harness/pose-before.txt, pose-after.txt.
Delegation note: this agent has no Agent/subagent tool, so the orchestrator's "use Haiku subagents" update could not be applied; all work done directly.

## M5 — sentence pause halved
- pose.js:56-62 `LINE_BREATH_SECONDS 1.6→1.2`, `LINE_SECONDS_PER_WORD 0.14→0.125` (now exported so tests import them instead of copying).
- Starts 2/8.78/17.66/26.4/33.04 → 2/7.83/15.53/23.1/28.8. T (CAMERA_SECONDS) 37.58 → 33.34 s.
- Dead gap (last word readable → next ink) 1.92/2.37/2.34/1.89 → 0.97/1.19/1.17/0.95 s (first gap: my sim uses count-1 beats, CONTENT has no note).
- frameShiftAt (pose.js ~117-125): the 8.5/5/19 s windows are now fractions of T (8.5/37.58 etc.), so they scale with any future rhythm change.
- Everything else follows from CAMERA_SECONDS automatically (spiral, ascentAt, planAerialReveals clockScale, colony nearBodies, phone admit
  schedule, branch arrivePhase/link times). No duplicate constants found in branch.js/colony.js.
- Final hold kept at +3 s: camera speed at T-3/T-2/T-1/T-0.5 = 0.49/0.22/0.06/0.01 u/s desktop, 0.47/0.28/0.09/0.02 phone. It still lands.
- NOT mine, report: journey/manifesto/entry-flight.js:7 `ENTRY_JOIN_SECONDS = 8.5` is an absolute join time into the ascent (22.6% → 25.5% of
  the flight now). test-manifesto-entry passes; consider expressing it as a fraction of CAMERA_SECONDS.
- Side effect on phone reading follow (branch.js FOLLOW_SECONDS 2.8, owned by mperf): the scroll lead now starts ~1 s before ink, not ~1.9 s, so
  it has covered ~36 px (not >70) when ink starts; it keeps moving through the ink. Test relaxed (see Tests). If the owner wants the scroll to
  finish before ink, shorten FOLLOW_SECONDS in branch.js (mperf).

## M4 — desktop return jolt (and phone, measured)
- pose.js descentU (~171-200): the inverted key is now `0.5·actualHeight/total + 0.5·progress`, with one shared code path: desktop
  progress = s/T and height = desktopHeightAbove (8-unit lift included; new helper, also used by manifestoPose so the two cannot diverge);
  phone progress = its tilt, height = mobileHeightAbove. Monotone, so exact landing is preserved.
- Desktop, 60 Hz (peak speed u/s / peak |dv/dt| u/s² / frames re-accelerating in last 1 s):

| start u | before | after |
|---|---|---|
| 0.1 | 16.0 / 39 / 21 | 13.2 / 21 / 0 |
| 0.36 | 62.0 / 774 / 20 | 41.8 / 177 / 0 |
| 0.5 | 108.6 / 2003 / 21 | 72.1 / 473 / 0 |
| 0.75 | 136.8 / 2894 / 22 | 92.1 / 763 / 0 |
| 1.0 | 126.3 / 2247 / 17 | 94.2 / 792 / 0 |

  End second from u=1 (speed/pitch-rate every 0.1 s): before 14.0/33 15.9/39 17.3/45 17.8/50 17.0/51 14.8/47 11.7/38 7.8/26 4.0/13 1.1/4 0;
  after 17.5/51 14.6/45 11.6/37 8.6/28 5.7/19 3.2/11 1.2/4 0.2/0.7 0 0 0 — monotone deceleration, turn rate decays to 0, last ~0.25 s is a hold.
  Peak pitch rate ≈ unchanged (51-68 → 37-63 °/s) but it now happens mid-descent, not in the final second. Landing exact for every start.
- Phone: my M6 curve made the old height-only key worse (tilt outlasts rise → 280-340 °/s pitch spike), hence the tilt share. Final phone vs
  before: peak speed 15.9-19.8 → 16.5-20.5 u/s, peak accel 20-536 → 23-468, peak turn 52-63 → 45-54 °/s, no re-acceleration (both).

## M6 — phone pull-back from the first moment, with orbit
pose.js:35-53 constants, ~105-125 easing helpers, ~207-215 laws, mobilePose. Curve (end pose unchanged except azimuth):
- rise 16 u: `swing(s, 0.6, 3.5)`; tilt to overhead + x/z glide to fieldCenter + lens 53.5→46 + bank: `swing(s, 0.6, 5.5)`
  (MOBILE_LIFT_SECONDS 5→5.5). swing = velocity gathered by a smoothstep over 0.6 s, then 12x(1-x)² (peak at 1/3, C2, soft landing).
- climb (38-y0-16): `cruise(s, 2.5, 0.12·T, T)` — C2 trapezoid, even rate, settles over the last 12%. Phone ascentAt (navigation dot) is now this
  same law (was smoother(s/T)).
- heading: `h0 + 45°·cruise(s, 0.6, 0.12·T, T)` — the old 25° plus 20° more, turning at an even ~1.45°/s from 0.6 s to the settle.
- Deviation from brief: lens tied to the tilt, not the rise. Tied to the rise the hero grew 9.6% before shrinking; to the tilt, 5.2%.

| t (s) | 0.25 | 0.5 | 1 | 2 | 3 | 5 | 8 | 15 | 25 | T-1 |
|---|---|---|---|---|---|---|---|---|---|---|
| before px/s | 8.7 | 32.4 | 102 | 186 | 82 | 2.1 | 4.5 | 6.6 | 4.6 | 0.1 |
| after px/s | 9.1 | 53.8 | 110 | 95 | 172 | 14.1 | 8.9 | 7.7 | 7.5 | 1.2 |
| before hero px/u | 53.6 | 54.0 | 56.7 | 68.7 | 67.0 | 53.5 | 51.3 | 42.2 | 31.6 | 28.4 |
| after hero px/u | 53.6 | 53.8 | 55.7 | 53.7 | 49.4 | 48.9 | 45.2 | 38.4 | 31.6 | 28.4 |

- Hero max growth 32.7% → 5.2% (peak 1.25 s, shrinking from 1.5 s; one 0.6% re-zoom 3.5-4 s as the lens finishes). Zoom-out per second after 4 s:
  2.7 → 1.6 %/s, monotone (before: +36% zoom-in at 2-3 s, then 1.1-3.3%). Max |d(px/s)/dt| 599 → 561 px/s². End y=38, x/z=fieldCenter, fov 46,
  heading +45° (was +25°).
- Target NOT met: "never below ~12 px/s until the settle". Cruise is 7.5-9 px/s (before 2-7). Arithmetic: overhead, the motion is zoom
  (2%/s × mean 240 px radius ≈ 5 px/s) plus orbit (45°/31 s ≈ 0.025 rad/s × 240 ≈ 6 px/s) ≈ 8 px/s. 12 px/s would need ≈80-90° of total orbit.
  Owner choice: raise the `20` in MOBILE_OVERHEAD_TURN (pose.js:53). Also the tilt's end (4→5.25 s) decays from 84 to 9 px/s, smooth (C2) but
  it is where the big move hands over to the cruise.
- Start: 9 px/s at 0.25, 54 at 0.5 (gather 0.6 s), no lurch; O1's 0.86% of tilt at 0.5 s is now ~1%; rise and orbit carry the start.
- Composition: test-mobile-manifesto-range (y=38, x/z, straight down) holds unchanged. Phone scheduled colony bodies 77 → 58 (shorter, rotated
  flight frustum; test bound >30). Final frame checked in the browser shots below.

## Tests (pins changed only where they pinned the asked-for behaviour)
- test-manifesto-motion.mjs: gap literal `1.6+.14` → imported constants + one explicit pin of [1.2, .125] (tolerance .001→.01: two 2-dp roundings);
  phone heading "holds after lift" → "keeps turning from 0.6 s to 0.88·T, never overshoots, finishes the full MOBILE_OVERHEAD_TURN at T";
  phone descent "height == initial·(1-eased)" → monotone + final tenth ≤1.5% of height; mobile reading lead: `>70 px before ink` → `>30`
  (M5 halves the lead time), and the "next reveal moves into view" check now samples at admit+2.02 s (the follow's own clock; same instant as before).
- test-manifesto-return.mjs: phone final-tenth bound 1% → 1.5% (measured 0.96-1.32%); desktop "original inverse unchanged" block replaced by a
  60 Hz desktop+phone test from both Purpose rests, starts .1/.36/.5/.75/1: speed < 100 (desk) / 25 (phone) u/s, |dv/dt| < 1000 / 600,
  monotone deceleration and decaying turn rate over the last second, exact landing. Verified it FAILS on the old pose.js.
- test-mobile-manifesto-range.mjs: exact old inverse → monotone + lands at 0; `ascentAt == smoother(s/T)` → ascentAt monotone and equal to
  the camera's climb fraction after the rise.

## Verification
- Pose tests: test-manifesto-motion, -return, test-mobile-manifesto-range, test-manifesto-entry all pass.
- `npm run lint`: 16 problems (7 errors) — identical at HEAD (clean copy SCRATCH/pose-base): portraits.js, flowers.js, test-inspire-departure.mjs.
  My files lint clean.
- `npm run cycles`: "No circular dependency found" but rc 1 for 15 unresolved files — identical at HEAD.
- `npm run test:unit`: stops at tools/test-rail-handoff.mjs:145 ("mobile Final ... stronger independent lift", 20 !== 72) — fails identically at
  HEAD. The rest of the chain run individually: structure/scroll-touch/no-scroll-nav passed before it; hotspot-departure and manifesto-motion pass.
- test-manifesto-scroll-overflow (browser): passes on this branch. Its HEAD baseline run crashed ('browser has been closed'), which was machine load.
- Browser sanity (390x844, fake clock, port 8144): partial. I stopped it under the orchestrator's browser moratorium. Purpose loaded at p=0.97,
  `flyTo('manifesto')` opened the branch, and it stepped to t=5 s with 0 page/console errors. I looked at the shots in SCRATCH/captures/IMPL-pose/
  (00-purpose, 01-t0.5, 02-t2, 03-t5). At 0.5 s the frame barely differs from Purpose: the 0.6 s gather is still going and the copy fade has not started.
  At 2 s the camera has risen and tilted, the Purpose copy is gone and the cluster has receded. At 5 s it is near overhead, the hero is smaller than at
  Purpose and sentence 1 is inking at y≈300, clear of the hero.
  The end of the flight, the final phone frame and the Return were NOT reached in the browser (see NEEDS-BROWSER-CHECK).

## NEEDS-BROWSER-CHECK
- `cd SCRATCH/harness && PORT=<port> NODE_PATH=$(npm root -g) node pose-browser.cjs` (390x844 phone, fake clock, fastForward in 0.2 s steps,
  CDP screenshots to SCRATCH/captures/IMPL-pose/, writes run.json). It opens #/final, then flyTo('manifesto'), shoots at 0.5/2/5/12/24/34.5 s,
  then flyTo('final') and shoots at +2.4 s and +5.5 s. Expect: 0 errors; `open:true` until the return lands, then `open:false`, chapter final;
  06-end shows a straight-down view rotated about 20° further than today's end frame, with the cluster centred and clear of the reading
  column; 08-landed is identical to 00-purpose. At ~7 s per rendered frame on this machine the full run is ~250 frames.
- Desktop (1440x900) Return from the settled top: by eye, no sideways whip ~2 s into the return, and a calm stop.

## STRUCTURE
- Predicates: in pose.js I used only `isMobileManifesto`, and changed planAerialReveals' `aspect < 0.9` (reading-column scoring) to that
  predicate's `phone`. Divergent checks I did not touch (not my files): `w <= 720` in fit.js:9 and branch.js:570-571,632,638; `aspect < 0.9` in
  colony.js:679. Result: an 820x1180 portrait tablet gets the phone camera with the desktop font-fit and no scroll-reading. The fix is for
  these to import `isMobileManifesto`, or better, `bandOf` (O3 §C).
- Fixed here: (1) descent pacing was two divergent branches (phone: full height; desktop: ascentAt only, missing its own lift). It is now ONE
  law in descentU, `0.5·raised/total + 0.5·progress`, parameterised by `climbProfile(aspect)` (no third branch), and desktop height lives in one helper shared by the pose and
  the inverse. (2) frameShiftAt windows were absolute seconds — now fractions of T. (3) tests copied the rhythm literals — now imported.
- Remaining: the desktop curve still mixes absolute-second envelopes (lift s/3, ascent s/10, field s/4.5, atmosphere s/8) with T-relative ones,
  and entry-flight's ENTRY_JOIN_SECONDS = 8.5 is absolute. Cleaner: a single flight-time map where only the opening gesture (first ~3 s,
  deliberately press-anchored) is absolute and every later window is a fraction of T. Cost: small code, but it changes the desktop ascent
  shape when T changes, so it needs a fresh desktop look; I left the opening ones alone (they are about the press, not the length).
- The phone descent still replays the climb (inverted) rather than flying its own path; return-flight.js already has a proper eased flight
  (used for away-descents). Routing the plain Return through createReturnFlight too would remove descentU entirely; risk: medium (field
  reveal/seat light are keyed to u), not attempted.

## Owner should check by eye
- Desktop return from the top: the whip at ~2 s is gone; the last ~0.25 s is now a hold rather than a stop-on-arrival.
- Phone opening: is 5% hero growth at ~1.2 s acceptable; is the 45° orbit enough or should it be more (see 12 px/s note).

Commit 'Manifesto: halve sentence pause, ...' on polish/pose. Per IMPL-COMMON (no model names), the Co-Authored-By line reads 'Claude'.
