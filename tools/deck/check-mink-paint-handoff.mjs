// Capture real avatar-region pixels through both handoffs, not just DOM opacity.
import assert from 'node:assert/strict';
import { chromium, webkit, devices } from 'playwright-core';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
const base = process.argv.find(a => /^https?:/.test(a)) || 'http://127.0.0.1:8240/mycelial/index.html';
for (const [engineName, engine] of [['chromium', chromium], ['webkit', webkit]]) {
  const browser = await engine.launch(engine === chromium ? { headless: true, executablePath: process.env.CHROMIUM_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' } : { headless: true });
  const context = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 669 } });
  const page = await context.newPage(), errors = [], directory = mkdtempSync(join(tmpdir(), 'mink-paint-')); page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => {
    const original = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function(source, ...args) {
      if (this.canvas.classList.contains('as-core-flight') && source instanceof HTMLCanvasElement && source.width === 23 && source.height === 20 && args.length === 4) {
        const a = document.querySelector('.as-avatar img').getBoundingClientRect();
        window.__spriteDraw = { time: performance.now(), aligned: Math.abs(args[0] - a.left) < 1 && Math.abs(args[1] - a.top) < 1 && Math.abs(args[2] - a.width) < 1 && Math.abs(args[3] - a.height) < 1 };
      }
      return original.call(this, source, ...args);
    };
  });
  const settled = n => page.waitForFunction(n => document.querySelectorAll('.slide')[n - 1].matches('.on[data-settled]'), n, { timeout: 30000 });
  await page.goto(`${base}#5`); await settled(5); const rect = await page.locator('.as-avatar img').boundingBox();
  const clip = { x: Math.floor(rect.x - 2), y: Math.floor(rect.y - 2), width: 27, height: 24 };
  const captures = [];
  for (let repeat = 0; repeat < 3; repeat++) {
    await page.keyboard.press('ArrowLeft'); await settled(4);
    await page.evaluate(() => { window.__spriteDraw = null; }); await page.keyboard.press('ArrowRight');
    await page.waitForFunction(() => window.__spriteDraw?.aligned && performance.now() - window.__spriteDraw.time < 120, null, { timeout: 10000 });
    for (let i = 0; i < 9; i++) {
      const file = join(directory, `forward-${repeat}-${i}.png`); await page.screenshot({ path: file, clip }); captures.push({ file, phase: 'arrival' });
      await page.waitForTimeout(20);
    }
    await settled(5); await page.evaluate(() => { window.__spriteDraw = null; }); await page.keyboard.press('ArrowLeft');
    // Stop sampling once the sprite actually starts leaving its avatar seat.
    for (let i = 0; i < 12; i++) {
      const before = await page.evaluate(() => { const d = window.__spriteDraw; return { d, opacity: +getComputedStyle(document.querySelector('.as-avatar img')).opacity, now: performance.now() }; });
      if (before.d && !before.d.aligned && before.now - before.d.time < 120) break;
      const file = join(directory, `reverse-${repeat}-${i}.png`); await page.screenshot({ path: file, clip });
      const after = await page.evaluate(() => { const d = window.__spriteDraw; return { d, now: performance.now() }; });
      if (after.d && !after.d.aligned && after.now - after.d.time < 120) break;
      captures.push({ file, phase: 'departure' }); await page.waitForTimeout(10);
    }
    await settled(4); await page.keyboard.press('ArrowRight'); await settled(5);
  }
  const code = `from PIL import Image\nimport json,sys\nout=[]\nfor f in sys.argv[1:]:\n im=Image.open(f).convert('RGB')\n out.append(sum(1 for r,g,b in im.getdata() if r>120 and r-g>35 and g-b>15))\nprint(json.dumps(out))`;
  const result = spawnSync('python3', ['-c', code, ...captures.map(x => x.file)], { encoding: 'utf8' }); assert.equal(result.status, 0, result.stderr);
  const counts = JSON.parse(result.stdout), arrival = counts.filter((_, i) => captures[i].phase === 'arrival'), departure = counts.filter((_, i) => captures[i].phase === 'departure');
  assert(arrival.length >= 15 && departure.length >= 3, JSON.stringify({ arrival, departure }));
  assert(arrival.every(n => n > 250) && departure.every(n => n > 250), JSON.stringify({ engineName, arrival, departure }));
  assert.deepEqual(errors, []); console.log(JSON.stringify({ engine: engineName, arrival, departure, errors })); await context.close(); await browser.close();
}
