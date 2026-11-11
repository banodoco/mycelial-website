# IMPL-warmfix — the rest-time warm queue now covers everything (branch polish/warmfix, port 8154)

All runs: SwiftShader, real clock, one browser at a time, `?nointro=1&warmdraw=1`, desktop 800x500, phone 390x844 DPR 1.
Harnesses (SCRATCH/warmfix/): `probe.cjs` (GL upload log per phase + which objects/textures the GPU lacks, via three's own
registration, + `journey.warmReport()` per rest), `ascent.cjs` (copy of mperf-ascent.cjs: Purpose rest now RECORDED, and it waits
for the real landing — see F3), `restcheck.cjs`. Raw: SCRATCH/warmfix/out/{before,after}-{desktop,mobile}.{json,log}, ascent-*-after2.json.

## Root causes (measured with a decision log on the old queue, `before-desktop.json`)
1. **Starvation x fragmentation** (FAIL 1, 2). The old queue listed every unit once at activation (journey.js@HEAD:2189,
   `drawUnits` :2212). Purpose came out as **342 units** (a subtree over 1 MB / 160 objects split into its children, recursively, down to
   single small objects), most of them geometry already on the GPU. On this machine (and on any phone whose frame fills its budget)
   `timeRemaining()` is always 0, so the queue ran **one unit per WARM_STARVE_MS = 1.5 s** (:2142, :2354). Log: 45 s at Connect ran
   3 Connect units, 10 card-media tasks, then 12 Purpose units; at the end of the run Purpose still had 320 units pending.
2. **Card-media tasks pre-empted the next stop** (:2358: a chapter-less task ran whenever the nearest chapter was not `here`):
   ~20 fetch jobs x 1.5 s at the first rests.
3. **Owned ranked behind Equip from Connect** (RAIL_ORDER distance, :2184/:2325), but a flight to Purpose DRAWS Owned's root world and
   portraits. The probe shows exactly what landed in Connect->Purpose: Owned's 4 portrait atlases (uMapA/uMapP 2048x512, uMapB 512x512,
   uMapH 4096x1024 — uniform slots of `owned-portraits-16`), 3 Owned sprite/points textures, 5 Owned root-world LineSegments
   (149-463 KB) and 4 Purpose objects (incl. 2.2 MB lines). Final->Owned: an Owned Mesh (71 KB) and a HIDDEN LineSegments (378 KB).
   The uniform-slot walk itself was fine; it never got there. The verifier "could not find it under journey/final" because it lives
   under journey-owned.
4. **No re-scan of objects**: the unit list was a snapshot; only textures were re-checked per rest (:2345), objects built later never.
5. **FAIL 3 (Manifesto)**: two faults. (a) the ascent harness's "30 s Purpose rest" was not a rest: `chapter === 'final'` flips on the
   click frame, so the 30 s ran inside the ~90 s (real time) SwiftShader flight; the queue never got a rest at Purpose and the manual
   prewarm ran mid-flight. (b) colony.js warmDraw (@HEAD:792) forced only its own group visible; mid-flight Purpose's chapter group is
   hidden, so the draw projected nothing and still set `warmed = true`; its report used `info.memory.geometries` delta, which is 0
   both when nothing was drawn and when Purpose's own warm draws had already uploaded everything. The 160 ms "prewarm slice" on desktop:
   with planAerialReveals now chunked, the remaining long slice is the desktop **text fit** (branch.js prewarm -> fitDesktop, one forced
   layout of the shown manifesto page), measured 177 ms here; it used to share a slice with the warm draw.

## Fix (journey.js warm queue ~:2122-2520; colony.js; pose.js; branch.js)
- **Units are found, not listed** (`pick`/`nextUnit`/`drawBatch`): each unit is the next thing the GPU really lacks, asked of the
  renderer: a stale texture (any material slot or uniform, arrays included, version > 0, image present, not tried at this version), else
  the next batch of up to 1 MB / 160 objects of geometry three has not registered (three adds its dispose listener on first projection;
  plus a WeakSet of what the queue drew). An object over 1 MB is a batch alone. Purpose is now ~10 units, not 342.
- **Re-scan**: every chapter re-scanned at every new rest and every WARM_RESCAN_MS (3 s) of rest once drained (cheap timer watches for a
  flight meanwhile). Late images, remix swaps and rebuilt objects are picked up at rest.
