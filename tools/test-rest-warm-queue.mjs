// tools/test-rest-warm-queue.mjs
//
// Executes journey.js's shipped rest-time warm queue (warmHiddenChapters and
// isAtRest, sliced out of the file the way test-intro-readiness.mjs slices
// prepareGpu) against a fake renderer that registers geometry the way three
// does (on the first draw that projects it, through the camera's layers), a
// fake scene, clock and idle scheduler.
// Pins what the hitch pass (ledger P1/P2/P5) and its warmfix rely on:
//   W1  nothing runs while a flight is live, or within WARM_REST_MS of landing
//   W2  every geometry the GPU lacks is drawn once, at rest, into a 1x1
//       target, only through the warm layer; nothing already on the GPU is
//       redrawn; a batch stays under WARM_DRAW_BYTES unless one object is
//       larger on its own (so a 300-object chapter is a few units, not 300)
//   W3  a warm draw restores layers, visibility, frustumCulled, hidden
//       ancestors, hidden materials and the render target
//   W4  one upload per texture version; an upload three declines is not retried
//   W5  nearest chapter first, in rail order; Owned rides with Purpose (a
//       flight to Purpose draws it), so from Connect it comes before Equip
//   W6  a registered rest task runs only at its chapter, after that
//       chapter's own units and the next stop's
//   W7  card media rides the queue, after the next stop's GPU units
//   W8  RE-SCAN: a texture whose image arrives after a scan, an object built
//       after a scan, and a texture swapped in mid-rest are all uploaded at
//       rest (after WARM_RESCAN_MS, or at the next rest), never left for a flight
//   W9  uniform-slot textures (ShaderMaterial uniforms, arrays included) and
//       material-slot textures are both found
//   W10 starved (no idle time ever, the software-GL and busy-phone case): it
//       still finishes, at one slice per WARM_STARVE_MS
//   W11 the Manifesto wiring: branch.prewarm answers true when DONE, the
//       queue reads true as "call again" — journey.js negates it; it runs at
//       every Purpose rest (repeat), until prewarm reports done
//   W12 warmReport(): per-chapter missing counts reach 0, and asking for it
//       draws and uploads nothing
// The good citizen (2026-11, C2/C3 — an 8 GB Mac hung and stuttered after
// the intro while the queue pushed every chapter's residency, including the
// 16 MB hover atlas, into the first seconds):
//   W13 the first rest after the intro waits WARM_START_MS; input within
//       WARM_INPUT_QUIET_MS waits
//   W14 from the Intro only its neighbour until WARM_FAR_IDLE_MS of rest;
//       a texture over WARM_LARGE_BYTES never at the Intro
//   W15 large textures only next to their chapter, each alone in a slice,
//       never two within WARM_LARGE_GAP_MS
//   W16 navigator.deviceMemory <= 8 = the conservative profile (adjacent
//       only), named in warmReport().profile; ?warmprofile= overrides
//   W17 a unit over WARM_SLOW_UNIT_MS backs off (>= 1 s, doubling) and turns
//       the profile conservative
//   W18 ?nowarm=1: nothing runs, card media is not queued
//   W19 drained, the rescan backs off (doubling to WARM_RESCAN_MAX_MS); a
//       rest after a flight rescans at once
//   W20 the purpose kept: after a normal rest the next stops lack nothing
// RE-PINNED for that change, and only these: W8's two "picked up at the
// next rescan" waits are WARM_RESCAN_MAX_MS (the rescan backs off), and the
// fake idle deadline is a clock (50 ms of fake time) rather than a counter
// that charged 4 ms per timeRemaining() call, because the queue now asks it
// to size a unit before running it.
// Run: node tools/test-rest-warm-queue.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../journey/journey.js', import.meta.url), 'utf8');
const start = src.indexOf('  async function prepareGpu()');
const end = src.indexOf('\n  state.ready = prepareGpu();', start);
assert(start > 0 && end > start, 'warm queue slice found');
const slice = src.slice(start, end);
assert(/registerRestWarmTask\(\s*\(\) => !!manifestoBranch && !manifestoBranch\.prewarm\(\{ budgetMs: 8 \}\),\s*\{ chapter: 'final', repeat: true \},?\s*\)/.test(slice),
  'W11 the Manifesto task is wired negated (prewarm true = done; queue true = again), at Purpose, repeating');
