// Focused real-scene lifecycle checks; run against a locally served candidate.
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
const base = process.argv[2] || 'http://127.0.0.1:8240/mycelial/index.html';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = []; page.on('pageerror', e => errors.push(e.message));
const wait = ms => page.waitForTimeout(ms);
async function settled(n) {
  await page.waitForFunction(n => { const s = document.querySelectorAll('.slide')[n-1]; return s.classList.contains('on') && s.hasAttribute('data-settled'); }, n, {timeout: 20000});
  const state = await page.evaluate(n => {
    const s = document.querySelectorAll('.slide')[n-1], h = s.querySelector('h1,h2');
    const r = h?.getBoundingClientRect(), st = h && getComputedStyle(h);
    const flight = document.querySelector('.gp-flight');
    return { failed:s.dataset.deckFailed, heading: h?.textContent.trim(), visible:!!r?.width && !!r?.height && st.visibility === 'visible' && Number(st.opacity)>0,
      tiles: s.querySelectorAll('.vc-tile').length, field: !!s.querySelector('.sf-stage canvas'),
      tools: s.querySelectorAll('.gp-dot.is-in').length, chart: !!s.querySelector('.is-drawn.is-labelled'),
      flight: flight && getComputedStyle(flight).display, dissolve: !!document.querySelector('.vc-dissolve,.sf-arrive'),
      hidden: !!s.querySelector('.dt-copy-hidden'), width: innerWidth, height: innerHeight };
  }, n);
  assert(!state.failed && state.heading && state.visible && !state.hidden, JSON.stringify(state));
  if (n===1) assert(state.tiles > 0 && !state.dissolve, JSON.stringify(state));
  if (n===2) assert(state.field && !state.dissolve, JSON.stringify(state));
  if (n===3) assert(state.tools > 0 && state.chart && state.flight === 'none', JSON.stringify(state));
  return state;
}
async function go(n) { await page.evaluate(n => { location.hash = `#${n}`; }, n); }
try {
  const result = [];
  for (const n of [1,2,3]) { await page.goto(`${base}#${n}`); result.push(['direct',n,await settled(n)]); }
  await page.goto(`${base}#1`); await settled(1);
  for (const n of [2,3,2,1]) { await go(n); result.push(['navigation',n,await settled(n)]); }
  await go(2); await wait(300); await page.setViewportSize({width:1100,height:720}); result.push(['arrival resize',2,await settled(2)]);
  await page.setViewportSize({width:1050,height:700}); await go(3); result.push(['resize navigation race',3,await settled(3)]); await wait(1500); result.push(['race stable',3,await settled(3)]);
  await page.setViewportSize({width:1000,height:680}); await wait(500); result.push(['settled resize',3,await settled(3)]);
  await page.locator('.gp-dot').first().click({force:true}); const wasOpen = await page.locator('.gp-dot.is-open').count(); assert(wasOpen);
  await page.setViewportSize({width:980,height:660}); await wait(500); assert.equal(await page.locator('.gp-dot.is-open').count(),wasOpen);
  await page.screenshot({path:'/Users/peteromalley/Documents/Codex/2026-11-03/new-chat/outputs/mycelial-p2-gap.png'});
  await go(2); await settled(2); await wait(350);
  const pixels1 = await page.locator('.slide.on .sf-stage canvas').evaluate(c => c.toDataURL());
  await wait(500);
  const pixels2 = await page.locator('.slide.on .sf-stage canvas').evaluate(c => c.toDataURL());
  assert.notEqual(pixels1, pixels2, 'field ambient animation must continue');
  await page.screenshot({path:'/Users/peteromalley/Documents/Codex/2026-11-03/new-chat/outputs/mycelial-p2-scatter.png'});
  await go(1); await settled(1);
  assert.equal(await page.locator('.gp-dot.is-open').count(), 0, 'departed chart must retire its open detail after the existing exit tail');
  await page.locator('.slide.on .vc-fn button').evaluate(el => el.click());
  assert.equal(await page.locator('.slide.on .vc-note.is-open').count(), 1);
  await page.setViewportSize({width:960,height:640}); await wait(500);
  assert.equal(await page.locator('.slide.on .vc-note.is-open').count(), 1);
  await page.screenshot({path:'/Users/peteromalley/Documents/Codex/2026-11-03/new-chat/outputs/mycelial-p2-collage.png'});
  // Force the actual collage layout to fail, then retry the same viewport size.
  await page.evaluate(() => { const vis = document.querySelector('.slide.on .vis'); Object.defineProperty(vis, 'clientWidth', { configurable:true, get:()=>0 }); });
  await page.setViewportSize({width:940,height:640}); await wait(500);
  assert.equal(await page.locator('.slide.on').getAttribute('data-deck-failed'), 'resize');
  assert.equal(await page.locator('.slide.on').getAttribute('data-settled'), null);
  await page.evaluate(() => { delete document.querySelector('.slide.on .vis').clientWidth; dispatchEvent(new Event('resize')); });
  await wait(500); await settled(1);
  assert.deepEqual(errors, []); console.log(JSON.stringify({result, openPreserved:true, fieldLive:true, failureObservedAndRetried:true, errors},null,2));
} finally { await browser.close(); }
