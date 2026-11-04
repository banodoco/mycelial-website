// Core↔Demo intentionally uses one live editor and the normal slide fade.
// This replaces assertions about the removed snapshot/reverse morph choreography.
import assert from 'node:assert/strict';
import { chromium, webkit, devices } from 'playwright-core';
const base = process.argv.find(a => /^https?:/.test(a)) || 'http://127.0.0.1:8240/mycelial/index.html';
const settled = (page, n) => page.waitForFunction(n => document.querySelectorAll('.slide')[n - 1].matches('.on[data-settled]'), n, { timeout: 30000 });
async function run(browser, engine) {
  const context = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 669 } });
  const page = await context.newPage(), errors = [], entries = [];
  page.on('pageerror', e => errors.push(e.message));
  try {
    await page.goto(`${base}#4`); await settled(page, 4);
    const canonical = await page.locator('[data-astrid-demo]').elementHandle();
    for (let visit = 0; visit < 3; visit++) {
      await page.keyboard.press('ArrowRight'); await settled(page, 5);
      const entry = await canonical.evaluate(root => ({ connected: root.isConnected, classes: root.className,
        flightLayers: document.querySelectorAll('.as-flight, .as-flight-flier').length,
        snapshotAPI: !!window.AstridCore,
        nodes: [root, ...root.querySelectorAll('.as-panel, .as-panel > *, .as-avatar')].map(el => { const s = getComputedStyle(el); return { opacity: s.opacity, visibility: s.visibility }; }) }));
      assert(entry.connected && !/morph|minkless/.test(entry.classes));
      assert.equal(entry.flightLayers, 0); assert.equal(entry.snapshotAPI, false);
      assert(entry.nodes.every(n => n.opacity === '1' && n.visibility === 'visible'));
      entries.push(entry);
      if (visit < 2) {
        await page.keyboard.press('ArrowLeft'); await settled(page, 4);
        const retired = await canonical.evaluate(root => ({ classes: root.className, opacity: getComputedStyle(root).opacity,
          panels: [...root.querySelectorAll('.as-panel')].map(el => getComputedStyle(el).opacity),
          rewind: root.closest('.slide').hasAttribute('data-as-rewind') }));
        assert(!retired.rewind && !/morph|minkless/.test(retired.classes));
        assert.equal(retired.opacity, '1'); assert(retired.panels.every(p => p === '1'));
      }
    }
    assert.deepEqual(errors, []); return { engine, actualIOS: false, visits: entries.length, canonicalReused: true, hiddenMorphStates: false, errors };
  } finally { await context.close(); }
}
const chrome = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const safari = await webkit.launch({ headless: true });
try { console.log(JSON.stringify(await Promise.all([run(chrome, 'chromium-phone'), run(safari, 'webkit-phone')]), null, 2)); }
finally { await chrome.close(); await safari.close(); }
