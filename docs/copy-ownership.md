# Text visibility ownership

The existing `copy` controller in `mycelial/dot-transitions.js` owns text lifecycle.
`paintCopy()` is its renderer, not a separate policy layer. Its rendering code,
local mask coordinates, text roots, radial timing and flywheel choreography are
unchanged. The slide 2 improvements are untouched.

Each active claim identifies its slide, navigation context and phase. Transient
paint requires that exact state object and a current unfinished transition.
Endpoint operations require the current navigation and enforce roles: only the
selected target may be shown; only other slides may be retired. Stale callbacks
cannot write even when their JavaScript happens to run after a new navigation.

Cancellation is **not** recovery. It revokes the old writer and preserves the
current mask, including radius zero, so the successor gathers from the actual
appearance. It does not show selected text, remove its mask, or reset it to a
fully-visible appearance. The next claim, terminal reconciliation or explicit
recovery disposes the retained surface.

The network's completion routine now reports a milestone only. It cannot infer
visibility from entries in the surface registry. The controller's existing
terminal transaction stops transition writers and calls `copy.reconcile(context)`:
the target is explicitly shown, every other slide retired, and orphaned paint
surfaces cleaned without deleting original text. Deadlines use that same recovery
transaction rather than a second force-show path.

The two `data-settled` CSS rules that forced text visible and removed its mask
have been removed. Layout, typography, inactive-slide isolation, picture handoff
classes and question-card emphasis remain. Slide 11's questions still participate
in its original complete-group reveal; no viewport-fixed ink renderer is added.
Transition completion still does not stop visit-owned media or ambient animation.

## Checks

- `node --test tests/deck-story.test.mjs tests/deck-copy-surfaces.test.mjs`
- Start the project server with `PORT=8240 python3 serve.py`.
- `python tools/deck/check-copy-ownership.py --out copy-owner-results`

The browser check uses the full deck, fonts, CSS and scene scripts in Chromium
and WebKit mobile emulation. It checks repeated visits, partial/hidden interruption,
resize, orientation, question controls, direct and motion-off entry, and actual
heading pixel differences after settlement. An optional `--baseline URL` checks
unchanged heading geometry against a server running the pre-refactor revision.
Screenshots of intermediate forward/backward frames are retained for inspection.
Emulation is not evidence that an intermittent physical-phone issue is conclusively
fixed. If it persists, capture the failing screen before reading `__deckDebug.copy`
on a `?debug` URL; the trace is read-only and does not repair the page.
