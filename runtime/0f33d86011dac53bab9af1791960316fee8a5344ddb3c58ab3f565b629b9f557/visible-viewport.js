// visible-viewport.js — THE definition of "the visible viewport", at the site
// root beside flags.js for the same reason flags.js is there: organism/,
// journey/ and main.js all import it, and organism must never import from
// journey. No dependencies; safe to import in node (no window).
//
// WHY ONE DEFINITION. On iOS (Chrome above all, in a tab just opened from a
// link) `innerHeight`, `documentElement.clientHeight` and a `position: fixed;
// inset: 0` box can all report the LARGE viewport (~880 px on a phone showing
// ~738 under its URL bar and toolbar), and iOS does not reliably fire
// `resize` when its bars settle. Every consumer that read its own source once
// was a latent "centre is wrong, sometimes" bug: the scene sized from
// innerHeight sat 71 px low with its bottom 142 px under the toolbar.
//
// THE POLICY (pinned by tools/test-visible-viewport.mjs):
//   · the box is the visual viewport when one exists at scale ~1, clamped so
//     it is NEVER larger than the layout box (a fixed inset:0 probe, which is
//     what fixed-position CSS really lays out in; innerWidth/innerHeight only
//     when there is no document);
//   · under pinch zoom (scale != 1) the visual viewport is a magnifier, not
//     the screen: fall back to the layout box;
//   · THE FIRST READ IS NOT TRUSTED. It is re-read on visualViewport resize
//     and scroll, window resize, orientationchange, pageshow and load, and
//     once per animation frame for SETTLE_MS after start and after any event
//     or change, and past that until two consecutive reads agree;
//     (plus screen.orientation 'change', a re-armed resolution query for the
//     pixel ratio, and the coarse-pointer query);
//   · a change is published only when width, height, top or left moved by at
//     least 1 px (or the pixel ratio / coarse pointer changed), synchronously to subscribers (in subscription order), as a
//     `visibleviewportchange` event on window (for classic scripts that
//     cannot import), and as custom properties on :root:
//       --visible-w, --visible-h, --visible-top, --visible-left,
//       --visible-bottom (layout box bottom minus visible bottom),
//       --visible-right.
//     Where the visual viewport IS the layout viewport (every desktop,
//     headless) the box is innerWidth x innerHeight exactly and the
//     offsets are 0, so CSS written as `top: var(--visible-top, 0px);
//     bottom: var(--visible-bottom, 0px)` lays out exactly as `inset: 0`.
//   · after that, a 4 Hz watch of the cheap sources (no layout read) re-arms
//     the poll whenever any of them moves, for the life of the page;
//   · ON A FINE POINTER (desktop) THE SETTLE PHASE IS SHORT AND CHEAP
//     (2026-11, boot stutter): the poll stops after QUICK_FRAMES agreeing
//     reads unless a change is actually observed (then the full SETTLE_MS
//     window applies, as everywhere); an event that finds nothing changed
//     starts no per-frame phase at all; and the fixed probe — the one
//     forced layout per read — is measured only when a cheap source
//     (innerWidth/innerHeight, the visual viewport, the ratio) has moved
//     since it was last measured. The large-viewport lie this module exists
//     for is a phone's; a coarse pointer keeps every read and the full
//     window exactly as before;
//   · two tiers: `subscribe` (every change, at once) and `subscribeSettled`
//     (once per burst, SETTLED_MS after it) — see createVisibleViewport.
//
// THE SNAPSHOT also carries the raw facts device predicates need (aspect,
// dpr, coarse), so a later pass can define phone/tablet ONCE, here.

export const SETTLE_MS = 2000;
/** The second tier: quiet time after the last change before `subscribeSettled`
 *  consumers hear of it (the same 150 ms the page's resize debounces used). */
export const SETTLED_MS = 150;
/** The background watch's period (see createBrowserViewport). */
export const WATCH_MS = 250;
const SCALE_EPS = 0.01;
/** Fine pointer: agreeing per-frame reads after which the settle poll may
 *  stop early (see the policy note above). */
export const QUICK_FRAMES = 3;

