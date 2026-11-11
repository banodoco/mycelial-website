# Test triage: every test file in the repo, classified

Branch `polish/all` (`/home/user/wt/all`, HEAD `02b5acf`). Base for comparison: `/home/user/mycelial-website` at `6835391`. Read-only: nothing edited, nothing committed, no browsers launched. Per-test logs and statuses are the QA run's (`SCRATCH/qa/merged`, `SCRATCH/qa/base`, `SCRATCH/findings/QA-tests.md`). Wiring was read from `package.json` (scripts, `npm run` chains, `test:contracts` chain of 53 entries), `tools/test-gate-composition.mjs` (`NOT_IN_CHAIN`, `UNWIRED_TODAY`), `tools/test-assertion-provenance.mjs`, `tools/run-contracts.mjs`, `tools/pre-commit`, `tools/check.sh`, `tools/pre-push-runtime`, `tools/mutant-registry.mjs`, `tools/self-controls.mjs`, `tools/instrument-ledger.mjs`, `CONTRIBUTING.md`, `DEPLOY.md`, and every doc in `docs/`.

## Caveats that bound every verdict

1. **Shallow history.** `git rev-list --count HEAD` is 21 in the worktree and 1 in base. Most test and source files have one commit in the clone. "Which side moved last" cannot be answered from git for the C items. What can be shown: every C item is red on base `6835391` with the same error, so the drift predates the polish pass. Its exact date cannot be recovered here.
2. **The pinned sha `6967a36ab309af7057336be64d6f0f9dd3c41b21`** (`RUN_START_SHA` in the E-type suites) is absent from both clones (`git cat-file -t` fails in both). Whether the owner's full clone has it is unverified. The E-type reds below are therefore classed environment (B-i) and not proven.
3. **Browser tests were classified from logs only**, as instructed. Browser assertion failures are not classified as stale without a run; they are listed as unresolved. Two wired browser items (`test-epilogue-retire`, `test-gpu-preparation-browser`) are B; every other browser failure is unwired.
4. **Four Python tests were not executed by QA.** They are listed as A-unverified.
5. The task named `tools/coverage/assertion-provenance` files. That directory does not exist. The module is `tools/assertion-provenance.mjs`.

## Counts (133 test-file entries from the QA set, plus 4 Python tests)

| Bucket | Meaning | Count |
|---|---|---|
| **A** | Wired (script, chain, harness import, or a documented manual runbook) and passes here | 53 |
| **A-unverified** | Wired Python tests, not executed in QA | 4 (extra) |
| **RUNNER** | `tools/run-contracts.mjs`, plumbing; its red is inherited from chain members | 1 |
| **B** | Wired, fails or times out only for environment reasons | 2 |
| **C** | Stale or broken on base as well as merged, independent of environment | 14 |
| **D** | Orphan: no script, gate, registry or doc runs it. Pass/fail noted per row | 52 |
| **E** | Frozen one-time move or behaviour-preservation proof | 11 |
| **F** | Duplicate or subsumed | not a bucket of its own; see F below |
| **G** | Retired by the repo's own docs | not a bucket of its own; see G below (names with no file) |

Sum check: 53 + 1 + 2 + 14 + 52 + 11 = 133. QA non-PASS count is 48 of 133, matching QA-tests.md. Of those 48: 25 test files are wired (9 are E, including `test-portrait-paint`; 2 are B; 14 are C), plus the runner; 22 are unwired (D).

## Per-test table

Columns: bucket; wiring (from the npm scripts and the `test:contracts` chain position); status here in merged and base (exit state and seconds); one-line evidence with file:line where it matters.

