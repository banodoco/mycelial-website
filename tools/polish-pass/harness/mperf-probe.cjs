const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('[pageerror]', e.message));
  await page.goto('http://localhost:8145/?nointro=1');
  await page.waitForFunction(() => window.journey && window.journey.chapter, null, { timeout: 600000 });
  await page.evaluate(() => window.journey.flyTo('final'));
  await page.waitForFunction(() => window.journey.chapter === 'final', null, { timeout: 600000 });
  await page.waitForTimeout(20000);
  const r = await page.evaluate(async () => {
    const m = await import('/journey/manifesto/branch.js');
    const c = globalThis[Symbol.for('mycelial.manifesto.aerialColony')];
    const info = window.sceneApi.renderer.info.memory;
    const out = { hasColony: !!c, composer: !!window.sceneApi.composer, geomsBefore: info.geometries, results: [] };
    for (let i = 0; i < 30; i++) {
      let res; try { res = m.prewarmManifesto({ budgetMs: 8 }); } catch (e) { res = 'ERR ' + e.message; }
      out.results.push(res); if (res === true) break;
    }
    out.geomsAfter = info.geometries;
    const g = c.group; out.groupVisible = g.visible; out.children = g.children.length;
    out.groundFrustum = g.children.map(o => o.frustumCulled).join('');
    let p = g, chain = []; while (p) { chain.push(p.name + ':' + p.visible); p = p.parent; } out.chain = chain;
    return out;
  });
  console.log(JSON.stringify(r));
  await browser.close();
})();
