"""Full-deck stack/wheel resilience, geometry and work-count checks.
Run with the range-capable project server and optional untouched baseline server.
WebKit emulation is not a physical-iPhone reproduction or a device GPU profile.
"""
import argparse, asyncio, io, json
from pathlib import Path
import numpy as np
from PIL import Image
from playwright.async_api import async_playwright

INSTRUMENT = r"""(() => {
  let seed=6384; Math.random=()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646;};
  const probe=window.__sceneProbe={frames:0,strokes:0,faults:[],watchdogs:0};
  const stroke=CanvasRenderingContext2D.prototype.stroke;
  CanvasRenderingContext2D.prototype.stroke=function(...args){
    if(this.canvas.classList.contains('st-threads'))probe.strokes++;
    return stroke.apply(this,args);
  };
  const frame=()=>{probe.frames++;requestAnimationFrame(frame)}; requestAnimationFrame(frame);
  addEventListener('deck-scene-fault',e=>probe.faults.push(e.detail));
  addEventListener('deck-watchdog',()=>probe.watchdogs++);
})();"""
READ = r"""() => {
 const slide=document.querySelector('.st-host'), root=slide.querySelector('.st');
 const box=el=>{const b=el.getBoundingClientRect();return [b.x,b.y,b.width,b.height]};
 const alpha=el=>{let a=1;for(let n=el;n;n=n.parentElement)a*=Number(getComputedStyle(n).opacity);return a};
 return {slide:window.deckNav.to+1,settled:!!slide.hasAttribute('data-settled'),root:box(root),
 planes:[...root.querySelectorAll('.st-plane')].map(p=>({box:box(p),opacity:alpha(p)})),
 flags:[...root.querySelectorAll('.st-flag')].map(p=>({box:box(p),opacity:alpha(p),reveal:p.style.getPropertyValue('--in'),label:p.textContent})),
 open:[...root.querySelectorAll('.st-card.is-open')].length,
 ghost:root.querySelectorAll('.st-ghost').length,carry:root.querySelectorAll('.st-carry').length,
 diagnostics:window.__deckDebug?.stack,probe:window.__sceneProbe};
}"""
async def settled(page,n):
    await page.wait_for_function("n=>window.deckNav?.to===n-1&&document.querySelector('.slide.on')?.hasAttribute('data-settled')",arg=n,timeout=30000)
    assert not await page.locator('.slide.on').get_attribute('data-deck-failed')
async def goto(page,base,n):
    await page.goto(base+'?debug#'+str(n),wait_until='domcontentloaded')
    await page.evaluate('document.fonts.ready');await settled(page,n)
async def nav(page,n):
    old=await page.evaluate('window.deckNav.to+1')
    await page.keyboard.press('ArrowRight' if n>old else 'ArrowLeft');await settled(page,n)
async def stack_check(page,out,name,mobile=True):
    await page.wait_for_timeout(350)
    first=await page.screenshot(path=str(out/(name+'.png')))
    s=await page.evaluate(READ)
    assert s['slide']==6 and s['settled'],s
    assert all(p['opacity']>.9 and p['box'][2]>5 and p['box'][3]>5 for p in s['planes']),s
    assert all(float(f['reveal'])>.99 for f in s['flags']),s
    if mobile:assert all(f['opacity']>.95 for f in s['flags']),s
    assert s['ghost']==0 and s['carry']==0,s
    # Pixel proof for flags, not only opacity assertions. Capture before the diagnostic change.
    hidden=await page.add_style_tag(content='.st-flag{visibility:hidden!important}')
    try: second=await page.screenshot()
    finally: await hidden.evaluate('e=>e.remove()')
    a=np.array(Image.open(io.BytesIO(first)).convert('RGB')).astype(int)
    b=np.array(Image.open(io.BytesIO(second)).convert('RGB')).astype(int)
    s['flag_pixels']=[]
    for f in s['flags']:
        x,y,w,h=f['box'];x0=max(0,int(x));y0=max(0,int(y));x1=min(a.shape[1],int(x+w)+1);y1=min(a.shape[0],int(y+h)+1)
        patch=a[y0:y1,x0:x1];delta=np.max(np.abs(patch-b[y0:y1,x0:x1]),axis=2)
        ink=int(np.count_nonzero((delta>20)&(patch[:,:,0]>100)&(patch[:,:,1]>70)))
        s['flag_pixels'].append(ink)
        if mobile: assert ink>10,{'flag':f,'pixels':ink,'name':name}
    if s['diagnostics']:
        assert s['diagnostics']['scale']>0,s
        assert s['diagnostics']['ghostPixels']<100,s
    return s