| File | Bucket | Wired by (npm script / chain pos) | Status here (merged / base) | Evidence |
|---|---|---|---|---|
| `journey/structure.test.mjs` | A | check,check:browser,test,test:unit | PASS 1s / PASS 0s | PASS. Imports 5 compat fixtures from tools/fixtures/ (structure, route, symbols, constants, aliases) which are E-type compat proofs; see E-fixtures. |
| `tests/deck-copy-surfaces.test.mjs` | A | docs runbook only (manual node --test) | PASS 1s / PASS 0s | PASS. Wired only by docs runbooks (docs/copy-ownership.md:35, docs/copy-surface-handoff.md:20: `node --test`), not by npm. Manual gate, not dead. |
| `tests/deck-flowers-return.test.mjs` | A | docs runbook only (manual node --test) | PASS 0s / PASS 0s | PASS. Wired only by docs/flowers-return-mobile-stack.md:40 (manual `node --test`). Manual gate. |
| `tests/deck-scene-resilience.test.mjs` | A | docs runbook only (manual node --test) | PASS 1s / PASS 0s | PASS. Wired only by docs/scene-resilience.md:52 and docs/flowers-return-mobile-stack.md:40 (manual `node --test`). |
| `tests/deck-story.test.mjs` | A | docs runbook only (manual node --test) | PASS 0s / PASS 1s | PASS. Wired only by docs runbooks (docs/copy-ownership.md:35, docs/scene-resilience.md:52), manual `node --test`. |
| `tools/run-contracts.mjs` | RUNNER | check,check:browser,test | FAIL 0s / FAIL 1s | Plumbing that runs test:contracts. Red only because chain members are red (GC-ORDER, GC-TIERS, GC-WIRED, GC-SHAPE from test-gate-composition; GC-ORDER on base too). Not a test; no own defect. |
| `tools/scroll-touch-gates.mjs` | A | check,check:browser,test,test:unit | PASS 1s / PASS 0s | PASS. test:unit and check. |
| `tools/test-animation-lifecycle.mjs` | E | test:contracts / pos 21 | FAIL 0s / FAIL 0s | R01 behaviour-preservation proof: loads `git show 6967a36ab309af7057336be64d6f0f9dd3c41b21:organism/animation.js` (line 1 of BASELINE_SOURCE). FAIL both trees: "Error: Command failed: git show 6967a36...". Sha absent from this shallow clone and from /home/user/mycelial-website (1 commit). Env (B-i) for the red; purpose is E. |
| `tools/test-assertion-provenance.mjs` | C | test:contracts / pos 3 | FAIL 5s / FAIL 6s | TIER-1 (chain pos 3). FAIL both trees. AP1: "expected: []  actual: [test-gpu-preparation, test-inspire-arrival-lock, test-manifesto-return, test-mobile-manifesto-range, test-rest-warm-queue, test-startup-recovery]" = hand-kept RECEIVERS/UNSCANNABLE registry not updated for suites added to test:unit/check. AP1b, AP4, AP15 red for same reason. Stale registry, not env. |
| `tools/test-baked-lifecycle.mjs` | A | test:contracts / pos 34 | PASS 1s / PASS 0s | PASS. test:contracts pos 34. |
| `tools/test-baked-manifest.mjs` | A | check,check:browser,test,test:harness | PASS 0s / PASS 1s | PASS. test:harness and check. |
| `tools/test-body-dissolve.mjs` | D | none (no script, gate or doc) | PASS 4s / PASS 3s | Unwired (no script, gate, doc). PASS here in 4 s. Uses channel:"chrome" and localhost:8137 (browser test run by hand at best). |
| `tools/test-browser-harness.mjs` | A | test:contracts / pos 8 | PASS 1s / PASS 1s | PASS. test:contracts pos 8. |
| `tools/test-browser-smoke-lifecycle.mjs` | A | check,check:browser,test,test:harness | PASS 3s / PASS 1s | PASS. check, test:harness. |
| `tools/test-c01-harness.mjs` | A | harness, imported by chain suites | PASS 0s / PASS 0s | Harness, not a suite. Executed as an import by tools/test-transition.mjs (pos 40) and used by test-portrait-harness and test-input-claim; NOT_IN_CHAIN exemption is honest. PASS. |
| `tools/test-cap-clearance.mjs` | D | none (no script, gate or doc) | PASS 38s / PASS 59s | Unwired. PASS here (38 s). Browser (channel:"chrome"). |
| `tools/test-card-icons.mjs` | E | test:contracts / pos 46 | PASS 0s / PASS 1s | U01c move proof: compares against tools/fixtures/u01c-cards-index.pre-move.js.txt (9,711 B, sha pinned). PASS, test:contracts pos 46. |
| `tools/test-card-registry.mjs` | E | test:contracts / pos 45 | PASS 0s / PASS 0s | U01b move proof: FIXTURE_REL = tools/fixtures/u01b-cards-index.pre-move.js.txt (10,264 B, sha pinned, "reverse application" section 7). PASS, test:contracts pos 45. |
| `tools/test-card-warming.mjs` | E | test:contracts / pos 28 | FAIL 0s / FAIL 0s | U01a move/behaviour proof: `git show <sha>:journey/cards/index.js` -> "fatal: path 'journey/cards/index.js' exists on disk, but not in '6967a36...'". Env (B-i) for the red. Does NOT read the u01b/u01c fixtures (they only mention its name). |
| `tools/test-chapter-contract.mjs` | C | test:contracts / pos 32 | FAIL 3s / FAIL 4s | Wired test:contracts pos 32. FAIL both trees: T2 "[static ratchet] the UI surface reads NO global and names NO chapter": actual final:1 vs expected final:0. Source: journey/ui/rail-handoff.js:31,72,82,88 name the 'final' chapter. The invariant is real and red on base: LIVE violation, not a stale rig. Do not delete. |
| `tools/test-chapter-entry.mjs` | A | test:contracts / pos 9 | PASS 1s / PASS 0s | PASS. test:contracts pos 9. |
| `tools/test-check-cycles.mjs` | A | test:contracts / pos 7 | PASS 1s / PASS 1s | PASS. test:contracts pos 7. |
| `tools/test-colony-connected-lines.mjs` | D | none (no script, gate or doc) | PASS 0s / PASS 0s | Unwired. PASS here. No doc or script reference. |
| `tools/test-colony-retirement.mjs` | D | none (no script, gate or doc) | PASS 0s / PASS 0s | Unwired. PASS here. No doc or script reference. |
| `tools/test-comment-stripper.mjs` | A | test:contracts / pos 4 | PASS 1s / PASS 1s | PASS. test:contracts pos 4. |
| `tools/test-connect-arrival.mjs` | D | none (no script, gate or doc) | FAIL 38s / FAIL 39s | Unwired. FAIL both trees (38 s): "AssertionError: Ownership cannot start a surface welcome" at line 30. Browser (channel:"chrome"). Cause not classifiable without a browser run; treat as unresolved. |
| `tools/test-connect-hivemind-welcome.mjs` | D | none (no script, gate or doc) | PASS 0s / PASS 0s | Unwired. PASS here. |
| `tools/test-connect-motion.mjs` | C | test:contracts / pos 10 | FAIL 1s / FAIL 0s | Wired test:contracts pos 10. FAIL both trees at line 72: `assert.ok(Math.abs(rest.pos.y - 2.75) < 1e-9)`. The file says these two lines are "SUBORDINATE SINCE REST-01 (2026-08-24)" and REST-01 governs. journey/portrait.js:257 records "tgtUp 2.75 -> 1.50 (2026-08-05)". Superseded coordinate pin (CONTRIBUTING: pins that record a value). |
| `tools/test-connect-phone-light.mjs` | D | none (no script, gate or doc) | PASS 0s / PASS 0s | Unwired. PASS here. |
| `tools/test-coverage-floor.mjs` | C | test:contracts / pos 52 | FAIL 6s / FAIL 8s | Wired test:contracts pos 52. FAIL both trees: "SUITE FAILED tools/test-chapter-contract.mjs / test-connect-motion.mjs / test-scroll-perturbation.mjs", then PC-3d. Derivative: red only because three child suites are red (C). Fix the children, not this. |
| `tools/test-declared-conversions.mjs` | A | test:contracts / pos 51 | PASS 1s / PASS 1s | PASS. test:contracts pos 51. |
| `tools/test-detail-close-focus.mjs` | A | test:contracts / pos 30 | PASS 1s / PASS 0s | PASS. test:contracts pos 30. |
| `tools/test-detail-shell-monotone.mjs` | A | test:contracts / pos 50 | PASS 0s / PASS 0s | PASS. test:contracts pos 50. |
| `tools/test-director-resize.mjs` | A | imported by tools/test-transition.mjs (chain pos 40) | PASS 1s / PASS 0s | Not in a script directly, but imported by tools/test-transition.mjs line 84 (chain pos 40), so it runs inside the chain. PASS. NOT_IN_CHAIN exemption in test-gate-composition is valid. |
| `tools/test-discord-card.mjs` | E | test:contracts / pos 29 | FAIL 1s / FAIL 1s | U01d change-proof: `git show <sha>:journey/cards/discord.js` -> "fatal: path 'journey/cards/discord.js' exists on disk, but not in '6967a36...'". Env (B-i). Test:contracts pos 29. |
| `tools/test-dwell-oracle.mjs` | A | test:contracts / pos 37 | PASS 1s / PASS 1s | PASS. test:contracts pos 37. Reads tools/dwell-oracle.trace.json.txt (live input). |
| `tools/test-epilogue-retire.mjs` | B | check:browser,test:browser | TIMEOUT 150s / TIMEOUT 150s | Wired test:browser (manual) and check:browser. TIMEOUT at QA 150 s cap in both trees, no assertion failure logged. CHROME resolves to /usr/bin/google-chrome here (line 253-257), so the browser launches. Probably runtime > QA cap (time budget), not a red. Cannot classify further without a longer run. |
| `tools/test-equip-arrival.mjs` | D | none (no script, gate or doc) | FAIL 36s / FAIL 37s | Unwired. FAIL both trees (36 s): "AssertionError: mission: one welcome per icon" at line 37. Browser. Unresolved (see F: overlaps test-equip-welcome). |
| `tools/test-equip-markers.mjs` | D | none (no script, gate or doc) | PASS 126s / PASS 133s | Unwired. PASS here (126 s). Browser. |
| `tools/test-equip-visibility.mjs` | D | none (no script, gate or doc) | FAIL 31s / FAIL 31s | Unwired. FAIL both trees (31 s): "agent chapter reveal finished" at line 28. Browser. Unresolved. |
| `tools/test-equip-welcome.mjs` | D | none (no script, gate or doc) | FAIL 38s / FAIL 36s | Unwired. FAIL both trees (38 s): "Expected values to be strictly deep-equal" at line 48 (calls.map(slot) vs [0,1]). Browser. Unresolved; overlaps test-equip-arrival (F). |
| `tools/test-error-classes.mjs` | A | test:contracts / pos 5 | PASS 0s / PASS 0s | PASS. test:contracts pos 5. |
| `tools/test-final-background-tissue.mjs` | D | none (no script, gate or doc) | PASS 0s / PASS 0s | Unwired. PASS here. |
| `tools/test-final-ring-handoff.mjs` | D | none (no script, gate or doc) | PASS 0s / PASS 0s | Unwired. PASS here. |
| `tools/test-final-spore-ownership.mjs` | D | none (no script, gate or doc) | PASS 1s / PASS 0s | Unwired. PASS here. |
| `tools/test-frame-order.mjs` | A | test:contracts / pos 12 | PASS 0s / PASS 1s | PASS. test:contracts pos 12. |
| `tools/test-frame-publication.mjs` | C | test:contracts / pos 41 | FAIL 2s / FAIL 1s | Wired test:contracts pos 41. FAIL both trees with literal pins out of date against source. C8: expected 13 reads over 4 members, actual 15 over 6 (adds "scenePresentedP"; journey/journey.js:1807 `seams.update(frame.routeP, frame.scenePresentedP)` on base too). A1 leaf set and C5 file allow-list also drifted. Count pins, stale. |
| `tools/test-gate-browser-smoke.mjs` | A | check,check:browser,test,test:harness | PASS 8s / PASS 6s | PASS. check, test:harness. |
| `tools/test-gate-composition.mjs` | C | test:contracts / pos 1 | FAIL 0s / FAIL 0s | TIER-1 (chain pos 1). FAIL both trees. GC-ORDER and GC-TIERS compare against a pinned order that does not match the 53-entry chain (t2 "9-51 NOT CONTIGUOUS"). GC-WIRED lists the unexempted unwired suites (its own orphan detector: ~58 by replication). GC-SHAPE flagged set drifted. Pins stale; the orphan finding is real. Do not delete (tier 1). |
| `tools/test-global-hooks.mjs` | E | test:contracts / pos 43 | FAIL 1s / FAIL 1s | J04c proof: `git show <sha>:journey/dial.js` -> HarnessFault "base source for journey/dial.js is unreadable at 6967a36". Env (B-i). test:contracts pos 43. |
| `tools/test-gpu-context-recovery-browser.mjs` | D | none (no script, gate or doc) | FAIL 1s / FAIL 1s | Unwired. FAIL both trees: "browserType.launch: ... /Applications/Google Chrome.app/Contents/MacOS/Google Chrome" (hard-coded macOS path, line 24). Env (B-ii). Only a manual browser run could use it. |
| `tools/test-gpu-preparation-browser.mjs` | B | test:gpu:browser | FAIL 2s / FAIL 1s | Wired test:gpu:browser (manual npm script; not in any gate). FAIL both trees: "browserType.launch: Failed to launch chromium because executable doesn't exist at /Applications/Google Chrome.app/Contents/MacOS/Google Chrome" (hard-coded path, line 22). Env (B-ii). |
| `tools/test-gpu-preparation.mjs` | A | check,check:browser,test,test:contracts,test:harness / pos 25 | PASS 1s / PASS 0s | PASS. Imports the real module (journey/boot/hero-gpu.js). In check, test, test:contracts, test:harness. |
| `tools/test-ground-departure.mjs` | D | none (no script, gate or doc) | PASS 0s / PASS 1s | Unwired. PASS here. |
| `tools/test-ground-entry.mjs` | D | none (no script, gate or doc) | PASS 24s / PASS 19s | Unwired. PASS here (24 s). Browser. |
| `tools/test-hero-body-fog.mjs` | D | none (no script, gate or doc) | PASS 0s / PASS 0s | Unwired. PASS here. |
| `tools/test-hero-copy-growth.mjs` | D | none (no script, gate or doc) | PASS 0s / PASS 0s | Unwired. PASS here. |
| `tools/test-hero-handoff.mjs` | A | check,check:browser,test,test:contracts,test:harness / pos 26 | PASS 0s / PASS 0s | PASS. check, test, test:contracts, test:harness. |
| `tools/test-hero-spore-cutoff.mjs` | A | check,check:browser,test,test:contracts,test:harness / pos 23 | PASS 0s / PASS 0s | PASS. check, test, test:contracts, test:harness. |
| `tools/test-hot-state.mjs` | A | test:contracts / pos 47 | PASS 0s / PASS 1s | PASS. test:contracts pos 47. Its §6 reverse-application pairs were RETIRED in-file (2026-08-22, U03); the retirement precedent is quoted below. |
| `tools/test-hotspot-departure.mjs` | A | check,check:browser,test,test:unit | PASS 1s / PASS 0s | PASS. check, test:unit. |
| `tools/test-initial-render-target-size.mjs` | A | check,check:browser,test,test:harness | PASS 0s / PASS 0s | PASS. check, test:harness. |
| `tools/test-input-claim.mjs` | A | test:contracts / pos 39 | PASS 3s / PASS 1s | PASS. test:contracts pos 39. |
| `tools/test-inspire-arrival-lock.mjs` | A | check,check:browser,test,test:unit | PASS 0s / ? | NEW in this branch. PASS. check, test:unit. |
| `tools/test-inspire-departure.mjs` | D | none (no script, gate or doc) | FAIL 40s / FAIL 40s | Unwired. FAIL both trees. Merged: "page.waitForFunction: Timeout 30000ms" at line 10; base: "AssertionError: Inspire must retain its stream while departing toward equip" at line 32. Browser; changes between runs (timing). Unresolved. |
| `tools/test-inspire-rim-facing.mjs` | D | none (no script, gate or doc) | FAIL 57s / FAIL 36s | Unwired. FAIL both trees (57 s): "actual entry exposes the previously lit inner fan" at line 43. Browser. Unresolved. |
| `tools/test-inspire-welcome.mjs` | D | none (no script, gate or doc) | PASS 0s / PASS 0s | Unwired. PASS here. |
| `tools/test-instrument-layer.mjs` | C | test:contracts / pos 2 | FAIL 1s / FAIL 1s | TIER-1 (chain pos 2). FAIL both trees: COV-1 "every shared instrument module in tools/ is a subject" expected 9 modules, actual adds tools/build-runtime-release.mjs. Registry not updated for a new shared tool module. Stale list, live gap. Do not delete (tier 1). |
| `tools/test-intro-clock.mjs` | A | check,check:browser,test,test:harness | PASS 0s / PASS 0s | PASS. check, test:harness. |
| `tools/test-intro-lifecycle.mjs` | E | test:contracts / pos 22 | FAIL 1s / FAIL 0s | R02 proof: `git show <sha>:organism/intro.js` -> "Error: Command failed". Env (B-i). test:contracts pos 22. |
| `tools/test-intro-menu-scroll.mjs` | D | none (no script, gate or doc) | FAIL 0s / FAIL 0s | Unwired, no reference. FAIL both trees: "ReferenceError: journeyFailed is not defined at onIntroInput (eval...:4:5)". Rig evals the slice of journey/boot/handoff.js between `  onIntroInput = (e) => {` (line 595) and `  introCaptureLive = true;` (617). That slice reads journeyFailed (declared line 160, closure-local) and journeyActive, which the rig never passes in. The rig has never executed the handler on either tree. Stale rig (C-type), unwired. |
| `tools/test-intro-readiness.mjs` | C | check,check:browser,test,test:contracts,test:harness / pos 24 | FAIL 0s / FAIL 0s | Wired (check, test, test:contracts, test:harness). FAIL both trees. Rig evals the slice of journey/journey.js from `  async function prepareGpu()` (line 2112) to `state.ready = prepareGpu();` (2396). Base: "ReferenceError: prepareGpuWarmup is not defined" (journey.js:48 now imports it from boot/hero-gpu.js; rig does not supply it). Merged: "ReferenceError: state is not defined" (slice now uses state). Stale rig. Same contract is exercised by test-gpu-preparation.mjs, which imports the real hero-gpu.js. |
| `tools/test-journey-failure-details.mjs` | D | none (no script, gate or doc) | PASS 48s / PASS 32s | Unwired. PASS here (48 s). Browser. |
| `tools/test-manifesto-concepts.mjs` | D | none (no script, gate or doc) | PASS 0s / PASS 0s | Unwired. PASS here. |
| `tools/test-manifesto-entry.mjs` | D | none (no script, gate or doc) | PASS 1s / PASS 0s | Unwired. PASS here. |
| `tools/test-manifesto-fit.mjs` | D | none (no script, gate or doc) | FAIL 36s / FAIL 142s | Unwired. FAIL both trees: "page.waitForFunction: Timeout 30000ms exceeded" at line 9. Browser. Unresolved. |
| `tools/test-manifesto-font-fallback.mjs` | D | none (no script, gate or doc) | FAIL 36s / FAIL 54s | Unwired. FAIL both trees: waitForSelector / waitForFunction timeout at line 28-30. Browser. Unresolved. |
| `tools/test-manifesto-hero-return.mjs` | D | none (no script, gate or doc) | PASS 3s / PASS 3s | Unwired. PASS here. Browser. |
| `tools/test-manifesto-link-decoration.mjs` | D | none (no script, gate or doc) | PASS 9s / PASS 7s | Unwired. PASS here (9 s). Browser. |
| `tools/test-manifesto-links.mjs` | D | none (no script, gate or doc) | FAIL 101s / FAIL 82s | Unwired. FAIL both trees: "locator.evaluate: Timeout 30000ms" (101 s). Browser. Unresolved. |
| `tools/test-manifesto-motion.mjs` | A | check,check:browser,test,test:unit | PASS 3s / PASS 2s | PASS. check, test:unit. |
| `tools/test-manifesto-return.mjs` | A | check,check:browser,test,test:unit | PASS 1s / PASS 1s | PASS. check, test:unit. |
| `tools/test-manifesto-scene-presentation.mjs` | D | none (no script, gate or doc) | PASS 1s / PASS 0s | Unwired. PASS here. |
| `tools/test-manifesto-scroll-overflow.mjs` | D | none (no script, gate or doc) | TIMEOUT 150s / TIMEOUT 150s | Unwired. TIMEOUT at QA 150 s cap in both trees ("Target page ... has been closed"). Browser. Unresolved (time budget). |
| `tools/test-mobile-hotspot-motion.mjs` | D | none (no script, gate or doc) | FAIL 39s / FAIL 47s | Unwired. FAIL both trees: "page.waitForFunction: Timeout 20000ms" Browser. Unresolved. |
| `tools/test-mobile-landing-anchor.mjs` | D | none (no script, gate or doc) | FAIL 1s / FAIL 2s | Unwired. FAIL both trees: "browserType.launch: Executable doesn't exist at /opt/pw-browsers/webkit-2336/pw_run.sh" (WebKit not installed). Env (B-ii-like). Touched by 80bac26 on this branch. |
| `tools/test-mobile-manifesto-range.mjs` | A | check,check:browser,test,test:unit | PASS 0s / PASS 0s | PASS. check, test:unit. |
| `tools/test-mobile-purpose-labels.mjs` | D | none (no script, gate or doc) | FAIL 82s / FAIL 86s | Unwired. FAIL both trees: "page.waitForFunction: Timeout 30000ms" (82 s). Browser; webkit option. Unresolved. |
| `tools/test-mobile-spore-entry.mjs` | D | none (no script, gate or doc) | FAIL 0s / FAIL 1s | Unwired. Pure node, FAIL both trees: "AssertionError: The expression evaluated to a falsy value" at line 82 `Math.abs(l.dur/baseline.landings[0].dur-1.45)<1e-9`. A literal ratio pin (1.45) computed inside the test; no source constant produces it. Stale-looking pin. |
| `tools/test-mobile-spore-visibility.mjs` | D | none (no script, gate or doc) | PASS 49s / PASS 39s | Unwired. PASS here (49 s). Browser. |
| `tools/test-nav-entry-continuity.mjs` | D | none (no script, gate or doc) | FAIL 41s / FAIL 68s | Unwired. FAIL both trees (41 s): "real startup sampled the visible preboot/live handoff". Browser. Unresolved. |
| `tools/test-nav-readiness-cold.mjs` | D | none (no script, gate or doc) | FAIL 43s / FAIL 64s | Unwired. FAIL both trees (43 s): "real readiness contains multiple visible fade frames". Browser. Unresolved. |
| `tools/test-no-scroll-navigation.mjs` | A | check,check:browser,test,test:unit | PASS 1s / PASS 0s | PASS. check, test:unit. |
| `tools/test-page-lifetime.mjs` | C | test:contracts / pos 44 | FAIL 1s / FAIL 0s | Wired test:contracts pos 44. FAIL both trees. D1 count pin: expected referenced:148, actual referenced:171, scanned:166 (module graph grew). Count literal, stale. The "multiForm" empty-set part passes. |
| `tools/test-portrait-baked.mjs` | A | test:contracts / pos 17 | PASS 1s / PASS 1s | PASS. test:contracts pos 17. |
| `tools/test-portrait-dealer.mjs` | A | test:contracts / pos 16 | PASS 1s / PASS 2s | PASS. test:contracts pos 16. |
| `tools/test-portrait-harness.mjs` | A | harness, imported by chain suites | PASS 1s / PASS 1s | Harness (self-declared "NOT a test file itself"); imported by portrait-* suites in the chain. PASS. |
| `tools/test-portrait-lifecycle.mjs` | A | test:contracts / pos 19 | PASS 3s / PASS 3s | PASS. test:contracts pos 19. |
| `tools/test-portrait-paint.mjs` | E | test:contracts / pos 35 | FAIL 0s / FAIL 0s | A01a-2 one-shot proof (header: "pre-move digests pinned as SOURCE LITERALS, captured before any file moved"). Pure node. FAIL both trees: "FAIL 2 photo/rest/exposure<1/no-mirror/origin-cell - transcript digest === pre-move literal". Red on base with no env cause. Its fixture tools/fixtures/a01a-2-portraits.pre-move.js.txt is never read (see E-fixtures). test:contracts pos 35. |
| `tools/test-portrait-perturbation.mjs` | A | test:contracts / pos 20 | PASS 5s / PASS 5s | PASS. test:contracts pos 20. |
| `tools/test-portrait-textures.mjs` | A | test:contracts / pos 18 | PASS 1s / PASS 1s | PASS. test:contracts pos 18. |
| `tools/test-pose-oracle.mjs` | A | test:contracts / pos 38 | PASS 0s / PASS 0s | PASS. test:contracts pos 38. Reads tools/pose-oracle.matrix.json.txt (live). |
| `tools/test-prelude-camera.mjs` | D | none (no script, gate or doc) | PASS 1s / PASS 0s | Unwired. PASS here. |
| `tools/test-purpose-arrival.mjs` | D | none (no script, gate or doc) | FAIL 79s / FAIL 81s | Unwired. FAIL both trees: "page.waitForFunction: Timeout 20000ms" (79 s). Browser. Unresolved. |
| `tools/test-purpose-copy-fit.mjs` | D | none (no script, gate or doc) | PASS 4s / PASS 5s | Unwired. PASS here (4 s). Browser, DOM-only. Overlaps test-purpose-mobile-copy (F). |
| `tools/test-purpose-copy-live.mjs` | D | none (no script, gate or doc) | FAIL 127s / FAIL 95s | Unwired. FAIL both trees: "page.screenshot: Timeout 30000ms" (127 s). Browser. Unresolved. |
| `tools/test-purpose-label-fade.mjs` | D | none (no script, gate or doc) | PASS 0s / PASS 0s | Unwired. PASS here. |
| `tools/test-purpose-mobile-copy.mjs` | D | none (no script, gate or doc) | TIMEOUT 150s / TIMEOUT 151s | Unwired. TIMEOUT at 150 s cap both trees; log shows its per-width checks printing. Browser. Measures the same heading box as test-purpose-copy-fit (F). |
| `tools/test-rail-handoff.mjs` | C | check,check:browser,test,test:unit | FAIL 0s / FAIL 0s | Wired (check, test, test:unit). Pure node. FAIL both trees at line 145-146: `assert.equal(PHONE_FINAL_SCENE_LIFT_PX, 72, ...)` but journey/layout/final-composition.js:7 = 20 on base and merged (also PHONE_FINAL_COMPOSITION_LIFT_PX=30 at line 3, so "stronger independent lift" reads false). Literal stale on base. Earlier assertions in the file pass; the file is not just this line. |
| `tools/test-render-baseline.mjs` | C | test:contracts / pos 53 | FAIL 1s / FAIL 1s | Wired test:contracts pos 53. FAIL both trees: "Error: baked: no geometry for connect/strands" (journey/lib/baked.js:325). Cause: baked.js fills its bins via fetchBakedAssets(fetch) on a file: URL (import.meta.url). Node fetch rejects file: URLs on every OS (verified here: "fetch failed"), the fetch is swallowed, bins stay empty. Environment-independent rig fault. |
| `tools/test-render-determinism.mjs` | C | test:contracts / pos 15 | FAIL 1s / FAIL 1s | Wired test:contracts pos 15. FAIL both trees with the same "baked: no geometry for connect/strands" (same rig fault as test-render-baseline). |
| `tools/test-render-perturbation.mjs` | A | test:contracts / pos 14 | PASS 1s / PASS 0s | PASS. test:contracts pos 14. |
| `tools/test-renderer-resources.mjs` | E | test:contracts / pos 6 | FAIL 0s / FAIL 1s | R04 proof: `git show <sha>:organism/renderer.js` -> "Error: Command failed". Env (B-i). test:contracts pos 6. |
| `tools/test-rest-authority.mjs` | A | test:contracts / pos 49 | PASS 0s / PASS 1s | PASS. test:contracts pos 49. |
| `tools/test-rest-composition.mjs` | A | test:contracts / pos 48 | PASS 1s / PASS 0s | PASS. test:contracts pos 48. |
| `tools/test-rest-warm-queue.mjs` | A | check,check:browser,test,test:unit | PASS 0s / ? | NEW in this branch. PASS. check, test:unit. |
| `tools/test-road.mjs` | E | test:contracts / pos 36 | FAIL 1s / FAIL 0s | A05a extraction proof (GATE-01): `git show <sha>:journey/scroll.js` -> "Error: Command failed". Its own header: "E4 WAS A MOVE PROOF, AND IT IS NOW A PROPERTY (converted 2026-08-25)". Env (B-i) for the red. test:contracts pos 36. |
| `tools/test-runtime-release.mjs` | A | check,check:browser,test:runtime | PASS 1s / PASS 1s | PASS. test:runtime. Its runtime-release check is the one that runs in pre-push (see pre-push-runtime). |
| `tools/test-scroll-perturbation.mjs` | C | test:contracts / pos 13 | FAIL 0s / FAIL 0s | Wired test:contracts pos 13. FAIL both trees: "Error: perturbation anchors no longer match source". Its anchor `guarded('seams', () => seams.update(frame.routeP));` does not occur in journey/journey.js on base (0 matches) or merged (0); the source line is `seams.update(frame.routeP, frame.scenePresentedP)` (journey.js:1807). It throws loudly, so it is not a silent green. Stale anchor. |
| `tools/test-scroll-trace.mjs` | A | test:contracts / pos 11 | PASS 0s / PASS 1s | PASS. test:contracts pos 11. |
| `tools/test-serve-range.mjs` | A | check,check:browser,test,test:harness | PASS 1s / PASS 2s | PASS. test:harness, check. |
| `tools/test-spore-cap-flow.mjs` | D | none (no script, gate or doc) | PASS 2s / PASS 4s | Unwired. PASS here (2 s). |
| `tools/test-spore-descent-pace.mjs` | D | none (no script, gate or doc) | PASS 3s / PASS 3s | Unwired. PASS here. |
| `tools/test-spore-lifetime.mjs` | D | none (no script, gate or doc) | PASS 0s / PASS 0s | Unwired. PASS here. |
| `tools/test-spore-recruitment.mjs` | D | none (no script, gate or doc) | PASS 6s / PASS 5s | Unwired. PASS here (6 s). |
| `tools/test-spore-recycling.mjs` | D | none (no script, gate or doc) | FAIL 37s / FAIL 43s | Unwired. FAIL both trees: "page.waitForFunction: Timeout 30000ms" (37 s). Browser. Unresolved. |
| `tools/test-spore-source-position.mjs` | D | none (no script, gate or doc) | PASS 0s / PASS 1s | Unwired. PASS here. |
| `tools/test-spores-lifecycle.mjs` | E | test:contracts / pos 33 | FAIL 1s / FAIL 0s | R03 proof: `git show <sha>:organism/spores.js` -> "Error: Command failed". Env (B-i). test:contracts pos 33. |
| `tools/test-startup-recovery.mjs` | A | check,check:browser,test,test:contracts,test:harness / pos 27 | PASS 0s / PASS 0s | PASS. check, test, test:contracts, test:harness. |
| `tools/test-static-content.mjs` | A | check,check:browser,test,test:static | PASS 0s / PASS 0s | PASS. test:static, check. |
| `tools/test-transition.mjs` | A | test:contracts / pos 40 | PASS 1s / PASS 2s | PASS. test:contracts pos 40. Imports test-director-resize. |
| `tools/test-ui-closure.mjs` | A | test:contracts / pos 42 | PASS 1s / PASS 2s | PASS. test:contracts pos 42. |
| `tools/test-ui-lifecycle.mjs` | C | test:contracts / pos 31 | FAIL 1s / FAIL 1s | Wired test:contracts pos 31. FAIL both trees. UIL-T1 expected [0,30,0,10], actual [0,31,0,10] (one new owner.listen). UIL-T2 journey/rail.js: actual [2,27,0,8]: two raw addEventListener sites that the suite forbids. Literal count pins plus a real raw-listener drift. Pins stale; the raw listeners are a live finding. |
| `tools/test-gate-capture.py` | A-unverified | test:harness (python3) | not run in QA | Python gate test, not executed in the QA run. |
| `tools/test-gate-package-public.py` | A-unverified | test:harness (python3) | not run in QA | Python gate test, not executed in the QA run. |
| `tools/test-gate-rebuild.py` | A-unverified | test:harness (python3) | not run in QA | Python gate test, not executed in the QA run. |
| `tools/test_capture_check.py` | A-unverified | pre-commit (comment-only reference: tools/pre-commit:211,219) | not run in QA | Drives the capture section of tools/pre-commit; not executed in the QA run. |

