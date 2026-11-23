// Browser and screenshot QA for the integrated community expansion.
// Runs against a local copy of the deck, not a mockup.
import { chromium } from 'playwright-core';
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const output = join(process.cwd(), '.artifacts', 'slide9-community');
mkdirSync(output, { recursive: true });
const candidates = [
  process.env.CHROME_PATH,
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/opt/google/chrome/chrome',
].filter(Boolean);
const executablePath = candidates.find((s) => existsSync(s));
if (!executablePath) throw new Error('No Chromium/Chrome executable for visual QA');

const server = spawn('python3', ['serve.py'], {
  cwd: process.cwd(),
  env: { ...process.env, PORT: '8137' }, stdio: 'ignore',
});
const base = 'http://127.0.0.1:8137/mycelial/index.html';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
for (let i = 0; i < 80; i++) {
  try {
    const r = await fetch(base, { signal: AbortSignal.timeout(1500) });
    if (r.ok) break;
  } catch {}
  if (i === 79) throw new Error('Deck local server never became ready');
  await sleep(250);
}

let browser;
const errors = [], observations = [];
const record = (page, tag) => {
  page.on('pageerror', (e) => errors.push(tag + ': ' + e.message));
};
const snapshot = async (page, name) => {
  await page.screenshot({ path: join(output, name + '.png'), animations: 'disabled' });
  observations.push(await page.evaluate((shot) => {
    const scopeLabels = [...document.querySelectorAll('.fw-scope')];
    const a = scopeLabels[1]; // Open-source ecosystem
    const b = scopeLabels[2]; // Wider creative world
    const host = document.querySelector('.slide.on');
    const main = host?.querySelector('h1')?.getBoundingClientRect();
    const visible = [...document.querySelectorAll('.fw-scope')].filter((el) => Number(el.style.opacity) > 0.4);
    const roles = [...document.querySelectorAll('.fw-role')].filter((el) => Number(el.style.opacity) > 0.4);
    const roleRects = roles.map(el => ({ label: el.textContent, r: el.getBoundingClientRect() }));
    const roleOverlaps = roleRects.flatMap((a, i) =>
      roleRects.slice(i + 1).filter(b =>
        a.r.left < b.r.right - 1 && a.r.right > b.r.left + 1 &&
        a.r.top < b.r.bottom - 1 && a.r.bottom > b.r.top + 1
      ).map(b => a.label + ' / ' + b.label));
    const clippedRoles = roleRects.filter(({r}) => r.left < 1 || r.right > innerWidth-1 ||
      r.top < 1 || r.bottom > innerHeight-48).map(x => x.label);
    const clippedLabels = visible.filter((el) => {
      const r = el.getBoundingClientRect();
      return r.left < 2 || r.right > innerWidth - 2;
    }).map((el) => el.textContent);
    const overlaps = visible.filter((el) => {
      if (!main) return false;
      const r = el.getBoundingClientRect();
      return r.right > main.left && r.left < main.right && r.bottom > main.top && r.top < main.bottom;
    }).map((el) => el.textContent);
    return {
      shot, currentSlide: window.deckNav?.to + 1,
      settled: host?.hasAttribute('data-settled'),
      hasScope: Boolean(window.MycelialCommunityExpansion),
      outerOpacity: Number(a?.style.opacity || 0),
      worldOpacity: Number(b?.style.opacity || 0),
      visibleScopeLabels: scopeLabels.filter(el => Number(el.style.opacity) > .85).map(el => el.textContent),
      overlappingText: overlaps,
      clippedLabels,
      roleCount: roles.length,
      roleOverlaps,
      clippedRoles,
    };
  }, name));
};
try {
  browser = await chromium.launch({
    headless: true, executablePath, args: [
      '--no-sandbox', '--disable-dev-shm-usage', '--enable-webgl',
      '--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist',
    ],
  });

  const desktopContext = await browser.newContext({
    // Smaller browser render reduces frame drops under software WebGL on CI.
    viewport: { width: 1120, height: 700 }, deviceScaleFactor: 1,
    recordVideo: { dir: output, size: { width: 1120, height: 700 } },
  });
  const desktop = await desktopContext.newPage();
  record(desktop, 'desktop');
  await desktop.goto(base + '#8', { waitUntil: 'domcontentloaded' });
  await desktop.waitForFunction(() => window.deckNav?.to === 7);
  await sleep(4500);
  await desktop.keyboard.press('ArrowRight'); // 8 -> 9, actual Flowers handoff
  await desktop.waitForFunction(() => window.deckNav?.to === 8);
  await sleep(4700);
  await snapshot(desktop, 'desktop-8-to-9');
  await desktop.keyboard.press('ArrowRight'); // 9 -> 10
  await desktop.waitForFunction(() => window.deckNav?.to === 9);
  await sleep(3000);
  await snapshot(desktop, 'desktop-9-to-10');
  await desktop.keyboard.press('ArrowLeft'); // 10 -> 9
  await desktop.waitForFunction(() => window.deckNav?.to === 8);
  await sleep(3000);
  await snapshot(desktop, 'desktop-10-to-9');
  await desktop.keyboard.press('ArrowLeft'); // 9 -> 8
  await desktop.waitForFunction(() => window.deckNav?.to === 7);
  await sleep(3600);
  await snapshot(desktop, 'desktop-9-to-8');

  // Close the page and its context to flush the recorded real transitions.
  const desktopVideo = desktop.video();
  await desktop.close();
  await desktopContext.close();
  if (desktopVideo) {
    const raw = join(output, 'community-8-9-10-9-8.webm');
    await desktopVideo.saveAs(raw);
    // Actual navigation capture at 25 fps, re-timed using motion estimation
    // to 50 fps for a much smoother preview. No slide content is synthesized:
    // optical flow fills intermediate motion from the recorded browser frames.
    if (process.env.DECK_SMOOTH === '1') execFileSync('ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-y', '-ss', '3.1', '-i', raw,
      '-vf', 'scale=800:500:flags=lanczos,minterpolate=fps=50:mi_mode=mci:mc_mode=obmc:me_mode=bidir,scale=1120:700:flags=lanczos,format=yuv420p',
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '19',
      '-movflags', '+faststart', join(output, 'community-8-9-10-9-8-smooth.mp4')
    ], { timeout: 210000 });
  }

  // Separate high-resolution genuine slide still, independent of the video.
  const hero = await browser.newPage({
    viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1,
    reducedMotion: 'reduce'
  });
  record(hero, 'hero');
  await hero.goto(base + '#9', { waitUntil: 'domcontentloaded' });
  await hero.waitForFunction(() => window.deckNav?.to === 8);
  await sleep(1200);
  await snapshot(hero, 'desktop-main-slide9');
  await hero.close();

  const mobile = await browser.newPage({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 1,
    isMobile: true, hasTouch: true, reducedMotion: 'reduce',
  });
  record(mobile, 'mobile');
  await mobile.goto(base + '#9', { waitUntil: 'domcontentloaded' });
  await mobile.waitForFunction(() => window.deckNav?.to === 8);
  await sleep(2000);
  await snapshot(mobile, 'phone-slide9-reduced-motion');

  const short = await browser.newPage({
    viewport: { width: 844, height: 390 }, deviceScaleFactor: 1,
    isMobile: true, hasTouch: true, reducedMotion: 'reduce',
  });
  record(short, 'short-landscape');
  await short.goto(base + '#9', { waitUntil: 'domcontentloaded' });
  await short.waitForFunction(() => window.deckNav?.to === 8);
  await sleep(2000);
  await snapshot(short, 'short-landscape-slide9');

  writeFileSync(join(output, 'observations.json'), JSON.stringify({ errors, observations }, null, 2));
  for (const o of observations) {
    if (!o.hasScope) throw new Error('Missing community expansion on ' + o.shot);
    if (o.overlappingText.length) throw new Error('Label overlaps headline on ' + o.shot + ': ' + o.overlappingText.join(', '));
    if (o.clippedLabels.length) throw new Error('Clipped ecosystem labels on ' + o.shot + ': ' + o.clippedLabels.join(', '));
    if (o.currentSlide === 9 && o.roleCount !== 5) throw new Error('Missing community roles on ' + o.shot + ': ' + o.roleCount);
    if (o.currentSlide === 9 && o.visibleScopeLabels.length !== 3)
      throw new Error('Expected exactly three ecosystem labels on ' + o.shot + ': ' + o.visibleScopeLabels.join(' / '));
    if (o.currentSlide === 9 && o.roleOverlaps.length) throw new Error('Overlapping role labels on ' + o.shot + ': ' + o.roleOverlaps.join(', '));
    if (o.currentSlide === 9 && o.clippedRoles.length) throw new Error('Clipped role labels on ' + o.shot + ': ' + o.clippedRoles.join(', '));
  }
  const at9 = observations.filter((o) => o.currentSlide === 9);
  for (const o of at9) {
    if (o.outerOpacity < .9 || o.worldOpacity < .9)
      throw new Error('Three concentric scales must remain visible in ' + o.shot);
  }
  const at10 = observations.find((o) => o.shot === 'desktop-9-to-10');
  if (!at10 || at10.outerOpacity > 0.08) throw new Error('Outer circle did not fold before slide 10');
  if (errors.length) throw new Error('Page errors: ' + errors.join('; '));
  process.stdout.write(JSON.stringify({ passed: true, observations }, null, 2) + '\n');
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
