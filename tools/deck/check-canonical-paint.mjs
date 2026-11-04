// Real keyboard navigation and screenshot pixels; emulated WebKit is not physical iOS.
import assert from 'node:assert/strict';
import { chromium, webkit, devices } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const base = process.argv.find(a => /^https?:/.test(a)) || 'http://127.0.0.1:8240/mycelial/index.html';
const out = process.env.DECK_CAPTURE_DIR || '/Users/peteromalley/Documents/Codex/2026-11-03/new-chat/outputs/canonical-paint';
mkdirSync(out, { recursive: true });
const settled = (page, n) => page.waitForFunction(n => document.querySelectorAll('.slide')[n - 1].matches('.on[data-settled]'), n, { timeout: 30000 });
async function pixels(page, selector, label) {
  const target = page.locator(selector), box = await target.boundingBox();
  assert(box && box.width > 0 && box.height > 0);
  const clip = { x: Math.max(0, box.x), y: Math.max(0, box.y), width: Math.min(box.width, 390 - Math.max(0, box.x)), height: Math.min(box.height, 700 - Math.max(0, box.y)) };
  const shown = `${out}/${label}.png`, hidden = `${out}/${label}-control.png`;
  await page.screenshot({ path: shown, clip });
  const previous = await target.evaluate(el => { window.__pixelControl = true; const previous = el.style.opacity; el.style.opacity = '0'; return previous; });
  try { await page.screenshot({ path: hidden, clip }); }
  finally { await target.evaluate((el, previous) => { el.style.opacity = previous; window.__pixelControl = false; }, previous); }
  const check = spawnSync('python3', ['-c', `from PIL import Image, ImageChops
import json,sys
a=Image.open(sys.argv[1]).convert('RGB'); b=Image.open(sys.argv[2]).convert('RGB')
d=ImageChops.difference(a,b)
n=sum(max(p)>30 for p in d.getdata())
print(json.dumps({'changedPixels':n,'pixels':a.width*a.height,'fraction':n/(a.width*a.height)}))`, shown, hidden], { encoding: 'utf8' });
  assert.equal(check.status, 0, check.stderr);
  const result = JSON.parse(check.stdout);
  assert(result.changedPixels > 250 && result.fraction > .005, `${label}: target contributes visible screenshot pixels: ${check.stdout}`);
  return result;
}
async function run(browser, name) {
  const context = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 669 } });
  const page = await context.newPage(), errors = [], results = { engine: name, actualIOS: false, captures: [] };
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => {
    const samples = window.__canonicalSamples = [], seen = new WeakMap(); let id = 0;
    const frame = () => {
      const slide = document.querySelector('.slide.on');
      if (slide?.matches('.gap-host') && !window.__pixelControl) {
        const root = slide.querySelector('.gap-copy-content'), nodes = [root.parentElement, root, root.querySelector('h1')];
        if (!seen.has(root)) seen.set(root, ++id);
        samples.push({ kind: 'gap', id: seen.get(root), opacity: +getComputedStyle(root).opacity,
          alpha: +getComputedStyle(root).getPropertyValue('--gap-copy-alpha'),
          transforms: [root.parentElement, root].map(el => getComputedStyle(el).transform),
          clones: slide.querySelectorAll('.dt-copy-overlay').length,
          hidden: root.classList.contains('dt-copy-hidden'),
          masks: nodes.flatMap(el => [getComputedStyle(el).maskImage, getComputedStyle(el).webkitMaskImage]) });
      }
      if (slide?.matches('.as-host') && !slide.classList.contains('dt-await') && !window.__pixelControl) {
        const copy = slide.querySelector('.as-copy'), heading = copy.querySelector('h1');
        if (!seen.has(copy)) seen.set(copy, ++id);
        samples.push({ kind: 'demo-heading', id: seen.get(copy), alpha: +getComputedStyle(copy).getPropertyValue('--as-copy-alpha'),
          opacity: +getComputedStyle(copy).opacity, transform: getComputedStyle(copy).transform,
          hidden: copy.classList.contains('dt-copy-hidden'), clones: slide.querySelectorAll('.dt-copy-overlay').length,
          masks: [copy, heading].flatMap(el => [getComputedStyle(el).maskImage, getComputedStyle(el).webkitMaskImage]) });
        const root = slide.querySelector('[data-astrid-demo]');
        samples.push({ kind: 'demo', classes: root.className, flights: document.querySelectorAll('.as-flight, .as-flight-flier').length,
          nodes: [root, ...root.querySelectorAll('.as-panel, .as-avatar')].map(el => { const s = getComputedStyle(el); return { visibility: s.visibility, opacity: +s.opacity, mask: s.maskImage }; }) });
      }
      requestAnimationFrame(frame);
    }; requestAnimationFrame(frame);
  });
  const check = async (n, label) => {
    await settled(page, n); await page.waitForFunction(() => getComputedStyle(document.querySelector('.slide.on')).opacity === '1'); await page.waitForTimeout(100);
    const state = await page.evaluate(() => {
      const slide = document.querySelector('.slide.on');
      return { failed: slide.hasAttribute('data-deck-failed'), inert: slide.inert,
        cloneCount: document.querySelectorAll('.dt-copy-overlay').length,
        opacity: getComputedStyle(slide).opacity,
        hiddenCopy: !!slide.querySelector('.dt-copy-hidden'),
        canonicalCount: slide.querySelectorAll('.gap-copy-content').length };
    });
    assert(!state.failed && !state.inert && !state.hiddenCopy && state.cloneCount === 0 && state.opacity === '1', JSON.stringify(state));
    if (n === 3) assert.equal(state.canonicalCount, 1);
    results.captures.push({ label, ...(await pixels(page, n === 3 ? '.gap-host.on h1' : '.as-host.on [data-astrid-demo]', `${name}-${label}`)) });
  };
  try {
    await page.goto(`${base}#2`); await settled(page, 2);
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('ArrowRight'); await check(3, `slide3-keyboard-${i + 1}`);
      if (i < 2) { await page.keyboard.press('ArrowLeft'); await settled(page, 2); }
    }
    const gapSamples = await page.evaluate(() => window.__canonicalSamples.filter(s => s.kind === 'gap'));
    assert(gapSamples.some(s => s.alpha > 0 && s.alpha < 1), 'canonical text has intermediate ink alpha');
    assert(gapSamples.every(s => s.opacity === 1 && s.transforms.every(t => t === 'none') && !s.hidden && s.clones === 0 && s.masks.every(m => m === 'none')),
      'canonical surface stays opaque, stationary and unmasked while ink fades');
    assert.equal(new Set(gapSamples.map(s => s.id)).size, 1, 'same semantic tree survives repeated navigation');
    results.gapFrames = gapSamples.length;
    await page.keyboard.press('ArrowRight'); await settled(page, 4);
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('ArrowRight'); await check(5, `slide5-keyboard-${i + 1}`);
      await page.waitForTimeout(1200);
      results.captures.push({ label: `slide5-heading-${i + 1}`, ...(await pixels(page, '.as-host.on h1', `${name}-slide5-heading-${i + 1}`)) });
      if (i < 2) { await page.keyboard.press('ArrowLeft'); await settled(page, 4); }
    }
    const headingSamples = await page.evaluate(() => window.__canonicalSamples.filter(s => s.kind === 'demo-heading'));
    assert(headingSamples.some(s => s.alpha > 0 && s.alpha < 1), 'heading ink reveals progressively');
    assert(headingSamples.every(s => s.opacity === 1 && s.transform === 'none' && !s.hidden && !s.clones && s.masks.every(m => m === 'none')), 'heading stays canonical, unmasked and stationary');
    assert.equal(new Set(headingSamples.map(s => s.id)).size, 1);
    results.headingFrames = headingSamples.length;
    const demoSamples = await page.evaluate(() => window.__canonicalSamples.filter(s => s.kind === 'demo'));
    assert(demoSamples.every(s => !/morph|minkless/.test(s.classes) && s.flights === 0 && s.nodes.every((n, i) => (i === 0 ? n.opacity >= 0.22 : n.opacity === 1) && n.visibility === 'visible' && n.mask === 'none')), 'live editor remains visible and panels/avatar never enter a hidden morph state');
    results.demoFrames = demoSamples.length;
    // The normal scripted tour must still produce its first guide picture.
    await page.waitForFunction(() => document.querySelector('.as-scene-clip.is-ready') && document.querySelector('.as.has-frame'), null, { timeout: 22000 });
    const clock = await page.locator('.as-time').textContent();
    await page.waitForFunction(clock => document.querySelector('.as-time').textContent !== clock, clock, { timeout: 8000 });
    await check(5, 'slide5-playback'); results.playback = true;
    // A scene kept by Stack must still return to the live editor.
    await page.keyboard.press('ArrowRight'); await settled(page, 6);
    await page.keyboard.press('ArrowLeft'); await check(5, 'slide5-stack-return');
    await page.goto(`${base}#2`); await settled(page, 2);
    await page.keyboard.press('ArrowRight'); await page.waitForTimeout(500);
    await page.setViewportSize({ width: 390, height: 700 }); await check(3, 'slide3-resize-interruption');
    await page.keyboard.press('ArrowRight'); await settled(page, 4);
    await page.keyboard.press('ArrowRight'); await page.waitForTimeout(350);
    await page.setViewportSize({ width: 390, height: 669 }); await check(5, 'slide5-resize-interruption');
    // Queue real reverse/forward keys during the outgoing fade.
    await page.keyboard.press('ArrowLeft'); await page.waitForTimeout(140); await page.keyboard.press('ArrowRight'); await check(5, 'slide5-queued-return');
    for (const n of [3, 5]) { await page.goto(`${base}#${n}`); await check(n, `slide${n}-direct`); }
    await context.close();
    const reduced = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 669 }, reducedMotion: 'reduce' });
    const rp = await reduced.newPage();
    for (const n of [3, 5]) {
      await rp.goto(`${base}#${n}`); await settled(rp, n); await rp.waitForFunction(() => getComputedStyle(document.querySelector('.slide.on')).opacity === '1');
      results.captures.push({ label: `slide${n}-reduced`, ...(await pixels(rp, n === 3 ? '.gap-host.on h1' : '.as-host.on [data-astrid-demo]', `${name}-slide${n}-reduced`)) });
    }
    await reduced.close();
    assert.deepEqual(errors, []); results.errors = errors;
    return results;
  } finally { await context.close(); }
}
const chrome = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const safari = await webkit.launch({ headless: true });
try {
  const results = await Promise.all([run(chrome, 'chromium-phone'), run(safari, 'webkit-phone')]);
  writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
} finally { await chrome.close(); await safari.close(); }
