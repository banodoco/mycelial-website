// Inspect the actual sprite draws and Core outline in real keyboard turns.
import assert from 'node:assert/strict';
import { chromium, webkit, devices } from 'playwright-core';
const base = process.argv.find(a => /^https?:/.test(a)) || 'http://127.0.0.1:8240/mycelial/index.html';
for (const [name, engine, profile] of [['chromium-phone', chromium, 'phone'], ['webkit-phone', webkit, 'phone'], ['chromium-desktop', chromium, 'desktop']]) {
  const browser = await engine.launch(engine === chromium ? { headless: true, executablePath: process.env.CHROMIUM_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' } : { headless: true });
  const context = await browser.newContext(profile === 'phone' ? { ...devices['iPhone 13'], viewport: { width: 390, height: 669 } } : { viewport: { width: 1440, height: 900 } });
  const page = await context.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => {
    const original = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function(source, ...args) {
      if (this.canvas.classList.contains('as-core-flight') && source instanceof HTMLCanvasElement && source.width === 23 && source.height === 20 && args.length === 4) {
        const data = source.getContext('2d').getImageData(0, 0, 23, 20).data; let filled = 0;
        for (let i = 3; i < data.length; i += 4) if (data[i]) filled++;
        const core = window.AstridCoreGeometry(), xs = core.outline.map(p => p[0]), ys = core.outline.map(p => p[1]);
        (window.__minkDraws ||= []).push({ time: performance.now(), filled, alpha: this.globalAlpha, x: args[0], y: args[1], width: args[2], height: args[3],
          outline: { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) },
          avatar: +getComputedStyle(document.querySelector('.as-avatar img')).opacity, avatarRect: (() => { const b = document.querySelector('.as-avatar img').getBoundingClientRect(); return { x: b.left, y: b.top, width: b.width, height: b.height }; })() });
      }
      return original.call(this, source, ...args);
    };
  });
  const settled = n => page.waitForFunction(n => document.querySelectorAll('.slide')[n - 1].matches('.on[data-settled]'), n, { timeout: 30000 });
  await page.goto(`${base}#4`); await settled(4); const results = [];
  for (const [key, target, back] of [['ArrowRight', 5, false], ['ArrowLeft', 4, true]]) {
    await page.evaluate(() => { window.__minkDraws = []; }); await page.keyboard.press(key); await settled(target); await page.waitForTimeout(300);
    const all = await page.evaluate(() => window.__minkDraws), visible = all.filter(s => s.alpha > .02 && s.filled > 0), coreEnd = back ? visible.at(-1) : visible[0], avatarEnd = back ? visible[0] : visible.at(-1);
    assert(visible.length >= 8, JSON.stringify({ name, key, visible }));
    assert(Math.abs(coreEnd.width - coreEnd.outline.width) < 1 && Math.abs(coreEnd.height - coreEnd.outline.height) < 1, JSON.stringify(coreEnd));
    assert(Math.abs(coreEnd.x - coreEnd.outline.x) < 1 && Math.abs(coreEnd.y - coreEnd.outline.y) < 1, JSON.stringify(coreEnd));
    assert(Math.abs(avatarEnd.width - 23) < 1 && Math.abs(avatarEnd.height - 20) < 1, JSON.stringify(avatarEnd));
    const counts = visible.map(s => s.filled); assert(Math.min(...counts) < Math.max(...counts) * .7, 'pixels gradually fill or unfill');
    assert(visible.every(s => s.avatar === 0 || (Math.abs(s.x - s.avatarRect.x) < 1 && Math.abs(s.y - s.avatarRect.y) < 1 && Math.abs(s.width - s.avatarRect.width) < 1 && Math.abs(s.height - s.avatarRect.height) < 1)), 'overlap occurs only at the registered destination');
    const timeDeltas = visible.slice(1).map((s, i) => ({ dt: s.time - visible[i].time, alpha: Math.abs(s.alpha - visible[i].alpha) }));
    assert(timeDeltas.every(s => s.alpha <= .20 * Math.max(1, s.dt / 16)), JSON.stringify(timeDeltas));
    assert.equal(await page.locator('.as-avatar img').evaluate(el => el.style.opacity), '');
    results.push({ key, frames: visible.length, outline: coreEnd.outline, spriteAtCore: { x: coreEnd.x, y: coreEnd.y, width: coreEnd.width, height: coreEnd.height }, filledRange: [Math.min(...counts), Math.max(...counts)] });
  }
  assert.deepEqual(errors, []); console.log(JSON.stringify({ engine: name, results, errors })); await context.close(); await browser.close();
}
