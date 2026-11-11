# QA: per-test status, BASE vs MERGED

- BASE: `/home/user/mycelial-website`, commit `6835391` ("Restore Flowers canvas safely on return and use still stack preview on mobile").
- MERGED: `/home/user/wt/all`, branch `polish/all`, commit `02b5acf`. Merge-base with BASE is `6835391`.
- Method: each item run on its own with `timeout 150 node <file>` (lint: `timeout 600 npm run lint`; cycles and runtime:check: `timeout 150`). BASE ran to completion first, then MERGED; at most 2 items at a time. Logs: `/tmp/claude-0/-home-user/62a00d20-ec8d-551d-aa8b-33233b07a42e/scratchpad/qa/base/` and `/tmp/claude-0/-home-user/62a00d20-ec8d-551d-aa8b-33233b07a42e/scratchpad/qa/merged/`, one file per item, plus `_results.tsv` in each folder (exit code, seconds, item).
- Status: PASS = exit 0; FAIL = non-zero exit; TIMEOUT = killed by `timeout` (exit 124); NEW = exists only in MERGED.
- Not run: `runtime:build`, `rebuild`, `release`, `capture` (write or build), and python tests (`tools/test-gate-*.py`).

## Counts

| Checkout | Entries | PASS | FAIL | TIMEOUT | NEW |
|---|---|---|---|---|---|
| BASE | 131 test files + 3 npm scripts | 84 | 47 | 3 | 0 |
| MERGED | 133 test files + 3 npm scripts | 85 | 48 | 3 | 2 |

Test files only: BASE 83 PASS / 45 FAIL / 3 TIMEOUT (of 131); MERGED 85 PASS / 45 FAIL / 3 TIMEOUT (of 133, including 2 NEW tests, which both PASS).
npm scripts: BASE 1 PASS / 2 FAIL (cycles, lint); MERGED 0 PASS / 3 FAIL (cycles, runtime:check, lint).

## Per-item table

