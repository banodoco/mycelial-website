const P = await import('/home/user/mycelial-website/journey/manifesto/pose.js');
let n=19; const rng=()=>((n=(Math.imul(n,1664525)+1013904223)>>>0)/4294967296);
const bodies=P.aerialPlacements([], rng, ()=>0);
console.log('bodies',bodies.length);
const desk={position:{x:-14.72,y:2.73,z:2.70},target:{x:-3.06,y:0.83,z:-1.94},fov:45.5,roll:0};
const mob={position:{x:-15.4864,y:5.2453,z:3.4893},target:{x:-3.023,y:1.3933,z:-1.8471},fov:53.5,roll:-.087,fieldCenter:{x:.25,z:-1.82}};
for(const [nm,f,a] of [['desk',desk,1.6],['mob',mob,390/844]]){
  const out=new Float32Array(bodies.length*2);
  for(let r=0;r<3;r++){const t0=performance.now(); P.planAerialReveals(bodies,f,a,out); console.log(nm,'planAerialReveals ms',(performance.now()-t0).toFixed(1));}
  const cnt=[...Array(bodies.length).keys()].filter(i=>out[i*2]<=P.CAMERA_SECONDS).length; console.log(nm,'scheduled',cnt);
}
