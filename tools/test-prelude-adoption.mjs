#!/usr/bin/env node
/* ==================================================================== *
 * tools/test-prelude-adoption.mjs — THE ADOPTION ALWAYS SETTLES.
 *
 * SUBJECT  organism/hero-spores.js: createPreload()'s worker-path adoption
 *          (handOff's deferred carry, adopt(), preludeStrike(), stop(),
 *          workerFailed()) and createHeroSporeField()'s render hold.
 *
 * THE DEFECT THIS PINS (2026-11, "the mushroom never appears"). The scene
 * holds its composer until the worker's field is adopted. preludeStrike()
 * schedules stop() 3.05 s after the release, and stop() used to null the
 * worker's onmessage WITHOUT settling the waiting adopter. A snapshot that
 * arrived after that deadline — a slow, memory-pressed machine — was
 * dropped, the hold was never released, and the scene never drew again,
 * with nothing in the console. Reproduced in headless Chromium by delaying
 * the worker's 'adopt' message 3.5 s: renderer.info.render.frame stopped at
 * 54 for the rest of the page's life, context alive, intro complete.
 *
 * WHAT IS PROVED, by EXECUTING the shipped module against fakes (a fake
 * worker, fake timers, a recording ctx — nothing here is a re-statement of
 * the code):
 *   A  the normal path: an immediate snapshot begins the scene exactly once,
 *      on the worker's fade clock, and nothing is reported;
 *   B  a snapshot later than the teardown: the scene begins exactly once
 *      (the old code: zero times — the hold leaked), and the late snapshot,
 *      when it lands, begins nothing;
 *   C  a worker that never answers: the watchdog begins the scene within
 *      ADOPT_WAIT_MS of the request, before the teardown, and reports it;
 *   D  a worker error after the request: one begin; a later stop(): none;
 *   E  a page hidden past the bound and shown again settles at once;
 *   F  the scene side: begin releases the hold once; a second begin is
 *      inert; and a carry that never begins is released by the frame
 *      loop's ceiling HOLD_CEILING_MS after the growth's release, with a
 *      page error recorded;
 *   G  preludeAbandon() (journey/boot/handoff.js's recovery for a throw in
 *      releaseIntro) settles a waiting scene;
 *   H  journey/boot/handoff.js releaseIntro, sliced and executed: a throw in
 *      adopt() or preludeStrike() is reported, takes the fallback, and the
 *      growth still starts exactly once (the old latch cancelled it).
 * Run against the pre-fix hero-spores.js, B fails first (0 begins, not 1);
 * against the pre-fix handoff.js, H fails.
 * ==================================================================== */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/* ---------- the world: fake clock, timers, DOM, worker ---------- */
let clock = 1000;
let timers = [];
let timerId = 0;
const errors = [];
const listeners = {};
globalThis.setTimeout = (fn, ms = 0) => { const id = ++timerId; timers.push({ id, at: clock + ms, fn }); return id; };
globalThis.clearTimeout = (id) => { timers = timers.filter((t) => t.id !== id); };
Object.defineProperty(globalThis.performance, 'now', { configurable: true, value: () => clock });
function advanceTo(target) {
  for (;;) {
    timers.sort((a, b) => a.at - b.at || a.id - b.id);
    const t = timers[0];
    if (!t || t.at > target) break;
    timers.shift();
    clock = Math.max(clock, t.at);
    t.fn();
  }
  clock = target;
}
const el = () => ({
  style: {}, classList: { contains: () => false, add() {}, remove() {} },
  setAttribute() {}, appendChild() {}, getBoundingClientRect: () => ({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }),
  offsetWidth: 1, parentNode: null,
});
let hidden = false;
const doc = {
  hidden: false,
  body: el(),
  getElementById: () => ({ parentNode: { insertBefore() {}, removeChild() {} }, nextSibling: null }),
  querySelector: () => null,
  createElement: (tag) => {
    const e = el();
    if (tag === 'canvas') e.transferControlToOffscreen = () => ({ offscreen: true });
    e.parentNode = { removeChild() {} };
    return e;
  },
  addEventListener: (type, fn) => { (listeners[type] ||= []).push(fn); },
  removeEventListener: (type, fn) => { listeners[type] = (listeners[type] || []).filter((f) => f !== fn); },
};
Object.defineProperty(doc, 'hidden', { get: () => hidden });
globalThis.document = doc;
globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
globalThis.devicePixelRatio = 1;
globalThis.innerWidth = 1440;
globalThis.innerHeight = 900;
globalThis.OffscreenCanvas = function OffscreenCanvas() {};
globalThis.Worker = function Worker() { throw new Error("the early worker is the only one"); };
globalThis.HTMLCanvasElement = function HTMLCanvasElement() {};
HTMLCanvasElement.prototype.transferControlToOffscreen = function () {};
globalThis.ErrorEvent = class ErrorEvent { constructor(type, init) { this.type = type; Object.assign(this, init); } };
// window without requestAnimationFrame: visible-viewport.js serves its node
// stand-in, which reads innerWidth/innerHeight above
globalThis.window = {
  document: doc, innerWidth: 1440, innerHeight: 900, __preludeWorker: null,
  dispatchEvent: (e) => { errors.push(e.message); return true; },
};

