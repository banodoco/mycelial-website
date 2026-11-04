// Runs the actual inline controller with small deterministic scene participants.
// No production debug/mutation API is added for failure injection.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright-core';
const base = process.argv[2] || 'http://127.0.0.1:8240/mycelial/index.html';
const html = readFileSync(new URL('../../mycelial/index.html', import.meta.url), 'utf8');
const controller = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m => m[1]).find(s => s.includes('const all = [...document.querySelectorAll'));
assert.ok(controller, 'actual deck controller found');
const fixture = `
window.installDeckProgress = () => ({update(){}});
window.__deckDebug = {};
${controller}
window.fixture = {events:[], claims:[], layoutWrites:[], handles:[], late:[], visits:0, exits:0, drains:0, pending:false, failRestore:false, failLayout:false, throwCleanup:false};
const f = window.fixture;
const originalLater=window.deckLater;
window.deckLater=(fn,ms,ctx)=>{const handle=originalLater(fn,ms,ctx);if(ms===100000) f.handles.push(handle);return handle;};
addEventListener('deck-failure', e => f.events.push(['failure',e.detail]));
addEventListener('deck-transaction', e => f.events.push(['transaction',e.detail]));
const participant = () => ({
  enter(ctx) {
    f.context = ctx;
    ctx.transitionDefer(() => { f.drains++; if(f.throwCleanup) throw Error('fixture cleanup'); });
    ctx.transitionDefer(() => { f.events.push(['remaining cleanup',ctx.generation]); });
    ctx.defer(() => { f.exits++; });
    f.late.push(ctx.transitionGuard(() => { f.events.push(['obsolete write',ctx.generation]); }));
    ctx.transitionLater(() => { f.events.push(['obsolete timer',ctx.generation]); },100000);
    window.deckLater(() => { f.visits++; },30,ctx);
    if(f.pending) return new Promise(resolve => { f.complete = resolve; });
    return 'completed';
  },
  exit() { return 'completed'; },
  restore(ctx,claim) { f.events.push(['restore',ctx.to,claim.reason]); if(f.failRestore) throw Error('fixture picture'); return true; },
  resize(ctx,claim) {
    f.claims.push(claim);
    const width=innerWidth;
    f.layoutWrites.push(()=>{if(claim.isCurrent()) f.geometry=width;});
    f.events.push(['layout',ctx.to,innerWidth]);
    if(f.navigateDuringLayout) {
      const n=f.navigateDuringLayout; f.navigateDuringLayout=0;
      history.replaceState({deckSlide:n},'',location.pathname); dispatchEvent(new PopStateEvent('popstate'));
    }
    if(f.failLayout) return false;
    if(claim.isCurrent()) f.geometry=innerWidth;
    return true;
  }
});
for(let n=0;n<8;n++) window.deckRegisterScene([n],participant());
window.deckRegisterScene([8,9,10],{...participant(),supersede:true});
window.deckRegisterNetwork({
  enter: () => 'completed', geometry: () => null, copyRects:()=>[], resize:()=>true,
  finish(ctx) { f.events.push(['copy',ctx.to]); return true; }
});
window.deckBoot();`;
const browser = await chromium.launch({channel:'chrome',headless:true});
const page = await browser.newPage({viewport:{width:1200,height:800}});
const failures=[];
page.on('pageerror',error=>failures.push(error.message));
await page.route('**/mycelial/index.html*',route=>route.fulfill({contentType:'text/html',body:html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,'').replace('</body>',`<script>${fixture}</script></body>`)}));
const result = {cases:[], errors:failures};
const settled = () => page.waitForFunction(()=>document.querySelector('.slide.on')?.hasAttribute('data-settled'));
const nav = async n => { await page.evaluate(n=>{history.replaceState({deckSlide:n},'',location.pathname);dispatchEvent(new PopStateEvent('popstate'));},n); };
try {
  await page.goto(base+'#1'); await settled();
  await page.waitForFunction(()=>fixture.visits>0);
  assert.deepEqual(await page.evaluate(()=>({current:fixture.context.isCurrent(),transition:fixture.context.isTransitionCurrent(),exits:fixture.exits,drains:fixture.drains})),{current:true,transition:false,exits:0,drains:1});
  await page.evaluate(()=>{fixture.late.forEach(fn=>fn()); window.deckTransaction('finish');});
  assert.equal(await page.evaluate(()=>fixture.events.filter(e=>e[0]==='obsolete write').length),0);
  assert.equal(await page.evaluate(()=>fixture.drains),1);
  assert.equal(await page.evaluate(()=>fixture.handles.every(handle=>handle.cancelled)),true);
  assert.equal(await page.evaluate(()=>fixture.events.filter(e=>e[0]==='restore').length),0,
    'ordinary finish must preserve visit-owned animation tails');
  result.cases.push('normal finish drains once; late write blocked; visit timer continues');

  await page.evaluate(()=>{fixture.pending=true;});
  await nav(2);
  const beforeFonts=await page.evaluate(()=>({drains:fixture.drains,copies:fixture.events.filter(e=>e[0]==='copy').length}));
  assert.equal(await page.evaluate(()=>window.deckTransaction('fonts')),true);
  assert.deepEqual(await page.evaluate(()=>({drains:fixture.drains,copies:fixture.events.filter(e=>e[0]==='copy').length})),beforeFonts);
  assert.equal(await page.evaluate(()=>fixture.context.isTransitionCurrent()),true);
  assert.equal(await page.evaluate(()=>document.querySelector('.slide.on').hasAttribute('data-settled')),false);
  assert.equal(await page.evaluate(()=>fixture.events.filter(e=>e[0]==='restore').length),0);
  await page.evaluate(()=>{fixture.pending=false;fixture.complete('completed');});await settled();
  result.cases.push('fonts refresh updates geometry without closing entry, restoring picture, or publishing settlement');

  await page.evaluate(()=>{fixture.pending=true;fixture.failLayout=true;});await nav(3);
  assert.equal(await page.evaluate(()=>window.deckTransaction('fonts')),false);
  assert.equal(await page.evaluate(()=>fixture.context.terminal),true);
  assert.equal(await page.evaluate(()=>document.querySelector('.slide.on').getAttribute('data-deck-failed')),'fonts');
  await page.evaluate(()=>{fixture.pending=false;fixture.failLayout=false;});await nav(2);await settled();
  result.cases.push('failed fonts geometry stays failed, retires entry, and permits later navigation');

  await page.evaluate(()=>{fixture.pending=true;fixture.throwCleanup=true;fixture.failRestore=true;});
  await nav(3);
  await page.evaluate(()=>{window.fixtureStaleComplete=fixture.complete;});
  assert.equal(await page.evaluate(()=>window.deckTransaction('recover')),false);
  const failed = await page.evaluate(()=>({settled:document.querySelector('.slide.on').hasAttribute('data-settled'),failed:document.querySelector('.slide.on').getAttribute('data-deck-failed'),generation:fixture.context.generation,events:fixture.events,failure:window.__deckDebug.controller.failure}));
  assert.equal(failed.settled,false);assert.equal(failed.failed,'recover');
  assert.ok(failed.events.some(e=>e[0]==='remaining cleanup' && e[1]===failed.generation));
  assert.ok(failed.events.some(e=>e[0]==='copy' && e[1]===2));
  assert.ok(failed.failure.errors.some(e=>e.includes('fixture picture')));
  await page.evaluate(()=>Object.assign(fixture,{pending:false,throwCleanup:false,failRestore:false}));
  await nav(4);await settled();
  await page.evaluate(()=>{window.fixtureStaleComplete('completed');});
  assert.equal(await page.evaluate(()=>window.__deckDebug.controller.index),3);
  await nav(3);await settled();
  result.cases.push('cleanup and picture failure: remaining cleanup/copy attempted, failure exposed, later navigation succeeds');

  await page.evaluate(()=>{fixture.failLayout=true;fixture.semantic={open:true,media:17,tour:4};});
  const previous=await page.evaluate(()=>window.__deckDebug.controller.laidOut);
  await page.setViewportSize({width:1100,height:750});
  await page.waitForFunction(()=>document.querySelector('.slide.on').hasAttribute('data-deck-failed'));
  assert.equal(await page.evaluate(()=>window.__deckDebug.controller.laidOut),previous);
  await page.evaluate(()=>{fixture.failLayout=false;window.deckTransaction('fonts');});
  assert.equal(await page.evaluate(()=>document.querySelector('.slide.on').getAttribute('data-deck-failed')),'resize');
  assert.equal(await page.evaluate(()=>window.__deckDebug.controller.failure.reason),'resize');
  await page.evaluate(()=>{fixture.failLayout=false;dispatchEvent(new Event('resize'));});await settled();
  assert.match(await page.evaluate(()=>window.__deckDebug.controller.laidOut),/^1100x750/);
  const oldClaimIndex=await page.evaluate(()=>fixture.claims.length-1);
  await page.setViewportSize({width:1000,height:700});await page.waitForFunction(()=>fixture.geometry===1000);
  assert.equal(await page.evaluate(index=>fixture.claims[index].isCurrent(),oldClaimIndex),false);
  await page.evaluate(()=>fixture.layoutWrites.forEach(fn=>fn()));
  assert.equal(await page.evaluate(()=>fixture.geometry),1000);
  assert.deepEqual(await page.evaluate(()=>fixture.semantic),{open:true,media:17,tour:4});
  result.cases.push('failed geometry not committed; same-size retry works; successive layout claim expires');

  for(const delay of [0,40,95]) {
    await page.evaluate(()=>{fixture.pending=true;});await nav(delay===40?5:4);
    await page.waitForTimeout(delay);
    await page.setViewportSize({width:1001+delay,height:701+delay});await settled();
    assert.equal(await page.evaluate(()=>fixture.context.terminal),true);
  }
  result.cases.push('real viewport resize finishes pending target at early/middle/late fixture handoff');
  await page.evaluate(()=>{fixture.pending=false;});
  await page.setViewportSize({width:1150,height:780});await nav(6);await settled();
  await page.waitForFunction(()=>fixture.geometry===1150);
  assert.equal(await page.evaluate(()=>window.__deckDebug.controller.index),5);
  await page.evaluate(()=>{fixture.navigateDuringLayout=7;});
  await page.setViewportSize({width:1140,height:770});
  await page.waitForFunction(()=>window.__deckDebug.controller.index===6 && document.querySelector('.slide.on').hasAttribute('data-settled'));
  await page.evaluate(()=>{fixture.late.forEach(fn=>fn());});
  assert.equal(await page.evaluate(()=>fixture.events.filter(e=>e[0]==='obsolete write').length),0);
  result.cases.push('navigation before debounce and reentrant navigation during layout win over old endpoint');

  await page.evaluate(()=>{fixture.pending=true;});await nav(8);
  await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowRight');
  assert.ok(await page.evaluate(()=>window.__deckDebug.controller.pending)>0);
  await page.evaluate(()=>{fixture.pending=false;window.deckTransaction('recover');});
  await page.waitForFunction(()=>window.__deckDebug.controller.pending===0 && document.querySelector('.slide.on').hasAttribute('data-settled'));
  result.cases.push('queued/hurried navigation released after endpoint');

  await page.evaluate(()=>{fixture.pending=true;});await nav(2);
  await page.evaluate(()=>{
    window.fixtureClock=Date.now;
    Date.now=()=>window.fixtureClock()+20000;
    Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});
    document.dispatchEvent(new Event('visibilitychange'));
    dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));
  });
  assert.equal(await page.evaluate(()=>fixture.context.terminal),false);
  await page.evaluate(()=>{
    Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});
    document.dispatchEvent(new Event('visibilitychange'));
    Date.now=window.fixtureClock;
    fixture.pending=false;
  });
  await settled();await nav(3);await settled();
  result.cases.push('simulated hidden watchdog waits, return recovers once, later navigation works');
  assert.deepEqual(failures,[]);
  console.log(JSON.stringify(result,null,2));
} finally {await browser.close();}
