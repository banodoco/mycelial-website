const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await (await browser.newContext({ viewport: { width: 800, height: 500 } })).newPage();
  await page.goto(`http://localhost:${process.argv[2]||8246}/?nointro=1`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.journey && window.journey.chapter, null, { timeout: 180000 });
  const r = await page.evaluate(() => {
    const out = {};
    for (const [id, c] of Object.entries(window.journey.chapters)) {
      if (!c || !c.group) { out[id] = 'no group'; continue; }
      const rows = [];
      const geomBytes = (root) => { const seen = new Set(); let b = 0, n = 0; root.traverse((o) => { const g = o.geometry; if (!g || seen.has(g)) return; seen.add(g); n++;
        for (const a of Object.values(g.attributes)) b += (a.array || (a.data && a.data.array) || {byteLength:0}).byteLength; if (g.index) b += g.index.array.byteLength;
        if (o.isInstancedMesh) b += o.instanceMatrix.array.byteLength; }); return [n, b]; };
      for (const ch of c.group.children) { const [n, b] = geomBytes(ch); let cnt = 0; ch.traverse(() => cnt++); rows.push([ch.name || ch.type, cnt, n, +(b/1e6).toFixed(3)]); }
      out[id] = { parent: c.group.parent && (c.group.parent.isScene ? 'scene' : c.group.parent.name || c.group.parent.type), rows };
    }
    const top = window.journey.hero.scene.children.map((c) => (c.name || c.type) + (c.visible ? '' : '(h)'));
    return { out, top };
  });
  console.log(JSON.stringify(r));
  await browser.close();
})();
