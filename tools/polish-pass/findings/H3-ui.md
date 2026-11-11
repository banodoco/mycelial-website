# H3-ui findings (U1, U2, U3). Investigation only; no repo files changed.

Browser: one Chromium at a time, SwiftShader GL, dev server localhost:8137. Clock was NOT faked: everything below is a settled-state read after real-time waits (9 s nointro, 40 s normal intro), not a motion trajectory. Viewports: mobile isMobile+hasTouch, deviceScaleFactor 1.

## 1. TL;DR

- U1: The panel copy is 17.28px Cormorant at 1440 and 22.5–23.4px at phone widths. The desktop line is the small one, not the phone line. Desktop 1440x900 has about 184px of free height under the panel, so larger type fits there. At 1280x720 the panel already overflows by 25px. The fix is a desktop size bump on `.j-menu-thesis`, which is shared by both thesis lines. The static twin needs the same edit, and `tools/test-static-content.mjs` pins the strings.
- U2: "open models and open tools" is manifesto text (kinship concept), not a link. Its span has `pointer-events: none`, `cursor: auto`, and no hover rule, and its colour does not change on hover (measured). The only persistent underline on that phrase is a gradient "phrase thread" that is not hover-driven. The existing inline-link pattern is `.manifesto-chapter-link` (dotted underline, hover brightens). The one real link containing "open models" is the menu row "Astrid agent: A creative agent for open models" (`.j-menu-row-link`), which has colour-only hover.
- U3: Measured on a 390x844 phone, the top bar's logo top sits 20.8px from the viewport top and its centre is 42.8px from the top. The bottom rail's glyph centre sits 113.9px from the bottom at hero rest, and 70px from the bottom at Inspire. The 43.9px difference is `--nav-hero-lift` = `13.5vh - 70px`, which lifts the rail at the hero and drops it at Inspire. The "too high at intro" effect is that lift. Text-bottom to rail-top gap is about 398px, so the text is not close to the bottom in the rects. The top-anchored text block is the more likely cause of the "unbalanced" feel.
- U3 (also): the top-bar padding in `hero.css:953` is dead code. `mycelial.css:418` (`.ui #site-nav { padding-top: 20.8px }`) beats it because of the ID selector, so the computed padding is 20.8 top and 33.6 bottom, not 25.8/15.8.

---

## 2. How the relevant code works

### Menu panel (U1)
- Copy source, live: `journey/rail.js:1016-1036` (`menuSections`). The thesis rows are `rail.js:1017` ("We’re working to help the open-source AI art ecosystem thrive", `mission` section) and `rail.js:1033` ("The open source ecosystem can accelerate a second renaissance", `final` section). Group headings: `rail.js:1020` (1. Inspiring), `:1024` (2. Equipping), `:1028` (3. Connecting). Items come from `itemsFor()` (around `rail.js:990-1008`, which reads `content/content.js` nodes).
- Render: `journey/rail.js:1060-1063` writes `span.j-menu-no` ("1."), `span.j-menu-name` (heading), and `span.j-menu-line.j-menu-thesis` (thesis).
- Live CSS, `journey/site.css`:
  - `.j-menu` panel, 544-560 (width `min(29rem,92vw)`, padding `1rem 2.2rem 1.8rem`, `overflow-y: auto`, opaque `#0b0702`)
  - `.j-menu-list > li` hairlines, 644-645; gradient border-image, 5398-5404
  - `.j-menu-item` row, 646-653 (padding `0.62rem 0.6rem 0.55rem 0.5rem`)
  - `.j-menu-no`, 660-667 (0.58rem)
  - `.j-menu-name`, 668-673 (0.66rem, 700, letter-spacing .24em, uppercase)
  - `.j-menu-line`, 674-681 (Cormorant Garamond, 1rem, lh 1.32, colour `--muted`)
  - `.j-menu-thesis`, 682 (`font-size: 1.08rem`, colour `--parchment`)
  - Hover and current rules, 683-687
  - Last-row padding, 5357-5359
  - Phone block `@media (max-width:620px) and (orientation: portrait)` starts at 890. Inside it, `.j-menu-thesis { font-size: clamp(1.35rem, 6vw, 1.58rem); line-height: 1.12 }` at 913-916. Name at 918-922 and row sizes at 923-960.
  - Phone `.j-menu` padding `1rem 1.5rem 2rem`, 893-896.
