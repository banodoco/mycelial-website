# H4 — Rules of the road for the motion/perf/CSS batch

Read-only pass. Nothing in /home/user/mycelial-website was edited; no npm install; no suites run.
Cites are file:line in the repo. VERIFIED = read in source/docs or checked by ls/grep. HYPOTHESIS = inferred, not run.
Clone is shallow (`git rev-list --count HEAD` = 1), so history-based conventions cannot be checked.

## 0. TL;DR checklist

- [ ] JS in the runtime import closure needs a new runtime release. Closure = main.js, organism/hero-spores.js, organism/hero-spores-worker.js, hero-deco.js and everything they import (tools/build-runtime-release.mjs:9, :38-66). Run `npm run runtime:build`, then stage the new `runtime/<sha256>/` and `runtime-release.js`.
- [ ] CSS and index.html are NOT in the runtime. hero.css, mycelial.css, journey/site.css, journey/cards/cards.css are linked directly (index.html:52-56), so CSS goes live on deploy with no runtime build.
- [ ] content/content.js IS in the closure: copy edits need a runtime build AND `node tools/build-static-content.mjs` (static/index.html).
- [ ] Acceptance = `npm run check` AND `CHECK_ORIGIN=http://localhost:8137 npm run check:captures` (CONTRIBUTING.md:166-193). Add `node tools/browser-smoke.mjs` when touching boot code or import graph (CONTRIBUTING.md:139-141).
- [ ] This container cannot run the capture gate or the bake: capture.py hard-codes a macOS Chrome path with no env override (tools/capture.py:106, :494-496); bake-geom.py imports it (tools/bake-geom.py:90).
- [ ] `npm install` is required (node_modules absent). build-runtime-release.mjs imports `espree`, which is NOT in package.json; it resolves only as eslint's transitive dependency (tools/build-runtime-release.mjs:7; package-lock.json:1225).
- [ ] Pins that break on timing/motion/rail/typography changes: section 4 (worst: literal copies at test-manifesto-motion.mjs:88-90, test-no-scroll-navigation.mjs:246-251, test-rail-handoff.mjs:552).

---

## 1. How production picks code; source edit to deployable commit

### 1a. Hosts (VERIFIED)
- Production = Railway, auto-deploys `main` (DEPLOY.md:129-131). Start command packages the allowlist then runs serve.py (railway.toml:4-5; DEPLOY.md:170-185).
- Origin named in docs: https://www.banodoco.ai (DEPLOY.md:122; PUBLIC_ORIGIN at DEPLOY.md:8).
- Pages preview = https://banodoco.github.io/Banodoco-website/, deploys `preview/true-union` (DEPLOY.md:24-25). `.nojekyll` at root.
- **mycelial.works** appears only in docs/deck-feedback/2026-11-01-mobile-pass.md. OPEN QUESTION: whether it is a second deploy of this artifact. Not confirmed by any deploy doc.
- serve.py mode: RUNTIME_MODE = `source` if tools/ exists, else `release` (serve.py:22). Public artifact has no tools/, so Railway serves **release** mode (DEPLOY.md:47-49).
- Source mode: `/runtime-release.js` is replaced by runtime-source.js (serve.py:288-291), a plain `./` importmap (runtime-source.js:3-12).

### 1b. What runtime/<hash>/ is (VERIFIED)
- Immutable snapshot of the JS closure plus manifest.json. 30 snapshots present today (`ls runtime | wc -l`).
- runtime-release.js:3 sets `base` to one snapshot and installs an importmap for `./main.js`, `./organism/hero-spores.js`, `three`, `three/addons/` (runtime-release.js:7-12).
- index.html:101 loads runtime-release.js before `import './main.js'` (index.html:377). Also used: hero-spores worker (index.html:134) and hero-deco.js (index.html:289) via `window.__runtimeBase`.

