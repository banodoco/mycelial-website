// Desktop engines with phone emulation are not physical iOS coverage.
import { chromium, webkit, devices } from 'playwright-core';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const base = process.argv.find(a => /^https?:/.test(a)) || 'http://127.0.0.1:8240/mycelial/index.html';
const proveFailure = process.argv.includes('--prove-failure');
const chrome = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const safari = await webkit.launch({ headless: true });
const read = page => page.evaluate(() => {
  const root = document.querySelector('[data-astrid-demo]');
  return { generating: root.querySelector('.as-scene-clip').classList.contains('is-generating'),
    scene: root.querySelector('.as-scene-clip').classList.contains('is-ready'),
    frames: root.querySelectorAll('.as-frame-clip.is-ready').length,
    result: root.querySelector('.as-result-clip').classList.contains('is-ready'),
    done: root.querySelectorAll('.as-step.is-done').length,
    hasFrame: root.classList.contains('has-frame'), clock: root.querySelector('.as-time').textContent,
    media: [...root.querySelectorAll('video')].map(v => ({ readyState: v.readyState, time: v.currentTime, paused: v.paused, ended: v.ended })),
    attempts: window.__demoAttempts || 0 };
});
const settled = (page, n) => page.waitForFunction(n => {
  const slide = document.querySelectorAll('.slide')[n - 1];
  return slide.classList.contains('on') && slide.hasAttribute('data-settled');
}, n, { timeout: 30000 });
async function run(name, browser, { phone = false, policy, legacy = false, resize = false, pause = false, boundary = false } = {}) {
  const context = await browser.newContext(phone ? { ...devices['iPhone 13'] } : { viewport: { width: 1280, height: 800 } });
  const page = await context.newPage(), errors = [], milestones = [];
  page.on('pageerror', e => errors.push(e.message));
  if (policy) await page.addInitScript(policy => {
    const proto = HTMLMediaElement.prototype, original = proto.play;
    const ready = Object.getOwnPropertyDescriptor(proto, 'readyState').get;
    const requested = new WeakSet(); window.__demoAttempts = 0;
    if (policy === 'metadata') Object.defineProperty(proto, 'readyState', { configurable: true, get() {
      return this.closest('.as-media') && !requested.has(this) ? Math.min(1, ready.call(this)) : ready.call(this);
    } });
    proto.play = function () {
      if (this.closest('.as-media')) {
        window.__demoAttempts++; requested.add(this);
        if (policy === 'denied') return Promise.reject(new DOMException('Autoplay denied by test policy', 'NotAllowedError'));
        if (policy === 'pending') return new Promise(() => {});
      }
      return original.call(this);
    };
  }, policy);
  if (legacy) {
    // Restore only the actual pre-fix media gate. All other current work stays in place.
    const source = readFileSync(new URL('../../mycelial/demo.js', import.meta.url), 'utf8');
    const gate = `  const gateReady = (event) => {
    if (event.guideEnd) return guide.ended;
    if (event.bi === 0 && event.offset === 0.65) {
      if (guide.readyState < 1) return false;
      if (!guideGateSeeking) {
        try { guide.currentTime = 0; guideGateSeeking = true; } catch { return false; }
      }
      return guide.readyState >= 2 && !guide.seeking;
    }
    if (event.bi === 1) {
      const i = FRAMES.findIndex((_, n) => Math.abs(event.offset - (n * FRAME_STEP + 0.32)) < 1e-7);
      if (i >= 0) return imageReady(anchors[i]);
    }
    if (event.bi === 2 && event.offset === 0.55) {
      const v = videos[0];
      if (v.readyState < 1) return false;
      if (!videoGateSeeking) {
        try { v.currentTime = 0; videoGateSeeking = true; } catch { return false; }
      }
      return v.readyState >= 2 && !v.seeking;
    }
    return true;
  };
`;
    const changed = source.slice(0, source.indexOf('  const gateReady =')) + gate + source.slice(source.indexOf('  let eventIndex ='));
    await page.route('**/mycelial/demo.js', route => route.fulfill({ contentType: 'text/javascript', body: changed }));
  }
  try {
    await page.goto(`${base}#${boundary ? 4 : 5}`); await settled(page, boundary ? 4 : 5);
    if (boundary) { await page.locator('#nextBtn').click(); await settled(page, 5); }
    await page.waitForFunction(() => document.querySelector('.as-scene-clip.is-generating'), null, { timeout: 15000 });
    milestones.push(['pictured first gate', await read(page)]);
    if (legacy) {
      await page.waitForTimeout(10000);
      const stuck = await read(page);
      assert(stuck.generating && !stuck.hasFrame && !stuck.scene && stuck.attempts === 0, JSON.stringify(stuck));
      return { name, reproduced: 'first gate never requests play; remains empty after 10 seconds', stuck, errors };
    }
    if (resize) await page.setViewportSize(phone ? { width: 844, height: 390 } : { width: 1100, height: 720 });
    await page.waitForFunction(() => document.querySelector('.as-scene-clip.is-ready') && document.querySelector('.as.has-frame'), null, { timeout: 20000 });
    milestones.push(['guide produced', await read(page)]);
    if (pause) {
      // Exercise the same overview event used by the deck's overlay control.
      await page.evaluate(() => { document.querySelector('#overview').classList.add('on'); dispatchEvent(new Event('deck-overview')); });
      const before = await read(page); await page.waitForTimeout(1200); const after = await read(page);
      assert(Math.abs(before.media[1].time - after.media[1].time) < 0.15, 'overview pauses source playback');
      await page.evaluate(() => { document.querySelector('#overview').classList.remove('on'); dispatchEvent(new Event('deck-overview')); });
    }
    await page.waitForFunction(() => document.querySelectorAll('.as-frame-clip.is-ready').length === 4, null, { timeout: 30000 });
    milestones.push(['four frames produced', await read(page)]);
    await page.waitForFunction(() => document.querySelector('.as-result-clip.is-ready') && document.querySelectorAll('.as-step.is-done').length === 3, null, { timeout: 25000 });
    const done = await read(page); milestones.push(['final completed', done]);
    assert(done.hasFrame && done.frames === 4 && done.result && done.done === 3, JSON.stringify(done));
    await page.waitForFunction(before => document.querySelector('.as-time').textContent !== before, done.clock, { timeout: 12000 });
    if (!policy || policy === 'metadata') {
      assert(done.media[1].ended, 'healthy guide reached its real media end');
      assert(done.media[0].time > 0 && !done.media[0].paused, 'healthy final is actual playing video');
    } else {
      await page.waitForFunction(() => {
        const pic = document.querySelector('.as-pic'), poster = document.querySelector('.as-final-poster');
        if (!poster.complete || !poster.naturalWidth) return false;
        const ref = document.createElement('canvas'); ref.width = pic.width; ref.height = pic.height;
        const scale = Math.min(pic.width / 16, pic.height / 9) * 0.86, w = 16 * scale, h = 9 * scale;
        ref.getContext('2d').drawImage(poster, Math.round((pic.width - w) / 2), Math.round((pic.height - h) / 2), w, h);
        return ref.toDataURL() === pic.toDataURL();
      }, null, { timeout: 12000 });
    }
    if (process.env.DECK_CAPTURE_DIR) await page.screenshot({ path: `${process.env.DECK_CAPTURE_DIR}/demo-${name.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')}.png` });
    if (boundary) {
      await page.locator('#nextBtn').click(); await settled(page, 6);
      await page.locator('#prevBtn').click(); await settled(page, 5);
      const returned = await read(page); assert(returned.result && returned.done === 3 && returned.hasFrame, JSON.stringify(returned));
      milestones.push(['return from stack preserved result', returned]);
    } else {
      await page.waitForFunction(() => document.querySelectorAll('.as-step.is-done').length === 0, null, { timeout: 15000 });
      milestones.push(['loop reset', await read(page)]);
    }
    assert.deepEqual(errors, []);
    return { name, actualIOS: false, milestones, errors };
  } finally { await context.close(); }
}
try {
  if (proveFailure) console.log(JSON.stringify(await run('legacy metadata-only gate', chrome, { phone: true, policy: 'metadata', legacy: true }), null, 2));
  else {
    const results = await Promise.all([
      run('Chromium desktop resize', chrome, { resize: true }),
      run('Chromium phone metadata-only until play', chrome, { phone: true, policy: 'metadata', resize: true }),
      run('WebKit iPhone emulation overview and return', safari, { phone: true, pause: true, boundary: true }),
      run('WebKit iPhone emulation autoplay denied', safari, { phone: true, policy: 'denied' }),
      run('Chromium phone playback promise never settles', chrome, { phone: true, policy: 'pending' }),
    ]);
    console.log(JSON.stringify(results, null, 2));
  }
} finally { await chrome.close(); await safari.close(); }
