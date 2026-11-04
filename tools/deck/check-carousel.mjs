// Exercise the real carousel/controller with hit-tested input. The route instrumentation
// observes the closure only: no production diagnostics or writable test API is shipped.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chromium} from 'playwright-core';
const base=process.argv[2] || 'http://127.0.0.1:8240/mycelial/index.html';
const source=readFileSync(process.env.CAROUSEL_SOURCE || new URL('../../mycelial/collage.js',import.meta.url),'utf8');
const instrumented=source.replace('  relayout();\n  syncMotion();', `
  window.__carousel = () => ({angle, turn:turn && {...turn}, timer, arrival:!!arrival, playing:tiles.indexOf(playing), held:held(), still,
    videos:tiles.map(t=>{const v=t.querySelector('video');return {time:v.currentTime,paused:v.paused,ended:v.ended,live:t.classList.contains('is-live'),loaded:!!v.firstElementChild};})});
  relayout();\n  syncMotion();`);
const browser=await chromium.launch({channel:'chrome',headless:true});
const cases=[], errors=[];
async function make({stall=false,reduced=false,mobile=false,touch=true}={}) {
  const page=await browser.newPage({viewport:mobile?{width:390,height:844}:{width:1280,height:800},hasTouch:touch,isMobile:mobile,reducedMotion:reduced?'reduce':'no-preference'});
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/collage.js*',r=>r.fulfill({contentType:'text/javascript',body:instrumented}));
  await page.route('https://customer-*/**',r=>r.abort());
  if(stall) await page.route('**/*-preview.mp4',r=>r.abort());
  await page.goto(base+'#1');
  await page.waitForFunction(()=>window.__carousel && document.querySelector('.slide.on')?.hasAttribute('data-settled') && !window.__carousel().arrival);
  return page;
}
const state=p=>p.evaluate(()=>window.__carousel());
async function point(p,i) {
  return p.evaluate(i=>{
    const root=document.querySelector('[data-collage]'),tile=root.querySelectorAll('.vc-tile')[i],face=root.faces().find(f=>f.tile===tile);
    for(const v of [.5,.8,.2,.95,.05]) for(const u of [.5,.8,.2,.95,.05]) {
      const [x,y]=face.at(u,v);
      if(x>0&&x<innerWidth&&y>0&&y<innerHeight&&document.elementFromPoint(x,y)?.closest('.vc-tile')===tile) return {x,y};
    }
    return null;
  },i);
}
async function tap(p,i) {const q=await point(p,i);assert(q,`card ${i} must expose an actual tap target`);await p.touchscreen.tap(q.x,q.y);}
async function release(p) {await p.evaluate(()=>document.activeElement?.blur());await p.mouse.move(2,2);}
async function landed(p,i) {await p.waitForFunction(i=>{const s=window.__carousel();return !s.turn && s.playing===i;},i);}
async function nav(p,n) {await p.evaluate(n=>{location.hash='#'+n;},n);await p.waitForFunction(n=>document.querySelectorAll('.slide')[n-1].hasAttribute('data-settled')&&document.querySelectorAll('.slide')[n-1].classList.contains('on'),n);}
try {
  // Actual wall time, not a mocked timer: select just before the old fallback expires.
  const p=await make({stall:true});
  const idle=await state(p),side=await point(p,3);
  await p.mouse.move(side.x,side.y);await p.waitForTimeout(600);
  const hovered=await state(p);
  assert.equal(hovered.angle,idle.angle,'side hover never selects a card');
  assert.equal(hovered.timer,idle.timer,'pointer entry does not pause or reschedule relay');
  cases.push({case:'side hover leaves selection and original relay deadline intact'});
  const mark=p.locator('.vc-fn button'),markBox=await mark.boundingBox();
  await p.mouse.move(markBox.x+markBox.width/2,markBox.y+markBox.height/2);await p.waitForTimeout(300);
  assert.equal(await p.locator('.vc-note.is-open').count(),1,'footnote still reveals its note on hover');
  assert.equal((await state(p)).timer,idle.timer,'footnote hover never pauses or reschedules relay');
  assert.equal((await state(p)).angle,idle.angle);
  await p.mouse.move(side.x,side.y);await p.waitForTimeout(300);
  cases.push({case:'footnote hover reveals note without changing carousel deadline or selection'});
  await p.waitForTimeout(4600);
  await tap(p,1);await landed(p,1);await release(p);
  const landedAt=Date.now();
  const selected=await point(p,1);await p.mouse.move(selected.x,selected.y);
  await p.waitForTimeout(6100);assert.equal((await state(p)).turn,null,'selected film keeps a complete 6.5s hold');
  await p.waitForFunction(()=>!!window.__carousel().turn);const elapsed=Date.now()-landedAt;
  assert(elapsed>=6400 && elapsed<14000,`fallback advances once after full hold: ${elapsed}`);
  await p.waitForFunction(()=>!window.__carousel().turn);assert.equal((await state(p)).playing,2);
  cases.push({case:'real tap near old fallback; full wall-clock hold; one automatic advance',elapsedMs:elapsed});
  await mark.click();assert.equal(await p.locator('.vc-note.is-open').count(),1);
  assert.equal((await state(p)).timer,0,'explicit pinned footnote can hold relay');
  await p.keyboard.press('Escape');assert.equal(await p.locator('.vc-note.is-open').count(),0);
  assert((await state(p)).timer>0,'closing explicit note resumes relay');
  cases.push({case:'explicit footnote click pins readable note and holds relay; Escape closes and resumes'});
  await p.close();

  // A real media preview and real rapid direction changes, using visible card hit targets.
  const m=await make();await m.waitForFunction(()=>window.__carousel().videos[0].time>.2);
  await tap(m,3);
  const activeTurn=(await state(m)).turn,across=await point(m,6);
  await m.mouse.move(across.x,across.y);await m.waitForTimeout(500);
  assert.equal((await state(m)).turn.to,activeTurn.to,'moving across cards cannot retarget an active turn');
  assert.equal((await state(m)).turn.t0,activeTurn.t0,'pointer movement cannot restart the turn');
  const before=await state(m);await tap(m,6);const reversed=await state(m);
  assert(Math.abs(reversed.turn.to-reversed.turn.from)<=Math.PI+.001,'reverse chooses shortest route from displayed angle');
  await tap(m,1);await landed(m,1);await release(m);
  await m.waitForTimeout(500);let s=await state(m);
  assert.equal(s.videos.filter(v=>!v.paused).length,1,'only current preview plays');
  assert.equal(s.videos[1].paused,false);
  await m.setViewportSize({width:1100,height:720});await m.waitForTimeout(400);
  assert.equal((await state(m)).playing,1,'resize preserves chosen film');
  await m.waitForTimeout(2500);s=await state(m);assert.equal(s.turn,null,'manual film remains after media handoff');
  cases.push({case:'rapid tap, opposite direction, preview ownership, resize',firstTarget:before.turn.to,reverseTarget:reversed.turn.to});

  // Controlled visibility API event. This checks app lifecycle, not OS timer throttling.
  await m.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
  s=await state(m);assert.equal(s.timer,0);assert(s.videos.every(v=>v.paused));
  const hiddenAngle=s.angle;await m.waitForTimeout(1000);assert.equal((await state(m)).angle,hiddenAngle);
  await m.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
  await m.waitForTimeout(350);assert.equal((await state(m)).videos[1].paused,false);
  cases.push({case:'controlled hidden/visible freezes media and clears relay; resumes current film'});

  // The front card opens a player; closing restores focus and the preview position.
  const frontPoint=await point(m,1);const previewTime=(await state(m)).videos[1].time;
  await m.mouse.click(frontPoint.x,frontPoint.y);
  await m.waitForFunction(()=>document.querySelector('.vc-box').classList.contains('is-on'));
  assert((await state(m)).videos.every(v=>v.paused));
  await m.keyboard.press('Escape');
  assert.equal(await m.locator('.vc-box.is-on').count(),0);
  assert.equal(await m.locator('.vc-tile').nth(1).evaluate(t=>t===document.activeElement),true);
  assert.equal((await state(m)).timer,0,'focused card holds relay without polling');
  await m.waitForTimeout(400);assert((await state(m)).videos[1].time>=previewTime,'closing player preserves preview position');
  await release(m);
  await m.keyboard.press('o');assert.equal(await m.locator('#overview.on').count(),1);
  assert.equal((await state(m)).timer,0);assert((await state(m)).videos.every(v=>v.paused));
  await m.keyboard.press('o');await m.waitForTimeout(200);
  assert.equal((await state(m)).playing,1);
  cases.push({case:'real front click/player Escape, restored focus hold, preserved preview, keyboard overview'});

  // Wheel has an actual 140ms delayed settle. Leave before it can fire, then return.
  const q=await point(m,1);await m.mouse.move(q.x,q.y);await m.mouse.wheel(80,0);await nav(m,4);
  await m.waitForTimeout(250);assert.equal((await state(m)).turn,null,'departed wheel completion is cancelled');
  await nav(m,1);await m.waitForTimeout(300);assert.equal((await state(m)).turn,null);
  cases.push({case:'wheel then navigation within debounce; direct revisit has no obsolete turn'});
  await m.close();

  const desktop=await make({touch:false,stall:true});
  await desktop.locator('#motion').click();assert.equal((await state(desktop)).still,true);assert.equal((await state(desktop)).timer,0);
  await desktop.locator('#motion').click();assert.equal((await state(desktop)).still,false);
  cases.push({case:'real desktop click toggles animation off/on and retires relay'});await desktop.close();

  const phone=await make({mobile:true,stall:true});await tap(phone,1);await landed(phone,1);
  assert.equal(await phone.locator('.slide.on').evaluate(s=>s===document.querySelector('.slide')),true);
  await release(phone);assert((await state(phone)).timer>0);
  await phone.waitForTimeout(400);assert.equal((await state(phone)).turn,null);
  cases.push({case:'390×844 touch emulation, motion on, side tap selects film and resets relay without navigating deck'});
  await phone.close();

  const r=await make({reduced:true,mobile:true});await tap(r,1);
  s=await state(r);assert.equal(s.playing,-1);assert.equal(s.timer,0);assert.equal(s.turn,null);assert(s.videos.every(v=>!v.loaded&&v.paused),'motion-off manual selection fetches no preview');
  await r.waitForTimeout(700);assert.equal((await state(r)).angle,s.angle);
  cases.push({case:'390×844 touch emulation, reduced motion, immediate manual selection with no previews or relay'});
  await r.close();
  assert.deepEqual(errors,[]);console.log(JSON.stringify({cases,errors},null,2));
} finally {await browser.close();}