## Evidence for the non-obvious buckets

**B (environment).**
- `tools/test-gpu-preparation-browser.mjs`: `browserType.launch: Failed to launch chromium because executable doesn't exist at /Applications/Google Chrome.app/Contents/MacOS/Google Chrome`. Hard-coded macOS path at line 22. Same error in both trees.
- `tools/test-epilogue-retire.mjs`: `TIMEOUT` at the 150 s QA cap in both trees, no assertion logged. Its `CHROME` finder (lines 253-257) does find `/usr/bin/google-chrome`, so the run is slow rather than broken. Not proven.

**E (one-time move or behaviour-preservation proofs).** Every E item either compares against a pinned pre-change file or fixture, or reads a `git show <sha>` baseline. Eight of them red here only because the sha is missing. The pinned-sha rows:
- `tools/test-animation-lifecycle.mjs`: "Error: Command failed: git show 6967a36ab309af7057336be64d6f0f9dd3c41b21:organism/animation.js"
- `tools/test-card-warming.mjs`: "fatal: path 'journey/cards/index.js' exists on disk, but not in '6967a36...'"
- `tools/test-discord-card.mjs`: "fatal: path 'journey/cards/discord.js' exists on disk, but not in '6967a36...'"
- `tools/test-global-hooks.mjs`: "HarnessFault ... base source for journey/dial.js is unreadable at 6967a36"
- `tools/test-intro-lifecycle.mjs`: "git show ...:organism/intro.js"; `tools/test-renderer-resources.mjs`: "git show ...:organism/renderer.js"; `tools/test-road.mjs`: "git show ...:journey/scroll.js"; `tools/test-spores-lifecycle.mjs`: "git show ...:organism/spores.js"

