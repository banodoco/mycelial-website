# IMPL-cards (branch polish/cards, commit see git log -1)

## Change
- journey/cards/index.js: `startCardWarming({enqueue})` mode (21 jobs: fonts, then 20 fetches `{priority:'low'}`), import-time self-start removed. Timer cascade kept as default when no `enqueue`.
- journey/journey.js: import + `startCardWarming({ enqueue: (job) => registerRestWarmTask(() => { job(); return false; }) })` in warmHiddenChapters.

## Checks
(a) Importers: ui.js, rail.js, popover-tier.js, registry/builders only use CARD_ICONS/CARD_BUILDERS/CARD_ASSETS; none relied on the self-start. Only startCardWarming caller was the self-start itself. No static/ or root HTML/main.js references cards/index. Hero-only / no-journey paths simply never warm (no regression of function, only of prefetch).
(b) Never-rest: media loads on demand when a card is built: ados.js:65,75,84,107 (poster/preview src), arca.js:68 (video src on hover),:87 (posters), artcompute.js:80, hivemind.js:173. Warming is purely a cache primer; no fallback added. Note the queue also waits for rest, so a continuously scrolling user gets on-demand loads only.
(c) Spread: each job is its own queue task; queue runs one task per slice (journey.js ~2353), only at rest and idle.
(d) saveData: original code had no saveData/connection check (grep: none in journey/cards). Not regressed, not added. Suggest owner consider skipping heavy .mp4 warm when navigator.connection.saveData (not done).

## Pins re-based
- test-card-warming Part C rewritten to the new contract (import with document schedules nothing; enqueue = 21 jobs, no timers, low priority, same order, cancel no-ops). Removed the git-show/RUN_START_SHA machinery (it could not run in the shallow clone; contract it pinned no longer exists).
- test-card-icons / test-card-registry: shipped `selfStartDelays` [] ; fixture side PRE_SELF_START_DELAYS [1500]. Fixtures NOT edited. New tools/fixtures/p1-card-warming-deferral.edits.json (generated from git diff HEAD~) is reverse-applied (each edit must occur exactly once) before the existing U01b/U01c reverse-application, so byte-exact proof still holds. No git object needed; no fetch done.
- test-rest-warm-queue: harness injects startCardWarming; W7 asserts one registration via enqueue, no job in flight, all 3 stub jobs run after rest.
- CONTRIBUTING.md (lines ~69-70) says re-baselining a pin in the same commit is a "conversion order"; done here per explicit owner approval, mitigated by keeping fixtures pristine and recording edits.

## Results (before -> after)
card-warming 1 -> 0 (Part C was failing on absent sha); card-icons 0 -> 0; card-registry 0 -> 0; rest-warm-queue 0 -> 0 (W1-W7); ui-closure 0 -> 0.
Still failing, identical output before/after (pre-existing): test-frame-publication, test-gate-composition, test-page-lifetime, test-render-baseline (all import/mention cards/index only incidentally).
eslint journey/cards/index.js journey/journey.js: clean (0 problems). Repo-wide eslint of touched files: 0 errors, 7 warnings (pre-existing/unrelated).
npm run cycles: exit 1 before and after, output identical apart from timing (0 new unresolved).
Not done: browser verification; saveData; runtime:build; no push.
