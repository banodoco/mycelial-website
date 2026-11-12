import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { manifestoPose, CAMERA_SECONDS } from '../journey/manifesto/pose.js';
import { createGlide, sampleGlide, glideChannels, glideVelocity, glidePose, GLIDE_HERO, GLIDE_MIN_SECONDS, GLIDE_MAX_SECONDS } from '../journey/manifesto/glide.js';
import { installVendorResolver } from './render-report-lib.mjs';

/* THE RETURN IS ONE GLIDE (2026-11, v3 — "the transition from the manifesto
   to purpose is still very janky ... make it smooth like the others").
   Every other hop is one blend on one quintic phase. The Return used to
   replay the climb backwards, with per-device curves and three stacked
   corrections; measured in the browser from the top, the phone's picture
   moved in three separate surges, up to 15 px a frame (at 640) and 131 deg/s.
   These oracles pin what a viewer sees, through a real THREE camera at the
   page's 62.5 Hz: one surge of motion (rising once, falling once) in the
   camera's speed, its turn rate and the picture's flow; the hero's screen
   x and y, the heading and the hero's apparent size each moving one way;
   velocity carried across the click; the exact rest at landing; and the same
   law on a phone and a desktop. A replay of the climb is run through the
   same meter and must fail it. */
installVendorResolver();
const THREE = await import('../vendor/three/three.module.js');
const { applyCameraRoll } = await import('./../journey/camera-roll.js');
const { poseAt } = await import('../journey/director.js');
const { restProgress } = await import('../journey/route.js');
const FRAME = 0.016;
const HERO = new THREE.Vector3(GLIDE_HERO.x, GLIDE_HERO.y, GLIDE_HERO.z);
const smoother = v => { v = Math.max(0, Math.min(1, v)); return v * v * v * (v * (v * 6 - 15) + 10); };

function restOf(aspect, width) {
  globalThis.window = { innerWidth: width, innerHeight: Math.round(width / aspect) };
  const p = poseAt(restProgress('final'), { pos: new THREE.Vector3(), target: new THREE.Vector3() }, undefined, aspect, width);
  return { position: { ...p.pos }, target: { ...p.target }, fov: p.fov, roll: p.roll || 0, fieldCenter: { x: .251658, z: -1.823989 } };
}
const VIEWS = [
  { name: 'desktop 1440x900', aspect: 1440 / 900, width: 1440 },
  { name: 'desktop 1280x720', aspect: 1280 / 720, width: 1280 },
  { name: 'desktop 800x500', aspect: 1.6, width: 800 },
  { name: 'phone 390x844', aspect: 390 / 844, width: 390 },
  { name: 'phone 430x932', aspect: 430 / 932, width: 430 },
];

