import assert from 'node:assert/strict';
import { installVendorResolver } from './render-report-lib.mjs';
installVendorResolver();
const THREE = await import('../vendor/three/three.module.js');
const { poseAt } = await import('../journey/director.js');
const { restProgress } = await import('../journey/route.js');
const { manifestoPose } = await import('../journey/manifesto/pose.js');
const { createEntryFlight, sampleEntryFlight } = await import('../journey/manifesto/entry-flight.js');
const { returnVelocity } = await import('../journey/manifesto/return-flight.js');
const { createGlide, sampleGlide, glideVelocity } = await import('../journey/manifesto/glide.js');
// a presented frame as the branch reads it: forward from the aim, the flight's own up
const view = p => { const d = { x: p.target.x - p.position.x, y: p.target.y - p.position.y, z: p.target.z - p.position.z }, n = Math.hypot(d.x, d.y, d.z);
  return { ...p, forward: { x: d.x / n, y: d.y / n, z: d.z / n } }; };
for (const [aspect,width] of [[390/844,390],[1.6,1280]]) {
  const rest = id => { const p=poseAt(restProgress(id), {pos:new THREE.Vector3(),target:new THREE.Vector3()},undefined,aspect,width);
    return {position:{...p.pos},target:{...p.target},fov:p.fov,roll:p.roll||0}; };
  const anchor=rest('final'), camera=new THREE.PerspectiveCamera();
  for(const id of ['mission','inspire','equip','connect','owned']) {
    const flight=createEntryFlight(rest(id),anchor,aspect), T=flight.seconds, dt=1/1000;
    assert.deepEqual(sampleEntryFlight(flight,0).position,rest(id).position);
    const end=sampleEntryFlight(flight,T), actual=manifestoPose(anchor,T,aspect);
    assert.deepEqual(end.position,actual.position);assert.deepEqual(end.target,actual.target);
    const left=returnVelocity(sampleEntryFlight(flight,T-dt),end,dt);
    const right=returnVelocity(actual,manifestoPose(anchor,T+dt,aspect),dt);
    for(const key of Object.keys(left)) assert.ok(Math.abs(left[key]-right[key]) < .04, `${width} ${id} ${key} joins moving ascent`);
    let previous;
    for(let t=0;t<T;t+=1/240) {
      const p=sampleEntryFlight(flight,t);camera.position.set(p.position.x,p.position.y,p.position.z);camera.up.set(p.up.x,p.up.y,p.up.z);camera.lookAt(new THREE.Vector3(p.target.x,p.target.y,p.target.z));
      if(previous)assert.ok(camera.quaternion.angleTo(previous)*240<1.5,`${width} ${id} entry pole-safe at ${t}: ${camera.quaternion.angleTo(previous)*240}`);
      previous=camera.quaternion.clone();
    }
    for(const t of [.1,2,5,8]) {
      // a Return pressed during the entry is the same glide, from the frame on screen
      const p=view(sampleEntryFlight(flight,t)), v=glideVelocity(view(sampleEntryFlight(flight,t-dt)),p,dt,aspect);
      const exit=createGlide(p,anchor,aspect,{velocity:v}), q=sampleGlide(exit,0).position;
      assert.ok(Math.hypot(q.x-p.position.x,q.y-p.position.y,q.z-p.position.z)<1e-9, `${width} ${id} Return from the entry starts on screen`);
    }
  }
  const top=manifestoPose(anchor,30,aspect), land=rest('owned');
  const flight=createGlide(top,land,aspect), end=sampleGlide(flight,1).position;
  assert.ok(Math.hypot(end.x-land.position.x,end.y-land.position.y,end.z-land.position.z)<1e-9,'the glide into the ground lands exactly');
  let previous;
  for(let i=0;i<=1000;i++) {
    const p=sampleGlide(flight,i/1000);camera.position.set(p.position.x,p.position.y,p.position.z);camera.up.set(p.up.x,p.up.y,p.up.z);camera.lookAt(new THREE.Vector3(p.target.x,p.target.y,p.target.z));
    if(previous)assert.ok(camera.quaternion.angleTo(previous)/(flight.seconds/1000)<2.2,`${width} root approach no close-range flip`);
    previous=camera.quaternion.clone();
  }
}
console.log('PASS all non-Purpose entries: moving join, continuous orientation, interrupt glide; glide into the ground: exact landing and continuous orientation');
