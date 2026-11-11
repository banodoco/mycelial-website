# Scene reliability and stack rendering cost

Baseline: `b519a881e7a29e8536461ddd47eac547128b8626`.
The copy owner and renderer in `dot-transitions.js` are unchanged. Stack build
constants, flywheel morph/clearance timing and slide 2 are unchanged.

## Scene ownership and failure boundaries

- `deckNow()` samples the previous pause state. Visibility/overview boundaries
  do not charge a suspended interval as active animation time.
- Media warming captures playback intent before `load()` resets it. Resumption
  checks the same visit, selected slide, motion preference and pause state.
- Stack playback has one pending request. Stale promise completions cannot pause
  a newer visit. Poster pixels remain underneath video until decoded data exists;
  an empty/error source restores the poster, and buffering keeps the last frame.
- Stack preview handoff commits only after successful capture. A failed whole
  panel capture takes the existing quick entrance rather than publishing half a
  snapshot. A failed reverse capture takes the normal fold endpoint.
- Main scene-frame failures are reported and receive at most one local endpoint
  recovery per visit. Permanent errors do not cause an unbounded retry loop.
- Thread drawing gets two attempts per layout, without permanently setting
  `canvas.hidden`. A restored context or new layout may try again; independent
  DOM labels, cards and planes remain available. Cache failure falls back to
  ordinary drawing instead of becoming a rendering dependency.
- Font completion invalidates wheel measurements but only a current active visit
  can publish a frame. Hidden pages pause scene activity and resume via the
  existing lifecycle. The text controller is not called by these repairs.

## Rendering changes

The stack's canvas is cropped to the complete artwork bounds, including every
accordion label position and glow margin. Completed roots and registration
threads are cached within that crop; guide and leader highlights stay live. The
cache is invalidated by layout or an unfinished build and released on exit.

The tour's six-pixel lift uses individual translation in the same parent
coordinate space rather than reassigning plane dimensions and position. Builds
and folds still use their original frames and perspective. Inner content refits
only when size or stretch mode changes. Detached snapshot canvases release their
large backing buffers after handoff, while their reusable element identities stay.

A genuinely too-short viewport scrolls the existing composition instead of
allowing a zero/negative stack scale. Ordinary viewport geometry is unchanged.

## Diagnostics and verification

`?debug` exposes `__deckDebug.stack` (frame scheduling, flags, scale, canvas and
snapshot pixels, static paint/cache counts) and `__deckDebug.sceneFaults` (bounded
read-only records). Fault reporting does not write visibility or run timers.

```
node --test tests/deck-story.test.mjs tests/deck-copy-surfaces.test.mjs tests/deck-scene-resilience.test.mjs
PORT=8240 python3 serve.py
python tools/deck/check-scene-resilience.py --baseline http://127.0.0.1:8241/mycelial/index.html --out scene-results
python tools/deck/check-copy-ownership.py --out copy-results
```

The scene browser test uses the full deck and real fonts/media, checks painted
label pixels, repeats 5/6/7 visits and final-slide visits, interrupts transitions,
opens controls, resizes, and injects one-time capture/draw/frame failures. It
compares static plane/flag geometry and images with the baseline and records
stroke calls per animation frame. These are bounded work measurements, not
physical-device GPU-memory or battery claims. WebKit emulation does not prove
that every intermittent physical-iPhone symptom is fixed.

## Slide 6 on a phone: layer size, the step back from 7, and an entry that trusts nothing

Baseline: `63db774` (round 6). Measured in Chromium with phone emulation (390×669 at 3×, touch, 4× CPU
throttle); nothing here was run in WebKit, and what is said about an iPhone is inference from these figures.

- **Layer size.** The world used to be laid out in scene px and scaled down as a whole (`scale(k)`; in Chrome,
  CSS zoom instead). A box under the perspective is a compositing layer, and a layer is painted at its laid-out
  size. On the phone k ≈ 0.146: the five planes at rest were 1,092,000 css px² of layers for 23,300 px² on
  screen, and at the start of the unfold from slide 5 the planes, the three copies of slide 5's panels and the
  carried picture together reached 8.4–9.6 million css px² (about 76–86 million device pixels at 3×, ~300–350 MB
  if an engine backs them all). Each plane is now a slab (the layer, at its size on screen, under a perspective
  k times the scene's) holding the plane at its scene size, scaled by k in the flat. The peak is about 0.2
  million css px². The picture is the same: with the deck's clock stepped frame by frame, every plane, copy,
  carried picture and the mink are within 0.1 px of the former layout in all four turns around the slide, on a
  phone, a tablet on its side and a desktop. `?stack=scaled` (or the debug panel's `st big`) lays the world out
  the former way.
- **The playhead** on the timeline plane has a layer of its own only where the film plays (`.st.is-live`): a
  layer inside a plane makes WebKit composite the plane's content at scene size again.
- **The guide's bead** has a small canvas of its own that follows it. The threads' canvas is drawn only when what
  it shows changes; at rest it used to be cleared, re-stamped and re-uploaded in every frame.
- **The step back from slide 7.** While the mink holds the stack its root's opacity and scale are written per
  frame. Slide 6 then carries `dt-return`, whose rule gives the slide's pictures a 0.6 s opacity transition, so
  each of those writes began a new transition on the root (measured: 0.42 s for a fade written in 0.08 s). The
  root now takes no transition while it is held. The pile therefore reaches full opacity at about 10 % of its size
  (behind her) and no longer at about 45 %; nothing else in the turn changes, and its length is unchanged.
- **Entry is idempotent.** `start()` clears every residue an exit can leave (root transform/opacity/transition,
  `is-gathering`, the pile, hand-off copies, a stray avatar copy, inline display/visibility/opacity on planes,
  flags, cards and canvas, `st-arrive`, the slide's scroll) and forgets what was last written, so every box is
  written again. `landAtRest()` is the one settled picture, used by rest/direct entry, restore and recovery;
  its steps are tried one by one.
- **The loop cannot end the picture.** Every frame fault lands the rest picture. The loop restarts twice per
  visit, then stands still with cards opening without a clock. The gathering's frames (stack and slide 7) have
  their own boundaries and give the stack back whole. About once a second, and at every `deck-transaction` on the
  slide, the settled DOM is checked against what it must be (`restFaults()`, inline styles only); a mismatch is
  reported as a `stack/state` scene fault and repaired.
- **Diagnostics.** `__deckDebug.stack` adds `wrong` (the state check), per-plane rect/opacity/styles, root and
  slide classes, canvases, flags and running animations; `stackControl` backs the panel's `st restore`,
  `st layer` (the compositing hint, a proposal only), `st flat` and `st big`. The panel's quarter-second tick no
  longer runs its whole-document hit test unless the panel is open or a log is copied: it cost about two thirds of
  the main thread at 4× throttle.
