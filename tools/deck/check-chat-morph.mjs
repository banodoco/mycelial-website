// Observe both painted representations of slide 5's chat during the real
// 5↔6 scene, including the changing frame rather than only scroll offsets.
import assert from 'node:assert/strict';
import { chromium, webkit } from 'playwright-core';
const base = process.argv.find(arg => /^https?:/.test(arg)) || 'http://127.0.0.1:8240/mycelial/index.html';
const settled = (page, n) => page.waitForFunction(n => {
  const slide = document.querySelectorAll('.slide')[n - 1];
  return slide.classList.contains('on') && slide.hasAttribute('data-settled');
}, n, { timeout: 30000 });
const results = [];
for (const [engine, type] of [['chromium', chromium], ['webkit', webkit]]) {
  const browser = await type.launch({ headless: true, ...(engine === 'chromium' ? { executablePath: process.env.CHROMIUM_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' } : {}) });
  try {
    for (const [name, width, height] of [['desktop', 1440, 900], ['phone', 390, 669], ['ipad-mini', 744, 1133], ['ipad', 768, 1024], ['portrait-821', 821, 1100], ['ipad-pro', 1024, 1366], ['ipad-pro-13', 1032, 1376]]) {
      const profile = `${engine}-${name}`;
      if (process.env.DECK_PROFILE && profile !== process.env.DECK_PROFILE) continue;
      const context = await browser.newContext({ viewport: { width, height }, isMobile: name !== 'desktop', hasTouch: name !== 'desktop' });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(`${base}#6`); await settled(page, 6);
      await page.keyboard.press('ArrowLeft'); await settled(page, 5);
      for (const direction of [1, -1]) {
        await page.evaluate(() => {
          window.chatMorphTrace = []; window.chatMorphTracing = true;
          const read = el => {
            if (!el) return null;
            const r = el.getBoundingClientRect(); let opacity = 1;
            for (let p = el; p; p = p.parentElement) {
              const s = getComputedStyle(p);
              opacity *= s.visibility === 'visible' && s.display !== 'none' ? +s.opacity : 0;
            }
            return { x: r.x, y: r.y, w: r.width, h: r.height, opacity };
          };
          const sample = () => {
            const chat = document.querySelector('.st-ghost .as-chat');
            window.chatMorphTrace.push({ ghost: read(chat), frame: read(chat?.closest('.st-ghost')), native: read(document.querySelector('.st-agent')), canonical: read(document.querySelector('[data-astrid-demo] .as-chat')) });
            if (window.chatMorphTracing) requestAnimationFrame(sample);
          };
          requestAnimationFrame(sample);
        });
        await page.keyboard.press(direction > 0 ? 'ArrowRight' : 'ArrowLeft');
        await settled(page, direction > 0 ? 6 : 5);
        const trace = await page.evaluate(() => { window.chatMorphTracing = false; return window.chatMorphTrace; });
        const copies = trace.filter(f => f.ghost?.opacity > .01);
        assert(copies.length >= 3, `${profile} ${direction}: actual moving chat observed`);
        for (const { ghost, frame, native } of copies) {
          for (const key of ['x', 'y', 'w', 'h']) assert(Math.abs(ghost[key] - frame[key]) <= 1, `${profile} ${direction}: chat no longer fills its frame (${key})`);
          if (ghost.opacity < .99) assert(native.opacity >= .99, `${profile} ${direction}: snapshot fading before receiving content is opaque`);
        }
        assert.equal(await page.locator('.st-ghost').count(), 0, `${profile}: snapshots retired`);
        results.push({ profile, direction, frames: trace.length, morphFrames: copies.length, minReceivingOpacityDuringDissolve: Math.min(...copies.filter(f => f.ghost.opacity < .99).map(f => f.native.opacity)) });
      }
      assert.deepEqual(errors, [], `${profile}: browser errors`);
      await context.close();
    }
  } finally { await browser.close(); }
}
console.log(JSON.stringify(results, null, 2));
