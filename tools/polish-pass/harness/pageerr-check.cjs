// VERIFY check 4: page errors/warnings on load WITH intro, 40 s settle, 2 viewports.
// Usage: node pageerr-check.cjs <port> <label>
const { chromium } = require('playwright');
const fs = require('fs');
const port = process.argv[2], label = process.argv[3];
const OUT = '/tmp/claude-0/-home-user/62a00d20-ec8d-551d-aa8b-33233b07a42e/scratchpad/captures/VERIFY-perf';
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const out = {};
  try {
    for (const v of [{ n: 'd800x500', w: 800, h: 500, m: false }, { n: 'm390x844', w: 390, h: 844, m: true }]) {
      const ctx = await browser.newContext({ viewport: { width: v.w, height: v.h }, deviceScaleFactor: 1, isMobile: v.m, hasTouch: v.m });
      const page = await ctx.newPage(); page.setDefaultTimeout(170000);
      const console_ = [], pageErrors = [];
      page.on('console', m => { if (/error|warn/i.test(m.type())) console_.push(`${m.type()}: ${m.text().slice(0, 300)}`); });
      page.on('pageerror', e => pageErrors.push(String(e.message).slice(0, 300)));
      await page.goto(`http://localhost:${port}/`, { waitUntil: 'load' });
      await page.waitForTimeout(40000);
      const qa = await page.evaluate(() => ({ __pageErrors: window.__pageErrors ? JSON.parse(JSON.stringify(window.__pageErrors)) : 'undefined', chapter: window.journey && window.journey.chapter, hash: location.hash })).catch(e => ({ evalErr: String(e).slice(0, 200) }));
      out[v.n] = { consoleErrorsOrWarnings: console_, pageErrors, qa };
      await ctx.close();
    }
  } finally { await browser.close(); }
  fs.writeFileSync(`${OUT}/pageerr-${label}.json`, JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out, null, 1).slice(0, 5000));
})().catch(e => { console.error('ERR', e); process.exit(1); });
