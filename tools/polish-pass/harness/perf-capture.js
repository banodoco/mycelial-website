// perf-capture.js — H2-perf event-timeline harness for the Mycelial site.
// Usage:  node perf-capture.js <session>      session in: desktop-intro | desktop-nointro | mobile
//         BASE=http://localhost:8137/ (default). OUT dir defaults to SCRATCH/captures/H2-perf.
// Real time only (no fake clock): the manifesto advances with wall-clock dt (journey/manifesto/branch.js:852),
// and the question is what work happens when, not fps.
// Output: <OUT>/<session>.json  { meta, marks, frames[], events[], longtasks[], loaf[], resources[], fetches[], workers[], decodes[], phaseStats }
'use strict';
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const SESSION = process.argv[2] || 'desktop-intro';
const BASE = process.env.BASE || 'http://localhost:8137/';
const OUT = process.env.OUT || '/tmp/claude-0/-home-user/62a00d20-ec8d-551d-aa8b-33233b07a42e/scratchpad/captures/H2-perf';
const CHROME_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];

/* ------------------------------------------------------------------------ *
 * IN-PAGE INSTRUMENTATION. Runs via addInitScript before any site code.
 * Must be self-contained (serialised with toString()).
 * ------------------------------------------------------------------------ */
function installPerf() {
  if (window.__perf) return;
  Error.stackTraceLimit = 80; // V8 default is 10, which hides the site frames behind three.js internals
  const SITE_HINT = location.origin;
  const ACC = ['draws', 'verts', 'instances', 'vertsWork', 'bufCalls', 'bufBytes', 'texCalls', 'texBytes',
    'compiles', 'links', 'compileWaitMs', 'linkWaitMs', 'glSyncMs', 'readPix', 'getErr', 'fbCreate',
    'genMip', 'useProgram', 'bindFb', 'blit', 'programCreates', 'shaderCreates', 'parallelPolls'];
  const P = {
    t0: performance.now(), phase: 'boot', marks: [], frames: [], events: [], longtasks: [], loaf: [],
    resources: [], fetches: [], workers: [], decodes: [], contexts: [], stackCount: 0, stackBudget: 1500,
    _cur: null, _off: {}, _lastTs: null, _prevCam: '', _camChangeT: performance.now(), glCtx: null,
    _shaderSrc: new WeakMap(), _progShaders: new WeakMap(), _shaderTypes: new WeakMap(),
  };
  for (const k of ACC) P._off[k] = 0;
  window.__perf = P;
  const now = () => performance.now() - P.t0;
  const A = () => P._cur || P._off;

  P.mark = (name) => { P.phase = name; P.marks.push({ name, t: +now().toFixed(1), frame: P.frames.length }); };

  function stack() {
    const lines = (new Error().stack || '').split('\n').slice(1);
    const site = lines.filter(l => l.includes(SITE_HINT) && !/three(\.module)?(\.min)?\.js/.test(l));
    const pick = (site.length ? site : lines).filter(l => !l.includes('<anonymous>')).slice(0, 16).map(l => l.trim().replace(SITE_HINT, ''));
    return pick;
  }
  function ev(kind, ms, bytes, extra, wantStack) {
    const e = Object.assign({ t: +now().toFixed(1), phase: P.phase, kind, ms: +(ms || 0).toFixed(3), bytes: bytes || 0 }, extra || {});
    if (wantStack && P.stackCount < P.stackBudget) { e.stack = stack(); P.stackCount++; }
    P.events.push(e);
  }
  function fnv(s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return ('00000000' + h.toString(16)).slice(-8); }
  function defines(src) { const out = []; const re = /^\s*#define\s+(\w+)/gm; let m; while ((m = re.exec(src)) && out.length < 40) out.push(m[1]); return out; }
  function bytesOf(d) { if (d == null) return 0; if (typeof d === 'number') return d; return d.byteLength || 0; }

  function wrap(proto, name, handler) {
    if (!proto || typeof proto[name] !== 'function' || proto[name].__perfWrapped) return;
    const orig = proto[name];
    const w = function () { return handler(orig, this, arguments); };
    w.__perfWrapped = true;
    proto[name] = w;
  }

  function installGL(proto) {
    const W = (n, h) => wrap(proto, n, h);
    const shaderInfo = (sh) => P._shaderSrc.get(sh) || { hash: '?', head: '', defines: [], len: 0 };

    W('createShader', (o, self, a) => { A().shaderCreates++; const sh = o.apply(self, a); P._shaderTypes.set(sh, a[0]); return sh; });
    W('createProgram', (o, self, a) => { A().programCreates++; return o.apply(self, a); });
    W('createFramebuffer', (o, self, a) => { A().fbCreate++; return o.apply(self, a); });
    W('bindFramebuffer', (o, self, a) => { A().bindFb++; return o.apply(self, a); });
    W('useProgram', (o, self, a) => { A().useProgram++; return o.apply(self, a); });
    W('blitFramebuffer', (o, self, a) => { A().blit++; return o.apply(self, a); });
    W('generateMipmap', (o, self, a) => { A().genMip++; return o.apply(self, a); });
    W('getError', (o, self, a) => { const t = performance.now(); const r = o.apply(self, a); A().getErr++; A().glSyncMs += performance.now() - t; if (r !== 0) ev('glError', 0, 0, { code: r }, true); return r; });
    W('shaderSource', (o, self, a) => {
      const src = String(a[1]);
      P._shaderSrc.set(a[0], { hash: fnv(src), head: src.slice(0, 200), defines: defines(src), len: src.length });
      return o.apply(self, a);
    });
    W('attachShader', (o, self, a) => {
      const list = P._progShaders.get(a[0]) || []; list.push(a[1]); P._progShaders.set(a[0], list);
      return o.apply(self, a);
    });
    W('compileShader', (o, self, a) => {
      const info = shaderInfo(a[0]);
      A().compiles++;
      const t = performance.now(); const r = o.apply(self, a); const ms = performance.now() - t;
      ev('compileShader', ms, info.len, { hash: info.hash, head: info.head, defines: info.defines, type: P._shaderTypes.get(a[0]) === 0x8B31 ? 'VERTEX' : 'FRAGMENT' }, true);
      return r;
    });
    W('linkProgram', (o, self, a) => {
      A().links++;
      const shs = (P._progShaders.get(a[0]) || []).map(s => { const i = shaderInfo(s); return { hash: i.hash, head: i.head.split('\n').slice(0, 2).join(' | '), defines: i.defines }; });
      const t = performance.now(); const r = o.apply(self, a); const ms = performance.now() - t;
      ev('linkProgram', ms, 0, { shaders: shs }, true);
      return r;
    });
    W('getShaderParameter', (o, self, a) => {
      const t = performance.now(); const r = o.apply(self, a); const ms = performance.now() - t;
      A().glSyncMs += ms;
      if (a[1] === 0x8B81) { A().compileWaitMs += ms; if (ms > 1) { const i = shaderInfo(a[0]); ev('compileWait', ms, i.len, { hash: i.hash, head: i.head.slice(0, 120) }, ms > 4); } }
      return r;
    });
    W('getProgramParameter', (o, self, a) => {
      const t = performance.now(); const r = o.apply(self, a); const ms = performance.now() - t;
      A().glSyncMs += ms;
      if (a[1] === 0x8B82) { A().linkWaitMs += ms; if (ms > 1) ev('linkWait', ms, 0, {}, ms > 4); }
      if (a[1] === 0x91B1) A().parallelPolls++;
      return r;
    });
    const upload = (kind, bytes, dims, extra, o, self, a) => {
      A().texCalls++; A().texBytes += bytes;
      const t = performance.now(); const r = o.apply(self, a); const ms = performance.now() - t;
      A().glSyncMs += ms;
      if (bytes >= 262144 || ms > 4) ev(kind, ms, bytes, Object.assign({ dims }, extra || {}), true);
      return r;
    };
    const srcDims = (s) => s ? { w: s.videoWidth || s.displayWidth || s.naturalWidth || s.width || 0, h: s.videoHeight || s.displayHeight || s.naturalHeight || s.height || 0, src: s.constructor && s.constructor.name } : { w: 0, h: 0 };
    W('texImage2D', (o, self, a) => {
      let w, h, bytes, dims;
      if (a.length >= 9) { w = a[3]; h = a[4]; const px = a[8]; bytes = (px && px.byteLength) ? px.byteLength : w * h * 4; dims = { w, h }; }
      else { dims = srcDims(a[a.length - 1]); bytes = dims.w * dims.h * 4; }
      return upload('texImage2D', bytes, dims, { target: a[0], level: a[1], ifmt: a[2] }, o, self, a);
    });
    W('texSubImage2D', (o, self, a) => {
      let dims, bytes;
      if (a.length >= 9) { dims = { w: a[4], h: a[5] }; const px = a[8]; bytes = (px && px.byteLength) ? px.byteLength : a[4] * a[5] * 4; }
      else { dims = srcDims(a[a.length - 1]); bytes = dims.w * dims.h * 4; }
      return upload('texSubImage2D', bytes, dims, { target: a[0], level: a[1] }, o, self, a);
    });
    W('texStorage2D', (o, self, a) => upload('texStorage2D', Math.round(a[3] * a[4] * 4 * 1.33), { w: a[3], h: a[4] }, { levels: a[1], ifmt: a[2] }, o, self, a));
    W('texStorage3D', (o, self, a) => upload('texStorage3D', a[3] * a[4] * a[5] * 4, { w: a[3], h: a[4], d: a[5] }, { levels: a[1], ifmt: a[2] }, o, self, a));
    W('texImage3D', (o, self, a) => upload('texImage3D', (a[9] && a[9].byteLength) || a[3] * a[4] * a[5] * 4, { w: a[3], h: a[4], d: a[5] }, { ifmt: a[2] }, o, self, a));
    const bufferOp = (kind, o, self, a, data) => {
      const bytes = bytesOf(data);
      A().bufCalls++; A().bufBytes += bytes;
      const t = performance.now(); const r = o.apply(self, a); const ms = performance.now() - t;
      A().glSyncMs += ms;
      if (bytes >= 262144 || ms > 4) ev(kind, ms, bytes, { target: a[0], usage: a[2] }, true);
      return r;
    };
    W('bufferData', (o, self, a) => bufferOp('bufferData', o, self, a, a[1]));
    W('bufferSubData', (o, self, a) => bufferOp('bufferSubData', o, self, a, a[2]));
    const drawAcc = (count, inst) => { const x = A(); x.draws++; x.verts += count; x.instances += inst; x.vertsWork += count * inst; };
    W('drawArrays', (o, self, a) => { drawAcc(a[2], 1); return o.apply(self, a); });
    W('drawElements', (o, self, a) => { drawAcc(a[1], 1); return o.apply(self, a); });
    W('drawArraysInstanced', (o, self, a) => { drawAcc(a[2], a[3]); return o.apply(self, a); });
    W('drawElementsInstanced', (o, self, a) => { drawAcc(a[1], a[4]); return o.apply(self, a); });
    W('drawRangeElements', (o, self, a) => { drawAcc(a[3], 1); return o.apply(self, a); });
    W('readPixels', (o, self, a) => {
      const t = performance.now(); const r = o.apply(self, a); const ms = performance.now() - t;
      A().readPix++; A().glSyncMs += ms;
      ev('readPixels', ms, (a[2] || 0) * (a[3] || 0) * 4, { w: a[2], h: a[3] }, ms > 4);
      return r;
    });
  }
  // Install on both context flavours (WebGL2 shadows WebGL1 prototypes; the wrap guard skips doubles).
  for (const C of [window.WebGL2RenderingContext, window.WebGLRenderingContext]) {
    if (C && C.prototype) installGL(C.prototype);
  }
  // Track which canvas/context the site uses and the attributes it asked for (antialias etc.).
  const gc = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (kind, attrs) {
    const ctx = gc.apply(this, arguments);
    if (ctx && /webgl/.test(kind)) {
      P.glCtx = ctx;
      P.contexts.push({ t: +now().toFixed(1), kind, attrs: attrs || null, id: this.id || this.className || 'canvas', cw: this.width, ch: this.height });
    }
    return ctx;
  };

  // rAF: per-frame accumulation, JS time per callback, frame gap, heap, camera signature.
  const rawRAF = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = function (cb) {
    return rawRAF(function (ts) {
      if (ts !== P._lastTs) {
        const t = now();
        const prev = P.frames[P.frames.length - 1];
        if (prev) prev.done = true;
        const rec = {
          i: P.frames.length, ts: +ts.toFixed(2), t: +t.toFixed(2), phase: P.phase,
          gap: P._lastTs === null ? null : +(ts - P._lastTs).toFixed(2), jsMs: 0, ncb: 0,
          heap: performance.memory ? performance.memory.usedJSHeapSize : null,
          dpr: window.devicePixelRatio, dbw: P.glCtx ? P.glCtx.drawingBufferWidth : null, dbh: P.glCtx ? P.glCtx.drawingBufferHeight : null,
        };
        for (const k of ACC) { rec[k] = P._off[k]; P._off[k] = 0; }
        rec.glSyncMs = +(P._off.glSyncMs || 0).toFixed(3);
        // camera signature (sceneApi exposed by main.js) + pixel ratio the renderer actually uses
        const sa = window.sceneApi;
        if (sa && sa.camera) {
          const c = sa.camera, p = c.position, q = c.quaternion;
          const sig = [p.x, p.y, p.z, q.x, q.y, q.z, q.w].map(v => v.toFixed(5)).join(',');
          rec.cam = [p.x, p.y, p.z].map(v => +v.toFixed(3));
          const rl = document.querySelector('.j-rail'); const sig2 = sig + '|' + (rl ? rl.className : '');
          if (sig2 !== P._prevCam) { P._camChangeT = performance.now(); P._camChangeFrame = P.nFrames || 0; P._prevCam = sig2; }
        }
        rec.pr = (sa && sa.renderer && sa.renderer.getPixelRatio) ? sa.renderer.getPixelRatio() : null;
        rec.chapter = window.journey ? window.journey.chapter : null;
        P.frames.push(rec); P.nFrames = (P.nFrames || 0) + 1;
        P._cur = rec;
        P._lastTs = ts;
      }
      const s = performance.now();
      try { return cb(ts); }
      finally { const rec = P._cur; if (rec) { rec.jsMs += performance.now() - s; rec.ncb++; } }
    });
  };

  // Long tasks and long-animation-frames (where the browser supports them).
  const obs = (type, sink, extra) => {
    try {
      new PerformanceObserver(list => {
        for (const e of list.getEntries()) sink.push(extra(e));
      }).observe({ type, buffered: true });
    } catch (_) { /* unsupported */ }
  };
  obs('longtask', P.longtasks, e => ({ start: +e.startTime.toFixed(1), dur: +e.duration.toFixed(1), phaseAtObserve: P.phase,
    attr: (e.attribution || []).map(a => a.containerSrc || a.containerName || a.name) }));
  obs('long-animation-frame', P.loaf, e => ({ start: +e.startTime.toFixed(1), dur: +e.duration.toFixed(1), blocking: +(e.blockingDuration || 0).toFixed(1),
    scripts: (e.scripts || []).slice(0, 6).map(s => ({ src: (s.sourceURL || '').replace(SITE_HINT, ''), fn: s.sourceFunctionName, invoker: s.invoker, dur: +s.duration.toFixed(1) })) }));
  obs('resource', P.resources, e => ({ name: e.name.replace(SITE_HINT, ''), type: e.initiatorType, start: +e.startTime.toFixed(1),
    end: +e.responseEnd.toFixed(1), dur: +e.duration.toFixed(1), transfer: e.transferSize, decoded: e.decodedBodySize }));

  // Workers, fetches, bitmap/image decodes.
  const RW = window.Worker;
  if (RW) window.Worker = function (url, opts) {
    P.workers.push({ t: +now().toFixed(1), phase: P.phase, url: String(url).replace(SITE_HINT, ''), stack: stack() });
    return new RW(url, opts);
  };
  const F = window.fetch;
  window.fetch = function (input) {
    P.fetches.push({ t: +now().toFixed(1), phase: P.phase, url: String(input && input.url || input).replace(SITE_HINT, '') });
    return F.apply(this, arguments);
  };
  const CIB = window.createImageBitmap;
  if (CIB) window.createImageBitmap = function (src) {
    const t = performance.now();
    return CIB.apply(this, arguments).then(b => { P.decodes.push({ t: +now().toFixed(1), phase: P.phase, kind: 'bitmap', w: b.width, h: b.height, ms: +(performance.now() - t).toFixed(2) }); return b; });
  };
  const DEC = HTMLImageElement.prototype.decode;
  HTMLImageElement.prototype.decode = function () {
    const t = performance.now(); const src = this.currentSrc || this.src;
    return DEC.apply(this, arguments).then(r => { P.decodes.push({ t: +now().toFixed(1), phase: P.phase, kind: 'img', src: String(src).replace(SITE_HINT, ''), w: this.naturalWidth, h: this.naturalHeight, ms: +(performance.now() - t).toFixed(2) }); return r; });
  };

  // Drain: hand back finished frames only (the last frame is still being written).
  P.drain = () => {
    const frames = []; while (P.frames.length > 1) frames.push(P.frames.shift());
    const take = (k) => P[k].splice(0, P[k].length);
    return { frames, events: take('events'), longtasks: take('longtasks'), loaf: take('loaf'), resources: take('resources'),
      fetches: take('fetches'), workers: take('workers'), decodes: take('decodes'), contexts: P.contexts.slice(), marks: P.marks.slice() };
  };
  P.finish = () => { const out = P.drain(); out.frames.push(...P.frames.splice(0)); return out; };
  // Real-time stillness predicate for the harness: ms since the camera last moved.
  P.stillFor = (ms) => performance.now() - P._camChangeT >= ms;
  // Frame-count stillness: camera AND rail class signature unchanged for n rendered frames.
  P.stillFrames = (n) => (P.nFrames || 0) - (P._camChangeFrame || 0) >= n;
  P.nFramesNow = () => P.nFrames || 0;
  P.heapNow = () => performance.memory ? performance.memory.usedJSHeapSize : null;
}

/* ------------------------------------------------------------------------ *
 * NODE SIDE: drives the page through phases and collects the data.
 * ------------------------------------------------------------------------ */
const DESKTOP = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 };
const MOBILE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' };

