// Debug-only art capture; phone Chrome is not a physical iOS reproduction.
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
const base = process.argv[2] || 'http://127.0.0.1:8240/mycelial/index.html';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 669 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const settled = n => page.waitForFunction(n => {
  const s = document.querySelectorAll('.slide')[n - 1];
  return s.classList.contains('on') && s.hasAttribute('data-settled');
}, n, { timeout: 30000 });
try {
  await page.goto(`${base}#5`); await settled(5);
  assert.equal(await page.locator('#dbg-panel').count(), 0, 'ordinary visits have no diagnostic UI');
  await page.goto(`${base}?debug=1#4`); await settled(4);
  await page.keyboard.press('ArrowRight'); await settled(5); await page.waitForTimeout(350);
  await page.keyboard.press('ArrowLeft'); await settled(4);
  await page.keyboard.press('ArrowRight'); await settled(5); await page.waitForTimeout(350);
  const snapshot = await page.evaluate(() => window.__deckDebug.textSnapshot);
  assert.equal(snapshot.controller.index, 4);
  assert(snapshot.art.nodes.host.classes.includes('on'));
  for (const name of ['root', 'stage', 'chat', 'editor', 'preview']) {
    const node = snapshot.art.nodes[name];
    assert(node.rect[2] > 0 && node.rect[3] > 0, `${name} has measurable geometry`);
    assert.equal(node.visibility, 'visible');
    assert.equal(typeof node.transform, 'string');
    assert(Array.isArray(node.animations));
  }
  assert.equal(snapshot.art.nodes.editor.opacity, '1');
  assert(snapshot.art.canvas.width > 0 && snapshot.art.canvas.height > 0);
  assert(snapshot.art.media.every(v => Number.isInteger(v.readyState) && typeof v.paused === 'boolean'));
  assert(snapshot.samples.some(s => s.label === 'departure' && s.controller.index === 4 && s.art));
  assert(snapshot.samples.some(s => s.label === 'slide5 return' && s.art));
  assert(snapshot.samples.some(s => s.label === 'slide5 settled' && s.art));
  assert(snapshot.samples.some(s => s.label.startsWith('phase ') && s.copy.ancestors.length));
  assert(snapshot.samples.some(s => s.label.startsWith('after phase ')));
  assert(snapshot.copy.ancestors.some(n => n.classes.includes('slide')));
  assert.equal(await page.locator('#dbg-panel pre').isVisible(), false);
  const before = await page.locator('.as-host .as').getAttribute('class');
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined }));
  await page.locator('#dbg-panel button').filter({ hasText: /^copy log$/ }).click();
  const exported = JSON.parse(await page.locator('#dbg-panel textarea').inputValue());
  assert.equal(exported.controller.index, 4);
  assert(exported.art.nodes.editor.rect[2] > 0 && exported.samples.some(s => s.art));
  assert.equal(await page.locator('.as-host .as').getAttribute('class'), before, 'copy log does not change demo classes');
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ actualIOS: false, normalVisitsUnchanged: true, artCurrentDepartureReturnAndSettlement: true,
    copyPhaseAndAncestorCapture: true, lanTextExport: true, errors }, null, 2));
} finally { await browser.close(); }