function fakeWorker() {
  const w = { posted: [], onmessage: null, onerror: null, onmessageerror: null, terminated: false };
  w.postMessage = (m) => { w.posted.push(m); };
  w.terminate = () => { w.terminated = true; };
  w.reply = (m) => { if (w.onmessage) w.onmessage({ data: m }); };
  return w;
}

/* ---------- the subject, executed ---------- */
const moduleUrl = new URL('../organism/hero-spores.js', import.meta.url);
const source = readFileSync(moduleUrl, 'utf8').replace(/from\s+'(\.[^']+)'/g,
  (_, specifier) => `from '${new URL(specifier, moduleUrl).href}'`);
const subject = await import('data:text/javascript;base64,' +
  Buffer.from(source + '\nexport { createPreload, fieldSnapshot };').toString('base64'));
const { createPreload, fieldSnapshot, createHeroSporeField } = subject;

/** A booted worker-path preload with a scene waiting on its carry. */
function bootPreload() {
  timers = [];
  errors.length = 0;
  hidden = false;
  for (const k of Object.keys(listeners)) delete listeners[k];
  const worker = fakeWorker();
  window.__preludeWorker = worker;
  const pre = createPreload();
  pre.boot();
  assert.equal(pre.mode, 'worker', 'the fake world takes the worker path');
  // the worker's first frame: entry ramp starts
  worker.reply({ type: 'status', t: 0, landings: [], firstImpactAt: -1, released: false });
  advanceTo(clock + 2000);   // past ENTRY_MS
  const carried = pre.handOff(0.9);
  assert.ok(carried && carried.deferred, 'the worker path hands off a deferred carry');
  const begins = [];
  carried.whenAdopted((arg) => begins.push({ at: clock, ...arg }));
  const snapshot = () => ({ type: 'snapshot', field: fieldSnapshot(carried.field), epoch: performance.timeOrigin + clock });
  return { pre, worker, carried, begins, snapshot };
}
const asked = (w) => w.posted.filter((m) => m.type === 'adopt').length;

/* A — the normal path */
{
  const { pre, worker, begins, snapshot } = bootPreload();
  pre.adopt();
  pre.preludeStrike();
  assert.equal(asked(worker), 1, 'A: adopt asked once');
  advanceTo(clock + 5);
  worker.reply(snapshot());
  assert.equal(begins.length, 1, 'A: the snapshot begins the scene');
  assert.ok(worker.posted.some((m) => m.type === 'fade'), 'A: the worker is told to fade');
  advanceTo(clock + 10000);
  assert.equal(begins.length, 1, 'A: nothing begins twice (watchdog, teardown)');
  assert.deepEqual(errors, [], 'A: the normal path reports nothing');
}

/* B — the snapshot lands after the teardown */
{
  const { pre, worker, begins } = bootPreload();
  pre.adopt();
  pre.preludeStrike();
  // the worker is slow: nothing for 3.5 s; the watchdog has been delayed too
  // (a blocked thread), so the teardown is the first exit to run
  timers = timers.map((t) => (t.at - clock === 1500 ? { ...t, at: clock + 3500 } : t));
  advanceTo(clock + 3200);
  assert.equal(begins.length, 1, 'B: the teardown settles the waiting scene (the old code never did)');
  assert.equal(worker.onmessage, null, 'B: the teardown still detaches the worker');
  assert.ok(worker.posted.some((m) => m.type === 'stop'), 'B: and stops it');
  advanceTo(clock + 1000);
  assert.equal(begins.length, 1, 'B: exactly one begin (the delayed watchdog finds nothing to settle)');
  assert.ok(errors.some((e) => /adoption fell back/.test(e)), 'B: the fallback is on the page error channel');
}

