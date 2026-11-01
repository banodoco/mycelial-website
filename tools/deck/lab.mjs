// Visual navigation lab. Run with --help for the deliberately small CLI.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright-core')); } catch { ({ chromium } = require('playwright')); }
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';

const opts = {};
for (let i = 2; i < process.argv.length; i++) {
  const key = process.argv[i];
  if (!key.startsWith('--')) throw Error(`Unexpected argument ${key}`);
  opts[key.slice(2)] = process.argv[i + 1]?.startsWith('--') || !process.argv[i + 1] ? true : process.argv[++i];
}
if (opts.help) {
  console.log('lab.mjs --out DIR [--url URL] [--device iphone|desktop] [--throttle N] [--seq "goto:5 settle next@120 settle"] [--input tap|swipe|key] [--fast] [--filmstrip 50:2500] [--repeat N] [--assert ghosts=0,slide6cards=all,text=visible]');
  process.exit();
}
const device = opts.device || 'iphone', method = opts.input || 'tap';
if (!['iphone', 'desktop'].includes(device) || !['tap', 'swipe', 'key'].includes(method)) throw Error('Invalid device or input');
const out = path.resolve(opts.out || 'lab-output'), repeat = Number(opts.repeat || 1), throttle = Number(opts.throttle || 1);
if (!Number.isInteger(repeat) || repeat < 1 || !Number.isFinite(throttle) || throttle < 1) throw Error('Invalid repeat or throttle');
const sequence = String(opts.seq || 'settle').trim().split(/\s+/).map(token => {
  const m = /^(goto:(?:[1-9]|10|11)|next|prev|settle)(?:@(\d+))?$/.exec(token);
  if (!m) throw Error(`Invalid step ${token}`);
  return { action: m[1], delay: Number(m[2] || 0), token };
});
const film = opts.filmstrip ? /^(\d+):(\d+)$/.exec(opts.filmstrip) : null;
if (opts.filmstrip && (!film || !Number(film[1]))) throw Error('filmstrip must be interval:duration');
const assertions = String(opts.assert || '').split(',').filter(Boolean);
if (assertions.some(x => !['ghosts=0', 'slide6cards=all', 'text=visible'].includes(x))) throw Error('Unknown assertion');
await mkdir(path.join(out, 'frames'), { recursive: true });
const browser = await chromium.launch({ chromiumSandbox: false, args: ['--disable-dev-shm-usage', '--no-zygote'] });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const allRuns = [];
try {
  for (let run = 1; run <= repeat; run++) {
    const context = await browser.newContext(device === 'iphone' ? {
      viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
    } : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
    await page.addInitScript(() => {
      window.__lab = { longtasks: [], shifts: [], gaps: [], last: 0 };
      for (const [type, key] of [['longtask', 'longtasks'], ['layout-shift', 'shifts']]) {
        try { new PerformanceObserver(list => list.getEntries().forEach(e => {
          if (type !== 'layout-shift' || !e.hadRecentInput) window.__lab[key].push({ t: e.startTime, value: type === 'longtask' ? e.duration : e.value });
        })).observe({ type, buffered: true }); } catch { /* unsupported */ }
      }
      const tick = t => { if (window.__lab.last) window.__lab.gaps.push({ t, value: t - window.__lab.last }); window.__lab.last = t; requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    });
    const url = opts.url || 'http://127.0.0.1:8241/mycelial/index.html';
    await page.goto(url, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => !document.documentElement.classList.contains('dt-intro'), null, { timeout: 60000 });
    async function settle() {
      return page.evaluate(async () => {
        const start = performance.now(); let stable = 0, last = '';
        while (performance.now() - start < 15000) {
          await new Promise(r => requestAnimationFrame(r));
          const slide = document.querySelector('.slide.on');
          const rect = slide?.querySelector('h1')?.getBoundingClientRect();
          const pos = rect && [rect.x, rect.y, rect.width, rect.height].map(n => Math.round(n * 2) / 2).join(',');
          const moving = document.getAnimations().some(a => a.playState === 'running' && a.effect?.getComputedTiming().iterations !== Infinity);
          const busy = typeof turn !== 'undefined' && (turn || pendingTurns.length);
          const shifts = window.__lab.shifts;
          const quiet = !shifts.length || performance.now() - shifts[shifts.length - 1].t > 250;
          stable = !busy && !moving && quiet && pos === last ? stable + 1 : 0; last = pos;
          if (stable >= 8) return { ms: performance.now() - start, timedOut: false };
        }
        return { ms: performance.now() - start, timedOut: true };
      });
    }
    async function input(dir) {
      if (method === 'key') return page.keyboard.press(dir > 0 ? 'ArrowRight' : 'ArrowLeft');
      if (method === 'tap') {
        const button = page.locator(dir > 0 ? '#nextBtn' : '#prevBtn');
        return device === 'iphone' ? button.tap({ force: true }) : button.click({ force: true });
      }
      // CDP touch events are browser input, unlike dispatchEvent synthetic gestures.
      const x = dir > 0 ? 320 : 70, end = dir > 0 ? 70 : 320;
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: 400 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: end, y: 405 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    }
    async function goto(n) {
      if (opts.fast) {
        await page.keyboard.press('o');
        await page.locator(`#list li:nth-child(${n})`).click({ force: true });
        await page.mouse.move(0, 0);
      } else {
        let current = await page.evaluate(() => history.state?.deckSlide || 1);
        while (current !== n) { const dir = Math.sign(n - current); await input(dir); current += dir; }
      }
    }
    async function probe() {
      return page.evaluate(() => {
        const slides = [...document.querySelectorAll('section.slide')], active = slides.findIndex(s => s.classList.contains('on'));
        function visible(el) {
          if (!el) return false;
          let r = el.getBoundingClientRect(), left = Math.max(0, r.left), top = Math.max(0, r.top), right = Math.min(innerWidth, r.right), bottom = Math.min(innerHeight, r.bottom), opacity = 1;
          for (let p = el; p; p = p.parentElement) {
            const s = getComputedStyle(p); opacity *= Number(s.opacity);
            if (s.display === 'none' || s.visibility !== 'visible' || s.contentVisibility === 'hidden' || s.clipPath === 'inset(100%)') return false;
            if (/(hidden|clip|scroll|auto)/.test(s.overflow + s.overflowX + s.overflowY)) {
              const b = p.getBoundingClientRect(); left = Math.max(left, b.left); top = Math.max(top, b.top); right = Math.min(right, b.right); bottom = Math.min(bottom, b.bottom);
            }
          }
          return opacity > .02 && right > left && bottom > top;
        }
        const selector = el => el.tagName.toLowerCase() + (el.id ? `#${el.id}` : [...el.classList].slice(0, 3).map(c => `.${c}`).join(''));
        const ghosts = [];
        slides.forEach((slide, i) => {
          if (i === active || !visible(slide)) return;
          // Report visible top-level painted descendants and media; nested duplicates are suppressed.
          for (const el of slide.querySelectorAll('*')) {
            if (!visible(el)) continue;
            const s = getComputedStyle(el), painted = /^(VIDEO|CANVAS|IMG|SVG)$/.test(el.tagName) || (el.children.length === 0 && el.textContent.trim()) || (s.backgroundColor !== 'rgba(0, 0, 0, 0)' && s.backgroundColor !== 'transparent') || s.backgroundImage !== 'none';
            if (painted) ghosts.push({ slide: i + 1, selector: selector(el) });
          }
        });
        const flags = [...document.querySelectorAll('.st-flag')], cards = [...document.querySelectorAll('.st-card')], planes = [...document.querySelectorAll('.st-plane')];
        return { active: active + 1, historySlide: history.state?.deckSlide,
          slides: slides.map(s => { const c = getComputedStyle(s); return { opacity: c.opacity, visibility: c.visibility, display: c.display, transform: c.transform, zIndex: c.zIndex, classes: [...s.classList] }; }),
          ghosts, media: [...document.querySelectorAll('video')].filter(v => !v.paused).map(v => ({ selector: selector(v), slide: slides.indexOf(v.closest('section.slide')) + 1 || null })),
          slide6: { cardsVisible: cards.filter(visible).length, cardsTotal: cards.length, markersVisible: flags.filter(visible).length, markersTotal: flags.length,
            markers: flags.map((f, i) => { const r = planes[i]?.getBoundingClientRect(); return { visible: visible(f), target: `.st-plane:nth(${i})`, targetNonZero: !!r && r.width > 0 && r.height > 0 }; }) },
          text: [9, 10].map(n => { const h = slides[n - 1]?.querySelector('h1'); let masked = false; for (let p = h; p; p = p.parentElement) { const s = getComputedStyle(p); if (s.maskImage !== 'none' || s.webkitMaskImage !== 'none') masked = true; } return { slide: n, visible: visible(h) && !masked, masked }; }) };
      });
    }
    const frames = [], metrics = [], lines = [], failures = [];
    async function capture(step, origin) {
      const state = await probe(), observedAt = Date.now() - origin, name = `r${String(run).padStart(3, '0')}-${String(frames.length).padStart(4, '0')}.png`;
      await page.screenshot({ path: path.join(out, 'frames', name), animations: 'allow', scale: 'css', timeout: 30000 });
      const record = { run, step, elapsed: Date.now() - origin, observedAt, frame: name, ...state }; frames.push(record); lines.push(JSON.stringify(record));
      return state;
    }
    await settle();
    for (const step of sequence) {
      if (step.delay) await sleep(step.delay);
      const t = await page.evaluate(() => performance.now());
      let settling = null;
      if (step.action === 'settle') settling = await settle();
      else if (step.action.startsWith('goto:')) await goto(Number(step.action.slice(5)));
      else await input(step.action === 'next' ? 1 : -1);
      const start = Date.now();
      if (opts['capture-settled'] && step.action !== 'settle') {
        metrics.push({ step: step.token, startedAt: t, captureSkipped: true });
        continue;
      }
      let state = await capture(step.token, start);
      if (film && step.action !== 'settle' && (!opts['film-on'] || opts['film-on'] === step.action)) {
        const interval = Number(film[1]), duration = Number(film[2]);
        for (let due = interval; due <= duration && Date.now() - start < duration; due += interval) {
          await sleep(Math.max(0, start + due - Date.now()));
          if (Date.now() - start > duration) break;
          state = await capture(step.token, start);
          while (due + interval < Date.now() - start) due += interval;
        }
      }
      if (step.action === 'settle') {
        if (settling.timedOut) failures.push(`${step.token}: timed out`);
        if (assertions.includes('ghosts=0') && state.ghosts.length) failures.push(`${step.token}: ${state.ghosts.length} ghosts`);
        if (assertions.includes('slide6cards=all') && state.active === 6 && (state.slide6.markersTotal !== 5 || state.slide6.markersVisible !== 5)) failures.push(`${step.token}: ${state.slide6.markersVisible}/${state.slide6.markersTotal} flags`);
        if (assertions.includes('text=visible') && [9, 10].includes(state.active) && !state.text.find(x => x.slide === state.active).visible) failures.push(`${step.token}: slide ${state.active} text hidden`);
      }
      const perf = await page.evaluate(t0 => { const d = window.__lab; const values = key => d[key].filter(x => x.t >= t0).map(x => x.value); return { longtasks: values('longtasks'), layoutShift: values('shifts').reduce((a, b) => a + b, 0), maxRafGap: Math.max(0, ...values('gaps')) }; }, t);
      metrics.push({ step: step.token, startedAt: t, settle: settling, ...perf });
    }
    await writeFile(path.join(out, `state-${run}.jsonl`), lines.join('\n') + '\n');
    allRuns.push({ run, failures, metrics, frames });
    console.log(`run ${run}/${repeat}: ${failures.length ? failures.join('; ') : 'pass'}`);
    await context.close();
  }
  // Sheet the first failing run, or the first run when there were no failures.
  const chosen = allRuns.find(r => r.failures.length) || allRuns[0];
  const sheetPage = await browser.newPage();
  const images = await Promise.all(chosen.frames.map(async f => ({ ...f, data: (await readFile(path.join(out, 'frames', f.frame))).toString('base64') })));
  const sheet = await sheetPage.evaluate(async ({ images, device }) => {
    const w = device === 'iphone' ? 195 : 288, h = device === 'iphone' ? 422 : 180, columns = device === 'iphone' ? 6 : 4, label = 32;
    const canvas = document.createElement('canvas'); canvas.width = columns * w; canvas.height = Math.ceil(images.length / columns) * (h + label);
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#171717'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.font = '12px sans-serif';
    for (let i = 0; i < images.length; i++) {
      const f = images[i], img = new Image(); img.src = `data:image/png;base64,${f.data}`; await img.decode();
      const x = (i % columns) * w, y = Math.floor(i / columns) * (h + label);
      ctx.fillStyle = 'white'; ctx.fillText(`${f.step}  t+${f.elapsed}ms  slide ${f.active}`, x + 4, y + 20, w - 8); ctx.drawImage(img, x, y + label, w, h);
    }
    return canvas.toDataURL('image/png').split(',')[1];
  }, { images, device });
  await writeFile(path.join(out, 'sheet.png'), Buffer.from(sheet, 'base64'));
  await writeFile(path.join(out, 'state.jsonl'), (await Promise.all(allRuns.map(r => readFile(path.join(out, `state-${r.run}.jsonl`), 'utf8')))).join(''));
  const failed = allRuns.filter(r => r.failures.length).length;
  await writeFile(path.join(out, 'summary.json'), JSON.stringify({ device, method, throttle, sequence, assertions, repeat, failed, failureRate: failed / repeat, sheetRun: chosen.run, runs: allRuns.map(({ frames, ...r }) => r) }, null, 2));
  console.log(`failure rate: ${failed}/${repeat} (${(100 * failed / repeat).toFixed(1)}%); sheet run ${chosen.run}`);
} finally { await browser.close(); }
