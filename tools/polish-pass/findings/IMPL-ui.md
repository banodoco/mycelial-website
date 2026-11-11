# IMPL-ui report (U1, U3). Branch polish/ui, commit 80bac26.

STATUS: code changes done and committed. Browser verification INCOMPLETE: the container
hit load average 32-41 on 4 cores (about 47 Chromium processes from other agents), and every
after-state Playwright run stalled before finishing. No after-state screenshots or measurements
exist. Everything below marked UNMEASURED is computed or read from H3 captures, not re-measured.

## U1 menu thesis lines
- journey/site.css:682 `.j-menu-thesis`: font-size 1.08rem -> 1.65rem (26.4px), line-height 1.18,
  colour var(--parchment) -> var(--ink) (same value #f7ebd7 in mycelial.css:41-42; hero headline token),
  margin 0 -> 0.3rem 0 0.2rem (existing margin was 0, so there was nothing to scale).
- Phone block (site.css:913) untouched: still clamp(1.35rem,6vw,1.58rem) = 22.5-23.4px.
- Static twin static/index.html:783 `.menu-thesis`: same edit. Its font is still Didot/Playfair
  (static/index.html:778), not Cormorant. Pre-existing mismatch, not changed.
- Copy, group headings and rows: untouched.
- Overflow: UNMEASURED after the change. Before: 1440x900 had 184px spare; 1280x720 already
  overflowed by 25px (panel is overflow-y:auto, so it scrolls, nothing clips). Expected after:
  about +40px per thesis line, so 1440x900 probably fits or needs a few px; 1280x720 scrolls more.
  If 1440x900 overflows, the fallback is a `@media (max-height: ...)` step-down, not done.
- Screenshots: before = H3 captures copied to captures/IMPL-ui/before-U1-menu-{d1440,d1280,m390,m375}.png.
  After = NOT captured. The harness scripts exist in harness/ui-menu.js but the menu open click
  (mouse pointerdown) did not open the panel at 1440 reliably under load.

## U3 intro rail
- journey/site.css, phone block (`orientation: portrait and max-width: 620px`, ~line 3683):
  `--nav-hero-lift: 0px`. The hero rail now rests on --nav-centre-bottom (70 on phones), the same
  property the chapters use. No second literal. Desktop/tablet unchanged.
  Expected from H3's formula (glyph centre = 70 + lift): hero glyph centre moves from 113.9 to 70
  at 390x844 (43.9px lower), 90.0 to 70 at 375x667 (20px), 125.8 to 70 at 430x932 (55.8px).
  The 1.15 hero scale is unchanged (it does not move the glyph centre, per the H3 measurements).
- Label-bottom check (estimated from the H3 Inspire frame, captures/H3-ui/U3-deep-m390-inspire.png,
  390x844): glyph centre about 71px from bottom, label ink bottom about 37px from bottom.
  Owner's band is 18-30px, so the in-chapter seat is OUTSIDE it. Per the brief I did not add an
  intro-only value. Matching the in-chapter seat was kept (one source of truth). To put the label
  bottom at the top bar's 20.8px inset, the shared value would need to be about 54px, not 70:
  rail-geometry.js:108 `centreFromBottom: 70` (phone) and site.css:3665 twin, which are JS-owned.
  OWNER DECISION: change the phone chapter seat 70 -> ~54 (affects Inspire, Equip, Connect, Purpose
  on phones; needs a visual check at 390x844 and the Purpose composition) or leave at 70.
- Early choreography (headline shown centred, before the mushroom grows). Geometry, UNMEASURED
  on the frame: top bar bottom 98.4px; rail glyph top after change about 751px (844-70-~23).
  Optical midpoint = (98.4+751)/2 = 425; viewport centre = 422, so the centred text block is about
  3px from the midpoint. Before the change the rail top was about 709 (midpoint 404, offset 18px).
  The lowered rail brings the offset inside the 12px band, so I left the choreography alone. The
  early headline positioning is JS-owned anyway (not changed).
- Hero text (hero.css:880-887, 941-948) is top-anchored; not changed.

## Tests
- tools/test-rail-handoff.mjs: added assertion (~line 491 area) that the phone media block sets
  `--nav-centre-bottom: 70px` and `--nav-hero-lift: 0px`. Verified the regex matches site.css.
  The file as a whole FAILS BEFORE AND AFTER my change at line 145 ("mobile Final gives its
  background camera a stronger independent lift", 20 !== 72). Pre-existing, not touched. So the new
  assertion is never reached by the runner; it was checked standalone.
- tools/test-mobile-landing-anchor.mjs:18: the replace target `calc(13.5vh - var(--nav-centre-bottom))`
  is still in the :root default (site.css:3646, overridden on phones), so it still matches exactly
  once (verified: count 1). Added a loud failure if the count is not 1, so a future edit cannot
  silently no-op. The mock is now inert on phones (lift is 0 there), which I did not re-verify in a
  browser (needs the browser run).
- tools/trace/rail-centre.mjs: not edited; it measures live geometry, so it will report the new
  phone hero seat when run.
- tools/test-static-content.mjs: PASS.
- npm run lint: 16 problems (7 errors, 9 warnings) both before and after; none in my files.
- npm run test:unit: not run to completion (rail-handoff fails at baseline, see above). cycles not run.

## Not done / needs eyes
- After-state screenshots and getBoundingClientRect numbers for U1 and U3 (blocked by load).
- Owner must check on a phone: the lowered intro rail, and whether the 37px label-bottom inset
  (vs 20.8 top) is the intended feel. Decision pending (see U3 above).
- No JS edits. rail-geometry.js:108 and site.css:3665 untouched.
