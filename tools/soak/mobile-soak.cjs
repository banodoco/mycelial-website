// NOT shipped: nothing imports it.
//
// MOBILE SOAK — the "it crashes after I click around a bunch" instrument.
// Drives a long scripted session on a phone viewport and, after every loop,
// records what a phone pays for and never gets back:
//   GL census      live textures/buffers/framebuffers/renderbuffers/programs/
//                  VAOs (create minus delete, wrapped on the WebGL2 prototype
//                  before the page loads) + estimated bytes, three's
//                  renderer.info.memory and programs.length
//   heap           JS heap after a forced GC (CDP HeapProfiler.collectGarbage)
//   DOM            nodes in the document, nodes alive (CDP Memory.getDOMCounters,
//                  so live-but-detached = alive - attached), JS listeners
//   scheduling     outstanding timeouts / intervals / rAF / idle callbacks,
//                  Workers, Intersection/Resize/Mutation observers
//   layers         proxy: running CSS/Web animations and will-change elements
//                  (CDP LayerTree reported no tree under headless SwiftShader)
//   rest work      over a REST_PROBE_MS window at rest, and again after
//                  IDLE_WAIT_MS with no input: rAF callbacks/s,
//                  draw calls per frame, composer renders/s, JS ms/s inside rAF
//
// Software GL (SwiftShader) is a few frames a second, so read COUNTS and
// BYTES, never milliseconds.
//
// Usage (server on :8137, `python3 serve.py`):
//   node tools/soak/mobile-soak.cjs [--loops 15] [--port 8137] [--query nointro=1]
//        [--out soak.json] [--lose-context] [--races] [--probe] [--dsf 2]
// --lose-context  after loop 1 and mid-flight in loop 2, loses and restores
//                 the WebGL context and checks the page still navigates
// --probe         boot, settle, take one sample (with the 12 largest GL
//                 allocations) and exit; --dsf sets the device pixel ratio
// --manifesto     instead of the loop: --loops full Manifesto ascents, each
//                 waited to its landing, sampled open and after Return
// --races         adds a rapid-input block to every loop (second destination
//                 mid-flight, Manifesto then Return at once, menu mid-flight,
//                 double taps)
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i < 0 ? d : argv[i + 1]; };
const LOOPS = +arg('--loops', 15);
const PORT = +arg('--port', 8137);
const QUERY = arg('--query', 'nointro=1');
const OUT = arg('--out', 'soak.json');
const LOSE = argv.includes('--lose-context');
const RACES = argv.includes('--races');
const PROBE = argv.includes('--probe'); // boot, settle, one sample, exit
const MANIFESTO = argv.includes('--manifesto'); // --loops full Manifesto ascents
const DSF = +arg('--dsf', 1);
const REST_PROBE_MS = 4000;
const MANIFESTO_PLAY_MS = 15000;
const IDLE_WAIT_MS = 10000;