const constant = (name) => +slice.match(new RegExp(`const ${name} = ([^;]+);`))[1].replace('1 << 20', String(1 << 20));
const WARM_DRAW_BYTES = constant('WARM_DRAW_BYTES');
const WARM_STARVE_MS = constant('WARM_STARVE_MS');
const WARM_RESCAN_MAX_MS = constant('WARM_RESCAN_MAX_MS');

// ---- fakes -------------------------------------------------------------
let now = 0;
const timers = [];
const idles = [];
let idleMode = 'idle';   // 'idle': 50 ms idle periods; 'starved': timeouts only
const fakeSetTimeout = (fn, ms = 0) => { timers.push({ at: now + ms, fn }); return timers.length; };
const flush = () => new Promise((resolve) => setImmediate(resolve));
async function advance(ms) {
  const until = now + ms;
  for (;;) {
    await flush();
    if (idles.length && idleMode === 'idle') {
      const { fn } = idles.shift();
      // a 50 ms idle period on the fake clock (each draw or upload costs
      // UNIT_MS of it), not a counter of calls: the queue may ask as often
      // as it likes
      const ends = now + 50;
      fn({ didTimeout: false, timeRemaining: () => Math.max(0, ends - now) });
      continue;
    }
    // starved: an idle callback only ever fires by its timeout
    for (const i of idles.splice(0)) timers.push({ at: now + i.timeout, fn: () => i.fn({ didTimeout: true, timeRemaining: () => 0 }) });
    timers.sort((a, b) => a.at - b.at);
    if (!timers.length || timers[0].at > until) break;
    const t = timers.shift();
    now = Math.max(now, t.at);
    t.fn();
  }
  now = until;
}
class Layers {
  constructor() { this.mask = 1; }
  set(n) { this.mask = (1 << n) >>> 0; }
  enable(n) { this.mask = (this.mask | (1 << n)) >>> 0; }
  test(l) { return (this.mask & l.mask) !== 0; }
}
let geometryId = 0;
const geometry = (bytes) => ({ id: geometryId++, attributes: { position: { array: { byteLength: bytes } } }, index: null });
class Obj {
  constructor(name, { bytes = 0, visible = true, children = [], material = null } = {}) {
    this.name = name; this.visible = visible; this.frustumCulled = true;
    this.layers = new Layers();
    this.children = []; this.parent = null;
    if (bytes) this.geometry = geometry(bytes);
    if (material) this.material = material;
    for (const c of children) this.add(c);
  }
  add(c) { c.parent = this; this.children.push(c); return this; }
  traverse(fn) { fn(this); for (const c of this.children) c.traverse(fn); }
}
let texId = 0;
const tex = (name, { version = 1, image = { width: 4, height: 4 } } = {}) => ({ name, id: texId++, isTexture: true, version, image });
const shader = (t) => ({ uniforms: { uMap: { value: t } }, visible: true });
const scene = new Obj('scene');
const hero = new Obj('hero', { bytes: 100 });
const mk = (id, n, bytes) => {
  const g = new Obj(id, { visible: false });
  for (let i = 0; i < n; i++) g.add(new Obj(`${id}-${i}`, { bytes, visible: i % 2 === 0, material: shader(tex(`${id}-t${i}`)) }));
  return g;
};
const groups = {
  inspire: mk('inspire', 2, 1000), equip: mk('equip', 1, 1000),
  connect: mk('connect', 2, 300000), final: mk('final', 3, 900000), owned: mk('owned', 2, 600000),
};
// Purpose's many small objects under one subtree: the old list made each a unit
const finalMany = new Obj('final-many', { visible: false });
for (let i = 0; i < 300; i++) finalMany.add(new Obj(`final-many-${i}`, { bytes: 20000 }));
groups.final.add(finalMany);
// one object larger than a batch on its own
groups.final.add(new Obj('final-huge', { bytes: 2.2e6, material: { visible: false } }));
// W9: a uniform ARRAY of textures and a material-slot map, inside a hidden parent
const portraitMap = tex('owned-uMapH-hover');
groups.owned.add(new Obj('owned-hidden', { visible: false, children: [
  new Obj('owned-portraits', { bytes: 5000, material: { uniforms: { uMaps: { value: [tex('owned-arr0'), tex('owned-arr1')] }, uMapH: { value: portraitMap } } } }),
  new Obj('owned-sprite', { bytes: 5000, material: { map: tex('owned-map'), visible: true } }),
] }));
// W8: a texture whose image has not arrived (version 0), filled in mid-rest
const lateImage = tex('owned-late-image', { version: 0, image: null });
groups.owned.children[0].material.uniforms.uMapP = { value: lateImage };
scene.add(hero);
for (const g of Object.values(groups)) scene.add(g);
const declined = groups.owned.children[1].material.uniforms.uMap.value;

