import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport, isMobile: viewport.width < 500, hasTouch: viewport.width < 500 });
    await page.goto(`${process.env.TEST_URL || 'http://localhost:8137'}/?nointro=1&pose=equip`);
    await page.waitForFunction(() => !!window.journey, null, { timeout: 60000 });
    await page.waitForTimeout(2200);
    for (const contrast of ['no-preference', 'more']) {
      await page.emulateMedia({ contrast });
      const markers = await page.evaluate(() => ['tworp', 'agent', 'app'].map(id => {
        const button = document.querySelector(`.j-hot[data-node="${id}"]`);
        const label = button.querySelector('.j-hot-label');
        const style = getComputedStyle(button);
        const shell = getComputedStyle(button, '::after');
        const icon = getComputedStyle(button.querySelector('.j-hot-ico'));
        const ink = getComputedStyle(label);
        return { id, shared: button.classList.contains('j-hot--icon-tab'), filter: ink.filter,
          housing: [style.display, style.gridTemplateRows, style.color, style.fontSize,
            shell.backgroundColor, shell.borderWidth, shell.borderRadius, icon.width, icon.height] };
      }));
      for (const marker of markers.slice(1)) {
        assert.ok(marker.shared, 'Equip uses the same initiative marker component');
        assert.deepEqual(marker.housing, markers[0].housing, 'Equip and 2RP share housing, type, and icon treatment');
      }
      // Equip's names were withheld (blurred) until the initiatives shipped,
      // 2026-10-26; now every marker's name is sharp, in either contrast mode.
      for (const marker of markers) assert.equal(marker.filter, 'none', `${marker.id} name is legible at ${viewport.width}px / ${contrast}`);
    }
    await page.emulateMedia({ contrast: 'no-preference' });
    await page.screenshot({ path: `/tmp/equip-marker-after-${viewport.width}.png` });
    console.log(`${viewport.width}: shared marker housing and legible names in normal/increased contrast pass`);
    await page.close();
  }
} finally { await browser.close(); }