- Static twin, `static/index.html` (hand-written markup, not `data-src`-bound):
  - Markup: `static/index.html:1444` (thesis 1), `:1478` (thesis 2), `:1449`/`:1461`/`:1469` (headings, `menu-no`/`menu-name`).
  - CSS: `static/index.html:773-783` (`.menu-line`, `.menu-thesis`). Note its font is `"Didot", "Playfair Display", Georgia`, not the live `"Cormorant Garamond"` (`journey/site.css:674-678`). Phone block: `.menu-thesis` at 981-984.
  - `tools/build-static-content.mjs:13` writes `static/index.html` and `:167` checks drift against `content/content.js`. The menu strings are NOT in content.js, so the drift check does not cover them. Edit the static file by hand, and keep it in step with `rail.js`.

### Hover/underline (U2)
- Phrase copy: `content/content.js:68` ("...We believe in open models and open tools, shaped and reshaped by thousands of hands.").
- Concept table: `content/manifesto-concepts.js:9` (`{ id: 'kinship', phrase: 'open models and open tools' }`).
- Render: `journey/manifesto/branch.js:103` creates `span.manifesto-concept.concept-kinship` per word, inside a `span.j-manifesto-word`. `:82-84` set `phraseThread`. `:147-151` create a sibling `span.manifesto-phrase-thread` at the phrase start, with `--phrase-beat`.
- CSS, `mycelial.css`:
  - `.manifesto-concept` base colour and glow, 574-578
  - `.manifesto-concept.concept-kinship` colours, 593-597 (`--concept-rest #efd09b`)
  - `.manifesto-phrase-thread` gradient underline (`background-image`, `background-size 100% 1px`, `padding-bottom .12em`), 603-613; `.j-manifesto .manifesto-phrase-thread { background-size: 0%; --thread-strength: 0 }`, 615-618; hidden until shown, 620-622; drawn on reveal, 624-626; keyframes `manifesto-thread` 0%→100%, `--thread-strength` .9 → .48, ~634-640
  - `.j-manifesto-line.shown .concept-kinship` pulse animation, 628-630
  - Existing inline-link pattern, `.manifesto-chapter-link` (links "seeding", "nourishing", "connecting", from `content/manifesto-links.js:3-5`): base dotted underline 888-900 (`text-decoration-style: dotted`, colour `currentColor 40%`, `text-underline-offset .22em`, `cursor: pointer`). Hover/focus, 902-906: `color: #f6cb8b`, underline colour `currentColor 70%`.
- Menu row link: `journey/rail.js:1098` (`a.j-menu-row-link`); the Astrid agent row text "A creative agent for open models" is in `static/index.html:1464` and `content/content.js:676` (`nodes.agent.short`). Its hover is `journey/site.css:720-724` (background and colour, no underline). `:733-737` handle the arrow icon.

