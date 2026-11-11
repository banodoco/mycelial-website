#!/usr/bin/env node
/* motion-capture.js — deterministic camera/copy motion capture for the
 * Mycelial site's section transitions. QA-only; nothing in the repo imports it.
 *
 *   node motion-capture.js [--only intro-inspire,purpose-manifesto] [--mobile]
 *        [--url http://localhost:8137/] [--out DIR] [--filmstrip N]
 *        [--dsf 1|2] [--max-sec S]
 *
 * Time: Playwright's fake clock is installed before load and paused
 * (clock.install + clock.pauseAt), so performance.now / rAF / timers advance
 * ONLY when the harness calls clock.runFor. Playwright quantises runFor to
 * whole ms, so the driver steps 17,17,16 ms (mean 16.667 ms = 1/60 s). Every
 * sample is stamped with the page's own performance.now(); all derivatives use
 * those real stamps, not the nominal step.
 *
 * Camera: window.journey.hero.camera (journey/journey.js:1992 publishes
 * `hero: sceneApi`; main.js:953 sets window.sceneApi). Sampled in page after
 * each runFor, i.e. after that frame's render.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SCRATCH = '/tmp/claude-0/-home-user/62a00d20-ec8d-551d-aa8b-33233b07a42e/scratchpad';

// ---------------------------------------------------------------- args
function parseArgs(argv) {
  const o = { only: null, mobile: false, url: 'http://localhost:8137/?nointro=1',
    out: path.join(SCRATCH, 'captures/H1-motion'), filmstrip: 0, dsf: null, maxSec: 25 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--only') o.only = argv[++i].split(',');
    else if (a === '--mobile') o.mobile = true;
    else if (a === '--url') o.url = argv[++i];
    else if (a === '--out') o.out = argv[++i];
    else if (a === '--filmstrip') o.filmstrip = +argv[++i];
    else if (a === '--dsf') o.dsf = +argv[++i];
    else if (a === '--max-sec') o.maxSec = +argv[++i];
    else if (a === '--viewport') { const [w, h] = argv[++i].split('x').map(Number); o.vw = w; o.vh = h; }
    else if (a === '--help') { console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0]); process.exit(0); }
  }
  if (o.dsf == null) o.dsf = 1;
  return o;
}

// Transitions. `to` is the rail chapter (data-chapter) or 'manifesto-open' /
// 'manifesto-close'. `record` is seconds captured from the action start
// (null = until motion settles, plus `tail` seconds).
const TRANSITIONS = {
  'intro-inspire':     { from: 'mission', to: 'inspire', tail: 1.0 },
  'inspire-intro':     { from: 'inspire', to: 'mission', tail: 1.0 },
  'inspire-equip':     { from: 'inspire', to: 'equip', tail: 1.0 },
  'equip-intro':       { from: 'equip', to: 'mission', tail: 1.0 },
  'connect-intro':     { from: 'connect', to: 'mission', tail: 1.0 },
  'intro-equip':       { from: 'mission', to: 'equip', tail: 1.0 },
  'intro-connect':     { from: 'mission', to: 'connect', tail: 1.0 },
  'equip-inspire':     { from: 'equip', to: 'inspire', tail: 1.0 },
  'equip-connect':     { from: 'equip', to: 'connect', tail: 1.0 },
  'connect-purpose':   { from: 'connect', to: 'final', tail: 1.0 },
  'purpose-intro':     { from: 'final', to: 'mission', tail: 1.0 },
  'purpose-manifesto': { from: 'final', to: 'manifesto-open', record: 8.0 },
  'manifesto-purpose': { from: 'manifesto', to: 'manifesto-close', tail: 2.0, cap: 20 },
};
const DESKTOP_ORDER = Object.keys(TRANSITIONS);
const MOBILE_ORDER = ['connect-purpose', 'purpose-manifesto', 'manifesto-purpose'];

// Chapter copy heading text used to find each chapter's DOM .j-block.
const HEADING = { inspire: 'Inspire', equip: 'Equip', connect: 'Connect', owned: 'Owned by', final: 'open source' };

// ---------------------------------------------------------------- page side
// ---------------------------------------------------------------- helpers

async function main() {
  const opt = parseArgs(process.argv.slice(2));
  const order = opt.only || (opt.mobile ? MOBILE_ORDER : DESKTOP_ORDER);
  const tag = opt.mobile ? 'mobile' : 'desktop';
  const outDir = path.join(opt.out, tag);
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctxOpts = opt.mobile
    ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: opt.dsf }
    : { viewport: { width: opt.vw || 1440, height: opt.vh || 900 }, deviceScaleFactor: opt.dsf };
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error('[pageerror]', String(e).slice(0, 300)));

  // ---- fake clock, paused: time moves only via runFor
  // Playwright fake clock, paused: rAF and performance.now advance only on clock.runFor.
  await page.clock.install({ time: 0 });
  await page.clock.pauseAt(1000);
  // Instrumentation: count rAF callbacks the page actually runs, and the timestamp each got.
  await page.addInitScript(() => {
    const raw = window.requestAnimationFrame.bind(window);
    window.__raf = { n: 0, ts: 0 };
    window.requestAnimationFrame = (cb) => raw((t) => { window.__raf.n++; window.__raf.ts = t; cb(t); });
  });
  await page.goto(opt.url, { waitUntil: 'load', timeout: 120000 });

  let stepIdx = 0;
  // watchdog: a hung CDP call under host contention is reported, not waited on forever
  const guard = (label, p, ms = 240000) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(`watchdog: ${label} > ${ms} ms`)), ms))]);
  // One frame = one clock.runFor(16) step. Playwright fires rAF on a fixed 16 ms grid, so a
  // 16 ms step fires exactly one rAF callback per frame (verified: raf_fires column). A 16.67 ms
  // nominal step lands on two grid points on ~1 frame in 3 and double-advances the camera
  // (measured: 16 of 360 frames had 2 fires in intro-inspire). Frame rate here is therefore
  // 62.5 Hz, not 60 Hz; all derivatives use the page's performance.now stamps.
  const STEP_MS = [16];
  const step = async () => {
    await guard('runFor', page.clock.runFor(STEP_MS[stepIdx++ % STEP_MS.length]));
  };
  // boot pump: real time to let modules/fetches land, fake frames to run the boot
  for (let n = 0; n < 6000; n++) {
    const ready = await guard('boot-eval', page.evaluate(() => !!(window.journey && window.journey.hero && window.journey.hero.camera
      && window.journey.scroll && window.journey.scroll.enabled)).catch(() => false));
    if (ready) break;
    await step();
    await new Promise((r) => setTimeout(r, 150));   // real time for the boot's own fetches/modules
    if (n % 5 === 0) console.error(`[boot] step ${n} t=${Date.now() % 100000}`);
  }
  // a short rest at boot so the intro copy has landed before the first capture
  for (let n = 0; n < 60; n++) await step();
  const cursorSig = await page.evaluate(() => performance.now());
  console.log(`[boot] ready; fake now=${cursorSig}ms; ${stepIdx} fake steps`);

  // Chapter heading map for copy sampling
  const headingOf = HEADING;
  const sample = () => guard('sample', page.evaluate(({ headingOf }) => {
    const J = window.journey;
    const cam = J.hero.camera;
    cam.updateMatrixWorld();
    const e = cam.matrixWorld.elements;
    const blocks = [...document.querySelectorAll('.j-block')];
    const blockFor = (id) => {
      const want = headingOf[id]; if (!want) return null;
      return blocks.find((b) => (b.querySelector('.j-h')?.textContent || '').includes(want)) || null;
    };
    const op = (node) => node ? +getComputedStyle(node).opacity : NaN;
    const copy = {};
    for (const id of Object.keys(headingOf)) {
      const b = blockFor(id);
      copy[id] = b ? [op(b), op(b.querySelector('.j-h')), op(b.querySelector('.j-sub'))] : [NaN, NaN, NaN];
    }
    const mp = document.querySelector('.j-manifesto-panel');
    const mi = document.querySelector('.j-rail-manifesto-item');
    return {
      t: performance.now(), p: J.p, travel: J.travelP, rafN: window.__raf ? window.__raf.n : NaN, rafTs: window.__raf ? window.__raf.ts : NaN,
      x: cam.position.x, y: cam.position.y, z: cam.position.z,
      rot: [e[0], e[1], e[2], e[4], e[5], e[6], e[8], e[9], e[10]],
      fwd: [-e[8], -e[9], -e[10]], up: [e[4], e[5], e[6]],
      fov: cam.fov,
      manifestoOpen: !!(mi && mi.getAttribute('aria-label') === 'Manifesto'),
      manifestoOp: op(mp),
      copy,
      hot: [...document.querySelectorAll('.j-hot')].map((h) => [h.getAttribute('aria-label') || h.textContent.trim().slice(0,20), +h.style.opacity || 0]),
    };
  }, { headingOf }));

  const clickRail = (id) => page.evaluate((id) => {
    const li = document.querySelector(`li.j-rail-slot[data-chapter="${id}"]`);
    if (!li) return 'no-li';
    const target = li.querySelector('.j-rail-item') || li;
    target.click();
    return 'clicked';
  }, id);
  const clickManifesto = () => page.evaluate(() => {
    const b = document.querySelector('.j-rail-manifesto-item');
    if (!b) return 'no-manifesto-item';
    b.click(); return 'clicked';
  });
  const clickTo = (to) => (to.startsWith('manifesto-') ? clickManifesto() : clickRail(to));

  // Frame loop. Records to `rows` only while `rec` is true.
  const rows = [];
  let rec = false;
  let frameSeq = 0;
  let shotDir = null;
  const frameOnce = async (action = '') => {
    await step();
    frameSeq++;
    if (frameSeq % 60 === 0) console.error(`[progress] frame ${frameSeq} rows=${rows.length} action=${action}`);
    const s = await sample();
    if (rec) {
      s.frame = frameSeq; s.action = action; rows.push(s);
      if (opt.filmstrip && shotDir && (rows.length - 1) % opt.filmstrip === 0) {
        await page.screenshot({ path: path.join(shotDir, `f${String(rows.length - 1).padStart(4, '0')}.png`) }).catch((e) => console.error('[shot]', e.message));
      }
    }
    return s;
  };
  // settled: camera position, orientation and progress change by less than a tolerance
  // between consecutive frames (exact equality never holds because of sub-1e-7 easing tails)
  // camera stillness: position and orientation change < 1e-5 per 16 ms frame
    const isStill = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.z - b.z) < 1e-5
    && a.rot.every((v, i) => Math.abs(v - b.rot[i]) < 1e-5);
  // progress p is NOT part of stillness: journey.p creeps ~1e-5 per frame at rest (measured)
  // settled = camera and progress unchanged for 20 consecutive frames
  const settle = async (maxFrames = 600) => {
    let still = 0, last = null;
    for (let i = 0; i < maxFrames; i++) {
      const s = await frameOnce('settle');
      if (last && isStill(last, s)) still++; else still = 0;
      last = s;
      if (still >= 20) return i;
    }
    return maxFrames;
  };

  // Track current rail location (for setup)
  let cur = 'mission';
  const manifestoOpenNow = async () => (await sample()).manifestoOpen;
  const ensureAt = async (target) => {
    if (target === 'manifesto') {
      if (await manifestoOpenNow()) return;
      await ensureAt('final');
      await clickManifesto(); await settle(); cur = 'manifesto';
      return;
    }
    if (cur === target) return;
    if (await manifestoOpenNow()) { await clickManifesto(); await settle(); }
    clickRail(target); await settle(); cur = target;
  };

  const summary = [];
  for (const name of order) {
    const T = TRANSITIONS[name];
    if (!T) { console.error('unknown transition', name); continue; }
    const t0wall = Date.now();
    await ensureAt(T.from === 'manifesto' ? 'manifesto' : T.from);
    // Capture window
    rows.length = 0;
    shotDir = opt.filmstrip ? path.join(outDir, name + '-frames') : null;
    if (shotDir) fs.mkdirSync(shotDir, { recursive: true });
    rec = true;
    const act = T.to === 'manifesto-open' ? 'open' : T.to === 'manifesto-close' ? 'close' : 'nav';
    // the action happens at the first recorded frame's START
    const pre = await sample();
    rows.push({ ...pre, frame: frameSeq, action: 'pre' });
    const res = await clickTo(T.to);
    if (res !== 'clicked') console.error(`[${name}] click: ${res}`);
    const cap = T.record ? Math.round(T.record * 60) : Math.round((T.cap || opt.maxSec) * 60);
    console.error(`[${name}] start (cap ${cap} frames)`);
    let stillN = 0, last = null;
    for (let i = 0; i < cap; i++) {
      const s = await frameOnce(act);
      if (!T.record) {
        if (last && isStill(last, s)) stillN++; else stillN = 0;
        last = s;
        if (stillN >= 20) {
          // settled: keep `tail` seconds more
          const tailN = Math.round(T.tail * 60);
          for (let j = 0; j < tailN; j++) await frameOnce('tail');
          break;
        }
      }
    }
    rec = false;
    if (T.to === 'manifesto-open') { cur = 'manifesto'; }
    else if (T.to.startsWith('manifesto-close')) { cur = 'final'; }
    else cur = T.to;

    const { analyze, writeOutputs } = require('./motion-analysis.js');
    const result = analyze(name, rows, { from: T.from, to: T.to });
    writeOutputs(outDir, name, rows, result, { mobile: opt.mobile, dsf: opt.dsf, filmstrip: opt.filmstrip, viewport: `${ctxOpts.viewport.width}x${ctxOpts.viewport.height}` });
    fs.writeFileSync(path.join(outDir, name + '.rows.json'), JSON.stringify(rows.map((r) => ({ t: r.t, x: r.x, y: r.y, z: r.z, copy: r.copy, hot: r.hot }))));
    summary.push(result.summary);
    console.log(`[${name}] frames=${rows.length} duration=${result.summary.durationMs?.toFixed(0)}ms peak=${result.summary.peakSpeedAt?.toFixed(0)}ms wall=${((Date.now() - t0wall) / 1000).toFixed(0)}s`);
    if (T.to === 'manifesto-open') await settle(900); // let the manifesto finish opening before the return
  }
  fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));
  await browser.close();
}

main().catch((e) => { console.error('FAIL', e); process.exit(1); });
