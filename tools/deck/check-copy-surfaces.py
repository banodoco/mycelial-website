"""Offline Chromium paint checks of real production copy functions.
Representative layouts/fallback fonts, NOT the full flywheel application or iOS.
"""
from pathlib import Path
import io,json,hashlib
import numpy as np
from PIL import Image
from playwright.sync_api import sync_playwright
import argparse,subprocess,shutil
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--baseline-file',type=Path)
parser.add_argument('--baseline-ref',default='d1f24f5063d72397c5f60eae42b89ea7f57b10e5')
parser.add_argument('--chromium',default=shutil.which('chromium'))
parser.add_argument('--out',type=Path,default=Path('/tmp/mycelial-copy-surfaces'))
args=parser.parse_args()
ROOT=Path(__file__).resolve().parents[2]
OUT=args.out; OUT.mkdir(parents=True,exist_ok=True)
baseline=args.baseline_file.read_text() if args.baseline_file else subprocess.check_output(['git','show',f'{args.baseline_ref}:mycelial/dot-transitions.js'],cwd=ROOT,text=True)
sources={'baseline':baseline,'candidate':(ROOT/'mycelial/dot-transitions.js').read_text()}
def cut(s,a,b):
 i=s.index(a); return s[i:s.index(b,i+len(a))]