### Rail position (U3)
- Constants: `journey/layout/rail-geometry.js:89-130` (`rowMetrics`). Phone: `centreFromBottom: 70` at `:108` (tablet 84, desktop 92). The row's centre line is `centreY = h - centreFromBottom` (`:124-131`).
- Publish to CSS: `journey/rail.js:2052-2084` (`rowFrame`) writes `--nav-centre-bottom = h - centreY` (`:2084`), plus `--nav-major`, `--nav-fit-*` and similar.
- CSS twin, preboot defaults: `journey/site.css:3611-3615` (desktop), `3650-3656` (portrait ≤900, centre 84), `3661-3668` (portrait ≤620, centre 70, nav-content-max 1.15).
- Hero lift: `journey/site.css:3644`: `--nav-hero-lift: max(0px, calc(13.5vh - var(--nav-centre-bottom)))`. The rule is in the `:root` block, so the lift is the same at every phone size. The comment at 3631-3643 says it is intentional.
- Per-state transform: `journey/site.css:3846-3852` (`.j-rail-list`). `translateY(calc(-1 * var(--nav-hero-lift) * var(--nav-content-u)))` and `scale(1 + (--nav-content-max - 1) * --nav-content-u)`.
- `--nav-content-u` is written by `journey/rail.js:1771` as `1 - u`, where u is docking progress. It is 1 at hero rest and 0 once the visitor leaves the intro.
- Rail root: `journey/site.css:3688-3692`: `bottom: calc(var(--nav-centre-bottom) - var(--nav-major) / 2)`.
- Top bar: `index.html:190-206` (`#site-nav.logo`), and the menu button `.j-rail-menu` is in the rail (`index.html:246`). Padding: `mycelial.css:51` (`padding: 2.1rem var(--header-left)`), overridden by `mycelial.css:418` (`@media (max-width:620px) and (orientation: portrait) { .ui #site-nav { padding-top: 20.8px } }`). `hero.css:953` (`nav { padding: calc(1.3rem + 5px) 6vw calc(1.3rem - 5px) }`) is dead for `#site-nav`, because the ID selector wins.
- Hero text: `hero.css:941-948` (portrait ≤620: `.hero { padding: 7vh 7vw 0 }`, `h1` 2.8rem max, `text-align: center`). `hero.css:880-887` (portrait ≤900: `justify-content: flex-start`). The block is top-anchored.
- Hero-cue aim uses the same calc, `hero-cues.js:166-168`.

---

## 3. Findings

### U1 — panel type hierarchy

**Measured (computed styles, `captures/H3-ui/U1-menu-*.png`, `findings/H3-U1-measure.json`)**

| viewport | thesis font | thesis lh | thesis box (h) | name font | panel clientH / scrollH | legal bottom |
|---|---|---|---|---|---|---|
| 1440x900 | 17.28px Cormorant (1.08rem) | 22.8px | 46px each (2 lines) | 10.56px DM Sans 700, uppercase | 900 / 900 (no scroll) | 716 (184px free) |
| 1280x720 | 17.28px | 22.8px | 46px | 10.56px | 720 / 745 (**overflows 25px**) | 716 |
| 390x844 | 23.4px (clamp, 6vw) | 26.2px | 52px | 11.52px | 844 / 1239 (scrolls, expected) | — |
| 375x667 | 22.5px | 25.2px | 50px | 11.52px | 667 / 1235 (scrolls, expected) | — |

- All thesis text is `color: rgb(247,235,215)` (`--parchment`), `opacity 1`, `margin 0`, `letter-spacing normal`, `text-transform none`, `font-weight 400`.
- Group headings (`.j-menu-name`) are DM Sans 700, uppercase, letter-spacing .24em. They are wider than the thesis lines, but they are small.
- Items (`.j-menu-item` text) are DM Sans 16px, colour `rgb(246,202,138)` (gold).
- Measured positions at 1440x900: thesis 1 box top 88, thesis 2 box top 557; last `li` runs 543–682.

**Root cause (VERIFIED):** the thesis size is set once, by `journey/site.css:682` (1.08rem) and mirrored at `static/index.html:783`. The phone size (`clamp(1.35rem,6vw,1.58rem)`, `site.css:913`) is already large. The desktop size is the smallest of the panel's type, below the group headings' visual weight once uppercased. Both thesis lines share one class, so the bottom line gets the same size as the top. The owner's "bottom line should also be bigger" is the same fix.

**Room check (VERIFIED):** at 1440x900 there is about 184px of unused height under the legal line, so one extra thesis line of about 25px per row fits. At 1280x720 the panel already overflows, so a desktop size bump there will scroll further. The panel is `overflow-y: auto`, so nothing clips.

