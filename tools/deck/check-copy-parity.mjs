// Compare disposable copy layers with canonical text; slides 3 and 5 paint their semantic trees directly.
// Usage: node tools/deck/check-copy-parity.mjs [url] [phone|desktop|both]
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';

const base = process.argv[2] || 'http://127.0.0.1:8412/mycelial/index.html';
const requestedProfile = process.argv[3] || 'both';
const profiles = requestedProfile === 'both' ? ['phone', 'desktop'] : [requestedProfile];
const limitPx = 0.5;
if (!['phone', 'desktop', 'both'].includes(requestedProfile) || !/^https?:\/\//.test(base)) {
  console.error('Usage: node tools/deck/check-copy-parity.mjs [url] [phone|desktop|both]');
  process.exit(2);
}

const output = { base, limitPx, started: new Date().toISOString(), profiles: {}, failures: [] };
const selectors = ['h1', '.body', '.num', '.fw-stat', '.fw-asks'];

async function armCapture(page) {
  await page.evaluate(selectors => {
    window.__deckParityObserver?.disconnect();
    window.__deckParityResult = null;
    const observe = () => {
    const activeSlide = document.querySelector('.slide.on');
    const slides = [...document.querySelectorAll('.slide')];
    const active = slides.indexOf(activeSlide) + 1;
    const overlays = [...(activeSlide?.querySelectorAll('.dt-copy-overlay') || [])];
    const lineRects = element => {
      const range = document.createRange();
      range.selectNodeContents(element);
      return [...range.getClientRects()].filter(rect => rect.width > 0 && rect.height > 0)
        .map(rect => [rect.left, rect.top, rect.right, rect.bottom]);
    };
    const comparisons = [];
    for (const overlay of overlays) {
      const source = overlay.previousElementSibling;
      for (const selector of selectors) {
        const copied = overlay.matches(selector) ? [overlay] : [...overlay.querySelectorAll(selector)];
        const canonical = source.matches(selector) ? [source] : [...source.querySelectorAll(selector)];
        for (let index = 0; index < Math.max(copied.length, canonical.length); index++) {
          const cloneLines = copied[index] ? lineRects(copied[index]) : [];
          const sourceLines = canonical[index] ? lineRects(canonical[index]) : [];
          const deltas = [];
          for (let line = 0; line < Math.max(cloneLines.length, sourceLines.length); line++) {
            if (!cloneLines[line] || !sourceLines[line]) deltas.push(Infinity);
            else for (let edge = 0; edge < 4; edge++) deltas.push(Math.abs(cloneLines[line][edge] - sourceLines[line][edge]));
          }
          comparisons.push({ selector, index, sourceLines: sourceLines.length, cloneLines: cloneLines.length,
            maxDeltaPx: deltas.length ? Math.max(...deltas) : 0 });
        }
      }
    }
    const canonical = activeSlide?.querySelector('.gap-copy-content, .as-copy');
    const canonicalPaint = canonical ? {
      count: activeSlide.querySelectorAll('.gap-copy-content, .as-copy').length,
      hidden: canonical.classList.contains('dt-copy-hidden'),
      masks: [canonical.parentElement, canonical, canonical.querySelector('h1')].map(el => getComputedStyle(el).maskImage),
      lineCount: lineRects(canonical).length,
      opacity: Number(getComputedStyle(canonical).opacity),
      alpha: Number(getComputedStyle(canonical).getPropertyValue(canonical.matches('.as-copy') ? '--as-copy-alpha' : '--gap-copy-alpha')),
    } : null;
    return { active, settled: !!activeSlide?.hasAttribute('data-settled'), overlayCount: overlays.length, canonicalPaint,
      comparisons, maxDeltaPx: Math.max(0, ...comparisons.map(item => item.maxDeltaPx)) };
    };
    window.__deckParityRead = observe;
    const observer = new MutationObserver(records => {
      const inserted = records.some(record => [...record.addedNodes].some(node => node.nodeType === 1 &&
        (node.matches?.('.dt-copy-overlay') || node.querySelector?.('.dt-copy-overlay'))));
      if (!inserted) return;
      observer.disconnect();
      requestAnimationFrame(() => { window.__deckParityResult = observe(); });
    });
    window.__deckParityObserver = observer;
    // The outgoing slide can be canonical-only (slide 3), so observe the
    // destination's insertions too rather than relying on outgoing clones.
    observer.observe(document.body, { childList: true, subtree: true });
  }, selectors);
}

