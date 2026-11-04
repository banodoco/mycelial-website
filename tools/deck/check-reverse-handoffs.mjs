import assert from 'node:assert/strict';
import { chromium, webkit, devices } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
const base = process.argv.find(a => /^https?:/.test(a)) || 'http://127.0.0.1:8240/mycelial/index.html';
const output = process.env.REVERSE_OUTPUT || '/Users/peteromalley/Documents/Codex/2026-11-03/new-chat/outputs';
mkdirSync(output, { recursive: true });
const settled = (p, n) => p.waitForFunction(n => document.querySelectorAll('.slide')[n - 1].matches('.on[data-settled]'), n, { timeout: 30000 });
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
async function instrument(p) {
  await p.addInitScript(() => {
    const proto = CanvasRenderingContext2D.prototype, fill = proto.fillRect, clear = proto.clearRect;
    proto.clearRect = function(...args) { this.canvas.__orange = null; return clear.apply(this, args); };
    proto.fillRect = function(x, y, w, h) {
      if (this.canvas.matches('.fl-canvas,.pa-canvas') && this.fillStyle.toLowerCase() === '#ff7a2e' && this.globalAlpha > 0.05) {
        const old = this.canvas.__orange;
        this.canvas.__orange = { left: Math.min(old?.left ?? Infinity, x), top: Math.min(old?.top ?? Infinity, y), right: Math.max(old?.right ?? -Infinity, x + w), bottom: Math.max(old?.bottom ?? -Infinity, y + h), at: performance.now() };
      }
      return fill.call(this, x, y, w, h);
    };
    window.reverseFrames = [];
    const painted = selector => {
      const c = document.querySelector(selector), b = c?.__orange;
      if (!b) return null;
      const r = c.getBoundingClientRect();
      let opacity = 1;
      for (let e = c; e; e = e.parentElement) opacity *= +getComputedStyle(e).opacity;
      return { x: r.left + (b.left + b.right) / 2, y: r.top + (b.top + b.bottom) / 2, opacity, at: b.at };
    };
    const frame = () => {
      if (window.recordReverse) {
        const seed = document.querySelector('.ac-seed'), r = seed?.getBoundingClientRect();
        const ring = document.querySelector('.gp-empty i')?.getBoundingClientRect();
        window.reverseFrames.push({ at: performance.now(), deck: window.deckNow?.(), seed: r && { x: r.x, y: r.y,
          opacity: Math.max(+getComputedStyle(seed.querySelector('i')).opacity, +getComputedStyle(seed.querySelector('b')).opacity),
          direction: seed.getAnimations()[0]?.effect.getTiming().direction },
          ring: ring && { x: ring.x + ring.width / 2, y: ring.y + ring.height / 2 },
          flowers: painted('.fl-canvas'), pays: painted('.pa-canvas'),
          counterOpacity: document.querySelector('.fl-count') ? +getComputedStyle(document.querySelector('.fl-count')).opacity : 0,
          rewind: !!document.querySelector('.slide.dt-rewind'), settled: !!document.querySelector('.slide.on[data-settled]') });
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
}
async function input(p, phone, dir = -1) {
  if (!phone) return p.keyboard.press(dir < 0 ? 'ArrowLeft' : 'ArrowRight');
  // Dispatch the browser's actual TouchEvent route, with a contact crossing the
  // threshold. Desktop CDP touch injection cannot exercise WebKit's handler.
  await p.evaluate(dir => {
    const target = document.querySelector('.slide.on'), x = dir < 0 ? 65 : 280, y = innerHeight * 0.55;
    const contact = (clientX, clientY) => {
      const point = { identifier: 7, target, clientX, clientY };
      try { return new Touch(point); } catch { return point; } // WebKit does not expose a constructible Touch.
    };
    const send = (type, touches, changedTouches) => {
      let event;
      try { event = new TouchEvent(type, { bubbles: true, touches, changedTouches }); }
      catch { event = new Event(type, { bubbles: true }); Object.defineProperties(event, { touches: { value: touches }, changedTouches: { value: changedTouches } }); }
      target.dispatchEvent(event);
    };
    send('touchstart', [contact(x, y)], [contact(x, y)]);
    send('touchend', [], [contact(x - dir * 150, y + 2)]);
  }, dir);
}
async function run(engine, name, phone) {
  const b = await engine.launch(engine === chromium ? { executablePath: process.env.CHROMIUM_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true } : { headless: true });
  const context = await b.newContext(phone ? { ...devices['iPhone 13'], viewport: { width: 390, height: 669 } } : { viewport: { width: 1280, height: 800 } });
  const p = await context.newPage(), errors = [];
  p.on('pageerror', e => errors.push(e.message));
  await p.addInitScript(() => { window.reverseWatchdogs = 0; addEventListener('deck-watchdog', () => window.reverseWatchdogs++); });
  await instrument(p);
  const result = { name: `${name}-${phone ? 'phone' : 'desktop'}`, input: phone ? 'synthetic touch swipe event route' : 'keyboard', cases: [] };
  try {
    for (const source of [8, 4]) {
      await p.goto(`${base}#${source}`); await settled(p, source); await p.waitForTimeout(800);
      const initial = await p.evaluate(() => ({ flowers: document.querySelector('.fl-canvas')?.__orange, paysSnapshot: !!window.AstridPays.snapshot() }));
      await p.evaluate(() => { window.reverseFrames = []; window.recordReverse = true; });
      await input(p, phone);
      if (source === 4) {
        await p.waitForFunction(() => document.querySelector('.ac-seed'));
        await p.waitForFunction(() => { const a = document.querySelector('.ac-seed')?.getAnimations()[0]; return a && a.currentTime > 300; });
        await p.screenshot({ path: `${output}/reverse-after-${result.name}-4-flight.png` });
      } else {
        await p.waitForFunction(() => document.querySelector('.fl-host.dt-rewind'));
        await p.screenshot({ path: `${output}/reverse-after-${result.name}-8-start.png` });
        await p.waitForFunction(() => { const f = window.reverseFrames; return f.some(x => x.flowers && Math.hypot(x.flowers.x - f[0].flowers.x, x.flowers.y - f[0].flowers.y) > 20); });
        await p.screenshot({ path: `${output}/reverse-after-${result.name}-8-flight.png` });
      }
      await settled(p, source - 1); await p.waitForTimeout(120);
      await p.screenshot({ path: `${output}/reverse-after-${result.name}-${source}-landed.png` });
      const frames = await p.evaluate(() => { window.recordReverse = false; return window.reverseFrames; });
      writeFileSync(`${output}/reverse-frames-${result.name}-${source}.json`, JSON.stringify(frames));
      assert(frames.some(f => f.rewind), 'source picture must own a visible rewind');
      if (source === 4) {
        const flight = frames.filter(f => f.seed && f.seed.opacity > 0.1), first = flight[0], last = flight.at(-1);
        assert(flight.length > 5, 'return must have multiple painted flight frames');
        assert(dist(first.seed, last.seed) > 30, 'seed must visibly move');
        assert(dist(last.seed, last.ring) < 2, JSON.stringify({ last, distance: dist(last.seed, last.ring) }));
        assert(dist(frames[0].ring, last.ring) < 0.1, 'Gap ring must keep its original anchor');
        assert(flight.every(f => f.seed.direction === 'reverse'));
        result.cases.push({ source, frames: flight.length, distance: dist(first.seed, last.seed), landingError: dist(last.seed, last.ring) });
      } else {
        const flight = frames.filter(f => f.flowers?.opacity > 0.95 && f.rewind), first = flight[0].flowers, last = flight.at(-1).flowers;
        assert(flight.length > 5); assert(dist(first, last) > 30, 'Flowers mink must visibly glide back');
        assert(flight.every(f => !(f.pays?.opacity > 0.1 && f.pays.at > f.at - 100)), 'Pays must not paint a duplicate orange mink while Flowers owns it');
        const landed = frames.findLast(f => f.pays?.opacity > 0.95)?.pays;
        assert(landed, 'Pays must paint the mink after the handoff');
        assert(dist(last, landed) < 3, JSON.stringify({ last, landed }));
        assert(flight.filter(f => dist(f.flowers, landed) < dist(first, landed) * 0.2).every(f => f.counterOpacity < 0.01), 'Flowers counter must clear the returning Pays copy');
        result.cases.push({ source, priorPaysSnapshot: initial.paysSnapshot, frames: flight.length, distance: dist(first, last), landingError: dist(last, landed) });
      }
      assert.equal(await p.locator('.ac-seed').count(), 0);
      assert.equal(await p.locator('.slide.dt-rewind,.slide.dt-await,.slide.dt-return').count(), 0);
    }
    // Exercise an ordinary 7→8 visit, its retired Pays source, and the return.
    await p.goto(`${base}#7`); await settled(p, 7); await input(p, phone, 1); await settled(p, 8); await p.waitForTimeout(800);
    await p.evaluate(() => { window.reverseFrames = []; window.recordReverse = true; });
    await input(p, phone); await settled(p, 7);
    assert(await p.evaluate(() => window.reverseFrames.some(f => f.rewind)));
    result.cases.push({ source: 8, afterForwardVisit: true });
    // Interrupt each reverse by a direct navigation, then resize while returning.
    for (const source of [8, 4]) {
      await p.goto(`${base}#${source}`); await settled(p, source); await input(p, phone); await p.waitForTimeout(180);
      await p.evaluate(n => { location.hash = `#${n}`; }, source); await settled(p, source); await p.waitForTimeout(400);
      assert.equal(await p.locator('.ac-seed,.slide.dt-rewind,.slide.dt-await,.slide.dt-return').count(), 0);
      await input(p, phone); await p.waitForTimeout(180);
      await p.setViewportSize(phone ? { width: 393, height: 700 } : { width: 1180, height: 760 });
      await settled(p, source - 1); await p.waitForTimeout(350);
      assert.equal(await p.locator('.ac-seed,.slide.dt-rewind,.slide.dt-await,.slide.dt-return').count(), 0);
      result.cases.push({ source, interruptedAndResized: true });
    }
    await p.emulateMedia({ reducedMotion: 'reduce' });
    for (const source of [8, 4]) {
      await p.goto(`${base}#${source}`); await settled(p, source); await input(p, phone); await settled(p, source - 1);
      assert.equal(await p.locator('.ac-seed,.slide.dt-rewind,.slide.dt-await,.slide.dt-return').count(), 0);
    }
    assert.equal(await p.evaluate(() => window.reverseWatchdogs), 0);
    assert.deepEqual(errors, []); result.reduced = true; result.errors = errors;
    return result;
  } catch (e) { await p.screenshot({ path: `${output}/reverse-failure-${result.name}.png` }); throw e; }
  finally { await b.close(); }
}
const results = [];
for (const [engine, name] of [[chromium, 'chromium'], [webkit, 'webkit']]) for (const phone of [false, true]) { if (process.env.REVERSE_ONLY && `${name}-${phone ? 'phone' : 'desktop'}` !== process.env.REVERSE_ONLY) continue; const result = await run(engine, name, phone); results.push(result); console.log(JSON.stringify(result)); }
writeFileSync(`${output}/reverse-handoffs-results.json`, JSON.stringify(results, null, 2));
