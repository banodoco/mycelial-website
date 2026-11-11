// VERIFY check 6 supplement: computed style of the "open models" phrase, rest vs hover (MERGED, no screenshots).
const { chromium } = require('playwright');
const port = process.argv[2] || '8150';
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1024, height: 640 }, reducedMotion: 'reduce' });
    page.setDefaultTimeout(600000);
    await page.goto(`http://localhost:${port}/?nointro=1`);
    await page.waitForFunction(() => window.journey, null, { timeout: 600000 });
    await page.evaluate(() => window.journey.flyTo('manifesto'));
    await page.waitForSelector('.j-manifesto.is-open');
    await page.waitForFunction(() => document.querySelectorAll('.j-manifesto-line.shown').length === 5);
    await page.waitForTimeout(3000);
    const word = page.locator('.manifesto-phrase-thread .j-manifesto-word').first();
    const phrase = page.locator('.manifesto-phrase-thread').first();
    const pick = () => page.evaluate(() => {
      const w = [...document.querySelectorAll('.j-manifesto-word')].find(e => /open/.test(e.textContent) && /models|tools/.test(e.closest('.manifesto-phrase-thread, p, div')?.textContent || ''));
      const el = w || document.querySelector('.manifesto-phrase-thread');
      const pe = el.closest('.manifesto-phrase-thread') || el;
      const pick = (n) => { const s = getComputedStyle(n); return { color: s.color, textDecorationLine: s.textDecorationLine, textDecorationColor: s.textDecorationColor, backgroundImage: s.backgroundImage.slice(0, 120), opacity: s.opacity, cursor: s.cursor, pointerEvents: s.pointerEvents, filter: s.filter, textShadow: s.textShadow, transform: s.transform, transition: s.transition.slice(0, 120) }; };
      const thread = document.querySelector('.manifesto-phrase-thread');
      const root = getComputedStyle(thread);
      return { word: pick(el), thread: pick(thread), threadVars: { hover: root.getPropertyValue('--thread-hover').trim(), strength: root.getPropertyValue('--thread-strength').trim() }, wordText: el.textContent, hoverMatch: el.matches(':hover') || el.closest('.manifesto-phrase-thread').matches(':hover') };
    });
    const rest = await (async () => { await page.mouse.move(5, 5); await page.waitForTimeout(800); return pick(); })();
    const b = await word.boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 4 });
    await page.waitForTimeout(1200);
    const hov = await pick();
    const diff = {};
    for (const k of ['word', 'thread']) for (const p of Object.keys(rest[k])) if (rest[k][p] !== hov[k][p]) diff[`${k}.${p}`] = [rest[k][p], hov[k][p]];
    if (rest.threadVars.hover !== hov.threadVars.hover || rest.threadVars.strength !== hov.threadVars.strength) diff.threadVars = [rest.threadVars, hov.threadVars];
    console.log(JSON.stringify({ rest: rest, hover: hov, diff }, null, 1));
  } finally { await browser.close(); }
})().catch(e => { console.error('ERR', String(e).slice(0, 500)); process.exit(1); });
