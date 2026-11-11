// tools/test-card-warming.mjs
//
// Focused test for journey/cards/index.js's U01a change: the idle-time card
// warming cascade (fonts -> light images -> heavy video) moved from a bare
// import-time `setTimeout(warmCardAssets, 1500)` to an explicit, cancellable
// owner: `export function startCardWarming(overrides)`, returning a cancel
// handle. No browser, no jsdom -- every clock/idle/fetch/document dependency
// is injected via `overrides`, and the module's own import-time self-start
// (which U01a deliberately preserves) is proven inert in a plain Node
// process where `document` is genuinely undefined.
//
// Covers, in order:
//   A. Import-time guard: importing the real module with no ambient
//      `document` schedules nothing (the pre-existing guard still holds).
//   B. Behavior of startCardWarming() via a fully deterministic fake
//      clock/idle scheduler:
//        B1. the RIC-absent / setTimeout(400) fallback path (delay, order,
//            pacing, asset set)
//        B2. the RIC-present path (an injected requestIdleCallbackFn),
//            proving the same order/pacing when the real browser API would
//            be used
//        B3. cancel-before-fire: zero fetches ever happen
//        B4. cancel-mid-cascade: remaining slices stop; already-issued
//            fetches are not required to (and are not) aborted
//        B5. cancel is idempotent (double-cancel, cancel-after-completion)
//   C. (re-based 2026-11) No import-time self-start; `enqueue` mode hands
//      one job per unit to the journey's rest queue and every fetch asks
//      for priority 'low'. (The old Part C diffed against pre-U01a bytes via
//      `git show <sha>`; that timer contract no longer exists.)
//
// Run directly: node tools/test-card-warming.mjs
// (not yet wired into package.json's test:contracts -- a concurrent order
// owns that file; see the report for the reviewer.)

import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const REAL_MODULE_PATH = path.join(REPO_ROOT, 'journey/cards/index.js');

let failures = 0;
function check(condition, msg) {
  if (!condition) {
    failures++;
    console.error(`FAIL: ${msg}`);
  } else {
    console.log(`  ok - ${msg}`);
  }
}

// A fully deterministic fake setTimeout/clearTimeout pair. This module's
// warming logic only ever has 0 or 1 timer pending at a time (each step
// schedules the next only once the previous has fired), so `fireAll` just
// drains whatever is pending, recursively, until nothing is left.
function makeFakeScheduler() {
  let nextId = 1;
  const pending = new Map(); // id -> fn
  const calls = []; // { id, delay } in schedule order
  const setTimeoutFn = (fn, delay) => {
    const id = nextId++;
    pending.set(id, fn);
    calls.push({ id, delay });
    return id;
  };
  const clearTimeoutFn = (id) => {
    pending.delete(id);
  };
  const fireAll = () => {
    while (pending.size > 0) {
      const [id, fn] = pending.entries().next().value;
      pending.delete(id);
      fn();
    }
  };
  const fireOne = () => {
    const entry = pending.entries().next().value;
    if (!entry) return false;
    const [id, fn] = entry;
    pending.delete(id);
    fn();
    return true;
  };
  return { setTimeoutFn, clearTimeoutFn, calls, pending, fireAll, fireOne };
}

function makeDoubles() {
  const fontsLoaded = [];
  const fetchCalls = [];
  const doc = {
    fonts: {
      load: (spec) => {
        fontsLoaded.push(spec);
        return Promise.resolve();
      },
    },
  };
  const fetchFn = (url) => {
    fetchCalls.push(url);
    return Promise.resolve();
  };
  return { fontsLoaded, fetchCalls, doc, fetchFn };
}

