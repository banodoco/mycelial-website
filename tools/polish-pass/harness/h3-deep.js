// deep link to #/inspire at 390x844, measure after settle (no clicks)
const { chromium } = require('playwright');
const S = '/tmp/claude-0/-home-user/62a00d20-ec8d-551d-aa8b-33233b07a42e/scratchpad';
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  try {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    const page = await ctx.newPage(); page.setDefaultTimeout(120000);
    await page.goto('http://localhost:8137/?nointro=1#/inspire', { waitUntil: 'load' });
    await page.waitForTimeout(25000);
    const r = await page.evaluate(() => {
      const c = getComputedStyle(document.documentElement);
      const list = document.querySelector('.j-rail-list');
      const m = document.querySelector('.j-rail [data-chapter="inspire"] .j-rail-mark').getBoundingClientRect();
      const lb = list.getBoundingClientRect();
      const h1 = document.querySelector('.hero h1');
      return { hash: location.hash, u: c.getPropertyValue('--nav-content-u'), lift: c.getPropertyValue('--nav-hero-lift'), inspireCentreFromBottom: +(innerHeight - (m.top + m.height / 2)).toFixed(2), inspireH: m.height, listBottomFromVpBottom: +(innerHeight - lb.bottom).toFixed(2), listTop: lb.top, h1Visible: h1 ? getComputedStyle(h1).opacity : null, railClass: document.querySelector('.j-rail').className };
    });
    console.log(JSON.stringify(r));
    await page.screenshot({ path: `${S}/captures/H3-ui/U3-deep-m390-inspire.png`, timeout: 170000 });
    await ctx.close();
  } finally { await browser.close(); }
})().catch(e => { console.error('ERR', e); process.exit(1); });