/* ---------------- page-side instrumentation (runs before any page JS) ---- */
const INSTRUMENT = () => {
  const S = window.__soak = {
    gl: { tex: 0, buf: 0, fb: 0, rb: 0, prog: 0, sh: 0, vao: 0 },
    bytes: new Map(),           // object -> bytes
    kind: new WeakMap(),
    draws: 0, frames: 0, rafJsMs: 0,
    timeouts: new Map(), intervals: new Set(), raf: new Set(), idle: new Set(),
    observers: { IntersectionObserver: 0, ResizeObserver: 0, MutationObserver: 0, PerformanceObserver: 0 },
    workers: 0, workersLive: 0, contexts: 0,
  };
  const P = WebGL2RenderingContext.prototype;
  const bound = { tex: new Map(), buf: new Map(), rb: null, unit: 0 };
  const wrap = (name, fn) => { const o = P[name]; P[name] = function (...a) { return fn.call(this, o, a); }; };
  const kinds = [['Texture', 'tex'], ['Buffer', 'buf'], ['Framebuffer', 'fb'], ['Renderbuffer', 'rb'],
    ['Program', 'prog'], ['Shader', 'sh'], ['VertexArray', 'vao']];
  const live = new Set();
  for (const [K, k] of kinds) {
    wrap('create' + K, function (o, a) { const r = o.apply(this, a); if (r) { S.gl[k]++; live.add(r); S.kind.set(r, k); } return r; });
    wrap('delete' + K, function (o, a) { if (a[0] && live.has(a[0])) { live.delete(a[0]); S.gl[k]--; S.bytes.delete(a[0]); } return o.apply(this, a); });
  }
  const BPP = { 0x8058: 4, 0x881A: 8, 0x8814: 16, 0x8229: 1, 0x822B: 2, 0x8D62: 2, 0x81A5: 2, 0x81A6: 4, 0x88F0: 4, 0x8CAC: 4, 0x8C43: 4, 0x8051: 3, 0x822E: 4, 0x8230: 8, 0x822D: 2, 0x822F: 4, 0x8C3A: 4, 0x1908: 4, 0x1907: 3, 0x1909: 1, 0x190A: 2, 0x1906: 1 };
  const bpp = (fmt, type) => {
    let b = BPP[fmt] || 4;
    if (fmt === 0x1908 && type === 0x140B) b = 8; // RGBA/HALF_FLOAT (webgl1-style)
    if (fmt === 0x1908 && type === 0x1406) b = 16;
    return b;
  };
  wrap('activeTexture', function (o, a) { bound.unit = a[0]; return o.apply(this, a); });
  wrap('bindTexture', function (o, a) { bound.tex.set(bound.unit + ':' + a[0], a[1]); return o.apply(this, a); });
  const texOf = (target) => bound.tex.get(bound.unit + ':' + (target >= 0x8515 && target <= 0x851A ? 0x8513 : target));
  wrap('texStorage2D', function (o, a) {
    const [target, levels, fmt, w, h] = a; const t = texOf(target);
    if (t) S.bytes.set(t, w * h * bpp(fmt) * (levels > 1 ? 4 / 3 : 1) * (target === 0x8513 ? 6 : 1));
    return o.apply(this, a);
  });
  wrap('texStorage3D', function (o, a) {
    const [target, , fmt, w, h, d] = a; const t = texOf(target);
    if (t) S.bytes.set(t, w * h * d * bpp(fmt)); return o.apply(this, a);
  });
  wrap('texImage2D', function (o, a) {
    const target = a[0], level = a[1]; const t = texOf(target);
    if (t && level === 0) {
      let w, h, fmt = a[2], type;
      if (a.length >= 8) { w = a[3]; h = a[4]; type = a[7]; }
      else { const src = a[5]; w = src && (src.videoWidth || src.naturalWidth || src.width) || 0; h = src && (src.videoHeight || src.naturalHeight || src.height) || 0; type = a[4]; }
      const face = target >= 0x8515 && target <= 0x851A;
      const prev = face ? (S.bytes.get(t) || 0) : 0;
      S.bytes.set(t, prev + w * h * bpp(fmt, type));
    }
    return o.apply(this, a);
  });
  wrap('generateMipmap', function (o, a) { const t = texOf(a[0]); if (t && S.bytes.has(t)) S.bytes.set(t, S.bytes.get(t) * 4 / 3); return o.apply(this, a); });
  wrap('bindBuffer', function (o, a) { bound.buf.set(a[0], a[1]); return o.apply(this, a); });
  wrap('bufferData', function (o, a) {
    const b = bound.buf.get(a[0]);
    if (b) S.bytes.set(b, typeof a[1] === 'number' ? a[1] : (a[1] ? a[1].byteLength : 0));
    return o.apply(this, a);
  });
  wrap('bindRenderbuffer', function (o, a) { bound.rb = a[1]; return o.apply(this, a); });
  wrap('renderbufferStorage', function (o, a) { if (bound.rb) S.bytes.set(bound.rb, a[2] * a[3] * bpp(a[1])); return o.apply(this, a); });
  wrap('renderbufferStorageMultisample', function (o, a) { if (bound.rb) S.bytes.set(bound.rb, a[3] * a[4] * bpp(a[2]) * Math.max(1, a[1])); return o.apply(this, a); });
  for (const d of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced', 'drawRangeElements'])
    wrap(d, function (o, a) { S.draws++; return o.apply(this, a); });
  const gc = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (t, ...r) { const c = gc.call(this, t, ...r); if (c && /webgl/.test(t)) { if (!this.__soakCtx) { this.__soakCtx = 1; S.contexts++; } } return c; };

  // scheduling
  const sT = window.setTimeout, cT = window.clearTimeout, sI = window.setInterval, cI = window.clearInterval;
  window.setTimeout = function (fn, ms, ...r) {
    let id; const f = typeof fn === 'function' ? function () { S.timeouts.delete(id); return fn.apply(this, arguments); } : fn;
    id = sT.call(window, f, ms, ...r); S.timeouts.set(id, (new Error().stack || '').split('\n')[2] || ''); return id;
  };
  window.clearTimeout = function (id) { S.timeouts.delete(id); return cT.call(window, id); };
  window.setInterval = function (...a) { const id = sI.apply(window, a); S.intervals.add(id); return id; };
  window.clearInterval = function (id) { S.intervals.delete(id); return cI.call(window, id); };
  const rAF = window.requestAnimationFrame, cAF = window.cancelAnimationFrame;
  window.requestAnimationFrame = function (fn) {
    let id; id = rAF.call(window, (t) => {
      S.raf.delete(id); S.rafCalls = (S.rafCalls || 0) + 1;
      const t0 = performance.now(); try { return fn(t); } finally { S.rafJsMs += performance.now() - t0; }
    });
    S.raf.add(id); return id;
  };
  window.cancelAnimationFrame = function (id) { S.raf.delete(id); return cAF.call(window, id); };
  if (window.requestIdleCallback) {
    const rI = window.requestIdleCallback, cI2 = window.cancelIdleCallback;
    window.requestIdleCallback = function (fn, o) { let id; id = rI.call(window, (d) => { S.idle.delete(id); return fn(d); }, o); S.idle.add(id); return id; };
    window.cancelIdleCallback = function (id) { S.idle.delete(id); return cI2.call(window, id); };
  }
  for (const K of Object.keys(S.observers)) {
    const O = window[K]; if (!O) continue;
    window[K] = class extends O {
      constructor(...a) { super(...a); S.observers[K]++; this.__on = true; }
      disconnect() { if (this.__on) { this.__on = false; S.observers[K]--; } return super.disconnect(); }
    };
  }
  const W = window.Worker;
  window.Worker = class extends W {
    constructor(...a) { super(...a); S.workers++; S.workersLive++; this.__on = true; }
    terminate() { if (this.__on) { this.__on = false; S.workersLive--; } return super.terminate(); }
  };
  S.snapshot = () => {
    let bytes = 0; for (const v of S.bytes.values()) bytes += v;
    const r = window.sceneApi && window.sceneApi.renderer;
    const timeoutSites = {};
    for (const s of S.timeouts.values()) { const k = s.trim().replace(/^at\s+/, '').replace(/\?[^:)]*/, ''); timeoutSites[k] = (timeoutSites[k] || 0) + 1; }
    return {
      gl: { ...S.gl }, glMB: +(bytes / 1048576).toFixed(2),
      top: [...S.bytes.entries()].sort((x, y) => y[1] - x[1]).slice(0, 12).map(([o, b]) => `${S.kind.get(o)} ${(b / 1048576).toFixed(2)}MB`),
      three: r ? { ...r.info.memory, programs: r.info.programs ? r.info.programs.length : null } : null,
      pixelRatio: r ? r.getPixelRatio() : null,
      domAttached: (() => { let n = 1; const w = document.createTreeWalker(document, 0xFFFFFFFF); while (w.nextNode()) n++; return n; })(),
      elements: document.getElementsByTagName('*').length,
      animations: document.getAnimations ? document.getAnimations().length : null,
      timeouts: S.timeouts.size, intervals: S.intervals.size, raf: S.raf.size, idle: S.idle.size,
      timeoutSites, observers: { ...S.observers }, workers: S.workers, workersLive: S.workersLive, contexts: S.contexts,
      willChange: [...document.querySelectorAll('*')].filter(e => { const w = getComputedStyle(e).willChange; return w && w !== 'auto'; }).length,
      chapter: window.journey && window.journey.debugState().chapter,
      gates: { menu: (document.querySelector('.j-menu') || {}).className, scrim: (document.querySelector('.j-menu-scrim') || {}).className, hidden: document.hidden, frame: r && r.info.render.frame, lost: r && r.getContext().isContextLost() },
      // proxy for the warm queue's rest re-scan (a fresh walk of every chapter, no draws)
      warmWalkMs: (() => { if (!window.journey || !window.journey.warmReport) return null; const t = performance.now(); const r = window.journey.warmReport(); const ms = performance.now() - t; return { ms: +ms.toFixed(2), slices: r.slices, units: r.units, lastSkip: r.lastSkip }; })(),
    };
  };
};