const log = [];
let target = null;
const props = new Map();
const registered = new Set();
const register = (g) => { g._listeners = { dispose: [() => {}] }; registered.add(g); };
register(hero.geometry);     // a real frame drew the hero already
let probing = false;
const UNIT_MS = 4;   // what a draw or an upload costs on the fake clock
const renderer = {
  properties: {
    has: (t) => props.has(t),
    get: (t) => { if (!props.has(t)) props.set(t, {}); return props.get(t); },
  },
  compileAsync: (o) => { log.push(['compile', o.name]); return Promise.resolve(); },
  initTexture: (t) => { assert(!probing, 'W12 the report uploads nothing'); log.push(['tex', t.name, now]); if (t !== declined) renderer.properties.get(t).__version = t.version; now += UNIT_MS; },
  getRenderTarget: () => target,
  setRenderTarget: (t) => { target = t; },
  getContext: () => ({ isContextLost: () => false }),
  // three's projectObject: invisible subtrees skipped, layers tested per object
  render: (s, cam) => {
    assert(!probing, 'W12 the report draws nothing');
    assert.equal(target && target.w, 1, 'W2 warm draws go to the 1x1 target only');
    assert.equal(cam.layers.mask, (1 << 30) >>> 0, 'W2 through the warm layer only');
    const drawn = [];
    const walk = (o) => {
      if (!o.visible) return;
      if (o.geometry && o.layers.test(cam.layers)) {
        assert.equal(registered.has(o.geometry), false, `W2 ${o.name} was already on the GPU`);
        assert.equal(o.frustumCulled, false, 'W2 culling off for the warm draw');
        register(o.geometry); drawn.push(o.name);
      }
      o.children.forEach(walk);
    };
    s.children.forEach(walk);
    log.push(['draw', drawn, now]);
    now += UNIT_MS;
  },
};
const camera = {
  layers: new Layers(),
  clone(recursive) { assert.equal(recursive, false, 'camera cloned without children'); const c = { ...camera, layers: new Layers() }; return c; },
  copy(from, recursive) { assert.equal(recursive, false, 'camera copied without children'); return this; },
};
const sceneApi = {
  renderer, scene, camera, rendererName: 'Fake GPU',
  intro: { complete: true },
  composer: { readBuffer: { clone: () => ({ w: 0, setSize(w) { this.w = w; } }) } },
};
const chapters = Object.fromEntries(Object.entries(groups).map(([id, group]) => [id, { group }]));
const transition = { blend: null, cameraStateDisagree: false };
let progressId = 'mission';
const journey = { progress: 0 };
const cardWarmCalls = [];
const cardJobs = [];
// the Manifesto branch: prewarm is false (not yet done) twice, then true
let prewarmCalls = 0, prewarmLeft = 2;
const manifestoBranch = {
  active: false, returning: false, progress: 0,
  prewarm({ budgetMs }) { assert.equal(budgetMs, 8); prewarmCalls++; log.push(['prewarm', progressId]); return prewarmLeft-- <= 0; },
};
const state = {};
// the device, and the window's input listeners (W13 dispatches to them)
const fakeNavigator = {};
const pageErrors = [];
const factory = new Function('sceneApi', 'chapters', 'transition', 'manifestoBranch', 'journey', 'chapterAt',
  'CHAPTER_IDS', 'compileForFrame', 'prepareGpuWarmup', 'window', 'performance',
  'setTimeout', 'requestAnimationFrame', 'location', 'console', 'state', 'startCardWarming',
  'navigator', 'NOWARM', 'WARM_PROFILE', 'reportPageError',
  'let startupFailed = false;\n' + slice
  + '\nreturn { warmHiddenChapters, registerRestWarmTask, isAtRest, report: () => warmProbe && warmProbe() };');
