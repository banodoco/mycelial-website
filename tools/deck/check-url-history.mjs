/* global pendingTurns */ // Controller lexical state read inside browser evaluate callbacks.
// Real-browser URL/history contract. Desktop WebKit is not a physical iOS test.
import assert from 'node:assert/strict';
import { chromium, webkit } from 'playwright-core';
const base = process.argv[2] || 'http://127.0.0.1:8240/mycelial/index.html';
const root = new URL(base); root.search = '?url-check=keep%20me&unrelated=1'; root.hash = '';
const results = [];
for (const [name, engine] of [['chromium', chromium], ['webkit', webkit]]) {
  const browser = await engine.launch(name === 'chromium' ? {channel:'chrome',headless:true} : {headless:true});
  const context = await browser.newContext({viewport:{width:390,height:669},deviceScaleFactor:3,isMobile:true,hasTouch:true,reducedMotion:'reduce'});
  const page = await context.newPage(), errors = [], cases = [];
  page.on('pageerror', error => errors.push(error.message));
  const settled = n => page.waitForFunction(n => {
    const active=document.querySelector('.slide.on');
    return active === document.querySelectorAll('.slide')[n-1] && active.hasAttribute('data-settled');
  }, n, {timeout:30000});
  const read = () => page.evaluate(() => ({hash:location.hash,search:location.search,state:history.state,length:history.length,index:window.deckNav.to+1,generation:window.deckNav.generation}));
  const check = async (n, hash, label) => {
    await settled(n); const current=await read();
    assert.equal(current.hash,hash,label);assert.equal(current.index,n,label);assert.equal(current.state.deckSlide,n,label);
    assert.equal(current.search,root.search,`${label}: query preserved`);cases.push(label);return current;
  };
  try {
    for (const [hash,n,wanted] of [['#2',2,'#2'],['#0',1,'#1'],['#-4',1,'#1'],['#99',11,'#11'],['#999999999999999999999999',11,'#11'],['#002',2,'#2'],['#2.5',1,'#2.5'],['#2-notes',1,'#2-notes'],['#help',1,'#help'],['',1,'#1']]) {
      // New query token forces a real document; hash-only page.goto is same-document navigation.
      const url=new URL(root);url.searchParams.set('case',String(cases.length));url.hash=hash;
      await page.goto(url.href);
      await settled(n);const current=await read();assert.equal(current.hash,wanted,hash||'bare URL');assert.equal(current.index,n);assert.equal(current.state.deckSlide,n);assert.equal(new URL(page.url()).searchParams.get('url-check'),'keep me');
      cases.push(`load ${hash||'bare'} -> ${wanted}, slide ${n}`);
    }
    await page.goto(root.href+'#2');await check(2,'#2','deep link preserved');
    await page.evaluate(()=>{history.replaceState({...history.state,unrelatedState:'kept'},'',location.href);window.__urlEvents=[];for(const kind of ['popstate','hashchange'])addEventListener(kind,()=>window.__urlEvents.push(kind));});
    const initial=await read();for(const n of [3,4]){await page.keyboard.press('ArrowRight');await check(n,`#${n}`,`arrow to ${n}`);}
    assert.equal((await read()).length,initial.length,'arrows add no history stops');assert.equal((await read()).state.unrelatedState,'kept');
    assert.deepEqual(await page.evaluate(()=>window.__urlEvents),[],'replaceState causes no URL event loop');cases.push('arrows preserve metadata and add no events/history entries');
    await page.evaluate(()=>location.hash='#7');await check(7,'#7','external #7');const linked=await read();assert.equal(linked.length,initial.length+1);
    await page.evaluate(()=>location.hash='#7');await check(7,'#7','same #7');assert.equal((await read()).length,linked.length);
    await page.goBack();await check(4,'#4','browser Back');await page.goForward();await check(7,'#7','browser Forward');await page.reload();await check(7,'#7','refresh retains selected slide');
    await page.goto('about:blank');await page.goto(root.href+'#help');await check(1,'#help','foreign anchor on load');await page.keyboard.press('ArrowRight');await check(2,'#help','foreign anchor preserved through arrow');
    await page.evaluate(()=>location.hash='#2-notes');await check(2,'#2-notes','foreign anchor does not partially parse or navigate');
    await page.evaluate(()=>{history.replaceState({deckSlide:4,unrelatedState:'kept'},'',location.pathname+location.search);dispatchEvent(new PopStateEvent('popstate'));});await check(4,'#4','legacy hashless state restored');
    assert.deepEqual(errors,[]);await context.close();
    // Same-target duplicate notifications must leave an active queue and pace alone.
    const moving=await browser.newContext({viewport:{width:390,height:669}});const live=await moving.newPage();
    await live.goto(root.href+'#2');await live.waitForFunction(()=>document.querySelectorAll('.slide')[1].hasAttribute('data-settled'));
    await live.keyboard.press('ArrowRight');await live.keyboard.press('ArrowRight');
    const queue=await live.evaluate(()=>({pending:pendingTurns.length,pace:window.deckPace(),generation:window.deckNav.generation}));assert(queue.pending>0,'test must have queued navigation');
    const after=await live.evaluate(()=>{dispatchEvent(new PopStateEvent('popstate'));dispatchEvent(new HashChangeEvent('hashchange'));return{pending:pendingTurns.length,pace:window.deckPace(),generation:window.deckNav.generation};});
    assert.deepEqual(after,queue,'duplicate current URL notifications preserve queue/pace/generation');
    await live.waitForFunction(()=>document.querySelectorAll('.slide')[3].hasAttribute('data-settled'),null,{timeout:30000});cases.push('duplicate URL events preserve active turn queue and pace');await moving.close();
    results.push({engine:name,version:await browser.version(),passed:true,cases,errors});
  } finally { await browser.close(); }
}
console.log(JSON.stringify({passed:true,actualIOS:false,results},null,2));
