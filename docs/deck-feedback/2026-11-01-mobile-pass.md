# Mycelial deck: mobile pass (2026-11-01)

Single source of truth for Hannah's 2026-11-01 feedback on `mycelial/` (the deck).
Every agent reads this first and updates **only its own rows/sections**.

- Evidence (screenshots, filmstrips, traces) lives outside git in the lab dir:
  `/tmp/claude-0/-home-user/ec7d4d15-a92d-4461-aa32-c15cf254a17c/scratchpad/deck-lab/<item-id>/`
- Visual harness: `tools/deck/lab.mjs` (being built in Wave 1, see `## Tooling`).
- Slide map (index.html order): 1 `vc` collage · 2 `sf` scatter-field · 3 `gap` · 4 `ac` · 5 `as` demo · 6 `st` stack · 7 `pa` pays · 8 `fl` flowers · 9 `fw` flywheel · 10 `fw-top` · 11 `fw-raise`.

## Roles

| Role | Who | Used for |
|---|---|---|
| Coordinator / visual adjudicator | Claude (main session) | Briefs, merges, reviews evidence, accepts or rejects against the bar |
| Structural diagnosis (races, lifecycle, leaky ownership) | Codex `gpt-6-astra` @ high | M4 M5 M9 M11 root causes and fixes; spawns `gpt-6-luna` sub-agents for parallel probes |
| Mechanical workhorse | Codex `gpt-6.1-terra` @ high | Tooling, layout fixes, content swaps; may spawn `gpt-6-luna` |
| Hardest problems / second opinion | Codex `gpt-6.1-sol` @ xhigh | Escalations where Astra's root cause is uncertain or a refactor is architectural |
| Taste / refinement | Claude Opus 5.5 sub-agents | Several visual variants, compared with the harness (M1 M3 M6 M10) |

## Ledger

Status: `open` → `diagnosing` → `fixing` → `review` → `accepted` (or `wontfix` with a reason specific to that item).

| ID | Surface | Hannah's report (paraphrased) | Class | Root cause (filled by investigator) | Fix (filled by implementer) | Owner | Status |
|---|---|---|---|---|---|---|---|
| M1 | Mobile, slide 2 | Category labels (Upscalers, LoRAs, Tools, LUTs) should sit at the very top of the screen; current position feels misaligned and unbalanced. Push the body text down a little. | layout | | | Terra (wt-terra-layout) → Opus taste | fixing |
| M2 | Mobile, slides 3–4 | "Pretty good." No change. | regression guard | n/a | n/a | — | accepted |
| M3 | Mobile + desktop, slide 5 | Replace the hypothetical example with the real clips from the Astrid app onboarding flow, which are nicer and more illustrative. Source: `banodoco/astrid-app` (local `/home/user/astrid-app`). | content | **Found (Luna).** The onboarding example is *Lantern Valley* (`astrid-app/docs/video-editor/onboarding-lantern-valley.md`, `src/tools/video-editor/tour/{tourStages,tourScript,tourMedia}.ts`). Assets are in `public/astrid/onboarding/lantern-valley-14s-v1/` (manifest.json). The tour is 14 s at 1280×720 and runs in three chat acts: (1) a Three.js bird-flight guide, (2) four Qwen Image 2.1 frames (start, mountains, descent, town) at 0, 6.5, 10 and 13 s, (3) a MiniMax H3 final, 0–14 s. Slide 5 currently uses the 28 s "quiet light study" (3 clips, type-on and colour effects; `demo.js:43-62`, `index.html:1646,1661`), which doesn't match. Weight: the raw PNGs plus the two MP4s total about 15 MB, so web renditions are required (H3 at preview size with faststart, WebP thumbnails, a poster). Attribution: Qwen via WaveSpeed and MiniMax H3; there is no separate media licence file. Full report: `$LAB/out/luna-clips/REPORT.md`. | | Terra → Opus taste | diagnosing |
| M4 | Mobile, slide 6 entry | Explainer cards jump in late and inelegantly. Sometimes only 3 appear, sometimes none. Marker pointers sometimes point at nothing. | race / lifecycle | | | Astra | open |
| M5 | Mobile, 5 ↔ 6 back-and-forth | Slide 5's video player sometimes stays visible behind slide 6. Marker cards misbehave. "Poor engineering that makes this possible in the first place." | leak / ownership | | | Astra | open |
| M6 | Mobile, slide 7 | The flow runs left to right; on mobile it should run bottom to top, with the composition realigned to suit. | layout redesign | | | Terra → Opus taste | open |
| M7 | Mobile, slide 8 | "Beautiful." No change. | regression guard | n/a | n/a | — | accepted |
| M8 | Mobile + desktop, slide 9 | The "20,000 people · Banodoco Discord" stat should sit **above** the visualization. | layout | | | Terra | open |
| M9 | Mobile, 9 ↔ 10 back-and-forth | Text fails to appear, or only appears as the slide is being left. Suspected race. | race / lifecycle | | | Astra | open |
| M10 | Mobile, slide 11 | Odd gap at the top. Logo sits too high. Logo, title, text and CTA should be centred together as one vertical group. | layout | | | Terra (wt-terra-layout) → Opus taste | fixing |
| M11 | Mobile, general | Back-and-forth navigation leaves content missing or overlapping. Assume a structural smell (ambiguous slide→element ownership, uncancelled timers or rAF, late async loads, transitions racing) rather than a set of separate bugs. | structural | | | Astra (Sol if escalated) | open |
| D1 | Desktop | Desktop feels much better overall. Same slide 9 change as M8. | — | see M8 | see M8 | Terra | open |
| X1 | Evidence | Hannah's iPhone screenshot, 14:46, mycelial.works, slide **6/11**: slide 5's Astrid editor is still painted **under** slide 6. Visible bleed-through: the "Astrid" header row (avatar plus the word "Astrid" colliding with the "Editing" pill), the editor's panel frames, the transport row "0:12 / 0:28" with the "1280×720" badge, the timeline ruler (0:00 … 0:25) with its playhead, and the preview video frame (orange ball) under the "Models" pill. Slide 6's own layer (stack, pills, "Rendering" detail card) renders on top. Result: two slides composited at once. Canonical repro target for M5 and M11. | — | | | — | n/a |
| X2 | Evidence | Hannah: the X1 bleed-through happens "when I click back and forth, not when I just go into it normally". A normal (direct) entry into slide 6 has its own **lag**, which may be the same friction surfacing differently. So: (a) the bleed is order- and interruption-dependent, meaning an exit is cancelled or overtaken by a re-entry; (b) entry lag is a separate measurable signal (long tasks, decode or layout on entry). | — | | | — | n/a |

