// Sample the real painted handoff every animation frame; phone WebKit is an emulation, not iOS.
import { chromium, webkit, devices } from 'playwright-core';
import assert from 'node:assert/strict';
const base = process.argv.find(a => /^https?:/.test(a)) || 'http://127.0.0.1:8240/mycelial/index.html';
for (const [name, engine] of [['chromium', chromium], ['webkit', webkit]]) {
  const browser = await engine.launch(engine === chromium ? { headless: true, executablePath: process.env.CHROMIUM_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' } : { headless: true });
  const context = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 669 } });
  const page = await context.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message));
  const settled = n => page.waitForFunction(n => document.querySelectorAll('.slide')[n - 1].matches('.on[data-settled]'), n, { timeout: 30000 });
  await page.goto(`${base}#5`); await settled(5);
  const results = [];
  for (let visit = 0; visit < 3; visit++) {
    await page.evaluate(() => { const rows = window.__coreFrames = []; let begun = false;
      function frame(t) { const core = document.querySelector('[data-astrid-core]'), editor = document.querySelector('[data-astrid-demo]');
        const flight = !!document.querySelector('.as-core-flight'); if (flight) begun = true;
        if (begun) rows.push({ t, flight, core: +getComputedStyle(core).opacity, coreY: +core.getBoundingClientRect().top.toFixed(2),
          editor: +getComputedStyle(editor).opacity, editorVisibility: getComputedStyle(editor).visibility });
        if (!begun || flight) requestAnimationFrame(frame);
      } requestAnimationFrame(frame);
    });
    await page.keyboard.press('ArrowLeft'); await settled(4); await page.waitForTimeout(200);
    const rows = await page.evaluate(() => window.__coreFrames), active = rows.filter(r => r.flight), last = active.at(-1);
    assert(active.length >= 12 && last && !rows.at(-1).flight, JSON.stringify({ name, rows }));
    assert(active.some(r => r.core === 0) && active.filter(r => r.core > 0 && r.core < 1).length >= 3, 'Core paints a progressive crossfade');
    assert(last.core >= .99 && last.editor < .01, JSON.stringify(last));
    assert(Math.max(...active.map(r => r.coreY)) - Math.min(...active.map(r => r.coreY)) < .1, 'destination stays fixed throughout flight');
    for (let i = 1; i < active.length; i++) {
      const dt = active[i].t - active[i - 1].t, delta = active[i].core - active[i - 1].core;
      assert(delta >= -.001 && delta <= .13 * Math.max(1, dt / 16.7), JSON.stringify({ dt, delta }));
    }
    results.push({ frames: active.length, firstCore: active[0].core, lastCore: last.core, lastEditor: last.editor });
    await page.keyboard.press('ArrowRight'); await settled(5);
  }
  assert.deepEqual(errors, []); console.log(JSON.stringify({ engine: name, results, errors }));
  await context.close(); await browser.close();
}
