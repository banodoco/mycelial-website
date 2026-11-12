#!/usr/bin/env node
/* tools/test-mobile-stability.mjs — the contracts behind the 2026-11-11
 * mobile-stability pass (docs/polish/mobile-stability-report.md). Pure node.
 *
 *   M1  rest cadence (organism/rest-cadence.js): full rate in flight, on a
 *       fine pointer, under the capture freeze and for IDLE_MS after input;
 *       half rate after IDLE_MS at rest on a touch device; hold while an
 *       overlay covers the scene; input restores full rate on the same frame.
 *   M2  the frame loop's fourth gate (organism/animation.js), EXECUTED with a
 *       fake rAF: cadence 2 draws every other frame, 0 draws nothing, 1 draws
 *       every frame, a window resize always draws, animators run every frame.
 *   M3  one multisampled composer target: renderTarget2 is single-sampled
 *       with no depth, the scene target is pinned back to rt1 after every
 *       composed frame, and (simulated with the vendored composer's own swap
 *       rule) the scene never draws into rt2 whatever the swap parity.
 *   M4  the canvas is not multisampled (only full-screen passes reach it).
 *   M5  a retired portrait atlas releases its canvas backing store at once.
 */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let failed = 0;
const row = (id, name, fn) => {
  try { fn(); console.log(`  PASS  ${id}  ${name}`); }
  catch (e) { failed++; console.log(`  FAIL  ${id}  ${name}\n        ${e.message.split('\n').join('\n        ')}`); }
};

/* ---- M1 ---- */
const { createRestCadence, IDLE_MS, COVER_POLL_MS } = await import(pathToFileURL(join(root, 'organism/rest-cadence.js')));
const world = (o = {}) => {
  const w = { t: 0, coarse: true, atRest: true, covered: false, frozen: false, coverAsks: 0, ...o };
  w.c = createRestCadence({
    now: () => w.t, coarse: () => w.coarse, atRest: () => w.atRest,
    covered: () => { w.coverAsks++; return w.covered; }, frozen: () => w.frozen,
  });
  return w;
};
row('M1a', 'touch device at rest: full rate until IDLE_MS, then half rate', () => {
  const w = world();
  assert.equal(w.c.frame(), 1);
  w.t = IDLE_MS - 1; assert.equal(w.c.frame(), 1);
  w.t = IDLE_MS; assert.equal(w.c.frame(), 2);
});
row('M1b', 'any input returns full rate on the same frame and restarts the idle wait', () => {
  const w = world(); w.t = IDLE_MS * 2; assert.equal(w.c.frame(), 2);
  w.c.input(); assert.equal(w.c.frame(), 1);
  w.t += IDLE_MS - 1; assert.equal(w.c.frame(), 1);
  w.t += 1; assert.equal(w.c.frame(), 2);
});
row('M1c', 'a flight is full rate, and its landing restarts the idle wait', () => {
  const w = world(); w.t = IDLE_MS * 2; w.atRest = false; assert.equal(w.c.frame(), 1);
  w.t += 10; w.atRest = true; assert.equal(w.c.frame(), 1);
  w.t += IDLE_MS; assert.equal(w.c.frame(), 2);
});
row('M1d', 'fine pointer and the capture freeze never throttle', () => {
  const d = world({ coarse: false }); d.t = IDLE_MS * 10; assert.equal(d.c.frame(), 1);
  const f = world({ frozen: true }); f.t = IDLE_MS * 10; assert.equal(f.c.frame(), 1);
});
row('M1e', 'a covering overlay holds the frame at rest (even before IDLE_MS), never in flight', () => {
  const w = world({ covered: true }); assert.equal(w.c.frame(), 0);
  w.atRest = false; assert.equal(w.c.frame(), 1);
});
row('M1f', 'the cover check is polled, not run per frame; input re-polls at once', () => {
  const w = world(); w.c.frame(); const n = w.coverAsks;
  for (let i = 0; i < 10; i++) { w.t += 16; w.c.frame(); }
  assert.ok(w.coverAsks - n <= Math.ceil(160 / COVER_POLL_MS), `asked ${w.coverAsks - n} times in 160 ms`);
  w.covered = true; w.c.input(); assert.equal(w.c.frame(), 0, 'menu tap must hold on the next frame');
  w.covered = false; w.c.input(); assert.equal(w.c.frame(), 1, 'menu close must resume on the next frame');
});

/* ---- M2: execute the real animation.js with a stub THREE.Clock ---- */
const animSrc = await readFile(join(root, 'organism/animation.js'), 'utf8');
assert.ok(animSrc.includes("import * as THREE from 'three';"));
const dir = await mkdtemp(join(tmpdir(), 'mstab-'));
const stubbed = animSrc.replace("import * as THREE from 'three';",
  'const THREE = { Clock: class { constructor() { this.t = 0; } getElapsedTime() { return (this.t += 1 / 60); } } };');
