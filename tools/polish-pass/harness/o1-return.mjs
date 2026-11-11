const P = await import('/home/user/mycelial-website/journey/manifesto/pose.js');
const { manifestoPose, descentU, returnSecondsFrom, CAMERA_SECONDS:T } = P;
const desk = { position:{x:-14.72,y:2.73,z:2.70}, target:{x:-3.06,y:0.83,z:-1.94}, fov:45.5, roll:0 };
const mob = { position:{x:-15.4864,y:5.2453,z:3.4893}, target:{x:-3.023,y:1.3933,z:-1.8471}, fov:53.5004, roll:-5*Math.PI/180, fieldCenter:{x:.251658,z:-1.823989} };
const dir=p=>{const d=[p.target.x-p.position.x,p.target.y-p.position.y,p.target.z-p.position.z];const n=Math.hypot(...d);return d.map(v=>v/n)};
for (const [nm,from,a] of [['desk',desk,1.6],['mob',mob,390/844]]) for (const start of [1,0.5,0.15]) {
  const dur=returnSecondsFrom(start), rate=1/dur; let k=0, prev=manifestoPose(from,start*T,a), rows=[];
  for (let f=1; ; f++) {
    k=Math.min(1,k+rate/60); const u=descentU(start,k,a,from.position.y); const pose=manifestoPose(from,u*T,a);
    const dp=Math.hypot(pose.position.x-prev.position.x,pose.position.y-prev.position.y,pose.position.z-prev.position.z)*60;
    const d0=dir(prev),d1=dir(pose); const ang=Math.acos(Math.min(1,d0[0]*d1[0]+d0[1]*d1[1]+d0[2]*d1[2]))*180/Math.PI*60;
    rows.push({t:f/60,k,s:u*T,y:pose.position.y,speed:dp,angDeg:ang,fov:pose.fov}); prev=pose; if(u<=0)break;
  }
  const peak=rows.reduce((m,r)=>r.speed>m.speed?r:m); const peakA=rows.reduce((m,r)=>r.angDeg>m.angDeg?r:m);
  console.log(`== ${nm} start=${start} dur=${dur.toFixed(2)} frames=${rows.length} peakSpeed ${peak.speed.toFixed(1)}u/s @${peak.t.toFixed(2)} peakAng ${peakA.angDeg.toFixed(1)}deg/s @${peakA.t.toFixed(2)}`);
  for (const r of rows.filter((r,i)=> i%12==0 || i>rows.length-8)) console.log(' t',r.t.toFixed(2),'k',r.k.toFixed(3),'s',r.s.toFixed(2),'y',r.y.toFixed(2),'v',r.speed.toFixed(2),'ang',r.angDeg.toFixed(2),'fov',r.fov.toFixed(2));
}
