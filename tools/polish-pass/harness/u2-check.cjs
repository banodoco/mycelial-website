// mperf U2: rest vs hover of the "open models and open tools" thread.
// node mperf-u2.cjs <port> <tag>
const { chromium } = require('playwright');
const port = process.argv[2] || '8145', tag = process.argv[3] || 'after';
const OUT = '/tmp/claude-0/-home-user/62a00d20-ec8d-551d-aa8b-33233b07a42e/scratchpad/captures/VERIFY-perf';
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1024, height: 640 }, reducedMotion: 'reduce' });
  page.on('pageerror', e => console.log('[pageerror]', e.message));
  await page.goto(`http://localhost:${port}/?nointro=1`);
  await page.waitForFunction(() => window.journey, null, { timeout: 600000 });
  await page.evaluate(() => window.journey.flyTo('manifesto'));
  await page.waitForSelector('.j-manifesto.is-open', { timeout: 600000 });
  await page.waitForFunction(() => document.querySelectorAll('.j-manifesto-line.shown').length === 5, null, { timeout: 600000 });
  await page.waitForTimeout(3000);
  const thread = page.locator('.manifesto-phrase-thread');
  const box = await thread.boundingBox();
  const clip = { x: Math.max(0, box.x - 40), y: Math.max(0, box.y - 30), width: Math.min(600, 1024 - box.x + 40), height: box.height + 60 };
  const read = () => page.evaluate(() => {
    const t = document.querySelector('.manifesto-phrase-thread'), s = getComputedStyle(t);
    return { pe: s.pointerEvents, hover: s.getPropertyValue('--thread-hover'), strength: s.getPropertyValue('--thread-strength'), matches: t.matches(':hover') };
  });
  await page.mouse.move(5, 5);
  console.log('rest', JSON.stringify(await read()));
  await page.screenshot({ path: `${OUT}/u2-rest-${tag}.png`, clip, timeout: 420000 });
  const words = await thread.locator('.j-manifesto-word').all();
  const samples = [];
  for (const w of words) {
    const b = await w.boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 4 });
    samples.push((await read()).matches);
  }
  // the gap between two words / wrapped lines
  const last = await words.at(-1).boundingBox();
  await page.mouse.move(last.x + last.width + 1, last.y + last.height / 2);
  samples.push((await read()).matches);
  console.log('hover across words', JSON.stringify(samples));
  await page.mouse.move(box.x + 30, box.y + box.height / 2);
  await page.waitForTimeout(600);
  console.log('hover', JSON.stringify(await read()));
  await page.screenshot({ path: `${OUT}/u2-hover-${tag}.png`, clip, timeout: 420000 });
  await browser.close();
})();
