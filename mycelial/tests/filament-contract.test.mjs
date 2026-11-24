// Test the actual slide-2 controller with an instrumented DOM and a controllable
// deck clock. The live browser harness separately checks handoffs and paint.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
const source=readFileSync(new URL('../scatter-field.js',import.meta.url),'utf8');
const page=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const marker='// The new filament scene shares the original collage handoff and gap.js snapshot.';
const addon=source.slice(source.indexOf(marker)+marker.length).trim();
const classList=()=>{
  const values=new Set();
  return {add:(...x)=>x.forEach(v=>values.add(v)),remove:(...x)=>x.forEach(v=>values.delete(v)),
    contains:x=>values.has(x),toggle:(x,on)=>on?values.add(x):values.delete(x)};
};
function harness(width,height,{motion=true}={}){
  let time=1000,id=0,quiet=!motion;
  const frames=new Map(),events=[],globalEvents=new Map();
  const bounds=(left,top,w,h)=>({left,top,right:left+w,bottom:top+h,width:w,height:h});
  const bbox=()=>bounds(0,0,width,height);
  const g={setTransform(){},clearRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},fill(){},fillRect(){},arc(){},fillText(){},setLineDash(){},
    createRadialGradient(){return{addColorStop(){}};}};
  const mk=tag=>{
    const selectors=new Map(),listeners=new Map();
    const el={tagName:tag,classList:classList(),style:{setProperty(k,v){this[k]=v;}},dataset:{},attributes:{},
      children:[],append(...items){this.children.push(...items);},
      setAttribute(k,v){this.attributes[k]=v;},addEventListener(k,fn){listeners.set(k,fn);},
      dispatchEvent(e){events.push(e);},emit(k,e={}){listeners.get(k)?.({pointerType:'mouse',preventDefault(){},stopPropagation(){},...e});},
      getBoundingClientRect:bbox,querySelector(sel){if(!selectors.has(sel))selectors.set(sel,mk('span'));return selectors.get(sel);},
      innerHTML:'',textContent:'',offsetWidth:Math.min(306,width-26),offsetHeight:108,contains(){return false;}};
    if(tag==='canvas'){el.getContext=()=>g;el.width=el.height=0;}
    return el;
  };
  const slide=mk('section'),field=mk('div'),dust=mk('canvas'),heading=mk('h1'),footer=mk('footer');
  slide.classList.add('on');heading.getBoundingClientRect=()=>bounds(10,30,width-20,height*.20);
  footer.getBoundingClientRect=()=>bounds(10,height-95,width-20,32);
  slide.querySelector=sel=>sel==='.split h1'?heading:sel==='.ff-conclusion'?footer:null;
  field.closest=()=>slide;field.querySelector=sel=>sel==='.sf-dust'?dust:null;
  field.snapshot=()=>({named:[{x:width*.5,y:height*.5,p:1,r:2,color:'#e0ab5e'}],dust:[]});
  const document={hidden:false,querySelector:()=>field,createElement:mk,getElementById:()=>null,
    addEventListener:(k,fn)=>globalEvents.set(k,fn)};
  const window={deckNow:()=>time,deckStill:()=>quiet};
  runInNewContext(addon,{window,document,performance:{now:()=>time},matchMedia:()=>({matches:false}),
    ResizeObserver:class{observe(){}},devicePixelRatio:1,requestAnimationFrame:f=>{frames.set(++id,f);return id;},
    cancelAnimationFrame:i=>frames.delete(i),addEventListener:(k,fn)=>globalEvents.set(k,fn),console,
    CustomEvent:class{constructor(type,{detail}){this.type=type;this.detail=detail;}}},{filename:'filament-journey',timeout:3000});
  const api=window.FilamentField,surface=field.children.find(x=>x.className==='ff-hits'),note=field.children.find(x=>x.className==='ff-note');
  const tick=ms=>{for(let elapsed=0;elapsed<ms;elapsed+=50){
    time+=50;const batch=[...frames.values()];frames.clear();batch.forEach(fn=>fn(time));}};
  const state=()=>JSON.parse(JSON.stringify(api.state()));
  const hit=(r,s)=>surface.children[r*6+s];
  return {api,field,note,dust,surface,hit,state,tick,events,frames,document,globalEvents,setQuiet:v=>{quiet=v;}};
}
test('preserves artwork sampling, both directions, and chart snapshot contract',()=>{
  for(const pattern of [/const dissolve = \(ctx\) =>/,/const regather = \(ctx\) =>/,/root\.filamentItems = ITEMS\.map/,
    /window\.FilamentField\?\.enter\(/,/window\.FilamentField\?\.exit\(ctx\)/,/window\.FilamentField\?\.restore\(ctx\)/,
    /root\.filamentArtwork=motes\.filter/,/root\.filamentSuppressMotes=!!window\.FilamentField/,/!root\.filamentSuppressMotes \|\| rewind/,
    /const grid = root\.snapshot/,/rewind && m\.grid \? m\.grid : q/,/root\.snapshot=snapshot/])assert.match(source,pattern);
  assert.match(page,/class="slide sf-host ff-layout"/);assert.match(page,/data-gap/);assert.match(page,/\.ff-hit:focus-visible/);
  assert.match(page,/Illustrative journeys/);assert.match(addon,/explicitly illustrative/);
});
for(const [w,h] of [[1280,720],[390,844],[812,375]]){
  test('tight finite grid and usable per-checkpoint hit geometry at '+w+'×'+h,()=>{
    const {api,surface,note}=harness(w,h,{motion:false});api.enter('rest',{rest:true,direct:true});
    assert.equal(api.ready(),true);assert.equal(surface.children.length,60);
    const snap=api.snapshot();assert.equal(snap.named.length,60);assert.equal(snap.dust.length,260);
    for(const p of [...snap.named,...snap.dust]){
      assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));assert.ok(p.x>=0&&p.x<=w);assert.ok(p.y>=0&&p.y<=h);
      assert.match(p.color,/^#[0-9a-f]{6}$/i);
    }
    const v=api.layoutMetrics(),xs=[v.sourceX,...v.gatesX],pitch=(v.dotsBottom-v.dotsTop)/9;
    assert.ok(v.labelY>v.headlineBottom);assert.ok(v.dotsTop-v.headlineBottom<=50);
    assert.ok(v.labelY<v.dotsTop);assert.ok(v.lineBottom<=h);assert.ok(pitch>0);
    for(let s=1;s<6;s++)assert.ok(Math.abs(xs[s]-xs[s-1]-(xs[1]-xs[0]))<1e-6);
    for(let r=0;r<10;r++)for(let s=0;s<6;s++){
      const b=surface.children[r*6+s],p=snap.named[r*6+s];
      assert.equal(+b.dataset.row,r);assert.equal(+b.dataset.stage,s);
      assert.equal(parseFloat(b.style.left),p.x);assert.equal(parseFloat(b.style.top),p.y);
      assert.ok(parseFloat(b.style.height)<pitch);
      assert.ok(parseFloat(b.style.width)<xs[1]-xs[0]);
    }
    assert.ok(note.classList.contains('is-on'));assert.ok(note.classList.contains('is-below'));
    api.exit({to:2});assert.equal(api.snapshot().named.length,60);api.restore({to:1});assert.ok(api.ready());
    api.exit({to:0});assert.equal(api.ready(),false);
  });
}
test('one dot holds, charges, travels horizontally, and is born again only after a terminal stop',()=>{
  const {api,state,tick}=harness(1280,720);api.enter('rest',{direct:true});
  tick(4900);assert.equal(state().phase,'hold');assert.equal(state().step,0);
  tick(150);assert.equal(state().phase,'charge');assert.equal(state().step,0);
  tick(700);assert.equal(state().phase,'travel');assert.equal(state().row,0);
  tick(650);assert.equal(state().step,1);assert.equal(state().phase,'hold');
  tick(5600);assert.equal(state().step,2);assert.equal(state().row,0);
  tick(4950);assert.equal(state().phase,'between');assert.equal(state().row,0);
  tick(400);assert.equal(state().row,1);assert.equal(state().step,0);
});
test('exact hover, unreached cells, pin/unpin and release preserve correct journey',()=>{
  const {api,hit,state,tick,note}=harness(1280,720);api.enter('rest',{direct:true});
  hit(2,1).emit('pointerenter');assert.deepEqual(state().inspection,{r:2,s:1});
  assert.match(note.querySelector('.ff-note-name').textContent,/H3 looping/);
  tick(12000);assert.deepEqual(state().shown,{r:2,s:1});
  hit(2,1).emit('pointerleave');assert.equal(state().inspection,null);assert.equal(state().row,2);assert.equal(state().step,1);
  tick(5600);assert.equal(state().step,2);
  hit(2,5).emit('pointerenter');assert.match(note.querySelector('.ff-note-name').textContent,/never realised/);
  hit(2,5).emit('click');assert.equal(state().pinned,true);
  hit(2,5).emit('pointerleave');assert.deepEqual(state().shown,{r:2,s:5});
  hit(2,5).emit('click');assert.equal(state().pinned,false);assert.equal(state().step,3);
});
test('motion off freezes the tour but manual inspection works; restore and visibility do not reset it',()=>{
  const {api,state,hit,tick,document,globalEvents,setQuiet}=harness(390,844,{motion:false});
  api.enter('rest',{direct:true});tick(15000);assert.equal(state().step,0);
  hit(4,3).emit('click',{pointerType:'touch'});assert.deepEqual(state().inspection,{r:4,s:3});
  api.restore({to:1});assert.deepEqual(state().inspection,{r:4,s:3});
  hit(4,3).emit('click',{pointerType:'touch'});assert.equal(state().step,3);
  setQuiet(false);globalEvents.get('deck-motion')();tick(1000);
  document.hidden=true;globalEvents.get('visibilitychange')();const before=state();tick(10000);
  assert.deepEqual(state(),before);document.hidden=false;globalEvents.get('visibilitychange')();
  tick(5000);assert.equal(state().step,4);
  api.exit({to:2});tick(1200);assert.equal(state().mode,'inactive');assert.equal(state().shown,null);
});
test('successful output emits once on arrival, not from hover or pin',()=>{
  const {api,hit,state,tick,events}=harness(1280,720);api.enter('rest',{direct:true});
  hit(1,4).emit('pointerenter');hit(1,4).emit('pointerleave');
  tick(5600);assert.equal(state().step,5);
  assert.equal(events.filter(e=>e.type==='filament-create').length,1);
  hit(1,5).emit('pointerenter');hit(1,5).emit('click');tick(10000);
  assert.equal(events.filter(e=>e.type==='filament-create').length,1);
});