| Item | BASE | MERGED | BASE exit (s) | MERGED exit (s) |
|---|---|---|---|---|
| `tests/deck-copy-surfaces.test.mjs` | PASS | PASS | 0 (0) | 0 (1) |
| `journey/structure.test.mjs` | PASS | PASS | 0 (0) | 0 (1) |
| `tests/deck-flowers-return.test.mjs` | PASS | PASS | 0 (0) | 0 (0) |
| `tests/deck-scene-resilience.test.mjs` | PASS | PASS | 0 (0) | 0 (1) |
| `tests/deck-story.test.mjs` | PASS | PASS | 0 (1) | 0 (0) |
| `tools/run-contracts.mjs` | FAIL | FAIL | 1 (1) | 1 (0) |
| `tools/scroll-touch-gates.mjs` | PASS | PASS | 0 (0) | 0 (1) |
| `tools/test-animation-lifecycle.mjs` | FAIL | FAIL | 1 (0) | 1 (0) |
| `tools/test-baked-lifecycle.mjs` | PASS | PASS | 0 (0) | 0 (1) |
| `tools/test-baked-manifest.mjs` | PASS | PASS | 0 (1) | 0 (0) |
| `tools/test-body-dissolve.mjs` | PASS | PASS | 0 (3) | 0 (4) |
| `tools/test-browser-harness.mjs` | PASS | PASS | 0 (1) | 0 (1) |
| `tools/test-assertion-provenance.mjs` | FAIL | FAIL | 1 (6) | 1 (5) |
| `tools/test-c01-harness.mjs` | PASS | PASS | 0 (0) | 0 (0) |
| `tools/test-browser-smoke-lifecycle.mjs` | PASS | PASS | 0 (1) | 0 (3) |
| `tools/test-card-icons.mjs` | PASS | PASS | 0 (1) | 0 (0) |
| `tools/test-card-registry.mjs` | PASS | PASS | 0 (0) | 0 (0) |
| `tools/test-card-warming.mjs` | FAIL | FAIL | 1 (0) | 1 (0) |
| `tools/test-chapter-contract.mjs` | FAIL | FAIL | 1 (4) | 1 (3) |
| `tools/test-chapter-entry.mjs` | PASS | PASS | 0 (0) | 0 (1) |
| `tools/test-check-cycles.mjs` | PASS | PASS | 0 (1) | 0 (1) |
| `tools/test-colony-connected-lines.mjs` | PASS | PASS | 0 (0) | 0 (0) |
| `tools/test-colony-retirement.mjs` | PASS | PASS | 0 (0) | 0 (0) |
| `tools/test-comment-stripper.mjs` | PASS | PASS | 0 (1) | 0 (1) |
| `tools/test-connect-arrival.mjs` | FAIL | FAIL | 1 (39) | 1 (38) |
| `tools/test-connect-hivemind-welcome.mjs` | PASS | PASS | 0 (0) | 0 (0) |
| `tools/test-connect-motion.mjs` | FAIL | FAIL | 1 (0) | 1 (1) |
| `tools/test-connect-phone-light.mjs` | PASS | PASS | 0 (0) | 0 (0) |
| `tools/test-coverage-floor.mjs` | FAIL | FAIL | 1 (8) | 1 (6) |
| `tools/test-declared-conversions.mjs` | PASS | PASS | 0 (1) | 0 (1) |
| `tools/test-detail-close-focus.mjs` | PASS | PASS | 0 (0) | 0 (1) |
| `tools/test-detail-shell-monotone.mjs` | PASS | PASS | 0 (0) | 0 (0) |
| `tools/test-director-resize.mjs` | PASS | PASS | 0 (0) | 0 (1) |
| `tools/test-discord-card.mjs` | FAIL | FAIL | 1 (1) | 1 (1) |
| `tools/test-dwell-oracle.mjs` | PASS | PASS | 0 (1) | 0 (1) |
| `tools/test-cap-clearance.mjs` | PASS | PASS | 0 (59) | 0 (38) |
| `tools/test-equip-arrival.mjs` | FAIL | FAIL | 1 (37) | 1 (36) |
| `tools/test-epilogue-retire.mjs` | TIMEOUT | TIMEOUT | 124 (150) | 124 (150) |
| `tools/test-equip-markers.mjs` | PASS | PASS | 0 (133) | 0 (126) |
| `tools/test-equip-visibility.mjs` | FAIL | FAIL | 1 (31) | 1 (31) |
| `tools/test-error-classes.mjs` | PASS | PASS | 0 (0) | 0 (0) |
| `tools/test-final-background-tissue.mjs` | PASS | PASS | 0 (0) | 0 (0) |
| `tools/test-final-ring-handoff.mjs` | PASS | PASS | 0 (0) | 0 (0) |
| `tools/test-final-spore-ownership.mjs` | PASS | PASS | 0 (0) | 0 (1) |
| `tools/test-frame-order.mjs` | PASS | PASS | 0 (1) | 0 (0) |
| `tools/test-frame-publication.mjs` | FAIL | FAIL | 1 (1) | 1 (2) |
| `tools/test-gate-browser-smoke.mjs` | PASS | PASS | 0 (6) | 0 (8) |
| `tools/test-gate-composition.mjs` | FAIL | FAIL | 1 (0) | 1 (0) |
| `tools/test-global-hooks.mjs` | FAIL | FAIL | 1 (1) | 1 (1) |
| `tools/test-gpu-context-recovery-browser.mjs` | FAIL | FAIL | 1 (1) | 1 (1) |
| `tools/test-gpu-preparation-browser.mjs` | FAIL | FAIL | 1 (1) | 1 (2) |
| `tools/test-gpu-preparation.mjs` | PASS | PASS | 0 (0) | 0 (1) |
| `tools/test-ground-departure.mjs` | PASS | PASS | 0 (1) | 0 (0) |
| `tools/test-equip-welcome.mjs` | FAIL | FAIL | 1 (36) | 1 (38) |
| `tools/test-hero-body-fog.mjs` | PASS | PASS | 0 (0) | 0 (0) |
| `tools/test-hero-copy-growth.mjs` | PASS | PASS | 0 (0) | 0 (0) |
| `tools/test-hero-handoff.mjs` | PASS | PASS | 0 (0) | 0 (0) |
| `tools/test-hero-spore-cutoff.mjs` | PASS | PASS | 0 (0) | 0 (0) |
| `tools/test-hot-state.mjs` | PASS | PASS | 0 (1) | 0 (0) |
| `tools/test-hotspot-departure.mjs` | PASS | PASS | 0 (0) | 0 (1) |
| `tools/test-initial-render-target-size.mjs` | PASS | PASS | 0 (0) | 0 (0) |
| `tools/test-input-claim.mjs` | PASS | PASS | 0 (1) | 0 (3) |
| `tools/test-ground-entry.mjs` | PASS | PASS | 0 (19) | 0 (24) |
| `tools/test-inspire-rim-facing.mjs` | FAIL | FAIL | 1 (36) | 1 (57) |
| `tools/test-inspire-welcome.mjs` | PASS | PASS | 0 (0) | 0 (0) |
| `tools/test-inspire-departure.mjs` | FAIL | FAIL | 1 (40) | 1 (40) |
| `tools/test-instrument-layer.mjs` | FAIL | FAIL | 1 (1) | 1 (1) |
| `tools/test-intro-lifecycle.mjs` | FAIL | FAIL | 1 (0) | 1 (1) |
| `tools/test-intro-menu-scroll.mjs` | FAIL | FAIL | 1 (0) | 1 (0) |
| `tools/test-intro-clock.mjs` | PASS | PASS | 0 (0) | 0 (0) |
| `tools/test-intro-readiness.mjs` | FAIL | FAIL | 1 (0) | 1 (0) |
| `tools/test-manifesto-concepts.mjs` | PASS | PASS | 0 (0) | 0 (0) |
| `tools/test-manifesto-entry.mjs` | PASS | PASS | 0 (0) | 0 (1) |
| `tools/test-journey-failure-details.mjs` | PASS | PASS | 0 (32) | 0 (48) |
| `tools/test-manifesto-font-fallback.mjs` | FAIL | FAIL | 1 (54) | 1 (36) |
| `tools/test-manifesto-hero-return.mjs` | PASS | PASS | 0 (3) | 0 (3) |
| `tools/test-manifesto-link-decoration.mjs` | PASS | PASS | 0 (7) | 0 (9) |
| `tools/test-manifesto-fit.mjs` | FAIL | FAIL | 1 (142) | 1 (36) |
| `tools/test-manifesto-motion.mjs` | PASS | PASS | 0 (2) | 0 (3) |
| `tools/test-manifesto-return.mjs` | PASS | PASS | 0 (1) | 0 (1) |
| `tools/test-manifesto-scene-presentation.mjs` | PASS | PASS | 0 (0) | 0 (1) |
| `tools/test-manifesto-links.mjs` | FAIL | FAIL | 1 (82) | 1 (101) |
| `tools/test-mobile-hotspot-motion.mjs` | FAIL | FAIL | 1 (47) | 1 (39) |
| `tools/test-mobile-landing-anchor.mjs` | FAIL | FAIL | 1 (2) | 1 (1) |
| `tools/test-mobile-manifesto-range.mjs` | PASS | PASS | 0 (0) | 0 (0) |
| `tools/test-manifesto-scroll-overflow.mjs` | TIMEOUT | TIMEOUT | 124 (150) | 124 (150) |
| `tools/test-mobile-spore-entry.mjs` | FAIL | FAIL | 1 (1) | 1 (0) |
| `tools/test-mobile-purpose-labels.mjs` | FAIL | FAIL | 1 (86) | 1 (82) |
| `tools/test-mobile-spore-visibility.mjs` | PASS | PASS | 0 (39) | 0 (49) |
| `tools/test-nav-entry-continuity.mjs` | FAIL | FAIL | 1 (68) | 1 (41) |
| `tools/test-no-scroll-navigation.mjs` | PASS | PASS | 0 (0) | 0 (1) |
| `tools/test-page-lifetime.mjs` | FAIL | FAIL | 1 (0) | 1 (1) |
| `tools/test-portrait-baked.mjs` | PASS | PASS | 0 (1) | 0 (1) |
| `tools/test-portrait-dealer.mjs` | PASS | PASS | 0 (2) | 0 (1) |
| `tools/test-portrait-harness.mjs` | PASS | PASS | 0 (1) | 0 (1) |
| `tools/test-portrait-lifecycle.mjs` | PASS | PASS | 0 (3) | 0 (3) |
| `tools/test-portrait-paint.mjs` | FAIL | FAIL | 1 (0) | 1 (0) |
| `tools/test-portrait-perturbation.mjs` | PASS | PASS | 0 (5) | 0 (5) |
| `tools/test-portrait-textures.mjs` | PASS | PASS | 0 (1) | 0 (1) |
| `tools/test-pose-oracle.mjs` | PASS | PASS | 0 (0) | 0 (0) |
| `tools/test-prelude-camera.mjs` | PASS | PASS | 0 (0) | 0 (1) |
| `tools/test-nav-readiness-cold.mjs` | FAIL | FAIL | 1 (64) | 1 (43) |
| `tools/test-purpose-copy-fit.mjs` | PASS | PASS | 0 (5) | 0 (4) |
| `tools/test-purpose-arrival.mjs` | FAIL | FAIL | 1 (81) | 1 (79) |
| `tools/test-purpose-label-fade.mjs` | PASS | PASS | 0 (0) | 0 (0) |
| `tools/test-purpose-copy-live.mjs` | FAIL | FAIL | 1 (95) | 1 (127) |
| `tools/test-rail-handoff.mjs` | FAIL | FAIL | 1 (0) | 1 (0) |
| `tools/test-render-baseline.mjs` | FAIL | FAIL | 1 (1) | 1 (1) |
| `tools/test-render-determinism.mjs` | FAIL | FAIL | 1 (1) | 1 (1) |
| `tools/test-render-perturbation.mjs` | PASS | PASS | 0 (0) | 0 (1) |
| `tools/test-renderer-resources.mjs` | FAIL | FAIL | 1 (1) | 1 (0) |
| `tools/test-rest-authority.mjs` | PASS | PASS | 0 (1) | 0 (0) |
| `tools/test-rest-composition.mjs` | PASS | PASS | 0 (0) | 0 (1) |
| `tools/test-road.mjs` | FAIL | FAIL | 1 (0) | 1 (1) |
| `tools/test-runtime-release.mjs` | PASS | PASS | 0 (1) | 0 (1) |
| `tools/test-scroll-perturbation.mjs` | FAIL | FAIL | 1 (0) | 1 (0) |
| `tools/test-scroll-trace.mjs` | PASS | PASS | 0 (1) | 0 (0) |
| `tools/test-serve-range.mjs` | PASS | PASS | 0 (2) | 0 (1) |
| `tools/test-spore-cap-flow.mjs` | PASS | PASS | 0 (4) | 0 (2) |
| `tools/test-spore-descent-pace.mjs` | PASS | PASS | 0 (3) | 0 (3) |
| `tools/test-spore-lifetime.mjs` | PASS | PASS | 0 (0) | 0 (0) |
| `tools/test-spore-recruitment.mjs` | PASS | PASS | 0 (5) | 0 (6) |
| `tools/test-spore-recycling.mjs` | FAIL | FAIL | 1 (43) | 1 (37) |
| `tools/test-spore-source-position.mjs` | PASS | PASS | 0 (1) | 0 (0) |
| `tools/test-spores-lifecycle.mjs` | FAIL | FAIL | 1 (0) | 1 (1) |
| `tools/test-startup-recovery.mjs` | PASS | PASS | 0 (0) | 0 (0) |
| `tools/test-static-content.mjs` | PASS | PASS | 0 (0) | 0 (0) |
| `tools/test-transition.mjs` | PASS | PASS | 0 (2) | 0 (1) |
| `tools/test-ui-closure.mjs` | PASS | PASS | 0 (2) | 0 (1) |
| `tools/test-ui-lifecycle.mjs` | FAIL | FAIL | 1 (1) | 1 (1) |
| `tools/test-purpose-mobile-copy.mjs` | TIMEOUT | TIMEOUT | 124 (151) | 124 (150) |
| `npm run cycles` | FAIL | FAIL | 1 (5) | 1 (7) |
| `npm run runtime:check` | PASS | FAIL | 0 (4) | 1 (3) |
| `npm run lint` | FAIL | FAIL | 1 (18) | 1 (20) |
| `tools/test-inspire-arrival-lock.mjs` | not in BASE | PASS (NEW) | - (-) | 0 (0) |
| `tools/test-rest-warm-queue.mjs` | not in BASE | PASS (NEW) | - (-) | 0 (0) |


