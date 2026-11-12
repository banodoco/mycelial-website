#!/usr/bin/env node
/* tools/test-visible-viewport.mjs — the policy of visible-viewport.js, the
 * page's one definition of the visible viewport. Pure node, fakes only.
 *
 * What it catches that nothing else does: the scene, the hero copy and the
 * rail all size from this module, and on iOS the sources it reads disagree
 * and change without events (innerHeight 880 on a screen showing 738). Each
 * row below is one way that has gone wrong:
 *
 *   V1  the visible box is the visual viewport, never larger than the
 *       layout box (a lying innerHeight / large fixed box cannot win)
 *   V2  pinch zoom (scale != 1) falls back to the layout box
 *   V3  the first read is not trusted: a change that arrives with no event
 *       is picked up by the per-frame poll, and published once
 *   V4  coalescing: sub-pixel jitter is not a change; >= 1 px is
 *   V5  the poll stops on its own after SETTLE_MS once two reads agree,
 *       keeps going while they do not, and any event re-arms it
 *   V6  subscribers run synchronously, in order, with (next, prev); the
 *       publish hook (CSS custom properties) runs first, and unsubscribe works
 *   V7  node (no window): visibleSize() reads the stubbed globals live
 *   V8  the settled tier hears a five-step toolbar settle once, SETTLED_MS
 *       after its last step; a pixel-ratio change alone is a change
 *   V9  a settle that lands BETWEEN a consumer's boot-time read and its
 *       subscription is delivered on subscribe (`since`), on both tiers —
 *       the new-tab race that left the scene canvas at the large height
 *   V10 the consumers that must agree are wired to that contract (source
 *       text — the scene and the spore layer cannot be built in node): the
 *       scene reconciles the size its renderer was BUILT at when it
 *       subscribes, the spore layer subscribes with the box it was composed
 *       for and re-sends the worker its size on every change, and the scene
 *       does not ease its framing while the layer still owns its own frame
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  computeVisible, createVisibleViewport, visibleSize, SETTLE_MS, SETTLED_MS,
} from '../visible-viewport.js';

let failed = 0;
const row = (id, name, fn) => {
  try { fn(); console.log(`  PASS  ${id}  ${name}`); }
  catch (e) { failed++; console.log(`  FAIL  ${id}  ${name}\n        ${e.message.split('\n').join('\n        ')}`); }
};

/** A fake world: a layout box, a visual viewport, a clock and a frame queue. */
function world({ lw = 430, lh = 738, vv = { width: 430, height: 738, scale: 1, offsetTop: 0, offsetLeft: 0 } } = {}) {
  const w = { lw, lh, vv, dpr: 1, t: 0, frames: [], timers: [], reads: 0, published: [] };
  w.vp = createVisibleViewport({
    read: () => { w.reads++; return { layoutWidth: w.lw, layoutHeight: w.lh, vv: w.vv, dpr: w.dpr }; },
    now: () => w.t,
    raf: (fn) => w.frames.push(fn),
    publish: (s, prev) => w.published.push({ s, prev }),
    setTimer: (fn, ms) => { const id = { fn, at: w.t + ms }; w.timers.push(id); return id; },
    clearTimer: (id) => { w.timers = w.timers.filter((x) => x !== id); },
  });
  w.frame = (ms = 16) => {
    w.t += ms;
    for (const id of w.timers.filter((x) => x.at <= w.t)) { w.timers = w.timers.filter((x) => x !== id); id.fn(); }
    const q = w.frames.splice(0);
    for (const fn of q) fn();
    return q.length;
  };
  w.run = (ms) => { let n = 0; for (let t = 0; t < ms; t += 16) n += w.frame(16); return n; };
  return w;
}