def boot(src):
 return '''const slides=[...document.querySelectorAll('.slide')];
const SOFT=150,masks=new WeakMap(),overlays=new Map(),put={x:NaN,y:NaN};let visit=null;
const clamp=(v,lo=0,hi=1)=>Math.min(hi,Math.max(lo,v));
const columnOf=s=>s.querySelector(':scope > .split > :first-child');
const textOf=s=>[s.matches('.fw-raise')?s.querySelector(':scope > .split'):columnOf(s),s.querySelector(':scope > .fw-stat')].filter(Boolean);
const anchorOf=s=>{let r=columnOf(s).querySelector('.num').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top-13}};
const stopText=()=>{};const overlayFor=()=>{throw Error('unexpected clone')};
window.deckLater=(fn,ms,ctx)=>setTimeout(()=>{if(ctx.isCurrent())fn()},ms);window.deckCancelLater=clearTimeout;
window.__deckDebug={};
'''+cut(src,'  const stableCopy =','  const lines =')+(cut(src,'  const copyTrace =','  const removeOverlay =') if '  const copyTrace =' in src else 'const copyTrace=[];')+cut(src,'  const removeOverlay =','  // Keep the real copy')+cut(src,'  const paintCopy =','  // These forward arrivals')+cut(src,'  const finishNetwork =','  let anchor =')+'''
let generation=0,ctx;
const context=(to)=>{const releases=[];return {generation:++generation,to,terminal:false,live:true,transitionDefer:f=>releases.push(f),isCurrent(){return this.live},close(){this.terminal=true;releases.forEach(f=>f())}}};
window.inspect=()=>({surfaces:overlays.size,clones:copy.liveCloneCount,roots:slides.map(s=>textOf(s).map(e=>({mask:e.style.maskImage,hidden:e.classList.contains('dt-copy-hidden'),connected:e.isConnected,box:{x:e.getBoundingClientRect().x,y:e.getBoundingClientRect().y}})))});
window.prepare=(from,to)=>{
 slides.forEach((s,i)=>{s.classList.toggle('on',i===to);s.toggleAttribute('data-present',i===from);s.removeAttribute('data-settled');copy.show(s)});
 ctx=context(to);window.deckNav=ctx;
 return inspect();
};
window.frame=(from,to,q)=>{
 const out=slides[from],dest=slides[to];
 if(q!=='settled')for(const [s,incoming] of [[out,false],[dest,true]]){
  const at=anchorOf(s);
  textOf(s).forEach(e=>{const p=incoming ? .5-.5*Math.cos(Math.PI*q) : 1-q*q*(3-2*q)*q;copy.paint(e,at,p*reach(e,at))});
 }
 if(q==='settled'){copy.retire(out);copy.show(dest);out.removeAttribute('data-present');dest.setAttribute('data-settled','');}
 return inspect();
};
window.cleanupProbe=(i)=>{prepare(i,i);slides.forEach(s=>s.removeAttribute('data-present'));const s=slides[i];textOf(s).forEach(e=>copy.paint(e,anchorOf(s),0));finishNetwork(ctx);return inspect()};
window.revisit=()=>{
 let old;for(let round=0;round<12;round++)for(const i of [0,1,2,1,0]){
  const c=context(i);window.deckNav=c;slides.forEach((s,j)=>{s.classList.toggle('on',i===j);s.removeAttribute('data-settled');s.removeAttribute('data-present')});
  const s=slides[i],state=copy.hide(s,c,anchorOf(s));textOf(s).forEach(e=>copy.paint(e,anchorOf(s),90));
  if(old){old.live=false;old.close()}
  copy.show(s);finishNetwork(c);s.setAttribute('data-settled','');
  for(const e of textOf(s))if(!e.isConnected||e.style.maskImage||e.classList.contains('dt-copy-hidden'))throw Error('unclean revisit');
  old=c;
 }
 return inspect();
};
'''
css='''html,body{margin:0;background:#0d0a07;color:#efe6d6;height:100%;overflow:hidden}
.slide{position:absolute;inset:0;padding:0 24px 84px;display:flex;flex-direction:column;justify-content:flex-end;box-sizing:border-box;text-align:center}
.slide:not(.on):not([data-present]){visibility:hidden}.dt-copy-hidden,.dt-copy-hidden *{visibility:hidden!important}
.split{display:grid;grid-template-columns:minmax(0,1fr);justify-items:center;position:relative;row-gap:.65rem}
h1{font:400 22px/1.08 Georgia,serif;max-width:20ch;margin:0 auto;letter-spacing:-.005em;text-wrap:balance}
h1 em{font-style:italic;font-weight:500;background:linear-gradient(176deg,#fbe7bd,#f0c67e 38%,#d99a4a 70%,#b9772f);background-clip:text;-webkit-background-clip:text;color:transparent;padding:0 .06em .08em 0}
.num{font:italic 400 16px/1 Georgia,serif;color:#e0ab5e;letter-spacing:.08em;margin-bottom:1.1rem}
.act{color:#b8a98f;font-style:normal;margin-left:.8em;opacity:.7}
.fw-sub{color:#b8a98f;font:15.2px/1.4 Georgia,serif;margin:.7rem auto 0;max-width:17em}
.fw-top{justify-content:flex-start;padding:52px 24px 0}.fw-raise{justify-content:center;padding:60px 24px 80px}
.fw-stat{position:absolute;top:24px;left:0;right:0;color:#b8a98f;font:16px/1.3 Georgia,serif}
.fw-stat b{color:#ecc57e}.fw-stat a{color:#f0c67e}
.fw-asks{display:grid;grid-template-columns:1fr 1fr;gap:8px}.fw-asks button{background:#120e0ac2;border:1px solid #f0c87740;border-radius:99px;color:#c8b591;padding:12px;font:11px sans-serif}.fw-asks button:last-child{grid-column:1 / 3;justify-self:center}
.slide.on[data-settled] > .split > :first-child,.slide.fw-raise.on[data-settled] > .split,.slide.on[data-settled] > .fw-stat{mask-image:none!important;-webkit-mask-image:none!important;visibility:visible!important}
@media(min-width:761px){h1{font-size:38px;max-width:27em}.fw-raise h1{max-width:20em}.fw-asks{display:flex}.fw-stat{font-size:20px}}
'''
texts=[('The community','Astrid launches into a community we’ve spent years cultivating — and is designed to accelerate ','its collective creative flywheel.'),('How we accelerate it','Our initiatives give the ecosystem the tools, energy and incentives to ','create more and think bigger.'),('The raise','Join us: we’re raising $1M from angels and small funds ','who want the open ecosystem to win.')]
def html(src):
 sections=[]
 for i,(label,plain,em) in enumerate(texts):
  cl=['','fw-top','fw-raise'][i];sub='<p class="fw-sub">We believe a thriving open-source ecosystem can profoundly improve humanity’s relationship with AI.</p>' if i==2 else ''
  stat='<p class="fw-stat"><b>23,932</b> people · Banodoco Discord · <a>Join →</a></p>' if i==0 else ''
  asks='<div class="fw-asks"><button>Behind it +</button><button>The goal +</button><button>The round +</button></div>' if i==2 else ''
  sections.append(f'<section class="slide fw-host {cl}">{stat}<div class="split"><div><div class="num">{i+9:02}<span class="act">{label}</span></div><h1>{plain}<em>{em}</em></h1>{sub}</div>{asks}</div></section>')
 return '<html><style>'+css+'</style>'+''.join(sections)+'<script>'+boot(src)+'</script></html>'