## (a) REGRESSIONS (PASS in BASE, not PASS in MERGED)

- `npm run runtime:check`: MERGED FAIL (exit 1, 3s)
  - Failing text: `Error: Runtime release is stale; run npm run runtime:build and stage its output`
  - Location: `<ROOT>/tools/build-runtime-release.mjs:108`

Abridged excerpt from `/tmp/claude-0/-home-user/62a00d20-ec8d-551d-aa8b-33233b07a42e/scratchpad/qa/merged/npm_run_runtime:check.log` (the log also has the npm header and the caret line):

```
file:///home/user/wt/all/tools/build-runtime-release.mjs:108
      throw new Error('Runtime release is stale; run npm run runtime:build and stage its output');
Error: Runtime release is stale; run npm run runtime:build and stage its output
    at buildRuntimeRelease (file:///home/user/wt/all/tools/build-runtime-release.mjs:108:13)
    at file:///home/user/wt/all/tools/build-runtime-release.mjs:146:101
```

BASE, same command: `runtime release verified: {"hash":"0ff35278d9acac0be9160153e62c74cf7cf81c36838eeec634655b2261ceab8b",...,"files":194,...}`.

Analysis (no fix applied):

- The check in `tools/build-runtime-release.mjs` (lines ~104-108) hashes the module graph reachable from `main.js`, `organism/hero-spores*.js` and `hero-deco.js` (`collectRuntime`), then requires `runtime/<hash>/` and `runtime-release.js` to match. The graph has 194 files. I compared per-file content hashes (read-only, via `collectRuntime` from both checkouts): **16 graph files differ**: `journey/camera-blend.js`, `journey/chapters/final/index.js`, `journey/chapters/hero-ground-dim.js`, `journey/chapters/owned/portrait-photo-loader.js`, `journey/journey.js`, `journey/manifesto/{branch,colony,fit,pose}.js`, `journey/navigation-timing.js`, `journey/rail.js`, `journey/ui/{bands,copy-arrival,hotspot-frame}.js`, `organism/organism.js`, `organism/performance.js`.
- `runtime/` and `runtime-release.js` are unchanged on `polish/all` since `6835391` (`git diff --stat` empty), so the new graph hash has no release directory. This is a stale-build gap, not a value pinned by the test. The check does not assert any polish-intended value; any source edit to those 16 files would trip it until `npm run runtime:build` is run and its output staged.
- Most plausible cause: any one of the commits below changed a graph file, and the hash covers all of them, so the check trips on the polish pass as a whole. The most graph files are touched by `0c24a1f` (Intro->Inspire: camera-blend, navigation-timing, ui/bands, ui/copy-arrival) and `b2d28e4` (Manifesto flight prep: branch, colony, fit, organism). Per-file log since `6835391` (newest first):
  - `journey/camera-blend.js`: 0c24a1f Intro->Inspire: one quintic arc, content arrives with the came
  - `journey/chapters/final/index.js`: 789d664 Final: bloom the Intro web and motes on the wrap-down flight p
  - `journey/chapters/hero-ground-dim.js`: 789d664 Final: bloom the Intro web and motes on the wrap-down flight p
  - `journey/chapters/owned/portrait-photo-loader.js`: 8210575 Portrait sprite: decode off the main thread before the atlas b
  - `journey/journey.js`: 02b5acf Wire Manifesto prewarm into the rest warm queue; preload headl; 67ec8f0 Keep card warming's self-start; leave its move to the rest que; 256e68b Warm queue: rank chapters by rail order (Purpose before its Ow; 0e3e0cd One rest-aware warm queue: geometry warm draws, polite texture
  - `journey/manifesto/branch.js`: b2d28e4 Prepare the Manifesto flight ahead of the press and stop mid-f
  - `journey/manifesto/colony.js`: b13504d Warm draw ignores the view frustum; expose its QA state; b2d28e4 Prepare the Manifesto flight ahead of the press and stop mid-f
  - `journey/manifesto/fit.js`: b2d28e4 Prepare the Manifesto flight ahead of the press and stop mid-f
  - `journey/manifesto/pose.js`: 64330ce Manifesto: halve sentence pause, one eased descent law, phone 
  - `journey/navigation-timing.js`: 0c24a1f Intro->Inspire: one quintic arc, content arrives with the came
  - `journey/rail.js`: fb96c26 Rail: skip unchanged Purpose-tree custom-property writes
  - `journey/ui/bands.js`: 0c24a1f Intro->Inspire: one quintic arc, content arrives with the came
  - `journey/ui/copy-arrival.js`: 0c24a1f Intro->Inspire: one quintic arc, content arrives with the came
  - `journey/ui/hotspot-frame.js`: ce7195d Hotspots: skip unchanged per-frame style and attribute writes
  - `organism/organism.js`: a3738cf Merge branch 'polish/mperf' into polish/all; 4f72a69 Resolution: hold ratchet steps until at rest; coalesce resize ; b2d28e4 Prepare the Manifesto flight ahead of the press and stop mid-f
  - `organism/performance.js`: 4f72a69 Resolution: hold ratchet steps until at rest; coalesce resize 
