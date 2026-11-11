# Mycelial site polish — issue ledger (owner: orchestrator)

Sections in order: INTRO -> INSPIRE -> EQUIP -> CONNECT -> PURPOSE (a.k.a. final/owned) -> MANIFESTO (opened from Purpose).

| ID | Issue (user's words, condensed) | Kind |
|----|----|----|
| M1 | Entering INSPIRE: animation slightly jolty / "drag"; want Matrix-like slow smooth camera arc, and Inspire copy/motion timed to arrive WITH the camera | motion |
| M2 | EQUIP -> CONNECT feels maybe too long (user: "probably fine") — measure, only change if clearly off | motion |
| M3 | PURPOSE -> INTRO (wrap back to first): sudden lighting change. Forward direction handles it nicely | motion/lighting |
| M4 | MANIFESTO -> PURPOSE: jolty move at the very end of the return | motion |
| M5 | MANIFESTO: pause between sentences too long — roughly halve | timing |
| M6 | MOBILE MANIFESTO: camera pull-back not apparent in first few seconds; combine zoom with rotation so motion reads immediately | motion |
| P1 | Stutter on load (inconsistent) | perf |
| P2 | Stutter moving between sections (Inspire <-> Equip and back) | perf |
| P3 | Stutter near top of MANIFESTO (scene size? distant mushrooms; maybe fade detail/LOD as you ascend), esp. mobile | perf |
| P4 | Stutter when camera "takes off" (manifesto start) | perf |
| P5 | MOBILE: CONNECT -> PURPOSE perf issues | perf |
| U1 | Sidebar/menu panel: top line "We're working to help the open source AI art ecosystem thrive" should read as the opening of a manifesto-like sentence; bigger, commands more attention. Same for bottom "The open source ecosystem can accelerate a second renaissance". Whole panel should read almost as a manifesto (e.g. "by inspiring:" ...). Listed items themselves probably fine | typography/copy |
| U2 | "open models" and "open tools" should underline on hover | ui |
| U3 | MOBILE intro (on load): bottom nav sits too high relative to top bar's distance from top; centered text feels too close to bottom. Bottom nav should mirror top nav's edge distance | layout |

## Adjudication and fix plan (after investigation)

| ID | Root cause (confidence) | Decision | Package / model |
|----|----|----|----|
| M1 | Only hop on cubic ease: launch accel 21 vs 1.4 u/s2 (measured in browser + replica). Content not phase-locked: embers/chips finish ~1 s after landing (code + replica) | Quintic ease, ~3.3 s, content lands with camera | motion / Sonnet |
| M2 | Camera 2.72 s, not an outlier. Connect ground-light is a separate 3.2 s clock ending ~1.5 s after landing | No change (owner: "probably fine"); note only | - |
| M3 | No single-frame step. Intro ground web relights 3.6x in 0.8 s mid-lap on the retire clock, unmasked (hypothesis, filmstrip agrees) | Relight over last ~40% of lap, finish at landing | wrap / Sonnet |
| M4 | Desktop descent paced by height only: sideways whip 126 u/s + end re-acceleration (sim) | Blend height with time, as phones already do | pose / Opus |
| M5 | Pause = 1.6 + 0.14 x words -> 1.8-2.4 s gaps | 1.2 + 0.125 x words -> 0.9-1.2 s | pose / Opus |
| M6 | Phone camera moves toward cluster for 5 s, then crawls 2-7 px/s (sim) | Rise leads, orbit throughout, +~20 deg orbit | pose / Opus |
| P1 | Boot race: journey not ready in 1.5 s -> chapter builds on settled hero; 6 MB card prefetch at +1.5 s (code) | Defer prefetch, yield between builds | perf / Opus |
| P2 | Idle warm pass uploads 26 MB textures (one 4096x1024) mid first hop (measured); per-frame forced layout (code) | Warm pass yields to flights; cache layout reads | perf / Opus |
| P3 | Mid-ascent buffer uploads (measured); TAA runs at ~0 weight; blurred word animations; ~310 draws/frame (measured, phone) | Zero uploads in ascent; skip TAA; compositor-only text; size-based detail fade | mperf / Opus |
| P4 | Click frame: sync colony prepare 26-49 ms + 12 layouts + first upload 3.2 MB (code + node timing) | Prewarm at Purpose rest | mperf / Opus (+wiring) |
| P5 | Purpose geometry first uploaded mid-flight, ~4 MB (measured) | Hidden warm draw per chapter | perf / Opus |
| U1 | Desktop thesis lines 17 px vs 23 px on phones | ~26 px, full cream, copy unchanged | ui / Haiku |
| U2 | Phrase is non-interactive manifesto text (pointer-events none) | Match other concept phrases' hover | mperf / Opus |
| U3 | Intro rail centre 114 px from bottom vs 70 px in chapters; top bar centre 43 px | Intro rail uses in-chapter position on phones; check intro text centring | ui / Haiku |

Worktrees: /home/user/wt/{ui,motion,wrap,pose,mperf,perf}, branches polish/*, ports 8141-8146. Merge -> polish/all, wire NEEDS-WIRING, runtime:build + static regen once, re-run harnesses.
Cannot do here: golden capture gate (macOS Chrome), real fps on owner's hardware.

## Integration (polish/all in /home/user/wt/all, server :8150; untouched baseline /home/user/mycelial-website on :8137)
All six branches merged cleanly + wiring commit. Owner decisions pending: U3 seat 70 vs 54; M6 orbit 45 vs ~85 deg; card prefetch deferral (re-base 2 move-proof tests); U2 all phrases vs one; word entrance lost gold flush/blur-in.
Not done: P3 LOD (bodies still 54-94 px at top; real saving = per-tier draw merge, 1-2 days); single applyFrame; portrait bakes at rest.