const SESSIONS = {
  'desktop-intro': { ctx: DESKTOP, url: BASE, mobile: false, seq: ['inspire', 'equip', 'inspire', 'equip', 'connect', 'final'], manifesto: true, back: 'mission' },
  'desktop-nointro': { ctx: DESKTOP, url: BASE + '?nointro=1', mobile: false, seq: ['connect', 'final'], manifesto: true, back: null },
  'mobile': { ctx: MOBILE, url: BASE, mobile: true, seq: ['connect', 'final'], manifesto: true, back: 'mission' },
};

const cfg = SESSIONS[SESSION];
if (!cfg) { console.error('unknown session ' + SESSION); process.exit(2); }
const SETTLE_MS = 5000;
const phaseLog = [];
const store = { meta: { session: SESSION, url: cfg.url, viewport: cfg.ctx.viewport, dpr: cfg.ctx.deviceScaleFactor, clock: 'real time (performance.now / rAF)', startedAt: new Date().toISOString(), gl: 'swiftshader (software)' },
  marks: [], frames: [], events: [], longtasks: [], loaf: [], resources: [], fetches: [], workers: [], decodes: [], contexts: [], phases: [] };

async function drainInto(page) {
  const d = await page.evaluate(() => window.__perf && window.__perf.drain());
  if (!d) return;
  for (const k of ['frames', 'events', 'longtasks', 'loaf', 'resources', 'fetches', 'workers', 'decodes', 'contexts']) store[k].push(...d[k]);
  store.marks = d.marks; // full list is kept in-page; keep the latest snapshot
}

