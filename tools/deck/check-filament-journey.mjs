// Real-deck browser evidence for the existing slide 1 -> 2 -> 3 -> 2 -> 1 journey.
// No mock deck: serve.py loads the same mycelial/index.html and its actual assets.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const output=join(process.cwd(),'.artifacts','slide2-filaments');
mkdirSync(output,{recursive:true});
const executablePath=[
  process.env.CHROME_PATH,'/usr/bin/google-chrome','/usr/bin/google-chrome-stable',
  '/usr/bin/chromium','/opt/google/chrome/chrome'
].filter(Boolean).find(x=>existsSync(x));
if(!executablePath)throw Error('Chromium/Chrome missing for live deck QA');
const server=spawn('python3',['serve.py'],{cwd:process.cwd(),env:{...process.env,PORT:'8137'},stdio:'ignore'});
const base='http://127.0.0.1:8137/mycelial/index.html';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let browser=null;
const errors=[],observations=[];
const checkPage=(page,label)=>{
  page.on('pageerror',e=>errors.push(label+': '+e.message));
  page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('favicon'))errors.push(label+' console: '+m.text())});
};
try{
  for(let i=0;i<100;i++){
    try {const r=await fetch(base,{signal:AbortSignal.timeout(1000)});if(r.ok)break;}catch{}
    if(i===99)throw Error('Local deck server not reachable');
    await sleep(200);
  }
  browser=await chromium.launch({headless:true,executablePath,args:[
    '--no-sandbox','--disable-dev-shm-usage','--enable-webgl','--use-gl=angle',
    '--use-angle=swiftshader','--ignore-gpu-blocklist'
  ]});
  const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1,
    recordVideo:{dir:output,size:{width:1280,height:720}}});
  const page=await context.newPage();
  checkPage(page,'desktop');
  await page.goto(base+'#1',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.deckNav?.to===0,{timeout:30000});
  await sleep(3400);
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(()=>window.deckNav?.to===1,{timeout:15000});
  await page.waitForFunction(()=>window.FilamentField?.ready() && document.querySelectorAll('.ff-hit').length===42,{timeout:15000});
  await sleep(3000);
  const slide2=await page.evaluate(()=>{
    const s=document.querySelector('.sf-host');
    const snap=window.FilamentField.snapshot();
    return {
      active:s.classList.contains('on'),fieldReady:window.FilamentField.ready(),
      visible:document.querySelector('.sf.ff-active')!==null,
      hitCount:document.querySelectorAll('.ff-hit').length,
      dotCount:snap.named.length,dustCount:snap.dust.length,
      barriers:['DISCOVER','SET UP','CONFIGURE','COMBINE'].every(x=>document.querySelector('.sf-host').innerHTML.includes(x)) // labels drawn to canvas, checked in source below
    };
  });
  // Barrier labels are canvas text, not DOM. The viewport and pointer are checked instead.
  if(!slide2.active||!slide2.visible||slide2.hitCount!==42||slide2.dotCount!==42||slide2.dustCount!==260)
    throw Error('Live filament scene failed: '+JSON.stringify(slide2));
  await page.screenshot({path:join(output,'desktop-slide2.png'),animations:'disabled'});
  const first=page.locator('.ff-hit').first();
  const r0=await first.boundingBox();
  if(!r0)throw Error('Source dot has no visual position');
  await page.mouse.move(r0.x+r0.width/2,r0.y+r0.height/2);
  await page.mouse.click(r0.x+r0.width/2,r0.y+r0.height/2);
  const selected=await page.locator('.ff-note').evaluate(el=>el.classList.contains('is-on'));
  if(!selected)throw Error('Click on capability did not display details');
  await page.screenshot({path:join(output,'desktop-slide2-selected.png'),animations:'disabled'});
  observations.push({step:'slide2',...slide2,selected});
  // The rare successful filament must create a visible bloom (and emit once).
  await page.evaluate(()=>{
    window.__filamentBloomEvents=[];
    document.querySelector('[data-scatter-field]').addEventListener('filament-create',
      event=>window.__filamentBloomEvents.push(event.detail));
  });
  // Stable seed: strand 12 is one of the four paths reaching Create.
  const successful=await page.locator('.ff-hit').nth(12).boundingBox();
  if(!successful)throw Error('Create-bound dot is missing');
  await page.mouse.click(successful.x+successful.width/2,successful.y+successful.height/2);
  await page.waitForFunction(()=>window.__filamentBloomEvents?.some(event=>event.strand===12),{timeout:7000});
  await sleep(140);
  await page.screenshot({path:join(output,'desktop-create-bloom.png'),animations:'disabled'});
  observations.push({step:'create-bloom',events:await page.evaluate(()=>window.__filamentBloomEvents)});
  // Blank-space click must navigate forward, not open an invisible old starfield card.
  await page.mouse.click(1198,440);
  await page.waitForFunction(()=>window.deckNav?.to===2,{timeout:15000});
  await sleep(2300);
  observations.push({step:'slide3',slide:await page.evaluate(()=>window.deckNav?.to+1)});
  await page.screenshot({path:join(output,'desktop-slide3.png'),animations:'disabled'});
  await page.keyboard.press('ArrowLeft');
  await page.waitForFunction(()=>window.deckNav?.to===1,{timeout:15000});
  await sleep(2450);
  const reverse=await page.evaluate(()=>({
    slide:window.deckNav?.to+1,ready:window.FilamentField?.ready(),
    named:document.querySelector('[data-scatter-field]').snapshot().named.length
  }));
  if(reverse.slide!==2||!reverse.ready||reverse.named!==42)
    throw Error('3 -> 2 reverse filament not restored: '+JSON.stringify(reverse));
  observations.push({step:'slide3-back-to-2',...reverse});
  await page.screenshot({path:join(output,'desktop-return-slide2.png'),animations:'disabled'});
  await page.keyboard.press('ArrowLeft');
  await page.waitForFunction(()=>window.deckNav?.to===0,{timeout:15000});
  await sleep(2300);
  observations.push({step:'slide2-back-to-1',slide:await page.evaluate(()=>window.deckNav?.to+1)});
  await page.screenshot({path:join(output,'desktop-return-slide1.png'),animations:'disabled'});
  const recording=page.video();
  await page.close();await context.close();
  if(recording)await recording.saveAs(join(output,'real-deck-1-2-3-2-1.webm'));
  // Direct entry and mobile static-mode share the actual deck's initialization.
  const mobile=await browser.newPage({
    viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true,
    reducedMotion:'reduce'
  });
  checkPage(mobile,'mobile');
  await mobile.goto(base+'#2',{waitUntil:'domcontentloaded'});
  await mobile.waitForFunction(()=>window.deckNav?.to===1&&window.FilamentField?.ready(),{timeout:15000});
  await sleep(900);
  const mobileStats=await mobile.evaluate(()=>({
    hits:document.querySelectorAll('.ff-hit').length,
    canvas:(()=>{const e=document.querySelector('.ff-canvas');return {w:e.width,h:e.height}})(),
    snap:document.querySelector('[data-scatter-field]').snapshot().named.length,
    inside:[...document.querySelectorAll('.ff-hit')].every(el=>{
      const r=el.getBoundingClientRect();
      return r.left>=-2&&r.right<=innerWidth+2&&r.top>=-2&&r.bottom<=innerHeight+2;
    })
  }));
  if(mobileStats.hits!==42||mobileStats.snap!==42||!mobileStats.inside)
    throw Error('Mobile filament layout failure: '+JSON.stringify(mobileStats));
  observations.push({step:'mobile-direct-slide2',...mobileStats});
  await mobile.screenshot({path:join(output,'mobile-slide2.png'),animations:'disabled'});
  await mobile.close();
  writeFileSync(join(output,'observations.json'),JSON.stringify({observations,errors},null,2));
  if(errors.length)throw Error('Browser errors: '+errors.join('; '));
  process.stdout.write(JSON.stringify({passed:true,observations},null,2)+'\n');
}finally{
  await browser?.close();
  server.kill('SIGTERM');
}