`tools/test-portrait-paint.mjs` is the exception: pure node, no sha. It fails on both trees with "transcript digest === pre-move literal", so it is red without an environment cause.

**C (stale on both trees).** Each row names the source line that contradicts the rig:
- `tools/test-intro-readiness.mjs`: rig slices `journey/journey.js` from `  async function prepareGpu()` (line 2112) to `state.ready = prepareGpu();` (2396). Base error: `ReferenceError: prepareGpuWarmup is not defined`. That function moved to `journey/boot/hero-gpu.js` and is imported at `journey/journey.js:48`, which the rig does not supply.
- `tools/test-intro-menu-scroll.mjs`: rig evals `journey/boot/handoff.js` lines 595-617 (`onIntroInput`). That body reads `journeyFailed` (declared at line 160 as a closure local) and `journeyActive`. The rig never passes them: `ReferenceError: journeyFailed is not defined`. It has never reached the handler's logic on either tree.
- `tools/test-scroll-perturbation.mjs`: anchor `guarded('seams', () => seams.update(frame.routeP));` has zero matches in `journey/journey.js`, on base or merged. The source line is `seams.update(frame.routeP, frame.scenePresentedP)` (journey.js:1807). The test throws loudly ("perturbation anchors no longer match source"), so it is not a silent green.
- `tools/test-render-baseline.mjs`, `tools/test-render-determinism.mjs`: `baked: no geometry for connect/strands` (`journey/lib/baked.js:325`). `baked.js` fills its bins through `fetchBakedAssets(fetch)` on a `file:` URL. Node's `fetch` rejects `file:` URLs on every OS (checked here: "fetch failed"), the rejection is swallowed, and the bins stay empty. This is a rig fault independent of the machine.
- `tools/test-rail-handoff.mjs` line 145-146: `assert.equal(PHONE_FINAL_SCENE_LIFT_PX, 72, ...)`. The constant is 20 on base and merged (`journey/layout/final-composition.js:7`). The earlier assertions in that file pass.
- `tools/test-connect-motion.mjs` line 72: `rest.pos.y - 2.75`. Its own comment says these two lines are "SUBORDINATE SINCE REST-01 (2026-08-24)". `journey/portrait.js:257` records "tgtUp 2.75 -> 1.50 (2026-08-05)".
- `tools/test-page-lifetime.mjs` D1: `expected {"referenced":148,...} actual {"referenced":171,"scanned":166}`. Count pin on a graph that grew.
- `tools/test-frame-publication.mjs` C8: expected 13 frame reads over 4 members, actual 15 over 6 (`scenePresentedP` added). `A1` and `C5` drifted the same way.
- `tools/test-ui-lifecycle.mjs` UIL-T1: expected `[0,30,0,10]`, actual `[0,31,0,10]`. UIL-T2 finds 2 raw `addEventListener` sites in `journey/rail.js`. That second one is a real finding, not stale.
- `tools/test-assertion-provenance.mjs` AP1: `expected: []`, actual: test-gpu-preparation, test-inspire-arrival-lock, test-manifesto-return, test-mobile-manifesto-range, test-rest-warm-queue, test-startup-recovery. Its registry was not updated when those suites were wired.
- `tools/test-gate-composition.mjs` GC-ORDER / GC-TIERS: pinned order does not match the 53-entry chain (`t2 "9-51 NOT CONTIGUOUS"`). Its GC-WIRED row is accurate: it reports the unexempted unwired suites.
- `tools/test-chapter-contract.mjs` T2: `final: 1` vs expected `final: 0` on base. `journey/ui/rail-handoff.js:31,72,82,88` name the `final` chapter in UI code. This is a live violation of a real invariant, so it is not a stale rig.
- `tools/test-instrument-layer.mjs` COV-1: a new shared tool module (`tools/build-runtime-release.mjs`) is not in the pinned list. A live gap, not a stale rig.
- `tools/test-coverage-floor.mjs`: derivative. It fails because three children fail.

