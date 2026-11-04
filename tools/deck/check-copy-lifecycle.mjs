// Focused actual-Chrome copy cancellation, restoration, and resize checks.
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
const url = process.argv[2] || 'http://127.0.0.1:8246/mycelial/index.html';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const settled = n => page.waitForFunction(n => { const s = document.querySelectorAll('.slide')[n - 1]; return s.classList.contains('on') && s.hasAttribute('data-settled'); }, n, { timeout: 30000 });
try {
  await page.goto(`${url}#11`); await settled(11);
  const cancellation = await page.evaluate(async () => {
    const slide = document.querySelector('.slide.on'), disposers = [];
    const context = { transitionDefer: fn => { disposers.push(fn); }, geometry: null };
    const state = window.deckCopy.hide(slide, context, { x: 100, y: 100 });
    const during = window.deckCopy.liveCloneCount;
    disposers[0]();
    const result = await Promise.race([state.done, new Promise(resolve => setTimeout(() => resolve('pending'), 100))]);
    const after = { count: window.deckCopy.liveCloneCount, hidden: !!slide.querySelector('.dt-copy-hidden') };
    window.deckCopy.show(slide);
    disposers[0]();
    return { during, result, after, staleHidden: !!slide.querySelector('.dt-copy-hidden') };
  });
  assert(cancellation.during > 0); assert.equal(cancellation.result, 'cancelled');
  assert.deepEqual(cancellation.after, { count: 0, hidden: false }); assert.equal(cancellation.staleHidden, false);
  await page.goto(`${url}#9`); await settled(9);
  const failure = await page.evaluate(() => {
    const slide = document.querySelector('.slide.on');
    const elements = [slide.querySelector(':scope > .split > :first-child'), slide.querySelector(':scope > .fw-stat')];
    if (elements.some(el => !el)) return { missing: true };
    elements.forEach(el => el.classList.add('dt-copy-hidden'));
    const original = elements[0].classList.toggle;
    elements[0].classList.toggle = () => { throw new Error('injected copy failure'); };
    const result = window.deckCopy.show(slide);
    delete elements[0].classList.toggle;
    const secondVisible = !elements[1].classList.contains('dt-copy-hidden');
    window.deckCopy.show(slide);
    return { result, secondVisible, restored: elements.every(el => !el.classList.contains('dt-copy-hidden')), original: typeof original };
  });
  assert.equal(failure.result, false); assert(failure.secondVisible && failure.restored);
  await page.goto(`${url}#4`); await settled(4);
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(300); await page.setViewportSize({ width: 1024, height: 700 });
  await settled(5); await page.waitForTimeout(2000);
  const final = await page.evaluate(() => {
    const slide = document.querySelector('.slide.on'), h = slide.querySelector('h1,h2'), rect = h.getBoundingClientRect(), style = getComputedStyle(h);
    return { heading: h.textContent.trim(), visible: rect.width > 0 && rect.height > 0 && style.visibility === 'visible' && +style.opacity > 0,
      hidden: !!slide.querySelector('.dt-copy-hidden'), overlays: document.querySelectorAll('.dt-copy-overlay').length, clones: window.deckCopy.liveCloneCount };
  });
  assert(final.heading && final.visible && !final.hidden && !final.overlays && !final.clones); assert.deepEqual(errors, []);
  await page.screenshot({ path: '/Users/peteromalley/Documents/Codex/2026-11-03/new-chat/outputs/mycelial-p5-copy-resize.png' });
  console.log(JSON.stringify({ cancellation, failure, resize: final, errors }, null, 2));
} finally { await browser.close(); }