// One camera, the way the page applies a pose: an explicit up, or the site's bank.
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 4000), aim = new THREE.Vector3();
function shoot(pose, aspect) {
  camera.aspect = aspect; camera.fov = pose.fov; camera.updateProjectionMatrix();
  camera.position.set(pose.position.x, pose.position.y, pose.position.z);
  aim.set(pose.target.x, pose.target.y, pose.target.z);
  if (pose.up) { camera.up.set(pose.up.x, pose.up.y, pose.up.z); camera.lookAt(aim); }
  else applyCameraRoll(camera, aim, pose.roll || 0);
  camera.updateMatrixWorld();
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
  return { q: camera.quaternion.clone(), position: camera.position.clone(), forward, up, fov: pose.fov, matrix: camera.matrixWorldInverse.clone(), projection: camera.projectionMatrix.clone() };
}
const SCREEN = [];
for (let i = 0; i < 9; i++) for (let j = 0; j < 7; j++) SCREEN.push([-0.9 + 1.8 * i / 8, -0.9 + 1.8 * j / 6]);
/** Measure a run of poses (the first is the last frame before the click). */
function meter(poses, aspect, width) {
  const height = width / aspect, shots = poses.map(p => shoot(p, aspect));
  const px = (shot, v) => {
    const c = v.clone().applyMatrix4(shot.matrix);
    const T = Math.tan(shot.fov * Math.PI / 360);
    return { x: (c.x / (-c.z * T * aspect) + 1) / 2 * width, y: (1 - c.y / (-c.z * T)) / 2 * height, depth: -c.z };
  };
  const rows = shots.map(shot => {
    const hero = px(shot, HERO);
    return { hero, size: 1 / (hero.depth * Math.tan(shot.fov * Math.PI / 360)), heading: Math.atan2(shot.forward.z, shot.forward.x) };
  });
  const out = { flow: [], speed: [], turn: [], dx: [], dy: [], dsize: [], dheading: [], step: [] };
  for (let i = 1; i < shots.length; i++) {
    const a = shots[i - 1], b = shots[i];
    // the picture's flow: a fixed screen grid cast onto the ground, re-projected
    let sum = 0;
    const T = Math.tan(a.fov * Math.PI / 360);
    for (const [nx, ny] of SCREEN) {
      const d = new THREE.Vector3(nx * T * aspect, ny * T, -1).applyQuaternion(a.q);
      let t = 300 / d.length();
      if (d.y < 0) t = Math.min(t, -a.position.y / d.y);
      const p = a.position.clone().addScaledVector(d, t), q = px(b, p);
      sum += Math.hypot(q.x - (nx + 1) / 2 * width, q.y - (1 - ny) / 2 * height);
    }
    out.flow.push(sum / SCREEN.length);
    out.speed.push(b.position.distanceTo(a.position) / FRAME);
    out.turn.push(b.q.angleTo(a.q) / FRAME);
    out.dx.push(rows[i].hero.x - rows[i - 1].hero.x);
    out.dy.push(rows[i].hero.y - rows[i - 1].hero.y);
    out.step.push(Math.hypot(out.dx.at(-1), out.dy.at(-1)));
    out.dsize.push(Math.log(rows[i].size / rows[i - 1].size));
    out.dheading.push(Math.atan2(Math.sin(rows[i].heading - rows[i - 1].heading), Math.cos(rows[i].heading - rows[i - 1].heading)));
  }
  return out;
}
const reversals = (ds, eps) => { let sign = 0, n = 0; for (const d of ds) { if (Math.abs(d) <= eps) continue; if (sign && Math.sign(d) !== sign) n++; sign = Math.sign(d); } return n; };
/** Surges of motion: maxima above 10% of the peak separated by a real dip. */
function lobes(v) {
  const peak = Math.max(...v), maxima = [];
  for (let i = 1; i < v.length - 1; i++) if (v[i] >= v[i - 1] && v[i] > v[i + 1] && v[i] > 0.1 * peak) maxima.push(i);
  let n = maxima.length ? 1 : 0;
  for (let j = 1; j < maxima.length; j++) {
    if (Math.min(...v.slice(maxima[j - 1], maxima[j] + 1)) < 0.85 * Math.min(v[maxima[j - 1]], v[maxima[j]])) n++;
  }
  return n;
}
/** A Return pressed `startU` of the way up, flown by `law(start, rest, aspect, velocity)`. */
function returnRun(rest, aspect, startU, law) {
  const S = startU * CAMERA_SECONDS;
  const before = manifestoPose(rest, S - FRAME, aspect), start = manifestoPose(rest, S, aspect);
  const view = p => { const s = shoot(p, aspect); return { position: p.position, target: p.target, forward: s.forward, up: s.up, fov: p.fov }; };
  const a = view(before), b = view(start);
  const { seconds, poseAt: at } = law(b, rest, aspect, glideVelocity(a, b, FRAME, aspect));
  const poses = [before, start];
  // the page's frames: 16 ms each, the last one clamped onto the landing
  for (let t = FRAME; ; t += FRAME) { poses.push(at(Math.min(1, t / seconds))); if (t >= seconds) break; }
  return { poses, seconds };
}
const GLIDE = (start, rest, aspect, velocity) => {
  const g = createGlide(start, rest, aspect, { velocity });
  return { seconds: g.seconds, poseAt: k => sampleGlide(g, k) };
};
const report = [];
for (const view of VIEWS) {
  const rest = restOf(view.aspect, view.width);
  const scale = 640 / view.width;   // judged at 640 px wide, the brief's frame
  for (const startU of [0.05, 0.25, 0.5, 0.8, 1]) {
    const { poses, seconds } = returnRun(rest, view.aspect, startU, GLIDE);
    const m = meter(poses, view.aspect, view.width);
    const at = `${view.name}, Return from ${startU}`;
    assert.ok(seconds >= GLIDE_MIN_SECONDS && seconds <= GLIDE_MAX_SECONDS, `${at}: bounded like the other hops (${seconds.toFixed(2)} s)`);
    // continuity at the click: the first glide frame moves the picture as the
    // climb's last frame did (the quintic's tangent carries every channel)
    assert.ok(Math.abs(m.flow[1] - m.flow[0]) * scale < 0.12, `${at}: no step in motion at the click (${m.flow[0].toFixed(3)} -> ${m.flow[1].toFixed(3)} px)`);
    assert.ok(Math.abs(m.step[1] - m.step[0]) * scale < 0.12, `${at}: the hero keeps its pace across the click`);
    // A press mid-climb has to turn the climb around: let that one smooth
    // turnaround settle (the glide's tangent decays by a third of its time),
    // then everything moves one way, in one surge.
    const from = startU >= 1 ? 1 : Math.ceil(0.33 * m.flow.length);
    const tail = key => m[key].slice(from);
    assert.equal(lobes(tail('flow')), 1, `${at}: the picture moves in one surge`);
    assert.equal(lobes(tail('speed')), 1, `${at}: the camera's speed rises once and falls once`);
    assert.ok(lobes(tail('turn')) <= 1, `${at}: the view turns in one surge`);
    assert.equal(reversals(tail('dx'), 0.01), 0, `${at}: the hero's screen x never reverses`);
    assert.equal(reversals(tail('dy'), 0.01), 0, `${at}: the hero's screen y never reverses`);
    assert.equal(reversals(tail('dsize'), 1e-6), 0, `${at}: the hero's apparent size changes one way (no lens breathing)`);
    assert.equal(reversals(tail('dheading'), 1e-6), 0, `${at}: the heading turns one way`);
    if (startU >= 1) {
      for (const key of ['dx', 'dy', 'dsize', 'dheading']) assert.equal(reversals(m[key], key[1] === 'x' || key[1] === 'y' ? 0.01 : 1e-6), 0, `${at}: from rest at the top, ${key} is monotone from the first frame`);
    }
    // no single-frame jump anywhere, including the click and the landing: a
    // frame's hero displacement never departs from the mean of its two
    // neighbours' by more than a fraction of a pixel (a 1.5 px step on top
    // of the motion is the round-2 jump bound; smooth motion measures ~0.05)
    let jump = 0;
    for (let i = 1; i < m.dx.length - 1; i++) {
      jump = Math.max(jump, Math.hypot(m.dx[i] - (m.dx[i - 1] + m.dx[i + 1]) / 2, m.dy[i] - (m.dy[i - 1] + m.dy[i + 1]) / 2) * scale);
    }
    assert.ok(jump <= 0.25, `${at}: no frame jumps off the glide (${jump.toFixed(3)} px at 640)`);
    const step = Math.max(...m.step) * scale;
    // landing: rates fall to zero and the pose is the rest
    assert.ok(m.flow.at(-1) * scale < 0.02 && m.turn.at(-1) < 1e-3, `${at}: the glide stops moving as it lands`);
    const end = poses.at(-1);
    assert.ok(Math.hypot(end.position.x - rest.position.x, end.position.y - rest.position.y, end.position.z - rest.position.z) < 1e-9, `${at}: lands on the rest`);
    assert.ok(shoot(end, view.aspect).q.angleTo(shoot(rest, view.aspect).q) < 1e-6, `${at}: lands in the rest's orientation`);
    report.push({ view: view.name, startU, seconds: +seconds.toFixed(2), peakFlow640: +(Math.max(...m.flow) * scale).toFixed(2),
      peakTurn: +(Math.max(...m.turn) * 180 / Math.PI).toFixed(1), heroStep640: +step.toFixed(2) });
  }
  // the meter still catches a replay of the climb (the old law's family) on the phone
  if (view.aspect < 1) {
    const S = CAMERA_SECONDS;
    const replay = (start, r, aspect) => ({ seconds: 4.8, poseAt: k => manifestoPose(r, (1 - smoother(k)) * S, aspect) });
    const m = meter(returnRun(rest, view.aspect, 1, replay).poses, view.aspect, view.width);
    const failures = [lobes(m.flow) > 1, reversals(m.dx, 0.01) > 0, reversals(m.dsize, 1e-6) > 0].filter(Boolean).length;
    assert.ok(failures >= 2, `${view.name}: the meter still catches a replayed climb (${failures} failures)`);
  }
}
console.table(report);
console.log('PASS Return glide on desktop and phone: one surge, monotone hero/size/heading, continuous click, exact landing; a replayed climb fails the meter');

