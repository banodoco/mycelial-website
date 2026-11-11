# Flowers return and mobile stack preview

Baseline: cce3de31d634699b55166a629ed9255cb8635c89.
The copy renderer, text visibility controller, flywheel and original motion
constants are unchanged.

## Slide 8 owns its canvas separately from its retained scene data

- Leaving 8 for 9 keeps the existing fade and retained people/app data. Once the
  fade ends, only that navigation may release the off-screen bitmap. A newer
  entry cannot be cleared by its old departure.
- Return claims restore dimensions and canvas visibility explicitly before
  repainting the retained model. An invalidated snapshot rebuilds at the saved
  scene time, rather than starting a new entrance and immediately calling it done.
- The Flowers RAF loop now has the same bounded fault boundary as Stack/Wheel.
  A one-frame drawing error can repaint from existing state instead of leaving a
  blank canvas with a true running flag and no scheduled frame. Recovery is once
  per visit, not an automatic timer loop. Context-restored events repaint only
  the selected live visit. Browser suspension pauses/resumes the existing clock.
- `__deckDebug.flowers` reports surface owner, retained state, canvas size and RAF
  state without attempting repairs. Canvas context-loss event tests exercise
  handlers; they do not emulate physical GPU-memory loss.

## Slide 6 uses a still on mobile

The existing poster is the preview on small or coarse-pointer touch screens.
One `deckStackPosterOnly()` policy gates loading, late source assignment and
playback. Cold mobile stack visits do not warm the editor as a dependency. A
viewport changing from desktop to mobile pauses and detaches the preview source;
returning to desktop loads/plays it through the existing media path. The small
playhead stays at zero on mobile. The stack tour, cards, labels and handoff
snapshots remain interactive; desktop video is preserved.

This avoids a redundant mobile decoder. It does not stop slide 5's actual demo
from playing, nor claim to eliminate every media request elsewhere in the deck.

## Validation

```
node --test --test-concurrency=1 tests/deck-story.test.mjs tests/deck-copy-surfaces.test.mjs tests/deck-scene-resilience.test.mjs tests/deck-flowers-return.test.mjs
PORT=8240 python3 serve.py
python tools/deck/check-flowers-return.py --out flowers-return-results
python tools/deck/check-copy-ownership.py --out copy-results
```

The original normal reverse sequence did not fail in the baseline emulation
probe. The new tests separately validate the known failure paths, including
invalidated snapshots, a drawing exception after clearing, resource release,
interrupted returns, real painted canvas contribution and mobile playback.
These checks are not proof of the exact physical-phone failure's root cause.