## Deletion candidates (ranked; "HIGH" means provably dead on any environment)

Edits listed are the non-runtime references found by grep. Re-run the grep before editing. A deletion is only safe when every listed reference is also removed (package.json chain entries, the GC pins in `test-gate-composition.mjs`, the RECEIVERS/UNSCANNABLE registries in `test-assertion-provenance.mjs`, the `test-coverage-floor.mjs` suite set, and any harness import).

### C (stale on both trees)

| Rank | Candidate | Scope | Why | Edits needed for a clean delete |
|---|---|---|---|---|
| HIGH | `tools/test-intro-menu-scroll.mjs` | whole file | Unwired. Red on both trees with ReferenceError before any logic runs. No reference anywhere. | None. Nothing else names it. Alternative: supply `journeyFailed` / `journeyActive` in the rig. |
| MEDIUM | `tools/test-intro-readiness.mjs` | whole file, or rewrite the rig to import `prepareGpuWarmup` from `journey/boot/hero-gpu.js` | Wired (check, test, test:contracts, test:harness). Can never pass on either tree. Same contract is covered by `test-gpu-preparation.mjs`, which imports the real module. | package.json: `check`, `test`, `test:contracts` (pos 24), `test:harness`. test-gate-composition GC pins. test-assertion-provenance receiver list. test-coverage-floor suite set. test-rest-warm-queue mention. |
| MEDIUM | `tools/test-render-baseline.mjs`, `tools/test-render-determinism.mjs` | prefer rewrite (feed bytes from disk); delete only if owner accepts losing the determinism pin | Red on both trees for a Node fetch limitation. Would be a silent loss if simply removed. | baseline: package.json pos 53; tools/test-frame-publication, test-portrait-paint, test-input-claim, test-transition, test-renderer-resources, test-render-perturbation, test-road, test-ui-closure, run-contracts.mjs (comment); test-gate-composition, test-assertion-provenance, test-coverage-floor; production comments in journey/ui/owner.js, media.js, ui.js, backdrop.js, rail.js, chapters/owned/portraits.js, chapters/final/index.js, organism/organism.js. determinism: package.json pos 15; tools/render-report-lib.mjs and render-report-generate.mjs (they name it); test-gate-composition, test-assertion-provenance, test-coverage-floor. |
| MEDIUM | `tools/test-scroll-perturbation.mjs` | whole file | Anchor string gone from journey.js on both trees; throws loudly. Wired pos 13. | package.json pos 13; tools/test-c01-harness.mjs; test-gate-composition; test-assertion-provenance; test-coverage-floor; tools/test-road.mjs. |
| MEDIUM | `tools/test-connect-motion.mjs` lines ~65-73 only | two lines (`rest.pos.y - 2.75`) and their comment | Self-declared subordinate to its own REST-01 section; pinned value superseded. The file's other sections are not in scope. | comments only: journey/chapters/equip/camera.js, journey/portrait.js (cite the pin); tools/test-rest-composition.mjs, tools/test-declared-conversions.mjs, tools/README.md, CONTRIBUTING.md (cite it as the pin example). Keep those citations accurate after the edit. |
| LOW | `tools/test-rail-handoff.mjs` lines 145-146 (the 72 pin) | re-baseline or demote the pin; do not delete the file | Red on base; the rest of the file is outside the failing assertion. | none |
| LOW | `tools/test-page-lifetime.mjs` (D1 counts), `tools/test-ui-lifecycle.mjs` (UIL-T1 count) | re-baseline counts | Literal count pins; their non-count assertions pass. UIL-T2 is a real raw-listener finding. | none |
| NOT A CANDIDATE | `tools/test-chapter-contract.mjs` (T2), `tools/test-instrument-layer.mjs` (COV-1), `tools/test-assertion-provenance.mjs`, `tools/test-gate-composition.mjs`, `tools/run-contracts.mjs`, `tools/test-coverage-floor.mjs` | — | T2 is a live violation. The other four are tier-1 gates (chain pos 1-3) or plumbing. Deleting them weakens the net. | — |

