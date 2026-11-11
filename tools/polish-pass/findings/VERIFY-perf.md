# VERIFY-perf: runs against MERGED (:8150, polish/all @ 02b5acf) and BASELINE (:8137)

Scripts: SCRATCH/verify/ (lazy-gl.cjs from SCRATCH/perf; ascent-check.cjs, ascent-check-desktop.cjs, u2-check.cjs, u2-styles.cjs, ui-check.cjs, pageerr-check.cjs are copies or new scripts).
Outputs: SCRATCH/captures/VERIFY-perf/ (JSON + PNG), perf/out/after-desktop.json and after-mobile.json (lazy-gl raw logs), logs in SCRATCH/verify/c*.log.

Conditions: one Chromium at a time (another agent's browser was also running; not touched). SwiftShader GL. Real clock. Load average 14-20 on 4 cores during runs, so every wall time below is slow. DPR 1 for all screenshots (DPR 2 too slow here; the brief allowed this). `&warmdraw=1` on every MERGED perf run (checks 1-3); not on UI checks 4-6.

## Summary

| # | Check | Status | Key numbers (measured) | Expected |
|---|---|---|---|---|
| 1 | Hop uploads, desktop | **FAIL** | ->inspire/equip/connect: 0 bufferData >64 KB, 0 tex. **->final: 13 bufferData >64 KB = 1.70 MB (3.45 MB total); 14 tex = 52.53 MB; 7 mipmaps. ->owned: 3 bufferData >64 KB = 0.38 MB** | ~0 bufs >64 KB; 0 tex; 0 mips in every hop |
| 2 | Hop uploads, phone | **FAIL** | mission->connect: 0 / 0 tex. **connect->final: 13 >64 KB = 1.70 MB (3.35 MB total); 14 tex = 52.53 MB; 7 mips. final->owned: 3 >64 KB = 0.38 MB** | same |
| 3a | Manifesto ascent, phone | **FAIL** | prewarm: `warmed: true`, `report.geometries: 0`, prewarm upload bytes 0. Mid-ascent: 2.93 MB in frame 134 (517,920 x2, 690,560 x2, 345,280, 172,640), first-use `createBuffer` under `RenderPass.render` | no upload >=100 KB in ascent |
| 3b | Manifesto ascent, desktop 800x500 | **FAIL** (worse) | prewarm: `geometries: 0`, 0 bytes; one prewarm slice 160.6 ms (budget 8 ms). Ascent: ~2.44 MB at f113, **~3.81 MB at f123**; 11.57 MB non-stream uploads in the ascent | no upload >=100 KB in ascent |
| 4 | Page errors, intro on, 40 s | **PASS** (same as baseline) | MERGED and BASELINE identical: 0 pageerrors at 800x500 and 390x844; only console warning is `KHR_parallel_shader_compile not supported` (SwiftShader). `window.__pageErrors` undefined on both. | no new errors |
| 5a | Menu panel | **PASS for the intent (desktop type up)**, overflow noted | Thesis font 1440: 17.28 -> **26.4 px** (2 lines each, both lines same size). 1280: 17.28 -> 26.4. Phone 390: 23.4 unchanged. Overflow (scrollH vs clientH): 1440 900/900 both (no overflow); 1280 baseline 745/720 (25 px), **merged 794/720 (74 px)**; 390 baseline 1239, merged 1255 (scrolls, not clipped) | bigger thesis; spare room at 1440 |
| 5b | Phone intro, nointro (390 / 375 / 430) | **PASS** on rail position | Rail glyph centre from bottom: **70 / 70 / 70** (baseline 113.9 / 90.0 / 125.8). Glyph top 751 at 844. Rail label bottom from bottom: 32.05 / 32.05 / 32.05 (baseline 76.0 / 52.1 / 87.9). Top-bar logo top inset 20.8 and centre 42.8, unchanged. Headline block 98.4 to 308.6 (390), unchanged from baseline. `--nav-hero-lift` = 0px | glyph at 70 px everywhere |
| 5c | Phone Inspire, `#/inspire` | **PASS** | glyph centre from bottom **70 / 70 / 70**, label bottom 37 (baseline also 70 / 37) | equal to intro value on MERGED (70) |
| 5d | Early intro, `?introat=` 0.15 / 0.3 / 0.5 (390x844) | **MEASURED, no criterion** | Headline block centre minus midpoint(top-bar bottom 98.4, glyph top 751 => 424.7): **-43 / -101 / -185 px**. Baseline (glyph top 707, midpoint 402.7): -40 / -92 / -167. Headline centre: 381.7 / 323.9 / 239.9 (baseline 362.4 / 310.9 / 236.0) | none given; reported as measured |
| 6 | U2 hover, "open models and open tools" | **FAIL** (no visible brightening) | `:hover` true on 5 of 6 word samples (miss in the gap). `--thread-hover` reads **0 at rest and 0 hovered**. Computed diff rest vs hover: only `transition` changes (`none` -> `--thread-hover 0.2s`). Thread gradient alpha identical. Word colour, decoration, cursor identical (`cursor: auto`). Visually the two crops are indistinguishable. | `--thread-hover` 0 -> 1, visibly brighter |

Waits used: check 1 and 2: load, chapter ready, then **60 s settle**, then a **60 s rest** after each hop (15 s after the last). Check 3: chapter 'final' reached, 6 frames still, **30 s rest at Purpose**, then manual `prewarmManifesto` loop, then `flyTo('manifesto')`. Check 4: 40 s after load. Check 5: menu 9 s + 2.5 s after click; intro 12 s; Inspire 25 s after deep link; early 8 s. Check 6: manifesto open, all 5 lines shown, 3 s.

Wall times: check 1 ~15 min; check 2 ~11 min; check 3 mobile ~6 min, desktop ~20 min; check 4 ~2 min per server; check 5 ~10 min merged, ~10 min baseline; check 6 ~9 min (first run failed on a screenshot timeout at 120 s; rerun with 420 s timeouts); computed-style read ~12 min (first run failed on a bad locator; rerun).

---

## 1. Hop uploads, desktop (800x500, `?nointro=1&warmdraw=1`)

Command: `node SCRATCH/perf/lazy-gl.cjs desktop inspire,equip,inspire,connect,final,owned 60000 after 8150 warmdraw=1` (log: SCRATCH/verify/c1-desktop.log; raw: SCRATCH/perf/out/after-desktop.json).

| phase | bufferData n / MB | >64 KB n / MB | tex n / MB | mips |
|---|---|---|---|---|
| 0 mission->inspire | 0 / 0 | 0 | 0 | 0 |
| 0 mission->inspire:rest | 68 / 6.04 | 19 / 5.50 | 0 | 0 |
| 1 inspire->equip (+rest) | 0 / 0 ; rest 18 / 0.09 | 0 | 0 | 0 |
| 2 equip->inspire (+rest) | 0 / 0 ; rest 27 / 0.14 | 0 | 0 | 0 |
| 3 inspire->connect | **0 / 0** | 0 | 0 | 0 |
| 3 inspire->connect:rest | 27 / 0.14 | 0 | 0 | 0 |
| 4 connect->final | 295 / 3.45 | **13 / 1.70** | **14 / 52.53** | **7** |
| 4 connect->final:rest | 0 | 0 | 0 | 0 |
| 5 final->owned | 6 / 0.50 | **3 / 0.38** | 0 | 0 |
| 5 final->owned:rest | 0 | 0 | 0 | 0 |

- Baseline for comparison (from IMPL-perf): ->connect 0.28 MB, ->final 2.79 MB >64 KB (4.60 MB total), ->owned 1.67 MB; first hop 30 tex / 52.9 MB / 15 mips.
- ->connect: PASS. ->final and ->owned: FAIL. The merged first hop has 0 textures (baseline had 30 tex / 52.9 MB), so that part of the target did move.
- The warm work moved to rest only for Inspire (6.04 MB at the first rest, 19 uploads >64 KB, sizes 170 KB to 691 KB, all on the rest after mission->inspire). Equip and Connect rests warmed about 0.1 MB each.
- **The Final texture was never warmed.** The 52.5 MB texture set (texStorage2D + texSubImage2D of 16 MB, 4 MB x2, 1 MB, plus 7 mipmap generations) lands entirely inside connect->final. The Connect rest (36 frames, 27 small uploads) and the Final rest (18 frames, 0 uploads) did not warm it. So the work vanished into the hop, rather than moving to rest.
- Longest main-thread task in connect->final: **19,799 ms** (single long task, `longtasks 18 / 19799`). This is most likely the 16 MB texture upload plus mip generation on SwiftShader. Mentioned because it is the stutter the owner reported; real GPU timing will differ.
- Warm draws at rest: the warm queue ran (rest-phase uploads are present), so `warmdraw=1` did reach the rest path.

## 2. Hop uploads, phone (390x844, `mobile connect,final,owned`)

Command: `node SCRATCH/perf/lazy-gl.cjs mobile connect,final,owned 60000 after 8150 warmdraw=1` (log: SCRATCH/verify/c2-mobile.log; raw: SCRATCH/perf/out/after-mobile.json). Route starts from mission, so the first hop is mission->connect.

| phase | bufferData n / MB | >64 KB n / MB | tex n / MB | mips |
|---|---|---|---|---|
| 0 mission->connect | 0 / 0 | 0 | 0 | 0 |
| 0 mission->connect:rest | 66 / 5.94 | 19 / 5.50 | 0 | 0 |
| 1 connect->final | 277 / 3.35 | **13 / 1.70** | **14 / 52.53** | **7** |
| 1 connect->final:rest | 0 | 0 | 0 | 0 |
| 2 final->owned | 33 / 0.61 | **3 / 0.38** | 0 | 0 |
| 2 final->owned:rest | 0 | 0 | 0 | 0 |

- Result: FAIL for the same reason as the desktop run. The numbers match the desktop run almost exactly (13 / 1.70 MB, 14 / 52.53 MB, 7 mips), so the Final texture set is the same size on both viewports.
- Longest main-thread task in connect->final: 6,398 ms (phone), 6,622 ms in final->owned (desktop run).
- The 4096x1024 Final texture is not found under `journey/final` (grep). The texture unit in `warmHiddenChapters` (journey/journey.js ~2300) only warms textures that are on a material slot, have `version > 0` and an `image`. I did not establish which path creates this texture. Not resolved here.

## 3. Manifesto ascent (`mperf-ascent.cjs` patched: port, `&warmdraw=1`, 30 s rest at Purpose, `colony.warm` logged before the press)

Commands: `node SCRATCH/verify/ascent-check.cjs mobile 8150 after 4 prewarm` and `node SCRATCH/verify/ascent-check-desktop.cjs desktop 8150 after 4 prewarm` (desktop patched to the brief's 800x500; the stock harness uses 480x300). Analyser: `node SCRATCH/harness/mperf-analyze.cjs`. Outputs: SCRATCH/captures/VERIFY-perf/ascent-{mobile,desktop}-after.json and top-*.png.

**Did the prewarm task run?** Yes, in the sense that `colony.warm` reports `warmed: true` after the call. But its report says `geometries: 0`, and the prewarm phase shows **0 bytes of upload** in both runs. So no geometry was uploaded by the prewarm. Expected `geometries >= 3` and `prewarmUpBytes >= ~3 MB`: FAIL.
- Caveat: the 30 s rest at Purpose runs in the harness's `boot` phase, and the upload recorder skips that phase. So rest-time uploads from the real queue are **not visible** in these JSONs. I could not confirm whether the real queue warmed anything during that rest. (Mention for whoever reads these: the 30 s rest is not instrumented.)

**Phone ascent (`ascent-mobile-after.json`, 139 frames, camera y 14.9 -> 38):**
- Non-stream uploads in ascent: 265 calls, 6.27 MB; >=100 KB: 124,800 and 105,132 at f114; **517,920 x2, 690,560 x2, 345,280, 172,640 at f134 (about 2.93 MB in one frame)**. This matches the baseline's "five first-use uploads 345-690 KB, 2.9 MB in one frame" pattern. FAIL.
- Stack for the f134 uploads: `createBuffer` <- `Object.update` (three.module.js:13762) <- `projectObject` <- `WebGLRenderer.render` <- `RenderPass.render`. That is a first-use upload inside the composer pass, not a warm draw.
- Draws: 42 at height 0, 354 at height 1 (baseline notes: 44 / ~205 / 326 at 0 / 0.5 / 1; the height-0.5 sample was not reported here).

**Desktop ascent (`ascent-desktop-after.json`, 137 frames, y 2.7 -> 70):**
- Prewarm: one slice took **160.6 ms** against an 8 ms budget (planAerialReveals is still indivisible; noted in IMPL-mperf). Prewarm reported `geometries: 0`.
- Ascent: non-stream uploads 545 calls, **11.57 MB**. Frame 113: about 2.44 MB (509,328 x2, 169,776 x7, 124,800, 105,132). **Frame 123: about 3.81 MB** (517,920 x2, 690,560 x2, 345,280, 224,208, 277,920, 195,552, 172,440, 172,640). Stacks are the same first-use path.
- Draws: 42 at height 0, 483 at 0.5, 454 at 1.

Screenshot: SCRATCH/captures/VERIFY-perf/top-mobile-after.png shows the manifesto top with the thread under "open models and open tools" in the same resting state as before. Looks fine; no clipping.

## 4. Page errors (intro on, 40 s, both viewports)

Commands: `node SCRATCH/verify/pageerr-check.cjs 8150 merged` and `... 8137 baseline`. Outputs: SCRATCH/captures/VERIFY-perf/pageerr-{merged,baseline}.json.

- MERGED and BASELINE are identical at 800x500 and 390x844: `pageErrors: []`, one console warning (`THREE.WebGLRenderer: KHR_parallel_shader_compile extension not supported`), `window.__pageErrors` undefined, chapter 'mission'. PASS.

## 5. UI screenshots and measurements (DPR 1, real clock)

Commands: `node SCRATCH/verify/ui-check.cjs <port> <label> <sections>` (sections menu,intro / inspire,early), run for MERGED (8150) and BASELINE (8137). Outputs: SCRATCH/captures/VERIFY-perf/ui-{merged,baseline}-*.json and PNGs.

**(a) Menu panel**

| viewport | thesis font / lines (both lines) | panel clientH / scrollH (baseline -> merged) |
|---|---|---|
| 1440x900 | 17.28 -> **26.4 px**; 2 lines each | 900/900 -> 900/900 (no overflow) |
| 1280x720 | 17.28 -> **26.4 px**; 2 lines each | 720/745 -> 720/**794** (overflow 25 -> 74 px; panel scrolls, nothing clipped) |
| 390x844 | 23.4 -> 23.4 px (unchanged); 2 lines each | 844/1239 -> 844/1255 |

- Before/after at 1440: the baseline thesis lines are small and grey-cream; merged thesis lines are noticeably larger and full cream, with the same copy. The top line breaks as "open- / source AI art ecosystem thrive", i.e. the hyphen in "open-source" splits across lines. Looks slightly awkward. Same break on phone and at 1280.
- Phone thesis lines did not change (the ledger asked for "bigger" on the menu in general; only desktop was changed).

**(b) Phone intro (nointro), 390 / 375 / 430 (844 / 667 / 932 tall)**

| measure | 390x844 base -> merged | 375x667 base -> merged | 430x932 base -> merged |
|---|---|---|---|
| top-bar logo top inset | 20.8 -> 20.8 | same | same |
| rail glyph centre from bottom | 113.9 -> **70** | 90.0 -> **70** | 125.8 -> **70** |
| rail label bottom from bottom | 76.0 -> 32.1 | 52.1 -> 32.1 | 87.9 -> 32.1 |
| headline block top / bottom | 98.4 / 308.6 (same) | 98.4 / 289.9 (same) | 98.4 / 298.3 (same) |

- The rail moved down to the Inspire position as intended. Before/after: the baseline rail sits higher, with a larger gap to the bottom; merged matches the chapter position. The text block is unchanged. PASS for the rail. The brief's "headline block" compares only top and bottom, so no further criterion.

**(c) Phone Inspire via `#/inspire`** (merged): glyph centre from bottom **70 / 70 / 70** at all three sizes, label bottom 37. Baseline is also 70 / 37 in Inspire. Equal to the intro value on MERGED. PASS.
- Caveat: the hash reads empty after the deep link, and `--nav-content-u` reads 1 on both servers. I checked `ui-merged-inspire-m390.png`: it shows the Inspire copy, "Inspire the movement", with the Inspire rail item active, so the state is correct despite the empty hash and the `contentU` value.

**(d) Early intro, `?introat=`** (merged, 390x844, midpoint between top-bar bottom 98.4 and glyph top 751 = 424.7)

| introat | headline centre | minus midpoint (merged) | (baseline, midpoint 402.7) |
|---|---|---|---|
| 0.15 | 381.7 | **-43.0** | -40.3 (headline centre 362.4) |
| 0.30 | 323.9 | **-100.8** | -91.9 (310.9) |
| 0.50 | 239.9 | **-184.8** | -166.7 (236.0) |

- The brief gives no pass threshold. Measured: at every early phase the headline block sits above the midpoint, and more so as the intro progresses; the merged gap is slightly larger because the midpoint moved down 22 px (the rail moved down).
- Look at `ui-merged-early-0.3.png`: the headline sits high under the top bar, with a large empty band between the CTA row and the mushroom. Not clipped, reads as intentional, but the headline is not centred between the bars.

## 6. U2 hover

Commands: `node SCRATCH/verify/u2-check.cjs 8150 after` (screenshots u2-rest-after.png, u2-hover-after.png; 420 s timeouts after a first 120 s screenshot timeout) and `node SCRATCH/verify/u2-styles.cjs 8150` (computed styles; first run failed on a locator, rerun OK).

- `--thread-hover` reads **0 at rest and 0 after hovering**, `--thread-strength` 0.48 in both.
- `:hover` is true on the hovered word and its thread for 5 of the 6 word samples. The gap between words does not match (expected, the rule is per element).
- Computed-style diff, rest vs hover on the hovered word and its thread: **only `transition` changes** (`none` -> `--thread-hover 0.2s`). Colour `rgba(242,228,195,.86)`, text-decoration `none`, cursor `auto`, background gradient alpha, opacity, text-shadow and filter are all identical.
- Pointer events on the word and thread: `auto` on MERGED (H3 recorded `none` on baseline).
- Visual: `u2-rest-after.png` and `u2-hover-after.png` are indistinguishable at this size. The thread underline looks the same in both.
- Read against the CSS in `mycelial.css:645-652`: the `:hover` rule declares `--thread-hover: 1` with a 0.2 s transition, and the computed transition confirms that rule is active in the hovered state. Yet the computed value is still 0 about 1.2 s after the pointer lands. I did not establish why: possibly the transition is not advancing in this headless, software-GL session; not confirmed. Either way the brightening is not visible in the measured state. FAIL.

---

## Surprising / for the owner

1. **The Final texture set (16 MB + 4 MB + 4 MB + 1 MB, 7 mipmaps, 52.5 MB total) is still uploaded inside connect->final on both viewports, and no warm pass touches it at Connect or at Final rest.** This is the largest remaining hitch in the flight. It is the biggest single difference from the expectation and is not explained by anything in these runs. The 19.8 s and 6.4 s long tasks in that hop are its likely cause.
2. **The manifesto prewarm task reports `geometries: 0` and uploads nothing,** so the ground's 2.9 MB first-use upload still lands mid-ascent on the phone. Desktop is worse: 3.8 MB in one frame at f123 and 11.6 MB of uploads over the ascent. The prewarm slice on desktop took 160 ms against an 8 ms budget.
3. **The U2 hover CSS is in the file but does not visibly brighten** in this run; `--thread-hover` stays 0.
4. **Menu desktop thesis is now 26.4 px** and reads as a manifesto opener. Its top line breaks at "open-" / "source" at 1280 and 1440. Overflow at 1280x720 went from 25 to 74 px (scrolls, not clipped).
5. **Phone rail moved to 70 px at every size.** Intro and Inspire now match, as intended.
6. The desktop ascent's stock harness viewport is 480x300; I used 800x500 per the brief. The mobile run used 390x844.
7. Rest-time uploads are invisible in the ascent harness (boot-phase recorder gap), so the rest-queue prewarm cannot be verified from its JSON.

Checks I did not run: `node tools/browser-smoke.mjs` (from IMPL-perf) was not in this brief. Not run.
