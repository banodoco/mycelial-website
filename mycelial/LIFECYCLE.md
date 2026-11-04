# Controller lifetime and terminal restoration

A navigation context has two lifetimes. `context.isCurrent()` and its abort
signal describe the **visit**: ambient drawing, media, open cards, tours and
interaction may continue after the slide settles. `context.defer(dispose)` keeps
its historical meaning: release on visit exit. Do not move a whole scene's
stop/reset disposer to transition cleanup.

`context.isTransitionCurrent()` also requires an unfinished transition.
`context.transitionDefer(dispose)` releases once at finish, recovery, resize or
replacement; all registered handlers are attempted even if one throws.
`context.transitionGuard(fn)` checks ownership at invocation, and
`context.transitionLater(fn, ms)` schedules on the paced deck clock and returns
an idempotent cancellation function. Recheck transition ownership immediately
before any write after an asynchronous boundary; guarding only before `await`
is insufficient. A settled visit remains current while its transition is closed.

The controller's terminal transaction revokes transition writers, cancels text
holds and transition cleanup, retires presentation grants,
attempts picture restoration for interruptions, and always attempts canonical copy independently
of picture/layout errors. Only successful required work publishes
`data-settled`. Demo and Stack network text masks belong to the selected visit;
they survive settlement, refresh on layout, and retire when that visit exits.
Replacement aborts the old visit without drawing its abandoned
endpoint. Shared-wheel replacement retains its rendered position.

Scene participants may implement `restore(context, claim)` to synchronously
restore their canonical terminal picture and retire temporary artifacts. This
must preserve existing-visit media position, open cards, tour/chat progress and
valid ambient activity; it must not replay `enter`. On resize or recovery it runs
for both source and target participants, which must distinguish their roles using
the context. Ordinary completion retires transition work and finalizes copy
without invoking `restore`: intentional picture tails continue for the visit.
`resize(context, claim)` then applies geometry for resize/recovery/font layout;
it does not run during ordinary successful finish. Participants that omit
`restore` rely on their entry completion and existing resize hook. The controller cannot detect a failure that a hook does not report.

The direct-entry fonts-ready refresh applies the existing geometry hooks without
forcing picture restoration, closing transition work, or publishing settlement.
Entry remains responsible for its normal completion. In particular, the collage
ring keeps its full arrival while its font-dependent layout refreshes.
Failure still retires entry and attempts canonical copy; a successful fonts-only
refresh cannot clear an earlier terminal failure or claim settlement.

Required hooks return `true` or `'completed'` on success; `false`, `'failed'`,
`'cancelled'`, a throw, or a returned Promise is failure. For compatibility,
`undefined` is also accepted, so hooks should report failure explicitly.
Terminal restore/layout hooks are synchronous. A
separately scheduled layout continuation must check `claim.isCurrent()` just
before writing; the claim expires on newer endpoint/navigation/viewport work.
The claim carries `reason`, viewport generation and the requested size.

A physical viewport change debounces for 120 ms, then closes the latest
selected target and applies current geometry. Navigation before debounce makes
the new selected target own that layout. A newer navigation or viewport event
invalidates older layout claims. Geometry is recorded as applied only after
success, so a failed same-size layout remains retryable by a later resize event.
Settled resize never restarts entry.

Failure removes `data-settled`, sets `data-deck-failed`, emits `deck-failure`
(with generation, reason and errors), and logs the failure. Debug controller
state also exposes it. Failure releases navigation; there is no automatic retry
loop. A later navigation works normally, and a later current-size resize can
retry layout. Hidden/overview pauses retain the existing clock behavior; an
expired current turn is recovered on visibility return/pageshow. This policy is
idempotent and does not imply testing of actual OS suspension.

Temporary copy clones, transition hides and borrowed visuals belong to the
transition or to the owner that acquired them. Release only your own claim: an
older handoff must not unhide or hide a newer owner's picture. Copy restoration
removes the transition clones and reveals canonical copy. Scene-specific visit
activity (including live media and ambient animation) remains visit-owned.