### D (orphans: no script, gate, registry or doc)

| Rank | Candidate | Why | Edits |
|---|---|---|---|
| HIGH | `tools/test-intro-menu-scroll.mjs` | See C. | None |
| MEDIUM | `tools/test-mobile-spore-entry.mjs` | Pure node. Red on both trees at line 82 (`dur/… - 1.45`). The 1.45 ratio is a literal inside the test; it is not a source constant. Unverified against source; hence MEDIUM. | None |
| MEDIUM (wire or delete) | Unwired and PASS here: `tools/test-body-dissolve.mjs`, `test-cap-clearance.mjs`, `test-colony-connected-lines.mjs`, `test-colony-retirement.mjs`, `test-connect-hivemind-welcome.mjs`, `test-connect-phone-light.mjs`, `test-equip-markers.mjs`, `test-final-background-tissue.mjs`, `test-final-ring-handoff.mjs`, `test-final-spore-ownership.mjs`, `test-ground-departure.mjs`, `test-ground-entry.mjs`, `test-hero-body-fog.mjs`, `test-hero-copy-growth.mjs`, `test-inspire-welcome.mjs`, `test-journey-failure-details.mjs`, `test-manifesto-concepts.mjs`, `test-manifesto-entry.mjs`, `test-manifesto-hero-return.mjs`, `test-manifesto-link-decoration.mjs`, `test-manifesto-scene-presentation.mjs`, `test-mobile-spore-visibility.mjs`, `test-prelude-camera.mjs`, `test-purpose-copy-fit.mjs`, `test-purpose-label-fade.mjs`, `test-spore-cap-flow.mjs`, `test-spore-descent-pace.mjs`, `test-spore-lifetime.mjs`, `test-spore-recruitment.mjs`, `test-spore-source-position.mjs` | No gate runs them, so they protect nothing today, but they pass here. Deleting is a "wire or delete" decision for the owner, not a dead-code fact. | None (no references) |
| LOW | Unwired and FAIL here (browser, unresolved): `test-connect-arrival`, `test-equip-arrival`, `test-equip-visibility`, `test-equip-welcome`, `test-inspire-departure`, `test-inspire-rim-facing`, `test-manifesto-fit`, `test-manifesto-font-fallback`, `test-manifesto-links`, `test-mobile-hotspot-motion`, `test-mobile-landing-anchor`, `test-mobile-purpose-labels`, `test-nav-entry-continuity`, `test-nav-readiness-cold`, `test-purpose-arrival`, `test-purpose-copy-live`, `test-spore-recycling`, `test-gpu-context-recovery-browser` (macOS path) | Cannot classify without a browser run. Not deletion candidates on this evidence. | None |
| LOW | Unwired and TIMEOUT: `test-manifesto-scroll-overflow`, `test-purpose-mobile-copy` | Time budget only. | None |
| n/a | `tests/deck-*.test.mjs` (4) | Referenced by docs runbooks, so they are not orphans. Passing. | — |

