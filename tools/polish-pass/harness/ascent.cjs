// mperf: GL uploads + draw calls/vertices per frame through the manifesto ascent.
// Usage: node mperf-ascent.cjs <desktop|mobile> <port> <tag> [warp] [prewarm]
// Real clock, performance.now() warped by `warp` once the manifesto opens
// (branch.js steps wall time, capped 0.25 s a frame), so the 37.6 s flight
// takes ~150 SwiftShader frames. Counts/bytes are the evidence, not ms.
const { chromium } = require('playwright');
const fs = require('fs');
const mode = process.argv[2] || 'desktop';
const port = process.argv[3] || '8145';
const tag = process.argv[4] || 'run';
const warp = +(process.argv[5] || 4);
const restMs = +(process.argv[6] || 30000);
const OUT = '/tmp/claude-0/-home-user/62a00d20-ec8d-551d-aa8b-33233b07a42e/scratchpad/warmfix/out';
fs.mkdirSync(OUT, { recursive: true });

const INIT = () => {
  Error.stackTraceLimit = 40;
  const P = window.__m = { phase: 'boot', frames: [], ups: [], k: 1, vBase: 0, rBase: 0 };
  const rawNow = performance.now.bind(performance);
  performance.now = () => P.vBase + (rawNow() - P.rBase) * P.k;
  P.setWarp = (k) => { P.vBase = performance.now(); P.rBase = rawNow(); P.k = k; };
  let cur = { draws: 0, verts: 0, work: 0, up: 0, upN: 0 };
  for (const C of [WebGL2RenderingContext, WebGLRenderingContext]) {
    const p = C.prototype;
    const w = (name, f) => { const o = p[name]; if (!o || o.__m) return; p[name] = function (...a) { f(a); return o.apply(this, a); }; p[name].__m = 1; };
    const up = (kind, bytes) => { cur.up += bytes; cur.upN++; if (bytes >= 4096 && P.phase !== 'boot') P.ups.push({ phase: P.phase, f: P.frames.length, kind, bytes, stack: bytes >= 40000 ? (new Error().stack || '').split('\n').slice(2, 14).map(s => s.trim().replace(/https?:\/\/localhost:\d+\//, '')).join(' < ') : '' }); };
    w('bufferData', a => up('bufferData', (a[1] && a[1].byteLength) || (typeof a[1] === 'number' ? a[1] : 0)));
    w('bufferSubData', a => up('bufferSubData', (a[2] && a[2].byteLength) || 0));
    w('drawArrays', a => { cur.draws++; cur.verts += a[2]; cur.work += a[2]; });
    w('drawElements', a => { cur.draws++; cur.verts += a[1]; cur.work += a[1]; });
    w('drawArraysInstanced', a => { cur.draws++; cur.verts += a[2]; cur.work += a[2] * a[3]; });
    w('drawElementsInstanced', a => { cur.draws++; cur.verts += a[1]; cur.work += a[1] * a[4]; });
  }
  const raf = window.requestAnimationFrame.bind(window);
  let last = -1;
  window.requestAnimationFrame = cb => raf(ts => {
    if (ts !== last) {
      last = ts;
      const cam = window.journey && window.journey.hero && window.journey.hero.camera;
      P.frames.push({ phase: P.phase, t: performance.now(), y: cam ? +cam.position.y.toFixed(2) : null, ...cur });
      cur = { draws: 0, verts: 0, work: 0, up: 0, upN: 0 };
    }
    return cb(ts);
  });
};

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = mode === 'mobile'
    ? await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 })
    : await browser.newContext({ viewport: { width: 800, height: 500 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.addInitScript(INIT);
  page.on('pageerror', e => console.log('[pageerror]', e.message));
  page.on('console', m => { if (/error/i.test(m.type())) console.log('[page]', m.text().slice(0, 200)); });
  await page.goto(`http://localhost:${port}/?nointro=1&warmdraw=1`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.journey && window.journey.chapter, null, { timeout: 180000 });
  await page.waitForTimeout(8000);
  await page.evaluate(() => window.journey.flyTo('final'));
  // frame-counted, not timed: under load a SwiftShader frame can take >10 s
  const still = async (n, extra = 'true') => page.waitForFunction(([n, extra]) => {
    const f = window.__m.frames; if (f.length < n + 2) return false;
    const last = f.slice(-n); return eval(extra) && last.every(x => x.y === last[0].y);
  }, [n, extra], { timeout: 3600000, polling: 2000 });
  await page.waitForFunction(() => window.journey.chapter === 'final', null, { timeout: 600000 });
  await still(6);
  // the Purpose REST is recorded (the original left it in 'boot', unrecorded)
  // chapter === 'final' flips on the click frame and window.sceneApi is not
  // published (y reads null), so the original "rest" began mid-flight: wait
  // for the landing itself
  await page.waitForFunction(() => !window.journey.transitionSeconds && window.journey.atRest, null, { timeout: 1800000, polling: 500 });
  await page.evaluate(() => { window.__m.phase = 'rest'; });
  await page.waitForTimeout(restMs);
  const rest = await page.evaluate(() => {
    const w = window.journey.warmReport(); const c = globalThis[Symbol.for('mycelial.manifesto.aerialColony')];
    const ups = window.__m.ups.filter(u => u.phase === 'rest');
    return { restUpBytes: ups.reduce((s, u) => s + u.bytes, 0), restUpN: ups.length, restMax: Math.max(0, ...ups.map(u => u.bytes)),
      rest100k: ups.filter(u => u.bytes >= 100000).length,
      colony: c && c.warm, colonyOffGpu: c && c.group.children.filter(o => !(o.geometry._listeners?.dispose?.length)).length,
      queue: { slices: w.slices, units: w.units, longestUnit: w.longestUnit, warmed: w.warmed, lastSkip: w.lastSkip, tasks: w.tasks,
        final: w.chapters.final.missing, owned: w.chapters.owned.missing,
        slowUnits: w.log.filter(e => e.ms > 50).map(e => `${e.what} ${e.ms}ms`).slice(-10), taskLog: w.log.filter(e => /task:final/.test(e.what || '')).map(e => e.ms), tail: w.log.slice(-6), atRest: window.journey.atRest, restMs: w.restMs, ts: window.journey.transitionSeconds } };
  });
  console.log('rest', JSON.stringify(rest));
  await page.evaluate(() => { window.__m.phase = 'click'; window.__m.setWarp(1); });
  const t0 = await page.evaluate(() => performance.now());
  await page.evaluate((k) => { window.journey.flyTo('manifesto'); window.__m.phase = 'ascent'; window.__m.setWarp(k); }, warp);
  // wait until the camera stops at the top
  await still(5, "document.querySelectorAll('.j-manifesto-line.shown').length === 5 && window.__m.frames.filter(x => x.phase === 'ascent').length > 30");
  const data = await page.evaluate(() => ({ frames: window.__m.frames, ups: window.__m.ups }));
  const fr = data.frames.filter(f => f.phase === 'ascent' || f.phase === 'click');
  const ups = data.ups.filter(u => u.phase === 'ascent' || u.phase === 'click');
  const tA = fr.length ? fr[0].t : 0;
  const T = mode === 'mobile' ? 39 : 37.58;
  const at = (u) => { const want = tA + u * T * 1000; let best = null; for (const f of fr) if (!best || Math.abs(f.t - want) < Math.abs(best.t - want)) best = f; return best; };
  const sum = { mode, tag, restMs, ascent100k: ups.filter(u => u.bytes >= 100000 && !/^bufferSubData (50400|16800|10908)$/.test(`${u.kind} ${u.bytes}`)).length, frames: fr.length, upBytes: fr.reduce((s, f) => s + f.up, 0), upCalls: fr.reduce((s, f) => s + f.upN, 0),
    bigUploads: ups.filter(u => u.bytes >= 40000).map(u => `${u.kind} ${u.bytes} f${u.f} ${u.stack.slice(0, 300)}`),
    at: Object.fromEntries([0, 0.25, 0.5, 0.75, 1].map(u => { const f = at(u); return [u, f && { draws: f.draws, verts: f.verts, work: f.work, y: f.y }]; })),
    lastFrames: fr.slice(-3).map(f => ({ draws: f.draws, verts: f.verts, work: f.work, y: f.y })) };
  fs.writeFileSync(`${OUT}/ascent-${mode}-${tag}.json`, JSON.stringify({ sum, frames: fr, ups }, null, 1));
  console.log(JSON.stringify(sum, null, 1));
  await page.evaluate(() => { window.__m.setWarp(1); });
  await page.screenshot({ path: `${OUT}/top-${mode}-${tag}.png`, timeout: 300000 }).catch(e => console.log('shot fail', e.message));
  await browser.close();
})();
