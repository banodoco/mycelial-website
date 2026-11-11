globalThis.window = { innerWidth: 1440, innerHeight: 900 };
const R='/home/user/wt/mperf/';
const { planAerialReveals, aerialPlacements } = await import('file://'+R+'journey/manifesto/pose.js');
let n=19; const rnd=()=>((n=(Math.imul(n,1664525)+1013904223)>>>0)/4294967296);
const bodies = aerialPlacements([], rnd, ()=>0);
const desk={position:{x:-14.72,y:2.73,z:2.70},target:{x:-3.06,y:0.83,z:-1.94},fov:45.5,roll:0};
const mob={position:{x:-15.4864,y:5.2453,z:3.4893},target:{x:-3.023,y:1.3933,z:-1.8471},fov:53.5,roll:-.087,fieldCenter:{x:.25,z:-1.82}};
const [f,a] = process.argv[2]==='mob' ? [mob,390/844] : [desk,1.6];
const out=new Float32Array(bodies.length*2);
const T=(fn)=>{const t=process.cpuUsage(); fn(); const d=process.cpuUsage(t); return +((d.user+d.system)/1000).toFixed(1);};
const mode=process.argv[3];
if (mode==='warm') { const k=+process.argv[4]||8, reps=+process.argv[5]||2; const r=[]; for(let i=0;i<reps;i++) r.push(T(()=>planAerialReveals(bodies.slice(0,k),f,a,new Float32Array(k*2)))); console.log('tiny',k,JSON.stringify(r)); }
console.log('full', T(()=>planAerialReveals(bodies,f,a,out)), 'again', T(()=>planAerialReveals(bodies,f,a,out)));