row('V1', 'visible box = visual viewport, clamped to the layout box', () => {
  const ios = computeVisible({ layoutWidth: 430, layoutHeight: 880,
    vv: { width: 430, height: 738, scale: 1, offsetTop: 0, offsetLeft: 0 } });
  assert.deepEqual([ios.width, ios.height, ios.top, ios.left], [430, 738, 0, 0]);
  // a visual viewport reporting MORE than the layout box loses
  const big = computeVisible({ layoutWidth: 430, layoutHeight: 738,
    vv: { width: 430, height: 880, scale: 1, offsetTop: 0, offsetLeft: 0 } });
  assert.equal(big.height, 738);
  // an offset never pushes the box past the layout bottom
  const off = computeVisible({ layoutWidth: 400, layoutHeight: 800,
    vv: { width: 400, height: 500, scale: 1, offsetTop: 400, offsetLeft: 0 } });
  assert.deepEqual([off.top, off.height], [300, 500]);
  // no visual viewport at all: the layout box
  const none = computeVisible({ layoutWidth: 1440, layoutHeight: 900, vv: null });
  assert.deepEqual([none.width, none.height, none.top], [1440, 900, 0]);
  // desktop: the two agree, and the answer is the layout box exactly
  const desk = computeVisible({ layoutWidth: 1440, layoutHeight: 900,
    vv: { width: 1440, height: 900, scale: 1, offsetTop: 0, offsetLeft: 0 } });
  assert.deepEqual([desk.width, desk.height, desk.top, desk.left], [1440, 900, 0, 0]);
});

row('V2', 'pinch zoom falls back to the layout box', () => {
  const z = computeVisible({ layoutWidth: 400, layoutHeight: 800,
    vv: { width: 200, height: 400, scale: 2, offsetTop: 100, offsetLeft: 50 } });
  assert.deepEqual([z.width, z.height, z.top, z.left], [400, 800, 0, 0]);
  const nearly = computeVisible({ layoutWidth: 400, layoutHeight: 800,
    vv: { width: 400, height: 700, scale: 1.004, offsetTop: 0, offsetLeft: 0 } });
  assert.equal(nearly.height, 700, 'scale within 1% is still the screen');
});

row('V3', 'the first read is not trusted: an eventless change is polled and published once', () => {
  const w = world({ lh: 880, vv: { width: 430, height: 880, scale: 1, offsetTop: 0, offsetLeft: 0 } });
  assert.equal(w.vp.get().height, 880);
  const seen = [];
  w.vp.subscribe((s) => seen.push(s.height));
  w.run(100);
  w.vv = { ...w.vv, height: 738 }; w.lh = 738;   // the bars settle, no event
  w.run(100);
  assert.deepEqual(seen, [738]);
  assert.equal(w.vp.get().height, 738);
  assert.equal(w.vp.revision, 1);
});

row('V4', 'coalescing: < 1 px is not a change, >= 1 px is', () => {
  const w = world({ lh: 900 });
  const seen = [];
  w.vp.subscribe((s) => seen.push(s.height));
  w.vv = { ...w.vv, height: 738.6 }; w.frame();
  w.vv = { ...w.vv, height: 738.3 }; w.frame();
  assert.deepEqual(seen, []);
  assert.equal(w.vp.get().height, 738, 'the published box holds still');
  w.vv = { ...w.vv, height: 739.2 }; w.frame();
  assert.deepEqual(seen, [739.2]);
  w.vv = { ...w.vv, offsetTop: 1 }; w.frame();
  assert.equal(seen.length, 2, 'a 1 px move of the top is a change');
});

row('V5', 'the poll ends after SETTLE_MS of agreement, persists while reads disagree, events re-arm it', () => {
  const w = world();
  w.run(SETTLE_MS + 200);
  assert.equal(w.frames.length, 0, 'stopped');
  const reads = w.reads;
  w.run(500);
  assert.equal(w.reads, reads, 'no reads while stopped');
  // jitter that never agrees keeps the poll alive past the window
  const w2 = world({ lh: 900 });
  let k = 0;
  const jitter = () => { w2.vv = { ...w2.vv, height: 738 + ((k++ % 2) ? 0.4 : 0) }; };
  for (let t = 0; t < SETTLE_MS + 1000; t += 16) { jitter(); w2.frame(); }
  assert.equal(w2.frames.length, 1, 'still polling while consecutive reads disagree');
  // an event restarts the window
  w.vp.poke();
  assert.equal(w.frames.length, 1);
  w.run(SETTLE_MS - 100);
  assert.equal(w.frames.length, 1, 'still polling inside the re-armed window');
  w.run(400);
  assert.equal(w.frames.length, 0);
});

row('V6', 'subscribers: synchronous, ordered, (next, prev); publish first; unsubscribe', () => {
  const w = world();
  const order = [];
  w.vp.subscribe((n, p) => order.push(['a', n.height, p.height, w.published.length]));
  const off = w.vp.subscribe(() => order.push(['b']));
  w.vv = { ...w.vv, height: 600 };
  w.vp.poke();
  assert.deepEqual(order, [['a', 600, 738, 2], ['b']]);
  assert.equal(w.published[1].s.insetBottom, 138, 'the hidden strip under the visible box');
  off();
  w.vv = { ...w.vv, height: 500 };
  w.vp.poke();
  assert.deepEqual(order.slice(2), [['a', 500, 600, 3]]);
  assert.equal(w.published[0].prev, null, 'the initial publish has no previous box');
});