async function readCapture(page, expected) {
  await page.waitForFunction(n => {
    const slide = document.querySelector('.slide.on');
    return [...document.querySelectorAll('.slide')].indexOf(slide) + 1 === n &&
      (window.__deckParityResult !== null || slide?.hasAttribute('data-settled'));
  }, expected, { timeout: 20000 });
  return page.evaluate(() => window.__deckParityResult || window.__deckParityRead());
}

async function runProfile(browser, profile) {
  const mobile = profile === 'phone';
  const context = await browser.newContext(mobile ? {
    viewport: { width: 390, height: 670 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1'
  } : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  if (mobile) {
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  }
  page.setDefaultTimeout(30000);
  await page.goto(`${base.replace(/#.*$/, '')}?debug=1`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => !document.documentElement.classList.contains('dt-intro'), null, { timeout: 60000 });
  const waitForSlide = async n => page.waitForFunction(expected => {
    const slide = [...document.querySelectorAll('.slide')].findIndex(element => element.classList.contains('on')) + 1;
    return slide === expected && document.querySelector('.slide.on')?.hasAttribute('data-settled');
  }, n, { timeout: 15000 });
  await waitForSlide(1);

  // Re-enter the first slide so it is measured during navigation, then visit the rest.
  await page.keyboard.press('ArrowRight'); await waitForSlide(2);
  await armCapture(page); await page.keyboard.press('ArrowLeft');
  const first = await readCapture(page, 1);
  const slides = [{ slide: 1, ...first, overlayObserved: first.overlayCount > 0 }];
  await waitForSlide(1);
  for (let n = 2; n <= 11; n++) {
    await armCapture(page); await page.keyboard.press('ArrowRight');
    const sample = await readCapture(page, n);
    slides.push({ slide: n, ...sample, overlayObserved: sample.overlayCount > 0 });
    await waitForSlide(n);
  }
  await context.close();
  return { profile, viewport: mobile ? '390x670 @3 DPR' : '1440x900 @1 DPR', slides,
    slidesWithoutOverlay: slides.filter(slide => !slide.overlayObserved).map(slide => slide.slide),
    failures: slides.filter(slide => {
      if (slide.slide === 3 || slide.slide === 5) {
        const canonical = slide.canonicalPaint;
        return slide.overlayCount !== 0 || !canonical || canonical.count !== 1 || canonical.hidden ||
          canonical.masks.some(mask => mask !== 'none') || canonical.lineCount < 1 ||
          canonical.opacity !== 1 || !Number.isFinite(canonical.alpha) || canonical.alpha < 0 || canonical.alpha > 1;
      }
      return !slide.overlayObserved || !slide.comparisons.length ||
        slide.maxDeltaPx > limitPx || !Number.isFinite(slide.maxDeltaPx);
    })
      .map(slide => ({ slide: slide.slide, overlayObserved: slide.overlayObserved,
        comparisonCount: slide.comparisons.length, maxDeltaPx: slide.maxDeltaPx, canonicalPaint: slide.canonicalPaint })) };
}

let browser;
try {
  const defaultExecutable = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
  const executablePath = process.env.CHROMIUM_PATH || (existsSync(defaultExecutable) ? defaultExecutable : undefined);
  browser = await chromium.launch({ ...(executablePath ? { executablePath } : {}),
    chromiumSandbox: false, args: ['--disable-dev-shm-usage', '--no-zygote'] });
  for (const profile of profiles) output.profiles[profile] = await runProfile(browser, profile);
} catch (error) { output.failures.push(error.stack || String(error)); }
finally { await browser?.close(); }
output.finished = new Date().toISOString();
output.passed = output.failures.length === 0 && Object.values(output.profiles).every(result => result.failures.length === 0);
console.log(JSON.stringify(output, null, 2));
if (!output.passed) process.exitCode = 1;