// Phase bookkeeping: each phase is named, marked in-page, and records how it decided it was done.
async function phase(page, name, fn, decidedBy) {
  const wall0 = Date.now();
  await page.evaluate(n => window.__perf.mark(n), name);
  const r = await fn();
  const ph = { name, wallMs: Date.now() - wall0, endedBy: decidedBy || (r && r.endedBy) || 'fn' };
  if (r && r.note) ph.note = r.note;
  store.phases.push(ph);
  console.log(`[${SESSION}] ${name} done in ${(ph.wallMs / 1000).toFixed(1)}s (${ph.endedBy}${ph.note ? '; ' + ph.note : ''})`);
  await drainInto(page);
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, SESSION + '.json'), JSON.stringify(store));
  return r;
}

// Wait until the page's own state says the phase is over: chapter reached and camera still for `still` ms.
// Frames must be rendered AFTER the action (>= minFrames rAF callbacks since f0), otherwise a stale
// camera timestamp from before the click reads as "still".
async function waitChapterSettled(page, chapter, { stillN = 4, minFrames = 10, minMs = 1500, timeout = 900000, f0 = 0 } = {}) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const st = await page.evaluate(([c, n]) => {
      const j = window.journey;
      return { chapter: j ? j.chapter : null, still: window.__perf ? window.__perf.stillFrames(n) : false, frames: window.__perf ? window.__perf.nFramesNow() : 0 };
    }, [chapter, stillN]);
    if (st.chapter === chapter && st.still && st.frames - f0 >= minFrames && Date.now() - t0 >= minMs)
      return { endedBy: `chapter=${chapter} && >=${minFrames} rAF frames after action && camera+rail unchanged for ${stillN} frames`, note: `${((Date.now() - t0) / 1000).toFixed(1)}s, ${st.frames - f0} frames` };
    await new Promise(r => setTimeout(r, 400));
  }
  return { endedBy: `TIMEOUT ${timeout} ms waiting for chapter=${chapter}`, note: 'timeout' };
}