Slide 3 is a canonical-only exception to the radial copy paint path: its one
semantic `.gap-copy-content` tree uses opacity for the existing reveal/gather
progress. It never receives a mask, a visibility class or a clone. Show,
retirement and cancellation write that same tree, and cancellation restores the
active slide's opacity. Its host still owns the chart-relative drift and layout.

Core↔Demo uses the normal slide fade with one live editor. There are no Core
snapshot buffers, flight canvases, panel/mink hide states or reverse morph
handoffs. The demo keeps a 1.8 second entry beat before its normal tour. Core's
existing departure and the text/network choreography remain. Stack's separate
6→5 return still owns `dt-await` and its visibility/opacity gates; the global
inactive-slide isolation remains responsible for off-slide access and paint.

## Focused checks

From the repository root, install the package dependencies and start the
range-capable project server in a separate terminal:

```sh
PORT=8240 python3 serve.py
```

Run these checks sequentially against that server:

```sh
node tools/deck/check-canonical-paint.mjs http://127.0.0.1:8240/mycelial/index.html
node tools/deck/check-controller-lifecycle.mjs http://127.0.0.1:8240/mycelial/index.html
node tools/deck/check-scenes-1-3.mjs http://127.0.0.1:8240/mycelial/index.html
node tools/deck/check-scenes-4-7.mjs http://127.0.0.1:8240/mycelial/index.html
node tools/deck/check-scenes-8-11.mjs http://127.0.0.1:8240/mycelial/index.html
node tools/deck/check-copy-lifecycle.mjs http://127.0.0.1:8240/mycelial/index.html
node tools/deck/check-firstload.mjs http://127.0.0.1:8240/mycelial/index.html
node tools/deck/check-stress.mjs http://127.0.0.1:8240/mycelial/index.html --skip-webkit
CHROMIUM_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' node tools/deck/check-copy-parity.mjs http://127.0.0.1:8240/mycelial/index.html desktop
```

These reproduce the integrated macOS/headless Chrome checks using port 8240;
`--skip-webkit` excludes WebKit. The three scene scripts hard-code that macOS
Chrome path, and those scripts and the copy lifecycle script write screenshots
to `/Users/peteromalley/Documents/Codex/2026-11-03/new-chat/outputs`. They overwrite files at that location and must be adapted before use on a
machine without those paths. The copy lifecycle and
parity scripts accept `CHROMIUM_PATH`; the remaining checks have their own
browser discovery. The controller fixture loads the actual inline controller
with isolated scene/network participants; real-scene checks remain separate.

The integrated checks passed on the P1–P5 candidate in headless Chrome,
including 66 stress checks, all adjacent boundaries in both directions,
copy parity and sampled Demo/Stack continuity. A prior stress attempt stalled
without a known cause; a fresh run on a plain server reported socket errors,
while a serialized retry on `serve.py` passed. The reported Chrome missing-text
symptom was not reproduced or explained. Simulated visibility events are not an
OS suspension test; WebKit, native touch, a full motion comparison and every
browser paint/resource failure remain outside that evidence. Visible inspection
was limited to selected headless Chrome captures.

`check-canonical-paint.mjs` checks the revised slide 3 and Core↔Demo paths in
Chromium and WebKit phone emulation. It uses keyboard navigation, per-frame
canonical paint checks, and screenshot pixel differences against an opacity-zero
control, including repeated entry, direct/reduced entry, resize interruption,
queued return, playback and Stack return. `check-slide3-copy.mjs` now checks canonical identity, opacity animation and
copy owner cleanup across three viewports; `check-demo-core-return.mjs` checks
three keyboard entries per engine and opaque canonical panels between visits.
Their obsolete clone-parity and reverse-morph assertions have been retired. Emulated
WebKit does not establish physical iPhone/iOS paint behavior.
