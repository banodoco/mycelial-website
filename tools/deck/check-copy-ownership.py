"""Full deck: repeated mobile visits, interruptions, controls and pixel checks.
Requires playwright, Pillow, numpy and installed Chromium/WebKit.
Run against the project server, never a reduced/extracted HTML fixture.
"""
import argparse, asyncio, io, json
from pathlib import Path
import numpy as np
from PIL import Image
from playwright.async_api import async_playwright

READ = """() => {
 const s=document.querySelector('.slide.on'), h=s?.querySelector('h1');
 const roots=s?.matches('.fw-raise')?[s.querySelector(':scope > .split')]:[s?.querySelector(':scope > .split > :first-child'),s?.querySelector(':scope > .fw-stat')].filter(Boolean);
 return {index:window.deckNav?.to,settled:s?.hasAttribute('data-settled'),failed:s?.dataset.deckFailed,
 heading:h?.textContent,box:h?{x:h.getBoundingClientRect().x,y:h.getBoundingClientRect().y,w:h.getBoundingClientRect().width,h:h.getBoundingClientRect().height}:null,
 roots:roots.map(el=>({hidden:el.classList.contains('dt-copy-hidden'),mask:getComputedStyle(el).maskImage||getComputedStyle(el).webkitMaskImage,opacity:getComputedStyle(el).opacity,visibility:getComputedStyle(el).visibility})),
 copy:window.__deckDebug?.copy, capture:window.__deckDebug?.capture};
}"""
async def settled(page,n):
    await page.wait_for_function("n=>window.deckNav?.to===n-1 && document.querySelector('.slide.on')?.hasAttribute('data-settled')", arg=n, timeout=30000)
    state=await page.evaluate(READ)
    assert not state.get('failed'),state
    assert all(not r['hidden'] and r['mask'] in ('none','') and float(r['opacity'])>0 and r['visibility']=='visible' for r in state['roots']),state
    return state
async def pixels(page,out,name):
    # Capture the potentially failing state BEFORE diagnostic reads or style changes.
    first=await page.screenshot(path=str(out/(name+'.png')))
    state=await page.evaluate(READ)
    style=await page.evaluate("() => {const h=document.querySelector('.slide.on h1'); const s=h.getAttribute('style'); h.style.setProperty('visibility','hidden','important'); return s;}")
    try: second=await page.screenshot()
    finally:
        await page.evaluate("s=>{const h=document.querySelector('.slide.on h1'); if(s===null)h.removeAttribute('style');else h.setAttribute('style',s);}",style)
    a=np.array(Image.open(io.BytesIO(first)).convert('RGB')).astype(int)
    b=np.array(Image.open(io.BytesIO(second)).convert('RGB')).astype(int)
    box=state['box']; x=max(0,int(box['x'])); y=max(0,int(box['y'])); x2=min(a.shape[1],int(box['x']+box['w'])+1); y2=min(a.shape[0],int(box['y']+box['h'])+1)
    crop=a[y:y2,x:x2];delta=np.max(np.abs(crop-b[y:y2,x:x2]),axis=2)
    ink=int(np.count_nonzero((delta>20)&(crop[:,:,0]>100)&(crop[:,:,1]>70)))
    assert ink>80,{'name':name,'painted_pixels':ink,'state':state}
    return {'name':name,'painted_pixels':ink,'state':state}
async def goto(page,base,n):
    await page.goto(base+'?debug#'+str(n),wait_until='domcontentloaded')
    await page.evaluate('document.fonts.ready')
    return await settled(page,n)
async def exercise(engine,name,base,baseline,out,width,height,mobile):
    browser=await engine.launch(headless=True)
    context=await browser.new_context(viewport={'width':width,'height':height},device_scale_factor=1,is_mobile=mobile,has_touch=mobile)
    await context.add_init_script('let testSeed=6384; Math.random=()=>{testSeed=(testSeed*16807)%2147483647;return(testSeed-1)/2147483646;};')
    page=await context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    results=[]
    try:
        for n in [9,10,11]:
            current=await goto(page,base,n)
            await page.wait_for_timeout(700)
            results.append(await pixels(page,out,f'{name}-{width}-direct-{n}'))
            if baseline:
                other=await context.new_page();old=await goto(other,baseline,n);await other.close()
                for key in ['x','y','w','h']:assert abs(current['box'][key]-old['box'][key])<1.1,{'candidate':current['box'],'baseline':old['box']}
        await goto(page,base,9)
        for round_ in range(3):
            for n in [10,11,10,9]:
                old=await page.evaluate('window.deckNav.to+1');await page.keyboard.press('ArrowRight' if n>old else 'ArrowLeft')
                for delay in [180,350,600]:
                    await page.wait_for_timeout(delay)
                    if round_==0:await page.screenshot(path=str(out/f'{name}-{width}-{old}-{n}-{delay}.png'))
                await settled(page,n);await page.wait_for_timeout(500)
                results.append(await pixels(page,out,f'{name}-{width}-revisit-{round_}-{n}'))
        # Supersede the shared scene while incoming text is hidden or partial.
        for delay in [80,350,900]:
            await goto(page,base,9);await page.keyboard.press('ArrowRight');await page.wait_for_timeout(delay)
            await page.keyboard.press('ArrowLeft');await settled(page,9)
            await page.wait_for_timeout(1000);results.append(await pixels(page,out,f'{name}-{width}-interrupt-{delay}'))
        await page.keyboard.press('ArrowRight');await page.wait_for_timeout(220)
        await page.set_viewport_size({'width':width,'height':height-80});await settled(page,10)
        results.append(await pixels(page,out,f'{name}-{width}-resize'))
        await page.set_viewport_size({'width':height,'height':width});await page.wait_for_timeout(700);await settled(page,10)
        results.append(await pixels(page,out,f'{name}-{width}-orientation'))
        await page.set_viewport_size({'width':width,'height':height});await page.wait_for_timeout(700)
        await page.keyboard.press('ArrowRight');await settled(page,11)
        q=page.locator('.slide.on .fw-ask-q').first
        await q.click();assert await q.get_attribute('aria-expanded')=='true'
        await page.keyboard.press('Escape');assert await q.get_attribute('aria-expanded')=='false'
        await page.evaluate("localStorage.setItem('deck-motion','off')")
        await goto(page,base,11);results.append(await pixels(page,out,f'{name}-{width}-motion-off'))
        await page.evaluate("localStorage.removeItem('deck-motion')")
        if name=='chromium' and not mobile:
            for n in range(1,9):await goto(page,base,n)
        assert not errors,errors
        return {'engine':name,'viewport':[width,height],'checks':len(results),'results':results,'errors':errors}
    finally:await browser.close()
async def main():
    p=argparse.ArgumentParser();p.add_argument('--base',default='http://127.0.0.1:8240/mycelial/index.html');p.add_argument('--baseline');p.add_argument('--out',default='copy-owner-results');args=p.parse_args()
    out=Path(args.out);out.mkdir(parents=True,exist_ok=True);reports=[]
    async with async_playwright() as pw:
        for name,width,height,mobile in [('chromium',1280,800,False),('chromium',390,844,True),('webkit',390,844,True)]:
            report=await exercise(getattr(pw,name),name,args.base,args.baseline,out,width,height,mobile)
            reports.append(report);(out/'results.json').write_text(json.dumps(reports,indent=2));print(json.dumps({k:report[k] for k in ['engine','viewport','checks','errors']}),flush=True)
    print('FULL_DECK_COPY_OWNER_PASSED',flush=True)
if __name__=='__main__':asyncio.run(main())