await writeFile(join(dir, 'animation.mjs'), stubbed);
const { createAnimationLifecycle } = await import(pathToFileURL(join(dir, 'animation.mjs')));
await rm(dir, { recursive: true, force: true });
const loop = () => {
  const q = []; globalThis.requestAnimationFrame = fn => { q.push(fn); return q.length; };
  globalThis.cancelAnimationFrame = () => {};
  globalThis.innerWidth = 390; globalThis.innerHeight = 844;
  const L = { renders: 0, ticks: 0 };
  L.life = createAnimationLifecycle({ beforeRender() {}, render() { L.renders++; } });
  L.life.addAnimator('a', () => { L.ticks++; });
  L.life.start();
  L.step = (n) => { for (let i = 0; i < n; i++) q.shift()(); };
  return L;
};
row('M2a', 'no cadence source: every frame draws (unchanged behaviour)', () => {
  const L = loop(); L.step(10); assert.equal(L.renders, 11);
});
row('M2b', 'cadence 2 draws every other frame; animators still run every frame', () => {
  const L = loop(); L.step(1); const r0 = L.renders, t0 = L.ticks;
  L.life.setCadenceSource(() => 2); L.step(1); // first frame after install: size baseline
  const r1 = L.renders, t1 = L.ticks; L.step(20);
  assert.equal(L.renders - r1, 10); assert.equal(L.ticks - t1, 20);
  assert.ok(r1 >= r0 && t1 > t0);
});
row('M2c', 'cadence 0 holds (no draws); 1 draws every frame; a resize always draws', () => {
  const L = loop(); let every = 0; L.life.setCadenceSource(() => every); L.step(1);
  const r = L.renders; L.step(10); assert.equal(L.renders, r, 'held');
  globalThis.innerHeight = 800; L.step(1); assert.equal(L.renders, r + 1, 'resize draws through a hold');
  L.step(5); assert.equal(L.renders, r + 1);
  every = 1; L.step(5); assert.equal(L.renders, r + 6);
  L.life.setCadenceSource(null); every = 0; L.step(3); assert.equal(L.renders, r + 9, 'cleared source = always draw');
});

/* ---- M3 ---- */
const org = await readFile(join(root, 'organism/organism.js'), 'utf8');
const composerSrc = await readFile(join(root, 'vendor/three/addons/postprocessing/EffectComposer.js'), 'utf8');
row('M3a', 'renderTarget2 is replaced by a single-sampled, depthless target and the old one disposed', () => {
  const at = org.indexOf('const composer = new EffectComposer');
  const blk = org.slice(at, org.indexOf('composer.addPass(new RenderPass', at));
  assert.match(blk, /new THREE\.WebGLRenderTarget\(_dbSize\.width, _dbSize\.height,\s*\{ type: THREE\.HalfFloatType, depthBuffer: false \}\)/);
  assert.doesNotMatch(blk.slice(blk.indexOf('const single')), /samples/);
  assert.match(blk, /composer\.renderTarget2\.dispose\(\);\s*composer\.renderTarget2 = single;/);
  assert.match(blk, /composer\.readBuffer = composer\.renderTarget1;\s*composer\.writeBuffer = single;/);
});
row('M3b', 'every composed frame is followed by the pin back to rt1', () => {
  assert.match(org, /render: \(\) => \{ composer\.render\(\); pinSceneTarget\(\); \}/);
  assert.match(org, /const pinSceneTarget = \(\) => \{\s*if \(composer\.readBuffer !== composer\.renderTarget1\) composer\.swapBuffers\(\);/);
});
row('M3c', 'simulated with the vendored swap rule, the scene never draws into rt2 at any parity', () => {
  // the vendored composer swaps after each enabled pass with needsSwap
  assert.match(composerSrc, /if \( pass\.needsSwap \) \{/);
  assert.match(composerSrc, /this\.writeBuffer = this\.renderTarget1;\s*this\.readBuffer = this\.renderTarget2;/);
  for (const swaps of [[false, false, true, true, true], [false, false, true, true], [false, false, false, true, true, true]]) {
    const c = { renderTarget1: 'rt1', renderTarget2: 'rt2', readBuffer: 'rt1', writeBuffer: 'rt2',
      swapBuffers() { [this.readBuffer, this.writeBuffer] = [this.writeBuffer, this.readBuffer]; } };
    for (let f = 0; f < 7; f++) {
      assert.equal(c.readBuffer, 'rt1', `frame ${f}, ${swaps.filter(Boolean).length} swaps: scene target`);
      for (const s of swaps) if (s) c.swapBuffers();
      if (c.readBuffer !== c.renderTarget1) c.swapBuffers(); // pinSceneTarget
    }
  }
});
/* ---- M4 ---- */
const rend = await readFile(join(root, 'organism/renderer.js'), 'utf8');
row('M4', 'the canvas is not multisampled: WebGLRenderer({ antialias: false, ... })', () => {
  assert.match(rend, /new THREE\.WebGLRenderer\(\{ antialias: false, depth: false, powerPreference: 'high-performance' \}\)/);
});

/* ---- M5 ---- */
const { createPortraitTextureOwner } = await import(pathToFileURL(join(root, 'journey/chapters/owned/portrait-textures.js')));
row('M5', 'a retired portrait atlas frees its canvas backing store; protected and wired ones keep theirs', () => {
  const canvas = () => ({ width: 4096, height: 1024, getContext() {} });
  const tex = () => ({ image: canvas(), disposed: 0, dispose() { this.disposed++; } });
  const perm = tex(), wired = tex(), free = tex(), plain = { image: { width: 8, height: 8 }, dispose() {} };
  const u = { uMapA: { value: wired }, uMapP: { value: null }, uMapA2: { value: null }, uMapP2: { value: null }, uMapH: { value: null }, uMapH2: { value: null } };
  const owner = createPortraitTextureOwner({ uniforms: u, permanent: [perm] });
  owner.retire(perm); owner.retire(wired); owner.retire(free); owner.retire(free); owner.retire(plain);
  assert.deepEqual([perm.image.width, wired.image.width], [4096, 4096]);
  assert.deepEqual([free.image.width, free.image.height, free.disposed], [0, 0, 2]);
  assert.equal(plain.image.width, 8, 'a non-canvas image is left alone');
});

console.log(failed ? `mobile stability: ${failed} FAIL` : 'mobile stability: ALL PASS');
process.exit(failed ? 1 : 0);
