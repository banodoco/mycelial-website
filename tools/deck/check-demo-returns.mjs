// Phone-sized desktop engines; these checks do not run on physical iOS.
import assert from 'node:assert/strict';
import { chromium, webkit, devices } from 'playwright-core';
const base = process.argv.find(a => /^https?:/.test(a)) || 'http://127.0.0.1:8240/mycelial/index.html';
const capture = process.env.DECK_CAPTURE_DIR;
const settled = (page, n) => page.waitForFunction(n => {
  const slide = document.querySelectorAll('.slide')[n - 1];
  return slide.classList.contains('on') && slide.hasAttribute('data-settled');
}, n, { timeout: 30000 });
const read = page => page.evaluate(() => {
  const host = document.querySelector('.as-host');
  const nodes = [host, ...host.querySelectorAll('[data-astrid-demo], .as-stage, .as-chat, .as-edit, .as-player, .as-timeline')];
  return {
    generation: window.deckNav.generation, terminal: window.deckNav.terminal,
    failed: host.getAttribute('data-deck-failed'),
    nodes: nodes.map(el => {
      const r = el.getBoundingClientRect();
      let opacity = 1, visible = true;
      for (let parent = el; parent; parent = parent.parentElement) {
        const cs = getComputedStyle(parent); opacity *= +cs.opacity;
        visible &&= cs.visibility === 'visible' && cs.display !== 'none';
      }
      return { name: el.className, rect: [r.x, r.y, r.width, r.height], opacity, visible };
    }),
    ghosts: document.querySelectorAll('.st-ghost').length,
    flights: [...document.querySelectorAll('.as-flight, .as-flight-flier')].map(el => getComputedStyle(el).display),
    done: host.querySelectorAll('.as-step.is-done').length,
    frames: host.querySelectorAll('.as-frame-clip.is-ready').length,
    result: !!host.querySelector('.as-result-clip.is-ready'),
  };
});
async function visible(page, label) {
  await settled(page, 5);
  // Shared slide and panel CSS arrivals may finish after logical entry.
  await page.waitForFunction(() => {
    for (const el of document.querySelectorAll('.as-host, [data-astrid-demo], .as-host .as-panel, .as-host .as-panel > *')) {
      const cs = getComputedStyle(el);
      if (cs.visibility !== 'visible' || +cs.opacity < .999) return false;
      if (el.getAnimations().some(a => a.playState !== 'finished' && Number.isFinite(a.effect.getComputedTiming().endTime))) return false;
    }
    return true;
  });
  const state = await read(page);
  assert.equal(state.failed, null, label);
  assert.equal(state.ghosts, 0, label);
  assert(state.flights.every(display => display === 'none'), `${label}: flights retired`);
  for (const node of state.nodes) {
    assert(node.visible && node.opacity > .99, `${label}: ${JSON.stringify(node)}`);
    assert(node.rect[2] > 0 && node.rect[3] > 0, `${label}: ${JSON.stringify(node)}`);
    assert(node.rect[0] >= -1 && node.rect[1] >= -1, `${label}: content within viewport`);
  }
  return { label, ...state };
}
const navigate = async (page, dir, n) => { await page.locator(dir > 0 ? '#nextBtn' : '#prevBtn').click(); await settled(page, n); };

async function centering(browser) {
  const sizes = [[390, 669], [390, 844], [844, 390], [1280, 800], [1920, 1080]];
  const results = [];
  const page = await browser.newPage();
  try {
    for (const [width, height] of sizes) {
      await page.setViewportSize({ width, height });
      await page.goto(`${base}#5`); await settled(page, 5);
      const result = await page.evaluate(async () => {
        const stage = document.querySelector('.as-stage');
        const sample = () => [...stage.querySelectorAll('.as-chat, .as-edit, .as-player, .as-timeline'), stage].map(el => {
          const r = el.getBoundingClientRect(); return [r.x, r.y, r.width, r.height];
        });
        const current = sample();
        // Temporarily restore only the previous centering rule for an exact
        // geometry comparison on the same DOM, fonts and animation frame.
        const style = stage.getAttribute('style');
        stage.style.cssText += ';left:50%;right:auto;margin-inline:0;transform:translateX(-50%)';
        const previous = sample();
        if (style === null) stage.removeAttribute('style'); else stage.setAttribute('style', style);
        return { current, previous };
      });
      // WebKit rounds transformed positions differently from layout positions.
      // Preserve sizes exactly and positions to less than one physical pixel.
      result.current.forEach((r, i) => r.forEach((v, j) => assert(Math.abs(v - result.previous[i][j]) <= (j < 2 ? .5 : .02),
        `${width}x${height} panel ${i} axis ${j}: centering changed geometry ${JSON.stringify(result)}`)));
      results.push({ viewport: `${width}x${height}`, maxGeometryDelta: Math.max(...result.current.flatMap((r, i) => r.map((v, j) => Math.abs(v - result.previous[i][j])))) });
    }
    return results;
  } finally { await page.close(); }
}

