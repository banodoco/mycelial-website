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
// The labels are painted directly to Canvas, so their authoritative positions
// come from the same geometry used for drawing, not inferred image pixels.
const checkFlow=async(page,kind)=>{
  const v=await page.evaluate(()=>window.FilamentField.layoutMetrics());
  const labels=[v.sourceX,...v.gatesX],step=(labels[5]-labels[0])/5;
  const valid=v.labelY>=v.headlineBottom+15
    && v.labelY<v.dotsTop-12
    && v.dotsTop-v.headlineBottom<=50
    && v.height-v.dotsBottom<180
    && v.lineTop>=v.labelY+13
    && v.lineBottom<=v.height
    && labels.every((x,i)=>i===0||Math.abs((x-labels[i-1])-step)<1);
  if(!valid)throw Error(kind+' has overlapping or dead space in filament layout: '+JSON.stringify(v));
  observations.push({step:kind+'-flow',metrics:v});
};
const checkNote=async(page,r,s)=>{
  await sleep(250);
  const result=await page.evaluate(({r,s})=>{
    const note=document.querySelector('.ff-note'),n=note.getBoundingClientRect(),p=document.querySelector('.ff-hit[data-row="'+r+'"][data-stage="'+s+'"]').getBoundingClientRect();
    const inside=n.left>=0&&n.right<=innerWidth&&n.top>=0&&n.bottom<=innerHeight;
    const clear=n.right<=p.left||n.left>=p.right||n.bottom<=p.top||n.top>=p.bottom;
    return {inside,clear,placement:note.dataset.placement,note:{x:n.x,y:n.y,w:n.width,h:n.height},hit:{x:p.x,y:p.y,w:p.width,h:p.height}};
  },{r,s});
  if(!result.inside||!result.clear)throw Error('Unanchored note: '+JSON.stringify(result));
  return result;
};
const installFlashWatch=page=>page.addInitScript(()=>{
  const samples={legacy:[],footer:[],frames:0,reverseFrames:0,forwardFrames:0};
  window.__filamentFlashWatch=samples;
  const visible=el=>{
    const s=getComputedStyle(el);
    return s.visibility==='visible'&&s.display!=='none'&&Number(s.opacity)>.001;
  };
  const frame=()=>{
    const slide=document.querySelector('.sf-host.ff-layout');
    if(slide){
      samples.frames++;
      const reverse=slide.classList.contains('dt-rewind'),forward=slide.classList.contains('dt-leaving');
      if(reverse)samples.reverseFrames++;
      if(forward)samples.forwardFrames++;
      for(const el of slide.querySelectorAll('.sf-legend,.sf-key,.sf-whisper,.sf-card'))
        if(visible(el)&&samples.legacy.length<20)samples.legacy.push({target:el.className,reverse,forward});
      const footer=slide.querySelector('.ff-conclusion');
      if(footer&&(!slide.classList.contains('on')||!footer.classList.contains('is-revealed'))&&visible(footer)&&samples.footer.length<20)
        samples.footer.push({reverse,forward,on:slide.classList.contains('on'),revealed:footer.classList.contains('is-revealed')});
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
});
const assertNoFlash=async(page,label)=>{
  const result=await page.evaluate(()=>window.__filamentFlashWatch);
  if(!result||!result.frames||result.legacy.length||result.footer.length)throw Error(label+' leaked retired UI or unrevealed conclusion: '+JSON.stringify(result));
  observations.push({step:label,...result});return result;
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
  // Direct entry and mobile static-mode share the actual deck's initialization.
  const mobile=await browser.newPage({
    viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true,
    reducedMotion:'reduce'
  });
  checkPage(mobile,'mobile');
  await installFlashWatch(mobile);
  await mobile.goto(base+'#2',{waitUntil:'domcontentloaded'});
  await mobile.waitForFunction(()=>window.deckNav?.to===1&&window.FilamentField?.ready(),{timeout:15000});
  await sleep(900);
  await mobile.evaluate(()=>document.fonts.ready);
  await sleep(200);
  const mobileStats=await mobile.evaluate(()=>({
    hits:document.querySelectorAll('.ff-hit').length,
    canvas:(()=>{const e=document.querySelector('.ff-canvas');return {w:e.width,h:e.height}})(),
    snap:document.querySelector('[data-scatter-field]').snapshot().named.length,
    inside:[...document.querySelectorAll('.ff-hit')].every(el=>{
      const r=el.getBoundingClientRect();
      return r.left>=-2&&r.right<=innerWidth+2&&r.top>=-2&&r.bottom<=innerHeight+2;
    })
  }));
  if(mobileStats.hits!==60||mobileStats.snap!==60||!mobileStats.inside)
    throw Error('Mobile filament layout failure: '+JSON.stringify(mobileStats));
  observations.push({step:'mobile-direct-slide2',...mobileStats});
  await checkFlow(mobile,'mobile');
  if(!(await mobile.evaluate(()=>window.FilamentField.state().concluded)))throw Error('Reduced-motion conclusion is not visible');
  await mobile.screenshot({path:join(output,'mobile-slide2.png'),animations:'disabled'});
  await mobile.locator('.ff-hit[data-row="2"][data-stage="1"]').tap();
  const touch=await mobile.evaluate(()=>window.FilamentField.state());
  if(touch.inspection?.r!==2||touch.inspection?.s!==1||!touch.pinned)throw Error('Mobile checkpoint did not pin: '+JSON.stringify(touch));
  await mobile.screenshot({path:join(output,'mobile-slide2-selected.png'),animations:'disabled'});
  await checkNote(mobile,2,1);
  await mobile.locator('.ff-hit[data-row="9"][data-stage="5"]').tap();
  await checkNote(mobile,9,5);
  await mobile.screenshot({path:join(output,'mobile-output-selected.png'),animations:'disabled'});
  if((await mobile.evaluate(()=>window.FilamentField.state().ringProgress))!==null)throw Error('Reduced-motion view has a running countdown');
  await assertNoFlash(mobile,'mobile-no-flash');
  await mobile.close();
  const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1,
    recordVideo:{dir:output,size:{width:1280,height:720}}});
  const page=await context.newPage();
  checkPage(page,'desktop');
  await installFlashWatch(page);
  await page.goto(base+'#1',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.deckNav?.to===0,{timeout:30000});
  await sleep(3400);
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(()=>window.deckNav?.to===1,{timeout:15000});
  await page.waitForFunction(()=>window.FilamentField?.ready() && document.querySelectorAll('.ff-hit').length===60,{timeout:15000});
  await sleep(3000);
  const slide2=await page.evaluate(()=>{
    const s=document.querySelector('.sf-host');
    const snap=window.FilamentField.snapshot();
    return {
      active:s.classList.contains('on'),fieldReady:window.FilamentField.ready(),
      visible:document.querySelector('.sf.ff-active')!==null,
      hitCount:document.querySelectorAll('.ff-hit').length,
      dotCount:snap.named.length,dustCount:snap.dust.length
    };
  });
  // Barrier labels are canvas text, not DOM. The viewport and pointer are checked instead.
  if(!slide2.active||!slide2.visible||slide2.hitCount!==60||slide2.dotCount!==60||slide2.dustCount!==260)
    throw Error('Live filament scene failed: '+JSON.stringify(slide2));
  await checkFlow(page,'desktop');
  await page.screenshot({path:join(output,'desktop-slide2.png'),animations:'disabled'});
  const early=await page.evaluate(()=>window.FilamentField.state());
  // At the end of entry, the conclusion must reveal within its first
  // settled second, before the Requirement checkpoint has advanced.
  await page.waitForFunction(()=>{const s=window.FilamentField.state();return s.concluded&&s.row===0&&s.step===0;},null,{timeout:3000});
  const revealed=await page.evaluate(()=>window.FilamentField.state());
  if(revealed.conclusionAge<.999||revealed.conclusionAge>1.11)throw Error('Conclusion timing drift: '+JSON.stringify(revealed));
  const initial=await checkNote(page,early.row,early.step);
  if(initial.placement!=='below'||initial.note.x<=initial.hit.x||initial.note.y<=initial.hit.y)throw Error('Initial note not down-right: '+JSON.stringify(initial));

  if(await page.locator('.ff-kind').textContent()!=='Requirement')throw Error('Requirement card contains unrelated numbering');
  await page.waitForFunction(()=>{const s=window.FilamentField.state();return s.step===0&&s.ringProgress>=.35&&s.ringProgress<.8;},null,{timeout:8000});
  await page.screenshot({path:join(output,'desktop-countdown.png'),animations:'disabled'});
  // Wait for the narrated first checkpoint to actually progress, not just paint.
  await page.waitForFunction(()=>window.FilamentField.state().step===1,null,{timeout:15000});
  observations.push({step:'auto-discover',state:await page.evaluate(()=>window.FilamentField.state())});
  if(await page.locator('.ff-kind').textContent()!=='Discover')throw Error('Discovery card contains unrelated numbering');
  await page.screenshot({path:join(output,'desktop-discover.png'),animations:'disabled'});
  // Select Discover on row three, then inspect its unreached output.
  const checkpoint=page.locator('.ff-hit[data-row="2"][data-stage="1"]');
  await checkpoint.hover();
  await page.waitForFunction(()=>window.FilamentField.state().inspection?.r===2&&window.FilamentField.state().inspection?.s===1);
  const selected=await page.locator('.ff-note-name').textContent();
  if(!selected.includes('H3 looping'))throw Error('Wrong checkpoint note: '+selected);
  await sleep(500);
  const geometry=await checkNote(page,2,1);
  await page.screenshot({path:join(output,'desktop-slide2-selected.png'),animations:'disabled'});
  await page.locator('.ff-hit[data-row="2"][data-stage="5"]').hover();
  if(!(await page.locator('.ff-note-name').textContent()).includes('never realised'))throw Error('Unreached output has wrong note');
  await page.mouse.move(1198,440);
  await page.waitForFunction(()=>window.FilamentField.state().inspection===null);
  if((await page.evaluate(()=>window.FilamentField.state().row))!==2)throw Error('Hover release lost the inspected row');
  observations.push({step:'slide2',...slide2,selected,geometry});
  // A success emits precisely once when the moving dot arrives at Output.
  await page.evaluate(()=>{
    window.__filamentBloomEvents=[];
    document.querySelector('[data-scatter-field]').addEventListener('filament-create',e=>window.__filamentBloomEvents.push(e.detail));
  });
  await page.locator('.ff-hit[data-row="1"][data-stage="4"]').hover();
  await page.mouse.move(1198,440);
  await page.waitForFunction(()=>window.__filamentBloomEvents.some(e=>e.strand===1),null,{timeout:15000});
  if((await page.evaluate(()=>window.__filamentBloomEvents.filter(e=>e.strand===1).length))!==1)throw Error('Duplicate output arrival');
  await page.screenshot({path:join(output,'desktop-create-bloom.png'),animations:'disabled'});
  await page.waitForFunction(()=>window.FilamentField.state().concluded,null,{timeout:15000});
  await sleep(1000);
  await page.screenshot({path:join(output,'desktop-conclusion.png'),animations:'disabled'});
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
  if(reverse.slide!==2||!reverse.ready||reverse.named!==60)
    throw Error('3 -> 2 reverse filament not restored: '+JSON.stringify(reverse));
  observations.push({step:'slide3-back-to-2',...reverse});
  await page.screenshot({path:join(output,'desktop-return-slide2.png'),animations:'disabled'});
  await page.keyboard.press('ArrowLeft');
  await page.waitForFunction(()=>window.deckNav?.to===0,{timeout:15000});
  await sleep(2300);
  observations.push({step:'slide2-back-to-1',slide:await page.evaluate(()=>window.deckNav?.to+1)});
  await page.screenshot({path:join(output,'desktop-return-slide1.png'),animations:'disabled'});
  const flashes=await assertNoFlash(page,'desktop-full-handoff-no-flash');
  if(!flashes.reverseFrames||!flashes.forwardFrames)throw Error('Flash check did not exercise actual presentation grants');
  const recording=page.video();
  await page.close();await context.close();
  if(recording)await recording.saveAs(join(output,'real-deck-1-2-3-2-1.webm'));
  // Leave a fresh slide-2 visit before its delayed conclusion has revealed.
  // A direct hash navigation forces the interruption rather than queueing it
  // until the current entry completes. Keep monitoring through the handoff.
  const quick=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});
  checkPage(quick,'early-exit');
  await installFlashWatch(quick);
  await quick.goto(base+'#2',{waitUntil:'domcontentloaded'});
  const earlyExit=await quick.evaluate(()=>new Promise((resolve,reject)=>{
    const deadline=performance.now()+10000;
    const watch=()=>{
      const state=window.FilamentField?.state();
      if(window.deckNav?.to===1&&state?.mode==='rest'){
        if(state.concluded)return reject(Error('Missed unrevealed conclusion window'));
        const footer=document.querySelector('.ff-conclusion');
        if(getComputedStyle(footer).visibility!=='hidden')return reject(Error('Unrevealed footer was visible'));
        const before={conclusionAge:state.conclusionAge,concluded:state.concluded};
        location.hash='#3';return resolve(before);
      }
      if(performance.now()>deadline)return reject(Error('Slide 2 did not become ready'));
      requestAnimationFrame(watch);
    };
    watch();
  }));
  await quick.waitForFunction(()=>window.deckNav?.to===2,null,{timeout:15000});
  await sleep(2300);
  await assertNoFlash(quick,'early-2-to-3-no-flash');
  const after=await quick.evaluate(()=>({concluded:window.FilamentField.state().concluded,visible:getComputedStyle(document.querySelector('.ff-conclusion')).visibility}));
  if(after.concluded||after.visible!=='hidden')throw Error('Conclusion survived early exit: '+JSON.stringify(after));
  observations.push({step:'early-exit',before:earlyExit,after});
  await quick.close();
  writeFileSync(join(output,'observations.json'),JSON.stringify({observations,errors},null,2));
  if(errors.length)throw Error('Browser errors: '+errors.join('; '));
  process.stdout.write(JSON.stringify({passed:true,observations},null,2)+'\n');
}finally{
  await browser?.close();
  server.kill('SIGTERM');
}
