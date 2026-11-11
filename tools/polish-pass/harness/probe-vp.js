const { chromium } = require('playwright');
(async () => {
  const vw = +process.argv[2], vh = +process.argv[3];
  const browser = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: vw, height: vh } });
  page.on('pageerror', e => console.log('PAGEERR', String(e).slice(0, 200)));
  await page.clock.install({ time: 0 });
  await page.clock.pauseAt(1000);
  const t0 = Date.now();
  await page.goto('http://localhost:8137/?nointro=1', { waitUntil: 'load', timeout: 90000 });
  console.log('loaded', Date.now() - t0);
  for (let n = 0; n < 120; n++) {
    const en = await page.evaluate(() => !!(window.journey && window.journey.scroll && window.journey.scroll.enabled)).catch(() => 'err');
    if (n % 5 === 0) console.log('step', n, Date.now() - t0, en);
    if (en === true) break;
    await page.clock.runFor(17); await new Promise(r => setTimeout(r, 150));
  }
  console.log('done', Date.now() - t0);
  await browser.close();
})().catch(e => { console.error('FAIL', e.message.slice(0,300)); process.exit(1); });
