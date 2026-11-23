import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const folder=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const script=readFileSync(resolve(folder,'filament-field.js'),'utf8');
const scatter=readFileSync(resolve(folder,'scatter-field.js'),'utf8');
const html=readFileSync(resolve(folder,'index.html'),'utf8');
const classes=()=>{const s=new Set();return{add:x=>s.add(x),remove:x=>s.delete(x),contains:x=>s.has(x),toggle:(x,v)=>v?s.add(x):s.delete(x)}};
function scene(w,h){
 const bounds=()=>({left:0,top:0,width:w,height:h,right:w,bottom:h});
 const painter={setTransform(){},clearRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},fill(){},fillRect(){},arc(){},fillText(){},save(){},restore(){},createRadialGradient(){return{addColorStop(){}}},createLinearGradient(){return{addColorStop(){}}}};
 const elem=tag=>{const x={tag,style:{},dataset:{},children:[],classList:classes(),setAttribute(){},addEventListener(){},getBoundingClientRect:bounds,append(...z){this.children.push(...z)},querySelector(){return elem('span')}};if(tag==='canvas'){x.getContext=()=>painter;x.width=x.height=0;}return x};
 const root=elem('div'),slide=elem('section'),dust=elem('canvas');
 root.filamentItems=Array.from({length:80},(_,i)=>['model','Open model','Capability '+i,'Description '+i]);
 root.closest=()=>slide;root.querySelector=x=>x==='.sf-dust'?dust:null;
 root.snapshot=()=>({named:[{x:w*.5,y:h*.5,p:1,r:2,color:'#f0c67e'}],dust:[]});
 root.append=(...nodes)=>{root.children.push(...nodes);for(const x of nodes)if(x.className==='ff-hits')root.hitLayer=x};
 const document={hidden:false,querySelector:()=>root,createElement:elem,getElementById:()=>null,addEventListener(){}};
 const window={deckNow:()=>1000,deckStill:()=>true,addEventListener(){}};
 runInNewContext(script,{document,window,matchMedia:()=>({matches:false}),ResizeObserver:class{observe(){}},devicePixelRatio:1,requestAnimationFrame:()=>1,cancelAnimationFrame(){},performance:{now:()=>1000},addEventListener(){},console},{timeout:3000});
 return {api:window.FilamentField,root};
}
test('preserves scene registration and source-to-chart handoff',()=>{
 assert.match(html,/<script src="scatter-field\.js"><\/script>\s*<script src="filament-field\.js"><\/script>/);
 for(const method of ['enter','exit','restore'])assert.ok(scatter.includes('window.FilamentField?.'+method+'('));
 assert.ok(scatter.includes('root.filamentItems = ITEMS.map'));
 assert.ok(script.includes('root.snapshot='));
});
for(const [width,height] of [[1280,720],[390,844],[812,375]]){
 test('geometry and lifecycle '+width+'x'+height,()=>{
  const {api,root}=scene(width,height);
  api.enter('rest',{from:0,rest:true,direct:true});
  assert.equal(api.ready(),true);
  const shot=api.snapshot();
  assert.equal(shot.named.length,42);
  assert.equal(shot.dust.length,260);
  assert.equal(root.hitLayer.children.length,42);
  for(const p of [...shot.named,...shot.dust]){
   assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));
   assert.ok(p.x>=0&&p.x<=width,'x='+p.x);
   assert.ok(p.y>=0&&p.y<=height,'y='+p.y);
   assert.match(p.color,/^#[0-9a-fA-F]{6}$/);
  }
  api.exit({to:2});
  assert.equal(api.ready(),true);
  assert.equal(api.snapshot().named.length,42);
  api.restore({to:1});
  assert.equal(api.ready(),true);
  api.exit({to:0});
 });
}
test('four qualitative barriers and stable geometry',()=>{
 for(const name of ['DISCOVER','SET UP','CONFIGURE','COMBINE'])assert.ok(script.includes("'"+name+"'"));
 assert.match(script,/const hash=/);
 assert.doesNotMatch(script,/Math\.random\(/);
 assert.match(script,/Visual attrition is illustrative/);
});