async def work(page):
    a=await page.evaluate('({...window.__sceneProbe,stack:window.__deckDebug?.stack?.metrics})')
    await page.wait_for_timeout(1600)
    b=await page.evaluate('({...window.__sceneProbe,stack:window.__deckDebug?.stack?.metrics})')
    frames=max(1,b['frames']-a['frames'])
    result={'frames':frames,'stroke_calls':b['strokes']-a['strokes'],'strokes_per_frame':(b['strokes']-a['strokes'])/frames}
    if b.get('stack'):result['stack_delta']={k:b['stack'][k]-a['stack'][k] for k in b['stack']}
    return result
async def exercise(pw,engine,width,height,base,baseline,out):
    browser=await getattr(pw,engine).launch(headless=True)
    context=await browser.new_context(viewport={'width':width,'height':height},device_scale_factor=1,is_mobile=width<761,has_touch=width<761)
    await context.add_init_script(INSTRUMENT);page=await context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    label=f'{engine}-{width}';results={'engine':engine,'viewport':[width,height],'checks':[]}
    try:
        await goto(page,base,6);results['checks'].append(await stack_check(page,out,label+'-direct',width<761))
        results['work']=await work(page)
        if baseline:
            other=await context.new_page();await goto(other,baseline,6)
            results['baseline_work']=await work(other);await other.close()
            assert results['work']['strokes_per_frame'] < results['baseline_work']['strokes_per_frame']*.65,results
        (out/(label+'-work.json')).write_text(json.dumps({'work':results['work'],'baseline':results.get('baseline_work')},indent=2))
        for r in range(2):
            for n in [7,6,5,6]:
                old=await page.evaluate('window.deckNav.to+1')
                await page.keyboard.press('ArrowRight' if n>old else 'ArrowLeft')
                await page.wait_for_timeout(350)
                await page.screenshot(path=str(out/f'{label}-{r}-{old}-{n}-350.png'))
                await settled(page,n)
                if n==6:results['checks'].append(await stack_check(page,out,f'{label}-revisit-{r}-{old}',width<761))
        for delay in [80,350,900]:
            await page.keyboard.press('ArrowRight');await page.wait_for_timeout(delay)
            await page.keyboard.press('ArrowLeft');await settled(page,6)
            results['checks'].append(await stack_check(page,out,f'{label}-interrupt-{delay}',width<761))
        # All five controls still open their own card.
        for i in range(5):
            button=page.locator('.st-host.on .st-flag').nth(i)
            await button.click()
            # pinTo() publishes card/ARIA state on the scene's next animation frame.
            await page.wait_for_function("i=>document.querySelectorAll('.st-host.on .st-flag')[i]?.getAttribute('aria-expanded')==='true'",arg=i,timeout=2500)
            await page.keyboard.press('Escape')
        await page.set_viewport_size({'width':width,'height':height-80});await page.wait_for_timeout(800)
        results['checks'].append(await stack_check(page,out,label+'-resize',width<761))
        if width<761:
            await page.set_viewport_size({'width':height,'height':width});await page.wait_for_timeout(800)
            results['checks'].append(await stack_check(page,out,label+'-landscape',False))
            await page.set_viewport_size({'width':width,'height':560});await page.wait_for_timeout(800)
            results['checks'].append(await stack_check(page,out,label+'-compact',True))
        await page.set_viewport_size({'width':width,'height':height});await page.wait_for_timeout(800)
        # One actual Canvas API exception must not permanently hide canvas/labels.
        await page.evaluate(r"""() => {const old=CanvasRenderingContext2D.prototype.stroke;let fired=false;
          CanvasRenderingContext2D.prototype.stroke=function(...a){if(!fired&&this.canvas.classList.contains('st-threads')){fired=true;throw Error('injected-thread-once')}return old.apply(this,a)};
        }""")
        await page.wait_for_timeout(600);results['checks'].append(await stack_check(page,out,label+'-draw-fault',width<761))
        # A failure in the main frame path gets one explicit recovery, not a lost loop.
        await page.evaluate(r"""() => {const v=document.querySelector('.st-pic video'),d=Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype,'currentTime');let fired=false;
          Object.defineProperty(v,'currentTime',{configurable:true,get(){if(!fired){fired=true;throw Error('injected-frame-once')}return d.get.call(this)},set(x){d.set.call(this,x)}});
        }""")
        await page.wait_for_timeout(800);results['checks'].append(await stack_check(page,out,label+'-frame-fault',width<761))
        assert (await page.evaluate('window.__deckDebug.stack.metrics.frameRecoveries'))==1
        a=await page.evaluate('window.__deckDebug.stack.metrics.frames');await page.wait_for_timeout(300)
        assert (await page.evaluate('window.__deckDebug.stack.metrics.frames'))>a
        # Verify a failed transfer before fallback is cleared, with real source media.
        await goto(page,base,5)
        await page.wait_for_function("document.querySelector('.as').classList.contains('has-frame')",timeout=20000)
        await page.evaluate(r"""() => {const old=CanvasRenderingContext2D.prototype.drawImage;let fired=false;
          CanvasRenderingContext2D.prototype.drawImage=function(...a){if(!fired&&a.length===9&&a[0]?.classList?.contains('as-pic')){fired=true;window.__captureFailed=true;throw Error('injected-capture-once')}return old.apply(this,a)};
        }""")
        await nav(page,6);assert await page.evaluate('window.__captureFailed===true')
        results['checks'].append(await stack_check(page,out,label+'-capture-fault',width<761))
        # Revisit final slides after exercising the heavier scene.
        for n in [7,8,9,10,11,10,9,10,11]:
            await nav(page,n)
            if n>=9:
                await page.wait_for_timeout(300)
                await page.screenshot(path=str(out/f'{label}-after-stack-{n}.png'))
                text=await page.locator('.slide.on h1').evaluate("e=>({text:e.textContent,visible:e.checkVisibility({opacityProperty:true,visibilityProperty:true}),mask:getComputedStyle(e.closest('.split')).maskImage})")
                assert text['visible'],text
        assert not errors,errors
        results['errors']=errors
        return results
    except Exception:
        await page.screenshot(path=str(out/(label+'-FAIL.png')))
        (out/(label+'-FAIL.json')).write_text(json.dumps({'state':await page.evaluate(READ),'errors':errors},indent=2))
        raise
    finally:await browser.close()
