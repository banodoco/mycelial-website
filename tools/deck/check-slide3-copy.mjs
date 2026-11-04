// Slide 3 has one semantic paint tree; radial clone parity is deliberately retired.
// Phone emulation cannot establish physical iOS paint behavior.
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
const base = process.argv.find(a => /^https?:/.test(a)) || 'http://127.0.0.1:8240/mycelial/index.html';
const settled = (p, n) => p.waitForFunction(n => document.querySelectorAll('.slide')[n - 1].matches('.on[data-settled]'), n, { timeout: 30000 });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const results = [];
try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 669 }, { width: 760, height: 390 }]) {
    const page = await browser.newPage({ viewport });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(() => {
      window.__gapFrames = [];
      const frame = () => {
        const host = document.querySelector('.gap-host.on .gap-copy-content');
        if (host) window.__gapFrames.push({ opacity: +getComputedStyle(host).opacity,
          alpha: +getComputedStyle(host).getPropertyValue('--gap-copy-alpha'),
          transforms: [host.parentElement, host].map(el => getComputedStyle(el).transform),
          clones: document.querySelectorAll('.gap-host .dt-copy-overlay').length,
          hidden: host.classList.contains('dt-copy-hidden'),
          masks: [host.parentElement, host, host.querySelector('h1')].map(el => getComputedStyle(el).maskImage) });
        requestAnimationFrame(frame);
      }; requestAnimationFrame(frame);
    });
    await page.goto(`${base}#2`); await settled(page, 2);
    const original = await page.locator('.gap-copy-content').elementHandle();
    for (let visit = 0; visit < 3; visit++) {
      await page.keyboard.press('ArrowRight'); await settled(page, 3);
      assert(await original.evaluate(el => el.isConnected && getComputedStyle(el).opacity === '1'));
      if (visit < 2) { await page.keyboard.press('ArrowLeft'); await settled(page, 2); }
    }
    const frames = await page.evaluate(() => window.__gapFrames);
    assert(frames.some(f => f.alpha > 0 && f.alpha < 1), 'reveal fades canonical ink');
    assert(frames.every(f => f.opacity === 1 && f.transforms.every(t => t === 'none') && f.clones === 0 && !f.hidden && f.masks.every(m => m === 'none')),
      'canonical surface stays opaque, stationary and unmasked');
    const endpoint = await page.evaluate(() => {
      const content = document.querySelector('.gap-copy-content'), emphasis = content.querySelector('h1 em');
      const probe = document.createElement('span'); probe.style.backgroundImage = 'var(--gild)'; document.body.appendChild(probe);
      const state = { heading: getComputedStyle(content.querySelector('h1')).color, body: getComputedStyle(content.querySelector('.body')).color,
        num: getComputedStyle(content.querySelector('.num')).color, gradient: getComputedStyle(emphasis).backgroundImage,
        referenceGradient: getComputedStyle(probe).backgroundImage };
      probe.remove(); return state;
    });
    assert.equal(endpoint.heading, 'rgb(239, 230, 214)'); assert.equal(endpoint.body, 'rgb(184, 169, 143)');
    assert.equal(endpoint.num, 'rgb(224, 171, 94)'); assert.equal(endpoint.gradient, endpoint.referenceGradient, 'retain exact gold gradient');
    const dot = page.locator('.gap-host.on .gp-dot').first();
    const point = await dot.locator('i').evaluate(el => { const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    assert(await page.evaluate(({ x, y }) => !!document.elementFromPoint(x, y)?.closest('.gp-dot'), point), 'copy stacking does not cover a chart tool');
    await page.mouse.click(point.x, point.y); assert(await dot.evaluate(el => el.classList.contains('is-open')), 'chart tool opens');
    await page.mouse.click(point.x, point.y); assert(await dot.evaluate(el => !el.classList.contains('is-open')), 'chart tool closes');
    assert.equal(await page.evaluate(() => window.deckNav.to), 2, 'chart interaction does not navigate');
    // Old owner cleanup must not change a successor's canonical ink alpha.
    const ownership = await page.evaluate(async () => {
      const slide = document.querySelector('.gap-host'), disposers = [], nextDisposers = [];
      const old = window.deckCopy.hide(slide, { transitionDefer: fn => disposers.push(fn) }, { x: 100, y: 100 });
      const next = window.deckCopy.hide(slide, { transitionDefer: fn => nextDisposers.push(fn) }, { x: 100, y: 100 });
      const oldResult = await old.done; disposers[0]();
      const successorAlpha = +slide.querySelector('.gap-copy-content').style.getPropertyValue('--gap-copy-alpha');
      window.deckCopy.show(slide); nextDisposers[0]();
      return { oldResult, nextResult: await next.done, successorAlpha, alpha: +getComputedStyle(slide.querySelector('.gap-copy-content')).getPropertyValue('--gap-copy-alpha'), opacity: getComputedStyle(slide.querySelector('.gap-copy-content')).opacity, clones: slide.querySelectorAll('.dt-copy-overlay').length };
    });
    assert.deepEqual(ownership, { oldResult: 'cancelled', nextResult: 'completed', successorAlpha: 0, alpha: 1, opacity: '1', clones: 0 });
    assert.deepEqual(errors, []); results.push({ viewport, frames: frames.length, endpoint, chartHitTests: true, ownership, errors });
    await page.close();
  }
  console.log(JSON.stringify(results, null, 2));
} finally { await browser.close(); }
