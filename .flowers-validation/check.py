"""Real deck: reverse Flowers pixels, snapshot invalidation, and static mobile stack.
Requires playwright, Pillow and numpy. Emulation is not a physical-iPhone test.
"""
import argparse, asyncio, io, json
from pathlib import Path
import numpy as np
from PIL import Image
from playwright.async_api import async_playwright
READ=r"""() => {const c=document.querySelector('.fl-canvas'),g=c.getContext('2d');let pixels=0;const p=g.getImageData(0,0,c.width,c.height).data;for(let i=3;i<p.length;i+=4)if(p[i]>15)pixels++;
return {selected:window.deckNav.to+1,alphaPixels:pixels,opacity:getComputedStyle(c).opacity,backingPixels:c.width*c.height,flowers:window.__deckDebug.flowers,faults:window.__testFaults}}"""
async def settled(p,n):
    await p.wait_for_function('n=>window.deckNav?.to===n-1&&document.querySelector(".slide.on")?.hasAttribute("data-settled")',arg=n,timeout=30000)
    assert not await p.locator('.slide.on').get_attribute('data-deck-failed')
async def goto(p,base,n):
    await p.goto(base+'?debug#'+str(n),wait_until='domcontentloaded');await p.evaluate('document.fonts.ready');await settled(p,n)
async def nav(p,n):
    old=await p.evaluate('window.deckNav.to+1');await p.keyboard.press('ArrowRight' if n>old else 'ArrowLeft');await settled(p,n)
async def flowers_check(p,out,label):
    await p.wait_for_timeout(350)
    first=await p.screenshot(path=str(out/(label+'.png')))
    s=await p.evaluate(READ)
    assert s['selected']==8 and float(s['opacity'])>.99 and s['alphaPixels']>1500,s
    assert not s['flowers']['coreHeld'] and not s['flowers']['handed'],s
    assert not s['flowers']['surfaceParked'] and s['flowers']['scheduled'],s
    # The first screenshot precedes all diagnostic changes. Confirm on-screen
    # canvas contribution separately from its independent DOM labels/counter.
    style=await p.add_style_tag(content='.fl-canvas{visibility:hidden!important}')
    try: second=await p.screenshot()
    finally: await style.evaluate('e=>e.remove()')
    a=np.array(Image.open(io.BytesIO(first)).convert('RGB')).astype(int)
    b=np.array(Image.open(io.BytesIO(second)).convert('RGB')).astype(int)
    s['screenDeltaPixels']=int(np.count_nonzero(np.max(np.abs(a-b),axis=2)>20))
    assert s['screenDeltaPixels']>500,s
    return s