/* ---------------- driver ------------------------------------------------- */
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-precise-memory-info', '--js-flags=--expose-gc'] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: DSF });
  await ctx.addInitScript(INSTRUMENT);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 200)); });
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('HeapProfiler.enable');

  const t0 = Date.now();
  const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s]`, ...a);
  await page.goto(`http://127.0.0.1:${PORT}/?${QUERY}`);
  await page.waitForFunction(() => window.journey && window.journey.ready !== false, null, { timeout: 180000 });

  const state = () => page.evaluate(() => ({ rest: window.journey.atRest, ...window.journey.debugState() }));
  const waitRest = async (label, timeout = 240000) => {
    const t = Date.now();
    await page.waitForFunction(() => window.journey && window.journey.atRest, null, { timeout, polling: 250 })
      .catch(() => log('  !! no rest after', label));
    return Date.now() - t;
  };
  const click = async (sel, nth = 0) => page.evaluate(([s, n]) => {
    const el = [...document.querySelectorAll(s)][n]; if (!el) return false; el.click(); return true;
  }, [sel, nth]);
  const tap = async (sel) => { // a real touch where the element is on screen, else click()
    const loc = page.locator(sel).first();
    try { if (await loc.isVisible()) { await loc.tap({ timeout: 3000, force: true }); return true; } } catch { /* fall through */ }
    return click(sel);
  };
  const go = async (ch) => { const ok = await tap(`a.j-rail-item[data-chapter="${ch}"]`) || await page.evaluate(c => { window.journey.flyTo(c); return true; }, ch); await waitRest(ch); return ok; };
  const visibleButtons = () => page.evaluate(() => [...document.querySelectorAll('button, a')].filter(e => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0.05; }).map(e => `${e.tagName}.${String(e.className).split(' ')[0]}|${(e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 30)}`));

  const sample = async (label) => {
    await cdp.send('HeapProfiler.collectGarbage');
    await cdp.send('HeapProfiler.collectGarbage');
    const heap = await cdp.send('Runtime.getHeapUsage');
    const dom = await cdp.send('Memory.getDOMCounters');
    const snap = await page.evaluate(() => window.__soak.snapshot());
    // rest work: rAF callbacks, composer frames, draws, JS ms inside rAF
    const w = await page.evaluate(async (ms) => {
      const S = window.__soak; const a = { draws: S.draws, raf: S.rafCalls || 0, js: S.rafJsMs };
      const t = performance.now(); await new Promise(r => setTimeout(r, ms)); const dt = (performance.now() - t) / 1000;
      return { rafPerS: +(((S.rafCalls || 0) - a.raf) / dt).toFixed(1), drawsPerS: +((S.draws - a.draws) / dt).toFixed(0), rafJsMsPerS: +((S.rafJsMs - a.js) / dt).toFixed(0), atRest: window.journey.atRest };
    }, REST_PROBE_MS);
    w.drawsPerRaf = w.rafPerS ? +(w.drawsPerS / w.rafPerS).toFixed(0) : 0;
    // idle: the same window after IDLE_WAIT_MS more with no input at all
    await sleep(IDLE_WAIT_MS);
    const idle = await page.evaluate(async (ms) => {
      const S = window.__soak; const a = { draws: S.draws, raf: S.rafCalls || 0 };
      const t = performance.now(); await new Promise(r => setTimeout(r, ms)); const dt = (performance.now() - t) / 1000;
      return { rafPerS: +(((S.rafCalls || 0) - a.raf) / dt).toFixed(1), drawsPerS: +((S.draws - a.draws) / dt).toFixed(0) };
    }, REST_PROBE_MS);
    w.idle = idle;
    const s = { label, t: Math.round((Date.now() - t0) / 1000), heapMB: +(heap.usedSize / 1048576).toFixed(2), nodesAlive: dom.nodes, detached: dom.nodes - snap.domAttached - 1, listeners: dom.jsEventListeners, documents: dom.documents, ...snap, rest: w, errors: errors.length };
    log(label, JSON.stringify({ heap: s.heapMB, gl: s.gl, glMB: s.glMB, three: s.three, nodes: s.domAttached, det: s.detached, lis: s.listeners, to: s.timeouts, iv: s.intervals, raf: s.raf, idle: s.idle, obs: s.observers, wk: s.workersLive, anim: s.animations, wc: s.willChange, pr: s.pixelRatio, rest: w }));
    return s;
  };

  const loseContext = async (label) => {
    const r = await page.evaluate(async () => {
      const gl = window.sceneApi.renderer.getContext(); const ext = gl.getExtension('WEBGL_lose_context');
      if (!ext) return { ok: false, why: 'no extension' };
      const c = window.sceneApi.renderer.domElement;
      let lost = false, restored = false;
      c.addEventListener('webglcontextlost', () => { lost = true; }, { once: true });
      c.addEventListener('webglcontextrestored', () => { restored = true; }, { once: true });
      ext.loseContext(); await new Promise(r => setTimeout(r, 800));
      ext.restoreContext(); await new Promise(r => setTimeout(r, 3000));
      return { ok: true, lost, restored, glError: gl.getError(), isLost: gl.isContextLost() };
    });
    log('  context loss', label, JSON.stringify(r));
    return r;
  };

  const samples = [await (async () => { await waitRest('boot'); await sleep(8000); return sample('boot'); })()];
  if (MANIFESTO) { // full ascents: press, wait for the landing, sample, Return, land, sample
    for (let i = 1; i <= LOOPS; i++) {
      await go('final');
      await tap('button.j-rail-manifesto-item'); await sleep(2000);
      const ms = await waitRest('manifesto ascent', 1800000);
      log(`  ascent ${i} landed after ${(ms / 1000).toFixed(0)} s`);
      samples.push(await sample(`manifesto${i}-open`));
      await page.evaluate(() => { const b = [...document.querySelectorAll('button, a')].find(e => /return/i.test((e.getAttribute('aria-label') || '') + e.textContent) && e.getBoundingClientRect().width > 0) || [...document.querySelectorAll('a.j-rail-item[data-chapter="final"]')].find(e => e.getBoundingClientRect().width > 0); if (b) b.click(); });
      await sleep(2000); await waitRest('manifesto return', 1800000);
      samples.push(await sample(`manifesto${i}-returned`));
      fs.writeFileSync(OUT, JSON.stringify({ samples, errors }, null, 1));
    }
    log('errors:', errors.length, errors.slice(0, 10).join(' || '));
    await browser.close(); return;
  }
  if (PROBE) { fs.writeFileSync(OUT, JSON.stringify({ samples, errors }, null, 1)); log('top allocations:', samples[0].top.join(', ')); await browser.close(); return; }
  const ctxLoss = [];
  let returnSel = null;
  for (let loop = 1; loop <= LOOPS; loop++) {
    const L = `loop${loop}`;
    try {
      for (const ch of ['inspire', 'equip', 'connect']) {
        await go(ch);
        // cards: open the first two visible chips in this chapter, then close
        for (let k = 0; k < 2; k++) {
          const opened = await page.evaluate(([c, k]) => { const v = [...document.querySelectorAll(`button.j-hot[data-chapter="${c}"]`)].filter(b => b.getBoundingClientRect().width > 0); const b = v[k]; if (!b) return false; b.click(); return b.dataset.node; }, [ch, k]);
          await sleep(2500);
          if (opened) { await click('button.j-card-x'); await sleep(800); }
        }
      }
      // menu open/close
      await tap('button.j-rail-menu'); await sleep(1500); await tap('button.j-menu-x'); await sleep(1000);
      await go('final');
      if (loop === 2 && LOSE) { // mid-flight loss: start a flight, lose, then land
        await page.evaluate(() => window.journey.flyTo('connect')); await sleep(1500);
        ctxLoss.push({ when: 'mid-flight', ...(await loseContext('mid-flight')) });
        await waitRest('after mid-flight loss'); await go('final');
      }
      // manifesto
      await tap('button.j-rail-manifesto-item'); await sleep(MANIFESTO_PLAY_MS);
      if (!returnSel) {
        const vb = await visibleButtons();
        log('  manifesto visible controls:', vb.join(' ; '));
      }
      const ret = await page.evaluate(() => {
        const cands = [...document.querySelectorAll('button, a')].filter(e => /return|back|close/i.test((e.getAttribute('aria-label') || '') + ' ' + e.textContent) && e.getBoundingClientRect().width > 0);
        const b = cands.find(e => /manifesto/i.test(e.className + e.closest('[class]').className)) || cands[0];
        if (!b) { const p = [...document.querySelectorAll('a.j-rail-item[data-chapter="final"], a.j-rail-purpose-parent')].find(e => e.getBoundingClientRect().width > 0); if (!p) return null; p.click(); return 'rail:' + p.className; }
        b.click(); return `${b.tagName}.${b.className}|${(b.getAttribute('aria-label') || b.textContent).trim().slice(0, 30)}`;
      });
      if (!returnSel) { returnSel = ret; log('  return control:', ret); }
      await waitRest('manifesto return');
      await go('owned');
      await click('button.j-hotzone'); await sleep(4000); // remix / re-deal
      await click('button.j-hotzone'); await sleep(4000);
      if (RACES) {
        await page.evaluate(() => window.journey.flyTo('inspire')); await sleep(700);
        await page.evaluate(() => window.journey.flyTo('connect')); await sleep(700);  // second destination mid-flight
        await tap('button.j-rail-menu'); await sleep(500); await tap('button.j-menu-x'); // menu mid-flight
        await waitRest('race 1');
        await go('final');
        await tap('button.j-rail-manifesto-item'); await sleep(300);
        await page.evaluate(() => { const b = [...document.querySelectorAll('button, a')].find(e => /return/i.test((e.getAttribute('aria-label') || '') + e.textContent) && e.getBoundingClientRect().width > 0) || [...document.querySelectorAll('a.j-rail-item[data-chapter="final"]')].find(e => e.getBoundingClientRect().width > 0); if (b) b.click(); });
        await waitRest('race 2 (manifesto then Return)');
        await page.evaluate(() => { const a = document.querySelector('a.j-rail-item[data-chapter="equip"]'); a.click(); a.click(); }); // double tap
        await waitRest('race 3 (double tap)');
      }
      await go('mission');
      await sleep(3000);
      const s = await sample(L);
      s.state = await state();
      samples.push(s);
      if (loop === 1 && LOSE) {
        ctxLoss.push({ when: 'at-rest', ...(await loseContext('at-rest')) });
        await go('inspire'); await go('mission');
        samples.push(await sample('after-rest-loss'));
      }
    } catch (e) {
      log('loop failed', L, e.message);
      samples.push({ label: L, failed: e.message });
    }
    fs.writeFileSync(OUT, JSON.stringify({ samples, ctxLoss, errors, returnSel }, null, 1));
  }
  // hidden tab: does the frame loop still pay?
  const hidden = await page.evaluate(async () => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
    const S = window.__soak; const a = { d: S.draws, r: S.rafCalls };
    await new Promise(r => setTimeout(r, 3000));
    const out = { rafPerS: (S.rafCalls - a.r) / 3, drawsPerS: (S.draws - a.d) / 3 };
    delete document.hidden; delete document.visibilityState; document.dispatchEvent(new Event('visibilitychange'));
    return out;
  });
  log('hidden (synthetic visibilitychange; real engines also stop rAF):', JSON.stringify(hidden));
  // menu covering the scene: does the scene still render?
  await tap('button.j-rail-menu'); await sleep(1500);
  const menu = await page.evaluate(async () => { const S = window.__soak; const a = { d: S.draws, r: S.rafCalls }; await new Promise(r => setTimeout(r, 3000)); return { rafPerS: (S.rafCalls - a.r) / 3, drawsPerS: (S.draws - a.d) / 3 }; });
  log('menu open:', JSON.stringify(menu));
  await tap('button.j-menu-x');
  fs.writeFileSync(OUT, JSON.stringify({ samples, ctxLoss, errors, returnSel, hidden, menu }, null, 1));
  log('errors:', errors.length, errors.slice(0, 10).join(' || '));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