- Test pins: none. The regression is the generated-release staleness, which the intended polish edits (Intro->Inspire ease, manifesto pause and descent law, phone rail lift, menu thesis font, warm queue, TAA skip, word entrance, font preload in `index.html`, Final wrap-down relight) caused by changing sources. Only a rebuild of `runtime/` and `runtime-release.js` clears it, which was out of scope for this QA run.

## (b) FIXED (not PASS in BASE, PASS in MERGED)

None.

## (c) Failing in both (BASE and MERGED not PASS)

50 items: 47 with identical error text, 3 with different text. Text is the first uncaught error or assertion line, paths normalised to `<ROOT>`.

### Different error text (both shown)

- `tools/test-inspire-departure.mjs`: BASE FAIL / MERGED FAIL
  - BASE: `AssertionError [ERR_ASSERTION]: Inspire must retain its stream while departing toward equip` at `<ROOT>/tools/test-inspire-departure.mjs:32`
  - MERGED: `page.waitForFunction: Timeout 30000ms exceeded.` at `<ROOT>/tools/test-inspire-departure.mjs:10`
- `tools/test-intro-readiness.mjs`: BASE FAIL / MERGED FAIL
  - BASE: `ReferenceError: prepareGpuWarmup is not defined` at `<ROOT>/tools/test-intro-readiness.mjs:14`
  - MERGED: `ReferenceError: state is not defined` at `<ROOT>/tools/test-intro-readiness.mjs:14`
