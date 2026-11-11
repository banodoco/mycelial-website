# Polish-pass measurement kit (NOT shipped; branch polish/tools only)

Scripts written during the Nov 2026 polish pass to make motion and GPU work visible. Nothing imports them.
- harness/motion-capture.js — per-frame camera capture of a section hop under Playwright's fake clock (install + pauseAt + runFor(16)). Camera = window.journey.hero.camera. `--url http://localhost:PORT/?nointro=1 --only intro-inspire,inspire-intro,... --viewport 640x400 [--mobile] --out DIR`. See findings/H1-motion.md.
- harness/lazy-gl.cjs, probe.cjs, restcheck.cjs — count GL uploads (buffers, textures, mipmaps) per hop. On software GL add `&warmdraw=1` or the warm queue's draws are skipped. See findings/IMPL-perf.md, IMPL-warmfix.md, VERIFY-perf.md.
- harness/perf-capture.js (+ perf-analyze.js, perf-summary.js) — real-time per-phase timeline: GL calls, JS ms, long tasks, heap.
- harness/mperf-ascent.cjs, ascent.cjs — uploads during the Manifesto ascent; pose-sim.mjs / o1-*.mjs — node sims of the manifesto camera (take the pose.js path as an argument).
- harness/wrap-log.cjs, wrap-an.cjs, s2-log.cjs — per-frame luminance + uniform log for the Purpose->Intro lap.
- `window.journey.warmReport()` in the page reports warm-queue coverage.
Paths inside the scripts point at the original session's scratch directory and ports; adjust before use.
findings/ holds the investigation and verification reports (LEDGER.md is the index).