- **Warm draw** keeps the separate 1x1 clone of composer.readBuffer and the real Scene; the batch joins WARM_LAYER (30) and the clone
  camera sees only that layer; hidden ancestors, hidden objects and `visible=false` materials are shown, culling off; all restored in
  `finally` (layers mask, visibility, culling, material.visible, target). No pixel a frame reads is touched (frozen-still goldens safe).
- **Priority**: rank 0 here, 2 next stop ahead, 3 one back...; Owned shares Purpose's rail position (RAIL_POS). Chapter tasks rank 2.5
  (after here + next stop), chapter-less tasks (card media) 4.5.
- **Starved pacing**: one slice per WARM_STARVE_MS = 500 ms (was 1.5 s) of at most WARM_STARVE_BUDGET_MS = 6 ms of work (a unit
  always completes; the budget only decides whether another follows). Idle slices as before (timeRemaining >= 6 ms).
- **Tasks**: `registerRestWarmTask(fn, { chapter, repeat })`; Manifesto task is `repeat: true` (asked again at every Purpose rest, as its
  key follows the pose/size); wiring still negates `branch.prewarm` (true = DONE) into the queue's true = call again.
- **QA**: `journey.warmReport()` — atRest, restMs, slices, units, longestUnit, warmed {draws, bytes, textures, textureBytes}, per chapter
  {compiled, scanned, unitsRun, warmed, missing {geometries, bytes, textures, textureBytes}} (a fresh walk; draws/uploads nothing),
  pending tasks, lastSkip (flight / rail/camera disagree / intro / manifesto flight / settling / idle period spent / nothing missing),
  last 40 decisions. colony `warm.report` is now {objects, onGpu, newlyOnGpu}.
- colony.js warmDraw shows hidden ancestors too, `warmed` only when every colony buffer is on the GPU, one try per prepared pose.
- pose.js `aerialRevealJob` (resumable planAerialReveals: camera frames, phone view union in runs of 32, bodies in runs of 32);
  planAerialReveals is now that job run in one go — bit-identical (pinned). colony STAGES use it (JIT warm-up stage removed).
- branch.js prewarm: the slice that did the colony's warm draw returns; the desktop text fit gets its own slice.

## Before / after (per hop: buffers > 64 KB n / MB; textures n / MB; mipmaps; longest task)
| run | hop | before (verifier, after-*.json; my before probe agrees) | after (this branch) |
|---|---|---|---|
| desktop | mission->connect | 0 / 0; 0 tex (verifier route via inspire) | **0 / 0; 0 tex; 0 mips**; 260 ms |
| desktop | connect->final | **13 / 1.70** (3.45 MB total); **14 / 52.53 MB; 7 mips**; 19.8 s task | **0 / 0; 0 tex; 0 mips**; max single upload 50 KB (stream) |
| desktop | final->owned | **3 / 0.38** | **0 / 0; 0; 0** |
| phone | connect->final | **13 / 1.70; 14 / 52.53 MB; 7 mips**; 6.4 s task | **0 / 0; 0; 0** |
| phone | final->owned | **3 / 0.38** | **0 / 0; 0; 0** |
Where the work went: desktop Connect rest 452 uploads, 10.25 MB buffers (35 > 64 KB) + 14 tex calls / 52.53 MB / 7 mips, all within
**26.9 s** of landing (after a 20 s Mission settle that already warmed 0.6 MB); phone: Mission settle (20 s) 8.54 MB + 17.24 MB tex,
Connect rest 2.29 MB + 35.65 MB tex (incl. the 16 MB hover atlas) drained in **5.4 s**. Purpose rest: Manifesto prewarm only (~5 s,
desktop 0 / phone 0 GPU bytes beyond the 690 KB links re-upload at commit). Longest single units (SwiftShader): draw 0.9-5.0 s, the
16 MB hover-atlas upload 1.5 s desktop / ~1.0 s phone — all at rest.