const q = factory(sceneApi, chapters, transition, manifestoBranch, journey, () => ({ id: progressId }),
  ['mission', 'inspire', 'equip', 'connect', 'owned', 'final'],
  (api, o) => api.renderer.compileAsync(o), null,
  { requestIdleCallback: (fn, o) => idles.push({ fn, timeout: o.timeout }) }, { now: () => now }, fakeSetTimeout,
  (fn) => fakeSetTimeout(fn, 16), { search: '' }, { warn() {}, info() {} }, state,
  /* the card-media warmer: records how journey.js wires it (P1 deferral) */
  (o) => { cardWarmCalls.push(o); for (let i = 0; i < 3; i++) o.enqueue(() => { cardJobs.push(i); log.push(['card', i]); }); },
  fakeNavigator, false, null, (m, e) => pageErrors.push(m + (e ? ': ' + e.message : '')));
const report = () => { probing = true; try { return q.report(); } finally { probing = false; } };

let taskRuns = 0;
q.registerRestWarmTask(() => { taskRuns++; log.push(['task', progressId]); }, { chapter: 'final' });

// W1: a flight is live at start: nothing may run.
transition.blend = { dur: 3 };
q.warmHiddenChapters();
await advance(5000);
assert.equal(log.length, 0, 'W1 nothing runs during a flight');
assert.equal(cardWarmCalls.length, 1, 'W7 journey.js hands card-media warming to the queue exactly once');
assert.equal(typeof cardWarmCalls[0].enqueue, 'function', 'W7 via the enqueue option (no timers of its own)');
assert.equal(q.isAtRest(), false);
assert.equal(report().lastSkip, 'flight', 'W12 the report names the last skip');
// lands at Connect; nothing within the 300 ms rest window
transition.blend = null; progressId = 'connect';
await advance(200);
assert.equal(log.length, 0, 'W1 nothing runs in the first WARM_REST_MS of rest');

// W10: starved — no idle period ever. It must still get through Connect's
// next stop (Purpose + Owned) at one slice per WARM_STARVE_MS.
idleMode = 'starved';
await advance(30000);
idleMode = 'idle';
const unitsStarved = log.filter((e) => e[0] !== 'card').length;
assert(unitsStarved > 20, `W10 starved slices still make progress (${unitsStarved} units in 30 s)`);
// each unit costs UNIT_MS of fake time: a starved slice stops once its
// budget is spent, and the next waits WARM_STARVE_MS
const stamps = log.filter((e) => e[0] === 'draw' || e[0] === 'tex').map((e) => e[2]);
let inSlice = 1;
for (let i = 1; i < stamps.length; i++) {
  const gap = stamps[i] - stamps[i - 1];
  if (gap >= WARM_STARVE_MS - 1) { inSlice = 1; continue; }
  inSlice++;
  assert(gap <= UNIT_MS && inSlice <= 3, `W10 a starved slice stays within its budget (gap ${gap}, ${inSlice} units)`);
}
await advance(60000);

// W2/W3
const draws = log.filter((e) => e[0] === 'draw');
const all = []; scene.traverse((o) => { if (o.geometry && o !== hero) all.push(o); });
for (const o of all) {
  if (o.name === 'owned-late-image') continue;
  assert.equal(draws.filter((d) => d[1].includes(o.name)).length, 1, `W2 ${o.name} drawn exactly once`);
}
assert.equal(draws.some((d) => d[1].includes('hero')), false, 'W2 geometry already on the GPU is not redrawn');
const sizeOf = Object.fromEntries(all.map((o) => [o.name, o.geometry.attributes.position.array.byteLength]));
for (const d of draws) {
  const bytes = d[1].reduce((s, n) => s + sizeOf[n], 0);
  assert(d[1].length === 1 || bytes <= WARM_DRAW_BYTES, `W2 a batch stays within WARM_DRAW_BYTES (${bytes})`);
}
assert(draws.filter((d) => d[1].some((n) => n.startsWith('final-many'))).length <= 8, 'W2 300 small objects are a few batches, not 300 units');
assert(draws.some((d) => d[1].length === 1 && d[1][0] === 'final-huge'), 'W2 an object over budget is drawn alone');
for (const g of Object.values(groups)) {
  assert.equal(g.visible, false, 'W3 group visibility restored');
  g.children.forEach((m) => { assert.equal(m.frustumCulled, true, 'W3 culling restored'); assert.equal(m.layers.mask, 1, 'W3 layers restored'); });
}
groups.connect.children.forEach((m, i) => assert.equal(m.visible, i % 2 === 0, 'W3 child visibility restored'));
assert.equal(groups.owned.children[2].visible, false, 'W3 hidden ancestor restored');
assert.equal(groups.final.children.find((o) => o.name === 'final-huge').material.visible, false, 'W3 hidden material restored');
assert.equal(hero.visible, true, 'W3 sibling untouched');
assert.equal(target, null, 'W3 render target restored');

