const { chromium } = require('playwright');
const port = process.argv[2] || '8155', tag = process.argv[3] || 'x', shots = process.argv[4] === 'shots';
const OUT = '/tmp/claude-0/-home-user/62a00d20-ec8d-551d-aa8b-33233b07a42e/scratchpad/captures/IMPL-hoverfix';
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1024, height: 640 }, deviceScaleFactor: shots ? 2 : 1, reducedMotion: process.env.RM || 'reduce' });
  page.on('pageerror', e => console.log('[pageerror]', e.message));
  await page.goto(`http://localhost:${port}/?nointro=1`);
  await page.waitForFunction(() => window.journey, null, { timeout: 600000 });
  await page.evaluate(() => window.journey.flyTo('manifesto'));
  await page.waitForSelector('.j-manifesto.is-open', { timeout: 600000 });
  await page.waitForFunction(() => document.querySelectorAll('.j-manifesto-line.shown').length === 5, null, { timeout: 600000 });
  await page.waitForTimeout(8000);
  const read = () => page.evaluate(() => {
    const t = document.querySelector('.manifesto-phrase-thread'), s = getComputedStyle(t);
    const a = (s.backgroundImage.match(/rgba?\([^)]*\)/g) || []).map(c => c.split(/[ ,\/]+/).pop().replace(')', ''));
    return { hover: s.getPropertyValue('--thread-hover'), str: s.getPropertyValue('--thread-strength'), matches: t.matches(':hover'), alphas: a, anim: s.animationName, pe: s.pointerEvents };
  });
  const info = await page.evaluate(() => { const t = document.querySelector('.manifesto-phrase-thread'); return t.outerHTML.slice(0, 900); });
  console.log(info);
  await page.mouse.move(2, 2);
  console.log('rest', JSON.stringify(await read()));
  const t = page.locator('.manifesto-phrase-thread');
  const box = await t.boundingBox();
  const clip = { x: Math.max(0, box.x - 20), y: Math.max(0, box.y - 20), width: Math.min(box.width + 40, 900 - box.x + 20), height: box.height + 40 };
  if (shots) await page.screenshot({ path: `${OUT}/rest-${tag}.png`, clip, timeout: 300000 });
  const w0=await t.locator('.j-manifesto-word').first().boundingBox();
  await page.mouse.move(w0.x+w0.width/2,w0.y+w0.height/2,{steps:3}); await page.waitForTimeout(700);
  console.log(JSON.stringify(await page.evaluate(()=>{
    const t=document.querySelector('.manifesto-phrase-thread');const s=getComputedStyle(t);
    const rules=[];for(const ss of document.styleSheets){let rs;try{rs=ss.cssRules}catch(e){continue}
      const walk=(rs)=>{for(const r of rs){if(r.cssRules&&!r.selectorText)walk(r.cssRules);else if(r.selectorText&&/phrase-thread/.test(r.selectorText)){rules.push([r.selectorText.slice(-60),r.cssText.includes('thread-hover'),t.matches(r.selectorText)])}}};walk(rs)}
    const before=s.getPropertyValue('--thread-hover');
    t.style.setProperty('--thread-hover','1');const inl=getComputedStyle(t).getPropertyValue('--thread-hover');t.style.removeProperty('--thread-hover');
    return {rules,before,inl,tr:s.transition,anims:t.getAnimations().map(a=>a.constructor.name+':'+(a.transitionProperty||a.animationName)),hov:t.matches(':hover'),hovers:[...document.querySelectorAll(':hover')].map(e=>e.className).slice(-4)}})));
  await browser.close();
})();
