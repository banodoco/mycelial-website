const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'], headless: true });
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await p.goto('http://localhost:8137/?nointro=1', { waitUntil: 'load' });
  await p.waitForFunction(() => !!document.querySelector('.j-rail:not(.j-rail-preboot)') && !!window.journey, null, { timeout: 180000, polling: 500 });
  await p.locator('.j-rail .j-rail-slot[data-chapter="final"] .j-rail-item').first().click({ force: true });
  await p.waitForTimeout(90000);
  const s1 = await p.evaluate(() => { const m = document.querySelector('.j-rail-manifesto-item'); const t = document.querySelector('.j-rail-purpose-tree'); const r = m.getBoundingClientRect();
    return { prog: window.journey.progress, treeVis: getComputedStyle(t).visibility, treeInert: t.inert, itemInert: m.inert, itemPE: getComputedStyle(m).pointerEvents, rect: [r.x, r.y, r.width, r.height], hit: (document.elementFromPoint(r.x+r.width/2, r.y+r.height/2)||{}).className, rail: document.querySelector('.j-rail').className.slice(0,160), body: document.body.className.slice(0,160) }; });
  console.log('before click', JSON.stringify(s1));
  await p.mouse.click(s1.rect[0] + s1.rect[2] / 2, s1.rect[1] + s1.rect[3] / 2);
  await p.waitForTimeout(20000);
  const s2 = await p.evaluate(() => ({ manifesto: document.body.classList.contains('j-manifesto-open'), body: document.body.className.slice(0,200), prog: window.journey.progress }));
  console.log('after mouse click', JSON.stringify(s2));
  await b.close();
})().catch(e => { console.error('PROBE FAILED', e.message.slice(0, 300)); process.exit(1); });
