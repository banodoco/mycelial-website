// tools/test-rest-warm-queue.mjs
//
// Executes journey.js's shipped rest-time warm queue (warmHiddenChapters and
// isAtRest, sliced out of the file the way test-intro-readiness.mjs slices
// prepareGpu) against a fake renderer, scene, clock and idle scheduler.
// Pins what the hitch pass (ledger P1/P2/P5) relies on:
//   W1  nothing runs while a flight is live, or within WARM_REST_MS of landing
//   W2  every chapter's geometry is drawn once, at rest, into a 1x1 target
//   W3  a warm draw restores visibility, frustumCulled and the render target
//   W4  one texture upload per unit; an upload three declines is not retried
//   W5  nearest chapter first, in rail order (Purpose before its Owned branch)
//   W6  a registered rest task runs only at its chapter, after that chapter's
//       own units; card media is queued here, not self-started
// Run: node tools/test-rest-warm-queue.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../journey/journey.js', import.meta.url), 'utf8');
const start = src.indexOf('  async function prepareGpu()');
const end = src.indexOf('\n  state.ready = prepareGpu();', start);
assert(start > 0 && end > start, 'warm queue slice found');

// ---- fakes -------------------------------------------------------------
let now = 0;
const timers = [];
const idles = [];
const fakeSetTimeout = (fn, ms = 0) => { timers.push({ at: now + ms, fn }); return timers.length; };
const flush = () => new Promise((resolve) => setImmediate(resolve));
async function advance(ms, idleBudget = 50) {
  const until = now + ms;
  for (;;) {
    await flush();
    timers.sort((a, b) => a.at - b.at);
    if (idles.length) {
      const fn = idles.shift();
      let left = idleBudget;
      fn({ didTimeout: false, timeRemaining: () => left -= 4 });
      continue;
    }
    if (!timers.length || timers[0].at > until) break;
    const t = timers.shift();
    now = Math.max(now, t.at);
    t.fn();
  }
  now = until;
}
class Obj {
  constructor(name, { bytes = 0, visible = true, children = [] } = {}) {
    this.name = name; this.visible = visible; this.frustumCulled = true;
    this.children = []; this.parent = null;
    if (bytes) this.geometry = { attributes: { position: { array: { byteLength: bytes } } } };
    for (const c of children) this.add(c);
  }
  add(c) { c.parent = this; this.children.push(c); return this; }
  traverse(fn) { fn(this); for (const c of this.children) c.traverse(fn); }
}
const tex = (name) => ({ name, isTexture: true, version: 1, image: { width: 4 } });
const scene = new Obj('scene');
const hero = new Obj('hero', { bytes: 100 });
const mk = (id, n, bytes) => {
  const g = new Obj(id, { visible: false });
  for (let i = 0; i < n; i++) {
    const m = new Obj(`${id}-${i}`, { bytes, visible: i % 2 === 0 });
    m.material = { uniforms: { uMap: { value: tex(`${id}-t${i}`) } } };
    g.add(m);
  }
  return g;
};
const groups = {
  inspire: mk('inspire', 2, 1000), equip: new Obj('equip', { visible: false }),
  connect: mk('connect', 2, 300000), final: mk('final', 3, 900000), owned: mk('owned', 2, 600000),
};
scene.add(hero);
for (const g of Object.values(groups)) scene.add(g);
const declined = groups.owned.children[1].material.uniforms.uMap.value;

const log = [];
let target = null;
const props = new Map();
const renderer = {
  properties: { get: (t) => { if (!props.has(t)) props.set(t, {}); return props.get(t); } },
  compileAsync: (o) => { log.push(['compile', o.name]); return Promise.resolve(); },
  initTexture: (t) => { log.push(['tex', t.name]); if (t !== declined) props.get(t).__version = t.version; },
  getRenderTarget: () => target,
  setRenderTarget: (t) => { target = t; },
  getContext: () => ({ isContextLost: () => false }),
  render: (s) => {
    assert.equal(target && target.w, 1, 'W2 warm draws go to the 1x1 target only');
    const drawn = [];
    const walk = (o) => { if (!o.visible) return; if (o.geometry && o !== hero) drawn.push(o.name); assert.equal(o === hero, false, 'W2 siblings are hidden'); o.children.forEach(walk); };
    s.children.forEach(walk);
    log.push(['draw', drawn.join(',')]);
  },
};
const sceneApi = {
  renderer, scene, camera: {}, rendererName: 'Fake GPU',
  intro: { complete: true },
  composer: { readBuffer: { clone: () => ({ w: 0, setSize(w) { this.w = w; } }) } },
};
const chapters = Object.fromEntries(Object.entries(groups).map(([id, group]) => [id, { group }]));
const transition = { blend: null, cameraStateDisagree: false };
let progressId = 'mission';
const journey = { progress: 0 };
const cardJobs = [];
const factory = new Function('sceneApi', 'chapters', 'transition', 'manifestoBranch', 'journey', 'chapterAt',
  'CHAPTER_IDS', 'compileForFrame', 'prepareGpuWarmup', 'startCardWarming', 'window', 'performance',
  'setTimeout', 'requestAnimationFrame', 'location', 'console', 'state',
  'let startupFailed = false;\n' + src.slice(start, end)
  + '\nreturn { warmHiddenChapters, registerRestWarmTask, isAtRest };');
