const P = await import('/home/user/mycelial-website/journey/manifesto/pose.js');
const { manifestoPose, CAMERA_SECONDS } = P;
const desk = { position:{x:-14.72,y:2.73,z:2.70}, target:{x:-3.06,y:0.83,z:-1.94}, fov:45.5, roll:0 };
const mob = { position:{x:-15.4864,y:5.2453,z:3.4893}, target:{x:-3.023,y:1.3933,z:-1.8471}, fov:53.5004, roll:-5*Math.PI/180, fieldCenter:{x:.251658,z:-1.823989} };
function project(pose, pt, aspect){
  const p=pose.position,q=pose.target; let fx=q.x-p.x,fy=q.y-p.y,fz=q.z-p.z; const n=Math.hypot(fx,fy,fz); fx/=n;fy/=n;fz/=n;
  // right = f x up(0,1,0) ; handle near-vertical with up hint from heading
  let rx=-fz, ry=0, rz=fx; let rn=Math.hypot(rx,rz); if(rn<1e-6){rx=1;rz=0;rn=1;} rx/=rn; rz/=rn;
  const ux=ry*fz-rz*fy, uy=rz*fx-rx*fz, uz=rx*fy-ry*fx;
  const x=pt.x-p.x,y=pt.y-p.y,z=pt.z-p.z; const d=x*fx+y*fy+z*fz; const t=Math.tan(pose.fov*Math.PI/360);
  return { nx:(x*rx+y*ry+z*rz)/(d*t*aspect), ny:(x*ux+y*uy+z*uz)/(d*t), d };
}
// ground points around the field
const pts=[]; for(let i=-3;i<=3;i++)for(let j=-3;j<=3;j++) pts.push({x:-3+i*3,y:0.5,z:-1.9+j*3});
pts.push({x:0,y:3,z:0});
for (const [name,from,aspect,W,H] of [['desk',desk,1440/900,1440,900],['mob',mob,390/844,390,844]]) {
  console.log('==',name);
  let prev=null;
  for (let t=0;t<=6.001;t+=0.25){
    const pose=manifestoPose(from,t,aspect);
    let mv=0,c=0; if(prev){ for(const pt of pts){const a=project(prev,pt,aspect),b=project(pose,pt,aspect); if(a.d>0&&b.d>0&&Math.abs(b.nx)<1.2&&Math.abs(b.ny)<1.2){ mv+=Math.hypot((b.nx-a.nx)*W/2,(b.ny-a.ny)*H/2); c++; }}}
    const hero=project(pose,{x:0,y:3,z:0},aspect);
    const p=pose.position; const hd=Math.hypot(p.x-0,p.y-3,p.z);
    console.log(t.toFixed(2),'y',p.y.toFixed(2),'xz',p.x.toFixed(2),p.z.toFixed(2),'fov',pose.fov.toFixed(1),'heroDist',hd.toFixed(2),'heroScale(px/u)',(H/2/(hero.d*Math.tan(pose.fov*Math.PI/360))).toFixed(1),'meanPx/s',c?(mv/c/0.25).toFixed(1):'-');
    prev=pose;
  }
}
