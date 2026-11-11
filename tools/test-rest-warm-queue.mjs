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
const WARM_RESCAN_MS = constant('WARM_RESCAN_MS');

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
      let left = 50;
      fn({ didTimeout: false, timeRemaining: () => Math.max(0, left -= 4) });
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
const factory = new Function('sceneApi', 'chapters', 'transition', 'manifestoBranch', 'journey', 'chapterAt',
  'CHAPTER_IDS', 'compileForFrame', 'prepareGpuWarmup', 'window', 'performance',
  'setTimeout', 'requestAnimationFrame', 'location', 'console', 'state', 'startCardWarming',
  'let startupFailed = false;\n' + slice
  + '\nreturn { warmHiddenChapters, registerRestWarmTask, isAtRest, report: () => warmProbe && warmProbe() };');
const q = factory(sceneApi, chapters, transition, manifestoBranch, journey, () => ({ id: progressId }),
  ['mission', 'inspire', 'equip', 'connect', 'owned', 'final'],
  (api, o) => api.renderer.compileAsync(o), null,
  { requestIdleCallback: (fn, o) => idles.push({ fn, timeout: o.timeout }) }, { now: () => now }, fakeSetTimeout,
  (fn) => fakeSetTimeout(fn, 16), { search: '' }, { warn() {}, info() {} }, state,
  /* the card-media warmer: records how journey.js wires it (P1 deferral) */
  (o) => { cardWarmCalls.push(o); for (let i = 0; i < 3; i++) o.enqueue(() => { cardJobs.push(i); log.push(['card', i]); }); });
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
lateImage.image = { width: 8, height: 8 }; lateImage.version = 1;
await advance(WARM_RESCAN_MS + 1000);
assert(texs.length < log.filter((e) => e[0] === 'tex').length && log.some((e) => e[0] === 'tex' && e[1] === 'owned-late-image'), 'W8 a texture whose image arrived mid-rest is uploaded at rest');
// a remix swaps a new atlas into a uniform mid-rest
groups.owned.children[0].material.uniforms.uMapH2 = { value: tex('owned-swapped') };
await advance(WARM_RESCAN_MS + 1000);
assert(log.some((e) => e[0] === 'tex' && e[1] === 'owned-swapped'), 'W8 a swapped-in texture is uploaded at rest');

// W11 repeat: the next Purpose rest asks prewarm again (a pose may have changed)
prewarmLeft = 0;
transition.blend = { dur: 3 }; await advance(1000); transition.blend = null; await advance(5000);
assert.equal(prewarmCalls, 4, 'W11 asked again at the next Purpose rest, once, as it is already done');
assert.equal(taskRuns, 1, 'one-shot tasks do not repeat');
rep = report();
assert.deepEqual(rep.chapters.owned.missing, { geometries: 0, bytes: 0, textures: 0, textureBytes: 0 }, 'W12 owned lacks nothing');
assert.deepEqual(rep.tasks, [], 'W12 no task pending');
console.log('rest warm queue: W1-W12 passed');