- `tools/test-manifesto-font-fallback.mjs`: BASE FAIL / MERGED FAIL
  - BASE: `page.waitForSelector: Timeout 30000ms exceeded.` at `<ROOT>/tools/test-manifesto-font-fallback.mjs:30`
  - MERGED: `page.waitForFunction: Timeout 30000ms exceeded.` at `<ROOT>/tools/test-manifesto-font-fallback.mjs:28`

### Identical error text

| Item | Status (both) | Error text |
|---|---|---|
| `tools/run-contracts.mjs` | FAIL / FAIL | `FAIL  GC-ORDER  D54/D80 — the chain's composition AND order, as a site set keyed by position` |
| `tools/test-animation-lifecycle.mjs` | FAIL / FAIL | `Error: Command failed: git show 6967a36ab309af7057336be64d6f0f9dd3c41b21:organism/animation.js` |
| `tools/test-assertion-provenance.mjs` | FAIL / FAIL | `FAIL  AP1  D49 — every gated suite is declared: a receiver shape, or an UNSCANNABLE entry with a reason` |
| `tools/test-card-warming.mjs` | FAIL / FAIL | `fatal: path 'journey/cards/index.js' exists on disk, but not in '6967a36ab309af7057336be64d6f0f9dd3c41b21'` |
| `tools/test-chapter-contract.mjs` | FAIL / FAIL | `FAIL T2 [static ratchet] the UI surface reads NO global and names NO chapter — with a D54 site set as the positive control` |
| `tools/test-connect-arrival.mjs` | FAIL / FAIL | `AssertionError [ERR_ASSERTION]: Ownership cannot start a surface welcome` |
| `tools/test-connect-motion.mjs` | FAIL / FAIL | `AssertionError [ERR_ASSERTION]: The expression evaluated to a falsy value:` |
| `tools/test-coverage-floor.mjs` | FAIL / FAIL | `SUITE FAILED  tools/test-chapter-contract.mjs  exit 1` |
| `tools/test-discord-card.mjs` | FAIL / FAIL | `fatal: path 'journey/cards/discord.js' exists on disk, but not in '6967a36ab309af7057336be64d6f0f9dd3c41b21'` |
| `tools/test-equip-arrival.mjs` | FAIL / FAIL | `AssertionError [ERR_ASSERTION]: mission: one welcome per icon` |
| `tools/test-epilogue-retire.mjs` | TIMEOUT / TIMEOUT | `page.evaluate: Target page, context or browser has been closed` |
| `tools/test-equip-visibility.mjs` | FAIL / FAIL | `AssertionError [ERR_ASSERTION]: agent chapter reveal finished` |
| `tools/test-frame-publication.mjs` | FAIL / FAIL | `FAIL  A1  every leaf of the publication is a primitive, and the leaf set is the SUBJECT's own — read out of the published object, never typed here` |
| `tools/test-gate-composition.mjs` | FAIL / FAIL | `FAIL  GC-ORDER  D54/D80 — the chain's composition AND order, as a site set keyed by position` |
| `tools/test-global-hooks.mjs` | FAIL / FAIL | `HarnessFault [Error]: base source for journey/dial.js is unreadable at 6967a36: Command failed: git show 6967a36ab309af7057336be64d6f0f9dd3c41b21:jour` |
| `tools/test-gpu-context-recovery-browser.mjs` | FAIL / FAIL | `browserType.launch: Failed to launch chromium because executable doesn't exist at /Applications/Google Chrome.app/Contents/MacOS/Google Chrome` |
| `tools/test-gpu-preparation-browser.mjs` | FAIL / FAIL | `browserType.launch: Failed to launch chromium because executable doesn't exist at /Applications/Google Chrome.app/Contents/MacOS/Google Chrome` |
| `tools/test-equip-welcome.mjs` | FAIL / FAIL | `AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:` |
| `tools/test-inspire-rim-facing.mjs` | FAIL / FAIL | `AssertionError [ERR_ASSERTION]: actual entry exposes the previously lit inner fan` |
| `tools/test-instrument-layer.mjs` | FAIL / FAIL | `FAIL  COV-1  D88 — every shared instrument module in tools/ is a subject of this suite` |
| `tools/test-intro-lifecycle.mjs` | FAIL / FAIL | `Error: Command failed: git show 6967a36ab309af7057336be64d6f0f9dd3c41b21:organism/intro.js` |
| `tools/test-intro-menu-scroll.mjs` | FAIL / FAIL | `ReferenceError: journeyFailed is not defined` |
| `tools/test-manifesto-fit.mjs` | FAIL / FAIL | `page.waitForFunction: Timeout 30000ms exceeded.` |
| `tools/test-manifesto-links.mjs` | FAIL / FAIL | `locator.evaluate: Timeout 30000ms exceeded.` |
| `tools/test-mobile-hotspot-motion.mjs` | FAIL / FAIL | `page.waitForFunction: Timeout 20000ms exceeded.` |
| `tools/test-mobile-landing-anchor.mjs` | FAIL / FAIL | `browserType.launch: Executable doesn't exist at /opt/pw-browsers/webkit-2336/pw_run.sh` |
| `tools/test-manifesto-scroll-overflow.mjs` | TIMEOUT / TIMEOUT | `page.evaluate: Target page, context or browser has been closed` |
| `tools/test-mobile-spore-entry.mjs` | FAIL / FAIL | `AssertionError [ERR_ASSERTION]: The expression evaluated to a falsy value:` |
| `tools/test-mobile-purpose-labels.mjs` | FAIL / FAIL | `page.waitForFunction: Timeout 30000ms exceeded.` |
| `tools/test-nav-entry-continuity.mjs` | FAIL / FAIL | `AssertionError [ERR_ASSERTION]: real startup sampled the visible preboot/live handoff` |
| `tools/test-page-lifetime.mjs` | FAIL / FAIL | `FAIL  D1  THE ANTECEDENT: every module in the shipped graph has one bare specifier form, so ESM's per-specifier cache really does mean one evaluation ` |
| `tools/test-portrait-paint.mjs` | FAIL / FAIL | `FAIL  2   photo/rest/exposure<1/no-mirror/origin-cell — transcript digest === pre-move literal` |
| `tools/test-nav-readiness-cold.mjs` | FAIL / FAIL | `AssertionError [ERR_ASSERTION]: real readiness contains multiple visible fade frames` |
| `tools/test-purpose-arrival.mjs` | FAIL / FAIL | `page.waitForFunction: Timeout 20000ms exceeded.` |
| `tools/test-purpose-copy-live.mjs` | FAIL / FAIL | `page.screenshot: Timeout 30000ms exceeded.` |
| `tools/test-rail-handoff.mjs` | FAIL / FAIL | `AssertionError [ERR_ASSERTION]: mobile Final gives its background camera a stronger independent lift` |
| `tools/test-render-baseline.mjs` | FAIL / FAIL | `Error: baked: no geometry for connect/strands` |
| `tools/test-render-determinism.mjs` | FAIL / FAIL | `Error: baked: no geometry for connect/strands` |
| `tools/test-renderer-resources.mjs` | FAIL / FAIL | `Error: Command failed: git show 6967a36ab309af7057336be64d6f0f9dd3c41b21:organism/renderer.js` |
| `tools/test-road.mjs` | FAIL / FAIL | `Error: Command failed: git show 6967a36ab309af7057336be64d6f0f9dd3c41b21:journey/scroll.js` |
| `tools/test-scroll-perturbation.mjs` | FAIL / FAIL | `Error: perturbation anchors no longer match source` |
| `tools/test-spore-recycling.mjs` | FAIL / FAIL | `page.waitForFunction: Timeout 30000ms exceeded.` |
| `tools/test-spores-lifecycle.mjs` | FAIL / FAIL | `Error: Command failed: git show 6967a36ab309af7057336be64d6f0f9dd3c41b21:organism/spores.js` |
| `tools/test-ui-lifecycle.mjs` | FAIL / FAIL | `FAIL  UIL-T1  the UI surface: zero raw addEventListener sites, 30 owner.listen; zero raw setTimeout, 10 owner.timer` |
| `tools/test-purpose-mobile-copy.mjs` | TIMEOUT / TIMEOUT | `page.screenshot: Target page, context or browser has been closed` |
| `npm run cycles` | FAIL / FAIL | `✖ Skipped 15 local files (UNRESOLVED -- dependency-analysis hole):` |
| `npm run lint` | FAIL / FAIL | `✖ 16 problems (7 errors, 9 warnings)` |