const q = factory(sceneApi, chapters, transition, null, journey, () => ({ id: progressId }),
  ['mission', 'inspire', 'equip', 'connect', 'owned', 'final'],
  (api, o) => api.renderer.compileAsync(o), null,
  (o) => { o.enqueue(() => cardJobs.push('font')); o.enqueue(() => cardJobs.push('media')); },
  { requestIdleCallback: (fn) => idles.push(fn) }, { now: () => now }, fakeSetTimeout,
  (fn) => fakeSetTimeout(fn, 16), { search: '' }, { warn() {}, info() {} }, {});

let taskRuns = 0;
q.registerRestWarmTask(() => { taskRuns++; log.push(['task', progressId]); }, { chapter: 'final' });

// W1: a flight is live at start: nothing may run.
transition.blend = { dur: 3 };
q.warmHiddenChapters();
await advance(5000);
assert.equal(log.length, 0, 'W1 nothing runs during a flight');
assert.equal(q.isAtRest(), false);
// lands at Connect; nothing within the 300 ms rest window
transition.blend = null; progressId = 'connect';
await advance(200);
assert.equal(log.length, 0, 'W1 nothing runs in the first WARM_REST_MS of rest');
await advance(60000);

// W2/W3: every geometry drawn exactly once, state restored.
const draws = log.filter((e) => e[0] === 'draw').map((e) => e[1]);
for (const g of Object.values(groups)) for (const m of g.children) {
  assert.equal(draws.filter((d) => d.split(',').includes(m.name)).length, 1, `W2 ${m.name} drawn once`);
}
assert(draws.every((d) => d.split(',').length >= 1));
for (const g of Object.values(groups)) {
  assert.equal(g.visible, false, 'W3 group visibility restored');
  g.children.forEach((m, i) => { assert.equal(m.visible, i % 2 === 0, 'W3 child visibility restored'); assert.equal(m.frustumCulled, true); });
}
assert.equal(hero.visible, true, 'W3 sibling restored');
assert.equal(target, null, 'W3 render target restored');

// W4: each texture uploaded once; the declined one tried once, not looped.
const texs = log.filter((e) => e[0] === 'tex').map((e) => e[1]);
assert.equal(new Set(texs).size, texs.length, 'W4 no texture uploaded twice');
assert.equal(texs.length, 9, 'W4 every chapter texture uploaded');

// W5: from Connect, Connect first, then Purpose before Owned, then Equip/Inspire.
const firstOf = (id) => log.findIndex((e) => e[1] && e[1].startsWith(id));
assert(firstOf('connect') < firstOf('final') && firstOf('final') < firstOf('owned'), 'W5 rail order from Connect');
assert(firstOf('owned') < firstOf('inspire'), 'W5 nearer before farther');

// W6: the Purpose task waits for a Purpose rest; card media queued here.
assert.equal(taskRuns, 0, 'W6 chapter task does not run away from its chapter');
assert.deepEqual(cardJobs, ['font', 'media'], 'W6 card media runs from the rest queue');
transition.blend = { dur: 3 }; progressId = 'final';
await advance(2000);
assert.equal(taskRuns, 0, 'W6 not during the flight');
transition.blend = null;
await advance(5000);
assert.equal(taskRuns, 1, 'W6 runs once at its chapter rest');
const drawsAfter = log.filter((e) => e[0] === 'draw').length;
assert.equal(drawsAfter, draws.length, 'no geometry redrawn after the queue drained');

// A texture swapped in later (photo atlas, remix) is uploaded at the next rest.
const late = tex('owned-late');
groups.owned.children[0].material.uniforms.uMapH = { value: late };
transition.blend = { dur: 3 }; await advance(1000); transition.blend = null; await advance(5000);
assert(log.some((e) => e[0] === 'tex' && e[1] === 'owned-late'), 'a late texture is uploaded at the next rest');
console.log('rest warm queue: W1-W6 passed');