// W4 / W9
const texs = log.filter((e) => e[0] === 'tex').map((e) => e[1]);
assert.equal(new Set(texs).size, texs.length, 'W4 no texture uploaded twice');
for (const name of ['owned-arr0', 'owned-arr1', 'owned-uMapH-hover', 'owned-map', 'owned-t1', 'final-t0', 'connect-t1']) {
  assert(texs.includes(name), `W9 ${name} uploaded`);
}
assert.equal(texs.includes('owned-late-image'), false, 'W8 a texture with no image yet is left alone');

// W5: from Connect: Connect, then Purpose and Owned (its branch), then Equip, Inspire.
const firstOf = (id) => log.findIndex((e) => (e[0] === 'compile' && e[1] === id) || (e[0] === 'tex' && e[1].startsWith(id + '-')));
assert(firstOf('connect') < firstOf('final') && firstOf('final') < firstOf('owned'), 'W5 rail order from Connect');
const lastOf = (id) => log.reduce((k, e, i) => (((e[0] === 'tex' && e[1].startsWith(id + '-')) || (e[0] === 'draw' && e[1].some((n) => n.startsWith(id + '-')))) ? i : k), -1);
assert(lastOf('owned') < firstOf('equip'), 'W5 all of Owned (drawn by a flight to Purpose) before Equip');
assert(firstOf('equip') < firstOf('inspire'), 'W5 nearer before farther');
// W7: card media after the next stop's GPU units, and all of it eventually
const firstCard = log.findIndex((e) => e[0] === 'card');
assert(firstCard > lastOf('owned'), 'W7 card media does not delay the next stop\'s GPU units');
assert.deepEqual(cardJobs, [0, 1, 2], 'W7 queued card-media jobs all ran, in order, once the journey rested');

// W12: nothing missing near here; the report says so and drew nothing.
let rep = report();
for (const id of ['connect', 'final', 'equip', 'inspire']) {
  assert.deepEqual(rep.chapters[id].missing, { geometries: 0, bytes: 0, textures: 0, textureBytes: 0 }, `W12 ${id} lacks nothing`);
}
assert.equal(rep.chapters.owned.missing.textures, 0, 'W12 the version-0 texture is not counted as missing yet');
assert(rep.warmed.textures >= 14 && rep.warmed.draws > 0 && rep.warmed.bytes > 5e6, 'W12 totals');
assert.equal(rep.chapters.final.warmed.textures, 3);
assert(rep.longestUnit && rep.slices > 0 && Array.isArray(rep.log));
assert.equal(rep.lastSkip, 'nothing missing');

// W6: the Purpose tasks wait for a Purpose rest.
assert.equal(taskRuns, 0, 'W6 chapter task does not run away from its chapter');
assert.equal(prewarmCalls, 0, 'W11 the Manifesto prewarm only runs at Purpose');
transition.blend = { dur: 3 }; progressId = 'final';
await advance(2000);
assert.equal(taskRuns + prewarmCalls, 0, 'W6 not during the flight');

