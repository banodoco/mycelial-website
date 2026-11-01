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
| M1 | Mobile, slide 2 | Category labels (Upscalers, LoRAs, Tools, LUTs) should sit at the very top of the screen; current position feels misaligned and unbalanced. Push the body text down a little. | layout | | | Terra → Opus taste | open |
| M2 | Mobile, slides 3–4 | "Pretty good." No change. | regression guard | n/a | n/a | — | accepted |
| M3 | Mobile + desktop, slide 5 | Replace the hypothetical example with the real clips from the Astrid app onboarding flow, which are nicer and more illustrative. Source: `banodoco/astrid-app` (local `/home/user/astrid-app`). | content | | | Terra → Opus taste | open |
| M4 | Mobile, slide 6 entry | Explainer cards jump in late and inelegantly. Sometimes only 3 appear, sometimes none. Marker pointers sometimes point at nothing. | race / lifecycle | | | Astra | open |
| M5 | Mobile, 5 ↔ 6 back-and-forth | Slide 5's video player sometimes stays visible behind slide 6. Marker cards misbehave. "Poor engineering that makes this possible in the first place." | leak / ownership | | | Astra | open |
| M6 | Mobile, slide 7 | The flow runs left to right; on mobile it should run bottom to top, with the composition realigned to suit. | layout redesign | | | Terra → Opus taste | open |
| M7 | Mobile, slide 8 | "Beautiful." No change. | regression guard | n/a | n/a | — | accepted |
| M8 | Mobile + desktop, slide 9 | The "20,000 people · Banodoco Discord" stat should sit **above** the visualization. | layout | | | Terra | open |
| M9 | Mobile, 9 ↔ 10 back-and-forth | Text fails to appear, or only appears as the slide is being left. Suspected race. | race / lifecycle | | | Astra | open |
| M10 | Mobile, slide 11 | Odd gap at the top. Logo sits too high. Logo, title, text and CTA should be centred together as one vertical group. | layout | | | Terra → Opus taste | open |
| M11 | Mobile, general | Back-and-forth navigation leaves content missing or overlapping. Assume a structural smell (ambiguous slide→element ownership, uncancelled timers or rAF, late async loads, transitions racing) rather than a set of separate bugs. | structural | | | Astra (Sol if escalated) | open |
| D1 | Desktop | Desktop feels much better overall. Same slide 9 change as M8. | — | see M8 | see M8 | Terra | open |
| X1 | Evidence | Hannah's iPhone screenshot, 14:46, mycelial.works, slide **6/11**: slide 5's Astrid editor is still painted **under** slide 6. Visible bleed-through: the "Astrid" header row (avatar plus the word "Astrid" colliding with the "Editing" pill), the editor's panel frames, the transport row "0:12 / 0:28" with the "1280×720" badge, the timeline ruler (0:00 … 0:25) with its playhead, and the preview video frame (orange ball) under the "Models" pill. Slide 6's own layer (stack, pills, "Rendering" detail card) renders on top. Result: two slides composited at once. Canonical repro target for M5 and M11. | — | | | — | n/a |

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