### E (one-time move and behaviour-preservation proofs)

What the repo says about retiring these. There is no retirement rule in `CONTRIBUTING.md` (grep for pre-move, move proof, retire, fixture finds nothing that governs them). The rules that do exist are in code:

- `tools/test-gate-composition.mjs` lines 168-181 (DIET-01, 2026-08-22): "the six one-shot extraction proofs ... are RETIRED to docs/code-health/evidence/2026-08-21-elegance-run-01/retired-suites/, still runnable ... Each proved that ONE historical extraction preserved bytes; that property expired at acceptance, and their line-keyed pins red the gate whenever any lane touches the pinned files (D64/D66)."
- `tools/test-hot-state.mjs` lines 61-64 and 121 (U03, 2026-08-22): "a later order that rewrites one of those regions must retire the corresponding pair rather than work around it ... retiring five of fourteen leaves no pre-order file to rebuild, so the section went as a whole. It REFUSED before it was removed."
- `journey/route.js` and `tools/test-road.mjs:529`: "E4 WAS A MOVE PROOF, AND IT IS NOW A PROPERTY (converted 2026-08-25 ...)". The conversion path is also an accepted outcome.
- `CONTRIBUTING.md`, "Demote, don't delete": "The coordinate usually still holds an approved composition ... What it loses is its *authority*."

| Rank | Candidate | Proves | Status here | Fixture size / dependency | Edits to retire |
|---|---|---|---|---|---|
| HIGH (retire from gate) | `tools/test-portrait-paint.mjs` | A01a-2 pre-move digests as source literals | FAIL both trees (no env cause: pure node; "transcript digest === pre-move literal"). Its fixture is never read. | `tools/fixtures/a01a-2-portraits.pre-move.js.txt` 85,374 B, unread | package.json `test:contracts` pos 35; test-gate-composition pins; test-assertion-provenance; test-coverage-floor; tools/self-controls.mjs; comment in journey/chapters/owned/portrait-paint.js |
| MEDIUM | `tools/test-animation-lifecycle.mjs` (R01), `tools/test-intro-lifecycle.mjs` (R02), `tools/test-spores-lifecycle.mjs` (R03), `tools/test-renderer-resources.mjs` (R04), `tools/test-global-hooks.mjs` (J04c), `tools/test-road.mjs` (A05a), `tools/test-card-warming.mjs` (U01a), `tools/test-discord-card.mjs` (U01d) | Behaviour-preservation against `git show 6967a36:...` | Red here only (missing sha). Verify on the owner's full clone before any retirement. | none | Per test: package.json pos 21 / 22 / 33 / 6 / 43 / 36 / 28 / 29 respectively. Mentions in test-gate-composition, test-assertion-provenance, test-coverage-floor (all eight). animation: test-card-warming, test-spores-lifecycle, test-portrait-paint, test-card-registry, test-renderer-resources. intro: test-card-warming, test-spores-lifecycle, test-card-registry, test-renderer-resources. spores: test-comment-stripper, test-render-baseline, tools/self-controls.mjs, test-renderer-resources. renderer: test-comment-stripper, self-controls. global-hooks: journey/hero-field.js (comment). road: journey/scroll.js, road.js, claim.js (comments), test-input-claim, test-render-perturbation. card-warming: journey/cards/index.js (comment), test-card-registry, test-card-icons. discord: journey/cards/discord.js (comment), test-card-warming. |
| LOW | `tools/test-card-registry.mjs` (U01b, pos 45), `tools/test-card-icons.mjs` (U01c, pos 46) | Pre-move cards index identity and reverse application | PASS both trees. | `u01b-cards-index.pre-move.js.txt` 10,264 B; `u01c-cards-index.pre-move.js.txt` 9,711 B (each read only by its own test) | card-registry: package.json pos 45; journey/cards/registry.js (comment); test-gate-composition; test-assertion-provenance; test-coverage-floor; test-card-icons (mention). card-icons: package.json pos 46; journey/cards/icons.js (comment); test-card-registry; test-gate-composition; test-assertion-provenance; test-coverage-floor. |

E fixtures (`tools/fixtures/`):

| Rank | File | Size | Read by | Verdict |
|---|---|---|---|---|
| HIGH | `h01-bake-baseline-sha256.txt`, `h02-bake-baseline-sha256.txt`, `h03-bake-baseline-sha256.txt` | 247 / 620 / 625 B | nothing (no file names them; grep for `h01-bake`, `h02-bake`, `h03-bake`, `bake-baseline-sha256` returns zero hits outside themselves) | Hashes of `static/geom/*` at 6967a36. Delete, or move to the same evidence location as the retired suites. |
| MEDIUM | `a01a-2-portraits.pre-move.js.txt` | 85,374 | nothing | Only in-tree copy of the pre-move portraits bytes. Move, do not delete, if it is the evidence trail. |
| MEDIUM | `route-def04.fixture.mjs` (F03 removal proof), `route-legacy.fixture.mjs` | 4,138 / 5,707 | nothing executes them. Cited only in comments: `journey/route.js:77`, `:527-529` | Edit those two comments with the deletion. |
| LOW | `structure.compat-fixture.mjs` (5,002), `route.compat-fixture.mjs` (16,489), `symbols.compat-fixture.mjs` (8,306), `constants.compat-fixture.mjs` (7,603), `aliases.compat-fixture.mjs` (6,164) | 43.6 KB | `journey/structure.test.mjs` (wired, PASS, test:unit and check). `constants.compat-fixture` is also cited by `journey/ui/hotspot-frame.js:88` | Delete only together with `journey/structure.test.mjs`, or its import lines. |

### F (duplicate or subsumed)