// W8: built after every scan so far — an object, and the image arriving.
const lateObj = new Obj('final-late', { bytes: 4000 });
groups.final.add(lateObj);
const drawsBefore = log.filter((e) => e[0] === 'draw').length;
transition.blend = null;
await advance(5000);
assert.equal(taskRuns, 1, 'W6 runs once at its chapter rest');
assert(log.findIndex((e) => e[0] === 'draw' && e[1].includes('final-late')) < log.findIndex((e) => e[0] === 'task'), 'W6 after the chapter\'s own units');
// W11: prewarm false, false, true: called until done, then not again
assert.equal(prewarmCalls, 3, 'W11 the queue calls prewarm until it reports done');
await advance(10000);
assert.equal(prewarmCalls, 3, 'W11 and not after it is done');
assert.equal(log.filter((e) => e[0] === 'draw').length, drawsBefore + 1, 'W8 the late object is drawn; nothing already on the GPU redrawn');
// the image lands mid-rest: picked up at the next rescan, with no flight
// (RE-PINNED 2026-11, C3: the rescan backs off while nothing turns up, so
// "the next rescan" is up to WARM_RESCAN_MAX_MS away, not WARM_RESCAN_MS)
lateImage.image = { width: 8, height: 8 }; lateImage.version = 1;
await advance(WARM_RESCAN_MAX_MS + 1000);
assert(texs.length < log.filter((e) => e[0] === 'tex').length && log.some((e) => e[0] === 'tex' && e[1] === 'owned-late-image'), 'W8 a texture whose image arrived mid-rest is uploaded at rest');
// a remix swaps a new atlas into a uniform mid-rest
groups.owned.children[0].material.uniforms.uMapH2 = { value: tex('owned-swapped') };
await advance(WARM_RESCAN_MAX_MS + 1000);
assert(log.some((e) => e[0] === 'tex' && e[1] === 'owned-swapped'), 'W8 a swapped-in texture is uploaded at rest');

// W11 repeat: the next Purpose rest asks prewarm again (a pose may have changed)
prewarmLeft = 0;
transition.blend = { dur: 3 }; await advance(1000); transition.blend = null; await advance(5000);
assert.equal(prewarmCalls, 4, 'W11 asked again at the next Purpose rest, once, as it is already done');
assert.equal(taskRuns, 1, 'one-shot tasks do not repeat');
rep = report();
assert.deepEqual(rep.chapters.owned.missing, { geometries: 0, bytes: 0, textures: 0, textureBytes: 0 }, 'W12 owned lacks nothing');
assert.deepEqual(rep.tasks, [], 'W12 no task pending');

/* ---- W13-W19: the good citizen (2026-11, C2/C3) ------------------------
   Each scenario is a fresh queue over a fresh world on the same fake clock.
   Every chapter holds one small object and one small texture; Owned also
   holds the 4096x1024 hover atlas (16 MB) and Purpose an 8 MB atlas — the
   two "large" uploads. */
