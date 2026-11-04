import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
const base = process.argv[2] || 'http://127.0.0.1:8271/mycelial/index.html';
const browser = await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
let page = await browser.newPage({viewport:{width:1280,height:800}});
const errors=[]; page.on('pageerror', e=>errors.push(e.message));
const settled=async n=>page.waitForFunction(n=>{const s=document.querySelectorAll('.slide')[n-1];return s.classList.contains('on')&&s.hasAttribute('data-settled');},n,{timeout:30000});
const mask=()=>page.evaluate(()=>document.querySelector('.dt-net').style.maskImage);
const geometry=async n=>{const v=await page.evaluate(n=>{const b=document.querySelectorAll('.slide')[n-1].querySelector(n===5?'.split':'.split > :first-child').getBoundingClientRect();const m=document.querySelector('.dt-net').style.maskImage.match(/(?:<|%3C)rect x='(-?\d+)' y='(-?\d+)' width='(\d+)' height='(\d+)'/);return {expected:[b.left-14,b.top-14,b.width+28,b.height+28].map(Math.round),actual:m?.slice(1).map(Number)};},n);assert(v.actual,JSON.stringify(v));v.expected.forEach((x,i)=>assert(Math.abs(x-v.actual[i])<=2,JSON.stringify(v)));};
const go=async n=>{await page.evaluate(n=>location.hash=`#${n}`,n);await settled(n);};
try {
  const baseline=[];
  await page.route('**/mycelial/*',async route=>{
    const file=new URL(route.request().url()).pathname.slice(1);
    if(!/\.(html|js)$/.test(file)) return route.continue();
    try {const body=execFileSync('git',['show',`d501023ae134afa247d4b7ac5b4bed4598680271:${file}`],{encoding:'utf8'});await route.fulfill({contentType:file.endsWith('.js')?'application/javascript':'text/html',body});} catch {await route.continue();}
  });
  for(const n of [5,6]) {await page.goto(`${base}#${n}`);await settled(n);baseline.push(await mask());assert(baseline.at(-1));}
  await page.close();
  page = await browser.newPage({viewport:{width:1280,height:800}});
  page.on('pageerror', e=>errors.push(e.message));
  for(const [i,n] of [5,6].entries()) {await page.goto(`${base}#${n}`);await settled(n);const current=await mask(); for(const feature of ["feGaussianBlur stdDeviation='12'","fill-opacity='.75'","rx='18'"]) {assert(baseline[i].includes(feature));assert(current.includes(feature));} await geometry(n);}
  await page.goto(`${base}#5`);await settled(5);
  await page.evaluate(()=>{window.oldMaskContext=window.deckNav;});
  const initial=await mask();
  await page.setViewportSize({width:1100,height:720});await page.waitForFunction(()=>document.querySelector('.dt-net').style.maskImage.includes("width='1100'"),null,{timeout:15000});await settled(5);
  const resized=await mask();assert.notEqual(resized,initial);assert(resized.includes("width='1100'"));await geometry(5);
  await go(6);const stack=await mask();assert(stack && stack!==resized);
  await page.evaluate(()=>{window.deckClearNetMask(window.oldMaskContext,'demo');window.deckSetNetMask(window.oldMaskContext,'demo','stale');window.deckSetNetMask(window.deckNav,'demo','wrong-owner');});
  assert.equal(await mask(),stack,'stale visit and source owner must not change target');
  await page.evaluate(()=>{window.stackMaskContext=window.deckNav;});
  await page.setViewportSize({width:1000,height:650});await page.waitForFunction(()=>document.querySelector('.dt-net').style.maskImage.includes("width='1000'"),null,{timeout:15000});await settled(6);
  const stackResized=await mask();assert.notEqual(stackResized,stack);assert(stackResized.includes("width='1000'"));await geometry(6);
  await page.screenshot({path:'/Users/peteromalley/Documents/Codex/2026-11-03/new-chat/outputs/mycelial-r1-stack.png'});
  await go(5);const demo=await mask();assert(demo && demo!==stackResized);
  await page.evaluate(()=>{window.deckClearNetMask(window.stackMaskContext,'stack');window.deckSetNetMask(window.stackMaskContext,'stack','stale');});assert.equal(await mask(),demo);
  await go(4);assert.equal(await mask(),'','mask retired on exit');
  await page.evaluate(()=>location.hash='#6');await page.waitForTimeout(100);
  await page.setViewportSize({width:970,height:630});
  await page.waitForFunction(()=>document.querySelector('.dt-net').style.maskImage.includes("width='970'"),null,{timeout:15000});
  await settled(6);await geometry(6);
  await go(4);assert.equal(await mask(),'','interrupted visit retired on exit');
  await page.evaluate(()=>window.deckSetNetMask(window.oldMaskContext,'demo','stale'));assert.equal(await mask(),'');
  assert.deepEqual(errors,[]);console.log(JSON.stringify({baselineMaskFeatures:[5,6],resize:[5,6,'interrupted 6'],navigation:'5→6→5→4',staleWrites:'rejected',errors},null,2));
} finally {await browser.close();}
