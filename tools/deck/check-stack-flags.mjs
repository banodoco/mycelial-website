import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';

const base = process.argv[2] || 'http://127.0.0.1:8240/mycelial/index.html';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const errors = [];
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
const page = await context.newPage();
page.on('pageerror', e => errors.push(e.message));
const wait = ms => page.waitForTimeout(ms);
const settled = n => page.waitForFunction(n => { const s = document.querySelectorAll('.slide')[n - 1]; return s.classList.contains('on') && s.hasAttribute('data-settled'); }, n, { timeout: 30000 });
const flags = () => page.locator('.slide.on .st-flag');
async function flagState() {
  return flags().evaluateAll(els => els.map(el => {
    const r = el.getBoundingClientRect(), root = el.closest('.st').getBoundingClientRect(), style = getComputedStyle(el);
    const x = r.left + r.width / 2, y = r.top + r.height / 2, hit = document.elementFromPoint(x, y);
    return { text: el.querySelector('.st-short').textContent, opacity: +style.opacity, progress: +el.style.getPropertyValue('--in'),
      rect: { left: r.left, right: r.right, top: r.top, bottom: r.bottom },
      inside: r.left >= root.left && r.right <= root.right && r.top >= root.top && r.bottom <= root.bottom,
      hit: hit === el || el.contains(hit) };
  }));
}
async function verifyFlags(click = true) {
  await wait(700); // CSS opacity transition must finish before hit/visual assertions.
  const state = await flagState();
  assert.equal(state.length, 5);
  for (const flag of state) assert(flag.text && flag.opacity > 0.98 && flag.inside && flag.hit, JSON.stringify(flag));
  if (click) {
    for (let i = 0; i < 5; i++) {
      await flags().nth(i).click();
      await page.waitForFunction(i => document.querySelectorAll('.slide.on .st-flag')[i]?.getAttribute('aria-expanded') === 'true', i, { timeout: 3000 });
      assert.equal(await flags().nth(i).getAttribute('aria-expanded'), 'true', `flag ${i} did not open`);
    }
  }
  return state;
}
try {
  await page.goto(`${base}#6`); await settled(6);
  const direct = await verifyFlags();
  await page.goto(`${base}#5`); await settled(5);
  await page.keyboard.press('ArrowRight');
  const samples = [];
  for (let n = 0; n < 50; n++) {
    await wait(100);
    if (await page.locator('.slide.on .st-flag').count()) samples.push((await flagState()).map(f => f.progress));
  }
  await settled(6);
  const arrival = await verifyFlags();
  assert(samples.some(s => s.some(q => q > 0 && q < 1)), 'entry never showed intermediate flag progress');
  await page.setViewportSize({ width: 375, height: 812 }); await wait(700); await settled(6);
  const resized = await verifyFlags();
  await page.keyboard.press('ArrowLeft'); await settled(5);
  await page.keyboard.press('ArrowRight'); await settled(6);
  const returned = await verifyFlags();
  // Suppress only the stack's thread canvas context before the scene initializes.
  // Its DOM buttons must still reach full reveal on direct entry.
  await context.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(...args) {
      return this.classList.contains('st-threads') ? null : original.apply(this, args);
    };
  });
  const faultPage = await context.newPage();
  const faultErrors = []; faultPage.on('pageerror', e => faultErrors.push(e.message));
  await faultPage.goto(`${base}#6`);
  await faultPage.waitForFunction(() => document.querySelectorAll('.slide')[5].hasAttribute('data-settled'), null, { timeout: 30000 });
  const withoutCanvas = await faultPage.locator('.slide.on .st-flag').evaluateAll(els => els.map(el => +el.style.getPropertyValue('--in')));
  assert.deepEqual(withoutCanvas, [1, 1, 1, 1, 1]);
  assert.deepEqual(faultErrors, []);
  await faultPage.close();
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ direct, samples, arrival, resized, returned, withoutCanvas, faultErrors, errors }, null, 2));
} finally { await context.close(); await browser.close(); }
