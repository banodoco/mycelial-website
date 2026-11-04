// Exercises unavailable reference images and retry after a transient video fetch failure.
import { chromium, devices } from 'playwright-core';
import assert from 'node:assert/strict';
const base = process.argv[2] || 'http://127.0.0.1:8240/mycelial/index.html';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
async function images(mode) {
  const ctx = await browser.newContext(devices['iPhone 13']), page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  if (mode === 'error') await page.route('**/*-preview.webp', route => route.abort());
  else await page.addInitScript(() => {
    const complete = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'complete').get;
    Object.defineProperty(HTMLImageElement.prototype, 'complete', { configurable: true, get() {
      if (this.classList.contains('as-frame-media') && this.src.includes('start-preview.webp')) return false;
      return complete.call(this);
    } });
  });
  try {
    await page.goto(`${base}#5`);
    await page.waitForFunction(() => document.querySelectorAll('.as-frame-clip.is-ready').length === 4, null, { timeout: 55000 });
    const frames = await page.evaluate(() => ({ count: document.querySelectorAll('.as-frame-clip.is-ready').length, picture: document.querySelector('.as').classList.contains('has-frame') }));
    assert.equal(frames.count, 4); assert(frames.picture, 'retain an existing frame');
    await page.waitForFunction(() => document.querySelector('.as-result-clip.is-ready') && document.querySelectorAll('.as-step.is-done').length === 3, null, { timeout: 30000 });
    assert.deepEqual(errors, []);
    return { mode, frames, completed: true };
  } finally { await ctx.close(); }
}
async function retry() {
  const ctx = await browser.newContext(), page = await ctx.newPage();
  await page.addInitScript(() => {
    const original = window.fetch; window.__warmAttempts = 0;
    window.fetch = function (url, ...args) {
      if (String(url).includes('/lantern-valley/final.mp4')) {
        window.__warmAttempts++;
        if (window.__warmAttempts === 1) return Promise.reject(new Error('simulated transient failure'));
      }
      return original.call(this, url, ...args);
    };
  });
  try {
    await page.goto(base);
    await page.waitForFunction(() => typeof window.warmDeckMedia === 'function');
    const result = await page.evaluate(async () => {
      const slide = document.querySelector('.as-host'), video = slide.querySelector('video:not(.as-guide-media)');
      await window.warmDeckMedia(slide);
      const first = { attempts: window.__warmAttempts, warmed: video.dataset.warmed, source: video.getAttribute('src') };
      await window.warmDeckMedia(slide);
      return { first, attempts: window.__warmAttempts, source: video.getAttribute('src'), warmed: video.dataset.warmed };
    });
    assert.equal(result.first.attempts, 1); assert.equal(result.first.warmed, '');
    assert.equal(result.attempts, 2); assert(result.source?.startsWith('blob:')); assert.equal(result.warmed, 'true');
    return { mode: 'fetch rejection then retry', ...result };
  } finally { await ctx.close(); }
}
try { console.log(JSON.stringify(await Promise.all([images('error'), images('never-ready'), retry()]), null, 2)); }
finally { await browser.close(); }