/* C — a worker that never answers */
{
  const { pre, worker, begins, snapshot } = bootPreload();
  pre.adopt();
  pre.preludeStrike();
  const t0 = clock;
  advanceTo(clock + 1600);
  assert.equal(begins.length, 1, 'C: the watchdog begins the scene');
  assert.ok(begins[0].at - t0 <= 1600 && begins[0].at - t0 >= 1500, 'C: within the bound, before the teardown');
  assert.ok(errors.some((e) => /no snapshot/.test(e)), 'C: reported');
  worker.reply(snapshot());   // the late answer arrives anyway
  assert.equal(begins.length, 1, 'C: a late snapshot after the fallback begins nothing');
  advanceTo(clock + 5000);
  assert.equal(begins.length, 1, 'C: the teardown begins nothing more');
}

/* D — a worker error after the request */
{
  const { pre, worker, begins } = bootPreload();
  pre.adopt();
  pre.preludeStrike();
  const realError = console.error;
  console.error = () => {};
  try { worker.onerror({ message: 'boom' }); } finally { console.error = realError; }
  assert.equal(begins.length, 1, 'D: a failed worker begins the scene');
  advanceTo(clock + 6000);
  assert.equal(begins.length, 1, 'D: no second begin');
}

/* E — hidden past the bound, then shown */
{
  const { pre, begins } = bootPreload();
  pre.adopt();
  pre.preludeStrike();
  hidden = true;
  for (const fn of listeners.visibilitychange || []) fn();
  // a hidden page's timers are throttled: the watchdog has not run
  timers = [];
  clock += 2000;
  hidden = false;
  for (const fn of listeners.visibilitychange || []) fn();
  assert.equal(begins.length, 1, 'E: shown again past the bound settles at once');
}

/* G — preludeAbandon */
{
  const { pre, begins } = bootPreload();
  pre.preludeAbandon('test');
  assert.equal(begins.length, 1, 'G: an abandoned prelude settles the waiting scene');
  advanceTo(clock + 6000);
  assert.equal(begins.length, 1, 'G: once');
}

/* F — the scene side's hold */
{
  const holds = [];
  const animators = [];
  const ctx = {
    holdRender: (on) => holds.push(on),
    addAnimator: (name, fn) => animators.push(fn),
    breeze: () => 0,
    pushC: (arr) => arr.push(1, 1, 1),
    scene: { add() {} },
    makePoints: (pos, col) => ({
      geometry: { attributes: { position: { array: new Float32Array(pos.length) }, color: { array: new Float32Array(col.length) } } },
      material: { uniforms: { uOpacity: { value: 0 } } },
    }),
  };
  // 1: a carry whose begin is called twice releases once
  {
    const { pre, worker, carried, snapshot } = bootPreload();
    let doors = 0;
    const realWhen = carried.whenAdopted;
    let door = null;
    carried.whenAdopted = (begin) => { doors++; door = begin; realWhen(begin); };
    createHeroSporeField(ctx, carried, 0.9);
    assert.equal(doors, 1);
    assert.deepEqual(holds, [true], 'F1: the scene holds while it waits');
    pre.adopt();
    worker.reply(snapshot());
    assert.deepEqual(holds, [true, false], 'F1: the snapshot releases the hold');
    door({ fadeFromEpoch: performance.timeOrigin + clock, fadeMs: 900, epoch0: 0 });
    assert.deepEqual(holds, [true, false], 'F1: a second begin is inert');
  }
  // 2: a carry that never begins is released by the ceiling
  {
    holds.length = 0; animators.length = 0; errors.length = 0;
    let released = -1;
    const stuck = {
      field: bootPreload().carried.field, view: bootPreload().carried.view, fadeDelay: 0, deferred: true,
      whenAdopted() { /* never calls back */ },
      releasedAt: () => released,
      settle: () => false,
    };
    errors.length = 0;
    createHeroSporeField(ctx, stuck, 0.9);
    assert.deepEqual(holds, [true]);
    const frame = () => animators.forEach((fn) => fn(0, 1 / 60));
    for (let i = 0; i < 10; i++) { clock += 1000; frame(); }
    assert.deepEqual(holds, [true], 'F2: before the release, the hold is legitimate however long');
    released = clock;
    clock += 6900; frame();
    assert.deepEqual(holds, [true], 'F2: inside the ceiling, still held');
    clock += 200; frame();
    assert.deepEqual(holds, [true, false], 'F2: past the ceiling, released');
    assert.ok(errors.some((e) => /ceiling/.test(e)), 'F2: and recorded on the page error channel');
    clock += 1000; frame();
    assert.deepEqual(holds, [true, false], 'F2: once');
  }
}