/** Pure: the visible box from one set of readings. */
export function computeVisible({ layoutWidth, layoutHeight, vv, dpr = 1, coarse = false }) {
  const lw = Math.max(0, +layoutWidth || 0), lh = Math.max(0, +layoutHeight || 0);
  const facts = { dpr: +dpr || 1, coarse: !!coarse };
  const usable = vv && Math.abs((+vv.scale || 1) - 1) < SCALE_EPS
    && vv.width > 0 && vv.height > 0;
  if (!usable) {
    return { width: lw, height: lh, top: 0, left: 0, layoutWidth: lw, layoutHeight: lh, ...facts };
  }
  const width = Math.min(vv.width, lw);
  const height = Math.min(vv.height, lh);
  const top = Math.min(Math.max(0, +vv.offsetTop || 0), lh - height);
  const left = Math.min(Math.max(0, +vv.offsetLeft || 0), lw - width);
  return { width, height, top, left, layoutWidth: lw, layoutHeight: lh, ...facts };
}

const moved = (a, b) => !a || !b
  || Math.abs(a.width - b.width) >= 1 || Math.abs(a.height - b.height) >= 1
  || Math.abs(a.top - b.top) >= 1 || Math.abs(a.left - b.left) >= 1
  || Math.abs(a.layoutWidth - b.layoutWidth) >= 1 || Math.abs(a.layoutHeight - b.layoutHeight) >= 1
  || a.dpr !== b.dpr || a.coarse !== b.coarse;
const same = (a, b) => a.width === b.width && a.height === b.height
  && a.top === b.top && a.left === b.left
  && a.layoutWidth === b.layoutWidth && a.layoutHeight === b.layoutHeight
  && a.dpr === b.dpr && a.coarse === b.coarse;

function freeze(s) {
  return Object.freeze({
    ...s,
    bottom: s.top + s.height,
    aspect: s.height > 0 ? s.width / s.height : 1,
    insetBottom: Math.max(0, s.layoutHeight - s.top - s.height),
    insetRight: Math.max(0, s.layoutWidth - s.left - s.width),
  });
}

/**
 * The policy with its world injected (the browser singleton below and the
 * unit test's fakes use the same code).
 * @param {object} env
 * @param {function(): {layoutWidth:number, layoutHeight:number, vv:object|null}} env.read
 * @param {function(): number} env.now
 * @param {function(function): any} [env.raf]   one-shot frame callback
 * @param {function(object): void} [env.publish] side effects of a change (CSS vars, DOM event)
 * @param {function(function, number): any} [env.setTimer]  one-shot timer (settled tier)
 * @param {function(any): void} [env.clearTimer]
 *
 * TWO TIERS. `subscribe` hears every published change at once: things that
 * must track the visible box this frame (the canvas, the camera aspect, CSS
 * variables). `subscribeSettled` hears a burst once, SETTLED_MS after its
 * last change: things that are expensive or RESTART something when told
 * (a camera re-ease, a re-measure of the rail's metrics), so a toolbar that
 * settles in five steps restarts them once, as one window `resize` did.
 */