async function clickRail(page, chapter) {
  const sel = `.j-rail .j-rail-slot[data-chapter="${chapter}"] .j-rail-item`;
  const loc = page.locator(sel).first();
  if (cfg.mobile) await loc.tap({ timeout: 60000, force: true }); else await loc.click({ timeout: 60000, force: true });
}

async function driveManifestoScroll(page) {
  // Mobile (<=720px): the manifesto is a scroll-reading column (branch.js:570-572, class is-scroll-reading).
  // The column only becomes scrollable once admitted lines grow, so we keep trying until the timeline is
  // also still. Done = column at bottom (or not scrollable) AND camera+rail unchanged for 6 frames, cap 900 s.
  const t0 = Date.now();
  let moved = 0;
  while (Date.now() - t0 < 900000) {
    const st = await page.evaluate(() => {
      const L = document.querySelector('.j-manifesto-lines');
      const root = document.querySelector('.j-manifesto');
      const scrollable = !!L && (L.scrollHeight - L.clientHeight) > 2;
      if (L && scrollable && root && root.classList.contains('is-scroll-reading')) L.scrollTop += 60; // scroll events are what the site listens to
      return { reading: !!root && root.classList.contains('is-scroll-reading'), scrollable,
        atEnd: !!L && (L.scrollTop >= L.scrollHeight - L.clientHeight - 2),
        still: window.__perf.stillFrames(6), lines: document.querySelectorAll('.j-manifesto-line:not([hidden])').length };
    });
    if (st.reading && st.atEnd && st.still) return { endedBy: 'column at end && camera+rail unchanged 6 frames', note: `${((Date.now() - t0) / 1000).toFixed(1)}s, reading=${st.reading}` };
    if (st.scrollable) moved++;
    await new Promise(r => setTimeout(r, 1000));
  }
  return { endedBy: 'TIMEOUT 900 s cap (manifesto not finished)', note: 'column scrolled ' + moved + ' ticks' };
}