## Problems → avenues to explore

The feedback reduces to four themes. Theme A matters most because it likely explains several symptoms at once.

| Theme | Items | Working hypotheses (to prove or kill, not assume) |
|---|---|---|
| **A. Slide lifecycle is not trustworthy on mobile** | M4 M5 M9 M11 X1 X2 | 1. An exit (fade or teardown) is cancelled or overtaken when the user re-enters mid-transition, so the old slide's layer stays painted (X1). 2. Ownership is ambiguous: slides share DOM or modules (slide 5's editor feeds slide 6's stack; slides 9, 10 and 11 are all `fw-host`), so "which slide owns this element right now" has no single answer. 3. Uncancelled timers, rAF loops, video playback or observers keep running after exit, then fire into the wrong slide. 4. Async work (image or video decode, font load, layout measurement) resolves after the slide has changed, and nothing checks that the slide is still current. 5. Card or marker placement measures geometry before layout settles on mobile (wrong or zero rects → late jump-in, only 3 of N cards, pointers aiming at nothing). 6. Mobile-only paths (touch/swipe, `visualViewport` resize, URL-bar collapse, scroll-snap) trigger re-layout mid-transition. 7. Plain heavy work on entry (the X2 lag): long tasks, synchronous decode, large layout or paint. |
| **B. Mobile layout composition** | M1 M8 M10 (D1) | Positions tuned for desktop and carried over to portrait. Each needs a mobile-specific arrangement: labels pinned to the top (M1), the stat above the visual (M8), a vertically centred group (M10). |
| **C. Mobile orientation of a diagram** | M6 | The slide 7 flow should run bottom to top on portrait. A real re-layout, not a rotation: labels must stay readable and the composition must be rebalanced. |
| **D. Content** | M3 | Replace slide 5's hypothetical example with the real Astrid onboarding clips. Find the assets, then fit them into the existing demo frame. |

## Plan (waves)