row('V7', 'node: visibleSize() reads the stubbed globals live', () => {
  globalThis.innerWidth = 390; globalThis.innerHeight = 844;
  assert.deepEqual([visibleSize().width, visibleSize().height, visibleSize().top], [390, 844, 0]);
  globalThis.innerHeight = 700;
  assert.equal(visibleSize().height, 700);
  delete globalThis.innerWidth; delete globalThis.innerHeight;
});

row('V8', 'settled tier: one call per burst, SETTLED_MS after the last step; dpr is a change', () => {
  const w = world({ lh: 900, vv: { width: 430, height: 880, scale: 1, offsetTop: 0, offsetLeft: 0 } });
  const fast = [], settled = [];
  w.vp.subscribe((n) => fast.push(n.height));
  w.vp.subscribeSettled((n, p) => settled.push([n.height, p.height]));
  for (const h of [850, 820, 790, 760, 738]) { w.vv = { ...w.vv, height: h }; w.frame(32); }
  assert.deepEqual(fast, [850, 820, 790, 760, 738]);
  assert.deepEqual(settled, [], 'nothing while the bars are still moving');
  w.run(SETTLED_MS + 32);
  assert.deepEqual(settled, [[738, 880]]);
  w.dpr = 2; w.vp.poke();
  assert.equal(fast.length, 6, 'a pixel-ratio change alone is published');
  assert.equal(w.vp.get().dpr, 2);
});

row('V9', 'a change before subscribing is not lost: `since` delivers it, on both tiers', () => {
  const w = world({ lh: 900, vv: { width: 430, height: 880, scale: 1, offsetTop: 0, offsetLeft: 0 } });
  const builtFor = w.vp.get();                      // the consumer reads at boot...
  w.vv = { ...w.vv, height: 738 }; w.frame();       // ...the bars settle...
  const fast = [], settled = [];
  w.vp.subscribe((n, p) => fast.push([n.height, p.height]), builtFor);   // ...then it subscribes
  w.vp.subscribeSettled((n, p) => settled.push([n.height, p.height]), builtFor);
  assert.deepEqual(fast, [[738, 880]], 'immediate tier: delivered on subscribe');
  w.run(SETTLED_MS + 32);
  assert.deepEqual(settled, [[738, 880]], 'settled tier: delivered after its delay');
  const quiet = [];
  w.vp.subscribe(() => quiet.push(1), w.vp.get());
  assert.deepEqual(quiet, [], 'nothing when the box has not moved');
});

row('V10', 'scene and spore layer: same source, same tier, no lost settle, no split ease', () => {
  const src = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
  const org = src('organism/organism.js'), spores = src('organism/hero-spores.js');
  assert.match(org, /const _builtSize = renderer\.getSize\(/, 'the scene remembers the size it was built at');
  assert.match(org, /visibleViewport\.subscribe\(viewport\.resize\);/, 'the scene resizes on the immediate tier');
  assert.match(org, /Math\.abs\(_builtSize\.x - now\.width\) >= 1 \|\| Math\.abs\(_builtSize\.y - now\.height\) >= 1\) \{[\s\S]{0,240}viewport\.resize\(\);/,
    'and reconciles a settle that landed before it subscribed');
  assert.match(org, /const ease = !snap && !heroSpores\.ownsFrame/, 'no framing ease while the layer projects on its own');
  assert.match(spores, /offResize = visibleViewport\.subscribe\(onResize, builtFor\);/, 'the layer subscribes with the box it was composed for');
  assert.match(spores, /worker\.postMessage\(\{ type: 'resize', view: state\.view, quiet: measureCopyBox\(\), \.\.\.measureCanvas\(\) \}\);/,
    'every change re-sends the worker its view and canvas size');
  assert.match(spores, /const vp = visibleSize\(\);\s*return \{\s*width: Math\.max\(1, Math\.round\(vp\.width \* pr\)\),\s*height: Math\.max\(1, Math\.round\(vp\.height \* pr\)\)/,
    'the layer canvas is sized from the same visible box as the scene');
});

if (failed) { console.log(`visible viewport: ${failed} FAILED`); process.exit(1); }
console.log('visible viewport: ALL PASS');
