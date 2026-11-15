// The direct-load smoke is followed by animated phone entries. A settled h1
// alone missed a frozen reveal clone with different line breaks after toolbar resize.
import { chromium, webkit } from 'playwright-core';

const [base = 'http://127.0.0.1:8181/mycelial/index.html', size = '1440x900', engineFlag = '--engine=chromium'] = process.argv.slice(2);
const engine = engineFlag.replace(/^--engine=/, '');
const [width, height] = size.split('x').map(Number);
if (!/^https?:\/\//.test(base) || !width || !height || !['chromium', 'webkit'].includes(engine)) {
  console.error('Usage: node tools/deck/check-firstload.mjs <base-url> <width>x<height> [--engine=chromium|webkit]');
  process.exit(2);
}
const browser = await (engine === 'webkit' ? webkit.launch() : chromium.launch(process.env.CHROMIUM_PATH
  ? { executablePath: process.env.CHROMIUM_PATH } : { channel: 'chrome' }));
const limitPx = 0.5;

function recordOpening() {
  try { localStorage.removeItem('deck-motion'); } catch {}
  const probe = window.__deckFirstloadProbe = { samples: [], introAt: null, frames: 0, running: true };
  const round = value => Math.round(value * 100) / 100;
  const geometry = heading => {
    const style = getComputedStyle(heading), box = heading.getBoundingClientRect(), rows = [];
    const walker = document.createTreeWalker(heading, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      if (!walker.currentNode.textContent.trim()) continue;
      const range = document.createRange(); range.selectNodeContents(walker.currentNode);
      for (const rect of range.getClientRects()) {
        if (!rect.width || !rect.height) continue;
        const center = (rect.top + rect.bottom) / 2;
        let row = rows.find(row => Math.abs(row.center - center) < parseFloat(style.fontSize) * 0.35);
        if (!row) rows.push(row = { center, left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom });
        else {
          row.left = Math.min(row.left, rect.left); row.right = Math.max(row.right, rect.right);
          row.top = Math.min(row.top, rect.top); row.bottom = Math.max(row.bottom, rect.bottom);
        }
      }
    }
    rows.sort((a, b) => a.top - b.top);
    return { fontSize: parseFloat(style.fontSize), italicSize: parseFloat(getComputedStyle(heading.querySelector('em') || heading).fontSize),
      fontFamily: style.fontFamily, width: round(box.width), lineCount: rows.length,
      topInset: rows.length ? round(rows[0].top - box.top) : 0,
      // Ignore the slide's vertical placement; retain the actual glyph geometry.
      lines: rows.map(row => [row.left - box.left, row.top - rows[0].top, row.right - box.left,
        row.bottom - rows[0].top].map(round)) };
  };
  const paints = heading => {
    const box = heading.getBoundingClientRect();
    if (!box.width || !box.height || box.bottom <= 0 || box.top >= innerHeight) return false;
    for (let el = heading; el; el = el.parentElement) {
      const style = getComputedStyle(el);
      if (style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) <= 0.01) return false;
    }
    let circle;
    const overlay = heading.closest('.dt-copy-overlay'), ink = heading.closest('.vc-spreading');
    if (overlay) {
      const style = getComputedStyle(overlay), mask = style.maskImage || style.webkitMaskImage;
      if (mask?.startsWith('linear-gradient')) return false; // the clone's fully hidden endpoint
      if (mask?.startsWith('radial-gradient')) {
        const px = [...mask.matchAll(/(-?[\d.]+)px/g)].map(match => Number(match[1]));
        const rect = overlay.getBoundingClientRect();
        if (px.length >= 4) circle = { x: rect.left + px[0], y: rect.top + px[1], radius: px.at(-1) };
      }
    } else if (ink) {
      const style = getComputedStyle(ink), value = name => parseFloat(style.getPropertyValue(`--vc-${name}`));
      circle = { x: value('x'), y: value('y'), radius: value('outer') };
    }
    // Count a spreading surface only once its ink reaches a glyph row, rather
    // than treating opacity:1 on an entirely transparent mask as visible copy.
    if (circle) {
      const shape = geometry(heading);
      return shape.lines.some(([left, top, right, bottom]) => {
        const x = Math.max(box.left + left, Math.min(circle.x, box.left + right));
        const y = Math.max(box.top + shape.topInset + top, Math.min(circle.y, box.top + shape.topInset + bottom));
        return Math.hypot(circle.x - x, circle.y - y) < circle.radius - 1;
      });
    }
    return true;
  };
  let signature;
  probe.read = () => {
    const slide = document.querySelector('.vc-host.on');
    if (!slide) return null;
    const headings = [...slide.querySelectorAll('h1')], source = headings.find(heading => !heading.closest('.dt-copy-overlay'));
    if (!source) return null;
    if (window.deckNav?.intro && probe.introAt === null) probe.introAt = performance.now();
    const sample = { at: Math.round(performance.now()), viewport: `${innerWidth}x${innerHeight}`,
      fontsReady: !!document.fonts?.check('400 32px "Cormorant Garamond"', 'Open-source AI') &&
        !!document.fonts?.check('italic 500 32px "Cormorant Garamond"', 'waiting to be unlocked.'),
      settled: slide.hasAttribute('data-settled'), source: geometry(source),
      painted: headings.filter(paints).map(heading => ({ surface: heading.closest('.dt-copy-overlay') ? 'clone' : 'canonical',
        ...geometry(heading) })) };
    const key = JSON.stringify({ ...sample, at: 0 });
    if (key !== signature) { probe.samples.push(sample); signature = key; }
    return sample;
  };
  const frame = () => { if (!probe.running) return; probe.frames++; probe.read(); requestAnimationFrame(frame); };
  requestAnimationFrame(frame);
}

