// IMPL-ui U3: measure phone rail/top bar at hero (settled) and #/inspire.
const { chromium } = require('playwright');
const S = '/tmp/claude-0/-home-user/62a00d20-ec8d-551d-aa8b-33233b07a42e/scratchpad';
const TAG = process.env.TAG || 'x';
const VP = [{ n: 'm390', w: 390, h: 844 }, { n: 'm375', w: 375, h: 667 }, { n: 'm430', w: 430, h: 932 }];
const MEASURE = () => {
  const H = innerHeight;
  const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { top: +b.top.toFixed(1), bottom: +b.bottom.toFixed(1), fromBottom: +(H - b.bottom).toFixed(1) }; };
  const bar = document.querySelector('#site-nav');
  const logo = document.querySelector('#site-nav .logo, #site-nav a');
  const mark = document.querySelector('.j-rail [data-chapter="inspire"] .j-rail-mark');
  const name = document.querySelector('.j-rail [data-chapter="inspire"] .j-rail-name');
  const h1 = document.querySelector('.hero h1');
  const sub = document.querySelector('.hero .sub, .hero p');
  return {
    H, nav: r(bar), logo: r(logo),
    glyph: r(mark), label: r(name),
    glyphCentreFromBottom: mark ? +(H - (mark.getBoundingClientRect().top + mark.getBoundingClientRect().height / 2)).toFixed(1) : null,
    navContentU: getComputedStyle(document.documentElement).getPropertyValue('--nav-content-u').trim(),
    hero: r(h1), sub: r(sub),
  };
};
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const out = {};
  try {
    for (const v of VP) {
      const ctx = await browser.newContext({ viewport: { width: v.w, height: v.h }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
      const page = await ctx.newPage();
      await page.goto('http://localhost:8141/?nointro=1', { waitUntil: 'load' });
      await page.waitForTimeout(9000);
      out[v.n + '-hero'] = await page.evaluate(MEASURE);
      await page.screenshot({ path: `${S}/captures/IMPL-ui/${TAG}-U3-hero-${v.n}.png`, timeout: 170000 });
      await ctx.close();
      const ctx2 = await browser.newContext({ viewport: { width: v.w, height: v.h }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
      const p2 = await ctx2.newPage();
      await p2.goto('http://localhost:8141/?nointro=1#/inspire', { waitUntil: 'load' });
      await p2.waitForTimeout(25000);
      out[v.n + '-inspire'] = await p2.evaluate(MEASURE);
      await p2.screenshot({ path: `${S}/captures/IMPL-ui/${TAG}-U3-inspire-${v.n}.png`, timeout: 170000 });
      await ctx2.close();
    }
  } finally { await browser.close(); }
  require('fs').writeFileSync(`${S}/captures/IMPL-ui/${TAG}-U3-measure.json`, JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 1));
})().catch(e => { console.error('ERR', e); process.exit(1); });