## Lint (`npm run lint`)

Both: `✖ 16 problems (7 errors, 9 warnings)`. Problem lists (file:line:rule, sorted) are identical; the diff is empty. **No lint problem is new in MERGED.** Problems (both):

- `journey/chapters/connect/camera.js 81 warning no-unused-vars`
- `journey/chapters/owned/portraits.js 171 warning no-unused-vars`
- `journey/rail.js 140 warning no-unused-vars`
- `journey/rail.js 392 warning no-unused-vars`
- `journey/rail.js 423 warning no-unused-vars`
- `journey/transition/controller.js 217 warning no-useless-assignment`
- `journey/transition/controller.js 549 warning no-unused-vars`
- `mycelial/flowers.js 667 error no-self-assign`
- `organism/hero-spores.js 2257 warning no-unused-vars`
- `tools/deck/check-mink-paint-handoff.mjs 4 warning no-unused-vars`
- `tools/test-inspire-departure.mjs 13 error no-undef`
- `tools/test-inspire-departure.mjs 16 error no-undef`
- `tools/test-inspire-departure.mjs 19 error no-undef`
- `tools/test-inspire-departure.mjs 20 error no-undef`
- `tools/test-inspire-departure.mjs 28 error no-undef`
- `tools/test-inspire-departure.mjs 29 error no-undef`

