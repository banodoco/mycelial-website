// Deck visual lab: capture runs independently of scheduled user input.
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { mkdir, writeFile, appendFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright-core')); } catch { ({ chromium } = require('playwright')); }
const options = {};
for (let i = 2; i < process.argv.length; i++) {
  const k = process.argv[i];
  if (!k.startsWith('--')) throw Error(`Unexpected argument: ${k}`);
  options[k.slice(2)] = !process.argv[i + 1] || process.argv[i + 1].startsWith('--') ? true : process.argv[++i];
}
if (options.help) {
  console.log('lab.mjs --out DIR [--device iphone|desktop] [--height 670|745|844] [--dpr N] [--throttle N] [--input tap|swipe|key] [--fast] [--seq "goto:5 settle next@120 prev@120 resize:745 settle"] [--filmstrip 50:2500] [--film-on next] [--repeat N] [--assert ghosts=0,slide6cards=all,text=visible]');
  process.exit();
}
const device = options.device || 'iphone', method = options.input || 'tap';
const height = Number(options.height || (device === 'iphone' ? 670 : 900));
const throttle = Number(options.throttle || 4), dpr = Number(options.dpr || (device === 'iphone' ? 3 : 1)), repeat = Number(options.repeat || 1);
if (!['iphone', 'desktop'].includes(device) || !['tap', 'swipe', 'key'].includes(method) || !Number.isInteger(repeat) || repeat < 1 || !(throttle >= 1) || !(dpr > 0) || ![670, 745, 844, 900].includes(height)) throw Error('Invalid device, input, repeat, height, throttle or dpr');
const steps = String(options.seq || 'settle').trim().split(/\s+/).map(token => {
  const m = /^(goto:(?:[1-9]|10|11)|resize:(?:670|745|844)|next|prev|settle)(?:@(\d+))?$/.exec(token);
  if (!m) throw Error(`Invalid sequence step ${token}`);
  return { token, action: m[1], delay: Number(m[2] || 0) };
});
const assertions = String(options.assert || '').split(',').filter(Boolean);
if (assertions.some(a => !['ghosts=0', 'slide6cards=all', 'text=visible'].includes(a))) throw Error('Invalid assertion');
const film = options.filmstrip ? /^(\d+):(\d+)$/.exec(options.filmstrip) : null;
if (options.filmstrip && (!film || !Number(film[1]))) throw Error('Expected --filmstrip interval:duration');
const out = path.resolve(options.out || 'lab-output'), url = options.url || 'http://127.0.0.1:8241/mycelial/index.html';
const recorder = fileURLToPath(new URL('./lab-recorder.js', import.meta.url));
await mkdir(path.join(out, 'frames'), { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const median = a => { const v = [...a].sort((x, y) => x - y); return v.length ? (v[Math.floor((v.length - 1) / 2)] + v[Math.floor(v.length / 2)]) / 2 : null; };
const nearest = (a, t) => a.reduce((best, x) => !best || Math.abs(x.t - t) < Math.abs(best.t - t) ? x : best, null);
const preceding = (a, t) => { let lo = 0, hi = a.length; while (lo < hi) { const mid = (lo + hi) >> 1; if (a[mid].t <= t) lo = mid + 1; else hi = mid; } return a[lo - 1] || null; };
const launchOptions = { chromiumSandbox: false, args: ['--disable-dev-shm-usage', '--no-zygote'] };
if (process.env.PW_CHROMIUM) launchOptions.executablePath = process.env.PW_CHROMIUM;
else if (existsSync('/opt/pw-browsers/chromium')) launchOptions.executablePath = '/opt/pw-browsers/chromium';
const browser = await chromium.launch(launchOptions);
const runs = []; let chosen = null;
try {
  for (let run = 1; run <= repeat; run++) {
    const context = await browser.newContext(device === 'iphone' ? {
      viewport: { width: 390, height }, deviceScaleFactor: dpr, isMobile: true, hasTouch: true,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
    } : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: dpr });
    const page = await context.newPage(), cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
    await page.addInitScript({ path: recorder });
    const frames = [], inputTargets = [], checkpoints = [], errors = [];
    let expectedSlide = 1;
    page.on('pageerror', e => errors.push(e.message));
    cdp.on('Page.screencastFrame', e => {
      // Acknowledge immediately; no disk, screenshot or DOM call is on the input path.
      cdp.send('Page.screencastFrameAck', { sessionId: e.sessionId }).catch(() => {});
      if (e.metadata.timestamp) frames.push({ wall: e.metadata.timestamp * 1000, data: e.data });
    });
    await page.goto(url, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => !document.documentElement.classList.contains('dt-intro'), null, { timeout: 60000 });
    const clock = await page.evaluate(() => ({ wall: Date.now(), perf: performance.now(), origin: performance.timeOrigin }));
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 55, maxWidth: device === 'iphone' ? 390 : 720, everyNthFrame: 1 });
    async function settle(label) {
      const result = await page.evaluate(() => window.__lab.settle());
      checkpoints.push({ label, expectedSlide, ...result });
      return result;
    }
    async function dispatch(dir) {
      if (method === 'key') {
        const key = dir > 0 ? 'ArrowRight' : 'ArrowLeft', code = dir > 0 ? 39 : 37;
        await Promise.all(['keyDown', 'keyUp'].map(type => cdp.send('Input.dispatchKeyEvent', { type, key, code: key, windowsVirtualKeyCode: code, nativeVirtualKeyCode: code })));
      } else if (method === 'tap') {
        const point = dir > 0 ? points.next : points.prev;
        if (device === 'desktop') {
          await Promise.all(['mousePressed', 'mouseReleased'].map(type => cdp.send('Input.dispatchMouseEvent', { type, ...point, button: 'left', clickCount: 1 })));
        } else {
          await Promise.all([cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] }), cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })]);
        }
      } else {
        const y = 48, start = dir > 0 ? 320 : 70, end = dir > 0 ? 70 : 320;
        await Promise.all([cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: start, y }] }), cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: end, y }] }), cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })]);
      }
    }
    let points = await page.evaluate(() => Object.fromEntries(['prev', 'next'].map(name => { const r = document.getElementById(`${name}Btn`).getBoundingClientRect(); return [name, { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }]; })));
    async function goto(n) {
      if (options.fast) {
        await page.keyboard.press('o'); await page.locator(`#list li:nth-child(${n})`).click({ force: true }); await page.mouse.move(0, 0);
      } else {
        let active = await page.evaluate(() => history.state?.deckSlide || 1);
        while (active !== n) { const dir = Math.sign(n - active); await dispatch(dir); active += dir; }
      }
    }
    // Each contiguous run of adjacent inputs is scheduled from one absolute wall-clock origin.
    async function burst(group) {
      const base = Date.now() + 250; let offset = 0;
      const tasks = group.map(step => {
        offset += step.delay;
        const target = base + offset, rec = { action: step.action, targetWall: target, target: target - clock.origin };
        inputTargets.push(rec);
        return new Promise(resolve => setTimeout(() => {
          rec.sentWall = Date.now();
          dispatch(step.action === 'next' ? 1 : -1).catch(e => errors.push(e.message)).finally(resolve);
        }, Math.max(0, target - Date.now())));
      });
      await Promise.all(tasks);
    }
    await settle('initial');
    for (let i = 0; i < steps.length;) {
      const step = steps[i];
      if (step.action === 'next' || step.action === 'prev') {
        let j = i + 1; while (j < steps.length && ['next', 'prev'].includes(steps[j].action)) j++;
        const group = steps.slice(i, j);
        await burst(group);
        for (const item of group) expectedSlide = Math.max(1, Math.min(11, expectedSlide + (item.action === 'next' ? 1 : -1)));
        i = j;
      } else {
        if (step.delay) await sleep(step.delay);
        if (step.action === 'settle') await settle(step.token);
        else if (step.action.startsWith('resize:')) {
          await page.setViewportSize({ width: device === 'iphone' ? 390 : 1440, height: Number(step.action.slice(7)) });
          points = await page.evaluate(() => Object.fromEntries(['prev', 'next'].map(name => { const r = document.getElementById(`${name}Btn`).getBoundingClientRect(); return [name, { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }]; })));
        }
        else { expectedSlide = Number(step.action.slice(5)); await goto(expectedSlide); }
        i++;
      }
    }
    // Capture one final still, outside every timed burst.
    const finalPath = path.join(out, 'frames', `run-${run}-final.png`);
    await page.screenshot({ path: finalPath, animations: 'allow', timeout: 30000 });
    await cdp.send('Page.stopScreencast');
    const finalState = await page.evaluate(() => {
      const slides = [...document.querySelectorAll('section.slide')], planes = [...document.querySelectorAll('.st-plane')];
      return { slides: slides.map(s => { const c = getComputedStyle(s); return { opacity: c.opacity, visibility: c.visibility, display: c.display, transform: c.transform, zIndex: c.zIndex, classes: [...s.classList] }; }),
        media: [...document.querySelectorAll('video')].filter(v => !v.paused).map(v => ({ slide: slides.indexOf(v.closest('section.slide')) + 1 || null, className: v.className })),
        markers: [...document.querySelectorAll('.st-flag')].map((f, i) => { const r = planes[i]?.getBoundingClientRect(); return { target: i, targetNonZero: !!r && r.width > 0 && r.height > 0, controls: f.getAttribute('aria-controls') }; }) };
    });
    const data = await page.evaluate(() => ({ ...window.__lab, settle: undefined }));
    if (!frames.length) errors.push('No screencast frames received');
    if (data.error) errors.push(`Recorder: ${data.error}`);
    await context.close();
    const relevant = data.inputs.filter(e => e.type === (method === 'key' ? 'keydown' : method === 'tap' ? 'click' : 'touchend'));
    let cursor = 0;
    for (const target of inputTargets) {
      while (cursor < relevant.length && relevant[cursor].t < target.target - 20) cursor++;
      const event = relevant[cursor];
      const expected = method === 'key' ? (target.action === 'next' ? 'ArrowRight' : 'ArrowLeft') : (target.action === 'next' ? 'nextBtn' : 'prevBtn');
      const matches = method === 'swipe' ? (target.action === 'next' ? event?.x < 120 : event?.x > 270) : (method === 'key' ? event?.key === expected : event?.target === expected);
      if (event && matches && event.t <= target.target + 10000) { target.seen = event.t; target.lateness = event.t - target.target; target.event = event; cursor++; }
      else { target.seen = null; target.lateness = null; }
    }
    const lateness = median(inputTargets.map(x => x.lateness).filter(x => x !== null));
    const invalid = inputTargets.length > 0 && (inputTargets.some(x => x.lateness === null) || lateness === null || lateness > 30);
    const failures = [], timeouts = checkpoints.filter(c => c.timedOut).map(c => c.label);
    for (const c of checkpoints.filter(x => x.label !== 'initial' && !x.timedOut && x.sample)) {
      const s = c.sample;
      if (s.active !== c.expectedSlide) failures.push(`${c.label}: expected slide ${c.expectedSlide}, active ${s.active}`);
      if (assertions.includes('ghosts=0') && s.ghosts.length) failures.push(`${c.label}: ${s.ghosts.length} ghosts`);
      if (assertions.includes('slide6cards=all') && s.active === 6 && (s.flagsTotal !== 5 || s.flags !== 5)) failures.push(`${c.label}: ${s.flags}/${s.flagsTotal} flags`);
      if (assertions.includes('text=visible') && [9, 10].includes(s.active) && !s.text[s.active - 9]) failures.push(`${c.label}: slide ${s.active} text hidden`);
    }
    const samples = data.buf, arrivals = [];
    for (let i = 0; i < samples.length; i++) {
      const s = samples[i]; if (![6, 9, 10].includes(s.active) || (i && samples[i - 1].active === s.active)) continue;
      let end = i + 1; while (end < samples.length && samples[end].active === s.active) end++;
      const segment = samples.slice(i, end), visible = segment.find(x => s.active === 6 ? x.flags === 5 : x.text[s.active - 9]);
      let ghostSince = null, maxGhost = 0;
      for (const x of segment) { const ghost = s.active === 6 ? x.ghosts.some(g => g.slide === 5) : x.ghosts.length > 0; if (ghost && ghostSince === null) ghostSince = x.t; if (!ghost && ghostSince !== null) { maxGhost = Math.max(maxGhost, x.t - ghostSince); ghostSince = null; } }
      if (ghostSince !== null) maxGhost = Math.max(maxGhost, segment.at(-1).t - ghostSince);
      const endTime = segment.at(-1).t, relevantTasks = data.longtasks.filter(x => x.t >= s.t && x.t <= endTime), gaps = data.gaps.filter(x => x.t >= s.t && x.t <= endTime);
      arrivals.push({ slide: s.active, t: s.t, duration: endTime - s.t, visibleAfter: visible ? visible.t - s.t : null, maxFlags: Math.max(...segment.map(x => x.flags)), maxGhostDuration: maxGhost, longtasks: relevantTasks, maxRafGap: Math.max(0, ...gaps.map(x => x.value)) });
    }
    const status = invalid ? 'invalid' : timeouts.length || errors.length ? 'incomplete' : failures.length ? 'fail' : 'pass';
    const result = { run, status, latenessMedian: lateness, inputs: inputTargets, checkpoints, timeouts, failures, errors, arrivals,
      finalState, recorder: { samples: samples.length, finalStride: data.sampleStride, medianCost: median(data.costs), maxCost: Math.max(0, ...data.costs), avgCost: data.costs.reduce((a, b) => a + b, 0) / (data.costs.length || 1), error: data.error || null }, clock, finalPath };
    runs.push(result);
    const jsonl = samples.map(s => JSON.stringify({ run, ...s })).join('\n') + '\n';
    await writeFile(path.join(out, `state-${run}.jsonl`), jsonl);
    if (run === 1) await writeFile(path.join(out, 'state.jsonl'), jsonl);
    else await appendFile(path.join(out, 'state.jsonl'), jsonl);
    await writeFile(path.join(out, `events-${run}.json`), JSON.stringify({ inputs: data.inputs, longtasks: data.longtasks, gaps: data.gaps, shifts: data.shifts }, null, 2));
    await writeFile(path.join(out, 'frames', `screencast-${run}.jsonl.gz`), gzipSync(frames.map(f => JSON.stringify({ timestamp: f.wall / 1000, data: f.data })).join('\n') + '\n', { level: 1 }));
    const score = status === 'fail' ? 3 : status === 'incomplete' ? 2 : status === 'invalid' ? 1 : 0;
    if (!chosen || score > chosen.score || (score === chosen.score && Math.max(0, ...arrivals.map(a => a.maxGhostDuration)) > chosen.ghost)) {
      chosen = { score, ghost: Math.max(0, ...arrivals.map(a => a.maxGhostDuration)), run, frames, samples, inputTargets, clock };
    }
    const counts = Object.fromEntries(['pass', 'fail', 'invalid', 'incomplete'].map(k => [k, runs.filter(r => r.status === k).length]));
    await writeFile(path.join(out, 'summary.json'), JSON.stringify({ device, viewport: device === 'iphone' ? `390x${height}` : '1440x900', dpr, throttle, method, steps, assertions, counts, validityRate: (runs.length - counts.invalid) / runs.length, settledFailureRate: counts.pass + counts.fail ? counts.fail / (counts.pass + counts.fail) : null, sheetRun: chosen.run, runs }, null, 2));
    console.log(`run ${run}/${repeat}: ${status}, median lateness ${lateness?.toFixed(1) ?? 'n/a'} ms, timeouts ${timeouts.length}`);
  }
  // Compose after all input and recorder work; screencast timestamps use wall seconds.
  const picks = [];
  if (chosen && film) {
    const filmInput = chosen.inputTargets.find(x => !options['film-on'] || x.action === options['film-on']);
    const anchor = filmInput?.seen ?? filmInput?.target ?? chosen.samples[0]?.t;
    for (let elapsed = 0; elapsed <= Number(film[2]); elapsed += Number(film[1])) {
      const t = anchor + elapsed, frame = nearest(chosen.frames.map(f => ({ ...f, t: f.wall - chosen.clock.origin })), t);
      const sample = frame && preceding(chosen.samples, frame.t), age = sample ? frame.t - sample.t : null, fresh = age !== null && age <= 250;
      if (frame) picks.push({ t, elapsed, data: frame.data, actual: frame.t, sampleAge: age, active: fresh ? sample.active : '?', ghosts: fresh ? sample.ghosts.length : '?',
        marker: chosen.inputTargets.flatMap(x => [Math.abs(x.target - t) <= Number(film[1]) / 2 ? `${x.action}:target` : '', x.seen !== null && Math.abs(x.seen - t) <= Number(film[1]) / 2 ? `${x.action}:seen` : '']).filter(Boolean).join(',') });
    }
  } else if (chosen) {
    for (const target of chosen.inputTargets) {
      const frame = nearest(chosen.frames.map(f => ({ ...f, t: f.wall - chosen.clock.origin })), target.target), sample = frame && preceding(chosen.samples, frame.t);
      const age = sample ? frame.t - sample.t : null, fresh = age !== null && age <= 250;
      if (frame) picks.push({ t: target.target, elapsed: Math.round(target.target - (chosen.inputTargets[0]?.target || target.target)), actual: frame.t, data: frame.data, sampleAge: age, active: fresh ? sample.active : '?', ghosts: fresh ? sample.ghosts.length : '?', marker: `${target.action}:target` });
    }
  }
  if (!picks.length && chosen?.frames.length) {
    const frame = chosen.frames.at(-1), t = frame.wall - chosen.clock.origin, sample = preceding(chosen.samples, t), age = sample ? t - sample.t : null, fresh = age !== null && age <= 250;
    picks.push({ t, elapsed: 0, actual: t, data: frame.data, sampleAge: age, active: fresh ? sample.active : '?', ghosts: fresh ? sample.ghosts.length : '?', marker: 'final' });
  }
  if (picks.length) {
    const sheetPage = await browser.newPage();
    const sheet = await sheetPage.evaluate(async picks => {
      const w = 195, h = 422, cols = 6, label = 35, canvas = document.createElement('canvas');
      canvas.width = cols * w; canvas.height = Math.ceil(picks.length / cols) * (h + label);
      const ctx = canvas.getContext('2d'); ctx.fillStyle = '#161616'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.font = '11px sans-serif';
      for (let i = 0; i < picks.length; i++) { const p = picks[i], img = new Image(); img.src = `data:image/jpeg;base64,${p.data}`; await img.decode(); const x = i % cols * w, y = Math.floor(i / cols) * (h + label); ctx.fillStyle = 'white'; ctx.fillText(`+${p.elapsed}ms S${p.active} ghosts:${p.ghosts}`, x + 3, y + 13); ctx.fillText(`${p.marker} Δ${Math.round(p.actual - p.t)}ms age:${p.sampleAge === null ? '?' : Math.round(p.sampleAge)}`, x + 3, y + 27); ctx.drawImage(img, x, y + label, w, h); }
      return canvas.toDataURL('image/png').split(',')[1];
    }, picks);
    await writeFile(path.join(out, 'sheet.png'), Buffer.from(sheet, 'base64'));
    await writeFile(path.join(out, 'sheet.json'), JSON.stringify({ run: chosen.run, frames: picks.map(({ data: _data, ...p }) => p) }, null, 2));
    await sheetPage.close();
  }
  const counts = Object.fromEntries(['pass', 'fail', 'invalid', 'incomplete'].map(k => [k, runs.filter(r => r.status === k).length]));
  console.log(JSON.stringify({ counts, validFailureRate: counts.pass + counts.fail ? counts.fail / (counts.pass + counts.fail) : null }));
} finally { await browser.close(); }
