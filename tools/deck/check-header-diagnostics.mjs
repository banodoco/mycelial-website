// Debug-only interventions must survive drift and isolate font from ink.
// Desktop Chrome with a phone viewport is not a physical iOS reproduction.
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
const base = process.argv[2] || 'http://127.0.0.1:8240/mycelial/index.html';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 669 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const settled = n => page.waitForFunction(n => {
  const slide = document.querySelectorAll('.slide')[n - 1];
  return slide.classList.contains('on') && slide.hasAttribute('data-settled');
}, n, { timeout: 30000 });
const tap = label => page.locator('#dbg-panel button').filter({ hasText: new RegExp(`^${label}$`) }).click();
const read = () => page.evaluate(() => {
  const slide = document.querySelector('.slide.on'), col = slide.querySelector(':scope > .split > :first-child');
  const h = col.querySelector('h1'), em = h.querySelector('em'), style = getComputedStyle(h), emphasis = getComputedStyle(em);
  return { transform: getComputedStyle(col).transform, dot: getComputedStyle(document.querySelector('.dt-dot')).transform,
    font: style.fontFamily, fill: style.webkitTextFillColor, emphasisFont: emphasis.fontFamily, emphasisFill: emphasis.webkitTextFillColor,
    emphasisBackground: emphasis.backgroundImage, hidden: !!slide.querySelector('.dt-copy-hidden'), clones: document.querySelectorAll('.dt-copy-overlay').length };
});
try {
  await page.goto(`${base}#2`); await settled(2);
  await page.keyboard.press('ArrowRight'); await settled(3); await page.waitForTimeout(400);
  const ordinary = await read();
  assert.equal(ordinary.transform, 'none', 'slide 3 canonical copy remains stationary');
  assert.equal(await page.locator('#dbg-panel').count(), 0);
  assert.equal(await page.locator('[data-deck-debug-flat],[data-deck-debug-font],[data-deck-debug-ink]').count(), 0);
  await page.goto(`${base}?debug=1#2`); await settled(2);
  await page.keyboard.press('ArrowRight'); await settled(3); await page.waitForTimeout(400);
  const normal = await read();
  assert.equal(await page.locator('#dbg-panel pre').isVisible(), false, 'diagnostic output starts collapsed');
  assert.equal(normal.font, ordinary.font); assert.equal(normal.fill, ordinary.fill);
  await tap('flat'); const flat = await read(); await page.waitForTimeout(500); const flatLater = await read();
  assert.equal(flat.transform, 'none'); assert.equal(flatLater.transform, 'none', 'flat survives ongoing inline drift writes');
  assert.notEqual(flat.dot, flatLater.dot, 'flat does not stop the ambient node clock');
  assert.equal(flat.font, normal.font); assert.equal(flat.fill, normal.fill);
  await tap('flat'); await page.waitForTimeout(200);
  assert.equal((await read()).transform, 'none', 'toggling flat off retains slide 3 stable paint');
  await tap('font'); const fontOnly = await read();
  assert.match(fontOnly.font, /Georgia/); assert.doesNotMatch(fontOnly.font, /Cormorant/);
  assert.equal(fontOnly.fill, normal.fill); assert.equal(fontOnly.emphasisFill, normal.emphasisFill);
  assert.equal(fontOnly.emphasisBackground, normal.emphasisBackground, 'font-only retains gradient ink');
  await tap('reset'); await tap('ink'); const inkOnly = await read();
  assert.equal(inkOnly.font, normal.font); assert.equal(inkOnly.emphasisFont, normal.emphasisFont);
  assert.equal(inkOnly.fill, 'rgb(255, 0, 0)'); assert.equal(inkOnly.emphasisFill, 'rgb(255, 0, 0)');
  await tap('canvases');
  assert.equal(await page.locator('canvas').first().evaluate(el => getComputedStyle(el).visibility), 'hidden');
  await tap('reset'); await page.waitForTimeout(300);
  const reset = await read();
  assert.equal(reset.font, normal.font); assert.equal(reset.fill, normal.fill);
  assert.equal(reset.transform, 'none'); assert.equal(reset.hidden, false); assert.equal(reset.clones, 0);
  assert.equal(await page.locator('[data-deck-debug-flat],[data-deck-debug-font],[data-deck-debug-ink],[data-deck-debug-canvases]').count(), 0);
  await page.keyboard.press('ArrowRight'); await settled(4);
  await page.keyboard.press('ArrowLeft'); await settled(3); await page.waitForTimeout(300);
  const snapshot = await page.evaluate(() => window.__deckDebug.textSnapshot);
  assert(snapshot.samples.some(sample => sample.label === 'departure' && sample.controller.index === 2));
  assert(snapshot.samples.some(sample => sample.label === 'before ink'));
  assert(snapshot.fonts.faces.some(face => face.family.includes('Cormorant') && face.unicodeRange && face.status));
  assert(snapshot.copy.h1.textLength > 0 && snapshot.copy.h1.font.family.includes('Cormorant'));
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined }));
  await tap('copy log');
  const exported = JSON.parse(await page.locator('#dbg-panel textarea').inputValue());
  assert.equal(exported.controller.index, 2); assert(exported.samples.length > 0);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ actualIOS: false, runtime: await browser.version(), slide3StablePaintPreserved: true,
    flatPersistentAndReversible: true, fontAndInkIsolated: true, resetRestoresStyles: true,
    departureSamplesAndFontFacesRecorded: true, lanClipboardFallback: true, errors }, null, 2));
} finally { await browser.close(); }