(async () => {
  const browser = await chromium.launch({ args: CHROME_ARGS, headless: true });
  const context = await browser.newContext({ ...cfg.ctx, ignoreHTTPSErrors: true });
  await context.addInitScript(installPerf);
  const page = await context.newPage();
  page.setDefaultTimeout(120000);
  page.on('pageerror', e => console.log('[pageerror]', e.message.slice(0, 200)));
  page.on('crash', () => console.log('[PAGE CRASH] at', new Date().toISOString()));
  browser.on('disconnected', () => console.log('[BROWSER DISCONNECTED] at', new Date().toISOString()));

  // LOAD: real time until the live rail exists and the camera has been still for 3 s after boot.
  await phase(page, 'load', async () => {
    await page.goto(cfg.url, { waitUntil: 'load', timeout: 180000 });
    await page.evaluate(() => window.__perf.mark('load')).catch(() => {});
    const t0 = Date.now();
    await page.waitForFunction(() => !!document.querySelector('.j-rail:not(.j-rail-preboot)') && !!window.journey && window.__perf.stillFor(3000),
      null, { timeout: 420000, polling: 500 });
    return { endedBy: 'live rail present && window.journey && camera still 3 s', note: `${((Date.now() - t0) / 1000).toFixed(1)}s after goto` };
  });

  await phase(page, 'settle5s', async () => { await new Promise(r => setTimeout(r, SETTLE_MS)); return { endedBy: '5 s real idle' }; });

  if (cfg.seq) {
    for (const target of cfg.seq) {
      const name = `to-${target}`;
      await phase(page, name, async () => {
        const f0 = await page.evaluate(() => window.__perf.nFrames || 0);
        await clickRail(page, target);
        return await waitChapterSettled(page, target, { f0 });
      });
    }
  }

  if (cfg.manifesto) {
    await phase(page, 'open-manifesto', async () => {
      // Manifesto sits under Purpose; ensure the child item is reachable, then click it.
      await page.locator('.j-rail-manifesto-item').first().click({ timeout: 60000, force: true });
      // Manifesto is not a chapter (chapter derives from progress); its open state is body.j-manifesto-open (branch.js:686).
      await page.waitForFunction(() => document.body.classList.contains('j-manifesto-open'), null, { timeout: 900000, polling: 500 });
      return { endedBy: 'body.j-manifesto-open present' };
    });
    await phase(page, 'manifesto-ascent', async () => {
      if (cfg.mobile) return await driveManifestoScroll(page);
      // Desktop: auto-plays on wall-clock dt (branch.js update). Done when the camera has stopped and the
      // last line is revealed; cap 400 s.
      // Manifesto advances by WALL dt capped at 0.25 s per rendered frame (branch.js:852), so under software GL
      // its progress is frame-paced: stop when the camera has been still for 6 frames and all lines are admitted,
      // or at the 900 s cap (reported as TIMEOUT, with the progress reached).
      const t0 = Date.now();
      while (Date.now() - t0 < 900000) {
        const st = await page.evaluate(() => ({ still: window.__perf.stillFrames(6),
          lineDone: [...document.querySelectorAll('.j-manifesto-line')].every(l => !l.hidden), n: window.__perf.nFramesNow() }));
        if (st.still && st.lineDone && Date.now() - t0 > 8000) return { endedBy: 'camera+rail unchanged for 6 frames and all lines admitted', note: `${((Date.now() - t0) / 1000).toFixed(1)}s` };
        await new Promise(r => setTimeout(r, 1000));
      }
      return { endedBy: 'TIMEOUT 900 s cap (manifesto not finished)' };
    });
    await phase(page, 'manifesto-to-purpose', async () => {
      try { await clickRail(page, 'final'); } catch (e) { await page.keyboard.press('Escape'); }
      const t0 = Date.now();
      const f0 = await page.evaluate(() => window.__perf.nFrames || 0);
      await page.waitForFunction(() => !document.body.classList.contains('j-manifesto-open'), null, { timeout: 900000, polling: 1000 }).catch(() => {});
      const r = await waitChapterSettled(page, 'final', { f0 });
      return { endedBy: 'body.j-manifesto-open cleared, then ' + r.endedBy, note: `${((Date.now() - t0) / 1000).toFixed(1)}s` };
    });
    if (cfg.back) {
      await phase(page, 'purpose-to-intro', async () => {
        const f0 = await page.evaluate(() => window.__perf.nFrames || 0);
        await clickRail(page, cfg.back);
        return await waitChapterSettled(page, cfg.back, { f0 });
      });
    }
  }

  await drainInto(page);
  const fin = await page.evaluate(() => {
    const sa = window.sceneApi;
    return { rendererPixelRatio: sa && sa.renderer ? sa.renderer.getPixelRatio() : null,
      heap: window.__perf.heapNow(), dpr: window.devicePixelRatio, innerW: innerWidth, innerH: innerHeight };
  }).catch(e => ({ err: String(e).slice(0, 200) }));
  store.meta.final = fin;
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, SESSION + '.json'), JSON.stringify(store));
  console.log(`[${SESSION}] wrote ${path.join(OUT, SESSION + '.json')} frames=${store.frames.length} events=${store.events.length}`);
  await browser.close();
})().catch(async e => { console.error('HARNESS FAILED', e); process.exitCode = 1; });