const WARM_START_MS = constant('WARM_START_MS');
const WARM_FAR_IDLE_MS = constant('WARM_FAR_IDLE_MS');
const WARM_LARGE_GAP_MS = constant('WARM_LARGE_GAP_MS');
function scenario({ nav = {}, nowarm = false, profileFlag = null, here = 'mission', cost = () => UNIT_MS } = {}) {
  const S = { here, log: [], walks: 0, cards: 0, listeners: {} };
  const reg = new Set();
  const P = new Map();
  let tgt = null;
  const world = new Obj('scene2');
  const gs = {};
  for (const id of ['inspire', 'equip', 'connect', 'final', 'owned']) {
    const g = new Obj(id, { visible: false });
    g.add(new Obj(`${id}-o`, { bytes: 1000, material: shader(tex(`${id}-t`)) }));
    gs[id] = g; world.add(g);
  }
  gs.owned.add(new Obj('owned-hover', { bytes: 1000, material: shader(tex('owned-big', { image: { width: 4096, height: 1024 } })) }));
  gs.final.add(new Obj('final-atlas', { bytes: 1000, material: shader(tex('final-big', { image: { width: 2048, height: 1024 } })) }));
  // a material whose reads count the rescan's walks over Purpose
  const counted = gs.final.children[0].material;
  const uniforms = counted.uniforms;
  Object.defineProperty(counted, 'uniforms', { get() { S.walks++; return uniforms; } });
  const r2 = {
    properties: { has: (t) => P.has(t), get: (t) => { if (!P.has(t)) P.set(t, {}); return P.get(t); } },
    compileAsync: (o) => { S.log.push(['compile', o.name, now]); return Promise.resolve(); },
    initTexture: (t) => { r2.properties.get(t).__version = t.version; S.log.push(['tex', t.name, now]); now += cost(t); },
    getRenderTarget: () => tgt, setRenderTarget: (t) => { tgt = t; },
    getContext: () => ({ isContextLost: () => false }),
    render: (sc, cam) => {
      const names = [];
      const visit = (o) => { if (!o.visible) return; if (o.geometry && o.layers.test(cam.layers) && !reg.has(o.geometry)) { reg.add(o.geometry); o.geometry._listeners = { dispose: [() => {}] }; names.push(o.name); } o.children.forEach(visit); };
      sc.children.forEach(visit);
      S.log.push(['draw', names, now]); now += UNIT_MS;
    },
  };
  const api = { renderer: r2, scene: world, camera, rendererName: 'Fake GPU', intro: { complete: true },
    composer: { readBuffer: { clone: () => ({ w: 0, setSize(w) { this.w = w; } }) } } };
  const tr = { blend: null, cameraStateDisagree: false };
  const qq = factory(api, Object.fromEntries(Object.entries(gs).map(([id, group]) => [id, { group }])), tr,
    { active: false, returning: false, progress: 0, prewarm: () => true }, { progress: 0 }, () => ({ id: S.here }),
    ['mission', 'inspire', 'equip', 'connect', 'owned', 'final'], (a, o) => a.renderer.compileAsync(o), null,
    { requestIdleCallback: (fn, o) => idles.push({ fn, timeout: o.timeout }),
      addEventListener: (type, fn, o) => { assert(o && o.passive && o.capture, 'W13 input is watched passively'); (S.listeners[type] ||= []).push(fn); } },
    { now: () => now }, fakeSetTimeout,
    (fn) => fakeSetTimeout(fn, 16), { search: '' }, { warn() {}, info() {} }, {},
    () => { S.cards++; }, nav, nowarm, profileFlag, (m) => pageErrors.push(m));
  S.q = qq; S.tr = tr;
  S.input = (type) => { for (const fn of S.listeners[type] || []) fn({ type }); };
  S.report = () => qq.report();
  S.touched = (id) => S.log.some((e) => (e[0] === 'tex' && e[1].startsWith(id + '-')) || (e[0] === 'draw' && e[1].some((n) => n.startsWith(id + '-'))));
  S.fly = async (to) => { tr.blend = { dur: 1 }; await advance(1000); S.here = to; tr.blend = null; };
  qq.warmHiddenChapters();
  return S;
}

// W13 THE START GATE: nothing in the first WARM_START_MS of the first rest
// after the intro; and any input within WARM_INPUT_QUIET_MS waits.
{
  const S = scenario();
  await advance(WARM_START_MS - 600);
  S.input('wheel');                 // the visitor scrolls
  await advance(400);
  assert.equal(S.log.length, 0, 'W13 nothing before WARM_START_MS, nor within 500 ms of input');
  await advance(1500);
  assert(S.log.length > 0, 'W13 then it starts');
  assert.equal(S.report().started, true);
}

