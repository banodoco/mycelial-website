import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const REPO = '/home/user/mycelial-website';
const { createStager } = await import(REPO + '/tools/stage-tree.mjs');
const scratch = mkdtempSync(join(tmpdir(), 's1-'));
const stage = createStager({ scratchRoot: scratch, threePath: join(REPO,'vendor/three/three.module.js'), label:'s1' });
globalThis.location = { search: '' };
globalThis.matchMedia = () => ({ matches: false });
globalThis.innerWidth = 1440; globalThis.innerHeight = 900;
const THREE = await import('file://' + join(REPO,'vendor/three/three.module.js'));
const D = await import(stage(join(REPO,'journey/director.js')));
const R = await import(stage(join(REPO,'journey/route.js')));
const NT = await import(stage(join(REPO,'journey/navigation-timing.js')));
const NAV = await import(stage(join(REPO,'journey/navigation.js')));
const CP = await import(stage(join(REPO,'journey/camera-path.js')));
const { poseAt, HERO } = D;
const ASPECT = 1.6;
const mk = () => ({ pos: new THREE.Vector3(), target: new THREE.Vector3(), fov: 38 });
const heroObj = { az: HERO.az, r: HERO.r, y: HERO.y, target: HERO.target.clone(), fov: HERO.fov };
const pose = (p, o=mk()) => { poseAt(p, o, heroObj, ASPECT, 1440); return o; };
const rest = R.restProgress;
// ---- durations table
const ids = ['mission','inspire','equip','connect','final'];
const out = [];
function dur(fromId, toId) {
  const a = pose(rest(fromId)), b = pose(rest(toId));
  const sense = NAV.navSense(fromId, toId);
  const az1 = CP.azTurn(a.pos, b.pos, sense);
  const equipLeg = fromId==='equip'||toId==='equip';
  const skim = fromId==='connect'&&toId==='final';
  let len;
  if (fromId==='mission'&&toId==='inspire' || fromId==='inspire'&&toId==='mission') {
    // route pace path len
    let L=0, prev=null; const N=256, p0=rest(fromId), p1=rest(toId);
    for (let i=0;i<=N;i++){ const o=pose(p0+(p1-p0)*i/N); if(prev) L+=o.pos.distanceTo(prev); prev=o.pos.clone(); }
    len=L;
  } else if (skim) {
    len = CP.arcLength(a.pos,b.pos,az1); // approx (skim path longer)
  } else len = CP.arcLength(a.pos,b.pos,az1);
  const long = equipLeg||skim||Math.abs(az1)>Math.PI;
  let base = 0.85 + 0.35*(long? len/20 : Math.min(len/20,1)) + (skim?0.72:0) + (equipLeg&&fromId==='equip'&&toId==='connect'?0.66:0);
  return { from:fromId,to:toId,az1deg:+(az1*180/Math.PI).toFixed(1), len:+len.toFixed(2), base:+base.toFixed(3), speed:NT.navigationSpeed(fromId,toId), dur:+NT.navigationDurationSeconds(base,fromId,toId).toFixed(3) };
}
for (let i=0;i<ids.length-1;i++){ out.push(dur(ids[i],ids[i+1])); out.push(dur(ids[i+1],ids[i])); }
console.table(out);
// ---- Intro->Inspire profile
function profile(fromP,toP,durS,departure,easeFn){
  const N=256; const cum=new Float64Array(N+1); let L=0; let prev=null;
  for(let i=0;i<=N;i++){const o=pose(fromP+(toP-fromP)*i/N); if(i){L+=o.pos.distanceTo(prev);cum[i]=L;} prev=o.pos.clone();}
  const floor = departure?0:0.15*L/N; let tot=0,pr=0; for(let i=1;i<=N;i++){tot+=Math.max(cum[i]-pr,floor);pr=cum[i];cum[i]=tot;}
  const pAt=(e)=>{ if(e<=0)return fromP; if(e>=1)return toP; const u=e*tot; let lo=0,hi=N; while(hi-lo>1){const m=(lo+hi)>>1; if(cum[m]<u)lo=m;else hi=m;} const span=cum[hi]-cum[lo]; let f=(lo+(span>0?(u-cum[lo])/span:1))/N; return fromP+(toP-fromP)*Math.min(1,Math.max(0,f)); };
  const frames=Math.ceil(durS*60); const rows=[]; let last=null;
  for(let k=0;k<=frames;k++){ const f=Math.min(1,k/60/durS); const e=easeFn(f); const p=pAt(e); const o=pose(p); const fwd=o.target.clone().sub(o.pos).normalize(); rows.push({t:k/60,p,pos:o.pos.clone(),fwd,fov:o.fov}); }
  const m=[]; for(let k=1;k<rows.length;k++){ const a=rows[k-1],b=rows[k]; const v=b.pos.distanceTo(a.pos)*60; const w=Math.acos(Math.min(1,a.fwd.dot(b.fwd)))*60*180/Math.PI; const azA=Math.atan2(a.pos.x,a.pos.z), azB=Math.atan2(b.pos.x,b.pos.z); let da=azB-azA; if(da>Math.PI)da-=2*Math.PI; if(da<-Math.PI)da+=2*Math.PI; m.push({t:b.t,v,w,az:da*60*180/Math.PI,dfov:(b.fov-a.fov)*60,dp:(b.p-a.p)*60}); }
  return m;
}
const smoothstep=f=>f*f*(3-2*f); const smoother=f=>f*f*f*(f*(f*6-15)+10);
function summarize(name,m){ let pk=m.reduce((a,b)=>b.v>a.v?b:a), pw=m.reduce((a,b)=>b.w>a.w?b:a);
  // accel & jerk of speed
  let amax=0,aT=0,first=null; for(let k=1;k<m.length;k++){const a=(m[k].v-m[k-1].v)*60; if(Math.abs(a)>amax){amax=Math.abs(a);aT=m[k].t;}}
  const a0=(m[1].v-m[0].v)*60, aEnd=(m[m.length-1].v-m[m.length-2].v)*60;
  // time to reach 5% of peak and time last above 5% of peak
  const thr=0.05*pk.v; const tOn=m.find(x=>x.v>thr).t; const tOff=[...m].reverse().find(x=>x.v>thr).t;
  console.log(name,JSON.stringify({dur:+m[m.length-1].t.toFixed(3),peakV:+pk.v.toFixed(2),peakVt:+pk.t.toFixed(2),peakGazeDegS:+pw.w.toFixed(1),peakAzDegS:+Math.max(...m.map(x=>Math.abs(x.az))).toFixed(1),maxAccel:+amax.toFixed(1),maxAccelAt:+aT.toFixed(2),v0:+m[0].v.toFixed(3),a0:+a0.toFixed(1),aEnd:+aEnd.toFixed(1),tOn5:+tOn.toFixed(2),tOff5:+tOff.toFixed(2)}));
  return m; }
