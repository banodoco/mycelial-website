import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
const base=process.argv[2]||'http://127.0.0.1:8240/mycelial/index.html';
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const page=await browser.newPage({viewport:{width:1280,height:800}}), errors=[];
page.on('pageerror',e=>errors.push(e.message));
await page.route('**/flywheel.js',async route=>{const res=await route.fetch();let body=await res.text();body=body.replace('const resize = (ctx) => {','window.__p4wheel = () => ({m, activeStage});\n  const resize = (ctx) => {');await route.fulfill({response:res,body});});
await page.route('**/{flowers,pays}.js',async route=>{const res=await route.fetch();let body=await res.text();const flowers=route.request().url().includes('flowers.js');const marker=flowers?'window.deckRegisterScene([7]':'window.deckRegisterScene?.([6]';body=body.replace(marker,`window.${flowers?'__p4flowers':'__p4pays'} = () => ({coreHeld, coreOwner});\n  ${marker}`);await route.fulfill({response:res,body});});
const wait=ms=>page.waitForTimeout(ms);
const go=async n=>{const current=await page.evaluate(()=>window.deckNav.to+1); if(Math.abs(current-n)===1) await page.keyboard.press(n>current?'ArrowRight':'ArrowLeft'); else await page.evaluate(n=>{location.hash=`#${n}`;},n);};
async function settled(n){await page.waitForFunction(n=>{const s=document.querySelectorAll('.slide')[n-1];return s.classList.contains('on')&&s.hasAttribute('data-settled');},n,{timeout:30000});const result=await page.evaluate(n=>{const s=document.querySelectorAll('.slide')[n-1],h=s.querySelector('h1,h2'),r=h?.getBoundingClientRect();return {heading:h?.textContent.trim(),visible:!!r?.width&&!!r?.height&&+getComputedStyle(h).opacity>0,hidden:!!s.querySelector('.dt-copy-hidden'),failed:s.dataset.deckFailed};},n);assert(result.heading&&result.visible&&!result.hidden&&!result.failed,JSON.stringify(result));return result;}
try {
 const results=[];
 for(const n of [7,8,9,10,11]){await page.goto(`${base}#${n}`);results.push(['direct',n,await settled(n)]);}
 await page.goto(`${base}#7`);await settled(7);
 for(const n of [8,9,10,11,10,9,8,7]){await go(n);results.push(['boundary',n,await settled(n)]);}
 await go(8);await wait(300);await page.setViewportSize({width:1100,height:720});results.push(['flowers resize',await settled(8)]);
 await go(9);await wait(300);await page.setViewportSize({width:1050,height:700});results.push(['wheel resize',await settled(9)]);
 await go(10);await wait(400);const {before,after,superseded}=await page.evaluate(()=>{const before=window.__p4wheel().m;dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true,cancelable:true}));return {before,after:window.__p4wheel().m,superseded:window.deckNav.superseded};});assert.equal(before,after);assert.equal(superseded,true);await settled(9);
 await go(10);await wait(180);await go(11);await wait(180);await go(10);await settled(10);await wait(1000);await settled(10);
 await go(11);await settled(11);const q=page.locator('.slide.on .fw-ask-q').first();
 const questionCount=await q.count(); assert(questionCount);await q.click();assert.equal(await q.getAttribute('aria-expanded'),'true'); await page.setViewportSize({width:1000,height:660});await wait(700);await settled(11);assert.equal(await q.getAttribute('aria-expanded'),'true');
 await page.screenshot({path:'/Users/peteromalley/Documents/Codex/2026-11-03/new-chat/outputs/mycelial-p4-wheel.png'});
 await page.goto(`${base}#8`);await settled(8);
 const claims=await page.evaluate(()=>{let valid=true;const a={isTransitionCurrent:()=>valid,isCurrent:()=>valid},b={isTransitionCurrent:()=>true,isCurrent:()=>true},f=window.AstridFlowers,p=window.AstridPays,canvas=document.querySelector('[data-astrid-flowers] canvas');f.holdCore(true,a);f.holdCore(true,b);f.holdCore(false,a);const flowerHeld=window.__p4flowers().coreHeld;p.holdCore(true,a);p.holdCore(true,b);p.holdCore(false,a);const paysHeld=window.__p4pays().coreHeld;valid=false;f.hide(a);const staleHide=canvas.style.opacity;return {flowerHeld,paysHeld,staleHide};});assert(claims.flowerHeld&&claims.paysHeld);assert.notEqual(claims.staleHide,'0');
 // Restore the target after the deliberate artificial overlapping claims.
 await page.setViewportSize({width:990,height:650});await wait(700);await settled(8);
 await page.evaluate(()=>{const el=document.querySelector('.slide.on [data-astrid-flowers]');const old=el.getBoundingClientRect.bind(el);el.getBoundingClientRect=()=>({...old(),width:0});});
 await page.setViewportSize({width:980,height:640});await wait(700);assert.equal(await page.locator('.slide.on').getAttribute('data-deck-failed'),'resize');assert.equal(await page.locator('.slide.on').getAttribute('data-settled'),null);
 await page.evaluate(()=>{delete document.querySelector('.slide.on [data-astrid-flowers]').getBoundingClientRect;dispatchEvent(new Event('resize'));});await wait(700);await settled(8);
 await page.evaluate(()=>dispatchEvent(new Event('pageshow')));await go(9);await settled(9);await wait(1000);await settled(9);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({results,continuity:{before,after},questionCount,claims,failureRetried:true,simulatedReturn:true,errors},null,2));
}finally{await browser.close();}
