const { chromium } = require('playwright');
(async () => {
  const vw = +process.argv[2], vh = +process.argv[3];
  const browser = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: vw, height: vh }, deviceScaleFactor: 1 });
  await page.clock.install({ time: 0 });
  await page.clock.pauseAt(1000);
  const t0 = Date.now();
  await page.goto('http://localhost:8137/?nointro=1', { waitUntil: 'load', timeout: 90000 });
  const STEP = [17, 17, 16];
  for (let n = 0; n < 40; n++) {
    let t = Date.now();
    await page.clock.runFor(STEP[n % 3]); const a = Date.now() - t; t = Date.now();
    const en = await page.evaluate(() => !!(window.journey && window.journey.scroll && window.journey.scroll.enabled)).catch(() => 'err'); const b = Date.now() - t;
    console.log('n', n, 'runFor ms', a, 'eval ms', b, 'en', en, 'since start', Date.now() - t0);
    if (en === true) break;
    await new Promise(r => setTimeout(r, 150));
  }
  await browser.close();
})().catch(e => { console.error('FAIL', e.message.slice(0,300)); process.exit(1); });
