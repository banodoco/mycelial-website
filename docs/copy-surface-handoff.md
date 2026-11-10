# Wheel copy surface cleanup

Baseline: `d1f24f5063d72397c5f60eae42b89ea7f57b10e5`.

Slides 9–11 use local-coordinate CSS masks on their original text roots. Unlike
cloned text on earlier slides, these surfaces were not registered in the existing
`overlays` map. `finishNetwork()` therefore could not enumerate their masks, and
`resize()` could miss a remaining live mask after its tween/turn had stopped.

The fix registers an original masked root as a self-entry in that same map.
Cleanup removes the mask, never the original node. Detached original nodes are
also recognised by identity. `liveCloneCount` still counts only real clones.
There is no new renderer, animation clock, wrapper, CSS override or repair timer.
The original `turn`, `reveal`/`gather`, timing and geometry functions are unchanged;
so are the flywheel scene, slide 11's full `.split` text root, and slide 2.
Cancellation behaviour is deliberately unchanged in this small patch.

## Checks

    node --test tests/deck-copy-surfaces.test.mjs

The tests extract production functions, exercise repeated visits, delayed/stale
cleanup, canonical-node identity, completion and viewport recovery, and pin the
unchanged animation sections. They are state tests, not mobile paint proof.

For the reduced Chromium pixel comparison (Python packages: playwright, Pillow,
numpy; an installed Chromium binary):

    python tools/deck/check-copy-surfaces.py --chromium /usr/bin/chromium

Use `--baseline-file FILE` instead of the Git baseline when running outside a Git
checkout, and `--out DIR` to choose the results directory. This comparison renders
production copy functions in representative phone/desktop layouts with fallback
fonts. It compares forward/reverse intermediate frames, performs repeated visits,
and demonstrates the cleanup-registry failure with actual painted pixels. It
is not a full-deck choreography test and is not an iOS/Safari reproduction.

## On-device diagnostics

On the deck's existing `?debug` diagnostic URL, `window.__deckDebug.copy` returns a
bounded trace of hide/show/retire/cancel/finish operations plus each wheel text
root's registered/hidden/mask/opacity/transform state. Capture the failing screen
before reading diagnostics. The getter only observes state; it never repairs it.
No trace is allocated on normal URLs and no diagnostic timers are introduced.

This closes a demonstrated cleanup gap. Whether it resolves the originally
reported intermittent physical-phone disappearance still requires checking on
the affected device; passing these checks is not a claim that it has been
reproduced or definitively fixed.
