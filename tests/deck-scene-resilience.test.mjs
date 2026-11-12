import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
const read = file => readFileSync(new URL('../mycelial/'+file, import.meta.url),'utf8');
const html=read('index.html'), stack=read('stack.js'), wheel=read('flywheel.js');
const section=(s,a,b)=>{const i=s.indexOf(a),j=s.indexOf(b,i+a.length);assert.ok(i>=0&&j>i,`Missing ${a}`);return s.slice(i,j)};
const expose=(code,bindings,result)=>{const c=vm.createContext(bindings);return {c,fn:vm.runInContext(code+'\n'+result,c)}};
const clock=section(html,'  let timeline =','  const syncTimeline');
for(const hiddenMs of [1000,10000,60000])test(`clock excludes ${hiddenMs} ms of suspension`,()=>{
  let wall=0;const document={hidden:false},ov={classList:{contains:()=>false}},window={};
  expose(clock,{document,ov,window,performance:{now:()=>wall},pace:1},'window.deckNow');
  wall=120;assert.equal(window.deckNow(),120);document.hidden=true;window.deckNow();
  wall+=hiddenMs;document.hidden=false;assert.equal(window.deckNow(),120);
  wall+=16;assert.equal(window.deckNow(),136);
});
test('clock accounts the old interval at pause and pace boundaries',()=>{
  let wall=0,overview=false;const window={},document={hidden:false},ov={classList:{contains:()=>overview}};
  const f=expose(clock,{document,ov,window,performance:{now:()=>wall},pace:2},'window.deckNow');
  wall=50;overview=true;assert.equal(f.fn(),100);wall=500;overview=false;assert.equal(f.fn(),100);
  wall=550;assert.equal(f.fn(),200);f.c.pace=4;wall=600;assert.equal(f.fn(),400);
});
const drawCode=section(stack,'  const draw = () => {',"  cv.addEventListener('contextrestored'");
test('transient thread failure retries rather than hiding its canvas forever',()=>{
  let tries=0,faults=0;
  const f=expose(drawCode,{drawFaults:0,baseReady:true,threadsDirty:false,drawThreads(){if(++tries===1)throw Error('injected')},drawGuide(){},reportFault(){faults++}},'draw');
  f.fn();for(let i=0;i<20;i++)f.fn();assert.equal(tries,21);assert.equal(faults,1);assert.equal(f.c.baseReady,false);assert.equal(f.c.threadsDirty,true);
});
test('persistent decorative failures are bounded, with no automatic repair timer',()=>{
  let tries=0;const f=expose(drawCode,{drawFaults:0,baseReady:true,threadsDirty:false,drawThreads(){tries++;throw Error('injected')},drawGuide(){},reportFault(){}},'draw');
  for(let i=0;i<30;i++)f.fn();assert.equal(tries,2);assert.equal(f.c.drawFaults,2);
});
function capture(fail){
  let cleared=false,ended=false,attached=false,reports=0;
  const copy={width:160,height:90,dataset:{},getContext:()=>({clearRect(){cleared=true}})};
  const pic={width:160,height:90,getBoundingClientRect:()=>({left:10,top:10,width:160,height:90})};
  const bindings={demo:{classList:{contains:()=>true}},ghosts:[{querySelector:()=>copy}],carryG:{clearRect(){},drawImage(){if(fail)throw Error('capture')}},carryCv:{width:1,height:1},cy:{on:false},endCarry(){ended=true},reportFault(){reports++},planes:[{querySelector:()=>({parentElement:{offsetLeft:0,offsetTop:0},offsetLeft:0,offsetTop:0,offsetWidth:160,offsetHeight:90})}],PL:[{w:780}],inners:[{offsetWidth:778}],carryPic:{style:{}},carry:{classList:{remove(){}},style:{}},world:{appendChild(){attached=true}}};
  const f=expose(section(stack,'  const takePicture =','  const begin ='),bindings,'takePicture');
  f.fn({querySelector:()=>pic},{left:0,top:0,width:160,height:90});return {cleared,ended,attached,reports,carrying:bindings.cy.on,marked:copy.dataset.carried};
}
test('capture failure retains the already working fallback',()=>assert.deepEqual(capture(true),{cleared:false,ended:true,attached:false,reports:1,carrying:false,marked:undefined}));
test('successful capture commits the original handoff behavior',()=>assert.deepEqual(capture(false),{cleared:true,ended:false,attached:true,reports:0,carrying:true,marked:'1'}));
const tick=section(stack,'  const tick = (ctx)','  const wake =');
test('stack frame failure enters recovery instead of stranding running=true',()=>{
  let recoveries=0,scheduled=0;const ctx={};
  const f=expose(tick,{raf:12,current:()=>true,activeCtx:ctx,running:true,paused:false,now:()=>1,build:null,metrics:{frames:0},step(){throw Error('injected')},recoverFrame(){recoveries++},requestAnimationFrame(){scheduled++;return 1},stop(){}},'tick');
  f.fn(ctx);assert.equal(recoveries,1);assert.equal(scheduled,0);assert.equal(f.c.raf,0);
});
test('stack stale frame does not paint or restart a newer scene',()=>{
  let painted=0,scheduled=0;
  const f=expose(tick,{raf:12,current:()=>false,activeCtx:{},running:true,paused:false,step(){painted++},requestAnimationFrame(){scheduled++}},'tick');
  f.fn({});assert.equal(painted,0);assert.equal(scheduled,0);
});
const recovery=section(stack,'  const recoverFrame =','  // As on slide 5');
test('stack persistent frame fault lands at rest every time and retires the loop after two restarts',()=>{
  let lands=0,wakes=0,completed=0;const ctx={};
  const f=expose(recovery,{reportFault(){},running:true,raf:0,video:{pause(){}},current:()=>true,activeCtx:ctx,build:null,frameRecoveredFor:null,frameFaults:0,loopRetired:false,
    metrics:{frameRecoveries:0},amb:{},entryFinished:false,entryCompletion(){completed++},landAtRest(){lands++},motionOff:()=>false,guide:{on:true,a:1},draw(){},now:()=>1,openI:-1,
    tourFrom(){},play(){},wake(){wakes++},endFold(){}},'recoverFrame');
  f.fn(ctx,Error('first'));assert.equal(lands,1);assert.equal(f.c.running,true);assert.equal(f.c.entryFinished,true);assert.equal(completed,1);
  f.fn(ctx,Error('second'));f.fn(ctx,Error('third'));f.fn(ctx,Error('fourth'));
  assert.equal(lands,4,'the rest picture is landed on every fault');assert.equal(wakes,2,'the loop restarts twice only');
  assert.equal(f.c.loopRetired,true);assert.equal(f.c.running,false);assert.equal(f.c.metrics.frameRecoveries,4);
  f.fn({},Error('stale visit'));assert.equal(lands,4,'a departed visit is not landed');
});
test('the rest picture is landed step by step, so one failing step cannot keep the planes hidden',()=>{
  const land=section(stack,'  const landAtRest =','  // What a settled, ambient stack');
  let applied=0,faults=0;const state=[{o:0,pile:3}];
  const f=expose(land,{build:{},clearGhosts(){throw Error('ghosts')},clearResidue(){},geo:{},layout(){},st:state,PL:[{cy:150}],settledOf:()=>({o:1,y:150}),lit:[0],stackFlight:null,
    applyPlanes(){applied++},vis:{sh:0,lb:[0],rt:0,gd:0},syncFlagVisibility(){},flags:[{tabIndex:-1}],view:{mobile:true},openI:-1,show(i){f.c.openI=i},arrangeFlags(){},stepHead(){},
    draw(){throw Error('canvas')},reportFault(){faults++}},'landAtRest');
  assert.equal(f.fn({}),false);assert.equal(faults,2);assert.equal(applied,1);assert.equal(state[0].o,1);assert.equal(state[0].pile,0);
  assert.deepEqual(JSON.parse(JSON.stringify(f.c.vis)),{sh:1,lb:[1],rt:1,gd:1});assert.equal(f.c.openI,0);
});
test('entry clears every residue an earlier exit could leave, before it lays out',()=>{
  const start=section(stack,'  const start = (ctx) =>','  const launch =');
  assert.match(start,/build = null;[^\n]*\n\s*try \{ clearGhosts\(\); clearResidue\(ctx\); \}/);
  const residue=section(stack,'  const clearResidue =','  // The settled stack');
  for(const needle of ['resetStackFlight()','img[data-st-flight]',"avatar.style.visibility = ''","el.style.display = ''","el.style.visibility = ''","card.style.opacity = ''","slide.classList.remove('st-arrive')",'forgetShown()'])assert.ok(residue.includes(needle),needle);
  const reset=section(stack,'  const resetStackFlight =','  const avatar =');
  for(const needle of ["root.style.transform = ''","root.style.opacity = ''","root.classList.remove('is-gathering')","root.style.removeProperty('--st-gather')"])assert.ok(reset.includes(needle),needle);
});
const media=section(stack,'  const mayPlay =','  const recoverFrame =');
test('stack never starts media while user motion is disabled',()=>{
  let plays=0;const f=expose(media,{window:{},current:()=>true,activeCtx:{},slide:{classList:{contains:()=>true}},running:true,paused:false,motionBlocked:()=>true,build:null,playRequest:null,video:{paused:true,getAttribute:()=>true,play(){plays++}}},'play');
  f.fn();assert.equal(plays,0);
});
test('pending play is deduplicated and stale completion cannot pause a new visit',async()=>{
  let resolve,plays=0,pauses=0;const ctx={};const f=expose(media,{window:{},current:()=>true,activeCtx:ctx,slide:{classList:{contains:()=>true}},running:true,paused:false,motionBlocked:()=>false,build:null,playRequest:null,video:{paused:true,getAttribute:()=>true,play(){plays++;return new Promise(r=>resolve=r)},pause(){pauses++}},reportFault(){}},'play');
  f.fn();f.fn();assert.equal(plays,1);f.c.playRequest=null;f.c.activeCtx={};resolve();await Promise.resolve();await Promise.resolve();assert.equal(pauses,0);
});
test('a current pending playback is paused if the visit no longer permits it',async()=>{
  let resolve,pauses=0;const f=expose(media,{window:{},current:()=>true,activeCtx:{},slide:{classList:{contains:()=>true}},running:true,paused:false,motionBlocked:()=>false,build:null,playRequest:null,video:{paused:true,getAttribute:()=>true,play(){return new Promise(r=>resolve=r)},pause(){pauses++}},reportFault(){}},'play');
  f.fn();f.c.paused=true;resolve();await Promise.resolve();assert.equal(pauses,1);
});
const warm=section(html,'        // Preserve pre-load intent','      }).catch((error)');
for(const stale of [false,true])test(`resource load ${stale?'does not restart old':'preserves current'} playback intent`,()=>{
  let ready,plays=0;const owner={isCurrent:()=>!stale};const video={paused:false,removeAttribute(){},addEventListener(e,fn){ready=fn},load(){this.paused=true},play(){plays++;return Promise.resolve()}};
  expose(warm,{video,objectUrl:'blob:ready',window:{deckNav:owner,deckStill:()=>false},slide:{classList:{contains:()=>true}},paused:()=>false},'undefined');ready();assert.equal(plays,stale?0:1);
});
test('flywheel can restart a logically-running loop with no scheduled frame',()=>{
  let calls=0;const ctx={isCurrent:()=>true};const f=expose(section(wheel,'  const start = (ctx = entryCtx)','  let frameRecoveredFor'),{entryCtx:ctx,running:true,raf:0,still:false,document:{hidden:false,getElementById:()=>null},window:{deckStill:()=>false,deckNow:()=>10},requestAnimationFrame(){calls++;return 22},tick(){}},'start');
  f.fn(ctx);f.fn(ctx);assert.equal(calls,1);assert.equal(f.c.raf,22);
});
test('late wheel font events invalidate caches but do not publish an obsolete visit',()=>{
  let fn,painted=0;const code=section(wheel,"  document.fonts?.addEventListener?.('loadingdone'",'  const inCard');
  const f=expose(code,{document:{fonts:{addEventListener(_,cb){fn=cb}}},labels:{},lsz:new Map(),dirty:[false],fullW:12,lastPlaceKey:1,prepared:true,running:false,begun:true,cur:{},activeStage:-1,entryCtx:{isCurrent:()=>false},frame(){painted++}},'undefined');
  fn();assert.equal(painted,0);assert.equal(f.c.dirty[0],true);assert.equal(f.c.prepared,false);
});
const planeCode=section(stack,'  const applyPlanes =','  const apply =');
test('ambient lift changes transform only, without rewriting plane size or inner fit',()=>{
  const style={translate:''},p={w:780,h:340,cy:150},state={x:1062,y:144,w:780,h:340,rx:58,rz:4.5,o:1,c:1,g:0};let boxes=0,fits=0;
  const f=expose(planeCode,{st:[state],slabs:[{style}],planes:[{style:{}}],wk:1,shown:[{...state,y:150,ambient:true,stretchChat:false}],PL:[p],ghosts:[null],amb:{},build:null,box(){boxes++},fit(){fits++},stretch(){fits++},inners:[{style:{}}],ghostScrolls:[]},'applyPlanes');
  f.fn();assert.equal(boxes,0);assert.equal(fits,0);assert.equal(style.translate,'0 -6.000px');
  // the world laid out at its size on screen: the same lift, in screen units
  const small={translate:''};
  const g=expose(planeCode,{st:[state],slabs:[{style:small}],planes:[{style:{}}],wk:0.25,shown:[{...state,y:150,ambient:true,stretchChat:false}],PL:[p],ghosts:[null],amb:{},build:null,box(){boxes++},fit(){fits++},stretch(){fits++},inners:[{style:{}}],ghostScrolls:[]},'applyPlanes');
  g.fn();assert.equal(boxes,0);assert.equal(small.translate,'0 -1.500px');
});
test('normal build still writes the same unshifted frame and rotation',()=>{
  let boxValue;const style={},face={},state={x:1062,y:150,w:780,h:340,rx:58,rz:4.5,o:1,c:1,g:0};
  const f=expose(planeCode,{st:[state],slabs:[{style}],planes:[{style:face}],wk:0.25,shown:[{}],PL:[{w:780,h:340,cy:150}],ghosts:[null],amb:null,build:{},box(_,s){boxValue=s},fit(){},inners:[{style:{}}],ghostScrolls:[]},'applyPlanes');
  f.fn();assert.equal(boxValue,state);assert.equal(style.translate,'');assert.equal(style.transform,'rotateX(58.00deg) rotateZ(4.50deg)');
  assert.equal(style.opacity,'1.000');assert.equal(face.width,'780.0px');assert.equal(face.height,'340.0px'); // the plane keeps its scene size inside the layer
});
test('a layer box is the scene box times the world unit',()=>{
  const style={};const f=expose(section(stack,'  let wk = 1;','  // Fit content of natural size'),{},'(k)=>{wk=k;return box}');
  f.fn(0.25)({style},{x:1062,y:150,w:780,h:340});
  assert.deepEqual({...style},{width:'195.000px',height:'85.000px',left:'168.000px',top:'-5.000px'});
  f.fn(1)({style},{x:1062,y:150,w:780,h:340});
  assert.deepEqual({...style},{width:'780.000px',height:'340.000px',left:'672.000px',top:'-20.000px'});
});
test('settled artwork is drawn once across 60 frames and again only when what it shows changes',()=>{
  const fake=()=>new Proxy({canvas:{}},{get(t,k){return t[k]??(()=>{})}});let bases=0;
  const bindings={g:fake(),baseG:fake(),baseCv:{width:0,height:0},baseReady:false,baseFailed:false,cv:{width:600,height:400},dpr:2,threadBox:{x:10,y:20},geo:{corners:[]},view:{k:1},
    vis:{sh:1,rt:1,lb:[0]},lit:[0],flagY:[100],threadsDirty:true,threadSig:'',metrics:{cacheHits:0,threadDraws:0,threadSkips:0,guideDraws:0},guide:{a:0},drawBaseThreads(){bases++}};
  const f=expose(section(stack,'  const prepareThreadContext =','  // The guide: a bead of light'),bindings,'drawThreads');
  for(let i=0;i<60;i++)f.fn();assert.equal(bases,1);assert.equal(f.c.metrics.threadDraws,1);assert.equal(f.c.metrics.threadSkips,59);
  f.c.lit[0]=0.5;f.fn();assert.equal(f.c.metrics.threadDraws,2,'a card opening draws again');assert.equal(bases,1,'from the cache');
  f.c.flagY[0]=120;f.fn();assert.equal(f.c.metrics.threadDraws,3,'a flag moving draws again');
  f.c.threadsDirty=true;f.c.baseReady=false;f.fn();assert.equal(f.c.metrics.threadDraws,4);assert.equal(bases,2,'a new layout rebuilds the cache');
  f.fn();assert.equal(f.c.metrics.threadDraws,4);
});
test('compact layout has positive scale and preserves normal viewport slot position',()=>{
  for(const H of [420,620,844]){const bottom=400,slotH=200,natural=H-70-slotH,slot=Math.max(natural,bottom+144),height=slot-12-(bottom+12);assert.ok(height>0);if(H===844)assert.equal(slot,natural)}
  assert.match(stack,/const k = Math.max\(0.01, Math.min/);
});
test('capture surfaces release backing pixels after the handoff, not while attached',()=>{
  assert.match(stack,/gh.remove\(\); gh.replaceChildren\(\); gh.removeAttribute\('style'\);\s*ghostCanvases\[i\].forEach\(c => \{ c.width = c.height = 1;/);
  assert.match(stack,/carry.remove\(\);[\s\S]*carryCv.width = carryCv.height = 1;/);
});
test('recovery changes neither copy renderer nor stack timing constants',()=>{
  assert.match(stack,/const FROM5 = \{ a: \{ 0: \[0.05, 1.3\], 1: \[0.12, 1.42\], 3: \[0.2, 1.62\]/);
  assert.match(stack,/const QUICK = \{ rise: 0.12, dur: 0.75/);
  assert.doesNotMatch(stack,/deckCopy\.(show|retire|paint)/);
});
