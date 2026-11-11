// VERIFY check 5: UI measurements + screenshots for one server.
// Usage: node ui-check.cjs <port> <label> <sections csv: menu,intro,inspire,early>
// DPR 1 (software GL; DPR 2 too slow here). Real clock. One browser, sequential.
const { chromium } = require('playwright');
const fs = require('fs');
const port = process.argv[2];
const label = process.argv[3];
const SECTIONS = (process.argv[4] || 'menu,intro,inspire,early').split(',');
const OUT = '/tmp/claude-0/-home-user/62a00d20-ec8d-551d-aa8b-33233b07a42e/scratchpad/captures/VERIFY-perf';
const base = `http://localhost:${port}`;
const res = {};
const R = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { top: +b.top.toFixed(2), bottom: +b.bottom.toFixed(2), h: +b.height.toFixed(2), w: +b.width.toFixed(2), cy: +(b.top + b.height / 2).toFixed(2) }; };
const phoneMeasure = () => {
  const q = (s) => document.querySelector(s);
  const vh = innerHeight;
  const nav = q('#site-nav'), logo = q('#site-nav .logo');
  const mark = q('.j-rail [data-chapter="inspire"] .j-rail-mark');
  const name = q('.j-rail [data-chapter="inspire"] .j-rail-name');
  const h1 = q('.hero h1'), sub = q('.hero .sub');
  const rb = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return b; };
  const navB = rb(nav), logoB = rb(logo), mB = rb(mark), nB = rb(name), h1B = rb(h1), subB = rb(sub);
  const tops = [h1B, subB].filter(Boolean);
  const textTop = tops.length ? Math.min(...tops.map(b => b.top)) : null;
  const textBot = tops.length ? Math.max(...tops.map(b => b.bottom)) : null;
  const c = getComputedStyle(document.documentElement);
  return {
    vh, vw: innerWidth, hash: location.hash,
    topbarBottom: navB && +navB.bottom.toFixed(2),
    logoTopInset: logoB && +logoB.top.toFixed(2),
    logoCentreInset: logoB && +(logoB.top + logoB.height / 2).toFixed(2),
    glyphCentreFromBottom: mB && +(vh - (mB.top + mB.height / 2)).toFixed(2),
    glyphTop: mB && +mB.top.toFixed(2),
    glyphBottomFromVpBottom: mB && +(vh - mB.bottom).toFixed(2),
    labelBottomFromVpBottom: nB && +(vh - nB.bottom).toFixed(2),
    labelTop: nB && +nB.top.toFixed(2),
    headlineTop: textTop && +textTop.toFixed(2), headlineBottom: textBot && +textBot.toFixed(2),
    headlineCentre: textTop != null ? +((textTop + textBot) / 2).toFixed(2) : null,
    h1Top: h1B && +h1B.top.toFixed(2), h1Bottom: h1B && +h1B.bottom.toFixed(2),
    heroLift: c.getPropertyValue('--nav-hero-lift').trim(), contentU: c.getPropertyValue('--nav-content-u').trim(),
  };
};
const menuMeasure = () => {
  const menu = document.querySelector('.j-menu');
  const cs = (el) => { const c = getComputedStyle(el); return { fs: c.fontSize, lh: c.lineHeight, ff: c.fontFamily.split(',')[0] }; };
  const thesis = [...document.querySelectorAll('.j-menu-thesis')].map(el => {
    const c = cs(el); const b = el.getBoundingClientRect(); const lhPx = parseFloat(c.lh) || parseFloat(c.fs) * 1.2;
    return { text: el.textContent, fontSize: c.fs, lineHeightPx: +lhPx.toFixed(1), boxH: +b.height.toFixed(1), lines: Math.round(b.height / lhPx), top: +b.top.toFixed(1), fontFamily: c.ff };
  });
  return { open: !!(menu && menu.classList.contains('open')), clientH: menu && menu.clientHeight, scrollH: menu && menu.scrollHeight, overflowY: menu && getComputedStyle(menu).overflowY, thesis };
};
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  try {
    if (SECTIONS.includes('menu')) {
      res.menu = {};
      for (const v of [{ n: 'd1440', w: 1440, h: 900, m: false }, { n: 'd1280', w: 1280, h: 720, m: false }, { n: 'm390', w: 390, h: 844, m: true }]) {
        const t0 = Date.now();
        const ctx = await browser.newContext({ viewport: { width: v.w, height: v.h }, deviceScaleFactor: 1, isMobile: v.m, hasTouch: v.m });
        const page = await ctx.newPage(); page.setDefaultTimeout(170000);
        await page.goto(`${base}/?nointro=1`, { waitUntil: 'load' });
        await page.waitForTimeout(9000);
        await page.locator('.j-rail-menu').first().evaluate(el => el.click()).catch(() => {});
        await page.waitForTimeout(2500);
        res.menu[v.n] = await page.evaluate(menuMeasure);
        await page.screenshot({ path: `${OUT}/ui-${label}-menu-${v.n}.png`, timeout: 170000 });
        res.menu[v.n].wallS = (Date.now() - t0) / 1000;
        await ctx.close();
      }
    }
    if (SECTIONS.includes('intro')) {
      res.intro = {};
      for (const v of [{ n: 'm390', w: 390, h: 844 }, { n: 'm375', w: 375, h: 667 }, { n: 'm430', w: 430, h: 932 }]) {
        const ctx = await browser.newContext({ viewport: { width: v.w, height: v.h }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
        const page = await ctx.newPage(); page.setDefaultTimeout(170000);
        await page.goto(`${base}/?nointro=1`, { waitUntil: 'load' });
        await page.waitForTimeout(12000);
        res.intro[v.n] = await page.evaluate(phoneMeasure);
        await page.screenshot({ path: `${OUT}/ui-${label}-intro-${v.n}.png`, timeout: 170000 });
        await ctx.close();
      }
    }
    if (SECTIONS.includes('inspire')) {
      res.inspire = {};
      for (const v of [{ n: 'm390', w: 390, h: 844 }, { n: 'm375', w: 375, h: 667 }, { n: 'm430', w: 430, h: 932 }]) {
        const ctx = await browser.newContext({ viewport: { width: v.w, height: v.h }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
        const page = await ctx.newPage(); page.setDefaultTimeout(170000);
        await page.goto(`${base}/?nointro=1#/inspire`, { waitUntil: 'load' });
        await page.waitForTimeout(25000);
        res.inspire[v.n] = await page.evaluate(phoneMeasure);
        await page.screenshot({ path: `${OUT}/ui-${label}-inspire-${v.n}.png`, timeout: 170000 });
        await ctx.close();
      }
    }
    if (SECTIONS.includes('early')) {
      res.early = {};
      for (const p of ['0.15', '0.3', '0.5']) {
        const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
        const page = await ctx.newPage(); page.setDefaultTimeout(170000);
        await page.goto(`${base}/?introat=${p}`, { waitUntil: 'load' });
        await page.waitForTimeout(8000);
        const m = await page.evaluate(phoneMeasure);
        m.midpointTopbarToGlyph = m.topbarBottom != null && m.glyphTop != null ? +((m.topbarBottom + m.glyphTop) / 2).toFixed(2) : null;
        m.headlineCentreMinusMidpoint = m.headlineCentre != null && m.midpointTopbarToGlyph != null ? +(m.headlineCentre - m.midpointTopbarToGlyph).toFixed(2) : null;
        res.early[p] = m;
        await page.screenshot({ path: `${OUT}/ui-${label}-early-${p}.png`, timeout: 170000 });
        await ctx.close();
      }
    }
  } finally { await browser.close(); }
  fs.writeFileSync(`${OUT}/ui-${label}-${SECTIONS.join('-')}.json`, JSON.stringify(res, null, 1));
  console.log('DONE', JSON.stringify(res).slice(0, 4000));
})().catch(e => { console.error('ERR', e); process.exit(1); });
