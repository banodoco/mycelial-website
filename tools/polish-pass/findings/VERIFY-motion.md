# VERIFY-motion: browser and sim verification of the M1/M3/M4/M6 fixes

Outputs: SCRATCH/captures/VERIFY-motion/{A,B,B2,B-base,C,D,E}. Scripts: SCRATCH/verify/ and SCRATCH/harness/.
Servers: BASELINE http://localhost:8137 (old code), MERGED http://localhost:8150 (fixed code). Fake clock, 16 ms steps.
Load during runs: 4 to 18 (other agent's browser also running). Only one browser of mine at a time.

## Status table

| Check | Status | Key numbers (measured vs expected) |
|---|---|---|
| A  M1 intro to inspire, MERGED, 640x400 | PASS | camera end 3248 ms (exp ~3.3 s); peak 14.39 u/s @1680 ms (exp 13.5-14.4, top edge); max accel 15.1; 0 speed or angular discontinuities; 0 reversals. Plateau is a monotone tail, not a pause (see A). Heading 10/50/90% at 2640/2883/3127 ms; last chip settles +368 ms after camera stop. Ember kindle not observable in DOM. |
| B1 M1 inspire to intro (reverse), MERGED, 640x400 | FAIL | duration 2688 ms (exp ~3.3 s); peak 14.79 u/s @1680 ms; ONE discontinuity: speed 3.93 to 2.66 to 0.36 to 0.03 u/s over 3 frames at 2848-2880 ms, accel -144 u/s2, angular rate 15 to 1.4 deg/s. Camera hard-stops. |
| B1 baseline (same run, for comparison) | recorded | duration 2176 ms; peak 18.48 u/s @1344; accel -214; same hard stop (4.70 to 1.28 to 0.09 u/s). |
| B2 M1 inspire to equip, MERGED, 640x400 | PASS | 2496 ms; peak 11.40 u/s @1328 (baseline H1: 2496 ms, 11.4 @1328); 0 discontinuities; 0 reversals. |
| C  M3 purpose to intro wrap, MERGED, 480x300 | FAIL (2 of 6 criteria) | web 10-90% = 1552 ms (f204 to f301), exp >=1.8 s; baseline 768 ms (f117 to f165). Web end 0.95 (PASS). Relit at f207 = 0.12 (PASS, <1/3; baseline 1.0). Mote flip at opacity 0.004 (PASS; baseline 0.093). Max per-frame luma delta 1.71 @f62 (exp <=~1.5, FAIL marginal; baseline 1.32 @f62, pre-lap frame). Start luma 73.8 (PASS, 74), rest 46.5 (PASS, 47). Luma valley deeper: 22.1 @f223 (baseline 29.8 @f216). |
| D  M4 desktop return, sim (browser NOT run) | PASS (sim) | Peak speed (u/s) at starts 0.1/0.36/0.5/0.75/1: before 16.0/62.0/108.6/136.8/126.3, after 13.2/41.8/72.1/92.1/94.2. Peak |dv/dt|: before 39/774/2003/2894/2247, after 21/177/473/763/792. Frames re-accelerating in last second: before 17-22 each, after 0 (one angle frame at u=0.1 and u=1). Last-second speed monotone decay for every start. |
| E  M6 phone manifesto start, MERGED, 390x844 touch | PARTIAL | Camera moves from frame 1: 0.5 s 3.13 u/s; 1 s 8.84 (rot 10.6 deg/s); 1.5 s peak 10.32; 2 s 9.15 (rot 15.7 deg/s); 3.5 s 3.45; 5 s 0.41; 8 s 0.23 (rot 1.4 deg/s). Monotone decay after peak; no re-acceleration in last 200 frames. Canvas frames at 0,1,2,3.5,5,8 s NOT captured (page.screenshot timed out 16 times). Final flight frame at ~33 s NOT RUN. No pageerror or console errors in the log. |

## Command and run details

- **A**: `cd SCRATCH/m1 && node motion-capture.js --url 'http://localhost:8150/?nointro=1' --viewport 640x400 --only intro-inspire --out .../VERIFY-motion/A`. 288 frames, 179 s wall.
- **B1 (merged)**: same harness with `--only inspire-intro,inspire-equip`. inspire-intro finished (281 frames, 328 s wall). The process then hit my 590 s limit during inspire-equip, so B2 was rerun alone.
- **B2 (merged)**: `--only inspire-equip --viewport 640x400`. 242 frames, 289 s wall.
- **B1 (baseline)**: `--url 'http://localhost:8137/?nointro=1' --only inspire-intro --viewport 640x400`. 242 frames, 297 s wall.
- **C (merged)**: `SCRATCH/verify/wrap-log-v.cjs` (copy of wrap-log.cjs, port from env PORT=8150, runFor(16) instead of 16.667), `final mission 345 merged`. 345 frames plus boot, roughly 20 to 25 min wall under load. Analyzer: `SCRATCH/verify/wrap-an-v.cjs`. Baseline recs and contact frames are the existing SCRATCH/captures/IMPL-wrap/before-* files (recorded at 16.667 ms steps, so frame indices are not exactly 1:1; I compared in time).
- **D**: `node SCRATCH/harness/pose-sim.mjs <checkout>/journey/manifesto/pose.js m4`, for /home/user/mycelial-website (baseline) and /home/user/wt/all (merged). Output in captures/VERIFY-motion/D/. Browser run not attempted: the manifesto flight is about 33 s, about 2000 frames at 1.5-2 s each.
- **E**: `node motion-capture.js --mobile --url 'http://localhost:8150/?nointro=1' --only purpose-manifesto --filmstrip 30 --out .../E`. 481 frames, 1388 s wall (killed at the 25 min limit during teardown, after the recording had been written). Screenshots all timed out, so no canvas frames exist.

## Contact sheets (C)

- `captures/VERIFY-motion/C/contact-merged-f064-f328.png` and `contact-before-f064-f328.png`: 16 frames each (f064, 080, 096, 112, 128, 144, 160, 176, 192, 200, 208, 216, 240, 280, 320, 328).
- Looking at them: the colony and mushrooms fade out in the same way in both runs. The difference is the ground web. In MERGED it stays dark and dim through f192 to f216, while the mushroom is still lit, and it relights only from about f240 to f280. In the baseline the web is already bright orange by f192 to f208. So MERGED has a longer, darker mid-lap, which matches the IMPL's noted risk ("darker for about 1 s longer"). Whether that is too dark is a judgement for the owner's eye.

## Findings in detail

### A (PASS)
- Speed tail in the last 600 ms before camera stop (rel_ms 2640 to 3248): 6.35 falling to 0.18 u/s, with no local minimum and no increase step. The "plateau" flagged by the run is 16 ms + 112 ms at the tail, where speed runs 0.237, 0.183, 0.112, 0.084, 0.043, 0.014, 0. This is the monotone decay of the ease under the 2% threshold. It is not a pause-then-move, so it is not a defect.
- Heading (`.j-block` opacity), relative to action start: 10% 2640 ms, 50% 2883 ms, 90% 3127 ms. Relative to camera stop (3248 ms): -608, -365, -121 ms.
- Chips (`.j-hot`): Arca Gidan starts 1952 ms and settles 2544; 2RP starts 2496 and settles 3072; ArtCompute starts 3040 and settles 3616. Last settle is +368 ms after camera stop (IMPL recorded baseline ~1.1 s after).
- Ember kindle times: not observable in the DOM, so NOT MEASURED. The IMPL schedule (ember 1 at 1.86 s, complete 3.04 s) is unverified.

### B1 (FAIL)
- The reverse move on MERGED is still short (2.69 s vs the 3.33 s the IMPL replica predicted) and still ends with a hard stop. The stop is the same kind as the baseline's, but the numbers changed: peak 18.5 to 14.8, max accel 214 to 144, duration 2.18 to 2.69 s.
- The defect is in the camera path, not the timing harness: `raf_fires` is 1 on every frame, and the stop is a 3-frame speed drop with a 15 to 1.4 deg/s angular drop.
- Root cause not investigated (no edits allowed). Hypothesis: the reverse flight finishes its ticket with the ease still moving, then the camera is snapped to rest. The IMPL claim that the reverse runs 3.333 s is not borne out in the browser.

### B2 (PASS)
- Matches the baseline H1 numbers exactly (2496 ms, 11.40 u/s at 1328).

### C (FAIL on 2 criteria, 1 marginal)
- 10-90% web window: 1552 ms vs >=1.8 s expected. It moved from 768 ms (baseline) to 1552 ms, so it is roughly 2x, but it does not reach the target. The IMPL predicted about 1.84 s.
- Web starts at f204 (exp ~f195-200).
- Max mean-luma delta 1.71 @f62. This is before the lap window, and the baseline has its max at the same frame (1.32). It is outside the relight window, so the change is not from the wrap fix, but it is over the threshold, so it is reported as a miss.
- Final group hidden at f207 in both runs, as before.

### D (sim only)
- Last-second speed profiles (u/s per 0.1 s) for every start in MERGED are monotone decay to 0. Example u=1: 17.5, 14.6, 11.6, 8.6, 5.7, 3.2, 1.2, 0.2, 0, 0.
- Phone: peak speed 15.9-19.8 to 16.5-20.5 u/s; peak accel 20-536 to 23-468; no re-acceleration in either.

### E (partial)
- Phone speed is a world-unit measure, not screen px. The IMPL sim's px/s figures correspond to roughly 45-55 px per unit, so 0.23 u/s at 8 s is about 10 px/s, consistent with the sim's 8.9 px/s.
- The "plateau" flagged by the summary is at 208-240 ms, which is the launch gather from rest (0.10, 0.14, 0.19 u/s). It is not a mid-flight pause.
- Motion is visible in the first 3.5 s (speed 3 to 10 u/s, rotation 10 to 16 deg/s). After about 5 s the camera nearly stops (0.2 to 0.4 u/s, rotation under 2 deg/s). The IMPL noted this would be a slow cruise, so the owner should check whether that is the intended feel.

## Surprising / open items
1. B1: the reverse Inspire to Intro move is short and still hard-stops in MERGED. The IMPL's "3.333 s both directions" claim is contradicted by the browser.
2. C: the wrap relight window is 1.55 s, not 1.8 s. The lap is darker for longer, as the IMPL warned.
3. E: no canvas frames exist. page.screenshot hangs under the paused clock, so the harness's screenshot path does not work here. The fix is to grab `canvas.toDataURL()` in-page right after each runFor, as the brief suggested; not done in this pass.
4. Not done: final phone frame at about 33 s (about 2000 frames, not feasible); D in browser.
5. Load: other agent's browser ran alongside; the first B run hit my 590 s limit during the second transition, so that transition was rerun alone.