export function createVisibleViewport({ read, now, raf = null, publish = null,
  setTimer = null, clearTimer = null, quickSettle = null }) {
  let current = freeze(computeVisible(read()));
  let lastRaw = current;
  let revision = 0;
  let pollUntil = now() + SETTLE_MS;
  let polling = false;
  // quickSettle(): true where a short settle phase is enough (a fine
  // pointer). `quickArmed` stays true while the current phase has observed
  // no change; `agreeRun` counts its consecutive agreeing reads.
  const quick = () => !!(quickSettle && quickSettle());
  let quickArmed = true;
  let agreeRun = 0;
  const subs = [];
  const settledSubs = [];
  let settledBase = current;   // what settled subscribers last heard
  let settledTimer = null;
  function settle() {
    settledTimer = null;
    const prev = settledBase;
    settledBase = current;
    for (const fn of settledSubs.slice()) {
      try { fn(current, prev); } catch (err) { console.error('[visible-viewport] settled subscriber threw', err); }
    }
  }

  function refresh() {
    const raw = computeVisible(read());
    const agree = same(raw, lastRaw);
    lastRaw = raw;
    if (moved(raw, current)) {
      const prev = current;
      current = freeze(raw);
      revision += 1;
      pollUntil = now() + SETTLE_MS;
      quickArmed = false;
      if (publish) publish(current, prev);
      for (const fn of subs.slice()) {
        try { fn(current, prev); } catch (err) { console.error('[visible-viewport] subscriber threw', err); }
      }
      if (setTimer && settledSubs.length) {
        if (settledTimer !== null && clearTimer) clearTimer(settledTimer);
        settledTimer = setTimer(settle, SETTLED_MS);
      }
    }
    return agree;
  }
  function frame() {
    polling = false;
    const agree = refresh();
    agreeRun = agree ? agreeRun + 1 : 0;
    // a fine pointer, nothing moved in this phase, and the reads agree
    if (agree && quickArmed && agreeRun >= QUICK_FRAMES && quick()) return;
    if (now() < pollUntil || !agree) schedule();
  }
  function schedule() {
    if (polling || !raf) return;
    polling = true;
    raf(frame);
  }
  /** An event that can move the box: read now, and keep reading a while. */
  function poke() {
    if (quick()) {
      // read once; only an observed change (or reads still in flux) earns
      // the per-frame phase, and then the full window
      const before = revision;
      const agree = refresh();
      if (agree && revision === before) return;
      quickArmed = false;
      agreeRun = 0;
      pollUntil = Math.max(pollUntil, now() + SETTLE_MS);
      schedule();
      return;
    }
    pollUntil = Math.max(pollUntil, now() + SETTLE_MS);
    refresh();
    schedule();
  }

  if (publish) publish(current, null);
  schedule();

  return {
    /** The current box: {width, height, top, left, bottom, layoutWidth,
     *  layoutHeight, insetBottom, insetRight}. Cached; cheap per frame. */
    get: () => current,
    get revision() { return revision; },
    get polling() { return polling; },
    poke,
    refresh,
    /** fn(next, prev) on every published change. Returns the unsubscribe.
     *  `since` is the box the caller built itself for, if it read one before
     *  subscribing: when the box has moved since, fn runs at once with it —
     *  a settle that lands between a boot-time read and the subscription
     *  must not be lost (a new tab's bars settle inside that window). */
    subscribe(fn, since = null) {
      subs.push(fn);
      if (since && moved(since, current)) fn(current, since);
      return () => { const i = subs.indexOf(fn); if (i >= 0) subs.splice(i, 1); };
    },
    /** fn(next, prevSettled) once per burst, SETTLED_MS after its last
     *  change. `since` as for subscribe; a missed change is delivered on the
     *  settled tier's own delay. */
    subscribeSettled(fn, since = null) {
      if (!settledSubs.length) settledBase = current;
      if (since && moved(since, current)) {
        const late = () => fn(current, since);
        if (setTimer) setTimer(late, SETTLED_MS); else late();
      }
      settledSubs.push(fn);
      return () => { const i = settledSubs.indexOf(fn); if (i >= 0) settledSubs.splice(i, 1); };
    },
  };
}

