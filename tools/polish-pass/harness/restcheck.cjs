// What blocks "at rest" at Purpose on a phone? node restcheck.cjs <port> [chapter]
const { chromium } = require('playwright');
const port = process.argv[2] || '8154'; const ch = process.argv[3] || 'final';
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(`http://localhost:${port}/?nointro=1&warmdraw=1`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.journey && window.journey.chapter, null, { timeout: 180000 });
  await page.waitForTimeout(5000);
  await page.evaluate((c) => window.journey.flyTo(c), ch);
  await page.waitForTimeout(500);
  await page.waitForFunction(() => !window.journey.transitionSeconds, null, { timeout: 600000, polling: 200 });
  for (let i = 0; i < 12; i++) {
    const s = await page.evaluate(() => { const j = window.journey, w = j.warmReport(); return { t: Math.round(performance.now()), atRest: j.atRest, ch: j.chapter, p: +j.p.toFixed(4), travelP: +j.travelP.toFixed(4), skip: w.lastSkip, restMs: w.restMs, units: w.units, log: w.log.slice(-3) }; });
    console.log(JSON.stringify(s));
    await page.waitForTimeout(3000);
  }
  await browser.close();
})();
