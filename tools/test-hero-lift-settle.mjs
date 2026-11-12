// The phone hero copy's start pose must not hop when the browser's viewport
// settles after the copy is on screen (fix/load-polish; owner: opening the
// homepage from the deck, "the text ... jumps up a little").
//
// On iOS, above all in a tab just opened from a link, the fixed inset:0 box
// can still be the large viewport (~880 px on a phone showing ~738) when
// index.html first measures the lift, and shrink a moment later. The lift is
// centred between the header and the rail, so measured against the large box
// and then re-measured against the settled one the copy hopped 62 px up in a
// single frame. Modelled here as a 430x880 page whose visualViewport reports
// the 738 px that is really visible, settling to 430x738 after the reveal;
// then the reverse (bars collapsing, a real change of visible height), which
// must ease rather than jump.
//
// Needs the dev server: TEST_URL (default http://localhost:8137/).
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const URL = process.env.TEST_URL || 'http://localhost:8137/';
const VISIBLE = 738;
const browser = await chromium.launch({ headless: true,
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : { channel: 'chrome' }) });
try {
  const page = await browser.newPage({ viewport: { width: 430, height: 880 },
    deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await page.addInitScript(visible => {
    window.__fakeVisible = visible;
    const real = Object.getOwnPropertyDescriptor(VisualViewport.prototype, 'height');
    Object.defineProperty(VisualViewport.prototype, 'height', { configurable: true,
      get() { return window.__fakeVisible || real.get.call(this); } });
  }, VISIBLE);
  await page.goto(URL);
  await page.waitForFunction(() => document.body.classList.contains('hero-entry-ready'),
    null, { timeout: 30000 });
  const top = () => page.evaluate(() =>
    document.querySelector('.ui .hero h1 .hl').getBoundingClientRect().top);
  const before = await top();

  // 1. The box settles to the visible height: the start pose is already the
  //    visible one, so nothing but the headline's own vh-sized reflow moves.
  await page.setViewportSize({ width: 430, height: VISIBLE });
  await page.evaluate(() => { window.__fakeVisible = 0; });
  await page.waitForTimeout(1200);
  const settled = await top();
  console.log(JSON.stringify({ before, settled }));
  assert.ok(Math.abs(settled - before) < 12,
    `copy moved ${(settled - before).toFixed(1)} px when the box settled (was a 62 px hop)`);

  // 2. A real change of visible height after the reveal eases: the frame
  //    after the change still shows the centred top in transition.
  const glideP = page.evaluate(() => new Promise(resolve => {
    const hero = document.querySelector('.ui .hero');
    const from = parseFloat(getComputedStyle(hero).getPropertyValue('--hero-lift-target'));
    addEventListener('resize', () => requestAnimationFrame(() => resolve({ from,
      to: parseFloat(hero.style.getPropertyValue('--hero-lift-target')),
      now: parseFloat(getComputedStyle(hero).getPropertyValue('--hero-lift-target')),
      transition: getComputedStyle(hero).transition })), { once: true });
  }));
  await page.waitForTimeout(50);
  await page.setViewportSize({ width: 430, height: 880 });
  const glide = await glideP;
  console.log(JSON.stringify(glide));
  assert.match(glide.transition, /--hero-lift-target/, 'the centred top is a transition');
  assert.ok(glide.to - glide.from > 30, 'the taller viewport re-centres the copy');
  assert.ok(glide.now < glide.to - 1, 'the re-centre is eased, not applied in one frame');
  console.log('hero lift settle: ok');
} finally {
  await browser.close();
}
