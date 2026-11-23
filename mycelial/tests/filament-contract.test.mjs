// Slide 2's filament field lives inside scatter-field.js so the old artwork and
// the slide-three snapshot stay on the same navigation and rendering contract.
// Run from repository root: node --test mycelial/tests/filament-contract.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
const source = readFileSync(new URL('../scatter-field.js', import.meta.url), 'utf8');
const page = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const marker = '// The new filament scene shares the original collage handoff and gap.js snapshot.';
const addon = source.slice(source.indexOf(marker) + marker.length).trim();
const classList = () => {
  const classes = new Set();
  return { add: x => classes.add(x), remove: x => classes.delete(x),
    contains: x => classes.has(x), toggle: (x, yes) => yes ? classes.add(x) : classes.delete(x) };
};
function harness(width,height) {
  const bbox = () => ({ left:0, top:0, right:width, bottom:height, width, height });
  const g = {
    setTransform(){}, clearRect(){},save(){},restore(){},beginPath(){},
    moveTo(){},lineTo(){},stroke(){},fill(){},fillRect(){},arc(){},fillText(){},
    createRadialGradient(){return{addColorStop(){}};},
    createLinearGradient(){return{addColorStop(){}};}
  };
  const mk = tag => {
    const el = { tagName:tag, classList:classList(), style:{},dataset:{},
      children:[],append(...items){this.children.push(...items);},
      setAttribute(){},addEventListener(){},getBoundingClientRect:bbox,
      querySelector(){return mk('span');},innerHTML:'' };
    if(tag==='canvas'){ el.getContext=()=>g;el.width=el.height=0; }
    return el;
  };
  const slide=mk('section'),dust=mk('canvas'),field=mk('div');
  field.closest=()=>slide;
  field.querySelector=sel=>sel==='.sf-dust'?dust:null;
  field.filamentItems=Array.from({length:64},(_,i)=>['model','Model','Capability '+i,'Description '+i]);
  field.snapshot=()=>({named:[{x:width*.5,y:height*.5,p:1,r:2,color:'#e0ab5e'}],dust:[]});
  const document={hidden:false,querySelector:()=>field,createElement:mk,
    getElementById:()=>null,addEventListener(){}};
  const window={deckNow:()=>1000,deckStill:()=>true,addEventListener(){}};
  runInNewContext(addon,{
    window,document,performance:{now:()=>1000},matchMedia:()=>({matches:false}),
    ResizeObserver:class{observe(){}},devicePixelRatio:1,
    requestAnimationFrame:()=>1,cancelAnimationFrame(){},addEventListener(){},console,
  },{filename:'filament-scene',timeout:3000});
  return {api:window.FilamentField,field,dust};
}
test('keeps original collage/gallery, three-to-four story, and resource mapping',()=>{
  assert.match(source,/const dissolve = \(ctx\) =>/);
  assert.match(source,/const regather = \(ctx\) =>/);
  assert.match(source,/root\.filamentItems = ITEMS\.map/);
  assert.match(source,/window\.FilamentField\?\.enter\(/);
  assert.match(source,/window\.FilamentField\?\.exit\(ctx\)/);
  assert.match(source,/window\.FilamentField\?\.restore\(ctx\)/);
  assert.match(source,/root\.snapshot = snapshot/);
  assert.match(page,/class="slide sf-host ff-layout"/);
  assert.match(page,/data-gap/);
  assert.match(page,/\.ff-hit:focus-visible/);
  assert.match(addon,/e\.stopPropagation\(\);inspect\(i,true\)/);
});
for(const [w,h] of [[1280,720],[390,844],[812,375]]){
  test('finite and in-bounds coordinates at '+w+'×'+h,()=>{
    const {api,field}=harness(w,h);
    assert.ok(api);
    api.enter('rest',{rest:true,direct:true});
    assert.equal(api.ready(),true);
    const snap=api.snapshot();
    assert.equal(snap.named.length,42);
    assert.equal(snap.dust.length,260);
    assert.equal(field.children.filter(x=>x.className==='ff-hits').length,1);
    for(const dot of [...snap.named,...snap.dust]){
      assert.ok(Number.isFinite(dot.x)&&Number.isFinite(dot.y));
      assert.ok(dot.x>=0&&dot.x<=w,'x out of viewport: '+dot.x);
      assert.ok(dot.y>=0&&dot.y<=h,'y out of viewport: '+dot.y);
      assert.match(dot.color,/^#[0-9a-fA-F]{6}$/);
    }
    api.exit({to:2});
    assert.equal(api.snapshot().named.length,42);
    api.restore({to:1});
    assert.equal(api.ready(),true);
    api.exit({to:0});
  });
}
test('barrier assignment is deterministic, not misrepresented as an empirical funnel',()=>{
  for(const name of ['DISCOVERED','SET UP','OPTIMISED','CREATED'])
    assert.ok(addon.includes("'"+name+"'"));
  assert.match(addon,/Visual attrition is illustrative/);
  assert.match(addon,/const hash=/);
  assert.doesNotMatch(addon,/Math\.random\(/);
});

test('sampled artwork is passed to the new entrance without outward-starfield duplicates',()=>{
  assert.match(source,/root\.filamentArtwork=motes\.filter/);
  assert.match(source,/root\.filamentSuppressMotes=!!window\.FilamentField/);
  assert.match(source,/!root\.filamentSuppressMotes \|\| rewind/);
  assert.match(addon,/artwork=m==='enter-collage'&&Array\.isArray\(root\.filamentArtwork\)/);
  assert.match(addon,/const dest=position\(strand,/);
});
test('stages, hovered paths and Create bursts respect their destination',()=>{
  assert.match(addon,/g\.fillText\('REQUIRED',needX,labelY\)/);
  assert.match(addon,/g\.fillText\(gates\[j\]\[0\],x,labelY\)/);
  assert.match(addon,/const labelY=headlineBottom\+/);
  assert.doesNotMatch(addon,/a world of possibilities|only a fraction reaches the artist/);
  assert.match(addon,/const terminal=strand=>/);
  assert.match(addon,/const partial=clamp\(head\*5-j\)/);
  assert.match(addon,/if\(success&&time>=\.82\)/);
});
test('source-dot spacing is uniform on desktop and mobile',()=>{
  for(const [w,h] of [[1280,720],[390,844],[812,375]]){
    const {api,field}=harness(w,h);
    api.enter('rest',{rest:true,direct:true});
    const surface=field.children.find(x=>x.className==='ff-hits');
    const ys=surface.children.map(b=>parseFloat(b.style.top));
    assert.equal(ys.length,42);
    const step=(ys[ys.length-1]-ys[0])/(ys.length-1);
    assert.ok(step>0);
    for(let i=1;i<ys.length;i++)assert.ok(Math.abs(ys[i]-ys[i-1]-step)<1e-6,'uneven dot '+i+' at '+w+'x'+h);
  }
});

test('labels sit above an expanded field, without a dead band below the headline',()=>{
  for(const [w,h] of [[1280,720],[390,844],[812,375]]){
    const {api}=harness(w,h);
    api.enter('rest',{rest:true,direct:true});
    const v=api.layoutMetrics();
    assert.ok(v.labelY>v.headlineBottom+15,'label overlaps headline');
    assert.ok(v.labelY<v.dotsTop-12,'label not above threads');
    assert.ok(v.dotsTop-v.headlineBottom<100,'dead gap above filaments');
    assert.ok(v.height-v.dotsBottom<95,'dead gap below filaments');
    assert.ok(v.lineTop>=v.labelY+15);
    assert.ok(v.lineBottom<=v.height);
    const xs=[v.sourceX,...v.gatesX];
    const step=(xs[4]-xs[0])/4;
    for(let i=1;i<xs.length;i++)assert.ok(Math.abs(xs[i]-xs[i-1]-step)<1e-7,'stage spacing is uneven');
  }
});