results={'scope':'Production copy functions in reduced layouts, not full deck or native iOS','parity':[],'cleanup':[],'revisits':[]}
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=args.chromium,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 results['browser']=b.version
 pages={name:b.new_page(viewport={'width':390,'height':844},device_scale_factor=1) for name in sources}
 for name,page in pages.items():page.set_content(html(sources[name]))
 for w,h in [(320,568),(390,844),(430,932),(844,390),(1280,800)]:
  for page in pages.values():page.set_viewport_size({'width':w,'height':h})
  for fr,to in [(0,1),(1,2),(2,1),(1,0)]:
   for page in pages.values():page.evaluate('([f,t])=>prepare(f,t)',[fr,to])
   for q in [0,.15,.4,.7,1,'settled']:
    images={}
    for name,page in pages.items():
     page.evaluate('([f,t,q])=>frame(f,t,q)',[fr,to,q]);images[name]=page.screenshot()
    a=np.array(Image.open(io.BytesIO(images['baseline'])).convert('RGB'));d=np.array(Image.open(io.BytesIO(images['candidate'])).convert('RGB'))
    diff=int(np.count_nonzero(np.any(a!=d,axis=2)))
    results['parity'].append({'size':[w,h],'from':fr+9,'to':to+9,'q':q,'differentPixels':diff})
    assert diff==0,results['parity'][-1]
    if (w,h)==(390,844) and (fr,to)==(0,1) and q in [.4,'settled']:(OUT/f'parity-9-10-{q}.png').write_bytes(images['candidate'])
  for name,page in pages.items():
   state=page.evaluate('revisit()');assert state['surfaces']==0
   results['revisits'].append({'name':name,'size':[w,h],'visits':60,'clean':True})
  # Real-browser terminal cleanup probe: registered surfaces must be finalized.
  for name,page in pages.items():
   state=page.evaluate('cleanupProbe(0)');image=page.screenshot();arr=np.array(Image.open(io.BytesIO(image)).convert('RGB'),dtype=np.int16)
   ink=int(np.maximum(arr-np.array([13,10,7]),0).sum())
   results['cleanup'].append({'name':name,'size':[w,h],'ink':ink,'state':state})
   if name=='candidate':assert ink>0 and state['surfaces']==0 and not state['roots'][0][0]['mask']
   else:assert ink==0 and state['roots'][0][0]['mask']
   if w==390:(OUT/f'cleanup-{name}.png').write_bytes(image)
 b.close()
(OUT/'browser.json').write_text(json.dumps(results,indent=2))
print(json.dumps({'browser':results['browser'],'identicalFrames':len(results['parity']),'revisitSequences':len(results['revisits']),'cleanupCases':len(results['cleanup']),'scope':results['scope']}))