export function createBrowserViewport(win) {
  const doc = win.document;
  let probe = null;
  const coarseQuery = typeof win.matchMedia === 'function' ? win.matchMedia('(pointer: coarse)') : null;
  const fine = () => !(coarseQuery && coarseQuery.matches);
  // The cheap sources, as one string: no layout read (see the watch below).
  const sign = () => {
    const v = win.visualViewport;
    return `${win.innerWidth},${win.innerHeight},${win.devicePixelRatio},`
      + (v ? `${v.width},${v.height},${v.offsetTop},${v.offsetLeft},${v.scale}` : '');
  };
  // the probe's last measured box and the cheap sources it was measured under
  let probeBox = null, probeSig = null;
  const read = () => {
    let layoutWidth = win.innerWidth, layoutHeight = win.innerHeight;
    // What fixed-position CSS actually lays out in. innerHeight can report
    // the large viewport while this box (and the visual viewport) do not.
    const host = doc && (doc.body || doc.documentElement);
    if (host) {
      if (!probe) {
        probe = doc.createElement('div');
        probe.setAttribute('aria-hidden', 'true');
        probe.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;'
          + 'visibility:hidden;pointer-events:none;contain:strict;z-index:-1;';
      }
      // On a fine pointer the probe is re-measured only when a cheap source
      // has moved: its box cannot change otherwise there, and the measure is
      // a forced layout in the busiest frames of the boot. A coarse pointer
      // measures every read, as it always has.
      const sig = sign();
      let r;
      if (fine() && probeBox && probeSig === sig && probe.parentNode === host) r = probeBox;
      else {
        if (probe.parentNode !== host) host.appendChild(probe);
        const b = probe.getBoundingClientRect();
        r = probeBox = { width: b.width, height: b.height };
        probeSig = sig;
      }
      if (r.width > 0 && r.height > 0) {
        layoutWidth = Math.min(layoutWidth, r.width);
        layoutHeight = Math.min(layoutHeight, r.height);
      }
    }
    return { layoutWidth, layoutHeight, vv: win.visualViewport || null,
      dpr: win.devicePixelRatio || 1, coarse: !!(coarseQuery && coarseQuery.matches) };
  };
  const root = doc && doc.documentElement;
  const publish = (s, prev) => {
    if (root && root.style) {
      const set = (k, v) => root.style.setProperty(k, `${v}px`);
      set('--visible-w', s.width);
      set('--visible-h', s.height);
      set('--visible-top', s.top);
      set('--visible-left', s.left);
      set('--visible-bottom', s.insetBottom);
      set('--visible-right', s.insetRight);
    }
    if (prev && typeof win.dispatchEvent === 'function' && typeof Event === 'function') {
      win.dispatchEvent(new Event('visibleviewportchange'));
    }
  };
  const api = createVisibleViewport({
    read, publish, quickSettle: fine,
    now: () => win.performance.now(),
    raf: (fn) => win.requestAnimationFrame(fn),
    setTimer: (fn, ms) => win.setTimeout(fn, ms),
    clearTimer: (id) => win.clearTimeout(id),
  });
  for (const type of ['resize', 'orientationchange', 'pageshow', 'load']) {
    win.addEventListener(type, api.poke);
  }
  const vv = win.visualViewport;
  if (vv && vv.addEventListener) {
    vv.addEventListener('resize', api.poke);
    vv.addEventListener('scroll', api.poke);
  }
  // Rotation is a first-class change, and iOS reports stale sizes for a few
  // frames after it: poke() re-arms the settle poll as well as reading.
  const orientation = win.screen && win.screen.orientation;
  if (orientation && orientation.addEventListener) orientation.addEventListener('change', api.poke);
  // The pixel ratio moves with no resize (another display, browser zoom): a
  // resolution query for the current ratio fires once when it stops matching,
  // and is re-armed at the new ratio. The renderer's ratio stays the
  // governor's (organism/performance.js); this only makes the change heard.
  if (typeof win.matchMedia === 'function') {
    const armDpr = () => {
      const mq = win.matchMedia(`(resolution: ${win.devicePixelRatio || 1}dppx)`);
      const once = () => { if (mq.removeEventListener) mq.removeEventListener('change', once); api.poke(); armDpr(); };
      if (mq.addEventListener) mq.addEventListener('change', once);
    };
    armDpr();
  }
  if (coarseQuery && coarseQuery.addEventListener) coarseQuery.addEventListener('change', api.poke);
  // AND A WATCH THAT NEVER STOPS, BECAUSE iOS DOES NOT PROMISE AN EVENT. Four
  // times a second it compares the cheap sources (no layout read); any
  // difference is treated exactly like an event. This is what keeps the box
  // right after the settle poll has ended — bars that collapse or return
  // late, with nothing fired.
  let signature = sign();
  win.setInterval(() => {
    const next = sign();
    if (next !== signature) { signature = next; api.poke(); }
  }, WATCH_MS);
  return api;
}

// Node (the contract suites) has no real window: read the globals live —
// a stubbed `window` object first, then bare globals — so a suite that stubs
// innerWidth/innerHeight sees its stub, exactly as before.
const liveGlobal = (k) => {
  const w = globalThis.window;
  if (w && typeof w[k] === 'number') return w[k];
  return typeof globalThis[k] === 'number' ? globalThis[k] : 0;
};
const nodeViewport = {
  get() {
    const w = liveGlobal('innerWidth');
    const h = liveGlobal('innerHeight');
    return freeze({ width: w, height: h, top: 0, left: 0, layoutWidth: w, layoutHeight: h,
      dpr: typeof devicePixelRatio === 'number' ? devicePixelRatio : 1, coarse: false });
  },
  revision: 0, polling: false,
  poke() {}, refresh() { return true; },
  subscribe() { return () => {}; },
  subscribeSettled() { return () => {}; },
};

/** THE page's visible viewport. One instance per document, shared by every
 *  copy of this module that loads (live source and a runtime snapshot). */
export const visibleViewport = (typeof window !== 'undefined' && window.document
    && typeof window.requestAnimationFrame === 'function' && window.performance
    && typeof window.addEventListener === 'function')
  ? (window.__visibleViewport ||= createBrowserViewport(window))
  : nodeViewport;

/** Shorthand for visibleViewport.get(). */
export const visibleSize = () => visibleViewport.get();

/** NDC -> client CSS px through the visible box, which is where the canvas
 *  sits. Same arithmetic as `(x * 0.5 + 0.5) * innerWidth` (left and top are
 *  0 wherever the screen is the layout viewport). */
export const ndcToClientX = (x) => {
  const v = visibleViewport.get();
  return v.left + (x * 0.5 + 0.5) * v.width;
};
export const ndcToClientY = (y) => {
  const v = visibleViewport.get();
  return v.top + (-y * 0.5 + 0.5) * v.height;
};