## Cycles (`npm run cycles`)

Both FAIL with the same text: `✖ Skipped 15 local files (UNRESOLVED -- dependency-analysis hole)` and the same warnings list. The only difference in the output is the scanned-file count: BASE `Processed 404 files`, MERGED `Processed 406 files`. I did not investigate which two files account for the difference. The skipped-file list is identical.

## Caveats that limit what this run can see

- Eight tests read git history at a pinned commit `6967a36ab309af7057336be64d6f0f9dd3c41b21` (`RUN_START_SHA`). That commit is absent from both clones (`git cat-file -t` fails in both), so those tests error out before reaching their assertions in both checkouts: test-animation-lifecycle, test-card-warming, test-discord-card, test-global-hooks, test-intro-lifecycle, test-renderer-resources, test-road, test-spores-lifecycle. Regressions in those tests would be invisible here.
- Several browser tests fail for environment reasons in both checkouts (for example Chromium at `/Applications/Google Chrome` or WebKit at `/opt/pw-browsers` is missing). Browser waits that time out in `page.waitForFunction`/`waitForSelector` are not evidence either way, so the browser checks here cannot show regressions.
- Three test timeouts (`test-epilogue-retire`, `test-manifesto-scroll-overflow`, `test-purpose-mobile-copy`) were killed at 150 s in both checkouts.
- Runs were sequential with 2 items at a time on a shared 4-core machine; a test that depends on timing could differ run to run. test-inspire-departure is the one item whose failure point changed between runs (see (c)); it could be timing.