async def exercise(pw,engine,w,h,base,out):
    browser=await getattr(pw,engine).launch();mobile=w<761
    ctx=await browser.new_context(viewport={'width':w,'height':h},device_scale_factor=2 if mobile else 1,is_mobile=mobile,has_touch=mobile)
    await ctx.add_init_script(r"""window.__testFaults=[];window.__stackPlays=0;addEventListener('deck-scene-fault',e=>__testFaults.push(e.detail));const play=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(...a){if(this.hasAttribute('data-stack-preview'))window.__stackPlays++;return play.apply(this,a)};""")
    p=await ctx.new_page();errors=[];p.on('pageerror',lambda e:errors.append(str(e)));label=f'{engine}-{w}-{h}';r={'engine':engine,'viewport':[w,h],'checks':[]}
    try:
        # Cold stack entry must not create an additional decoder on a phone.
        await goto(p,base,6);await p.wait_for_timeout(1000)
        s=await p.evaluate("""() => {const v=document.querySelector('.st-pic video'),img=document.querySelector('.st-poster');return {static:window.deckStackPosterOnly(),plays:__stackPlays,src:v.getAttribute('src'),paused:v.paused,poster:img.complete&&img.naturalWidth>0,debug:__deckDebug.stack}}""")
        assert s['poster'],s
        if mobile:assert s['static'] and s['plays']==0 and s['src'] is None and s['paused'],s
        else:
            await p.wait_for_function("document.querySelector('.st-pic video').readyState>=2",timeout=20000)
            assert s['plays']>0,s
        r['stack']=s;await p.screenshot(path=str(out/(label+'-stack.png')))
        for n in [7,6,5,6]:await nav(p,n)
        if mobile:
            assert await p.evaluate('__stackPlays')==0
            assert await p.locator('.st-pic video').get_attribute('src') is None
        # This is the non-direct 7→8 path, not the direct-entry ta=40 shortcut.
        await nav(p,7);await nav(p,8);r['checks'].append(await flowers_check(p,out,label+'-from7'))
        for i in range(3):
            old=await p.evaluate('__deckDebug.flowers.time-__deckDebug.flowers.offset')
            await nav(p,9);await p.wait_for_timeout(800)
            parked=await p.evaluate(READ);assert parked['backingPixels']==1,parked
            if i==1:await p.evaluate("document.fonts.dispatchEvent(new Event('loadingdone'))")
            if i==2:await p.set_viewport_size({'width':w,'height':h-55});await p.wait_for_timeout(750)
            await nav(p,8);s=await flowers_check(p,out,label+'-return-'+str(i));r['checks'].append(s)
            assert s['flowers']['time']-s['flowers']['offset']>=old-.1,s
        for delay in [80,350,900]:
            await p.keyboard.press('ArrowRight');await p.wait_for_timeout(delay);await p.keyboard.press('ArrowLeft');await settled(p,8)
            r['checks'].append(await flowers_check(p,out,label+'-interrupt-'+str(delay)))
        # One draw fault after clearRect used to leave a blank canvas and a dead
        # RAF loop. Inject exactly once; retain the scene clock and recover.
        await p.evaluate("""() => {const g=document.querySelector('.fl-canvas').getContext('2d'),old=g.clearRect;g.clearRect=function(...a){g.clearRect=old;old.apply(g,a);throw Error('test Flowers one-frame fault')}}""")
        await p.wait_for_timeout(500);r['checks'].append(await flowers_check(p,out,label+'-frame-fault'))
        assert any(f['scene']=='flowers' and f['phase']=='frame' for f in await p.evaluate('__testFaults'))
        # Event-path test, NOT an actual GPU-memory/context-loss simulation.
        await p.evaluate("""() => {const c=document.querySelector('.fl-canvas');c.dispatchEvent(new Event('contextlost'));c.width=c.width;}""")
        assert not await p.evaluate('__deckDebug.flowers.scheduled')
        await p.evaluate("document.querySelector('.fl-canvas').dispatchEvent(new Event('contextrestored'))")
        r['checks'].append(await flowers_check(p,out,label+'-context-restored'))
        # Ensure earlier/final neighbouring scenes and their reverse path remain usable.
        for n in [9,10,11,10,9,8,7,8]:await nav(p,n)
        r['checks'].append(await flowers_check(p,out,label+'-long-return'))
        if not mobile:
            await goto(p,base,6)
            await p.set_viewport_size({'width':390,'height':670});await p.wait_for_timeout(1000);await settled(p,6)
            assert await p.evaluate("document.querySelector('.st-pic video').paused&&!document.querySelector('.st-pic video').hasAttribute('src')")
            await p.set_viewport_size({'width':1280,'height':800});await p.wait_for_timeout(1000);await settled(p,6)
            await p.wait_for_function("document.querySelector('.st-pic video').readyState>=2&&!document.querySelector('.st-pic video').paused",timeout=20000)
        assert not errors,errors
        r['errors']=errors;return r
    except Exception:
        await p.screenshot(path=str(out/(label+'-FAIL.png')))
        try:r['failureState']=await p.evaluate(READ)
        except Exception:pass
        r['errors']=errors;(out/(label+'-failure.json')).write_text(json.dumps(r,indent=2));raise
    finally:await browser.close()
async def main():
    ap=argparse.ArgumentParser();ap.add_argument('--base',default='http://127.0.0.1:8240/mycelial/index.html');ap.add_argument('--out',default='flowers-return-results');args=ap.parse_args();out=Path(args.out);out.mkdir(parents=True,exist_ok=True);reports=[]
    async with async_playwright() as pw:
        for engine,w,h in [('webkit',390,670),('webkit',390,844),('chromium',1280,800)]:
            r=await exercise(pw,engine,w,h,args.base,out);reports.append(r);(out/'results.json').write_text(json.dumps(reports,indent=2));print(engine,w,h,'passed',len(r['checks']),'flower checks',flush=True)
    print('FLOWERS_RETURN_AND_STATIC_STACK_PASSED',flush=True)
if __name__=='__main__':asyncio.run(main())
