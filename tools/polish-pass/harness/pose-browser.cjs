// IMPL-pose sanity: 390x844 phone, fake clock; open manifesto from Purpose, play to the end, Return.
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = '/tmp/claude-0/-home-user/62a00d20-ec8d-551d-aa8b-33233b07a42e/scratchpad/captures/IMPL-pose';
fs.mkdirSync(OUT, { recursive: true });
const PORT = process.env.PORT || 8144;
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const errors = [];
  try {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    const p = await ctx.newPage();
    p.on('pageerror', e => errors.push('pageerror ' + e.message));
    p.on('console', m => { if (m.type() === 'error') errors.push('console ' + m.text()); });
    await p.goto(`http://localhost:${PORT}/?nointro=1#/final`, { waitUntil: 'load' });
    const cdp = await ctx.newCDPSession(p);
    const grab = async (name) => { const r = await cdp.send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(`${OUT}/${name}.png`, Buffer.from(r.data, 'base64')); };
    await p.waitForFunction(() => !!window.journey && !!document.querySelector('.j-rail:not(.j-rail-preboot)'), null, { timeout: 240000, polling: 500 });
    await p.waitForFunction(() => window.journey.chapter === 'final' && Math.abs(window.journey.p - window.journey.travelP) < 1e-4, null, { timeout: 240000, polling: 1000 });
    await p.waitForTimeout(8000);
    console.log('purpose', await p.evaluate(() => [window.journey.chapter, window.journey.p, location.hash].join(' ')));
    await grab('00-purpose');
    await p.clock.install(); await p.clock.pauseAt(Date.now() + 1000);
    await p.evaluate(() => window.journey.flyTo('manifesto'));
    let t = 0;
    // fastForward fires each due rAF once: one rendered frame per 0.2 s step; the branch steps by wall time.
    const stepTo = async (sec) => { while (t < sec - 1e-6) { const d = Math.min(0.2, sec - t); await p.clock.fastForward(Math.round(d * 1000)); t += d; } };
    const shot = async (name) => { await p.clock.runFor(16.667); t += 1 / 60; await grab(name); };
    const state = () => p.evaluate(() => ({ open: document.body.classList.contains('j-manifesto-open'), shown: document.querySelectorAll('.j-manifesto-lines .shown, .j-manifesto-line.shown, .shown').length, chapter: window.journey.chapter }));
    const log = [];
    for (const [sec, name] of [[0.5, '01-t0.5'], [2, '02-t2'], [5, '03-t5'], [12, '04-t12'], [24, '05-t24'], [34.5, '06-end']]) {
      await stepTo(sec); log.push([sec, await state()]); await shot(name);
      console.log('at', sec, JSON.stringify(log.at(-1)[1]), 'errors', errors.length);
    }
    await p.evaluate(() => window.journey.flyTo('final'));
    const r0 = t;
    for (const [dt, name] of [[2.4, '07-return-2.4'], [5.5, '08-landed']]) { await stepTo(r0 + dt); log.push([`ret+${dt}`, await state()]); await shot(name); console.log('ret', dt, JSON.stringify(log.at(-1)[1])); }
    fs.writeFileSync(`${OUT}/run.json`, JSON.stringify({ log, errors }, null, 2));
    console.log('DONE errors:', errors.length, errors.slice(0, 5));
    await ctx.close();
  } finally { await b.close(); }
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