**Candidate fixes (ranked)**

1. Desktop-only size bump, shared by both lines. `journey/site.css:682`: `font-size: 1.08rem` → `font-size: clamp(1.35rem, 1.9vw, 1.7rem); line-height: 1.16`. At 1440 this gives about 27px. Mirror at `static/index.html:783`. Expected height at 1440 is about +40px per line. Fits with about 100px spare at 1440x900, and at 1280x720 it adds about 100px of scroll. Risk: low. Verify by re-measuring `.j-menu-thesis` font-size and `.j-menu` scrollH at 1440x900 and 1280x720.
2. Keep the top line, but make the bottom one a manifesto close. Add `.j-menu-list > li:last-child .j-menu-thesis { font-size: …; }` after line 682 (and the static twin). The owner's "bottom line commands more attention" request is the same change, with the bottom given a bigger size or a different colour (`--gold-bright` instead of `--parchment`). Risk: low. Copy changes (for example "by inspiring: …") are not CSS and would change `rail.js` 1017-1033 and `static/index.html:1444,1478`. Those are the owner's call.
3. Phone: already 23.4px. If the owner wants more, raise `clamp(1.35rem,6vw,1.58rem)` (`site.css:913`) to `clamp(1.5rem,6.6vw,1.8rem)`. The phone panel scrolls by design, so this costs scroll length, not clipping.

**Must also change:** `tools/test-static-content.mjs:59-63` pins the markup and copy (`menu-no`/`menu-name`/`menu-thesis` strings). No test pins the font size. `tools/pose-oracle.matrix.json.txt:504-1371` has `j-menu-name` and `j-menu-line` records (snapshot data, not a size assertion). `tools/test-ui-lifecycle.mjs` and `tools/test-manifesto-concepts.mjs` mention the menu but were not checked in depth (HYPOTHESIS: not size-pinned).

**Copy strings (exact, as rendered):**
- Thesis 1: "We’re working to help the open-source AI art ecosystem thrive" (curly apostrophe; defined `rail.js:1017`, `static/index.html:1444`, and `static/index.html:1503` as the H1 with a period)
- Thesis 2: "The open source ecosystem can accelerate a second renaissance" (no hyphen, no apostrophe; `rail.js:1033`, `static/index.html:1478`). Note the spelling mismatch with thesis 1 ("open-source" vs "open source").
- Headings: Inspiring / Equipping / Connecting (`rail.js:1020,1024,1028`; `static/index.html:1449,1461,1469`)

**Screenshots:** `captures/H3-ui/U1-menu-d1440.png`, `U1-menu-d1280.png`, `U1-menu-m390.png`, `U1-menu-m375.png`

### U2 — "open models" / "open tools" underline on hover