const d = out[0].dur;
const m1 = summarize('mission>inspire (shipped: smoothstep+pace)', profile(rest('mission'),rest('inspire'),d,true,smoothstep));
summarize('mission>inspire (alt smootherstep)', profile(rest('mission'),rest('inspire'),d,true,smoother));
import('node:fs').then(fs=>fs.writeFileSync('/tmp/claude-0/-home-user/62a00d20-ec8d-551d-aa8b-33233b07a42e/scratchpad/captures/S1-transitions/m1-profile.json',JSON.stringify(m1)));
// print sampled speed curve every 0.2 s
console.log('t, v u/s, gaze deg/s, az deg/s, dfov deg/s, dp p/s');
for(let k=0;k<m1.length;k+=12){const x=m1[k];console.log(x.t.toFixed(2),x.v.toFixed(2),x.w.toFixed(1),x.az.toFixed(1),x.dfov.toFixed(2),x.dp.toFixed(3));}
// frame-to-frame jump in speed (discontinuity detector)
let big=[];for(let k=2;k<m1.length;k++){const dv=(m1[k].v-m1[k-1].v), dv0=(m1[k-1].v-m1[k-2].v); const dd=dv-dv0; big.push({t:m1[k].t,dd});} big.sort((a,b)=>Math.abs(b.dd)-Math.abs(a.dd)); console.log('largest 2nd diffs of speed (u/s per frame^2):',big.slice(0,6).map(x=>x.t.toFixed(3)+':'+x.dd.toFixed(3)).join(' '));