// W14 NEED: from the Intro only its neighbour (Inspire) until the visitor
// has idled WARM_FAR_IDLE_MS; far chapters after; the large textures never
// at the Intro, however long it rests.
{
  const S = scenario();
  await advance(WARM_FAR_IDLE_MS - 1000);
  assert(S.touched('inspire'), 'W14 the Intro\'s neighbour is warmed');
  // W20 THE PURPOSE KEPT: after a normal rest, the next hop finds its
  // destination resident (no upload left for the flight)
  assert.deepEqual(S.report().chapters.inspire.missing, { geometries: 0, bytes: 0, textures: 0, textureBytes: 0 }, 'W20 a normal rest at the Intro leaves Inspire nothing to upload');
  for (const id of ['equip', 'connect', 'final', 'owned']) assert.equal(S.touched(id), false, `W14 ${id} (far) waits`);
  await advance(120000);
  assert(S.touched('equip') && S.touched('owned'), 'W14 far chapters after a long idle (normal profile)');
  const texs = S.log.filter((e) => e[0] === 'tex').map((e) => e[1]);
  assert.equal(texs.includes('owned-big') || texs.includes('final-big'), false, 'W14 no large texture at the Intro');
  assert.equal(S.report().profile.name, 'normal');
  // W15 THE LARGE RULE: at Connect (Purpose's and Owned's neighbour) both
  // large atlases are warmed, each alone in its slice, a second apart at least
  await S.fly('connect');
  await advance(30000);
  const big = S.log.filter((e) => e[0] === 'tex' && /-big$/.test(e[1]));
  assert.equal(big.length, 2, 'W15 both large textures warmed next to their chapter');
  assert(Math.abs(big[1][2] - big[0][2]) >= WARM_LARGE_GAP_MS, `W15 never two large uploads within ${WARM_LARGE_GAP_MS} ms`);
  const solo = S.report().log.filter((e) => /^texture:(owned|final)/.test(e.what || '') && e.solo);
  assert(solo.length >= 2, 'W15 each large upload ran alone in its slice');
  for (const id of ['final', 'owned', 'equip']) {
    assert.deepEqual(S.report().chapters[id].missing, { geometries: 0, bytes: 0, textures: 0, textureBytes: 0 }, `W20 a rest at Connect leaves ${id} nothing to upload`);
  }
  // W19 THE RESCAN BACKS OFF: drained at rest, the walk of Purpose's
  // materials doubles its interval up to WARM_RESCAN_MAX_MS (it used to run
  // every ~3.25 s for the life of the page: ~55 walks in 180 s)
  await advance(20000);
  const w0 = S.walks;
  await advance(180000);
  const walks = S.walks - w0;
  assert(walks >= 2 && walks <= 10, `W19 the drained queue rescans rarely (${walks} walks in 180 s)`);
  assert(S.report().rescanMs >= 48000, 'W19 the interval has grown');
  // ...and a new rest after a flight looks again at once
  const t1 = S.walks;
  await S.fly('final');
  await advance(1500);
  assert(S.walks > t1, 'W19 a rest after a flight rescans without waiting out the back-off');
}

// W16 THE DEVICE GATE: deviceMemory <= 8 is the conservative profile:
// adjacent chapters only, however long the rest.
{
  const S = scenario({ nav: { deviceMemory: 8, hardwareConcurrency: 8 } });
  assert.deepEqual([S.report().profile.name, S.report().profile.why], ['conservative', 'deviceMemory 8'], 'W16 the profile and its reason are in warmReport()');
  await advance(150000);
  assert(S.touched('inspire'), 'W16 the neighbour is warmed');
  for (const id of ['equip', 'connect', 'final', 'owned']) assert.equal(S.touched(id), false, `W16 conservative: ${id} never from the Intro`);
  const forced = scenario({ nav: { deviceMemory: 4 }, profileFlag: 'normal' });
  assert.equal(forced.report().profile.name, 'normal', 'W16 ?warmprofile=normal overrides the gate');
}

// W17 A SLOW UNIT backs the queue off exponentially and turns it conservative.
{
  const S = scenario({ here: 'connect', cost: (t) => (t.name === 'connect-t' ? 200 : UNIT_MS) });
  await advance(WARM_START_MS + 3000);
  const rep = S.report();
  assert.equal(rep.profile.name, 'conservative', 'W17 a slow unit selects the conservative profile');
  assert(/slow unit/.test(rep.profile.why) && rep.profile.slowUnits >= 1, 'W17 and says why');
  const at = S.log.find((e) => e[1] === 'connect-t')[2];
  const after = S.log.filter((e) => e[2] > at + 200);
  assert(after.length > 0 && after[0][2] >= at + 200 + 1000, 'W17 the next unit waits out the back-off');
}

// W18 THE KILL SWITCH: ?nowarm=1 — nothing runs, card media is not queued.
{
  const S = scenario({ nowarm: true, here: 'connect' });
  await advance(60000);
  assert.equal(S.log.length, 0, 'W18 ?nowarm: no unit ever runs');
  assert.equal(S.cards, 0, 'W18 ?nowarm: card media is not queued');
  assert.equal(S.report().disabled, '?nowarm');
}
assert.deepEqual(pageErrors, [], 'no warm unit failed');

console.log('rest warm queue: W1-W20 passed');
