// Exercise real navigation; measure layout-space content offsets, not moving
// screen rectangles (the latter intentionally change while the panels fold).
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium, webkit } from 'playwright-core';
const base = process.argv.find(arg => /^https?:/.test(arg)) || 'http://127.0.0.1:8240/mycelial/index.html';
const output = process.env.DECK_CAPTURE_DIR;
if (output) mkdirSync(output, { recursive: true });
const settled = (page, n) => page.waitForFunction(n => {
  const slide = document.querySelectorAll('.slide')[n - 1];
  return slide.classList.contains('on') && slide.hasAttribute('data-settled');
}, n, { timeout: 30000 });
async function beginTrace(page) {
  await page.evaluate(() => {
    window.chatTrace = [];
    window.stopChatTrace = false;
    const read = el => {
      if (!el) return null;
      const cs = getComputedStyle(el), rect = el.getBoundingClientRect();
      let visible = rect.width > 0 && rect.height > 0, opacity = 1;
      for (let parent = el; parent; parent = parent.parentElement) {
        const style = getComputedStyle(parent);
        visible &&= style.visibility === 'visible' && style.display !== 'none';
        opacity *= +style.opacity;
      }
      // offsetTop uses the panel as offsetParent for both rows and viewport.
      const rows = [...el.children].filter(row => getComputedStyle(row).display !== 'none').map(row => ({
        text: row.textContent.replace(/\s+/g, ' ').trim(),
        top: row.offsetTop - el.offsetTop - el.scrollTop,
        bottom: row.offsetTop - el.offsetTop - el.scrollTop + row.offsetHeight,
      }));
      return { visible: visible && opacity > .01, opacity, top: el.scrollTop,
        height: el.clientHeight, scrollHeight: el.scrollHeight,
        // The phone view deliberately clips old rows above a flex-end origin.
        // Its scrollHeight does not describe a positive scroll range.
        gap: cs.justifyContent === 'flex-end' ? Math.abs(el.scrollTop) : Math.max(0, el.scrollHeight - el.clientHeight) - el.scrollTop,
        rawGap: el.scrollHeight - el.clientHeight - el.scrollTop,
        padding: parseFloat(cs.paddingBottom), rect: [rect.x, rect.y, rect.width, rect.height],
        rows, text: el.textContent.replace(/\s+/g, ' ').trim() };
    };
    const sample = () => {
      // RO callbacks synchronize changed font/layout metrics before paint.
      // Sample after those callbacks, rather than the earlier rAF phase.
      const afterLayout = new ResizeObserver(() => {
      afterLayout.disconnect();
      window.chatTrace.push({ at: performance.now(),
        canonical: read(document.querySelector('[data-astrid-demo] .as-msgs')),
        clone: read(document.querySelector('.st-ghost .as-msgs')),
        await: document.querySelector('.as-host').classList.contains('dt-await'),
        ghosts: document.querySelectorAll('.st-ghost').length });
      if (!window.stopChatTrace) requestAnimationFrame(sample);
      });
      afterLayout.observe(document.documentElement);
    };
    requestAnimationFrame(sample);
  });
}
async function finishTrace(page, label, expectClone = true) {
  await page.waitForTimeout(850);
  const trace = await page.evaluate(() => { window.stopChatTrace = true; return window.chatTrace; });
  if (output) writeFileSync(`${output}/${label}.json`, JSON.stringify(trace));
  const clones = trace.filter(frame => frame.clone?.visible), canonical = trace.filter(frame => frame.canonical?.visible && frame.canonical.text.includes('MiniMax H3 used all four frames'));
  if (expectClone) assert(clones.length > 3, `${label}: visible folding copy was actually observed`);
  assert(canonical.length > 5, `${label}: canonical landing observed`);
  for (const frame of trace) {
    if (frame.clone?.visible) {
      assert.equal(frame.clone.text, frame.canonical.text, `${label}: copy content parity`);
      assert.equal(frame.clone.rows.length, frame.canonical.rows.length, `${label}: responsive row parity`);
      frame.clone.rows.forEach((row, i) => {
        assert.equal(row.text, frame.canonical.rows[i].text);
        assert(Math.abs(row.top - frame.canonical.rows[i].top) <= 2, `${label}: content moved inside copy: ${JSON.stringify({ row, canonical: frame.canonical.rows[i] })}`);
      });
    }
    for (const panel of [frame.clone, frame.canonical]) {
      if (!panel?.visible || !panel.rows.length) continue;
      assert(Math.abs(panel.gap) <= 1, `${label}: scroll viewport is not at bottom: ${panel.gap}`);
      const last = panel.rows.at(-1);
      assert(last.bottom <= panel.height + 2 && last.bottom >= panel.height - panel.padding - 2,
        `${label}: latest message not seated at bottom: ${JSON.stringify({ last, height: panel.height, padding: panel.padding })}`);
    }
  }
  const result = { label, frames: trace.length, cloneFrames: clones.length,
    maxCloneBottomGap: Math.max(0, ...clones.map(f => Math.abs(f.clone.gap))),
    maxCanonicalBottomGap: Math.max(0, ...canonical.map(f => Math.abs(f.canonical.gap))),
    firstClone: clones[0], lastClone: clones.at(-1), landed: canonical.at(-1) };
  assert.equal(await page.locator('.st-ghost').count(), 0, `${label}: copies retired`);
  return result;
}
const results = [];
for (const [engine, type] of [['chromium', chromium], ['webkit', webkit]]) {
  const browser = await type.launch({ headless: true, ...(engine === 'chromium' ? { executablePath: process.env.CHROMIUM_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' } : {}) });
  try {
    for (const mobile of [false, true]) {
      const profile = `${engine}-${mobile ? 'phone' : 'desktop'}`;
      if (process.env.DECK_PROFILE && profile !== process.env.DECK_PROFILE) continue;
      const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 669 } : { width: 1440, height: 900 }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 3 : 1 });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      const move = async dir => mobile ? page.locator(dir > 0 ? '#nextBtn' : '#prevBtn').tap() : page.keyboard.press(dir > 0 ? 'ArrowRight' : 'ArrowLeft');
      await page.goto(`${base}#4`); await settled(page, 4);
      await move(1); await settled(page, 5);
      for (const variant of ['first', 'repeat', 'layout', 'resize', 'interrupted']) {
        await move(1); await settled(page, 6);
        await beginTrace(page); await move(-1);
        if (output && variant === 'first') {
          await page.waitForFunction(() => [...document.querySelectorAll('.st-ghost .as-msgs')].some(el => el.clientHeight > 0 && +getComputedStyle(el.closest('.st-ghost')).opacity > .6));
          await page.screenshot({ path: `${output}/${profile}-folding.png` });
        }
        let expectClone = true;
        if (variant === 'layout') {
          // A late font metric change affects both the canonical and attached
          // copy, like a font loading while the reverse is in progress.
          await page.waitForFunction(() => [...document.querySelectorAll('.st-ghost .as-msgs')].some(el => el.clientHeight > 0));
          await page.addStyleTag({ content: '.as-msgs { font-family: Georgia, serif !important; } .as-msg { font-size: 13px !important; }' });
          await page.evaluate(async () => {
            const font = new FontFace('ChatHandoffMetrics', 'url(../assets/fonts/mycelial/cormorant-regular.ttf)');
            document.fonts.add(font);
            const style = document.createElement('style');
            style.textContent = '.as-msgs { font-family: ChatHandoffMetrics, Georgia, serif !important; }';
            document.head.appendChild(style);
            await font.load(); await document.fonts.ready;
          });
        }
        if (variant === 'resize') {
          await page.waitForTimeout(150);
          await page.setViewportSize(mobile ? { width: 844, height: 390 } : { width: 1260, height: 800 });
          expectClone = false;
        }
        if (variant === 'interrupted') {
          await page.waitForTimeout(150);
          await page.evaluate(() => { location.hash = '#6'; });
          await settled(page, 6);
          await beginTrace(page); await move(-1);
        }
        await settled(page, 5);
        const label = `${profile}-${variant}`;
        results.push(await finishTrace(page, label, expectClone));
        if (output && variant === 'first') await page.screenshot({ path: `${output}/${profile}-landed.png` });
      }
      await context.close();
      const reduced = await browser.newPage({ viewport: mobile ? { width: 390, height: 669 } : { width: 1440, height: 900 }, isMobile: mobile, hasTouch: mobile, reducedMotion: 'reduce' });
      reduced.on('pageerror', error => errors.push(error.message));
      await reduced.goto(`${base}#5`); await settled(reduced, 5);
      await reduced.keyboard.press('ArrowRight'); await settled(reduced, 6);
      await beginTrace(reduced); await reduced.keyboard.press('ArrowLeft'); await settled(reduced, 5);
      // Reduced motion bypasses folding; its finished chat must still be
      // populated and at the bottom on the first painted landing.
      results.push(await finishTrace(reduced, `${profile}-reduced-trace`, false));
      const reducedState = await reduced.evaluate(() => { window.stopChatTrace = true; const el = document.querySelector('[data-astrid-demo] .as-msgs'); return { gap: el.scrollHeight - el.clientHeight - el.scrollTop, rows: el.children.length }; });
      assert.equal(reducedState.rows, 9, `${profile}: reduced motion finished conversation`);
      assert(Math.abs(reducedState.gap) <= 1, `${profile}: reduced motion bottom`);
      results.push({ label: `${profile}-reduced`, ...reducedState });
      await reduced.close();
      assert.deepEqual(errors, [], `${profile}: browser errors`);
    }
  } finally { await browser.close(); }
}
if (output) writeFileSync(`${output}/summary.json`, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results.map(({ label, frames, cloneFrames, maxCloneBottomGap, maxCanonicalBottomGap, gap, rows }) => ({ label, frames, cloneFrames, maxCloneBottomGap, maxCanonicalBottomGap, gap, rows })), null, 2));
