// H3 U2: manifesto kinship phrase ("open models and open tools") at rest vs hover; computed styles; nearby link hover for comparison.
const { chromium } = require('playwright');
const fs = require('fs');
const S = '/tmp/claude-0/-home-user/62a00d20-ec8d-551d-aa8b-33233b07a42e/scratchpad';
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const out = {};
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage(); page.setDefaultTimeout(120000);
    await page.goto('http://localhost:8137/?nointro=1', { waitUntil: 'load' });
    await page.waitForTimeout(9000);
    // open the menu, then the Manifesto row
    await page.locator('.j-rail-menu').first().evaluate(el => el.click());
    await page.waitForTimeout(1200);
    await page.locator('.j-menu a[href="#/manifesto"]').first().evaluate(el => el.click()).catch(e => { out.menuClickErr = String(e).slice(0, 200); });
    await page.waitForTimeout(12000);
    out.manifestoOpen = await page.evaluate(() => document.body.className);
    const info = await page.evaluate(() => {
      const el = document.querySelector('.manifesto-concept.concept-kinship');
      if (!el) return { found: false, count: document.querySelectorAll('.manifesto-concept').length };
      const cs = getComputedStyle(el), par = el.parentElement, th = par && getComputedStyle(par);
      const thread = el.parentElement && el.parentElement.querySelector('.manifesto-phrase-thread');
      return {
        found: true, text: el.textContent, tag: el.tagName, cursor: cs.cursor, color: cs.color, textDecoration: cs.textDecorationLine,
        pointerEvents: cs.pointerEvents, display: cs.display, hoverRules: 'see CSS',
        rect: (() => { const b = el.getBoundingClientRect(); return [b.left, b.top, b.width, b.height].map(Math.round); })(),
        parentTag: par && par.tagName, parentClass: par && par.className,
        threadPresent: !!thread, threadBg: thread ? getComputedStyle(thread).backgroundImage.slice(0, 160) : null,
        threadSize: thread ? getComputedStyle(thread).backgroundSize : null,
        threadStrength: thread ? getComputedStyle(thread).getPropertyValue('--thread-strength') : null,
        lineClass: el.closest('.j-manifesto-line') ? el.closest('.j-manifesto-line').className : null,
        animation: cs.animationName,
      };
    });
    out.kinship = info;
    // link comparison: a real manifesto chapter link (seeding/nourishing/connecting)
    out.chapterLink = await page.evaluate(() => {
      const a = document.querySelector('.manifesto-chapter-link'); if (!a) return null;
      const cs = getComputedStyle(a); return { text: a.textContent, cursor: cs.cursor, deco: cs.textDecorationLine, style: cs.textDecorationStyle, color: cs.color, decoColor: cs.textDecorationColor, rect: (() => { const b = a.getBoundingClientRect(); return [b.left, b.top, b.width, b.height].map(Math.round); })() };
    });
    if (info.found) {
      await page.evaluate(() => document.querySelector('.manifesto-concept.concept-kinship').scrollIntoView({ block: 'center' }));
      await page.waitForTimeout(1500);
      const b = await page.evaluate(() => { const r = document.querySelector('.manifesto-concept.concept-kinship').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }); out.kinshipAfterScroll = b;
      fs.writeFileSync(`${S}/findings/H3-U2-measure.json`, JSON.stringify(out, null, 2));
      await page.screenshot({ path: `${S}/captures/H3-ui/U2-kinship-rest.png`, timeout: 170000 }).catch(e=>out.shotErr1=String(e).slice(0,120));
      await page.mouse.move(b.x, b.y);
      await page.waitForTimeout(1500);
      out.hoverState = await page.evaluate(() => { const el = document.querySelector('.manifesto-concept.concept-kinship'); const cs = getComputedStyle(el); const t = el.parentElement.querySelector('.manifesto-phrase-thread'); return { color: cs.color, cursor: cs.cursor, threadStrength: t ? getComputedStyle(t).getPropertyValue('--thread-strength') : null }; });
      await page.screenshot({ path: `${S}/captures/H3-ui/U2-kinship-hover.png`, timeout: 170000 }).catch(e=>out.shotErr2=String(e).slice(0,120));
    }
    await ctx.close();
  } finally { await browser.close(); }
  fs.writeFileSync(`${S}/findings/H3-U2-measure.json`, JSON.stringify(out, null, 2));
  console.log('DONE');
})().catch(e => { console.error('ERR', e); process.exit(1); });
