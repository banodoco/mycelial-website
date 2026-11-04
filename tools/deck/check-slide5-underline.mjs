// Focused real-layout check. Uses the existing development server; never starts/stops it.
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';

const base = process.argv[2] || 'http://127.0.0.1:8240/mycelial/index.html';
const output = process.env.UNDERLINE_OUTPUT || '/Users/peteromalley/Documents/Codex/2026-11-03/new-chat/work/slide5-underline';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const results = [], errors = [];
const settled = (page, n) => page.waitForFunction(n => {
  const s = document.querySelectorAll('.slide')[n - 1];
  return s.classList.contains('on') && s.hasAttribute('data-settled');
}, n, { timeout: 30000 });
const underlined = page => page.waitForFunction(() => {
  const a = document.querySelector('.as-host .as-link');
  return a.classList.contains('is-underlined') && new DOMMatrix(getComputedStyle(a, '::after').transform).a === 1;
});
const state = page => page.evaluate(() => {
  const s = document.querySelector('.as-host'), a = s.querySelector('.as-link'), h = a.closest('h1');
  const box = el => { const r = el.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; };
  const p = getComputedStyle(a, '::after');
  return { heading: box(h), link: box(a), color: getComputedStyle(a).color, ink: getComputedStyle(h).color,
    scale: new DOMMatrix(p.transform).a, height: p.height, background: p.backgroundColor,
    settled: s.hasAttribute('data-settled'), overlays: s.querySelectorAll('.dt-copy-overlay').length,
    href: a.href, target: a.target, rel: a.rel, failed: s.dataset.deckFailed };
});
async function pageFor(options = {}) {
  const page = await browser.newPage(options);
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    const evidence = window.__underlineEvidence = { samples: [], transactions: [], transitions: [], phases: [] };
    addEventListener('deck-transaction', event => evidence.transactions.push({ at: performance.now(), ...event.detail,
      to: window.deckNav?.to, settled: document.querySelector('.as-host')?.hasAttribute('data-settled') }));
    addEventListener('deck-phase', event => evidence.phases.push({ at: performance.now(), ...event.detail }));
    addEventListener('transitionrun', event => {
      if (event.target.matches?.('.as-link')) evidence.transitions.push({ at: performance.now(), generation: window.deckNav?.generation,
        pseudo: event.pseudoElement, property: event.propertyName });
    });
    const tick = () => {
      const s = document.querySelector('.as-host'), a = s?.querySelector('.as-link');
      if (a && s.classList.contains('on')) evidence.samples.push({ at: performance.now(), generation: window.deckNav?.generation,
        settled: s.hasAttribute('data-settled'), scale: new DOMMatrix(getComputedStyle(a, '::after').transform).a,
        arriving: s.getAnimations().some(a => a.playState !== 'finished' && Number.isFinite(a.effect.getComputedTiming().endTime)),
        color: getComputedStyle(a).color, ink: getComputedStyle(a.closest('h1')).color });
      if (evidence.samples.length > 4000) evidence.samples.shift();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  return page;
}
async function verifyArrival(page, label, requireUnsettled = true) {
  await settled(page, 5); await underlined(page);
  const result = await state(page);
  assert(!result.failed && !result.overlays && result.link[2] > 0 && result.scale === 1, JSON.stringify(result));
  assert.equal(result.color, result.ink, 'Astrid stays in the headline ink');
  assert.equal(result.height, '1px'); assert.notEqual(result.background, 'rgba(0, 0, 0, 0)');
  const evidence = await page.evaluate(() => window.__underlineEvidence);
  const generation = await page.evaluate(() => window.deckNav.generation);
  const samples = evidence.samples.filter(s => s.generation === generation);
  if (requireUnsettled) assert(samples.some(s => !s.settled && s.scale === 0), `${label}: no underline before readiness`);
  assert(samples.every(s => s.settled || s.scale === 0), `${label}: underline started before settlement`);
  assert(samples.every(s => !s.arriving || s.scale === 0), `${label}: underline started before CSS slide arrival`);
  assert(samples.some(s => s.scale > 0 && s.scale < 1), `${label}: draw-in animation observed`);
  assert(samples.every(s => s.color === s.ink), `${label}: unexpected color flash`);
  const transaction = evidence.transactions.find(t => t.generation === generation && t.success && t.settled);
  const transition = evidence.transitions.find(t => t.generation === generation && t.pseudo === '::after');
  assert(transaction && transition && transition.at >= transaction.at, `${label}: readiness ordering`);
  results.push({ label, state: result, generation, settledAt: transaction.at, underlineStartedAt: transition.at,
    phases: evidence.phases.filter(p => p.generation === generation), sampledFrames: samples.length });
}
try {
  // Preserve inline text metrics at desktop widths and on the actual narrow layout.
  const before = process.env.UNDERLINE_BASELINE ? await readFile(process.env.UNDERLINE_BASELINE, 'utf8') : null;
  for (const width of [1440, 1280, 1024, 390]) {
    const options = { viewport: { width, height: width === 390 ? 844 : 900 }, isMobile: width === 390, hasTouch: width === 390 };
    let old;
    if (before) {
      const baseline = await pageFor(options);
      await baseline.route('**/mycelial/index.html*', route => route.fulfill({ contentType: 'text/html', body: before }));
      await baseline.goto(`${base}#5`); await settled(baseline, 5); await baseline.evaluate(() => document.fonts.ready);
      old = await state(baseline); await baseline.close();
    }
    const page = await pageFor(options);
    await page.goto(`${base}#5`); await verifyArrival(page, `${width}px direct #5`, false);
    await page.goto(`${base}#4`); await settled(page, 4);
    await page.keyboard.press('ArrowRight'); await verifyArrival(page, `${width}px 4→5`);
    if (old) {
      const current = await state(page);
      // The scene drifts as a whole. Compare line dimensions and the link's
      // position within the heading, independent of that ambient translation.
      const metrics = s => [...s.heading.slice(2), ...s.link.slice(2), s.link[0] - s.heading[0], s.link[1] - s.heading[1]];
      const actual = metrics(current), expected = metrics(old);
      assert(actual.every((value, i) => Math.abs(value - expected[i]) < .01), `${width}px text layout changed: ${JSON.stringify({ actual, expected })}`);
      results.push({ label: `${width}px baseline geometry preserved`, heading: current.heading, link: current.link });
    }
    if (width === 1280 || width === 390) {
      await page.screenshot({ path: `${output}/${width}px.png` });
      // Settled resize must keep the finished underline and live demo state.
      const generation = await page.evaluate(() => window.deckNav.generation);
      await page.setViewportSize({ width: width - 20, height: options.viewport.height - 40 });
      await page.waitForTimeout(250); await settled(page, 5);
      assert.equal((await state(page)).scale, 1);
      assert.equal(await page.evaluate(() => window.deckNav.generation), generation);
      results.push({ label: `${width}px settled resize`, state: await state(page) });
      await page.keyboard.press('ArrowRight'); await settled(page, 6);
      await page.keyboard.press('ArrowLeft'); await verifyArrival(page, `${width}px 6→5 return`);
      // Replace an arriving visit, return, then force the current arrival to finish on a real resize.
      await page.keyboard.press('ArrowLeft'); await settled(page, 4);
      await page.keyboard.press('ArrowRight'); await page.waitForTimeout(150);
      await page.evaluate(() => { location.hash = '#6'; }); await settled(page, 6);
      await page.evaluate(() => { location.hash = '#5'; });
      await page.waitForTimeout(100);
      await page.setViewportSize({ width, height: options.viewport.height });
      await verifyArrival(page, `${width}px interrupted/replaced + resize return`, false);
      await page.evaluate(() => { dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })); document.dispatchEvent(new Event('visibilitychange')); });
      await page.waitForTimeout(150); assert.equal((await state(page)).scale, 1);
      results.push({ label: `${width}px simulated return`, state: await state(page) });
      await page.locator('.as-host .as-link').focus();
      assert.notEqual(await page.locator('.as-host .as-link').evaluate(a => getComputedStyle(a).outlineStyle), 'none');
      await page.route('https://astrid.haus/**', route => route.fulfill({ contentType: 'text/html', body: '<title>Astrid link check</title>' }));
      const popupPromise = page.waitForEvent('popup');
      await page.locator('.as-host .as-link').click();
      const popup = await popupPromise; await popup.waitForLoadState();
      assert.equal(popup.url(), 'https://astrid.haus/'); assert.equal(await page.evaluate(() => window.deckNav.to), 4);
      await popup.close(); results.push({ label: `${width}px focus/external click`, opens: 'https://astrid.haus/', selectedSlide: 5 });
    }
    await page.close();
  }
  for (const preference of ['system', 'saved']) {
    const page = await pageFor({ viewport: { width: 1280, height: 800 }, reducedMotion: preference === 'system' ? 'reduce' : 'no-preference' });
    if (preference === 'saved') await page.addInitScript(() => localStorage.setItem('deck-motion', 'off'));
    await page.goto(`${base}#5`); await settled(page, 5);
    const result = await state(page); assert.equal(result.scale, 1);
    const samples = await page.evaluate(() => window.__underlineEvidence.samples);
    assert(samples.every(s => s.scale === 1), `${preference}: reduced motion never animates underline`);
    results.push({ label: `${preference} reduced motion`, state: result, sampledFrames: samples.length });
    await page.close();
  }
  assert.deepEqual(errors, []);
  await writeFile(`${output}/results.json`, JSON.stringify({ base, results, errors }, null, 2));
  console.log(JSON.stringify({ checks: results.length, labels: results.map(r => r.label), errors }, null, 2));
} finally { await browser.close(); }