async function returns(browser, name) {
  const context = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 669 } });
  const page = await context.newPage(), errors = [], results = [];
  page.on('pageerror', e => errors.push(e.message));
  try {
    await page.goto(`${base}#4`); await settled(page, 4);
    for (const [dir, n, label] of [
      [1, 5, 'first 4→5'], [-1, 4], [1, 5, 'repeat 4→5'], [1, 6], [-1, 5, 'first 6→5'],
      [-1, 4], [1, 5, 'third 4→5'], [1, 6], [-1, 5, 'repeat 6→5'],
    ]) {
      await navigate(page, dir, n);
      if (n === 5) results.push(await visible(page, label));
    }
    await navigate(page, -1, 4);
    await page.locator('#nextBtn').click(); await page.waitForTimeout(180);
    await page.setViewportSize({ width: 390, height: 720 });
    results.push(await visible(page, '4→5 entry resized'));
    await navigate(page, 1, 6);
    await page.locator('#prevBtn').click(); await page.waitForTimeout(180);
    await page.setViewportSize({ width: 844, height: 390 });
    results.push(await visible(page, '6→5 fold resized'));
    await page.setViewportSize({ width: 390, height: 669 });
    await page.waitForTimeout(400);
    await navigate(page, -1, 4);
    await page.locator('#nextBtn').click(); await page.waitForTimeout(180);
    await page.evaluate(() => { document.querySelector('#overview').classList.add('on'); dispatchEvent(new Event('deck-overview')); });
    await page.waitForTimeout(450);
    await page.evaluate(() => { document.querySelector('#overview').classList.remove('on'); dispatchEvent(new Event('deck-overview')); });
    results.push(await visible(page, '4→5 entry overview pause/resume'));
    await navigate(page, 1, 6);
    await page.locator('#prevBtn').click(); await page.waitForTimeout(180);
    await page.evaluate(() => { location.hash = '#4'; });
    await settled(page, 4);
    await navigate(page, 1, 5);
    results.push(await visible(page, '6→5 replaced by #4 then 4→5'));
    const generation = (await read(page)).generation;
    await page.waitForTimeout(2000);
    results.push(await visible(page, 'replacement remains stable'));
    assert.equal((await read(page)).generation, generation);
    // The other reverse participant can leave as-unmorph on the editor. Abort
    // that fold and check that a new visit owns its own canonical panels.
    await page.locator('#prevBtn').click(); await page.waitForTimeout(180);
    await page.evaluate(() => { location.hash = '#5'; });
    results.push(await visible(page, '5→4 fold replaced by #5'));
    await page.waitForTimeout(2000);
    results.push(await visible(page, '5→4 replacement remains stable'));
    await page.locator('#prevBtn').click(); await page.waitForTimeout(180);
    await page.setViewportSize({ width: 390, height: 700 });
    await settled(page, 4);
    await navigate(page, 1, 5);
    results.push(await visible(page, '5→4 fold resized then 4→5'));
    // Observe the full three-beat story on the returned visit, including the
    // real guide end, all four frame holds, final result, then normal loop reset.
    await page.waitForFunction(() => document.querySelectorAll('.as-step.is-done').length === 3, null, { timeout: 45000 });
    const final = await visible(page, 'returned visit full demo progression');
    assert(final.frames === 4 && final.result, JSON.stringify(final));
    const media = await page.evaluate(() => [...document.querySelectorAll('.as-media video')].map(v => ({ ended: v.ended, time: v.currentTime, paused: v.paused })));
    assert(media[1].ended && media[0].time > 0 && !media[0].paused, `${name}: healthy actual media progression`);
    results.push(final);
    if (capture) await page.screenshot({ path: `${capture}/slide5-return-${name}.png` });
    await page.waitForFunction(() => document.querySelectorAll('.as-step.is-done').length === 0, null, { timeout: 18000 });
    results.push(await visible(page, 'returned visit loop reset'));
    assert.deepEqual(errors, []);
    return { engine: name, actualIOS: false, results, errors };
  } finally { await context.close(); }
}

const chrome = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const safari = await webkit.launch({ headless: true });
try {
  const geometries = await Promise.all([centering(chrome), centering(safari)]);
  console.log(JSON.stringify({ centering: { chromium: geometries[0], webkit: geometries[1] } }));
  const results = await Promise.all([returns(chrome, 'chromium-phone'), returns(safari, 'webkit-phone')]);
  console.log(JSON.stringify(results, null, 2));
} finally { await chrome.close(); await safari.close(); }
