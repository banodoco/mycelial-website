const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'], headless: true });
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await p.goto('http://localhost:8137/?nointro=1', { waitUntil: 'load' });
  await p.waitForFunction(() => !!document.querySelector('.j-rail:not(.j-rail-preboot)') && !!window.journey, null, { timeout: 180000, polling: 500 });
  await p.locator('.j-rail .j-rail-slot[data-chapter="final"] .j-rail-item').first().click({ force: true });
  await p.waitForFunction(() => getComputedStyle(document.querySelector('.j-rail-purpose-tree')).visibility === 'visible' && window.__perf.stillFor(3000), null, { timeout: 300000, polling: 500 }).catch(()=>console.log('tree never visible'));
  const info = await p.evaluate(() => {
    const m = document.querySelector('.j-rail-manifesto-item');
    const r = m ? m.getBoundingClientRect() : null;
    const hit = r ? document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) : null;
    const purp = document.querySelector('.j-rail-purpose-tree');
    return { chapter: window.journey.chapter, progress: window.journey.progress, item: !!m, rect: r && [r.x, r.y, r.width, r.height],
      hit: hit && (hit.className || hit.tagName), treeHidden: purp && getComputedStyle(purp).display + '/' + getComputedStyle(purp).visibility + '/' + getComputedStyle(purp).opacity,
      treeClass: purp && purp.className, bodyCls: document.body.className.slice(0, 200), railCls: document.querySelector('.j-rail').className };
  });
  console.log(JSON.stringify(info, null, 1));
  await b.close();
})().catch(e => { console.error('PROBE FAILED', e.message.slice(0, 300)); process.exit(1); });