async def parity(pw,base,baseline,out):
    if not baseline:return []
    reports=[]
    for engine in ['chromium','webkit']:
        browser=await getattr(pw,engine).launch(headless=True)
        for width,height in [(390,844),(1280,800)]:
            context=await browser.new_context(viewport={'width':width,'height':height})
            await context.add_init_script(INSTRUMENT+"localStorage.setItem('deck-motion','off');")
            samples=[]
            for label,url in [('old',baseline),('new',base)]:
                page=await context.new_page();await goto(page,url,6);await page.wait_for_timeout(500)
                # Compare static composition without stochastic background-network details.
                await page.add_style_tag(content='.dt-net,.dt-dot,.dt-mark,.dt-name,#dbg-panel {visibility:hidden!important}')
                pic=await page.screenshot(path=str(out/f'{engine}-{width}-parity-{label}.png'))
                samples.append((await page.evaluate(READ),np.array(Image.open(io.BytesIO(pic)).convert('RGB')).astype(float)))
                await page.close()
            for kind in ['planes','flags']:
                for a,b in zip(samples[0][0][kind],samples[1][0][kind]):
                    assert max(abs(x-y) for x,y in zip(a['box'],b['box']))<1.5,(engine,width,kind,a,b)
            mae=float(np.mean(abs(samples[0][1]-samples[1][1])))
            assert mae<4,{'engine':engine,'width':width,'MAE':mae}
            reports.append({'engine':engine,'width':width,'pixel_MAE':mae,'geometry_match':True})
            await context.close()
        await browser.close()
    return reports
async def main():
    p=argparse.ArgumentParser();p.add_argument('--base',default='http://127.0.0.1:8240/mycelial/index.html');p.add_argument('--baseline');p.add_argument('--out',default='scene-resilience-results');args=p.parse_args()
    out=Path(args.out);out.mkdir(parents=True,exist_ok=True);reports={}
    async with async_playwright() as pw:
        reports['parity']=await parity(pw,args.base,args.baseline,out)
        (out/'results.json').write_text(json.dumps(reports,indent=2))
        reports['runs']=[]
        for engine,width,height in [('chromium',1280,800),('chromium',390,844),('webkit',390,844)]:
            r=await exercise(pw,engine,width,height,args.base,args.baseline,out);reports['runs'].append(r)
            (out/'results.json').write_text(json.dumps(reports,indent=2))
            print(json.dumps({'engine':engine,'width':width,'checks':len(r['checks']),'work':r['work'],'baseline_work':r.get('baseline_work')}),flush=True)
    print('FULL_DECK_SCENE_RESILIENCE_PASSED',flush=True)
if __name__=='__main__':asyncio.run(main())