**Measured (1440x900, manifesto opened via the menu's Manifesto row, `findings/H3-U2-measure.json`)**
- The "open" word of the kinship phrase: `cursor: auto`, `text-decoration: none`, `pointer-events: none`, `color rgb(239,208,155)` at rest and on hover (no change).
- Existing link "seeding" (`.manifesto-chapter-link`): `cursor: pointer`, `text-decoration: underline dotted`, colour `rgba(242,228,195,.86)`.
- The phrase thread (`.manifesto-phrase-thread`) was not found by my probe (it is a sibling of the word span, not a child). It is a persistent gradient underline (`--thread-strength` settles at .48). Whether it is visible at rest was NOT confirmed by screenshot: the second paragraph was not on screen at capture time. HYPOTHESIS: at rest the phrase already carries a faint continuous underline, drawn by `mycelial.css:603-613` and `:624-626`. That would make a hover underline a change of strength, not a new underline.

**Root cause (VERIFIED for non-interactivity):** the kinship phrase is decoration, not a control. `pointer-events` is none (from the `.j-manifesto` hit model), and there is no `:hover` rule on `.concept-kinship` or the thread. So hovering does nothing. The owner's expectation is a hover affordance on text that cannot be hovered.

**Screenshots:** `captures/H3-ui/U2-kinship-hover.png` (taken at the kinship position after scroll, but the captured frame shows paragraph 1 only, so the phrase is NOT in it). `U2-kinship-rest.png` is a clipped crop that also misses the phrase. Treat both as not showing the phrase. A re-capture is needed to show rest vs hover (see Open questions).

**Candidate fixes (ranked)**

1. Make the phrase a hover target that underlines as a whole. Requires a small JS change: in `journey/manifesto/branch.js:103-150`, wrap the kinship words in one `span.manifesto-kinship-phrase` (or add a class to the sibling thread), so one hover covers all words. Then CSS in `mycelial.css` after line 597: `.manifesto-kinship-phrase { pointer-events: auto; cursor: pointer; }` and `.manifesto-kinship-phrase:hover { text-decoration: underline dotted; text-decoration-color: color-mix(in srgb, currentColor 70%, transparent); text-underline-offset: .22em; }`. Risk: medium (the phrase is a `concept` with pulse animations and a `phraseThread`; this would cross the reveal clock). Verify by hovering and measuring `text-decoration-line` on the wrapper.
2. CSS-only, weaker: `.j-manifesto-line:has(.concept-kinship:hover) .manifesto-phrase-thread { --thread-strength: .9; }` plus `.concept-kinship { pointer-events: auto; }`. This brightens the existing gradient underline on hover, but works only if the phrase sits on one `.j-manifesto-line` (not verified: the phrase may wrap across lines). `:has()` support is needed. Risk: low-medium. Verify on a 390 and a 1440 width, where the wrap differs.
3. Do not change the phrase. Instead add a real link, for example the menu row "A creative agent for open models", which is already an `<a>` (`rail.js:1098`). Its hover is colour and background only (`site.css:720-724`). Add `text-decoration: underline dotted; text-underline-offset: .22em;` to `.j-menu-row-link:is(:hover, :focus-visible) .j-menu-is`, or to `.j-menu-is` on hover. Risk: very low. This is the only interactive instance of "open models" I found.

**Where else the words appear (none interactive except as noted):** `content/content.js:68,217,597,653,676,680,693` (nodes and sub copy), `static/index.html:1464` (menu link), `:1525,1554,1569,1578,1580,1594` (plain copy), `content/contributors.js:42`, `content/manifesto-concepts.js:9` (the phrase table), `content/content-archive-deferred.js` (archive, ignore). No test pins this underline. `tools/test-manifesto-concepts.mjs` pins the pairing of concepts (the phrase match), so a wrapper change must keep the concept mapping.

### U3 — mobile rail / top bar / hero geometry

**Measured (`findings/H3-U3-measure-nointro-run1-3vp.json`, `findings/H3-U3-measure-nointro.json`, `findings/H3-U3-measure-intro.json`; screenshots below)**

Units px, from the viewport edge. "Glyph" = the Inspire mark box (`.j-rail [data-chapter="inspire"] .j-rail-mark`, 46px at hero, 40 at rest).

| state | viewport | top bar (`#site-nav`) | logo box top / centre | menu button top / centre | hero text top / bottom | glyph centre from bottom | glyph box bottom from bottom | glyph top minus text bottom |
|---|---|---|---|---|---|---|---|---|
| intro settled (=nointro hero) | 390x844 | 0–98.4 | 20.8 / 42.8 | 20.8 / 42.8 | 98.4 / 308.6 | **113.9** | 90.9 | 398.5 |
| nointro hero | 375x667 | 0–98.4 | 20.8 / 42.8 | 20.8 / 42.8 | 98.4 / 289.9 | 90.0 | 67.0 | 287.1 |
| nointro hero | 430x932 | 0–98.4 | 20.8 / 42.8 | 20.8 / 42.8 | 98.4 / 298.3 | 125.8 | 102.8 | 543.7 |
| deep-link `#/inspire` | 390x844 | 0–98.4 | 20.8 / 42.8 | 20.8 / 42.8 | — | **70.0** | 47.0 | — |

- Top-bar padding (computed, 390 and 375): top 20.8, bottom 33.6. At 430: top 20.8, bottom 33.6 (`mycelial.css:418` wins over `hero.css:953`).
- Top bar bottom edge: 98.4. Text top (h1 box): 98.4. So the h1 box sits flush under the bar, and the visible gap is the h1's internal leading. Measured ink top was NOT taken (HYPOTHESIS: about 15–25px visible gap).
- Menu button right edge sits 23.4px from the viewport right (390), which is `6vw`.

**The mirror numbers the owner asked for**
- Top bar: logo box top is 20.8px from the top edge (its centre 42.8px).
- Bottom rail at hero rest (390x844): glyph box bottom is 90.9px from the bottom edge (glyph centre 113.9px). A true mirror of 20.8px would put the glyph bottom 70px lower.
- The formula is exact (VERIFIED from the three hero measurements): hero glyph centre = **13.5vh**, from `journey/site.css:3644`. 844 × .135 = 113.9, 667 × .135 = 90.0, 932 × .135 = 125.8.
- At Inspire the glyph centre is **70px** from the bottom at every phone size (`centreFromBottom: 70` in `rail-geometry.js:108`, mirrored at `site.css:3665`).
- So the rail moves **13.5vh − 70px** down when Inspire is entered: 43.9px at 844, 20.0px at 667, 55.8px at 932. The owner's "sits lower inside Inspire" is this move, confirmed by the deep-link Inspire state (`captures/H3-ui/U3-deep-m390-inspire.png`, glyph centre 70 from bottom).

**Root cause of the hero position (VERIFIED):** `--nav-hero-lift` (`site.css:3644`) raises the whole row by `13.5vh − centre` at the hero. `.j-rail-list` applies it via `site.css:3849` times `--nav-content-u` (1 at the hero). The lift is applied to the whole row (glyphs and labels), so the labels are also lifted.

**Why the text may feel "too close to the bottom" (judgement, numbers only):** the text block is top-anchored in portrait (`hero.css:880-887`, `justify-content: flex-start`, padding 7vh top). Its vertical centre is about 203px from the top at 844 (viewport centre is 422). The lower part of the viewport holds the mushroom and the rail. The measured text-bottom to glyph-top gap is 398px, so the text is not close to the rail. The "tight" feel is more likely the empty band above the rail and the top-anchored block. The owner should judge this in the screenshot.

**Candidate fixes (ranked), with the constraints they hit**

1. Remove the hero lift on phones only, so the hero seat equals the Inspire seat. In `journey/site.css` inside `@media (orientation: portrait) and (max-width: 620px)` (line 3661), add `--nav-hero-lift: 0px;`. Glyph centre becomes 70 at every phone size (glyph box bottom 47px from the bottom edge). This moves the rail down 43.9px at 844 and removes the Inspire jump. Constraints: `tools/test-mobile-landing-anchor.mjs:18` string-replaces `calc(13.5vh - var(--nav-centre-bottom))` with a 125.82px literal. That replacement is a silent no-op after the edit, so the landing test would measure the un-patched layout. Update the test with the new string. `hero-cues.js:166-168` reads the same variable (the aim follows automatically). The bookend/purpose compositions (`site.css:1298-1353`, `final-composition.js:62`) use `--nav-centre-bottom` only, so they are unaffected.
2. Mirror the top bar exactly. Set `--nav-centre-bottom` to about 43 (glyph centre 42.8 from the bottom, mirroring logo centre 42.8 from the top) and `--nav-hero-lift: 0` at phones. Constraints: this moves every phone chapter (Inspire, Equip, Connect, Purpose) and changes the labels' bottom reach (glyph bottom would sit about 20px from the edge, with labels about 16px lower, which is inside the home-indicator zone). `tools/test-rail-handoff.mjs:491` pins `centreFromBottom: phone ? 70 : …`, so update that assertion and the `rail-geometry.js:108` value together. `journey/site.css:3665` is the CSS twin and must match. Also the portrait-camera balance for Inspire (`journey/portrait.js`, not checked) is tuned against 70. Risk: high. Verify with `tools/trace/rail-centre.mjs` at 430x932.
3. Keep the rail, and make the hero text block vertically centred in the space above the rail (move `.hero` `padding-top` / `justify-content: center` on phones, `hero.css:941-948`). This addresses the "text too close to the bottom" feel without moving the rail. Risk: medium (the hero copy's entry choreography and `hero-cues.js` callouts sit below the text; the callouts at about y=340 would move too). Verify by measuring the `.hero .sub` and `.hero-cue` boxes.

**Tests and gates that pin these positions**
- `tools/test-rail-handoff.mjs:491`: `centreFromBottom: phone ? 70 : tablet ? 84 : 92` (regex on `rail-geometry.js`).
- `tools/test-mobile-landing-anchor.mjs:18`: string replace of `calc(13.5vh - var(--nav-centre-bottom))`. Also asserts the real first landing is 10px above the painted circle, so a hero-lift change must keep that.
- `tools/trace/rail-centre.mjs`: instrument (not a pinned gate per its header) that measures the glyph and housing centres at 430x932 and desktop. Its exit code checks emulation only.
- `tools/trace/mobile/ride.mjs`, `tools/trace/mobile/gate*.mjs`: not read in detail; they drive the mobile rail and likely pin the 70px seat indirectly (HYPOTHESIS).
- `tools/pose-oracle.matrix.json.txt`: snapshot of the rail's DOM geometry (`j-rail-name` etc.), so any rail move invalidates these records.

**Screenshots (`captures/H3-ui/`)**
- `U3-nointro-m390-settled.png`, `U3-nointro-m390-inspire.png` (the click did not navigate; this frame is still the hero), `U3-nointro-m375-settled.png`, `U3-nointro-m375-inspire.png`, `U3-nointro-m430-settled.png`, `U3-nointro-m430-inspire.png`
- `U3-deep-m390-inspire.png`: the real Inspire state (deep link `#/inspire`, 25 s settle). Use this one for Inspire.
- `U3-intro-m390-settled.png`: normal-intro settled state (40 s wait), same geometry as nointro hero.

---

## 4. Open questions / what I could not determine

1. U3 Inspire by tap: tapping the Inspire rail item did not navigate under SwiftShader in 20 s (hash stayed empty, `--nav-content-u` stayed 1). The deep link did reach Inspire (screenshot confirms the Inspire copy). Its readings are the only Inspire numbers. At deep-link Inspire `--nav-content-u` read `1` while the glyph centre measured 70 from the bottom. That should be `0` if the lift is removed. I could not reconcile it in the time box (HYPOTHESIS: the value was read mid-ease; a fake-clock run would settle it).
2. U3 the visible gap between the top bar and the h1 ink. Only box edges were measured.
3. U2 the kinship phrase's rest state (is the thread visible before hover?) and its rendered hover state. My capture missed paragraph 2. A re-capture with the manifesto scrolled to paragraph 2 (`scrollIntoView` on `.j-manifesto-line` that contains `concept-kinship`) at 1440x900 is needed.
4. U1 whether `tools/pose-oracle.mjs` or `tools/test-ui-lifecycle.mjs` assert the menu's font sizes. I saw the snapshot data, not a size assertion.
5. U1 the static twin uses `Didot`, not Cormorant (`static/index.html:778` (and `:1095`)). Fixing the twin's font is a separate question; it is a visible desktop-vs-static mismatch.
6. U3 the top-bar `padding` rule in `hero.css:953` is dead for `#site-nav` (ID rule wins), so the "logo drops 5px" comment in `hero.css:944-952` describes a state the page does not have. The 20.8/33.6 computed values are what the owner sees.