async function main() {
  console.log('-- A. import-time guard (document undefined) --');
  assert.equal(typeof document, 'undefined', 'precondition: this Node process has no ambient document');
  let ambientSetTimeoutCalls = 0;
  const realSetTimeout = global.setTimeout;
  global.setTimeout = (...args) => {
    ambientSetTimeoutCalls++;
    return realSetTimeout(...args);
  };
  const realModule = await import(pathToFileURL(REAL_MODULE_PATH).href);
  global.setTimeout = realSetTimeout;
  check(
    ambientSetTimeoutCalls === 0,
    'importing journey/cards/index.js with no ambient document schedules zero timers (guard holds, import stays inert)'
  );
  check(typeof realModule.startCardWarming === 'function', 'module exports startCardWarming');

  const { startCardWarming } = realModule;

  console.log('-- B1. RIC-absent fallback path: delay, order, pacing, asset set --');
  const sch1 = makeFakeScheduler();
  const d1 = makeDoubles();
  startCardWarming({
    setTimeoutFn: sch1.setTimeoutFn,
    clearTimeoutFn: sch1.clearTimeoutFn,
    fetchFn: d1.fetchFn,
    doc: d1.doc,
    // requestIdleCallbackFn intentionally omitted -- exercises the ambient
    // `typeof requestIdleCallback === 'function'` check, which is false in
    // plain Node, so the module must fall back to setTimeoutFn(fn, 400).
  });
  check(sch1.calls.length === 1, 'exactly one timer scheduled at start()');
  check(sch1.calls[0].delay === 1500, `start timer delay is exactly 1500ms (got ${sch1.calls[0]?.delay})`);
  sch1.fireAll();

  const fontsCount = d1.fontsLoaded.length;
  const fetchCount = d1.fetchCalls.length;
  // QA-02 P3: the warmed asset-set size was pinned nowhere -- only
  // `> 0` -- so halving the set (e.g. 21 -> 10 assets) still satisfied
  // every check downstream, including the derived expectedTimerCount
  // relation below (Part C's cross-check is differential against HEAD, so
  // both sides shrink together and would not catch it either). Absolute
  // literal pins anchor the relation to the actual current values.
  check(fontsCount === 6, `fonts were warmed -- exactly 6 (got ${fontsCount})`);
  check(fetchCount === 20, `assets were fetched -- exactly 20 (got ${fetchCount})`);

  // fonts -> light -> heavy: once a .mp4 URL appears, every URL after it
  // must also be .mp4 (heavy strictly follows light; nothing interleaves).
  let sawHeavy = false;
  let orderOk = true;
  for (const url of d1.fetchCalls) {
    const isHeavy = url.endsWith('.mp4');
    if (isHeavy) sawHeavy = true;
    else if (sawHeavy) orderOk = false;
  }
  check(orderOk, 'no light asset is fetched after the first heavy (.mp4) asset -- light strictly precedes heavy');
  check(sawHeavy, 'at least one heavy (.mp4) asset was fetched');
  check(
    d1.fontsLoaded.every((spec) => typeof spec === 'string' && spec.startsWith("1em '")),
    'all font warms use the documented `1em \'<family>\'` spec'
  );

  // Exactly one timer per job in the queue (fonts-job counts as one job,
  // even though it loops over every font internally), plus the initial
  // 1500ms timer, plus one final "queue empty" timer that runs and returns
  // without scheduling further.
  const totalJobs = 1 /* fonts job */ + d1.fetchCalls.length;
  const expectedTimerCount = 1 /* initial 1500ms */ + totalJobs /* one per job, each schedules the next */ + 1 /* final empty check */;
  check(
    sch1.calls.length === expectedTimerCount,
    `total scheduled timers (${sch1.calls.length}) matches 1 job-runner per queued job + the initial timer + the final empty check (expected ${expectedTimerCount})`
  );
  check(
    sch1.calls.slice(1).every((c) => c.delay === 400),
    'every idle-fallback slice is paced at exactly setTimeout(fn, 400) -- identical to the pre-change fallback'
  );

  console.log('-- B2. RIC-present path: same order/pacing when requestIdleCallback exists --');
  const sch2 = makeFakeScheduler();
  const d2 = makeDoubles();
  const ricCalls = [];
  const fakeRic = (fn) => {
    // A minimal requestIdleCallback double: schedule via the same fake
    // timer so we can drive it deterministically, but record that THIS
    // path (not the setTimeout(400) fallback) was used.
    ricCalls.push(fn);
    return sch2.setTimeoutFn(fn, 0); // real RIC has no fixed "delay"; 0 here is just a marker
  };
  startCardWarming({
    setTimeoutFn: sch2.setTimeoutFn,
    clearTimeoutFn: sch2.clearTimeoutFn,
    fetchFn: d2.fetchFn,
    doc: d2.doc,
    requestIdleCallbackFn: fakeRic,
  });
  check(sch2.calls[0].delay === 1500, 'RIC-present path still starts exactly 1500ms after start()');
  sch2.fireAll();
  // One ric(step) call per queued job, plus one final call whose step()
  // finds the queue empty and returns without doing work -- same shape as
  // the setTimeout-fallback timer count in B1 (expectedTimerCount - 1,
  // since RIC-present has no separate "initial 1500ms" entry in ricCalls).
  check(
    ricCalls.length === totalJobs + 1,
    `requestIdleCallbackFn (not the setTimeout fallback) drove all ${totalJobs} job slices plus the final empty-queue check (expected ${totalJobs + 1}, got ${ricCalls.length})`
  );
  assert.deepEqual(d2.fontsLoaded, d1.fontsLoaded, 'RIC-present path warms the identical font set/order as the fallback path');
  assert.deepEqual(d2.fetchCalls, d1.fetchCalls, 'RIC-present path fetches the identical asset set/order as the fallback path');
  console.log('  ok - RIC-present path matches the fallback path exactly');

  console.log('-- B3. cancel before the 1500ms timer fires --');
  const sch3 = makeFakeScheduler();
  const d3 = makeDoubles();
  const cancel3 = startCardWarming({
    setTimeoutFn: sch3.setTimeoutFn,
    clearTimeoutFn: sch3.clearTimeoutFn,
    fetchFn: d3.fetchFn,
    doc: d3.doc,
  });
  cancel3();
  check(sch3.pending.size === 0, 'cancelling before the start timer fires removes it from the scheduler (clearTimeout called)');
  sch3.fireAll(); // no-op: nothing pending
  check(d3.fontsLoaded.length === 0 && d3.fetchCalls.length === 0, 'no fetch and no font warm ever happens when cancelled before the 1500ms timer fires');

  console.log('-- B4. cancel mid-cascade --');
  const sch4 = makeFakeScheduler();
  const d4 = makeDoubles();
  const cancel4 = startCardWarming({
    setTimeoutFn: sch4.setTimeoutFn,
    clearTimeoutFn: sch4.clearTimeoutFn,
    fetchFn: d4.fetchFn,
    doc: d4.doc,
  });
  sch4.fireOne(); // fires the 1500ms timer -> schedules the fonts-job slice
  sch4.fireOne(); // runs the fonts job, schedules the first fetch slice
  sch4.fireOne(); // runs the first fetch job, schedules the second
  sch4.fireOne(); // runs the second fetch job, schedules the third
  const snapshotFonts = d4.fontsLoaded.length;
  const snapshotFetches = d4.fetchCalls.length;
  check(snapshotFonts > 0 && snapshotFetches > 0, `cascade is genuinely mid-flight before cancel (${snapshotFonts} font warm(s), ${snapshotFetches} fetch(es) so far)`);
  cancel4();
  // The currently-pending idle slice (already scheduled by the last step())
  // is NOT individually tracked/cleared by cancel() -- only the initial
  // 1500ms timerId is. Cancellation instead works via the `cancelled` flag
  // checked at the top of every step(), so that pending slice, once fired,
  // is a guaranteed no-op. Draining it here proves exactly that: it fires,
  // but produces no further side effects.
  check(sch4.pending.size === 1, 'the one already-scheduled idle slice is still pending immediately after cancel (not force-removed)');
  sch4.fireAll();
  check(
    d4.fontsLoaded.length === snapshotFonts && d4.fetchCalls.length === snapshotFetches,
    'after cancel, the pending slice fires as a no-op -- no further fetch or font warm happens; remaining slices are stopped'
  );
  check(sch4.pending.size === 0, 'no further timer is scheduled after the cancelled no-op slice runs');

  console.log('-- B5. cancel is idempotent --');
  let clearCount5 = 0;
  const sch5 = makeFakeScheduler();
  const d5 = makeDoubles();
  const wrappedClear = (id) => { clearCount5++; sch5.clearTimeoutFn(id); };
  const cancel5 = startCardWarming({
    setTimeoutFn: sch5.setTimeoutFn,
    clearTimeoutFn: wrappedClear,
    fetchFn: d5.fetchFn,
    doc: d5.doc,
  });
  cancel5();
  cancel5();
  cancel5();
  check(clearCount5 === 1, `calling cancel() three times only clears the timer once (idempotent guard), clearTimeout call count = ${clearCount5}`);

  const sch6 = makeFakeScheduler();
  const d6 = makeDoubles();
  const cancel6 = startCardWarming({
    setTimeoutFn: sch6.setTimeoutFn,
    clearTimeoutFn: sch6.clearTimeoutFn,
    fetchFn: d6.fetchFn,
    doc: d6.doc,
  });
  sch6.fireAll(); // run the cascade to natural completion
  const completedFonts = d6.fontsLoaded.length;
  const completedFetches = d6.fetchCalls.length;
  check(completedFonts > 0 && completedFetches > 0, 'cascade 6 ran to natural completion before we cancel it');
  let threw = false;
  try {
    cancel6();
    cancel6();
  } catch {
    threw = true;
  }
  check(!threw, 'calling cancel() after natural completion does not throw');
  check(
    d6.fontsLoaded.length === completedFonts && d6.fetchCalls.length === completedFetches,
    'calling cancel() after natural completion is a pure no-op (no state changes)'
  );

  console.log('-- C. no import-time self-start; enqueue mode defers every fetch (low priority) --');
  // Re-based 2026-11 (hitch pass P1). The old Part C diffed this module
  // against its pre-U01a bytes (`git show <sha>`) to prove the 1500 ms
  // self-start; that contract is deliberately gone. The new contract:
  //   1. importing index.js with a document present schedules NOTHING.
  //   2. startCardWarming({ enqueue }) runs nothing itself: it hands one job
  //      per unit (1 fonts job + 20 fetches) to `enqueue`, no timers.
  //   3. each fetch job asks for { priority: 'low' }, in fonts -> light ->
  //      heavy order, and does nothing until the queue runs it.
  //   4. cancel() turns not-yet-run jobs into no-ops.
  const realDoc = global.document;
  const realFetch = global.fetch;
  const realSetTimeout2 = global.setTimeout;
  const realRIC = global.requestIdleCallback;
  const ambientTimers = [];
  const ambientFetches = [];
  global.document = { fonts: { load: () => Promise.resolve() } };
  global.fetch = (...a) => { ambientFetches.push(a); return Promise.resolve(); };
  global.setTimeout = (fn, delay) => { ambientTimers.push(delay); return 0; };
  global.requestIdleCallback = () => { ambientTimers.push('ric'); return 0; };
  try {
    // fresh URL query = a fresh evaluation, with `document` defined
    await import(pathToFileURL(REAL_MODULE_PATH).href + '?with-document');
  } finally {
    global.document = realDoc;
    global.fetch = realFetch;
    global.setTimeout = realSetTimeout2;
    if (realRIC !== undefined) global.requestIdleCallback = realRIC; else delete global.requestIdleCallback;
  }
  check(ambientTimers.length === 0, `importing index.js WITH a document schedules no timer and no idle callback (got ${JSON.stringify(ambientTimers)})`);
  check(ambientFetches.length === 0, 'importing index.js with a document fetches nothing');

  const sch7 = makeFakeScheduler();
  const d7 = makeDoubles();
  const fetchOpts = [];
  const fetchWithOpts = (url, opts) => { fetchOpts.push(opts); return d7.fetchFn(url); };
  const jobs = [];
  const cancel7 = startCardWarming({
    setTimeoutFn: sch7.setTimeoutFn,
    clearTimeoutFn: sch7.clearTimeoutFn,
    fetchFn: fetchWithOpts,
    doc: d7.doc,
    enqueue: (job) => jobs.push(job),
  });
  check(typeof cancel7 === 'function', 'enqueue mode still returns a cancel handle');
  check(jobs.length === 21, `enqueue mode hands over exactly 21 jobs (1 fonts + 20 fetches); got ${jobs.length}`);
  check(sch7.calls.length === 0, 'enqueue mode schedules no timer of its own');
  check(d7.fontsLoaded.length === 0 && d7.fetchCalls.length === 0, 'nothing is fetched or loaded until the queue runs a job');
  jobs[0]();
  check(d7.fontsLoaded.length === 6 && d7.fetchCalls.length === 0, 'job 0 warms the 6 fonts and fetches nothing');
  for (let i = 1; i < 11; i++) jobs[i]();
  check(d7.fetchCalls.length === 10, 'each later job issues exactly one fetch (one per queue slice)');
  cancel7();
  for (let i = 11; i < jobs.length; i++) jobs[i]();
  check(d7.fetchCalls.length === 10, 'after cancel(), the remaining queued jobs are no-ops');
  const d8 = makeDoubles();
  const opts8 = [];
  const jobs8 = [];
  startCardWarming({ fetchFn: (u, o) => { opts8.push(o); return d8.fetchFn(u); }, doc: d8.doc, enqueue: (j) => jobs8.push(j) });
  jobs8.forEach((j) => j());
  check(d8.fetchCalls.length === 20 && opts8.every((o) => o && o.priority === 'low'), 'all 20 enqueued fetches ask for priority "low"');
  check(
    JSON.stringify(d8.fetchCalls) === JSON.stringify(d1.fetchCalls),
    'enqueue mode fetches the identical asset set, in the identical fonts -> light -> heavy order, as the timer cascade'
  );

  console.log('');
  if (failures > 0) {
    console.error(`${failures} check(s) FAILED`);
    process.exitCode = 1;
  } else {
    console.log('card warming: ALL CHECKS PASS');
  }
}

main().catch((err) => {
  console.error('test-card-warming.mjs crashed:', err);
  process.exitCode = 1;
});
