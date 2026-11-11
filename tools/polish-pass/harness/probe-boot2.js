const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', e => console.log('PAGEERR', String(e).slice(0, 200)));
  await page.clock.install({ time: 0 });
  await page.clock.pauseAt(1000);
  const t0 = Date.now();
  await page.goto('http://localhost:8137/?nointro=1', { waitUntil: 'load', timeout: 90000 });
  console.log('loaded', Date.now() - t0);
  for (let n = 0; n < 400; n++) {
    const st = await page.evaluate(() => ({ j: !!window.journey, h: !!(window.journey && window.journey.hero), cam: !!(window.journey && window.journey.hero && window.journey.hero.camera), sc: !!(window.journey && window.journey.scroll), en: !!(window.journey && window.journey.scroll && window.journey.scroll.enabled), sa: !!window.sceneApi })).catch(e => ({ err: String(e).slice(0,100) }));
    if (n % 25 === 0) console.log(n, Date.now() - t0, JSON.stringify(st));
    if (st.en) break;
    await page.clock.runFor(17); await new Promise(r => setTimeout(r, 150));
  }
  console.log('done', Date.now() - t0);
  await browser.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
