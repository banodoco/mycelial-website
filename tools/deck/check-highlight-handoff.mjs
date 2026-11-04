// Same-visit pixel comparison, with no saved screenshot baseline.
// WebKit on macOS is not a physical iOS reproduction.
import assert from 'node:assert/strict';
import { chromium, webkit } from 'playwright-core';
import { readFile } from 'node:fs/promises';
const base = process.argv[2] || 'http://127.0.0.1:8257/mycelial/index.html';
const baseline = process.env.BASELINE_COPY_JS && await readFile(process.env.BASELINE_COPY_JS, 'utf8');
const results = [], errors = [];
const settled = (p, n) => p.waitForFunction(n => {
  const s = document.querySelectorAll('.slide')[n - 1];
  return s.classList.contains('on') && s.hasAttribute('data-settled');
}, n, { timeout: 30000 });
const clean = async (p, n) => {
  await settled(p, n);
  assert.deepEqual(await p.evaluate(() => ({ clones: window.deckCopy.liveCloneCount,
    hidden: !!document.querySelector('.slide.on .dt-copy-hidden'),
    failed: document.querySelector('.slide.on').dataset.deckFailed || null })), { clones: 0, hidden: false, failed: null });
};
// Read actual screenshot pixels in the browser's PNG decoder. Restrict signal
// to gold rather than cream copy/background; compare each visit with itself.
const gold = async (p, png) => p.evaluate(async src => {
  const image = new Image(); image.src = src; await image.decode();
  const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
  const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
  const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
  let energy = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    if (r - g > 12 && g - b > 15 && r > 45) energy += r + g + b;
  }
  return energy;
}, `data:image/png;base64,${png.toString('base64')}`);
for (const [engine, type] of [['chromium', chromium], ['webkit', webkit]]) {
  const browser = await type.launch(engine === 'chromium'
    ? { channel: 'chrome', headless: true } : { headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 669 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    page.on('pageerror', error => errors.push(`${engine}: ${error.message}`));
    if (baseline) await page.route('**/dot-transitions.js', route => route.fulfill({ body: baseline, contentType: 'application/javascript' }));
    for (const n of [2, 3, 4, 5]) {
      // A query change guarantees a fresh document, not same-document hash navigation.
      await page.goto(`${base}?handoff=${n}#${n - 1}`); await clean(page, n - 1); await page.waitForTimeout(750);
      await page.evaluate(n => {
        const original = window.deckCopy.show;
        window.__handoff = { original };
        window.deckCopy.show = function(slide) {
          if (slide === document.querySelectorAll('.slide')[n - 1] && slide.classList.contains('on') && slide.querySelector('.dt-copy-overlay')) {
            window.__handoff.slide = slide; return true;
          }
          return original.call(this, slide);
        };
      }, n);
      await page.keyboard.press('ArrowRight'); await page.waitForFunction(() => window.__handoff.slide, null, { timeout: 30000 });
      const before = await page.evaluate(() => {
        const s = window.__handoff.slide, col = s.querySelector('.split > :first-child'), overlay = s.querySelector('.dt-copy-overlay');
        const content = col.matches('.gap-copy') ? col.querySelector('.gap-copy-content:not(.dt-copy-overlay)') : col;
        const r = overlay.querySelector('h1').getBoundingClientRect();
        const geometry = el => { const range = document.createRange(); range.selectNodeContents(el); return [...range.getClientRects()].filter(r => r.width && r.height).map(r => [r.x, r.y, r.width, r.height]); };
        const ink = el => { const c = getComputedStyle(el); return [c.fontFamily, c.fontSize, c.fontWeight, c.backgroundImage, c.backgroundClip, c.webkitTextFillColor]; };
        return { canonicalHidden: getComputedStyle(content).visibility === 'hidden', inert: overlay.inert,
          originalLines: geometry(content.querySelector('h1')), cloneLines: geometry(overlay.querySelector('h1')),
          originalInk: ink(content.querySelector('h1 em')), cloneInk: ink(overlay.querySelector('h1 em')),
          clip: { x: Math.max(0, Math.floor(r.x) - 3), y: Math.max(0, Math.floor(r.y) - 3), width: Math.ceil(r.width) + 6, height: Math.ceil(r.height) + 6 } };
      });
      assert(before.canonicalHidden && before.inert, 'capture must contain only disposable paint');
      assert.deepEqual(before.cloneInk, before.originalInk, 'retain typography and gradient');
      assert.equal(before.cloneLines.length, before.originalLines.length, 'retain heading line count');
      before.cloneLines.forEach((r, i) => r.forEach((v, j) => assert(Math.abs(v - before.originalLines[i][j]) < .5, 'retain line geometry')));
      const pre = await gold(page, await page.screenshot({ clip: before.clip }));
      await page.evaluate(() => { const h = window.__handoff; window.deckCopy.show = h.original; window.deckCopy.show(h.slide); });
      const post = await gold(page, await page.screenshot({ clip: before.clip }));
      await clean(page, n); await page.waitForTimeout(250);
      const post250 = await gold(page, await page.screenshot({ clip: before.clip }));
      const ratios = [pre / post, pre / post250];
      assert(ratios.every(r => r > .95 && r < 1.05), `${engine} slide ${n} gold energy changes at handoff: ${ratios}`);
      results.push({ engine, slide: n, ratios });
    }
    // Existing navigation and lifecycle owners remain authoritative.
    await page.goto(`${base}?lifecycle=1#2`); await clean(page, 2);
    for (const [key, n] of [['ArrowRight', 3], ['ArrowLeft', 2], ['ArrowRight', 3], ['ArrowRight', 4], ['ArrowLeft', 3]]) { await page.keyboard.press(key); await clean(page, n); }
    const drift = await page.locator('.slide.on .split > :first-child').evaluate(el => el.style.transform);
    await page.waitForFunction(previous => document.querySelector('.slide.on .split > :first-child').style.transform !== previous, drift, { timeout: 5000 });
    await page.goto(`${base}?resize=1#2`); await clean(page, 2); await page.keyboard.press('ArrowRight');
    await page.waitForFunction(() => document.querySelector('.gap-copy-paint'));
    await page.keyboard.press('o'); await page.waitForTimeout(250);
    assert(await page.locator('#overview').evaluate(el => el.classList.contains('on')));
    await page.keyboard.press('Escape');
    await page.setViewportSize({ width: 414, height: 736 }); await clean(page, 3);
    await page.keyboard.press('ArrowRight'); await page.waitForTimeout(120); await page.keyboard.press('ArrowLeft'); await clean(page, 3);
    await page.emulateMedia({ reducedMotion: 'reduce' }); await page.goto(`${base}?reduced=1#2`); await clean(page, 2);
    await page.keyboard.press('ArrowRight'); await clean(page, 3);
    results.push({ engine, lifecycle: ['repeated 2→3', '4→3', 'overview pause during reveal', 'resize during reveal', 'queued return', 'reduced motion'] });
  } finally { await browser.close(); }
}
assert.deepEqual(errors, []);
console.log(JSON.stringify({ passed: true, actualIOS: false, results, errors }, null, 2));
