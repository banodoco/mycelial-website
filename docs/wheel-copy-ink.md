# Wheel copy (slides 9–11) uses the shared ink reveal

Baseline: `6835391`. Supersedes the mask-on-canonical-node approach described in
`copy-surface-handoff.md`; the ownership rules in `copy-ownership.md` are unchanged.

## What changed

- **One canonical-copy renderer.** `paintCopy()` in `mycelial/dot-transitions.js` has
  two paths only: a masked disposable clone (slides 1, 2, 4, 6–8), and ink on the real
  nodes (slides 3, 5 and now 9–11). `inkOf()` names the kind (`gap`, `as`, `fw`); the
  class is `<kind>-spreading` and the variables `--<kind>-x/-y/-inner/-outer`. The
  per-slide CSS only lists which elements carry which ink colour.
- **The wheel's text is never masked.** Its hidden endpoint is a spread of radius
  zero; shown is the class removed. Nothing depends on a browser repainting a layer
  after a mask is removed. Slide 11's question pill is a box, not glyphs, so it follows
  `--fw-reveal-alpha` on the slide (as slide 5's mobile links follow `--as-reveal-alpha`).
- **A running reveal is not replaced by its own deadline.** The copy deadline still
  delegates to the `recover` transaction, but if the reveal is already running it first
  gets `REVEAL_GRACE` (700 ms of wall time, whatever the pace) to land on a painted
  frame. A reveal that never starts, or never lands, is recovered as before.
- **A toolbar resize waits for the turn.** A height-only viewport change during a turn
  is laid out when that turn finishes (at most `RESIZE_HOLD`, 6 s, later) instead of
  ending the turn at its endpoint. Width changes and settled resizes are immediate.
- `flywheel.js` starts slide 9's count from the stat's ink (`fw-spreading` and a
  non-zero `--fw-outer`) rather than by reading an inline mask string.

## Checks

    for t in tests/deck-*.test.mjs; do node --test --test-concurrency=1 "$t"; done

Also driven in Chromium at 390×760 with 4× CPU throttling and at 1280×800: repeated
and mid-turn-reversed visits to 9, 10 and 11 each showed a partial ink spread and ended
through the ordinary `finish` transaction (no `recover`), with no mask, clone or
`dt-copy-hidden` on the wheel's nodes; a height change mid-turn produced `finish` then
`resize`. This is not an iPhone test: the original report has not been reproduced or
confirmed fixed on a physical device.

## Follow-up: the wheel's words keep their own layer (iPhone finding)

On an iPhone (Chrome iOS, build `1ff6141`) the words on slides 10 and 11 could still be
missing after a normally finished turn. The `?debug` log showed them laid out, opaque,
visible, unmasked and in colour; repaint, hiding canvases, removing the wheel's layers
and removing the inactive slides did not bring them back. The `lift` switch, which gives
the text root a compositing layer of its own, did, both times it was tried.

Every other slide's copy is already transformed (idle drift) or positioned above its
picture. The wheel's was plain in-flow content between fixed layers below the deck and
the cards' fixed layer above it. It now has `position: relative; z-index: 1;
will-change: opacity` for as long as its slide is on or presented, so it is never
promoted or demoted mid-turn.

`will-change: opacity`, not `transform`: a transform hint makes the ink's
`background-attachment: fixed` gradient resolve against the layer instead of the
viewport (seen in Chromium: the reveal spread from the wrong place). The phone test
used `transform`; `opacity` is the same promotion without that side effect, but it has
not itself been confirmed on the phone. If text is ever missing again, `lift` in the
debug panel still applies the transform version for comparison.
