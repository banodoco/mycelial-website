// H3 U3: mobile top bar / hero text / bottom rail geometry at load (nointro + normal intro) and after INSPIRE.
const { chromium } = require('playwright');
const fs = require('fs');
const S = '/tmp/claude-0/-home-user/62a00d20-ec8d-551d-aa8b-33233b07a42e/scratchpad';
const VP = [
  { name: 'm390', w: 390, h: 844 },
  { name: 'm375', w: 375, h: 667 },
  { name: 'm430', w: 430, h: 932 },
];
const MODES = (process.env.MODES || 'nointro').split(',');
const measure = () => {
  const r = el => { if (!el) return null; const b = el.getBoundingClientRect(); return { top: +b.top.toFixed(2), bottom: +b.bottom.toFixed(2), left: +b.left.toFixed(2), right: +b.right.toFixed(2), h: +b.height.toFixed(2), w: +b.width.toFixed(2), cy: +(b.top + b.height / 2).toFixed(2) }; };
  const q = s => document.querySelector(s);
  const vh = innerHeight;
  const nav = q('#site-nav'), logo = q('#site-nav .logo'), menu = q('.j-rail-menu');
  const hero = q('.hero'), h1 = q('.hero h1'), sub = q('.hero .sub');
  const rail = q('.j-rail:not(.j-rail-preboot)') || q('.j-rail');
  const railInner = rail && rail.querySelector('.j-rail-inner');
  const railList = rail && rail.querySelector('.j-rail-list');
  const inspireMark = q('.j-rail [data-chapter="inspire"] .j-rail-mark');
  const inspireItem = q('.j-rail [data-chapter="inspire"] .j-rail-item');
  const cs = el => el ? getComputedStyle(el) : null;
  const navCS = cs(nav);
  const textBlock = (() => { const els = [h1, sub, q('.hero .cta-short'), q('.hero .cta-full')].filter(Boolean); const tops = els.map(e => e.getBoundingClientRect()); return { top: +Math.min(...tops.map(t => t.top)).toFixed(2), bottom: +Math.max(...tops.map(t => t.bottom)).toFixed(2) }; })();
  const topBarBottom = nav ? nav.getBoundingClientRect().bottom : null;
  const railBottom = railList ? railList.getBoundingClientRect().bottom : null;
  const railGlyphBottom = inspireMark ? inspireMark.getBoundingClientRect().bottom : null;
  const railClass = rail ? rail.className : null;
  return {
    vh, vw: innerWidth, railClass,
    navPadding: navCS && [navCS.paddingTop, navCS.paddingRight, navCS.paddingBottom, navCS.paddingLeft].join(' '),
    navRect: r(nav), logoRect: r(logo), menuRect: r(menu),
    heroRect: r(hero), h1Rect: r(h1), subRect: r(sub), textBlock,
    railRect: r(rail), railInnerRect: r(railInner), railListRect: r(railList),
    inspireMarkRect: r(inspireMark), inspireItemRect: r(inspireItem),
    navTopEdgeFromVpTop: nav ? +nav.getBoundingClientRect().top.toFixed(2) : null,
    navCentreFromVpTop: nav ? +(nav.getBoundingClientRect().top + nav.getBoundingClientRect().height / 2).toFixed(2) : null,
    logoCentreFromVpTop: logo ? +(logo.getBoundingClientRect().top + logo.getBoundingClientRect().height / 2).toFixed(2) : null,
    gapTopbarBottomToTextTop: topBarBottom != null ? +(textBlock.top - topBarBottom).toFixed(2) : null,
    gapTextBottomToNavTop: rail ? +(rail.getBoundingClientRect().top - textBlock.bottom).toFixed(2) : null,
    railBottomToVpBottom: railList ? +(vh - railList.getBoundingClientRect().bottom).toFixed(2) : null,
    railCentreFromVpBottom: railList ? +(vh - (railList.getBoundingClientRect().top + railList.getBoundingClientRect().height / 2)).toFixed(2) : null,
    inspireMarkCentreFromVpBottom: inspireMark ? +(vh - (inspireMark.getBoundingClientRect().top + inspireMark.getBoundingClientRect().height / 2)).toFixed(2) : null,
    inspireMarkBottomFromVpBottom: railGlyphBottom != null ? +(vh - railGlyphBottom).toFixed(2) : null,
    rootVars: (() => { const c = getComputedStyle(document.documentElement); return ['--nav-centre-bottom', '--nav-hero-lift', '--nav-content-u', '--nav-major', '--nav-centre-bottom'].map(k => k + '=' + c.getPropertyValue(k).trim()).join(' | '); })(),
  };
};
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const out = {};
  const shot = (page, name) => page.screenshot({ path: `${S}/captures/H3-ui/${name}.png`, timeout: 170000 });
  try {
    for (const mode of MODES) for (const v of (process.env.VPS ? VP.filter(x=>process.env.VPS.split(",").includes(x.name)) : VP)) {
      const key = `${mode}-${v.name}`;
      const ctx = await browser.newContext({ viewport: { width: v.w, height: v.h }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
      const page = await ctx.newPage();
      page.setDefaultTimeout(120000);
      const url = mode === 'nointro' ? 'http://localhost:8137/?nointro=1' : mode === 'deep' ? 'http://localhost:8137/?nointro=1#/inspire' : 'http://localhost:8137/';
      await page.goto(url, { waitUntil: 'load' });
      await page.waitForTimeout(mode === 'intro' ? 40000 : 9000);
      if (mode !== 'deep') { const settled = await page.evaluate(measure); out[key + '/settled'] = settled; await shot(page, `U3-${key}-settled`); }
      if (mode === 'nointro' || mode === 'deep') {
        await page.locator('.j-rail-list > [data-chapter="inspire"] .j-rail-item').tap({timeout:60000}).catch(e => { out[key + '/tapErr'] = String(e).slice(0,300); });
        await page.waitForTimeout(20000);
        out[key + '/hash'] = await page.evaluate(() => location.hash);
        out[key + '/inspire'] = await page.evaluate(measure);
        await shot(page, `U3-${key}-inspire`);
      }
      await ctx.close();
    }
  } finally { await browser.close(); }
  fs.writeFileSync(`${S}/findings/H3-U3-measure-${MODES.join('-')}.json`, JSON.stringify(out, null, 2));
  console.log('DONE');
})().catch(e => { console.error('ERR', e); process.exit(1); });
