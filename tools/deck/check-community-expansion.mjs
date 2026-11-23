// Browser and screenshot QA for the integrated community expansion.
// Runs against a local copy of the deck, not a mockup.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
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
    const a = document.querySelector('.fw-scope-open');
    const b = document.querySelector('.fw-scope-world');
    const host = document.querySelector('.slide.on');
    const main = host?.querySelector('h1')?.getBoundingClientRect();
    const visible = [...document.querySelectorAll('.fw-scope')].filter((el) => Number(el.style.opacity) > 0.4);
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
      overlappingText: overlaps,
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

  const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
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
  }
  const at9 = observations.filter((o) => o.currentSlide === 9);
  for (const o of at9) if (o.outerOpacity < 0.9) throw new Error('Outer circle invisible in ' + o.shot);
  const at10 = observations.find((o) => o.shot === 'desktop-9-to-10');
  if (!at10 || at10.outerOpacity > 0.08) throw new Error('Outer circle did not fold before slide 10');
  if (errors.length) throw new Error('Page errors: ' + errors.join('; '));
  process.stdout.write(JSON.stringify({ passed: true, observations }, null, 2) + '\n');
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
