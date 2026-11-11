// O2-renderperf: count GL uploads/links per navigation phase (lazy first-sight work).
// Usage: node o2-lazy-gl.cjs <desktop|mobile> <route csv> [waitMs]
const { chromium } = require('playwright');
const fs = require('fs');
const mode = process.argv[2] || 'desktop';
const route = (process.argv[3] || 'inspire,equip,connect,final').split(',');
const waitMs = +(process.argv[4] || 30000);
const OUT = '/tmp/claude-0/-home-user/62a00d20-ec8d-551d-aa8b-33233b07a42e/scratchpad/captures/O2-renderperf';

const INIT = () => {
  Error.stackTraceLimit = 60; const log = []; window.__o2log = log; let phase = 'boot'; window.__o2phase = (p) => { phase = p; };
  const now = () => performance.now();
  const bytesOf = (a) => { for (const x of a) if (x && x.byteLength !== undefined) return x.byteLength; if (typeof a[1] === 'number') return a[1]; return 0; };
  const texBytes = (a) => { // texImage2D(target, level, ifmt, w, h, border, fmt, type, src) or (t,l,if,fmt,type,src)
    if (a.length >= 9) return (a[3] * a[4]) * 4;
    const s = a[5]; if (s && s.width) return s.width * s.height * 4; return 0; };
  for (const C of [WebGL2RenderingContext, WebGLRenderingContext]) {
    const P = C.prototype;
    const wrap = (name, f) => { const o = P[name]; if (!o) return; P[name] = function (...a) {
      const t0 = now(); const r = o.apply(this, a); const dt = now() - t0;
      const b = f ? f(a) : 0; const e = [phase, name, b, +dt.toFixed(2), +t0.toFixed(0)]; if ((b > 100000 || name === 'linkProgram') ) e.push((new Error().stack || '').split('\n').slice(2, 60).map(x => x.trim().replace(/https?:\/\/localhost:8137\//, '')).join(' | ')); log.push(e); return r; }; };
    wrap('bufferData', bytesOf); wrap('bufferSubData', (a) => (a[2] && a[2].byteLength) || 0);
    wrap('texImage2D', texBytes); wrap('texSubImage2D', () => 0); wrap('texStorage2D', (a) => a[3] * a[4] * 4);
    wrap('generateMipmap'); wrap('linkProgram'); wrap('compileShader'); wrap('renderbufferStorageMultisample', (a) => a[3] * a[4] * 8 * a[1]);
    wrap('readPixels');
  }
  // long frames (JS between rAFs)
  const frames = []; window.__o2frames = frames; let last = 0;
  const tick = (t) => { if (last) frames.push([phase, +(t - last).toFixed(1)]); last = t; requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) log.push([phase, 'longtask', 0, +e.duration.toFixed(0), +e.startTime.toFixed(0)]); }).observe({ entryTypes: ['longtask'] }); } catch {}
};

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = mode === 'mobile'
    ? await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 })
    : await browser.newContext({ viewport: { width: 800, height: 500 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.addInitScript(INIT);
  page.on('crash', () => console.log('[page] CRASH')); page.on('close', () => console.log('[page] CLOSE'));
  page.on('console', (m) => { if (/error|warn/i.test(m.type())) console.log('[page]', m.type(), m.text().slice(0, 160)); });
  await page.goto('http://localhost:8137/?nointro=1', { waitUntil: 'load' });
  await page.waitForFunction(() => window.journey && window.journey.chapter, null, { timeout: 120000 });
  await page.evaluate(() => window.__o2phase('settle'));
  await page.waitForTimeout(waitMs);
  for (let i = 0; i < route.length; i++) {
    const id = route[i];
    const tag = `${i}:${route[i - 1] || 'mission'}->${id}`;
    await page.evaluate((t) => window.__o2phase(t), tag);
    await page.evaluate((c) => window.journey.flyTo(c), id);
    // wait until the blend lands (transitionSeconds 0) and a few frames more
    await page.waitForFunction(() => window.journey.transitionSeconds === 0 || !window.journey.transitionSeconds, null, { timeout: 180000, polling: 500 }).catch(() => {});
    await page.waitForTimeout(4000);
    await page.evaluate((t) => window.__o2phase(t + ':rest'), tag);
    await page.waitForTimeout(3000);
    await dump();
  }
  await dump(true);
  await browser.close();
  async function dump(final) {
  const log = await page.evaluate(() => window.__o2log);
  const frames = await page.evaluate(() => window.__o2frames);
  fs.writeFileSync(`${OUT}/lazy-gl-deep-${mode}.json`, JSON.stringify({ log, frames }));
  if (!final) { console.log('dumped', log.length); return; }
  const agg = {};
  for (const [ph, name, bytes, ms] of log) {
    const k = ph; agg[k] = agg[k] || {};
    const a = agg[k][name] = agg[k][name] || { n: 0, bytes: 0, ms: 0 };
    a.n++; a.bytes += bytes || 0; a.ms += ms;
  }
  for (const [ph, o] of Object.entries(agg)) {
    console.log('==', ph);
    for (const [n, a] of Object.entries(o)) console.log(`   ${n.padEnd(32)} n=${a.n} bytes=${(a.bytes / 1e6).toFixed(2)}MB ms=${a.ms.toFixed(0)}`);
  }
  }
})();