// The same law on every device: the glide has no viewport branch.
const glideSource = readFileSync(new URL('../journey/manifesto/glide.js', import.meta.url), 'utf8');
assert.doesNotMatch(glideSource, /isMobileManifesto|innerWidth|aspect\s*</, 'the glide has no phone/desktop fork');
const branchSource = readFileSync(new URL('../journey/manifesto/branch.js', import.meta.url), 'utf8');
assert.doesNotMatch(branchSource, /descentU|descentPose|createReturnFlight/, 'the branch has no replayed descent or second return law');
assert.match(branchSource, /pose = \{ \.\.\.sampleGlide\(glide, glideK\(\)\)/, 'the branch flies the glide');
const poseSource = readFileSync(new URL('../journey/manifesto/pose.js', import.meta.url), 'utf8');
assert.doesNotMatch(poseSource, /export function descent|anchorScreenX|descentSpiral|descentFrameShift/, 'the replayed descent and its corrections are gone');
console.log('PASS one law: no device fork in the glide; the replayed descent is deleted');

// Pole safety: straight down (the phone's top) has no singular heading. A
// glide from exactly overhead, turned any way, rotates the picture smoothly.
{
  const rest = restOf(390 / 844, 390);
  for (const heading of [0, 1, 2, 3, -2]) {
    const overhead = { position: { x: 0.3, y: 38, z: -1.8 }, forward: { x: 0, y: -1, z: 0 },
      up: { x: Math.cos(heading), y: 0, z: Math.sin(heading) }, fov: 46, target: { x: 0.3, y: 0, z: -1.8 } };
    const g = createGlide(overhead, rest, 390 / 844);
    let prior = null, priorRate = null;
    for (let i = 0; i <= 400; i++) {
      const q = shoot(sampleGlide(g, i / 400), 390 / 844).q;
      assert.ok(q.toArray().every(Number.isFinite));
      if (prior) {
        const rate = q.angleTo(prior) / (g.seconds / 400);
        if (priorRate !== null) assert.ok(Math.abs(rate - priorRate) < 0.03, `overhead heading ${heading}: turn rate changes continuously`);
        priorRate = rate;
      }
      prior = q;
    }
  }
  // channels round-trip exactly, including straight down
  const c = glideChannels({ position: { x: 1, y: 30, z: 2 }, forward: { x: 0, y: -1, z: 0 }, up: { x: 0, y: 0, z: 1 }, fov: 46 }, 0.5);
  const p = glidePose(c, 0.5);
  assert.ok(Math.hypot(p.position.x - 1, p.position.y - 30, p.position.z - 2) < 1e-9, 'overhead pose round-trips');
}
console.log('PASS pole-safe: a glide from straight overhead turns the picture continuously');
