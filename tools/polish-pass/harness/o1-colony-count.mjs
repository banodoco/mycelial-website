import { readFileSync } from 'node:fs';
globalThis.window = { innerWidth: 1440, innerHeight: 900 };
const R='/home/user/mycelial-website/';
const u=p=>'file://'+R+p;
const threeURL=u('vendor/three/three.module.js'); const THREE=await import(threeURL);
const conn='data:text/javascript;base64,'+Buffer.from(readFileSync(R+'journey/manifesto/connected-lines.js','utf8').replace("'three'",JSON.stringify(threeURL))).toString('base64');
let src=readFileSync(R+'journey/manifesto/colony.js','utf8').replace("'three'",JSON.stringify(threeURL)).replace("'./pose.js'",JSON.stringify(u('journey/manifesto/pose.js'))).replace("'./connected-lines.js'",JSON.stringify(conn)).replace("'../lib/body-dissolve.js'",JSON.stringify(u('journey/lib/body-dissolve.js'))).replace("'./retirement.js'",JSON.stringify(u('journey/manifesto/retirement.js'))).replace("import { groundY, makeRng } from '../chapters/final/world.js';",'const groundY=()=>0; const makeRng=()=>{let n=19;return()=>((n=(Math.imul(n,1664525)+1013904223)>>>0)/4294967296);};');
const {createAerialColony}=await import('data:text/javascript;base64,'+Buffer.from(src).toString('base64'));
const stem=new THREE.Group(),cap=new THREE.Group(),bend=new THREE.Group();bend.add(cap);
const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,1,1,1],3));
cap.add(new THREE.LineSegments(g,new THREE.ShaderMaterial({uniforms:{uProg:{value:2}},vertexShader:'void main(){}',fragmentShader:'void main(){}'})));
const t0=performance.now();
const c=createAerialColony({groups:{stem,mushroom:cap}},[]);
console.log('construct ms',(performance.now()-t0).toFixed(1));
for (const o of c.group.children) { const ge=o.geometry; console.log(o.type, 'verts', ge.attributes.position.count, 'index', ge.index?ge.index.count:0, Object.keys(ge.attributes).join(',')); }
const desk={position:{x:-14.72,y:2.73,z:2.70},target:{x:-3.06,y:0.83,z:-1.94},fov:45.5,roll:0};
const mob={position:{x:-15.4864,y:5.2453,z:3.4893},target:{x:-3.023,y:1.3933,z:-1.8471},fov:53.5,roll:-.087,fieldCenter:{x:.25,z:-1.82}};
for (const [nm,f,a,w,h] of [['desk',desk,1.6,1440,900],['mob',mob,390/844,390,844],['desk2',desk,1.6,1440,900],['mob2',mob,390/844,390,844]]){ window.innerWidth=w; window.innerHeight=h; const t=performance.now(); c.prepare(f,a); console.log(nm,'prepare ms',(performance.now()-t).toFixed(1), JSON.stringify(c.lod)); }
