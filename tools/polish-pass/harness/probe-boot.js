const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', e => console.log('PAGEERR', String(e).slice(0, 200)));
  await page.clock.install({ time: 0 });
  await page.clock.pauseAt(1000);
  const t0 = Date.now();
  await page.goto('http://localhost:8137/?nointro=1', { waitUntil: 'load', timeout: 90000 });
  let n = 0;
  for (; n < 4000; n++) {
    const ok = await page.evaluate(() => !!(window.journey && window.journey.hero && window.journey.hero.camera && window.journey.scroll && window.journey.scroll.enabled)).catch(() => false);
    if (ok) break;
    await page.clock.runFor(16.667);
  }
  console.log('ready after', n, 'steps', Date.now() - t0, 'ms');
  const a = await page.evaluate(() => performance.now());
  await new Promise(r => setTimeout(r, 1000));
  const a2 = await page.evaluate(() => performance.now());
  console.log('fake now stable while idle (should be equal):', a, a2);
  await page.clock.runFor(16.667);
  const b = await page.evaluate(() => performance.now());
  console.log('delta per runFor(16.667):', (b - a2).toFixed(3));
  console.log(JSON.stringify(await page.evaluate(() => ({ p: window.journey.p, cam: window.journey.hero.camera.position.toArray(), fov: window.journey.hero.camera.fov, chapters: Object.keys(window.journey.chapters), blocks: [...document.querySelectorAll('.j-block')].map(b => b.className + ' h=' + (b.querySelector('.j-h')?.textContent || '').slice(0, 25)) }))));
  await browser.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
