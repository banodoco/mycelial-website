import { readFileSync } from 'node:fs';
globalThis.window = { innerWidth: 1440, innerHeight: 900 };
const R=process.env.R||'/home/user/wt/mperf/'; const u=p=>'file://'+R+p;
const threeURL=u('vendor/three/three.module.js'); const THREE=await import(threeURL);
const conn='data:text/javascript;base64,'+Buffer.from(readFileSync(R+'journey/manifesto/connected-lines.js','utf8').replace("'three'",JSON.stringify(threeURL))).toString('base64');
let src=readFileSync(R+'journey/manifesto/colony.js','utf8').replace("'three'",JSON.stringify(threeURL)).replace("'./pose.js'",JSON.stringify(u('journey/manifesto/pose.js'))).replace("'./connected-lines.js'",JSON.stringify(conn)).replace("'../lib/body-dissolve.js'",JSON.stringify(u('journey/lib/body-dissolve.js'))).replace("'./retirement.js'",JSON.stringify(u('journey/manifesto/retirement.js'))).replace("import { groundY, makeRng } from '../chapters/final/world.js';",'const groundY=()=>0; const makeRng=()=>{let n=19;return()=>((n=(Math.imul(n,1664525)+1013904223)>>>0)/4294967296);};');
const {createAerialColony}=await import('data:text/javascript;base64,'+Buffer.from(src).toString('base64'));
const {manifestoPose, CAMERA_SECONDS}=await import(u('journey/manifesto/pose.js'));
const stem=new THREE.Group(),cap=new THREE.Group(),bend=new THREE.Group();bend.add(cap);
const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,1,1,1],3));
cap.add(new THREE.LineSegments(g,new THREE.ShaderMaterial({uniforms:{uProg:{value:2}},vertexShader:'void main(){}',fragmentShader:'void main(){}'})));
const camera=new THREE.PerspectiveCamera(45.5,1.6,.1,1000);
const c=createAerialColony({groups:{stem,mushroom:cap},camera},[]);
const desk={position:{x:-14.72,y:2.73,z:2.70},target:{x:-3.06,y:0.83,z:-1.94},fov:45.5,roll:0};
c.prepare(desk,1.6);
const mem=()=>{global.gc&&global.gc(); const m=process.memoryUsage(); return ((m.heapUsed+m.arrayBuffers)/1e6).toFixed(2);};
const out=[]; for(let i=0;i<=CAMERA_SECONDS*60;i++){ const s=i/60; const p=manifestoPose(desk,s,1.6); camera.position.set(p.position.x,p.position.y,p.position.z); camera.lookAt(p.target.x,p.target.y,p.target.z); camera.fov=p.fov; camera.updateProjectionMatrix(); c.set(1,80,200,s); if(i%300===0) out.push(`${s.toFixed(0)}s:${mem()}MB`); }
console.log(out.join(' '));