Manifesto ascent (ascent.cjs, `node ascent.cjs <mode> 8154 after2 4 60000`, 60 s recorded Purpose rest after the real landing):
| | before (VERIFY-perf) | after |
|---|---|---|
| phone, uploads >= 100 KB in ascent | 2.93 MB in f134 (517,920 x2, 690,560 x2, 345,280, 172,640) + 2 | **none**; non-stream ascent uploads 0.88 MB (was 6.27 MB), all < 100 KB |
| phone, rest | not recorded | 8.89 MB in 114 uploads (18 >= 100 KB, max 690,560) at rest; colony 34/34 on GPU; prewarm slices 11.9 / 8.7 / 8.3 / 36.5 / 43.1 / 11.1 / 5.2 ms (measured BEFORE the phone view-union split; not re-run) |
| desktop 800x500, uploads >= 100 KB in ascent | 2.44 MB f113 + 3.81 MB f123; 11.57 MB non-stream | **none**; non-stream ascent uploads 2.17 MB, all < 100 KB |
| desktop, rest | not recorded; one 160.6 ms prewarm slice | 8.12 MB in 127 uploads (10 >= 100 KB, max 690,560) at rest; colony 34/34; prewarm slices 11.7 / 8.2 / 9.3 / 7.8 / 3.1 ms, then the text fit alone: 129.5 ms |

## Rest durations used, and realism
Hop probe: 20 s Mission settle, then 45 s at each rest. Ascent: 8 s Mission, 60 s at Purpose after landing. Needed here: Connect drains
in 27 s (desktop) / 5 s (phone, after its Mission settle), Purpose's Manifesto prewarm in ~5 s. Every unit here is starved (timeRemaining
always 0) and a SwiftShader draw costs 1-5 s, so these rests are long only because the machine is; on a GPU a unit is milliseconds and
a starved queue runs 2 slices/s, so the same work takes ~10-20 slices (5-10 s starved, < 1 s idle). No pass depends on an unrealistically
long rest on real hardware; a visitor who flies on within a few seconds of landing simply uploads the remainder on first draw, as before,
and the destination's remainder is first at the next rest (rank 0).

## Tests
- tools/test-rest-warm-queue.mjs rewritten around a three-like fake (registration on projection, layers): W1-W12 incl. new W8 re-scan
  (texture whose image arrives mid-rest, object built after a scan, swapped uniform), W9 uniform/array/material-slot textures, W10 starved
  progress & budget, W11 the negated Manifesto wiring + repeat, W12 warmReport side-effect free. Mutation-checked (Owned rank, rescan,
  uniform arrays, task ranks each go red).
- tools/test-manifesto-motion.mjs: sliced aerialRevealJob == one-call plan (cut after every step and every 3rd, both aspects).
- Results (final code): test-rest-warm-queue W1-W12 passed; test-manifesto-motion pass ("12 warm slices, identical to a cold press");
  test-frame-order 26/26; test-ui-closure 30/30; test-card-warming ALL PASS; test-mobile-manifesto-range pass; test-startup-recovery pass.
  Full `npm run test:unit` / `npm run lint` not run (brief named the set above).
- eslint on touched files: clean.

## What remains / for the owner
- **16 MB hover atlas (uMapH, 4096x1024 + mips)**: now its own rest slice, never in a flight. A single 16 MB canvas upload + mipmap
  generation is likely a long task (tens of ms) on a mid phone. Proposal (not done): on `(hover: none)` devices the hover atlas is
  never looked at — bind uMapP in its place and skip the bake (saves 16 MB upload + ~17 MB VRAM), or bake it at 1x cell on phones; on
  desktop, split into two 2048x1024 halves (shader picks by uv.x) so each slice uploads 8 MB.
- The remix's NEXT hover atlas (`pending.photoHover`, portrait-remix.js prepareRemix) is not in any uniform until the press, so the queue
  cannot see it; it uploads on the first remix frame (an interaction at Owned, not a flight).
- Desktop text fit (branch.js prewarm -> fitDesktop): one ~177 ms slice here (forced layout of the hidden-shown manifesto page on a loaded
  CPU). Now alone in its slice; splitting it would mean a per-iteration resumable fit (fit.js), not done.
- Phone prewarm slices of 36-43 ms were measured before I made the phone view union resumable (pose.js); the phone ascent was not
  re-run after that change (desktop was: all colony slices <= 11.7 ms). The gates/index stage and commit remain single steps.
- Rest frames: the warm draw touches only the separate 1x1 target and restores all object state; not re-verified against goldens here
  (no golden re-shoot per brief).
