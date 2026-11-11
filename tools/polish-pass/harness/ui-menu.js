// H3 U1: open menu panel, measure type + overflow at 4 viewports. One browser.
const { chromium } = require('playwright');
const S = '/tmp/claude-0/-home-user/62a00d20-ec8d-551d-aa8b-33233b07a42e/scratchpad'; const TAG = process.env.TAG || 'x';
const VP = [
  { name: 'd1440', w: 1440, h: 900, mobile: false },
  { name: 'd1280', w: 1280, h: 720, mobile: false },
  { name: 'm390', w: 390, h: 844, mobile: true },
  { name: 'm375', w: 375, h: 667, mobile: true },
];
const SEL = ['.j-menu-thesis', '.j-menu-name', '.j-menu-no', '.j-menu-item[data-menu-section="inspire"] .j-menu-name', '.j-menu-links a', '.j-menu-list > li:last-child .j-menu-item'];
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const out = {};
  try {
    for (const v of VP) {
      const ctx = await browser.newContext({ viewport: { width: v.w, height: v.h }, deviceScaleFactor: 1, isMobile: v.mobile, hasTouch: v.mobile });
      const page = await ctx.newPage();
      await page.goto('http://localhost:8141/?nointro=1', { waitUntil: 'load' });
      await page.waitForTimeout(9000);
      const bb = await page.locator('.j-rail-menu').first().boundingBox(); await page.mouse.click(bb.x+bb.width/2, bb.y+bb.height/2); await page.waitForTimeout(1500);
      if (!(await page.evaluate(() => document.querySelector('.j-menu')?.classList.contains('open')))) { await page.evaluate(() => document.querySelector('.j-rail-menu').click()); await page.waitForTimeout(2000); }
      console.log('open after click', v.name, await page.evaluate(() => document.querySelector('.j-menu')?.classList.contains('open')));
      
      await page.waitForTimeout(1500);
      const r = await page.evaluate((SEL) => {
        const menu = document.querySelector('.j-menu');
        const cs = (el) => { const c = getComputedStyle(el); return { ff: c.fontFamily, fs: c.fontSize, fw: c.fontWeight, lh: c.lineHeight, ls: c.letterSpacing, color: c.color, op: c.opacity, mt: c.marginTop, mb: c.marginBottom, pt: c.paddingTop, pb: c.paddingBottom, tt: c.textTransform }; };
        const rect = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { top: Math.round(b.top), h: Math.round(b.height), w: Math.round(b.width), left: Math.round(b.left) }; };
        const res = { open: menu && menu.classList.contains('open'), menuRect: menu && rect(menu), clientH: menu && menu.clientHeight, scrollH: menu && menu.scrollHeight, overflowY: menu && getComputedStyle(menu).overflowY };
        res.thesis = [...document.querySelectorAll('.j-menu-thesis')].map(el => ({ text: el.textContent, ...cs(el), rect: rect(el) }));
        res.nameInspire = (() => { const el = document.querySelector('.j-menu .j-menu-name'); return el ? { text: el.textContent, ...cs(el) } : null; })();
        res.itemFirst = (() => { const el = document.querySelector('.j-menu .j-menu-item'); return el ? { text: el.textContent.slice(0,40), ...cs(el) } : null; })();
        res.menuTitle = (() => { const el = document.querySelector('.j-menu-h'); return el ? { text: el.textContent, ...cs(el) } : null; })();
        res.rows = document.querySelectorAll('.j-menu-row').length;
        res.thesisRects = [...document.querySelectorAll('.j-menu-thesis')].map(e => rect(e));
        res.firstLi = rect(document.querySelector('.j-menu-list > li'));
        res.lastLi = rect(document.querySelector('.j-menu-list > li:last-child'));
        res.legal = (() => { const el = document.querySelector('.j-menu-legal'); return el ? rect(el) : null; })();
        res.fontsLoaded = [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family).slice(0, 20);
        return res;
      }, SEL);
      out[v.name] = r;
      await page.screenshot({ path: `${S}/captures/IMPL-ui/${TAG}-U1-menu-${v.name}.png`, timeout: 170000 });
      await ctx.close();
    }
  } finally { await browser.close(); }
  require('fs').writeFileSync(`${S}/captures/IMPL-ui/${TAG}-U1-measure.json`, JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 1).slice(0, 6000));
})().catch(e => { console.error('ERR', e); process.exit(1); });
