// Real mobile scene checks: DOM planes and controls must survive independently
// of the canvas decoration, media loading, and entry lifecycle notifications.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium, webkit } from 'playwright-core';

const base = process.argv[2] || 'http://127.0.0.1:8240/mycelial/index.html';
const engine = process.argv[3] || 'webkit';
const output = process.env.STACK_EVIDENCE_DIR;
if (output) mkdirSync(output, { recursive: true });
const browser = await ({ chromium, webkit }[engine]).launch({ headless: true,
  ...(engine === 'chromium' ? { executablePath: process.env.CHROMIUM_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' } : {}) });
const context = await browser.newContext({ viewport: { width: 390, height: 669 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const cases = [], errors = [];
const page = await context.newPage();
page.on('pageerror', e => errors.push(e.message));
const settled = (p, n) => p.waitForFunction(n => {
  const slide = document.querySelectorAll('.slide')[n - 1];
  return slide.classList.contains('on') && slide.hasAttribute('data-settled');
}, n, { timeout: 30000 });
const go = async n => { await page.evaluate(n => { location.hash = `#${n}`; }, n); await settled(page, n); };
async function visible(p, name) {
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(650); // Let the labels' CSS opacity transition finish.
  const state = await p.evaluate(() => {
    const root = document.querySelector('.slide.on [data-astrid-stack]');
    const inspect = el => {
      const r = el.getBoundingClientRect(), s = getComputedStyle(el);
      const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return { name: el.className, opacity: +s.opacity, visibility: s.visibility,
        width: r.width, height: r.height, left: r.left, top: r.top,
        inView: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight,
        hit: el === hit || el.contains(hit), tabIndex: el.tabIndex,
        contentOpacity: el.firstElementChild ? +getComputedStyle(el.firstElementChild).opacity : 0 };
    };
    const heading = root.closest('.slide').querySelector('h1'), hs = getComputedStyle(heading);
    return { planes: [...root.querySelectorAll('.st-plane')].map(inspect),
      flags: [...root.querySelectorAll('.st-flag')].map(inspect),
      card: root.querySelector('.st-card.is-open .st-ch')?.textContent,
      heading: { text: heading.textContent.trim(), opacity: +hs.opacity, visibility: hs.visibility },
      groupLabel: root.getAttribute('aria-label'),
      failed: root.closest('.slide').dataset.deckFailed,
      ghosts: root.querySelectorAll('.st-ghost,.st-carry').length };
  });
  assert.equal(state.failed, undefined, `${name}: failed scene`);
  assert.equal(state.planes.length, 5);
  assert.equal(state.flags.length, 5);
  assert(state.heading.text && state.heading.opacity > .98 && state.heading.visibility === 'visible', `${name}: invisible heading`);
  assert(state.groupLabel, `${name}: stack group has no accessible name`);
  for (const p of state.planes) assert(p.opacity > .98 && p.contentOpacity > .98 && p.width > 50 && p.height > 12 && p.inView && p.hit, `${name}: missing plane ${JSON.stringify(p)}`);
  for (const f of state.flags) assert(f.opacity > .98 && f.visibility === 'visible' && f.inView && f.hit && f.tabIndex === 0, `${name}: missing control ${JSON.stringify(f)}`);
  assert(state.card, `${name}: no mobile card`);
  assert.equal(state.ghosts, 0, `${name}: transient picture leaked`);
  cases.push({ name, ...state });
}
try {
  await page.goto(`${base}#5`); await settled(page, 5);
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(100);
  // A notification must not hand an unfinished build to the ambient tour.
  // Escape also emits deck-overview when the overview is already closed.
  await page.evaluate(() => dispatchEvent(new Event('deck-motion')));
  await page.keyboard.press('Escape');
  await settled(page, 6); await visible(page, '5→6 lifecycle notification during entry');
  if (output) await page.screenshot({ path: `${output}/stack-${engine}-event-after.png` });

  for (let n = 0; n < 2; n++) { await go(5); await go(6); await visible(page, `6→5→6 repeat ${n + 1}`); }
  for (let i = 0; i < 5; i++) {
    const flag = page.locator('.slide.on .st-flag').nth(i);
    await flag.tap();
    await page.waitForFunction(i => document.querySelectorAll('.slide.on .st-flag')[i].getAttribute('aria-expanded') === 'true', i);
  }
  await page.locator('.slide.on .st-flag').nth(2).tap();
  await page.waitForTimeout(100);
  const cardBefore = await page.locator('.slide.on .st-card.is-open .st-ch').textContent();
  await page.setViewportSize({ width: 375, height: 640 }); await page.waitForTimeout(500);
  await settled(page, 6); await visible(page, 'open card preserved on resize');
  assert.equal(await page.locator('.slide.on .st-card.is-open .st-ch').textContent(), cardBefore);

  await go(5); await page.keyboard.press('ArrowRight'); await page.waitForTimeout(100);
  await page.keyboard.press('o'); await page.waitForTimeout(250); await page.keyboard.press('o');
  await settled(page, 6); await visible(page, 'overview pauses and resumes entry');
  await go(5); await page.keyboard.press('ArrowRight'); await page.waitForTimeout(100);
  await page.setViewportSize({ width: 390, height: 669 });
  await settled(page, 6); await visible(page, 'resize interrupts entry');
  await go(7); await go(6); await visible(page, '6→7→6 return');
  await go(5); await page.keyboard.press('ArrowRight'); await page.waitForTimeout(100);
  await page.evaluate(() => window.deckTransaction('recover'));
  await settled(page, 6); await visible(page, 'controller recovery during entry');

  // No thread canvas: the five HTML panels and their controls remain usable.
  const fault = await context.newPage(); fault.on('pageerror', e => errors.push(e.message));
  await fault.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(...args) {
      return this.classList.contains('st-threads') ? null : original.apply(this, args);
    };
  });
  await fault.goto(`${base}#5`); await settled(fault, 5);
  await fault.keyboard.press('ArrowRight'); await settled(fault, 6);
  await visible(fault, 'thread canvas unavailable'); await fault.close();

  for (const kind of ['context throws during initialization', 'thread draw throws', 'first launch geometry throws', 'snapshot copy throws']) {
    const fault = await context.newPage(); fault.on('pageerror', e => errors.push(e.message));
    await fault.addInitScript(kind => {
      let failed = false;
      if (kind === 'context throws during initialization') {
        const original = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function(...args) {
          if (this.classList.contains('st-threads')) throw Error('fixture refused canvas');
          return original.apply(this, args);
        };
      } else if (kind === 'thread draw throws') {
        const original = CanvasRenderingContext2D.prototype.setTransform;
        CanvasRenderingContext2D.prototype.setTransform = function(...args) {
          if (this.canvas.classList.contains('st-threads')) throw Error('fixture lost thread drawing');
          return original.apply(this, args);
        };
      } else if (kind === 'first launch geometry throws') {
        const original = Element.prototype.getBoundingClientRect;
        Element.prototype.getBoundingClientRect = function(...args) {
          if (!failed && this.matches('.st-host.on h1')) { failed = true; throw Error('fixture first stack layout'); }
          return original.apply(this, args);
        };
      } else {
        const original = CanvasRenderingContext2D.prototype.drawImage;
        CanvasRenderingContext2D.prototype.drawImage = function(...args) {
          if (!failed && document.querySelector('.st-host.on') && this.canvas.matches('.as-pic')) {
            failed = true; throw Error('fixture snapshot allocation');
          }
          return original.apply(this, args);
        };
      }
    }, kind);
    await fault.goto(`${base}#${kind === 'first launch geometry throws' ? 6 : 5}`);
    await settled(fault, kind === 'first launch geometry throws' ? 6 : 5);
    if (kind !== 'first launch geometry throws') { await fault.keyboard.press('ArrowRight'); await settled(fault, 6); }
    await visible(fault, kind);
    if (kind === 'context throws during initialization' && output) await fault.screenshot({ path: `${output}/stack-${engine}-context-fallback.png` });
    await fault.close();
  }

  const media = await context.newPage(); media.on('pageerror', e => errors.push(e.message));
  await media.route('**/assets/astrid/**', async route => { await new Promise(resolve => setTimeout(resolve, 250)); await route.abort(); });
  await media.goto(`${base}#5`); await settled(media, 5);
  await media.keyboard.press('ArrowRight'); await settled(media, 6);
  await visible(media, 'media delayed and failed'); await media.close();

  const reduced = await browser.newPage({ viewport: { width: 390, height: 669 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  reduced.on('pageerror', e => errors.push(e.message));
  await reduced.goto(`${base}#6`); await settled(reduced, 6);
  await visible(reduced, 'reduced motion direct entry');
  await reduced.locator('.slide.on .st-flag').nth(4).tap();
  assert.equal(await reduced.locator('.slide.on .st-flag').nth(4).getAttribute('aria-expanded'), 'true');
  await reduced.close();
  assert.deepEqual(errors, []);
  const result = { engine, cases, errors };
  if (output) writeFileSync(`${output}/stack-${engine}-visibility.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ engine, cases: cases.map(c => c.name), errors }, null, 2));
} finally { await context.close(); await browser.close(); }