// ---------- generic-arc hops (non route-faithful) ----------
const sm=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t);};
function arcHop(fromId,toId,durS){
  const A=pose(rest(fromId)),B=pose(rest(toId));
  const sense=NAV.navSense(fromId,toId); const az1=CP.azTurn(A.pos,B.pos,sense);
  const equipLeg=fromId==='equip'||toId==='equip';
  const radGap=Math.abs(Math.hypot(A.pos.x,A.pos.z)-Math.hypot(B.pos.x,B.pos.z));
  const bow=equipLeg?Math.min(2.2,radGap*0.35):0;
  const tgtDip=equipLeg?-Math.min(1.0,Math.abs(B.target.y-A.target.y)*0.35):0;
  const rows=[];const N=Math.ceil(durS*60); const pos=new THREE.Vector3(); const tg=new THREE.Vector3();
  let readyT=null;
  for(let k=0;k<=N;k++){const f=Math.min(1,k/60/durS); const e=smoother(f);
    CP.arcLerp(A.pos,B.pos,e,pos,az1,bow,0,e); tg.lerpVectors(A.target,B.target,e); tg.y+=tgtDip*Math.sin(Math.PI*e);
    const fwd=tg.clone().sub(pos).normalize(); const fov=A.fov*(1-e)+B.fov*e;
    if(readyT===null && pos.y>0 && sm(-0.0209,-0.1253,fwd.y)>=0.24) readyT=k/60;
    rows.push({t:k/60,pos:pos.clone(),fwd,fov,e});}
  let pv=0,pw=0,pa=0,paz=0;
  for(let k=1;k<rows.length;k++){const a=rows[k-1],b=rows[k];pv=Math.max(pv,b.pos.distanceTo(a.pos)*60);pw=Math.max(pw,Math.acos(Math.min(1,a.fwd.dot(b.fwd)))*60*180/Math.PI);
    let da=Math.atan2(b.pos.x,b.pos.z)-Math.atan2(a.pos.x,a.pos.z);if(da>Math.PI)da-=2*Math.PI;if(da<-Math.PI)da+=2*Math.PI;paz=Math.max(paz,Math.abs(da)*60*180/Math.PI);}
  return {hop:fromId+'>'+toId,dur:durS,az1:+(az1*180/Math.PI).toFixed(1),peakU_s:+pv.toFixed(1),peakGazeDegS:+pw.toFixed(0),peakAzDegS:+paz.toFixed(0),entryReadyAt_s:readyT};
}
console.log('--- arc hops (smootherstep, as stepCameraBlend)');
for(const r of out.slice(2,6)) console.log(JSON.stringify(arcHop(r.from,r.to,r.dur)));
console.log(JSON.stringify(arcHop('connect','final',5.549)),'(flyby skim not modelled; plain arc)');
// route-faithful peaks for reference
console.log('--- mission>inspire peak az deg/s', 'see above');

console.log('--- M1 candidate sweep (route-faithful mission>inspire, pace table kept)');
const sine=f=>0.5-0.5*Math.cos(Math.PI*f);
const septic=f=>f**4*(35-84*f+70*f*f-20*f**3);
for (const [name,fn] of [['smoothstep(shipped)',smoothstep],['smootherstep',smoother],['sine',sine],['septic',septic]])
  for (const D of [2.667,3.0,3.333,3.75]) { if(name.startsWith('smoothstep')&&D!==2.667) continue; summarize(name+' D='+D, profile(rest('mission'),rest('inspire'),D,true,fn)); }