/* H — journey/boot/handoff.js releaseIntro: a throw in the prelude's half
   (adopt / strike) used to leave the latch set and the intro unstarted.
   The function is sliced from the shipped text and executed. */
{
  const handoff = readFileSync(new URL('../journey/boot/handoff.js', import.meta.url), 'utf8');
  const start = handoff.indexOf('  function releaseIntro() {');
  const end = handoff.indexOf('\n  }\n', start) + 4;
  assert.ok(start > 0 && end > start, 'H: releaseIntro is sliced');
  for (const where of ['adopt', 'preludeStrike']) {
    const calls = [];
    const reported = [];
    const fakeSpores = {
      preludeLandingStatus: () => ({ impactAgeSeconds: 0 }),
      adopt() { calls.push('adopt'); if (where === 'adopt') throw new Error('adopt threw'); },
      preludeStrike() { calls.push('strike'); if (where === 'preludeStrike') throw new Error('strike threw'); },
      preludeAbandon(why) { calls.push('abandon:' + why); },
    };
    const fakeScene = { setGroundEntryLead() {}, intro: { start() { calls.push('intro.start'); } } };
    const fakeDoc = { body: { classList: { add() {}, remove() {} } } };
    const run = new Function('scene', 'heroSpores', 'document', 'performance', 'reportPageError', 'console',
      'let introReleased = false; let introReleasedAt = 0;\n' + handoff.slice(start, end) + '\nreturn releaseIntro;');
    const releaseIntro = run(fakeScene, fakeSpores, fakeDoc, { now: () => 0, mark() {} },
      (m, e) => reported.push(m + ': ' + (e && e.message)), { error() {} });
    try { releaseIntro(); } catch { calls.push('threw'); }
    releaseIntro();   // failJourney's cleanup call: the latch holds
    assert.ok(calls.includes('intro.start'), `H: a throw in ${where} still starts the growth`);
    assert.equal(calls.filter((c) => c === 'intro.start').length, 1, `H: once (${where})`);
    assert.ok(calls.some((c) => c.startsWith('abandon:')), `H: the prelude takes its fallback (${where})`);
    assert.ok(reported.some((m) => m.includes(where === 'adopt' ? 'adopt threw' : 'strike threw')), `H: reported (${where})`);
  }
}

/* I — release() on page exit (main.js's pagehide): the worker that owns the
   OffscreenCanvas context is TERMINATED, whether it is still drawing or was
   already retired by stop(); a waiting scene is still settled once; and a
   second release is inert. */
{
  const { pre, worker, begins } = bootPreload();
  pre.adopt();
  pre.release();
  assert.equal(worker.terminated, true, 'I: a live worker is terminated on release');
  assert.equal(begins.length, 1, 'I: a scene waiting on the field is settled, once');
  pre.release();
  assert.equal(begins.length, 1, 'I: a second release begins nothing');
}
{
  const { pre, worker } = bootPreload();
  pre.stop();
  assert.equal(worker.terminated, false, 'I: stop() alone keeps the idle worker (its documented trade)');
  pre.release();
  assert.equal(worker.terminated, true, 'I: release() ends a worker stop() retired');
}
{
  const early = fakeWorker();
  window.__preludeWorker = early;
  createPreload().release();
  assert.equal(early.terminated, true, 'I: an early worker nobody took is ended too');
  assert.equal(window.__preludeWorker, null, 'I: and forgotten');
}

console.log('prelude adoption: every exit settles the waiting scene exactly once; release ends every prelude thread (A-I passed)');
