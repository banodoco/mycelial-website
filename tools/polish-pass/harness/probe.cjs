// warmfix probe: what is NOT on the GPU at a rest, what the hop uploads, queue decisions.
// node probe.cjs <desktop|mobile> <port> <tag> <restMs> [route csv]
const { chromium } = require('playwright');
const fs = require('fs');
const [mode = 'desktop', port = '8154', tag = 'probe', restArg = '60000', routeArg = 'connect,final,owned'] = process.argv.slice(2);
const restMs = +restArg; const route = routeArg.split(',');
const OUT = '/tmp/claude-0/-home-user/62a00d20-ec8d-551d-aa8b-33233b07a42e/scratchpad/warmfix/out';
fs.mkdirSync(OUT, { recursive: true });

const INIT = () => {
  const log = []; window.__o2log = log; let phase = 'boot'; window.__o2phase = (p) => { phase = p; };
  const now = () => performance.now();
  const bytesOf = (a) => { for (const x of a) if (x && x.byteLength !== undefined) return x.byteLength; if (typeof a[1] === 'number') return a[1]; return 0; };
  const texBytes = (a) => { if (a.length >= 9) return (a[3] * a[4]) * 4; const s = a[5]; if (s && s.width) return s.width * s.height * 4; return 0; };
  for (const C of [WebGL2RenderingContext, WebGLRenderingContext]) {
    const P = C.prototype;
    const wrap = (name, f) => { const o = P[name]; if (!o) return; P[name] = function (...a) {
      const t0 = now(); const r = o.apply(this, a); const dt = now() - t0;
      log.push([phase, name, f ? f(a) : 0, +dt.toFixed(1), +t0.toFixed(0)]); return r; }; };
    wrap('bufferData', bytesOf); wrap('bufferSubData', (a) => (a[2] && a[2].byteLength) || 0);
    wrap('texImage2D', texBytes); wrap('texSubImage2D', (a) => { const s = a[a.length - 1]; return s && s.width ? s.width * s.height * 4 : 0; });
    wrap('texStorage2D', (a) => a[3] * a[4] * 4); wrap('generateMipmap');
  }
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) log.push([phase, 'longtask', 0, +e.duration.toFixed(0), +e.startTime.toFixed(0)]); }).observe({ entryTypes: ['longtask'] }); } catch {}
  window.__probe = {
    reg: (g) => !!(g && g._listeners && g._listeners.dispose && g._listeners.dispose.length),
    chapterOf(o) { const ch = window.journey.chapters; for (let n = o; n; n = n.parent) for (const id of Object.keys(ch)) if (ch[id].group === n) return id; return '-'; },
    path(o) { const p = []; for (let n = o; n && n.parent; n = n.parent) p.push((n.name || n.type) + (n.visible ? '' : '!')); return p.reverse().join('/'); },
    bytes(g) { let b = 0; for (const a of Object.values(g.attributes || {})) b += ((a && (a.array || (a.data && a.data.array))) || { byteLength: 0 }).byteLength; if (g.index) b += g.index.array.byteLength; return b; },
    texs(m) { const out = []; for (const [k, v] of Object.entries(m)) if (v && v.isTexture) out.push([k, v]); for (const [k, u] of Object.entries(m.uniforms || {})) { const v = u && u.value; if (v && v.isTexture) out.push([k, v]); else if (Array.isArray(v)) v.forEach((x, i) => x && x.isTexture && out.push([k + i, x])); } return out; },
    missing() {
      const P = window.__probe, api = window.journey.hero, props = api.renderer.properties;
      const geos = [], texs = [], seenG = new Set(), seenT = new Set();
      api.scene.traverse((o) => {
        if (o.geometry && !seenG.has(o.geometry)) { seenG.add(o.geometry); if (!P.reg(o.geometry)) geos.push({ o, g: o.geometry }); }
        for (const m of [].concat(o.material || [])) for (const [k, t] of P.texs(m)) {
          if (seenT.has(t) || t.isRenderTargetTexture) continue; seenT.add(t);
          if (props.get(t).__version !== t.version) texs.push({ o, k, t });
        }
      });
      window.__probeMissing = { geos, texs };
      const sum = {};
      for (const { o, g } of geos) { const c = P.chapterOf(o); sum[c] = sum[c] || { g: 0, gb: 0, t: 0, tb: 0 }; sum[c].g++; sum[c].gb += P.bytes(g); }
      for (const { o, t } of texs) { const c = P.chapterOf(o); sum[c] = sum[c] || { g: 0, gb: 0, t: 0, tb: 0 }; sum[c].t++; sum[c].tb += (t.image && t.image.width * t.image.height * 4) || 0; }
      return { sum, bigGeos: geos.filter((x) => P.bytes(x.g) > 65536).map((x) => [P.chapterOf(x.o), P.path(x.o), P.bytes(x.g), x.o.frustumCulled, x.o.layers.mask, [].concat(x.o.material)[0]?.visible]).slice(0, 40),
        texs: texs.map((x) => [P.chapterOf(x.o), P.path(x.o), x.k, x.t.image && x.t.image.width, x.t.image && x.t.image.height, x.t.version, x.t.constructor.name]) };
    },
    hopUploaded() {
      const P = window.__probe, M = window.__probeMissing, props = window.journey.hero.renderer.properties;
      return { geos: M.geos.filter((x) => P.reg(x.g)).map((x) => [P.chapterOf(x.o), P.path(x.o), P.bytes(x.g)]).filter((x) => x[2] > 65536),
        texs: M.texs.filter((x) => props.get(x.t).__version === x.t.version).map((x) => [P.chapterOf(x.o), P.path(x.o), x.k, x.t.image && x.t.image.width, x.t.image && x.t.image.height]) };
    },
  };
};

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = mode === 'mobile'
    ? await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 })
    : await browser.newContext({ viewport: { width: 800, height: 500 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.addInitScript(INIT);
  page.on('console', (m) => { if (/error|warn/i.test(m.type())) console.log('[page]', m.type(), m.text().slice(0, 200)); });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  const result = { mode, restMs, route, steps: [] };
  const t0 = Date.now(); const ts = () => ((Date.now() - t0) / 1000).toFixed(0) + 's';
  await page.goto(`http://localhost:${port}/?nointro=1&warmdraw=1`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.journey && window.journey.chapter, null, { timeout: 180000 });
  await page.evaluate(() => window.__o2phase('settle'));
  await page.waitForTimeout(Math.min(restMs, 20000));
  let prev = 'mission';
  for (let i = 0; i < route.length; i++) {
    const id = route[i]; const ph = `${i}:${prev}->${id}`;
    const before = await page.evaluate(() => window.__probe.missing());
    const rep0 = await page.evaluate(() => window.journey.warmReport && window.journey.warmReport());
    console.log(ts(), 'before', ph, JSON.stringify(before.sum));
    await page.evaluate((x) => window.__o2phase(x), ph);
    await page.evaluate((c) => window.journey.flyTo(c), id);
    await page.waitForTimeout(300);
    await page.waitForFunction(() => !window.journey.transitionSeconds, null, { timeout: 600000, polling: 200 }).catch(() => {});
    const hop = await page.evaluate(() => window.__probe.hopUploaded());
    await page.evaluate((x) => window.__o2phase(x + ':rest'), ph);
    console.log(ts(), 'hop', ph, JSON.stringify(hop).slice(0, 1500));
    await page.waitForTimeout(restMs);
    const restRep = await page.evaluate(() => { const w = window.journey.warmReport && window.journey.warmReport(); const c = globalThis[Symbol.for('mycelial.manifesto.aerialColony')];
      return w && { slices: w.slices, units: w.units, longestUnit: w.longestUnit, warmed: w.warmed, lastSkip: w.lastSkip, tasks: w.tasks,
        missing: Object.fromEntries(Object.entries(w.chapters).map(([k, v]) => [k, v.missing])), colony: c && c.warm,
        ground: c && c.group.children.filter((o) => o.geometry && !(o.geometry._listeners && o.geometry._listeners.dispose && o.geometry._listeners.dispose.length)).length,
        log: w.log.slice(-12) }; });
    console.log(ts(), 'rest', ph, JSON.stringify(restRep));
    result.steps.push({ ph, before, warmReportBefore: rep0, hop, restRep });
    prev = id;
  }
  result.after = await page.evaluate(() => window.__probe.missing());
  result.warmReport = await page.evaluate(() => window.journey.warmReport && window.journey.warmReport());
  result.colony = await page.evaluate(() => {
    const c = globalThis[Symbol.for('mycelial.manifesto.aerialColony')]; if (!c) return null;
    const P = window.__probe;
    return { warm: c.warm, path: P.path(c.group), children: c.group.children.map((o) => [o.name || o.type, P.reg(o.geometry), P.bytes(o.geometry), o.layers.mask, o.visible]) };
  });
  result.log = await page.evaluate(() => window.__o2log);
  fs.writeFileSync(`${OUT}/${tag}-${mode}.json`, JSON.stringify(result));
  await browser.close();
  // per-phase GL summary
  const agg = {}; const order = [];
  for (const [ph, name, b, ms] of result.log) {
    if (!agg[ph]) { agg[ph] = { big: [0, 0], buf: [0, 0], tex: [0, 0], mip: 0, lt: 0, maxUp: 0 }; order.push(ph); }
    const a = agg[ph];
    if (name === 'bufferData') { a.buf[0]++; a.buf[1] += b; if (b > 65536) { a.big[0]++; a.big[1] += b; } }
    else if (/^tex/.test(name)) { a.tex[0]++; a.tex[1] += b; }
    else if (name === 'generateMipmap') a.mip++;
    else if (name === 'longtask') a.lt = Math.max(a.lt, ms);
    if (name !== 'longtask' && name !== 'generateMipmap') a.maxUp = Math.max(a.maxUp, b);
  }
  const mb = (x) => (x / 1e6).toFixed(2);
  console.log('| phase | bufferData n/MB | >64KB n/MB | tex n/MB | mips | max single upload | longest task ms |');
  for (const ph of order) { const a = agg[ph]; console.log(`| ${ph} | ${a.buf[0]}/${mb(a.buf[1])} | ${a.big[0]}/${mb(a.big[1])} | ${a.tex[0]}/${mb(a.tex[1])} | ${a.mip} | ${a.maxUp} | ${a.lt} |`); }
  console.log('colony', JSON.stringify(result.colony));
  console.log('pendingAtEnd', JSON.stringify(result.warmReport && result.warmReport.pending));
})();
