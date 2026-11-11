// Production renderer and controller excerpts; real-browser coverage is separate.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import test from 'node:test';
import vm from 'node:vm';
const source=readFileSync(new URL('../mycelial/dot-transitions.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../mycelial/index.html',import.meta.url),'utf8');
const section=(a,b)=>{const start=source.indexOf(a),end=source.indexOf(b,start+a.length);assert.ok(start>=0&&end>start,a);return source.slice(start,end);};
class Element {
  constructor(classes='',parent=null){
    this.classes=new Set(classes.split(/\s+/).filter(Boolean));this.parent=parent;this.children=[];this.props={};this.writes=[];this.removed=false;
    if(parent)parent.children.push(this);
    const alias={'mask-image':'maskImage','-webkit-mask-image':'webkitMaskImage'};
    this.style=new Proxy({
      setProperty:(k,v)=>{this.props[alias[k]||k]=String(v);this.writes.push([k,v]);},
      getPropertyValue:k=>this.props[alias[k]||k]||'',
      removeProperty:k=>{delete this.props[alias[k]||k];this.writes.push([k,'']);}
    },{get:(o,k)=>k in o?o[k]:this.props[k]||'',set:(_,k,v)=>{this.props[k]=String(v);this.writes.push([k,v]);return true;}});
    this.classList={contains:k=>this.classes.has(k),add:(...ks)=>ks.forEach(k=>this.classes.add(k)),remove:(...ks)=>ks.forEach(k=>this.classes.delete(k)),toggle:(k,v)=>{v??=!this.classes.has(k);v?this.classes.add(k):this.classes.delete(k);return v;}};
  }
  matches(s){return s.split(',').some(v=>v.trim().split('.').filter(Boolean).every(k=>this.classes.has(k)));}
  closest(s){return this.matches(s)?this:this.parent?.closest(s)||null;}
  hasAttribute(k){return k==='data-settled'&&!!this.settled;}
  querySelector(s){return this.querySelectorAll(s)[0]||null;}
  querySelectorAll(s){return this.children.flatMap(c=>[...(c.matches(s)?[c]:[]),...c.querySelectorAll(s)]);}
  getBoundingClientRect(){return {left:24,top:170,width:342,height:180,right:366,bottom:350};}
  remove(){this.removed=true;}
}
function fixture(debug=false){
  const slides=[9,10,11].map(n=>{
    const s=new Element('slide fw-host'+(n===11?' fw-raise':''));
    const root=new Element(n===11?'split':'',s),heading=new Element('heading',root);
    s.roots=[root];s.heading=heading;s.controls=n===11?new Element('fw-asks',root):null;
    if(n===9)s.roots.push(new Element('fw-stat',s));return s;
  });
  let id=0,generation=0;const timers=new Map(),overlays=new Map(),masks=new WeakMap(),recoveries=[];
  const context={console,slides,overlays,masks,SOFT:150,put:{x:NaN},textOf:s=>s.roots,
    clamp:(v,lo=0,hi=1)=>Math.min(hi,Math.max(lo,v)),anchorOf:()=>({x:120,y:120}),
    getComputedStyle:el=>({maskImage:el.style.maskImage,opacity:'1',visibility:'visible',transform:'none'}),
    window:{__deckDebug:debug?{}:undefined,deckNav:null,deckCancelLater:h=>timers.delete(h),deckLater:(fn,ms,ctx)=>{const h=++id;timers.set(h,{fn,ms,ctx});return h;},deckTransaction:(reason,ctx)=>{recoveries.push(reason);ctx.close();api.copy.reconcile(ctx);}},
    overlayFor:el=>{if(!overlays.has(el))overlays.set(el,new Element());return overlays.get(el);}
  };
  vm.createContext(context);
  vm.runInContext([
    section('  const stableCopy =','  const lines ='),
    section('  const copyTrace =','  // Keep the real copy'),
    section('  const paintCopy =','  // These forward arrivals'),
    'this.api={copy,copyStates,copyTrace,cancelOverlay,paintCopy,removeOverlay};'
  ].join('\n'),context);
  const api=context.api;
  function navigate(to,from=null){
    const disposers=[];
    const ctx={generation:++generation,to,from,terminal:false,
      isCurrent:()=>context.window.deckNav===ctx,
      isTransitionCurrent:()=>context.window.deckNav===ctx&&!ctx.terminal,
      transitionDefer:fn=>{disposers.push(fn);return ()=>{};},
      close(){this.terminal=true;disposers.forEach(f=>f());}
    };
    context.window.deckNav=ctx;slides.forEach((s,i)=>s.classList.toggle('on',i===to));return ctx;
  }
  return {...api,context,slides,timers,overlays,masks,recoveries,navigate};
}
const origin={x:120,y:120};
// Wheel copy is revealed by ink on its real nodes: no mask, clone or visibility class ever touches them.
const unmasked=root=>!root.classList.contains('dt-copy-hidden')&&!root.style.maskImage&&!root.style.webkitMaskImage;
const ink=root=>root.classList.contains('fw-spreading')?root.style.getPropertyValue('--fw-outer'):'';
const clean=root=>unmasked(root)&&!root.classList.contains('fw-spreading')&&!ink(root);
const inkless=root=>unmasked(root)&&ink(root)==='0.0px';
for(const [i,n] of [9,10,11].entries()){
  test(`slide ${n}: claims and inks its original nodes, never masks or clones`,()=>{
    const f=fixture(),ctx=f.navigate(i),s=f.slides[i],state=f.copy.hide(s,ctx,origin);
    for(const root of s.roots){assert.ok(inkless(root));assert.equal(f.copy.paint(root,origin,180,null,state),true);assert.equal(ink(root),'180.0px');assert.ok(unmasked(root));assert.equal(f.overlays.size,0);}
    assert.equal(f.copy.liveCloneCount,0);assert.equal(f.copy.show(s,ctx,state),true);
    s.roots.forEach(r=>{assert.ok(clean(r));assert.equal(r.removed,false);});assert.equal(f.overlays.size,0);
  });
  test(`slide ${n}: leaving hidden text does not show it`,()=>{
    const f=fixture(),ctx=f.navigate(i),s=f.slides[i],state=f.copy.hide(s,ctx,origin);
    ctx.close();
    assert.equal(state.phase,'interrupted');assert.ok(s.roots.every(inkless));
  });
  test(`slide ${n}: interruption preserves partial reveal for its successor`,()=>{
    const f=fixture(),ctx=f.navigate(i),s=f.slides[i],state=f.copy.hide(s,ctx,origin);
    s.roots.forEach(r=>f.copy.paint(r,origin,180,null,state));const before=s.roots.map(ink);
    ctx.close();assert.deepEqual(s.roots.map(ink),before);assert.ok(before.every(v=>v==='180.0px'));
    const next=f.navigate((i+1)%3,i),out=f.copy.gather(s,next);
    for(const root of s.roots){const saved=f.masks.get(root);assert.equal(saved.r,180);assert.equal(f.copy.paint(root,saved.at,saved.r,null,out),true);}
    assert.deepEqual(s.roots.map(ink),before);
    assert.equal(f.copy.reconcile(next),true);assert.ok(f.slides[next.to].roots.every(clean));
    assert.ok(s.roots.every(inkless));assert.equal(f.overlays.size,0);
  });
}
test('obsolete navigation cannot hide, paint, show, retire, or reconcile current text',()=>{
  const f=fixture(),old=f.navigate(0),s=f.slides[0],first=f.copy.hide(s,old,origin);
  old.close();const next=f.navigate(0,1),fresh=f.copy.hide(s,next,origin);
  f.copy.paint(s.roots[0],origin,240,null,fresh);const mask=ink(s.roots[0]);assert.equal(mask,'240.0px');
  assert.equal(f.copy.hide(s,old,origin),null);assert.equal(f.copy.paint(s.roots[0],origin,0,null,first),false);
  assert.equal(f.copy.show(s,old,first),false);assert.equal(f.copy.retire(s,old),false);assert.equal(f.copy.reconcile(old),false);
  assert.equal(ink(s.roots[0]),mask);assert.equal(f.copyStates.get(s),fresh);
});
test('a superseded state token cannot paint even within the same navigation',()=>{
  const f=fixture(),ctx=f.navigate(1,0),s=f.slides[0];const first=f.copy.gather(s,ctx),second=f.copy.gather(s,ctx);
  assert.equal(f.copy.paint(s.roots[0],origin,200,null,first),false);assert.equal(f.copy.paint(s.roots[0],origin,200,null,second),true);
  f.cancelOverlay(s,first);assert.equal(second.phase,'gathering');
});
test('selected state and visibility are not interchangeable endpoints',()=>{
  const f=fixture(),ctx=f.navigate(1,0);
  assert.equal(f.copy.show(f.slides[0],ctx),false);assert.equal(f.copy.retire(f.slides[1],ctx),false);
  assert.equal(f.copy.hide(f.slides[0],ctx),null);
});
test('successful visible endpoint is not undone by transition closure',()=>{
  const f=fixture(),ctx=f.navigate(1),s=f.slides[1],state=f.copy.hide(s,ctx,origin);
  f.copy.show(s,ctx,state);ctx.close();assert.equal(f.copyStates.get(s).phase,'shown');assert.ok(s.roots.every(clean));
  assert.equal(f.copy.paint(s.roots[0],origin,0,null,state),false);
});
test('deadline delegates failure recovery to the terminal transaction',()=>{
  const f=fixture(),ctx=f.navigate(2),s=f.slides[2];f.copy.hide(s,ctx,origin,900);
  const callback=[...f.timers.values()][0].fn;callback();
  assert.deepEqual(f.recoveries,['recover']);assert.equal(ctx.terminal,true);assert.ok(s.roots.every(clean));assert.equal(f.timers.size,0);
});
test('a reveal already running gets real frames to land before its deadline replaces it',()=>{
  const f=fixture(),ctx=f.navigate(2),s=f.slides[2],state=f.copy.hide(s,ctx,origin,900);
  state.phase='revealing';s.roots.forEach(r=>f.copy.paint(r,origin,300,null,state));
  const [handle,first]=[...f.timers.entries()][0];f.timers.delete(handle);first.fn();
  assert.deepEqual(f.recoveries,[]);assert.equal(f.timers.size,1);assert.equal(ink(s.roots[0]),'300.0px');
  // The reveal lands by itself inside the grace: the pending recovery is cancelled, never run.
  assert.equal(f.copy.show(s,ctx,state),true);assert.equal(f.timers.size,0);assert.ok(s.roots.every(clean));
  // One that never lands is still recovered, once.
  const g=fixture(),c2=g.navigate(2),s2=g.slides[2],st2=g.copy.hide(s2,c2,origin,900);st2.phase='revealing';
  const [h2,t2]=[...g.timers.entries()][0];g.timers.delete(h2);t2.fn();[...g.timers.values()][0].fn();
  assert.deepEqual(g.recoveries,['recover']);assert.ok(s2.roots.every(clean));
});
test('stale deadlines and disposers cannot alter a newer visit',()=>{
  const f=fixture(),ctx=f.navigate(0),s=f.slides[0];f.copy.hide(s,ctx,origin,900);const late=[...f.timers.values()][0].fn;
  const next=f.navigate(0,1),state=f.copy.hide(s,next,origin);f.copy.paint(s.roots[0],origin,111,null,state);
  ctx.close();late();assert.equal(f.recoveries.length,0);assert.equal(f.masks.get(s.roots[0]).r,111);
});
test('terminal reconciliation clears abandoned third-slide and orphaned surfaces',()=>{
  const f=fixture();for(const i of [0,1,2]){const ctx=f.navigate(i);f.copy.hide(f.slides[i],ctx,origin);ctx.close();}
  const orphan=new Element(),surface=new Element();f.overlays.set(orphan,surface);
  const ctx=f.context.window.deckNav;assert.equal(f.copy.reconcile(ctx),true);
  assert.equal(f.overlays.size,0);assert.equal(surface.removed,true);assert.equal(orphan.removed,false);
  f.slides.forEach((s,i)=>s.roots.forEach(r=>assert.ok(i===2?clean(r):inkless(r))));
});
test('repeated visits preserve node identity, questions, and clean endpoints',()=>{
  const f=fixture();let previous=null;
  const headings=f.slides.map(s=>s.heading),controls=f.slides[2].controls;
  for(let round=0;round<20;round++)for(const i of [0,1,2,1,0]){
    previous?.close();const ctx=f.navigate(i,previous?.to??null),s=f.slides[i],state=f.copy.hide(s,ctx,origin);
    for(const radius of [0,30,150,500])s.roots.forEach(r=>f.copy.paint(r,origin,radius,null,state));
    assert.equal(f.copy.show(s,ctx,state),true);ctx.close();f.copy.reconcile(ctx);
    assert.ok(s.roots.every(clean));assert.equal(f.overlays.size,0);assert.equal(f.slides[2].controls,controls);
    assert.deepEqual(f.slides.map(s=>s.heading),headings);assert.ok(s.roots.every(r=>!r.style.transform));previous=ctx;
  }
});
test('debug traces stay bounded and no ownership timers survive reconciliation',()=>{
  const f=fixture(true);for(let i=0;i<120;i++){const ctx=f.navigate(i%3);f.copy.hide(f.slides[i%3],ctx,origin,900);ctx.close();f.copy.reconcile(ctx);}
  assert.equal(f.copyTrace.length,96);assert.equal(f.timers.size,0);assert.equal(f.overlays.size,0);
});
test('no registry-driven endpoint or CSS force-visible escape hatch remains',()=>{
  const finish=section('  const finishNetwork =','  let anchor =');
  assert.doesNotMatch(finish,/copy\.show|copy\.retire|overlays\.keys/);
  assert.doesNotMatch(html,/\.slide\.on\[data-settled\] > \.fw-stat \{ mask-image/);
  assert.match(html,/\.fw-raise\.on:has\(\.fw-ask\.is-open\) > \.split > :first-child \{ opacity: \.2;/);
  assert.match(html,/\.slide\.fw-raise\.on \.fw-asks \{ opacity: var\(--fw-reveal-alpha, 1\); visibility: visible; transition: none;/);
  // The wheel's real copy is never masked: only a disposable clone can be.
  assert.doesNotMatch(source,/liveCopy|overlays\.set\(el, surface\)/);assert.match(html,/\.fw-host \.fw-spreading h1 em,/);
});
test('renderer, coordinates, final grouping and reveal duration remain the restored version',()=>{
  const hash=s=>createHash('sha256').update(s).digest('hex');
  assert.equal(hash(section('  const textOf =','  const place = (p)')),'09188a673d65a59b6fb7c657a56f9ce2a61619b5be9a18746a749649811dcba0');
  assert.equal(hash(section('  const copyExtra =','  const textTweens =')),'3c7effaf0a5d40f096a2cf4ae6e3505846c6e842a0b90f9c5bb71528ada1d18e');
  assert.match(source,/const GATHER = 400;/);assert.match(source,/const SOFT = 150;/);
  assert.match(source,/const x = at\.x - b\.left, y = at\.y - b\.top;/);
});
