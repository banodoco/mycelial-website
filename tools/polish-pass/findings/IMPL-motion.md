# IMPL-motion (M1) — branch polish/motion, commit 0c24a1f

## M1 changes
- camera-blend.js:56: blendPhase now always blendEase (quintic); cubic branch removed.
- navigation-timing.js: 'inspire|mission': 0.36 -> 1.2/0.36 = 3.333 s, both directions (symmetric; the reverse already used the quintic).
- ui/bands.js: navCopySchedule/navCopyArrival take an optional `lead`; ARRIVE_WITH_CAMERA_LEAD_S=0.85 (heading ends ~0.05 s before touchdown); introInspireGate(f) = smoothA((f-0.45)/0.55), a pure function of the flight FRACTION.
- ui/copy-arrival.js: new FLIGHT_ENVELOPES.introInspire; used only when id==='inspire' and ticket.fromP<0.2 (arrivals from the Intro side). Other hops, other chapters: unchanged (equip>inspire etc. keep the 0.38 ceiling and 1.3 s lead).
- The 0.38 ceiling reason (inspire/index.js ~979): no second ember kindling in the air / exits off-frame. Honoured by waiting until f>0.45 (camera >=0.5 of the arc; exits in view on the authored arrival pose) and by the gate being a smooth ramp, not a cap raise. Ember 1 starts at f=0.56 (1.86 s), ember 2 at 2.34 s, ember 3 at 2.77 s, complete 3.04 s (0.29 s before touchdown). Needs eye check that ember 1 is on-screen at 1.86 s.
- New oracle tools/test-inspire-arrival-lock.mjs (NOT yet in package.json test:unit: package.json is outside my ownership; add it): asserts dur symmetric ~3.33 s, heading full within 100 ms of touchdown, last ember lit <=250 ms, chips (540/700 ms floors) settled <=350 ms after touchdown (model gives +0.31 s).

## Numbers (node replica, SCRATCH/m1/prof.mjs, 60 fps, aspect 1.6)
| | dur | peak u/s | start accel | end accel |
| before (cubic) | 2.667 | 13.5 | 20.8 u/s2 | -10 |
| after (quintic) | 3.333 | 13.51 @1.67 s | 0.3 | -0.3 |
Max accel after 13.2 (mid-flight) vs 21.1 before. Reverse inspire>mission 3.333 s, peak 13.9 u/s (was 17.4 at 2.667 s). inspire>equip stays 2.600 s (replica).

## Browser capture (640x400, fake clock, load ~33, one run finished)
Intro->Inspire after: camera ends 3248 ms (quintic tail below the stillness threshold; nominal 3333), peak 14.4 u/s at 1680 ms, max accel 15.1, no speed or angular discontinuities, no reversals; one 128 ms low-speed plateau (final settle tail; before: none).
Inspire heading opacity 10/50/90%: 2640/2883/3127 ms (90% = 121 ms before camera end; before: 1523/1767/2010, i.e. 646 ms before end).
Chips (opacity 0.02 -> 0.98): Arca Gidan 1952-2544, 2RP 2496-3072, ArtCompute 3040-3616: last chip settled 368 ms after camera end (before model: ~1.1 s after).
Ember timing not directly observable via DOM; follows chip starts.

## NEEDS-BROWSER-CHECK (serially after merge; reverse and inspire>equip runs were killed by the moratorium)
cd SCRATCH/m1 (copies of harness with inspire-intro added and chip sampling; watchdog 240 s):
node motion-capture.js --url 'http://localhost:PORT/?nointro=1' --out DIR --viewport 960x600 --only intro-inspire,inspire-intro,inspire-equip
(also --mobile once for 390x844). Expect: intro-inspire ~3.3 s, peak ~13.5-14.4 u/s, no discontinuities; inspire-intro ~3.3 s, no discontinuities; inspire-equip 2.6 s unchanged, same peak 11.4 u/s as H1 baseline. Check by eye that ember 1 is visible at ~1.9 s and nothing pops.
Connect note (M2, no edit): ground-light 3.2 s clock (connect/index.js:546) starts ~1 s into the move and ends ~1.5 s after landing.

## Tests
Baseline = after for: lint (16 problems, 7 errors pre-existing), test-rail-handoff fails (20 !== 72) pre-existing and stops `npm run test:unit` there, `npm run cycles` fails (madge unresolved import) pre-existing. Run individually, all other test:unit commands pass; test-no-scroll-navigation, test-transition, test-inspire-welcome pass. No pinned values needed updating (2.6 s floor assertions intact).

## STRUCTURE
Cause: Inspire content ran on several independent clocks: camera phase (ease), a fixed seconds lead for the heading, a phase-capped flight gate, and wall-clock chips (performance.now, ui.js:1037 / hotspot-frame.js:370-381). Now heading and gate are functions of the blend clock (t/dur, ticket.elapsed), so they scale with duration and with dt-clamped slow-mo. Remaining: chip beats still wall-clock (540/700 ms shared by Equip/Connect via constants/copy.js, hotspot-frame.js not mine). Cleaner design: feed the blend-phase/dt into beatEnvelope (hotspot-frame.js) instead of `now`; cost: touches ui.js/hotspot-frame.js and Equip/Connect cadence tests (test-equip-arrival, test-connect-arrival, test-hotspot-*). Recommendation: do it, as chips are the only part that races ahead of the camera under frame drops; I did not because of ownership. frame.transitionPhase unused still: the gate takes t/dur from the ticket clock (same value), which is within my files.