### 1c. What is copied in (VERIFIED, tools/build-runtime-release.mjs)
- ENTRIES: main.js, organism/hero-spores.js, organism/hero-spores-worker.js, hero-deco.js (:9).
- Transitive closure of relative imports, incl. literal dynamic imports; `three` -> vendor/three/three.module.js; `three/addons/*` -> vendor/three/addons/* (:38-66).
- Extras: assets/contributor-portraits/profile-sprite.jpg (:68); static/geom/manifest.json and each chapter .bin it lists (:69-71). These cover the only import.meta.url-relative resources (journey/lib/baked.js:51; organism/hero-spores.js:2479).
- Hash = sha256 over sorted path+bytes (:75-79, :101). Output = runtime/<hash>/ with manifest.json (:112-127), then runtime-release.js rewritten (:129-131).
- In the closure (examples): journey/*, organism/*, content/*.js, flags.js (main.js:12), hero-cues.js (main.js:81).
- NOT in the closure: hero.css, mycelial.css, journey/site.css, journey/cards/cards.css, index.html, top-level inspire-exits.js, manifesto-note.js, manifesto-link-tooltip.js (no importer in main.js, journey/, content/, index.html; the two manifesto files are loaded only by static/index.html:2285-2286).
- Public allowlist ships runtime/ only as `*.js, *.json, *.bin, *.jpg` (deploy/public-files.json:27-28).

### 1d. When a new release is required
- Any byte change to a closure file, or to its import list, changes the hash. `npm run check` begins with runtime:check (package.json:26). Root CSS is outside the closure and outside the scene gate (journey/*.css is inside it: pre-commit:178).
- Pre-commit regex for the staged tree: `main.js|flags.js|inspire-exits.js|index.html|runtime-release.js|runtime/|organism/|journey/|content/|assets/contributor-portraits/|static/geom/|tools/build-runtime-release.mjs` (tools/pre-commit:48), then `--check` on a checkout of the staged tree (:54-60).

### 1e. Command sequence, source edit to deployable commit
1. `npm install` once (devDeps: eslint, globals, @eslint/js, madge, playwright-core; package.json:31-37).
2. Dev: `PORT=8137 python3 serve.py` (source mode, no-store). Never `python3 -m http.server` (CONTRIBUTING.md:110-123).
3. Closure changed: `npm run runtime:build` (package.json:10; build-runtime-release.mjs:112-131).
4. `npm run runtime:check` (package.json:11), then `node tools/test-runtime-release.mjs --browser` (DEPLOY.md:26-27; Chrome issue in section 2).
5. content/content.js changed: `node tools/build-static-content.mjs`; stage static/index.html (section 6).
6. Geometry/scene changed: `python3 tools/rebuild.py` (~30 s; server + Chrome; BUILDING.md:11-14). `--with-captures` (~2 min) only to re-shoot goldens. Run `python3 tools/build-meta.py` AFTER captures (DEPLOY.md:162-168).
7. Gates: `npm run check`, then `CHECK_ORIGIN=http://localhost:8137 npm run check:captures` (CONTRIBUTING.md:188-193).
8. Commit: `tools/release.sh --stage <path> ...` (BUILDING.md:34-47). Stage each changed/new file, including runtime-release.js and the new runtime/<hash>/ files (DEPLOY.md:28-30). HYPOTHESIS: --stage takes file paths, so list files under the new dir (check `tools/release.sh --help`). It runs `npm run check` and `tools/check.sh`, commits `Deploy pre-flight: <diffstat>` (release.sh:144-146), pushes origin/main, polls release-revision.txt (BUILDING.md:49-54).
9. Manual path, doc-only only: `PREFLIGHT_DONE=1 git add -A && PREFLIGHT_DONE=1 git commit -m deploy && git push origin main` (DEPLOY.md:156-160). Never for organism/, journey/, or allowlist (DEPLOY.md:150-155).
10. Hooks: .git/hooks holds only .sample files (VERIFIED), so pre-commit and pre-push-runtime are NOT active in this clone. Install: `ln -sf "$(pwd)/tools/pre-commit" .git/hooks/pre-commit` (pre-commit:3); `ln -s ../../tools/pre-push-runtime .git/hooks/pre-push` (DEPLOY.md:40-42).

### 1f. Served direct vs from runtime
| File | Served from | Ref |
|---|---|---|
| index.html and inline scripts | live tree | as-is |
| runtime-release.js | live tree, points at one snapshot | index.html:101 |
| main.js and closure | runtime/<hash>/ | runtime-release.js:8 |
| hero.css, mycelial.css | live tree | index.html:52, :56 |
| journey/site.css, journey/cards/cards.css | live tree | index.html:53-54 |
| hero-deco.js | runtime/<hash>/ | index.html:289 |
| static/** | live tree | deploy/public-files.json:65-69 |

---

## 2. Checks: requirements, cost, status here

Here: node v22.23.4 (engines >=20.19, package.json:6-7), python3 /usr/local/bin/python3, PIL 12.3.0, no node_modules.

| Check | Command | Needs | Cost (documented) | Here |
|---|---|---|---|---|
| Developer gate | `npm run check` (package.json:26): runtime:check, test:runtime, lint, cycles, test:unit, test:harness, run-contracts, test:static | node + npm install; python3 for test:harness; NO server, NO Chrome (CONTRIBUTING.md:127-131, :166-170) | "in seconds" (CONTRIBUTING.md:168-169), not measured | blocked until npm install |
| Drift gate | `CHECK_ORIGIN=... npm run check:captures` = tools/check.sh (package.json:27) | server serving this tree (check.sh:148-158); Chrome at macOS path; waits if load avg >8, up to 10 min (check.sh:162-173) | ~4-5 min (tools/README.md:40-41; pre-commit:186-187) | cannot run (capture.py:106) |
| Browser smoke | `PORT=8177 node tools/browser-smoke.mjs` | Chrome via PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, else macOS path, /usr/bin/google-chrome, /usr/bin/chromium (browser-smoke.mjs:634-643) | 8 scenarios; not timed | /usr/bin/google-chrome exists (VERIFIED); it is a wrapper adding --no-sandbox for root around /opt/pw-browsers/chromium. Should be picked up. |
| test:browser | browser-smoke, test-epilogue-retire (spawns its own serve.py), tempo-run (package.json:22) | as above | not timed | likely runnable (HYPOTHESIS) |
| test:mobile | `PORT=8177 npm run test:mobile` (gate.mjs:38) | server on 8177 | multi-stage incl. ride runs (gate.mjs:85-115) | not run |
| test:dwell | `PORT=8177 npm run test:dwell` (package.json:19) | server; quiet GPU; writes tools/dwell-receipt.json | not timed | launches with `--use-angle=metal` (dwell-run.mjs:91), a macOS flag. Expect trouble (HYPOTHESIS) |
| test-runtime-release --browser | DEPLOY.md:27 | Playwright `channel: 'chrome'` (test-runtime-release.mjs:109); does NOT read the env var | not timed | likely fails here (HYPOTHESIS) |

Pre-commit (tools/pre-commit), in order:
- Runtime check when a closure path is staged (:48-61).
- Static-content check when content.js, static/index.html or the builder is staged (:66-75).
- Meta/favicon check for mission/owned captures, mark or favicon sources, build-meta.py (:83-90).
- Dwell receipt when a governed file is staged (:118-146). Governed = tools/dwell-oracle.mjs:1042-1046: journey/scroll.js, transport.js, claim.js, constants/scroll.js, route.js. Missing receipt = exit 1 (:136-141). Override `DWELL_RING_ADJUDICATION='<why>'` (CONTRIBUTING.md:257-263).
- Scene gate for any staged organism/ or journey/ path (:178). SKIP_SCENE_CHECK (:180). PREFLIGHT_DONE skips it because release.sh already ran the gates (:189-191).
- Hard-codes http://localhost:8137 (:204), ignores PORT; ends with capture check and `bake-geom.py --check` (both need Chrome).

Known flakes (documented):
- Shutter fires the wrong chapter about 1 frame in 50 (CONTRIBUTING.md:162-164). Re-shoot before trusting.
- final@430x932 ~24 MAE and mission@430x932 ~2.4 MAE drift on Chrome-bake; hard fail unless CAPTURE_CHECK_ADJUDICATION (BUILDING.md:63-75, :106-118).
- Phone-ring boot flake ~1 in 8 past a 90 s readiness wait (tools/README.md:27-29).
- Dwell ring refuses to report on a GPU-busy host even when load and CPU look idle (CONTRIBUTING.md:251-255).

---

## 3. Golden captures

- 10 goldens = mission, inspire, connect, owned, final x {1440x900, 430x932} (capture.py:151-157; static/captures/*.png, manifest.json).
- Frozen shooter hides: .ui, .callouts, .j-copy, .j-hotspots, .j-card, .j-rail, .j-menu, .j-menu-scrim (capture.py:233-249). So rail, menu-panel and copy CSS never reach goldens.
- Re-shoot only when rest pixels change: scene shaders/geometry, rest camera poses (journey/constants/camera.js), fog, colour, un-hidden overlays. `python3 tools/capture.py --pose <id> --size desktop|mobile --note "why"` (tools/README.md:28-30). The note goes in manifest.json.
- static/geom/*.bin changes only if a geometry builder changes (BUILDING.md:81-88; pre-commit bake check).
- Transition durations do not alter rests, so they should not move goldens (HYPOTHESIS).
- Manifesto is not in HIDE_SELECTORS; goldens are chapter rests, so the manifesto is presumably closed there (HYPOTHESIS, not checked).

Reproducible here: NO.
- Goldens shot on M2, Chrome 151 (static/captures/manifest.json `environment`; CONTRIBUTING.md:202-204).
- Docs: they cannot be reproduced on this machine by any tree (tools/README.md:14-16; CONTRIBUTING.md:143-151). M3/Chrome 152 measures 2.2-3.1 MAE on untouched baseline (CONTRIBUTING.md:202-206).
- Host here is software GL. Expect MAE well above the 1.0/255 threshold (tools/README.md:31). HYPOTHESIS, not measured.
- Do NOT re-bless goldens to fit this host (CONTRIBUTING.md:204-207).
- Docs' answer is the differential: shoot base and change on the same host (CONTRIBUTING.md:209-219; `tools/capture-diff.sh --base $(git merge-base main HEAD)`). It drives capture.py, so it also needs the macOS Chrome path.
- Net: here, neither drift gate nor differential runs without a Chrome at the macOS path (symlink or capture.py edit). Out of scope for this pass.

---

## 4. Tests that pin timing, motion, rail or typography

### Transition and navigation durations
- tools/test-no-scroll-navigation.mjs:228: DEFAULT_NAVIGATION_SPEED === 0.45.
- :235: every directed pair >= 2.6 s (MIN_NAVIGATION_SECONDS, journey/navigation-timing.js:12).
- :246-251: LITERAL copy of the speed table: mission/final 0.75, equip/connect 0.70, connect>final 0.42, final>connect 0.49, inspire>connect 0.48. **Changing NAVIGATION_SPEED or NAVIGATION_DIRECTION_SPEED (navigation-timing.js:14-23) breaks this; update the literals in the same commit (CONTRIBUTING.md:67-71).**
- tools/test-rest-composition.mjs: COPY_IN_K, COPY_SETTLE_LO/HI, COPY_JUMP_TAIL_S recomputed against the scroll arrival clock (:111, :426, :572); named mutant COPY_IN_K 2.4 -> 0.6 (~:649).
- tools/test-transition.mjs:428-431: COPY_JUMP_LEAD, COPY_JUMP_TAIL_S, COPY_IN_K.
- tools/test-epilogue-retire.mjs:229-233: HERO_COPY_ARRIVAL_S (journey/constants/copy.js:123 = 1.10); worst-frame bound 0.016667/1.10. No duration clause by design (:232-240).
- tools/test-declared-conversions.mjs: FORWARD_BRAKE_TAIL_S (journey/route.js:386-391); pins "declared 0.35 s dial" and delivered 183.3 ms (:69-73, :461-463); leg enumeration (:389-394). Also COMMIT_BRAKE_TAIL_S (scroll.js:353), HOTSPOT_STAGGER_MS (copy.js:146), HOTSPOT_ARRIVAL (copy.js:236).
- tools/test-dwell-oracle.mjs:241: ANCHORS p = [0, 0.2, 0.32, 0.523, 0.725, 0.97]; mirrored at tools/dwell-oracle.mjs:80-87. Moving a route rest breaks it.

### Manifesto
- journey/manifesto/pose.js: WORD_STAGGER 0.11 (:5), WORD_REVEAL 3 (:6), RETURN 4.8 / RETURN_MIN 2.2 (:18-23), AWAY_SCALE 1.35 and AWAY_EXTRA 1.0 (:31-32), SPIRAL_START 1.0 (:34), MOBILE_LIFT 5 (:35), FIRST_LINE 2.0 (:51), LINE_BREATH 1.6 and LINE_SECONDS_PER_WORD 0.14 (:52-53).
- tools/test-manifesto-motion.mjs:12: literal `manifestoPose(from, 2.2)` lift > 8.
- :31: literal 100-degree spiral turn.
- :88-90: `LINE_SECONDS[0] === FIRST_LINE_SECONDS` and LITERAL gap `1.6 + .14 * words`. **Changing LINE_BREATH or LINE_SECONDS_PER_WORD breaks on literals; update or import.**
- :628-631: awaySecondsFrom = returnSecondsFrom * 1.35 + 1 (literal), and awaySecondsFrom(1) in (7, 8).
- tools/test-mobile-manifesto-range.mjs:24: literal `end.position.y === 38`. :14-18 admit = max(previousVisible, reveal-2); :21 CAMERA_SECONDS.

### Rail (mobile positions, geometry)
- tools/test-rail-handoff.mjs:104-119: rowLayout at 1440x900 and 390x844. Literal connectorAir 6 (desktop) and 5 (phone); literal ringDia [28,36,36,36,28].
- journey/ui/rail-handoff.js:6 RAIL_HANDOFF. Mobile rail media query: journey/rail.js:565 `(pointer: coarse), (max-width: 900px)`.
- tools/test-pose-oracle.mjs: RAIL_GATE_SETTLE_MS (pose-oracle.mjs:192) must clear the two Date.now gates in journey/rail.js (:1236 `Date.now() + 720`, :2917). Changing the 720 ms follow delay needs a matching settle.
- tools/trace/rail-centre.mjs --assert: parity max 0.5 px, absolute max 2.0 px (:331). Relative, so most rail moves pass. Run from tools/trace/mobile/gate.mjs:107.

### Typography
- tools/test-rail-handoff.mjs:552: regex pins `.j-rail-slot.j-rail-purpose-child .j-rail-name` to `font-size: 0.76rem !important` and `letter-spacing: 0.02em !important`. Source-text match: a size or selector rename breaks it.
- Menu panel (.j-menu): no test pins font size; hidden from goldens (capture.py:248).

### Oracles
- tools/tempo-oracle.mjs: CHANNEL_CLASSES reveal dmax 0.35 (:167-173); DEFAULT_CONTRACT frameMs 1000/60, dtTolFrac 0.02, minFrames 90, keptFrac 0.5, onsetFloorFrac 0.25, onsetLitAt 0.12, deadVFrac 0.02, deadTailMaxMs 350 (:174-200). TL3 reads FORWARD_BRAKE_TAIL_S.

---

## 5. Commit, authorship, branch rules; "never" rules

Authorship: nothing in repo docs; use the session's attribution trailers (Co-Authored-By, Claude-Session; Claude Code line on PR bodies).
Commit messages: no written convention. Only generated form: `Deploy pre-flight: <diffstat>` (tools/release.sh:144-146). READ-ME-FIRST.txt says 485 commits with "unusually lovely messages"; not checkable here.

Branch and push:
- Release goes from local `main` to `main` (tools/release.sh; DEPLOY.md:56-60; BUILDING.md:34-37). pre-push-runtime guards `preview/true-union` and `main` (tools/pre-push-runtime:8).
- "Everything up-to-date" but remote old = you are on a branch: `git checkout main && git merge --ff-only <branch> && git push origin main` (DEPLOY.md:189-191).
- Release requires origin/main to be an ancestor; no force-push, no discarding remote history (BUILDING.md:55-61).

Documented never/do-not rules:
1. Never `python3 -m http.server`; use serve.py (CONTRIBUTING.md:110-123; tools/README.md:17-20).
2. Never `SKIP_SCENE_CHECK=1` for code; doc-only emergencies only (README.md:25-26; pre-commit:17).
3. Never re-bless goldens to make a host green (CONTRIBUTING.md:204-207). Re-shoot only in the commit that makes the visual change, with --note (tools/README.md:28-30).
4. Never add check:captures to `npm run check`; check stays Node-only (CONTRIBUTING.md:168-170).
5. Never widen a tolerance to close a gap; re-measure and rewrite the declaration (CONTRIBUTING.md:312).
6. Before rewording a comment in journey/ or organism/, `grep -a` tools/ for its phrase (CONTRIBUTING.md:22-35). Dead anchors no-op silently.
7. Do not add a unit-mismatched constant; author in seconds of purpose where possible (CONTRIBUTING.md:297-305).
8. Do not re-baseline a pin in the same commit as the change it polices (CONTRIBUTING.md:67-71).
10. No hand-written ?v= cache tokens (DEPLOY.md:92-94).
11. Never overwrite or prune runtime/<sha256>/ (DEPLOY.md:92-93).
12. No custom `[build] buildCommand` in railway.toml; keep requirements.txt at root (DEPLOY.md:170-185).
14. DWELL_RING_ADJUDICATION / CAPTURE_CHECK_ADJUDICATION only for real environment failures (CONTRIBUTING.md:257-265; BUILDING.md:71-75).
15. No PREFLIGHT_DONE manual commit for organism/, journey/, or allowlist (DEPLOY.md:150-155).
17. Build-meta after captures, never before (DEPLOY.md:162-168).

---

## 6. Static twin and generated copy

- Yes. static/index.html is the no-JS tier. tools/build-static-content.mjs regenerates data-src text bindings, the accented chapter headings, the manifesto body and CHAPTERS from content/content.js (:13, :16-19, :39-80, :145-163).
- Mechanism: rewrites bindings in static/index.html in place via temp file (:171-177); `--check` exits 1 on drift (:165-171).
- Pre-commit enforces it for content.js, static/index.html or the builder staged (tools/pre-commit:66-75). Test: tools/test-static-content.mjs.
- Copy with no data-src binding is hand-authored in static/index.html and must be edited by hand (HYPOTHESIS: check with grep before assuming it is bound).
- Copy hard-coded in journey/*.js has no twin mechanism. Mirror by hand.
- content/content.js is in the runtime closure, so copy changes also need `npm run runtime:build` (section 1d).

---

## 7. Open questions

- mycelial.works: which deploy it is (section 1a).
- Whether `tools/release.sh --stage` takes directories (section 1e step 8).