function geometryDiff(a, b) {
  if (!a || !b || !a.lineCount || !b.lineCount) return 'missing heading geometry';
  if (a.lineCount !== b.lineCount) return `${a.lineCount} → ${b.lineCount} lines`;
  if (Math.abs(a.fontSize - b.fontSize) > limitPx || Math.abs(a.italicSize - b.italicSize) > limitPx)
    return `${a.fontSize}px/${a.italicSize}px → ${b.fontSize}px/${b.italicSize}px type`;
  if (a.fontFamily !== b.fontFamily) return 'font family changed';
  const deltas = [Math.abs(a.width - b.width), ...a.lines.flatMap((line, i) => line.map((edge, j) => Math.abs(edge - b.lines[i][j])))];
  return Math.max(...deltas) > limitPx ? `glyph geometry shifted ${Math.max(...deltas).toFixed(2)}px` : null;
}

async function checkOpening(phoneWidth, fromHeight, toHeight) {
  const context = await browser.newContext({ viewport: { width: phoneWidth, height: fromHeight },
    deviceScaleFactor: 3, isMobile: true, hasTouch: true, reducedMotion: 'no-preference' });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.addInitScript(recordOpening);
    const url = new URL(base); url.hash = '';
    await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => Number.isFinite(window.__deckFirstloadProbe?.introAt) &&
      performance.now() - window.__deckFirstloadProbe.introAt >= 1500, null, { timeout: 30000 });
    const before = await page.evaluate(() => window.__deckFirstloadProbe.read());
    await page.setViewportSize({ width: phoneWidth, height: toHeight });
    await page.waitForFunction(() => document.querySelector('.vc-host.on')?.hasAttribute('data-settled') &&
      !document.documentElement.classList.contains('dt-intro'), null, { timeout: 30000 });
    const observation = await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => {
      const probe = window.__deckFirstloadProbe, after = probe.read(); probe.running = false;
      resolve({ after, samples: probe.samples, frames: probe.frames, introAt: probe.introAt });
    }))));
    observation.before = before;
    const failures = [], final = observation.after?.source;
    if (!before?.fontsReady || !observation.after?.fontsReady) failures.push('heading fonts were not ready at both viewport sizes');
    if (!observation.samples.some(sample => !sample.settled && sample.painted.length)) failures.push('no painted headline observed during the opening');
    if (!observation.after?.painted.length) failures.push('settled heading is not painted');
    for (const sample of observation.samples.filter(sample => sample.fontsReady)) {
      const sourceChange = geometryDiff(sample.source, final);
      if (sourceChange) failures.push(`${sample.at}ms ${sample.viewport} canonical: ${sourceChange}`);
      for (const surface of sample.painted) {
        const handoffChange = geometryDiff(surface, final), sourceChange = geometryDiff(surface, sample.source);
        if (handoffChange) failures.push(`${sample.at}ms painted ${surface.surface} → settled: ${handoffChange}`);
        if (sourceChange) failures.push(`${sample.at}ms painted ${surface.surface} → live source: ${sourceChange}`);
      }
    }
    return { viewport: `${phoneWidth}x${fromHeight} → ${phoneWidth}x${toHeight}`, ...observation,
      errors, failures: [...new Set([...failures, ...errors])] };
  } finally { await context.close(); }
}

const context = await browser.newContext({ viewport: { width, height } });
const page = await context.newPage();
const errors = [];
const started = Date.now();
page.on('pageerror', e => errors.push(`page: ${e.message}`));
page.on('console', m => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
try {
  const direct = new URL(base); direct.hash = '1';
  await page.goto(direct.href, { waitUntil: 'load', timeout: 60000 });
  const milestones = await page.waitForFunction(() => {
    const slide = document.querySelector('.slide.on');
    const h1 = slide?.querySelector('h1');
    const visible = h1 && parseFloat(getComputedStyle(h1).opacity) >= 0.99 && getComputedStyle(h1).visibility !== 'hidden';
    const introDone = !document.documentElement.classList.contains('dt-intro');
    if (introDone && visible) return { introDone, visible, slideCount: document.querySelectorAll('.slide').length,
      onCount: document.querySelectorAll('.slide.on').length, title: h1.textContent.trim(), h1Opacity: getComputedStyle(h1).opacity };
    return false;
  }, null, { timeout: 30000 }).then(h => h.jsonValue());
  const result = { base, engine, viewport: `${width}x${height}`, firstWordsMs: Date.now() - started, milestones, errors };
  const failures = [];
  if (milestones.slideCount !== 11) failures.push(`expected 11 slides, found ${milestones.slideCount}`);
  if (milestones.onCount !== 1) failures.push(`expected one active slide, found ${milestones.onCount}`);
  if (!milestones.title || !milestones.title.trim()) failures.push('first slide heading is blank');
  if (errors.length) failures.push(...errors);
  await page.close();
  result.openings = [];
  // Cross the old 740px breakpoint in both directions, at narrow and wider
  // phone widths. Assert stable wrapping, never an assumed three-line count.
  for (const phoneWidth of [375, 390]) for (const [fromHeight, toHeight] of [[844, 700], [700, 844]]) {
    const opening = await checkOpening(phoneWidth, fromHeight, toHeight);
    result.openings.push(opening);
    failures.push(...opening.failures.map(failure => `${opening.viewport}: ${failure}`));
  }
  result.failures = failures;
  console.log(JSON.stringify(result, null, 2));
  if (failures.length) process.exitCode = 1;
} finally {
  await context.close();
  await browser.close();
}
