import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
const base = process.argv[2] || 'http://127.0.0.1:8240/mycelial/index.html';
const browser = await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const page = await browser.newPage({viewport:{width:1280,height:800}});
const errors=[]; page.on('pageerror',e=>errors.push(e.message));
const wait=ms=>page.waitForTimeout(ms);
async function settled(n) {
  await page.waitForFunction(n=>{const s=document.querySelectorAll('.slide')[n-1];return s.classList.contains('on')&&s.hasAttribute('data-settled');},n,{timeout:30000});
  const state=await page.evaluate(n=>{const s=document.querySelectorAll('.slide')[n-1],h=s.querySelector('h1,h2'),r=h?.getBoundingClientRect(), st=h&&getComputedStyle(h), art=s.querySelector('canvas,.st-world'); return {heading:h?.textContent.trim(),visible:!!r?.width&&!!r?.height&&st.visibility==='visible'&&+st.opacity>0,hidden:!!s.querySelector('.dt-copy-hidden'),art:!!art&&!!art.getBoundingClientRect().width,failed:s.dataset.deckFailed,ghosts:document.querySelectorAll('.st-ghost').length};},n);
  assert(state.heading&&state.visible&&(n===3||state.art)&&!state.hidden&&!state.failed,JSON.stringify(state)); return state;
}
async function go(n){await page.evaluate(n=>{location.hash=`#${n}`;},n);}
try {
  const results=[];
  for(const n of [4,5,6,7]){await page.goto(`${base}#${n}`);results.push(['direct',n,await settled(n)]);}
  await page.goto(`${base}#3`); await settled(3);
  for(const n of [4,5,6,7,6,5,4,3]) {await go(n); results.push(['boundary',n,await settled(n)]);}
  await go(4); await wait(250); await page.setViewportSize({width:1100,height:720}); results.push(['arrival resize',4,await settled(4)]);
  await go(5); await wait(300); await page.setViewportSize({width:1060,height:700}); results.push(['morph resize',5,await settled(5)]);
  await go(6); await wait(300); await page.setViewportSize({width:1030,height:680}); results.push(['stack resize',6,await settled(6)]);
  await page.locator('.slide.on .st-flag').nth(2).evaluate(el=>el.click());
  await wait(250);
  const before=await page.locator('.slide.on .st-card.is-open').count();
  assert.equal(before,1,'a stack card must be open before resize');
  await page.setViewportSize({width:1000,height:660}); await wait(600);
  assert.equal(await page.locator('.slide.on .st-card.is-open').count(),before);
  await go(7); await wait(200); await page.setViewportSize({width:980,height:640}); await go(6); results.push(['race',6,await settled(6)]); await wait(1600); results.push(['stable',6,await settled(6)]);
  await page.screenshot({path:'/Users/peteromalley/Documents/Codex/2026-11-03/new-chat/outputs/mycelial-p3-stack.png'});
  await page.goto(`${base}#4`); await settled(4);
  // Interrupt the decorative Core handoff: the live canvas and editor retain
  // ownership, and no old overlay may survive into the restored Core slide.
  await page.keyboard.press('ArrowRight'); await wait(400);
  const handoff=await page.evaluate(()=>{const c=document.querySelector('.as-core-flight'), r=document.querySelector('[data-astrid-demo]');
    const data=c?.getContext('2d').getImageData(0,0,c.width,c.height).data; let pixels=0;
    if(data) for(let i=3;i<data.length;i+=4) if(data[i]) pixels++;
    return {pixels,pointer:c&&getComputedStyle(c).pointerEvents,panels:[...r.querySelectorAll('.as-panel')].map(el=>({opacity:getComputedStyle(el).opacity,visibility:getComputedStyle(el).visibility}))};});
  assert(handoff.pixels>0&&handoff.pointer==='none'&&handoff.panels.every(p=>p.opacity==='1'&&p.visibility==='visible'),JSON.stringify(handoff));
  await page.keyboard.press('ArrowLeft'); await settled(4); await wait(300);
  const claims=await page.evaluate(()=>({overlay:document.querySelectorAll('.as-core-flight').length,canvasOpacity:document.querySelector('[data-astrid-core] canvas').style.opacity,editorClasses:document.querySelector('[data-astrid-demo]').className}));
  assert.equal(claims.overlay,0); assert.equal(claims.canvasOpacity,''); assert(!/is-morphing|is-minkless/.test(claims.editorClasses));
  await go(5); await settled(5); await page.locator('.slide.on .as-chat').evaluate(el=>{const marker=document.createElement('span');marker.id='p3-chat-marker';marker.textContent='existing content';el.append(marker);});
  await page.setViewportSize({width:970,height:650}); await wait(600);
  assert.equal(await page.locator('.slide.on #p3-chat-marker').count(),1);
  await go(6); await wait(120); await go(5); await wait(120); await go(6); await settled(6); await wait(1200); await settled(6);
  await page.goto(`${base}#7`); await settled(7);
  await page.evaluate(()=>{const el=document.querySelector('.slide.on [data-astrid-pays]');const old=el.getBoundingClientRect.bind(el);el.getBoundingClientRect=()=>({...old(),width:0});});
  await page.setViewportSize({width:960,height:640}); await wait(700);
  assert.equal(await page.locator('.slide.on').getAttribute('data-deck-failed'),'resize');
  assert.equal(await page.locator('.slide.on').getAttribute('data-settled'),null);
  await page.evaluate(()=>{delete document.querySelector('.slide.on [data-astrid-pays]').getBoundingClientRect;dispatchEvent(new Event('resize'));}); await wait(700); await settled(7);
  assert.deepEqual(errors,[]); console.log(JSON.stringify({results,cardCount:before,handoff,claims,chatPreserved:true,failureRetried:true,errors},null,2));
} finally {await browser.close();}
