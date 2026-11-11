// perf agent: GL uploads/links, long tasks, layout reads and custom-property
// writes per phase. Adapted from harness/o2-lazy-gl.cjs.
// Usage: node lazy-gl.cjs <desktop|mobile> <route csv> <settleMs> <tag> [port]
const { chromium } = require('playwright');
const fs = require('fs');
const mode = process.argv[2] || 'desktop';
const route = (process.argv[3] || 'inspire,equip,connect,final').split(',');
const settleMs = +(process.argv[4] || 3000);
const tag = process.argv[5] || 'run';
const port = process.argv[6] || '8146';
const extra = process.argv[7] ? '&' + process.argv[7] : '';
const OUT = '/tmp/claude-0/-home-user/62a00d20-ec8d-551d-aa8b-33233b07a42e/scratchpad/perf/out';

const INIT = () => {
  const log = []; window.__o2log = log; let phase = 'boot'; window.__o2phase = (p) => { phase = p; };
  const now = () => performance.now();
  const bytesOf = (a) => { for (const x of a) if (x && x.byteLength !== undefined) return x.byteLength; if (typeof a[1] === 'number') return a[1]; return 0; };
  const texBytes = (a) => { if (a.length >= 9) return (a[3] * a[4]) * 4; const s = a[5]; if (s && s.width) return s.width * s.height * 4; return 0; };
  for (const C of [WebGL2RenderingContext, WebGLRenderingContext]) {
    const P = C.prototype;
    const wrap = (name, f) => { const o = P[name]; if (!o) return; P[name] = function (...a) {
      const t0 = now(); const r = o.apply(this, a); const dt = now() - t0;
      const b = f ? f(a) : 0; const e = [phase, name, b, +dt.toFixed(2), +t0.toFixed(0)];
      if (b > 100000 || name === 'linkProgram') e.push((new Error().stack || '').split('\n').slice(2, 9).map(x => x.trim().replace(/https?:\/\/localhost:\d+\//, '')).join(' | '));
      log.push(e); return r; }; };
    wrap('bufferData', bytesOf); wrap('bufferSubData', (a) => (a[2] && a[2].byteLength) || 0);
    wrap('texImage2D', texBytes); wrap('texSubImage2D', (a) => { const s = a[a.length - 1]; return s && s.width ? s.width * s.height * 4 : 0; });
    wrap('texStorage2D', (a) => a[3] * a[4] * 4);
    wrap('generateMipmap'); wrap('linkProgram'); wrap('compileShader');
  }
  // layout-read and custom-property-write counters, bucketed per frame
  let reads = 0, writes = 0, rootWrites = 0;
  const E = Element.prototype, H = HTMLElement.prototype;
  const gbcr = E.getBoundingClientRect; E.getBoundingClientRect = function () { reads++; return gbcr.call(this); };
  for (const k of ['offsetWidth', 'offsetHeight', 'offsetTop', 'offsetLeft']) {
    const d = Object.getOwnPropertyDescriptor(H, k);
    Object.defineProperty(H, k, { configurable: true, get() { reads++; return d.get.call(this); } });
  }
  const sp = CSSStyleDeclaration.prototype.setProperty;
  CSSStyleDeclaration.prototype.setProperty = function (n, v, p) {
    if (n && n[0] === '-' && n[1] === '-') { writes++; if (this === document.documentElement.style) rootWrites++; }
    return sp.call(this, n, v, p);
  };
  const frames = []; window.__o2frames = frames; let last = 0;
  const tick = (t) => { if (last) frames.push([phase, +(t - last).toFixed(1), reads, writes, rootWrites]); reads = 0; writes = 0; rootWrites = 0; last = t; requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) log.push([phase, 'longtask', 0, +e.duration.toFixed(0), +e.startTime.toFixed(0)]); }).observe({ entryTypes: ['longtask'] }); } catch {}
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) log.push([phase, 'fetch', e.transferSize || 0, +e.duration.toFixed(0), +e.startTime.toFixed(0), e.name.replace(/^https?:\/\/[^/]+\//, '')]); }).observe({ type: 'resource' }); } catch {}
};

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = mode === 'mobile'
    ? await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 })
    : await browser.newContext({ viewport: { width: 800, height: 500 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.addInitScript(INIT);
  page.on('console', (m) => { if (/error|warn/i.test(m.type())) console.log('[page]', m.type(), m.text().slice(0, 200)); });
  await page.goto(`http://localhost:${port}/?nointro=1${extra}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.journey && window.journey.chapter, null, { timeout: 180000 });
  await page.evaluate(() => window.__o2phase('settle'));
  await page.waitForTimeout(settleMs);
  for (let i = 0; i < route.length; i++) {
    const id = route[i];
    const t = `${i}:${route[i - 1] || 'mission'}->${id}`;
    await page.evaluate((x) => window.__o2phase(x), t);
    await page.evaluate((c) => window.journey.flyTo(c), id);
    await page.waitForTimeout(300);
    await page.waitForFunction(() => !window.journey.transitionSeconds, null, { timeout: 300000, polling: 100 }).catch(() => {});
    await page.evaluate((x) => window.__o2phase(x + ':rest'), t);
    await page.waitForTimeout(i === route.length - 1 ? 15000 : settleMs);
  }
  const log = await page.evaluate(() => window.__o2log);
  const frames = await page.evaluate(() => window.__o2frames);
  fs.writeFileSync(`${OUT}/${tag}-${mode}.json`, JSON.stringify({ log, frames }));
  await browser.close();
  const agg = {}; const order = [];
  const A = (ph) => { if (!agg[ph]) { agg[ph] = { buf: [0, 0], tex: [0, 0], mip: 0, link: 0, lt: [0, 0], fetch: [0, 0], fr: 0, reads: 0, writes: 0, root: 0, bigBuf: [0, 0] }; order.push(ph); } return agg[ph]; };
  for (const [ph, name, bytes, ms] of log) {
    const a = A(ph);
    if (name === 'bufferData') { a.buf[0]++; a.buf[1] += bytes; if (bytes > 65536) { a.bigBuf[0]++; a.bigBuf[1] += bytes; } }
    else if (/^tex/.test(name)) { a.tex[0]++; a.tex[1] += bytes; }
    else if (name === 'generateMipmap') a.mip++;
    else if (name === 'linkProgram') a.link++;
    else if (name === 'longtask') { a.lt[0]++; a.lt[1] = Math.max(a.lt[1], ms); }
    else if (name === 'fetch') { a.fetch[0]++; a.fetch[1] += bytes; }
  }
  for (const [ph, , r, w, rw] of frames) { const a = A(ph); a.fr++; a.reads += r; a.writes += w; a.root += rw; }
  const mb = (b) => (b / 1e6).toFixed(2);
  console.log(`| phase | bufferData n / MB | of which >64KB n / MB | tex n / MB | mips | links | longtasks n / max ms | fetch n / MB | frames | layout reads/frame | --prop writes/frame (root) |`);
  console.log('|---|---|---|---|---|---|---|---|---|---|---|');
  for (const ph of order) { const a = agg[ph]; const f = Math.max(1, a.fr);
    console.log(`| ${ph} | ${a.buf[0]} / ${mb(a.buf[1])} | ${a.bigBuf[0]} / ${mb(a.bigBuf[1])} | ${a.tex[0]} / ${mb(a.tex[1])} | ${a.mip} | ${a.link} | ${a.lt[0]} / ${a.lt[1]} | ${a.fetch[0]} / ${mb(a.fetch[1])} | ${a.fr} | ${(a.reads / f).toFixed(1)} | ${(a.writes / f).toFixed(1)} (${(a.root / f).toFixed(1)}) |`); }
})();