| Wave | Who (model @ effort) | What | Output |
|---|---|---|---|
| 1 | Terra `gpt-6.1-terra` @ high | Build the lean visual harness (`tools/deck/lab.mjs`): device profiles, scripted nav sequences (incl. rapid back-and-forth), filmstrip contact sheets, a **ghost detector** (anything from a non-active slide still visible), a card-count probe, entry-lag metrics, a repeat-N failure rate. Produce the baseline evidence pack. | harness + baseline pack |
| 1 | Astra `gpt-6-astra` @ high, plus `gpt-6-luna` sub-agents | Map the real slide lifecycle and ownership model. Root-cause theme A with mechanisms (file:line). Propose an ownership model and a fix order. **Diagnosis only**, no deck edits yet. | structural report |
| 1 | Luna `gpt-6-luna` @ high | Find the Astrid onboarding clips (M3) in `astrid-app`, plus how slide 5's current example is wired. | asset report |
| 2 | Astra (resumed session) | Implement the approved lifecycle fix in its worktree. Each race gets a scripted repro that fails before and passes after (20× under throttling). | lifecycle fix |
| 2 | Terra | Layout items M1, M8/D1, M10. Content swap M3. First pass at M6. | layout fixes |
| 2b | Claude Opus 5.5 sub-agents | Taste passes on M1, M3, M6 and M10: try variants, compare them with the harness, pick one. | refined variants |
| esc | Sol `gpt-6.1-sol` @ xhigh | Only if Astra's root cause is uncertain, its fix fails the repro, or the refactor is architectural. Independent second diagnosis. | second opinion |
| 3 | Claude (coordinator) | Merge worktrees. Re-run the full harness pack on the merged branch. Adjudicate each row against the bar. Report back to Hannah. | accepted ledger |

## Acceptance bar (Claude adjudicates)

1. Every `fixed` row has before/after evidence in its lab dir: an iPhone-class viewport (390×844 @3x) and, where relevant, desktop 1440×900.
2. Every race-class row has a **scripted repro**: a lab sequence that failed before the fix and passes after it, repeated ≥20× with CPU throttling, using a non-flaky assertion (DOM/visibility state, not pixel timing alone).
3. Root-cause entries name the mechanism (file:line, what owns what, what fires when). "Timing issue" is not a root cause.
4. Fixes delete the mechanism that allowed the bug rather than adding guards on top (repo policy: *Burn down on the same PR*).
5. Slides 3, 4 and 8 show no visual regression against baseline.
6. `npm run lint`, plus `tools/deck/check-stress.mjs` and `tools/deck/check-firstload.mjs`, still pass.

## Tooling

_(Wave 1 Terra fills this in: harness usage, sequence DSL, output layout.)_

## Structural findings

_(Wave 1 Astra fills this in: the slide lifecycle model as it actually is, the smells, the proposed ownership model.)_

## Decision log

| When | Decision | Why |
|---|---|---|
| 2026-11-01 | Ledger lives in git (`docs/deck-feedback/`). Evidence stays out of git, in the lab dir. | Codex agents can read and update a repo file. Screenshots would bloat history. |
| 2026-11-01 | Each implementing agent works in its own git worktree. The coordinator merges. | Astra (lifecycle JS) and Terra (layout CSS in `index.html`) would otherwise collide. |
| 2026-11-01 | Codex agents run in the `workspace-write` sandbox (writable: own worktree, lab dir, shared `.git`). Chromium is launched with `chromiumSandbox:false, --disable-dev-shm-usage, --no-zygote`. | The bypass-all-sandbox mode was refused by the session's safety policy. These launch flags were verified to work inside the Codex sandbox. |
| 2026-11-01 | Harness v1 (still capture) is accepted as the visual baseline. v2 is required for race work: in-page rAF recorder, CDP screencast, absolute-time input scheduler, runs marked `invalid` when input timing slips. | v1 serialised capture with input (~3 s per screenshot), so rapid back-and-forth couldn't be driven, and its "failures" were settle timeouts, not bugs. |
| 2026-11-01 | Only Chromium is available (no WebKit). Hannah's iPhone Safari remains the final check for Safari-only behaviour. | `playwright install` is off-limits in this environment (version pinning). |
| 2026-11-01 | **Luna does the heavy lifting.** Astra and Terra are leads: they plan, brief, verify and synthesize. Bulk work (code inventories, probes, captures, matrices, transcoding, layout experiments) goes to `gpt-6-luna` @ high sub-agents. Running agents were interrupted and resumed with this rule. Verified from the Codex rollouts: sub-agents run on `gpt-6-luna` with effort `high`. | Hannah's direction: leads should coordinate, not grind. |
| 2026-11-01 | M3 wiring (`demo.js`, slide 5 markup) waits until Astra's lifecycle fix lands. Asset renditions are prepared now. | Slide 5 is the source of the X1 bleed, so editing it in parallel would collide with the fix. |
