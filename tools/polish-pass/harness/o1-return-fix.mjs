const P = await import('/home/user/mycelial-website/journey/manifesto/pose.js');
const { manifestoPose, returnSecondsFrom, CAMERA_SECONDS:T, smoother, ascentAt } = P;
const desk = { position:{x:-14.72,y:2.73,z:2.70}, target:{x:-3.06,y:0.83,z:-1.94}, fov:45.5, roll:0 };
const H=Math.max(70,76/1.6);
const yOf=s=>8*smoother(s/3)+(H-desk.position.y-8)*ascentAt(s,1.6);
const variants={
 current: s=>ascentAt(s,1.6),
 actualY: s=>yOf(s),
 lin12: s=>ascentAt(s,1.6)+0.12*s/T,
 actualY_lin: s=>yOf(s)/(H-desk.position.y)+0.15*s/T,
};
function dU(h,startU,k){ if(!(k<1))return 0; const top=startU*T; const a=h(top)*(1-smoother(k)); if(!(a>0))return 0; let lo=0,hi=top; for(let i=0;i<40;i++){const m=(lo+hi)/2; if(h(m)<a)lo=m; else hi=m;} return (lo+hi)/2; }
const dir=p=>{const d=[p.target.x-p.position.x,p.target.y-p.position.y,p.target.z-p.position.z];const n=Math.hypot(...d);return d.map(v=>v/n)};
for (const [nm,h] of Object.entries(variants)) for (const start of [1,0.5]) {
  const dur=returnSecondsFrom(start); let k=0, prev=manifestoPose(desk,start*T,1.6), maxV=0,maxVt=0,maxA=0,maxAt=0, maxJ=0, pv=0, last=[];
  for(let f=1;f<=Math.ceil(dur*60)+1;f++){ k=Math.min(1,k+1/dur/60); const s=dU(h,start,k); const p=manifestoPose(desk,s,1.6);
    const v=Math.hypot(p.position.x-prev.position.x,p.position.y-prev.position.y,p.position.z-prev.position.z)*60;
    const d0=dir(prev),d1=dir(p); const a=Math.acos(Math.min(1,d0[0]*d1[0]+d0[1]*d1[1]+d0[2]*d1[2]))*180/Math.PI*60;
    if(v>maxV){maxV=v;maxVt=f/60} if(a>maxA){maxA=a;maxAt=f/60} maxJ=Math.max(maxJ,Math.abs(v-pv)*60); pv=v; prev=p;
    if (f%30==0) last.push(`${(f/60).toFixed(1)}:${v.toFixed(0)}/${a.toFixed(0)}`);
  }
  console.log(nm,start,'peak v',maxV.toFixed(1),'@',maxVt.toFixed(2),'peak ang',maxA.toFixed(1),'@',maxAt.toFixed(2),'max |dv/dt|',maxJ.toFixed(0),'| v/ang per 0.5s:',last.join(' '));
}