| Candidate | Overlap | Confidence |
|---|---|---|
| `tools/test-connect-motion.mjs` lines 72-73 | Subsumed by the same file's REST-01 section, which the file's own comment names as governing. | MEDIUM (already in C) |
| `tools/test-intro-readiness.mjs` | Same `prepareGpu` / timeout contract as `tools/test-gpu-preparation.mjs` (which imports `prepareHeroGpu` / `prepareGpuWarmup` from the real module, line 2 and 97-100). The readiness rig's `prepareHeroGpu(hung,{timeoutMs:5})` case (its line 58) has no partner in gpu-preparation. Partial. | MEDIUM |
| `tools/test-equip-welcome.mjs` vs `tools/test-equip-arrival.mjs` | Both assert the two-welcome slot order `[0,1]` ("mission: one welcome per icon" at arrival line 37; `calls.map(slot)` at welcome line 48). Both unwired, both red on both trees. | LOW |
| `tools/test-purpose-copy-fit.mjs` vs `tools/test-purpose-mobile-copy.mjs` | Both measure the `.j-h` heading box at phone widths (fit line 58; mobile-copy line 46 "copy clears painted circles and labels"). Partial. Both unwired. | LOW |
| `tools/test-card-registry.mjs` vs `tools/test-card-icons.mjs` | Same pre/post-move identity mechanism twice (registry lines 364-376; icons lines 378-388). | LOW |

### G (retired by the repo's own docs; files already absent)

| Name | Retirement source | Files present? | Dangling references to clean |
|---|---|---|---|
| `test-ring-split`, `test-canopy-split`, `test-terrain-split`, `test-tendrils-split`, `test-owned-substrate-split`, `test-clones-split` | `tools/test-gate-composition.mjs:168-181` (DIET-01) | no | `tools/stage-tree.mjs` (all six), `tools/mutant-registry.mjs` (canopy, terrain, tendrils), `tools/self-controls.mjs` and `tools/strip-comments.mjs` (ring), `tools/test-comment-stripper.mjs` (tendrils, owned-substrate), `tools/test-assertion-provenance.mjs` (clones), `tools/test-gate-composition.mjs` and `tools/test-coverage-floor.mjs` (all) |
| `test-portrait-remix` | same DIET-01 list; `journey/chapters/owned/portrait-remix.js:8-10` is a live production file whose header says "THIS IS A MOVE" | no | `tools/self-controls.mjs`, `tools/test-card-registry.mjs`, `tools/check-cycles.mjs`, `tools/test-gate-composition.mjs`, `tools/test-coverage-floor.mjs` |
| `test-stage-tree` | named only in `tools/stage-tree.mjs` | no | `tools/stage-tree.mjs` |
| TRACE-01 kit (`tools/trace/README.md`) | README line 3-7: kit moved to `docs/code-health/evidence/2026-08-21-elegance-run-01/retired-suites/trace/` | kit absent from `tools/trace/` (correct); the destination directory is absent here too | `tools/trace/README.md` itself |

Note: `docs/code-health/evidence/` does not exist in this checkout, and `git log --all -- docs/code-health/evidence` is empty. There are 98 references to that path across `journey/*.js` comments, `organism/renderer.js:69`, `organism/spores.js:416`, `tools/test-gate-composition.mjs`, `tools/trace/README.md`, and others. Those references are dangling on this branch, whatever the retirement status is.

## Non-test dead weight (sizes from `du`; references from grep)

| Path | Size | Tracked | Referenced by | Verdict |
|---|---|---|---|---|
| `runtime/<sha256>/` (30 release dirs, plus `runtime-release.js`) | 331 MB | 5,718 files | `tools/build-runtime-release.mjs:2,13`; `runtime-release.js:1`; `DEPLOY.md:90-92` | **KEEP.** Rule, verbatim: `runtime-release.js:1` "Generated by tools/build-runtime-release.mjs; retain every runtime release." DEPLOY.md:92: "use retained `runtime/<sha256>/` URLs. Do not overwrite or prune those directories." This branch also needs a new release directory (`npm run runtime:check` is red on merged, "Runtime release is stale"). That is a build, not a deletion. |
| `archive/` | 103 MB | 57 | `eslint.config.js:7` ignore; `deploy/public-files.json:103` exclude; comments in `main.js:951`, `journey/route.js:24` | Mostly keep. `archive/snapshots/` (91 MB: two 46 MB `journey-v6-snapshot-*.tar.gz`) is referenced by nothing; grep hits for "snapshots" are false positives. MEDIUM: move out of git. |
| `static/captures/_check/` | 14 MB | 10 PNG | `tools/capture.py` `--check-out` (line 926+), gate scripts; `deploy/public-files.json:68` exclude | KEEP (gate artifact). |
| `.desloppify/` | 1.1 MB | 9 | `eslint.config.js:6` ignore; `deploy/public-files.json:100` exclude; docs | LOW. No tool reads it. |
| `journey-v6/` | 8 KB | 1 (`index.html`) | **Published**: `deploy/public-files.json:54,86` (include `journey-v6/index.html`) | KEEP. Not dead. |
| `journey-v6-plan/` | 36 MB (34 MB `reference-images`) | 57 | excluded from public (`deploy/public-files.json:106`), eslint ignore, comments in `content/content.js` and `flags.js` | MEDIUM: move out of the repo. |
| `tools/dwell-oracle.trace.json.txt` (64 KB), `tools/pose-oracle.matrix.json.txt` (132 KB) | 196 KB | 1 each | read by `tools/test-dwell-oracle.mjs:105`, `tools/test-pose-oracle.mjs:61` | KEEP (live inputs). |
| `tools/deck/` `check-*.mjs/py` scripts | 356 KB total dir | — | 20 of them (carousel, chat-handoff, chat-morph, core-handoff-continuity, core-return-paint, demo-diagnostics, demo-failures, demo-progress, demo-returns, header-diagnostics, highlight-handoff, mink-motion, mink-paint-handoff, mink-scale, network-mask, reverse-handoffs, slide5-underline, stack-flags, stack-visibility, url-history) have zero references outside themselves | MEDIUM: not run by any gate; may be run by hand through `tools/deck/lab.mjs`. |
| Root `ab.html` (4 KB) + `design-reference.png` (1.5 MB) | 1.5 MB | yes | `ab.html` loads the PNG; nothing loads `ab.html` | MEDIUM (a review page, owner intent unknown). Not published (not in `deploy/public-files.json`). |
| Root `compare.html` (4 KB) + `reference.jpg` (120 KB) | 124 KB | yes | `compare.html` loads the JPG; nothing loads `compare.html` | MEDIUM, same as above. |
| Root `golden-mushroom.html` (4 KB) | 4 KB | yes | none | HIGH (unreferenced, unpublished). |
| Root `golden-mushroom-page.html` (4 KB) | 4 KB | yes | comment only: `main.js:951` says it was archived to `archive/golden-mushroom-page.html`; that archive copy exists | MEDIUM (stale duplicate of archive). |
| Root `scorecard.png` (40 KB) | 40 KB | yes | none | HIGH (unreferenced). |
| `404.html`, `index.html`, `reference.jpg` | — | — | `404.html` is in `deploy/public-files.json` | `404.html` keep; the others as above. |

## Dangling references to fix before any deletion

- `tools/test-preparation-lifecycle.mjs` is named in `CONTRIBUTING.md:29-32` ("One suite (`tools/test-preparation-lifecycle.mjs`) contains NUL bytes") and in `tools/test-gate-composition.mjs` / `tools/test-assertion-provenance.mjs`. The file does not exist.
- `tools/test-c06-registry.mjs` is named in `test-gate-composition`, `test-chapter-contract`, `test-assertion-provenance`, `test-coverage-floor`. The file does not exist.
- `tools/test-portrait-remix.mjs` is named in `tools/self-controls.mjs`. The file does not exist.
- The G names above (`test-*-split`, `test-clones-split`, `test-stage-tree`) are named in `mutant-registry.mjs`, `stage-tree.mjs`, and others.
- The `docs/code-health/evidence/...` path (98 hits) is absent in this checkout.

## What this triage did not do

- No browser run. Browser-based C and B calls are log-based.
- No check of the owner's full clone. Every E-type sha claim needs that check.
- No Python test execution.
- The deletions above were not made. This is a read-only classification.
