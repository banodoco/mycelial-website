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
