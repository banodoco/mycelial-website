const P = await import('/home/user/mycelial-website/journey/manifesto/pose.js');
const { manifestoPose, CAMERA_SECONDS:T, smoother } = P;
const mix=(a,b,t)=>a+(b-a)*t;
const ramp=(x,a)=>{x=Math.max(0,Math.min(1,x));const v=1/(1-a);return x<a? v*x*x/(2*a): x>1-a? 1-v*(1-x)*(1-x)/(2*a): v*(x-a/2);};
const mob = { position:{x:-15.4864,y:5.2453,z:3.4893}, target:{x:-3.023,y:1.3933,z:-1.8471}, fov:53.5004, roll:-5*Math.PI/180, fieldCenter:{x:.251658,z:-1.823989} };
const TURN=25*Math.PI/180;
const EXTRA=(+process.env.EXTRA||0)*Math.PI/180;
function cand(from,s){
  const tilt=smoother(s/5);           // pitch + horizontal glide (was /5)
  const lift=smoother(s/3.5);           // rise leads the glide (was shared /5)
  const climb=ramp(s/T,0.12);           // was smoother(s/T)
  const dx=from.target.x-from.position.x,dz=from.target.z-from.position.z,horizontal=Math.hypot(dx,dz),dy=from.target.y-from.position.y;
  const pitch=mix(Math.atan2(dy,horizontal),-Math.PI/2+1e-5,tilt);
  const y=from.position.y+16*lift+(38-from.position.y-16)*climb;
  const c=from.fieldCenter; const x=mix(from.position.x,c.x,tilt), z=mix(from.position.z,c.z,tilt);
  const distance=mix(Math.hypot(horizontal,dy),y-0.4,tilt), reach=Math.cos(pitch)*distance;
  const heading=Math.atan2(dz,dx)+TURN*(0.45*tilt+0.55*ramp(s/T,0.12))+EXTRA*ramp(s/T,0.12);
  return {position:{x,y,z},target:{x:x+Math.cos(heading)*reach,y:y+Math.sin(pitch)*distance,z:z+Math.sin(heading)*reach},fov:mix(from.fov,46,lift),heading};
}
function basis(pose, headingHint){const p=pose.position,q=pose.target;let fx=q.x-p.x,fy=q.y-p.y,fz=q.z-p.z;const n=Math.hypot(fx,fy,fz);fx/=n;fy/=n;fz/=n;
 // up = projected heading direction (screen-top = forward heading) for overhead stability
 let hx=Math.cos(headingHint),hz=Math.sin(headingHint); let ux=hx- fx*(hx*fx+hz*fz), uy=-fy*(hx*fx+hz*fz), uz=hz-fz*(hx*fx+hz*fz); const un=Math.hypot(ux,uy,uz); ux/=un;uy/=un;uz/=un;
 const rx=fy*uz-fz*uy, ry=fz*ux-fx*uz, rz=fx*uy-fy*ux; return {fx,fy,fz,ux,uy,uz,rx,ry,rz};}
function proj(pose,b,pt,aspect){const p=pose.position;const x=pt.x-p.x,y=pt.y-p.y,z=pt.z-p.z;const d=x*b.fx+y*b.fy+z*b.fz;const t=Math.tan(pose.fov*Math.PI/360);return{nx:(x*b.rx+y*b.ry+z*b.rz)/(d*t*aspect),ny:(x*b.ux+y*b.uy+z*b.uz)/(d*t),d};}
const pts=[];for(let i=-6;i<=6;i++)for(let j=-6;j<=6;j++)pts.push({x:i*3,y:0.3,z:-1.8+j*3});
const W=390,H=844,A=W/H;
const h0=Math.atan2(mob.target.z-mob.position.z,mob.target.x-mob.position.x);
for (const [name,fn,hd] of [['current',s=>manifestoPose(mob,s,A),s=>h0+TURN*smoother(s/5)],['cand',s=>cand(mob,s),s=>cand(mob,s).heading]]){
  console.log('==',name); let prev=null,prevb=null;
  for(const s of [0,.25,.5,.75,1,1.5,2,2.5,3,4,5,6,8,10,15,20,25,30,35,T]){
    const pose=fn(s), b=basis(pose,hd(s)); let mv=0,c=0;
    const dt=0.05; const p2=fn(Math.max(0,s-dt)), b2=basis(p2,hd(Math.max(0,s-dt)));
    if(s>0) for(const pt of pts){const a=proj(p2,b2,pt,A),q=proj(pose,b,pt,A);if(a.d>0&&q.d>0&&Math.abs(q.nx)<1&&Math.abs(q.ny)<1){mv+=Math.hypot((q.nx-a.nx)*W/2,(q.ny-a.ny)*H/2);c++;}}
    const hero=Math.hypot(pose.position.x,pose.position.y-3,pose.position.z);
    console.log(s.toFixed(2),'y',pose.position.y.toFixed(2),'heroDist',hero.toFixed(2),'fov',pose.fov.toFixed(1),'px/u',(H/2/(hero*Math.tan(pose.fov*Math.PI/360))).toFixed(1),'meanPx/s',c?(mv/c/dt).toFixed(1):'-');
  }
  const e=fn(T); console.log('end',JSON.stringify(e.position),JSON.stringify(e.target));
}
