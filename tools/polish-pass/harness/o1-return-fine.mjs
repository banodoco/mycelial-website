const P = await import('/home/user/mycelial-website/journey/manifesto/pose.js');
const { manifestoPose, descentU, returnSecondsFrom, CAMERA_SECONDS:T, frameShiftAt } = P;
const desk = { position:{x:-14.72,y:2.73,z:2.70}, target:{x:-3.06,y:0.83,z:-1.94}, fov:45.5, roll:0 };
const start=1, rate=1/returnSecondsFrom(start); let k=0, prev=manifestoPose(desk,T,1.6);
for (let f=1;f<=290;f++){ k=Math.min(1,k+rate/60); const s=descentU(start,k,1.6,desk.position.y)*T; const p=manifestoPose(desk,s,1.6);
 const v=[p.position.x-prev.position.x,p.position.y-prev.position.y,p.position.z-prev.position.z].map(x=>x*60);
 const tv=[p.target.x-prev.target.x,p.target.y-prev.target.y,p.target.z-prev.target.z].map(x=>x*60);
 if (f>=108&&f<=135) console.log((f/60).toFixed(3),'s',s.toFixed(2),'vel',v.map(x=>x.toFixed(1)).join(','),'|v|',Math.hypot(...v).toFixed(1),'tgtV',Math.hypot(...tv).toFixed(1), 'shift', JSON.stringify(frameShiftAt(s,1.6,desk)));
 prev=p;}
